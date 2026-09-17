import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { app } from "electron";
import type { MediaAsset, MediaKind } from "../shared/types";
import { grokHome } from "./grok-config";
import type { LocalDb, MediaRow } from "./local-db";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "heic"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "mkv", "m4v"]);
const AUDIO_EXT = new Set(["wav", "mp3", "m4a", "aac", "ogg", "webm", "flac"]);
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  heic: "image/heic",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  m4v: "video/mp4",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac",
  txt: "text/plain",
};

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extOf(name: string): string {
  return extname(name).slice(1).toLowerCase();
}

function mimeOf(name: string): string {
  return MIME[extOf(name)] ?? "application/octet-stream";
}

function kindFrom(folder: string, name: string): MediaKind | undefined {
  const ext = extOf(name);
  if (folder === "videos" && (VIDEO_EXT.has(ext) || !ext)) return "video";
  if (folder === "images" && (IMAGE_EXT.has(ext) || !ext)) return "image";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext) && ext !== "webm") return "voice";
  return undefined;
}

function decodeCwd(name: string): string | undefined {
  try {
    const decoded = decodeURIComponent(name);
    return decoded.includes(":") || decoded.startsWith("/") || decoded.startsWith("\\\\") ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith("..");
}

export function mediaRoots(): string[] {
  return [join(grokHome(), "sessions"), app.getPath("userData")];
}

export function isAllowedMediaPath(filePath: string): boolean {
  if (!filePath) return false;
  const full = resolve(filePath);
  return mediaRoots().some((root) => isInside(root, full) || resolve(root) === full);
}

export function toMediaSrc(filePath: string): string {
  return `grok-media://local/?p=${encodeURIComponent(resolve(filePath))}`;
}

export function pathFromMediaUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get("p");
    return raw ? resolve(raw) : undefined;
  } catch {
    return undefined;
  }
}

function toAsset(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    kind: row.kind,
    path: row.path,
    name: row.name,
    mimeType: row.mime,
    size: row.size,
    createdAt: row.createdAt,
    src: row.path && existsSync(row.path) ? toMediaSrc(row.path) : "",
    prompt: row.prompt,
    sessionId: row.sessionId,
    cwd: row.cwd,
    text: row.body,
  };
}

async function guessPrompt(sessionDir: string, kind: MediaKind): Promise<string | undefined> {
  if (kind === "voice") return undefined;
  const file = join(sessionDir, "chat_history.jsonl");
  let raw = "";
  try {
    const info = await stat(file);
    const start = Math.max(0, info.size - 80_000);
    raw = await new Promise<string>((resolveRead, reject) => {
      const chunks: Buffer[] = [];
      const stream = createReadStream(file, { start });
      stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on("end", () => resolveRead(Buffer.concat(chunks).toString("utf8")));
      stream.on("error", reject);
    });
  } catch {
    return undefined;
  }
  const prefix = kind === "video" ? "/imagine-video" : "/imagine";
  const lines = raw.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim();
    if (!line) continue;
    try {
      const json = JSON.parse(line) as { type?: string; content?: unknown };
      if (json.type !== "user") continue;
      const text = userText(json.content);
      if (!text || text.length > 2000) continue;
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === prefix || trimmed.startsWith(`${prefix} `)) {
          return trimmed.slice(prefix.length).trim() || undefined;
        }
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

function userText(content: unknown): string | undefined {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  const parts: string[] = [];
  for (const item of content) {
    if (item && typeof item === "object" && "text" in item && typeof (item as { text: unknown }).text === "string") {
      parts.push((item as { text: string }).text);
    }
  }
  return parts.join("\n").trim() || undefined;
}

async function scanSessionFiles(): Promise<
  { path: string; name: string; kind: MediaKind; size: number; createdAt: number; sessionId: string; cwd?: string; sessionDir: string }[]
> {
  const root = join(grokHome(), "sessions");
  let groups: string[] = [];
  try {
    groups = await readdir(root);
  } catch {
    return [];
  }
  const found: {
    path: string;
    name: string;
    kind: MediaKind;
    size: number;
    createdAt: number;
    sessionId: string;
    cwd?: string;
    sessionDir: string;
  }[] = [];
  for (const groupName of groups) {
    if (groupName.endsWith(".sqlite") || groupName.startsWith(".")) continue;
    const groupDir = join(root, groupName);
    let groupStat;
    try {
      groupStat = await stat(groupDir);
    } catch {
      continue;
    }
    if (!groupStat.isDirectory()) continue;
    const cwd = decodeCwd(groupName);
    let sessions: string[] = [];
    try {
      sessions = await readdir(groupDir);
    } catch {
      continue;
    }
    for (const sessionId of sessions) {
      if (!SESSION_ID.test(sessionId)) continue;
      const sessionDir = join(groupDir, sessionId);
      for (const folder of ["images", "videos", "assets"] as const) {
        const dir = join(sessionDir, folder);
        let names: string[] = [];
        try {
          names = await readdir(dir);
        } catch {
          continue;
        }
        for (const name of names) {
          const kind = kindFrom(folder, name);
          if (!kind) continue;
          const filePath = join(dir, name);
          try {
            const info = await stat(filePath);
            if (!info.isFile() || info.size <= 0) continue;
            found.push({
              path: filePath,
              name,
              kind,
              size: info.size,
              createdAt: Math.round(info.mtimeMs),
              sessionId,
              cwd,
              sessionDir,
            });
          } catch {
            continue;
          }
        }
      }
    }
  }
  return found;
}

export async function listMediaLibrary(db: LocalDb, kind?: MediaKind): Promise<MediaAsset[]> {
  const disk = await scanSessionFiles();
  const existing = new Map(db.listMediaRows().map((row) => [row.path, row]));
  let dirty = false;
  const sessionPrompt = new Map<string, { image?: string; video?: string }>();

  for (const file of disk) {
    const prev = existing.get(file.path);
    if (prev?.hidden) continue;
    let prompt = prev?.prompt;
    if (!prompt) prompt = db.consumePending(file.kind, file.createdAt + 120_000);
    if (!prompt) {
      const key = file.sessionDir;
      let cached = sessionPrompt.get(key);
      if (!cached) {
        cached = {
          image: await guessPrompt(file.sessionDir, "image"),
          video: await guessPrompt(file.sessionDir, "video"),
        };
        sessionPrompt.set(key, cached);
      }
      prompt = file.kind === "video" ? cached.video : cached.image;
    }
    const row: MediaRow = {
      id: prev?.id || randomUUID(),
      kind: file.kind,
      path: file.path,
      name: file.name,
      mime: mimeOf(file.name),
      size: file.size,
      createdAt: file.createdAt,
      prompt,
      sessionId: file.sessionId,
      cwd: file.cwd,
      body: prev?.body,
      hidden: false,
    };
    db.upsertMedia(row, false);
    existing.set(file.path, row);
    dirty = true;
  }
  if (dirty) db.flush();

  const assets: MediaAsset[] = [];
  for (const row of existing.values()) {
    if (row.hidden) continue;
    if (kind && row.kind !== kind) continue;
    if (row.kind !== "voice" && !existsSync(row.path)) continue;
    if (row.kind === "voice" && !row.body && !existsSync(row.path)) continue;
    assets.push(toAsset(row));
  }
  assets.sort((a, b) => b.createdAt - a.createdAt);
  return assets;
}

export async function deleteMediaAsset(db: LocalDb, id: string): Promise<{ ok: boolean; error?: string }> {
  const row = db.hideMedia(id);
  if (!row) return { ok: false, error: "找不到这个资源" };
  if (row.path && existsSync(row.path) && isAllowedMediaPath(row.path)) {
    try {
      await unlink(row.path);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { ok: true };
}

export async function saveTranscript(db: LocalDb, text: string, prompt?: string): Promise<MediaAsset> {
  const body = text.trim();
  if (!body) throw new Error("没有可保存的转写");
  const dir = join(app.getPath("userData"), "transcripts");
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const name = `${id.slice(0, 8)}.txt`;
  const filePath = join(dir, name);
  await writeFile(filePath, body, "utf8");
  const row: MediaRow = {
    id,
    kind: "voice",
    path: filePath,
    name,
    mime: "text/plain",
    size: Buffer.byteLength(body),
    createdAt: Date.now(),
    prompt: prompt?.trim() || undefined,
    body,
    hidden: false,
  };
  db.upsertMedia(row);
  return toAsset(row);
}

export async function exportMediaFile(src: string, dest: string): Promise<void> {
  const full = resolve(src);
  if (!isAllowedMediaPath(full) || !existsSync(full)) throw new Error("找不到源文件");
  await copyFile(full, dest);
}


