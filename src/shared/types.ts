import type { SlashCommand } from "./slash";
import type { GrokSettings } from "./grok-settings";

export type ConnectionState =
  | "idle"
  | "starting"
  | "ready"
  | "error"
  | "stopped";

export type ToolStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled"
  | string;

export type ToolDiff = {
  path: string;
  oldText?: string;
  newText?: string;
};

export type TimelineItem =
  | { id: string; kind: "user"; text: string; at?: number }
  | { id: string; kind: "thought"; text: string; streaming?: boolean; at?: number; durationMs?: number; tokens?: number }
  | { id: string; kind: "assistant"; text: string; streaming?: boolean; at?: number; durationMs?: number; tokens?: number }
  | {
      id: string;
      kind: "tool";
      toolCallId: string;
      title: string;
      status: ToolStatus;
      toolKind?: string;
      rawInput?: unknown;
      outputText?: string;
      diffs?: ToolDiff[];
      at?: number;
      durationMs?: number;
      tokens?: number;
    }
  | { id: string; kind: "plan"; text: string; at?: number; durationMs?: number; tokens?: number }
  | { id: string; kind: "system"; text: string; tone?: "info" | "error"; at?: number };

export type PermissionOption = {
  optionId: string;
  name: string;
  kind?: string;
};

export type PermissionRequest = {
  requestId: string;
  sessionId: string;
  title: string;
  toolKind?: string;
  toolCallId?: string;
  rawInput?: unknown;
  options: PermissionOption[];
};

export type SessionSummary = {
  sessionId: string;
  cwd?: string;
  title?: string;
  updatedAt?: string;
  updatedAtMs?: number;
  pinned?: boolean;
  pinOrder?: number;
  unread?: boolean;
  archived?: boolean;
  interrupted?: boolean;
};

export type UpdateRiskSession = {
  sessionId: string;
  title: string;
  cwd?: string;
  busy?: boolean;
};

export type GrokUpdateInfo = {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  channel?: string;
  installer?: string;
  checking?: boolean;
  applying?: boolean;
  error?: string;
  currentNotes?: string;
  latestNotes?: string;
  translatedLog?: string;
  translating?: boolean;
  atRisk: UpdateRiskSession[];
};

export type QuotaInfo = {
  usedPercent?: number;
  remainingPercent?: number;
  plan?: string;
  resetAt?: string;
  extraCredits?: string;
};

export type AccountInfo = {
  email?: string;
  plan?: string;
  modelName?: string;
  agentVersion?: string;
  connection: ConnectionState;
  grokBinary?: string;
  quota?: QuotaInfo;
};

export type SessionMode = "ask" | "auto" | "yolo" | "plan";

export type GroupSort = "recent" | "name-asc" | "name-desc" | "count";
export type SessionSort = "recent" | "title-asc" | "title-desc";

const GROUP_SORTS: GroupSort[] = ["recent", "name-asc", "name-desc", "count"];
const SESSION_SORTS: SessionSort[] = ["recent", "title-asc", "title-desc"];

export function parseGroupSort(value: unknown): GroupSort {
  return typeof value === "string" && (GROUP_SORTS as string[]).includes(value) ? (value as GroupSort) : "recent";
}

export function parseSessionSort(value: unknown): SessionSort {
  return typeof value === "string" && (SESSION_SORTS as string[]).includes(value) ? (value as SessionSort) : "recent";
}

export type ModelInfo = {
  modelId: string;
  name: string;
  efforts?: string[];
  defaultEffort?: string;
};

export type StartOptions = {
  workspace: string;
  mode?: SessionMode;
  modelId?: string;
  effort?: string;
};

export type AppSnapshot = {
  connection: ConnectionState;
  error?: string;
  workspace?: string;
  sessionId?: string;
  sessionTitle?: string;
  modelId?: string;
  modelName?: string;
  effort?: string;
  sessionMode: SessionMode;
  models: ModelInfo[];
  inspectorWidth: number;
  accountEmail?: string;
  agentVersion?: string;
  grokBinary?: string;
  timeline: TimelineItem[];
  busy: boolean;
  permission?: PermissionRequest;
  sessions: SessionSummary[];
  alwaysApprove: boolean;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  collapsedGroups: string[];
  groupSort: GroupSort;
  sessionSort: SessionSort;
  account: AccountInfo;
  commands: SlashCommand[];
  settings: GrokSettings;
  update?: GrokUpdateInfo;
};

export type { SlashCommand } from "./slash";
export type { GrokSettings } from "./grok-settings";

export type AgentUiEvent =
  | { type: "snapshot"; snapshot: AppSnapshot }
  | { type: "timeline"; item: TimelineItem }
  | { type: "timeline-patch"; id: string; patch: Partial<TimelineItem> };

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
