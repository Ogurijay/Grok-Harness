import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { grokHome } from "./grok-config";
import { resolveGrokBinary } from "./resolve-binary";
import type { GrokUpdateInfo, SessionSummary, UpdateRiskSession } from "../shared/types";

type CheckJson = {
  currentVersion?: string;
  latestVersion?: string | null;
  updateAvailable?: boolean;
  installer?: string;
  channel?: string;
  autoUpdate?: boolean;
  error?: string;
};

type ActiveRow = {
  session_id?: string;
  sessionId?: string;
  pid?: number;
  cwd?: string;
};

export function compareVersions(a: string, b: string): number {
  const parse = (value: string) =>
    value
      .trim()
      .replace(/^v/i, "")
      .split("-")[0]!
      .split(".")
      .map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i++) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta) return delta;
  }
  return 0;
}

function nodeishPath(): NodeJS.ProcessEnv {
  const extras: string[] = [];
  if (process.platform === "win32") {
    extras.push(
      join(process.env.ProgramFiles || "C:\\Program Files", "nodejs"),
      join(homedir(), "AppData", "Roaming", "npm"),
    );
  } else {
    extras.push("/usr/local/bin", join(homedir(), ".local", "bin"));
  }
  return {
    ...process.env,
    PATH: [...extras, process.env.PATH ?? ""].join(delimiter),
  };
}

function npmBin(): string {
  if (process.platform !== "win32") return "npm";
  const cmd = join(process.env.ProgramFiles || "C:\\Program Files", "nodejs", "npm.cmd");
  if (existsSync(cmd)) return cmd;
  return "npm";
}

function needsShell(command: string): boolean {
  return process.platform === "win32" && (/\.(cmd|bat)$/i.test(command) || command === "npm");
}

function spawnCommand(command: string): { command: string; shell: boolean } {
  const shell = needsShell(command);
  if (shell && command.includes(" ")) return { command: `"${command}"`, shell: true };
  return { command, shell };
}

function run(
  command: string,
  args: string[],
  timeoutMs: number,
  cwd?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const spawned = spawnCommand(command);
    const child = spawn(spawned.command, args, {
      windowsHide: true,
      cwd: cwd && existsSync(cwd) ? cwd : undefined,
      env: { ...nodeishPath(), GROK_DISABLE_AUTOUPDATER: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      shell: spawned.shell,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${command} 超时`));
    }, timeoutMs);
    child.stdout?.on("data", (buf: Buffer) => {
      stdout += buf.toString();
    });
    child.stderr?.on("data", (buf: Buffer) => {
      stderr += buf.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export function parseGrokVersion(text: string): string | undefined {
  const match = text.match(/\b(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\b/);
  return match?.[1];
}

export async function readInstalledVersion(binary?: string): Promise<string> {
  const exe = binary ?? resolveGrokBinary();
  const result = await run(exe, ["--version"], 12_000);
  return parseGrokVersion(`${result.stdout}\n${result.stderr}`) ?? "unknown";
}

function readLocalNotes(): string {
  const md = join(grokHome(), "CHANGELOG.md");
  if (existsSync(md)) return readFileSync(md, "utf8").trim();
  const jsonPath = join(grokHome(), "CHANGELOG.json");
  if (!existsSync(jsonPath)) return "";
  try {
    const rows = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
    if (!Array.isArray(rows)) return "";
    return rows
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        const rec = row as { category?: unknown; description?: unknown };
        const category = typeof rec.category === "string" ? rec.category : "";
        const description = typeof rec.description === "string" ? rec.description : "";
        if (!description) return "";
        return category ? `- (${category}) ${description}` : `- ${description}`;
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

async function fetchRemoteNotes(version: string): Promise<string> {
  const urls = [
    `https://raw.githubusercontent.com/xai-org/grok-build/main/crates/codegen/xai-grok-shell/changelogs/${version}.md`,
    `https://raw.githubusercontent.com/xai-org/grok-build/main/crates/codegen/xai-grok-pager/docs/changelogs/${version}.md`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = (await res.text()).trim();
      if (text && !text.startsWith("404") && !text.includes("Not Found")) return text;
    } catch {
      /* try next */
    }
  }
  return "";
}

async function npmLatest(): Promise<string | undefined> {
  const commands = process.platform === "win32" ? [npmBin(), "npm"] : ["npm"];
  for (const command of commands) {
    try {
      const result = await run(command, ["view", "@xai-official/grok", "version"], 20_000);
      const version = parseGrokVersion(result.stdout.trim().split(/\s+/).pop() ?? "");
      if (version) return version;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

function publicUpdateError(error?: string): string | undefined {
  if (!error) return undefined;
  const text = error.toLowerCase();
  if (text.includes("program not found") || text.includes("enoent") || text.includes("einval")) return undefined;
  return error.trim() || undefined;
}

export function listLiveGrokSessions(): UpdateRiskSession[] {
  const file = join(grokHome(), "active_sessions.json");
  if (!existsSync(file)) return [];
  try {
    const rows = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (!Array.isArray(rows)) return [];
    const out: UpdateRiskSession[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const rec = row as ActiveRow;
      const sessionId = rec.session_id || rec.sessionId;
      const pid = Number(rec.pid);
      if (!sessionId || !Number.isFinite(pid) || pid <= 0) continue;
      if (!pidAlive(pid)) continue;
      out.push({
        sessionId,
        title: sessionId.slice(0, 8),
        cwd: rec.cwd,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
    return code === "EPERM";
  }
}

export function collectAtRisk(
  sessions: SessionSummary[],
  currentId?: string,
  busy = false,
): UpdateRiskSession[] {
  const byId = new Map(sessions.map((row) => [row.sessionId, row]));
  const merged = new Map<string, UpdateRiskSession>();
  for (const live of listLiveGrokSessions()) {
    const known = byId.get(live.sessionId);
    merged.set(live.sessionId, {
      sessionId: live.sessionId,
      title: known?.title || live.title,
      cwd: known?.cwd || live.cwd,
      busy: live.sessionId === currentId ? busy : false,
    });
  }
  if (currentId) {
    const known = byId.get(currentId);
    merged.set(currentId, {
      sessionId: currentId,
      title: known?.title || "当前对话",
      cwd: known?.cwd,
      busy,
    });
  }
  return [...merged.values()];
}

export async function checkGrokUpdate(binary?: string): Promise<GrokUpdateInfo> {
  const currentVersion = await readInstalledVersion(binary);
  const currentNotes = readLocalNotes();
  let latestVersion: string | undefined;
  let installer: string | undefined;
  let channel: string | undefined;
  let error: string | undefined;
  try {
    const exe = binary ?? resolveGrokBinary();
    const result = await run(exe, ["update", "--check", "--json"], 25_000);
    const parsed = JSON.parse(result.stdout || result.stderr || "{}") as CheckJson;
    installer = parsed.installer;
    channel = parsed.channel;
    if (typeof parsed.latestVersion === "string" && parsed.latestVersion.trim()) {
      latestVersion = parsed.latestVersion.trim();
    }
    if (typeof parsed.currentVersion === "string" && parsed.currentVersion.trim()) {
      /* prefer CLI current when present */
    }
    if (parsed.error) error = String(parsed.error);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  if (!latestVersion) {
    const npmVersion = await npmLatest();
    if (npmVersion) latestVersion = npmVersion;
  }
  const updateAvailable = Boolean(latestVersion && compareVersions(latestVersion, currentVersion) > 0);
  const latestNotes = updateAvailable && latestVersion ? await fetchRemoteNotes(latestVersion) : "";
  return {
    currentVersion,
    latestVersion,
    updateAvailable,
    channel,
    installer,
    error: updateAvailable ? undefined : publicUpdateError(error),
    currentNotes,
    latestNotes: latestNotes || undefined,
    translatedLog: readTranslatedChangelog() || undefined,
    atRisk: [],
  };
}

export function translatedChangelogPath(): string {
  return join(grokHome(), "webui-changelog.zh.md");
}

export function readTranslatedChangelog(): string {
  const file = translatedChangelogPath();
  if (!existsSync(file)) return "";
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

function changelogHasVersion(log: string, version: string): boolean {
  const safe = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^#\\s+${safe}\\b`, "m").test(log);
}

function jsonText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object") return undefined;
  const rec = value as Record<string, unknown>;
  if (typeof rec.result === "string" && rec.result.trim()) return rec.result;
  if (typeof rec.text === "string" && rec.text.trim()) return rec.text;
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  if (rec.content != null) return jsonText(rec.content);
  return undefined;
}

function extractHeadlessText(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) return "";
  try {
    const text = jsonText(JSON.parse(trimmed));
    if (text) return text.trim();
  } catch {
    /* line-wise */
  }
  const parts: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const row = line.trim();
    if (!row.startsWith("{")) continue;
    try {
      const rec = JSON.parse(row) as Record<string, unknown>;
      const type = typeof rec.type === "string" ? rec.type : "";
      if (type && !/assistant|result|message|text/i.test(type)) continue;
      const text = jsonText(rec);
      if (text) parts.push(text.trim());
    } catch {
      /* ignore */
    }
  }
  if (parts.length) return parts.join("\n\n");
  return trimmed;
}

async function translateNotesWithGrok(binary: string, notes: string): Promise<string> {
  const source = notes.trim().slice(0, 12_000);
  if (!source) return "";
  const prompt = [
    "将下面的 Grok Build 更新说明翻译成简体中文。",
    "只输出译文 Markdown：不要前言、不要解释、不要使用任何工具。",
    "保留标题、列表和加粗；产品名、命令、配置键、路径保持原文。",
    "",
    source,
  ].join("\n");
  const promptFile = join(tmpdir(), `grok-harness-changelog-${Date.now()}.txt`);
  writeFileSync(promptFile, prompt, "utf8");
  try {
    const result = await run(
      binary,
      [
        "--prompt-file",
        promptFile,
        "--output-format",
        "json",
        "--no-auto-update",
        "--always-approve",
        "--no-plan",
        "--no-subagents",
        "--disable-web-search",
        "--disallowed-tools",
        "run_terminal_cmd,web_search,web_fetch,search_replace,write,Agent",
        "--max-turns",
        "1",
        "--effort",
        "low",
        "--cwd",
        grokHome(),
      ],
      3 * 60_000,
      grokHome(),
    );
    if (result.code !== 0) {
      throw new Error((result.stderr || result.stdout).trim().slice(-1500) || `grok 翻译失败 (${result.code})`);
    }
    const text = extractHeadlessText(result.stdout || result.stderr);
    if (!text) throw new Error("grok 没有返回译文");
    return text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "").trim();
  } finally {
    try {
      unlinkSync(promptFile);
    } catch {
      /* ignore */
    }
  }
}

export async function recordTranslatedUpdate(binary: string, version: string, notes: string): Promise<string> {
  const existing = readTranslatedChangelog();
  if (version && changelogHasVersion(existing, version)) return existing;
  const source = notes.trim();
  if (!source) return existing;
  let body = source;
  try {
    body = (await translateNotesWithGrok(binary, source)) || source;
  } catch (err) {
    console.error("changelog translate failed", err);
    body = `> 自动翻译失败，以下为原文。\n\n${source}`;
  }
  const day = new Date().toISOString().slice(0, 10);
  const entry = `# ${version} — ${day}\n\n${body.trim()}\n`;
  const next = existing ? `${entry}\n---\n\n${existing}\n` : `${entry}\n`;
  writeFileSync(translatedChangelogPath(), next, "utf8");
  return next.trim();
}

export async function installGrokUpdate(binary?: string, installer?: string): Promise<void> {
  const exe = binary ?? resolveGrokBinary();
  try {
    const result = await run(exe, ["update"], 5 * 60_000);
    if (result.code === 0) return;
    const output = `${result.stdout}\n${result.stderr}`;
    if (installer !== "npm" && !/program not found|npm/i.test(output)) {
      throw new Error(output.trim().slice(-2000) || `grok update 失败 (${result.code})`);
    }
  } catch (err) {
    if (installer !== "npm") throw err;
  }
  const npmResult = await run(npmBin(), ["install", "-g", "@xai-official/grok"], 5 * 60_000);
  if (npmResult.code !== 0) {
    throw new Error((npmResult.stderr || npmResult.stdout).trim().slice(-2000) || "npm 安装 grok 失败");
  }
}
