import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "smol-toml";
import { GROK_SETTINGS_DEFAULTS, type GrokSettings, type PermissionMode } from "../shared/grok-settings";

type TomlTable = Record<string, unknown>;

type Wire =
  | { kind: "bool"; path: string[] }
  | { kind: "string"; path: string[]; emptyDeletes?: boolean }
  | { kind: "number"; path: string[]; optional?: boolean }
  | { kind: "list"; path: string[] }
  | { kind: "special" };

const WIRE: { [K in keyof GrokSettings]: Wire } = {
  autoUpdate: { kind: "bool", path: ["cli", "auto_update"] },
  cliChannel: { kind: "string", path: ["cli", "channel"] },
  showTips: { kind: "bool", path: ["cli", "show_tips"] },
  defaultModel: { kind: "string", path: ["models", "default"] },
  defaultEffort: { kind: "string", path: ["models", "default_reasoning_effort"] },
  webSearchModel: { kind: "string", path: ["models", "web_search"], emptyDeletes: true },
  sessionSummaryModel: { kind: "string", path: ["models", "session_summary"], emptyDeletes: true },
  imageDescriptionModel: { kind: "string", path: ["models", "image_description"], emptyDeletes: true },
  permissionMode: { kind: "special" },
  rememberToolApprovals: { kind: "bool", path: ["ui", "remember_tool_approvals"] },
  defaultSelectedPermission: { kind: "string", path: ["ui", "default_selected_permission"] },
  showThinkingBlocks: { kind: "bool", path: ["ui", "show_thinking_blocks"] },
  groupToolVerbs: { kind: "bool", path: ["ui", "group_tool_verbs"] },
  collapsedEditBlocks: { kind: "bool", path: ["ui", "collapsed_edit_blocks"] },
  pageFlipOnSend: { kind: "bool", path: ["ui", "page_flip_on_send"] },
  followUpBehavior: { kind: "string", path: ["ui", "follow_up_behavior"] },
  compactMode: { kind: "bool", path: ["ui", "compact_mode"] },
  showTimestamps: { kind: "bool", path: ["ui", "show_timestamps"] },
  showTimeline: { kind: "bool", path: ["ui", "show_timeline"] },
  combineQueuedPrompts: { kind: "bool", path: ["ui", "combine_queued_prompts"] },
  forkSecondaryModel: { kind: "string", path: ["ui", "fork_secondary_model"], emptyDeletes: true },
  maxThoughtsWidth: { kind: "number", path: ["ui", "max_thoughts_width"] },
  promptSuggestions: { kind: "bool", path: ["ui", "prompt_suggestions"] },
  theme: { kind: "string", path: ["ui", "theme"] },
  autoDarkTheme: { kind: "string", path: ["ui", "auto_dark_theme"] },
  autoLightTheme: { kind: "string", path: ["ui", "auto_light_theme"] },
  simpleMode: { kind: "bool", path: ["ui", "simple_mode"] },
  vimMode: { kind: "bool", path: ["ui", "vim_mode"] },
  screenMode: { kind: "string", path: ["ui", "screen_mode"] },
  renderMermaid: { kind: "string", path: ["ui", "render_mermaid"] },
  scrollSpeed: { kind: "number", path: ["ui", "scroll_speed"] },
  scrollMode: { kind: "string", path: ["ui", "scroll_mode"] },
  scrollLines: { kind: "number", path: ["ui", "scroll_lines"], optional: true },
  invertScroll: { kind: "bool", path: ["ui", "invert_scroll"] },
  cancelSubagentsOnTurnCancel: { kind: "string", path: ["ui", "cancel_subagents_on_turn_cancel"] },
  hunkTrackerMode: { kind: "string", path: ["ui", "hunk_tracker_mode"] },
  voiceKeybindEnabled: { kind: "bool", path: ["ui", "voice_keybind_enabled"] },
  voiceCaptureMode: { kind: "string", path: ["ui", "voice_capture_mode"] },
  telemetry: { kind: "bool", path: ["features", "telemetry"] },
  feedback: { kind: "bool", path: ["features", "feedback"] },
  lspTools: { kind: "bool", path: ["features", "lsp_tools"] },
  codebaseIndexing: { kind: "bool", path: ["features", "codebase_indexing"] },
  twoPassCompaction: { kind: "bool", path: ["features", "two_pass_compaction"] },
  remoteFetch: { kind: "bool", path: ["features", "remote_fetch"] },
  webFetch: { kind: "bool", path: ["features", "web_fetch"] },
  writeFile: { kind: "bool", path: ["features", "write_file"] },
  toolSearch: { kind: "bool", path: ["features", "tool_search"] },
  memoryEnabled: { kind: "bool", path: ["memory", "enabled"] },
  subagentsEnabled: { kind: "bool", path: ["subagents", "enabled"] },
  workflowsEnabled: { kind: "bool", path: ["workflows", "enabled"] },
  traceUpload: { kind: "bool", path: ["telemetry", "trace_upload"] },
  disableCodebaseUpload: { kind: "bool", path: ["harness", "disable_codebase_upload"] },
  autoCompactPercent: { kind: "number", path: ["session", "auto_compact_threshold_percent"] },
  loadEnvrc: { kind: "bool", path: ["session", "load_envrc"] },
  respectGitignore: { kind: "bool", path: ["tools", "respect_gitignore"] },
  bashTimeoutSecs: { kind: "number", path: ["toolset", "bash", "timeout_secs"] },
  bashOutputByteLimit: { kind: "number", path: ["toolset", "bash", "output_byte_limit"] },
  bashMaxTimeoutSecs: { kind: "number", path: ["toolset", "bash", "max_timeout_secs"] },
  bashAutoBackgroundOnTimeout: { kind: "bool", path: ["toolset", "bash", "auto_background_on_timeout"] },
  askQuestionTimeoutEnabled: { kind: "bool", path: ["toolset", "ask_user_question", "timeout_enabled"] },
  askQuestionTimeoutSecs: { kind: "number", path: ["toolset", "ask_user_question", "timeout_secs"] },
  webFetchAllowLocal: { kind: "bool", path: ["toolset", "web_fetch", "allow_local"] },
  webFetchAllowedDomains: { kind: "list", path: ["toolset", "web_fetch", "allowed_domains"] },
  webSearchAllowedDomains: { kind: "list", path: ["toolset", "web_search", "allowed_domains"] },
  webSearchExcludedDomains: { kind: "list", path: ["toolset", "web_search", "excluded_domains"] },
  sandboxProfile: { kind: "string", path: ["sandbox", "profile"] },
  sandboxAutoAllowBash: { kind: "bool", path: ["sandbox", "auto_allow_bash"] },
  newSessionWorktreeMode: { kind: "string", path: ["hints", "new_session_worktree_mode"] },
  forkWorktreeMode: { kind: "string", path: ["hints", "fork_worktree_mode"] },
  notifyMethod: { kind: "string", path: ["ui", "notifications", "method"] },
  notifyCondition: { kind: "string", path: ["ui", "notifications", "condition"] },
  notifyIdleSecs: { kind: "number", path: ["ui", "notifications", "idle_threshold_secs"] },
  notifyTurnComplete: { kind: "special" },
  notifyApproval: { kind: "special" },
  notifySleepPrevention: { kind: "bool", path: ["ui", "notifications", "sleep_prevention"] },
  notifyProgressBar: { kind: "bool", path: ["ui", "notifications", "progress_bar"] },
  notifyTitleEnabled: { kind: "bool", path: ["ui", "notifications", "title", "enabled"] },
  cursorSkills: { kind: "bool", path: ["compat", "cursor", "skills"] },
  cursorRules: { kind: "bool", path: ["compat", "cursor", "rules"] },
  cursorAgents: { kind: "bool", path: ["compat", "cursor", "agents"] },
  cursorMcps: { kind: "bool", path: ["compat", "cursor", "mcps"] },
  cursorHooks: { kind: "bool", path: ["compat", "cursor", "hooks"] },
  claudeSkills: { kind: "bool", path: ["compat", "claude", "skills"] },
  claudeRules: { kind: "bool", path: ["compat", "claude", "rules"] },
  claudeAgents: { kind: "bool", path: ["compat", "claude", "agents"] },
  claudeMcps: { kind: "bool", path: ["compat", "claude", "mcps"] },
  claudeHooks: { kind: "bool", path: ["compat", "claude", "hooks"] },
};

export function grokHome(): string {
  return process.env.GROK_HOME?.trim() || join(homedir(), ".grok");
}

export function defaultWorkspace(): string {
  return homedir();
}

export function resolveWorkspace(folder?: string | null): string {
  const next = folder?.trim();
  return next || defaultWorkspace();
}

export function grokConfigPath(): string {
  return join(grokHome(), "config.toml");
}

function asTable(value: unknown): TomlTable {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as TomlTable;
  return {};
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => splitList(item));
  if (typeof value !== "string") return [];
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: unknown): string {
  return splitList(value).join(", ");
}

function get(table: TomlTable, ...keys: string[]): unknown {
  let cur: unknown = table;
  for (const key of keys) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as TomlTable)[key];
  }
  return cur;
}

function set(table: TomlTable, keys: string[], value: unknown): void {
  let cur = table;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    const next = cur[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) cur[key] = {};
    cur = cur[key] as TomlTable;
  }
  cur[keys[keys.length - 1]!] = value;
}

function del(table: TomlTable, keys: string[]): void {
  let cur: unknown = table;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return;
    cur = (cur as TomlTable)[keys[i]!];
  }
  if (!cur || typeof cur !== "object" || Array.isArray(cur)) return;
  delete (cur as TomlTable)[keys[keys.length - 1]!];
}

export function loadGrokToml(): TomlTable {
  const file = grokConfigPath();
  if (!existsSync(file)) return {};
  try {
    const parsed = parse(readFileSync(file, "utf8"));
    return asTable(parsed);
  } catch (err) {
    console.error("failed to parse grok config.toml", err);
    return {};
  }
}

export function saveGrokToml(table: TomlTable): void {
  mkdirSync(grokHome(), { recursive: true });
  writeFileSync(grokConfigPath(), `${stringify(table)}\n`, "utf8");
}

function permissionModeFromToml(ui: TomlTable): PermissionMode {
  if (asBool(ui.yolo, false)) return "always-approve";
  const mode = asString(ui.permission_mode, "").toLowerCase();
  if (mode === "always-approve" || mode === "always_approve" || mode === "yolo" || mode === "bypasspermissions") {
    return "always-approve";
  }
  if (mode === "auto") return "auto";
  if (mode === "ask" || mode === "default") return "ask";
  return GROK_SETTINGS_DEFAULTS.permissionMode;
}

function notifyEvents(table: TomlTable): string[] | undefined {
  const raw = get(table, "ui", "notifications", "events");
  if (raw === undefined) return undefined;
  return splitList(raw);
}

export function settingsFromToml(table: TomlTable): GrokSettings {
  const d = GROK_SETTINGS_DEFAULTS;
  const out: GrokSettings = { ...d };
  for (const key of Object.keys(WIRE) as (keyof GrokSettings)[]) {
    const wire = WIRE[key];
    if (wire.kind === "special") continue;
    const raw = get(table, ...wire.path);
    if (raw === undefined) continue;
    if (wire.kind === "bool") out[key] = asBool(raw, d[key] as boolean) as never;
    else if (wire.kind === "string") out[key] = asString(raw, d[key] as string) as never;
    else if (wire.kind === "list") out[key] = joinList(raw) as never;
    else if (wire.kind === "number") {
      if (wire.optional && (raw === null || raw === "")) out[key] = null as never;
      else out[key] = asNumber(raw, (d[key] as number | null) ?? 0) as never;
    }
  }
  out.permissionMode = permissionModeFromToml(asTable(table.ui));
  const follow = asString(out.followUpBehavior, d.followUpBehavior);
  out.followUpBehavior = follow === "steer" ? "steer" : "queue";
  const events = notifyEvents(table);
  if (events) {
    out.notifyTurnComplete = events.includes("turn_complete");
    out.notifyApproval = events.includes("approval_required");
  }
  return out;
}

function writeNotifyEvent(table: TomlTable, flag: "turn_complete" | "approval_required", on: boolean): void {
  const current = notifyEvents(table) ?? ["turn_complete", "approval_required"];
  const next = new Set(current);
  if (on) next.add(flag);
  else next.delete(flag);
  set(table, ["ui", "notifications", "events"], [...next]);
}

export function applySetting(table: TomlTable, key: keyof GrokSettings, value: unknown): TomlTable {
  const wire = WIRE[key];
  if (!wire) return table;
  if (key === "permissionMode") {
    const mode = String(value);
    set(table, ["ui", "permission_mode"], mode);
    set(table, ["ui", "yolo"], mode === "always-approve");
    return table;
  }
  if (key === "notifyTurnComplete") {
    writeNotifyEvent(table, "turn_complete", Boolean(value));
    return table;
  }
  if (key === "notifyApproval") {
    writeNotifyEvent(table, "approval_required", Boolean(value));
    return table;
  }
  if (wire.kind === "bool") {
    set(table, wire.path, Boolean(value));
    return table;
  }
  if (wire.kind === "string") {
    const text = String(value ?? "").trim();
    if (wire.emptyDeletes && !text) del(table, wire.path);
    else set(table, wire.path, text);
    return table;
  }
  if (wire.kind === "list") {
    const items = splitList(value);
    if (!items.length) del(table, wire.path);
    else set(table, wire.path, items);
    return table;
  }
  if (wire.kind === "number") {
    if (wire.optional && (value === null || value === undefined || value === "")) {
      del(table, wire.path);
      return table;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) return table;
    set(table, wire.path, num);
    return table;
  }
  return table;
}
