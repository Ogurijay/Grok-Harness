import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type {
  AppSnapshot,
  GroupSort,
  PermissionRequest,
  SessionSort,
  SessionSummary,
  SlashCommand,
  TimelineItem,
} from "../shared/types";
import { normalizeGroupKey } from "../shared/types";
import { CodeView, prettyUnknown } from "./CodeView";
import { aggregateStats, formatStepStats } from "../shared/step-stats";
import { GROK_SETTINGS_DEFAULTS } from "../shared/grok-settings";
import { ModelEffortPicker } from "./ModelEffortPicker";
import { SettingsPanel } from "./SettingsPanel";
import { UpdatePanel } from "./UpdatePanel";

const empty: AppSnapshot = {
  connection: "idle",
  models: [],
  timeline: [],
  busy: false,
  sessions: [],
  alwaysApprove: false,
  sessionMode: "ask",
  sidebarCollapsed: false,
  inspectorOpen: false,
  inspectorWidth: 320,
  collapsedGroups: [],
  hiddenGroups: [],
  groupSort: "recent",
  sessionSort: "recent",
  account: { connection: "idle" },
  commands: [],
  settings: GROK_SETTINGS_DEFAULTS,
};

const GROUP_SORT_OPTIONS: { id: GroupSort; label: string }[] = [
  { id: "recent", label: "最近活动" },
  { id: "name-asc", label: "名称 A→Z" },
  { id: "name-desc", label: "名称 Z→A" },
  { id: "count", label: "会话数量" },
];

const SESSION_SORT_OPTIONS: { id: SessionSort; label: string }[] = [
  { id: "recent", label: "最近活动" },
  { id: "title-asc", label: "名称 A→Z" },
  { id: "title-desc", label: "名称 Z→A" },
];

function Spinner({ size = 12 }: { size?: number }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 3.2v9.6M3.75 7.45 8 3.2l4.25 4.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="4.15" y="4.15" width="7.7" height="7.7" rx="1.7" fill="currentColor" />
    </svg>
  );
}

function ExpandAllIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.2 5.2 8 10l4.8-4.8M3.2 9.2 8 14l4.8-4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseAllIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.2 6.8 8 2l4.8 4.8M3.2 10.8 8 6l4.8 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 5h8M4 8h5.5M4 11h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FoldChevron({ open = false }: { open?: boolean }) {
  return (
    <svg
      className={`chevron ${open ? "open" : ""}`}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.2 2.2 8.4 6 4.2 9.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Fold({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  return (
    <div className={`fold ${collapsed ? "collapsed" : ""}`}>
      <div className="fold-inner">{children}</div>
    </div>
  );
}

function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9.8 2.4 13.6 6.2c.3.3.3.8 0 1.1l-1.2 1.2-1.8-.3-2.4 2.4v2.2L6.6 11.2 3.2 14.6 1.4 12.8l3.4-3.4L3.2 7.8h2.2l2.4-2.4-.3-1.8 1.2-1.2c.3-.3.8-.3 1.1 0Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SlashMenu({
  commands,
  activeIndex,
  onPick,
}: {
  commands: SlashCommand[];
  activeIndex: number;
  onPick: (name: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const item = activeRef.current;
    const menu = item?.closest(".slash-menu");
    if (!item || !(menu instanceof HTMLElement)) return;
    const itemRect = item.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    if (itemRect.top < menuRect.top) menu.scrollTop -= menuRect.top - itemRect.top;
    else if (itemRect.bottom > menuRect.bottom) menu.scrollTop += itemRect.bottom - menuRect.bottom;
  }, [activeIndex, commands]);
  return (
    <div className="slash-menu" role="listbox">
      {commands.map((command, index) => (
        <button
          key={command.name}
          ref={index === activeIndex ? activeRef : undefined}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={`slash-item ${index === activeIndex ? "active" : ""}`}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(command.name);
          }}
        >
          <code>/{command.name}</code>
          <span>{command.description}</span>
          {command.hint ? <em>{command.hint}</em> : null}
        </button>
      ))}
    </div>
  );
}

function ComposerSubmit({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`send-btn ${busy ? "stop" : ""}`}
      type="button"
      title={busy ? "Stop" : "Send"}
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? <StopIcon /> : <SendIcon />}
    </button>
  );
}

function ToolCard({
  item,
  active,
  onSelect,
}: {
  item: Extract<TimelineItem, { kind: "tool" }>;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <article className="tool" onClick={onSelect} data-active={active}>
      <header>
        <h3>{item.title}</h3>
        <span className={`pill ${item.status}`}>{item.status}</span>
      </header>
    </article>
  );
}

function Stamp({ at, show = true }: { at?: number; show?: boolean }) {
  if (!show || !at) return null;
  return <time className="stamp">{formatClock(at)}</time>;
}

function isWorkItem(item: TimelineItem): boolean {
  return item.kind === "thought" || item.kind === "tool" || item.kind === "plan";
}

function isLiveItem(item: TimelineItem): boolean {
  if ("streaming" in item && item.streaming) return true;
  return item.kind === "tool" && (item.status === "pending" || item.status === "in_progress");
}

type TimelineBlock =
  | { type: "single"; item: TimelineItem }
  | { type: "ops"; id: string; items: TimelineItem[]; streaming: boolean; title: string; count: number };

function groupTimeline(items: TimelineItem[]): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];
  let work: TimelineItem[] = [];

  const flushWork = () => {
    if (!work.length) return;
    const streaming = work.some(isLiveItem);
    blocks.push({
      type: "ops",
      id: work[0].id,
      items: work,
      streaming,
      title: streaming ? "正在操作" : "思考与操作",
      count: work.length,
    });
    work = [];
  };

  for (const item of items) {
    if (isWorkItem(item)) {
      work.push(item);
      continue;
    }
    flushWork();
    blocks.push({ type: "single", item });
  }
  flushWork();
  return blocks;
}

function TimelineItemView({
  item,
  selectedId,
  onSelectTool,
  showTimestamps = true,
}: {
  item: TimelineItem;
  selectedId?: string;
  onSelectTool: (item: Extract<TimelineItem, { kind: "tool" }>) => void;
  showTimestamps?: boolean;
}) {
  if (item.kind === "user") {
    return (
      <div className="bubble user">
        <div className="kicker">
          你
          <Stamp at={item.at} show={showTimestamps} />
        </div>
        <div className="md">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {item.text}
          </Markdown>
        </div>
      </div>
    );
  }
  if (item.kind === "thought") {
    return (
      <details className="thought-block" {...(item.streaming ? { open: true } : {})}>
        <summary>
          <FoldChevron />
          <span>{item.streaming ? "正在思考" : "思考过程"}</span>
          <Stamp at={item.at} show={showTimestamps} />
        </summary>
        <div className="md thought-body">{item.text}</div>
      </details>
    );
  }
  if (item.kind === "assistant") {
    return (
      <div className="bubble assistant">
        <div className="kicker">
          Grok
          <Stamp at={item.at} show={showTimestamps} />
        </div>
        <div className="md">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {item.text}
          </Markdown>
        </div>
      </div>
    );
  }
  if (item.kind === "tool") {
    return (
      <ToolCard item={item} active={selectedId === item.id} onSelect={() => onSelectTool(item)} />
    );
  }
  if (item.kind === "plan") {
    return (
      <div className="bubble">
        <div className="kicker">
          Plan
          <Stamp at={item.at} show={showTimestamps} />
        </div>
        <pre>{item.text}</pre>
      </div>
    );
  }
  return (
    <div className="bubble">
      <div className={`kicker ${item.tone === "error" ? "thought" : ""}`}>
        {item.tone === "error" ? "错误" : "系统"}
        <Stamp at={item.at} show={showTimestamps} />
      </div>
      <div className="error-banner">{item.text}</div>
    </div>
  );
}

function StepMeta({ item, live }: { item: { at?: number; durationMs?: number; tokens?: number }; live?: boolean }) {
  const text = formatStepStats(item, live);
  if (!text) return null;
  return <span className="op-step-stats">{text}</span>;
}

function OpTree({
  block,
  selectedId,
  onSelectTool,
}: {
  block: Extract<TimelineBlock, { type: "ops" }>;
  selectedId?: string;
  onSelectTool: (item: Extract<TimelineItem, { kind: "tool" }>) => void;
}) {
  const totals = formatStepStats(aggregateStats(block.items), block.streaming);
  return (
    <details className="op-tree" {...(block.streaming ? { open: true } : {})}>
      <summary>
        <FoldChevron />
        <span className={`op-dot ${block.streaming ? "live" : ""}`} />
        <span className="op-tree-title">{block.title}</span>
        <span className="op-tree-count">
          {block.count} 步{totals ? ` · ${totals}` : ""}
        </span>
      </summary>
      <ol className="op-steps">
        {block.items.map((item) => {
          if (item.kind === "thought") {
            return (
              <li key={item.id} className="op-step thought">
                <details {...(item.streaming ? { open: true } : {})}>
                  <summary>
                    <FoldChevron />
                    <span>{item.streaming ? "正在思考" : "思考"}</span>
                    <StepMeta item={item} live={item.streaming} />
                  </summary>
                  <div className="md thought-body">{item.text}</div>
                </details>
              </li>
            );
          }
          if (item.kind === "tool") {
            const live = item.status === "pending" || item.status === "in_progress";
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`op-step tool ${selectedId === item.id ? "active" : ""}`}
                  onClick={() => onSelectTool(item)}
                >
                  <span className={`op-dot ${item.status}`} />
                  <span className="op-step-copy">{item.title}</span>
                  <StepMeta item={item} live={live} />
                  <span className={`pill ${item.status}`}>{item.status}</span>
                </button>
              </li>
            );
          }
          if (item.kind === "plan") {
            return (
              <li key={item.id} className="op-step thought">
                <details>
                  <summary>
                    <FoldChevron />
                    <span>计划</span>
                    <StepMeta item={item} />
                  </summary>
                  <div className="md thought-body">{item.text}</div>
                </details>
              </li>
            );
          }
          return (
            <li key={item.id} className="op-step note">
              <span className="op-dot" />
              <span className="op-step-copy">{item.kind === "system" ? item.text : ""}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function TimelineView({
  items,
  busy,
  selectedId,
  onSelectTool,
  showThoughts = true,
  groupTools = true,
  showTimestamps = true,
}: {
  items: TimelineItem[];
  busy?: boolean;
  selectedId?: string;
  onSelectTool: (item: Extract<TimelineItem, { kind: "tool" }>) => void;
  showThoughts?: boolean;
  groupTools?: boolean;
  showTimestamps?: boolean;
}) {
  const visible = useMemo(
    () => (showThoughts ? items : items.filter((item) => item.kind !== "thought")),
    [items, showThoughts],
  );
  const blocks = useMemo(
    () => (groupTools ? groupTimeline(visible) : visible.map((item) => ({ type: "single" as const, item }))),
    [visible, groupTools],
  );
  const waiting = Boolean(busy) && !visible.some(isLiveItem);
  return (
    <>
      {blocks.map((block) => {
        if (block.type === "ops") {
          return (
            <OpTree
              key={`${block.id}-${block.streaming ? "live" : "done"}`}
              block={block}
              selectedId={selectedId}
              onSelectTool={onSelectTool}
            />
          );
        }
        return (
          <div key={block.item.id}>
            <TimelineItemView
              item={block.item}
              selectedId={selectedId}
              onSelectTool={onSelectTool}
              showTimestamps={showTimestamps}
            />
          </div>
        );
      })}
      {waiting ? (
        <div className="turn-loading" aria-live="polite">
          <Spinner />
          <span>正在执行</span>
        </div>
      ) : null}
    </>
  );
}

function Inspector({
  item,
  collapsedEdits,
}: {
  item?: Extract<TimelineItem, { kind: "tool" }>;
  collapsedEdits?: boolean;
}) {
  if (!item) {
    return (
      <aside className="inspector pane">
        <h2>检查器</h2>
        <p className="topbar-title">点选一条工具调用查看详情。</p>
      </aside>
    );
  }
  const input = item.rawInput == null ? undefined : prettyUnknown(item.rawInput);
  const output = item.outputText ? prettyUnknown(item.outputText) : undefined;
  return (
    <aside className="inspector pane">
      <h2>{item.title}</h2>
      <div className={`pill ${item.status}`}>{item.status}</div>
      {input && (
        <div className="diff">
          <CodeView code={input.code} language={input.language ?? "json"} path="input" />
        </div>
      )}
      {output && (
        <div className="diff fill">
          <CodeView fill code={output.code} language={output.language} path="output" />
        </div>
      )}
      {item.diffs?.map((diff) => {
        const body = (
          <CodeView
            code={diff.newText ?? diff.oldText ?? ""}
            path={collapsedEdits ? undefined : diff.path}
          />
        );
        if (!collapsedEdits) {
          return (
            <div className="diff" key={diff.path}>
              {body}
            </div>
          );
        }
        const added = diff.newText?.split("\n").length ?? 0;
        const removed = diff.oldText?.split("\n").length ?? 0;
        return (
          <details className="diff" key={diff.path}>
            <summary className="path">
              <FoldChevron />
              {diff.path} +{added} / -{removed}
            </summary>
            {body}
          </details>
        );
      })}
    </aside>
  );
}

function permissionHaystack(option: PermissionRequest["options"][number]): string {
  return `${option.optionId} ${option.name} ${option.kind ?? ""}`.toLowerCase();
}

function isPreferredPermission(option: PermissionRequest["options"][number], pref: string): boolean {
  const hay = permissionHaystack(option);
  switch (pref) {
    case "always_allow_all_sessions":
      return /all.?session|always_allow_all|always allow on all/.test(hay);
    case "allow_command_always":
      return /command_always|this command|always allow this|always_allow/.test(hay) && !/all.?session/.test(hay);
    case "allow_once":
      return /allow_once|allow once|\byes\b/.test(hay) || (/allow/.test(hay) && !/always/.test(hay));
    case "reject":
      return /reject|deny|refuse|\bno\b/.test(hay);
    default:
      return false;
  }
}

function PermissionBar({
  permission,
  preferred,
  rememberApprovals,
  onChoose,
}: {
  permission: PermissionRequest;
  preferred?: string;
  rememberApprovals?: boolean;
  onChoose: (optionId: string | null) => void;
}) {
  const options =
    rememberApprovals === false
      ? permission.options.filter((option) => !/always_allow|always-allow|always allow/.test(permissionHaystack(option)))
      : permission.options;
  const shown = options.length ? options : permission.options;
  const preferredId = shown.find((option) => preferred && isPreferredPermission(option, preferred))?.optionId;
  return (
    <div className="permission">
      <h4>{permission.title}</h4>
      <div className="permission-actions">
        {shown.map((opt) => (
          <button
            key={opt.optionId}
            className={`btn ${opt.optionId === preferredId ? "primary" : ""}`}
            type="button"
            onClick={() => onChoose(opt.optionId)}
          >
            {opt.name}
          </button>
        ))}
        <button className="btn ghost" type="button" onClick={() => onChoose(null)}>
          取消
        </button>
      </div>
    </div>
  );
}

function SessionRow({
  session,
  active,
  busy,
  menuOpen,
  renaming,
  onOpen,
  onPin,
  onMenu,
  onStartRename,
  onRename,
  onCancelRename,
}: {
  session: SessionSummary;
  active: boolean;
  busy?: boolean;
  menuOpen: boolean;
  renaming: boolean;
  onOpen: () => void;
  onPin: (event: MouseEvent) => void;
  onMenu: (event: MouseEvent) => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
}) {
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipBlur = useRef(false);
  const [draftTitle, setDraftTitle] = useState(session.title || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    setDraftTitle(session.title || "");
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [renaming, session.title]);

  useEffect(() => () => clearTimeout(openTimer.current), []);

  function commitRename() {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    const next = draftTitle.trim();
    if (!next || next === (session.title || "").trim()) {
      onCancelRename();
      return;
    }
    onRename(next);
  }

  return (
    <div
      className={`session-row ${active ? "active" : ""} ${busy ? "busy" : ""} ${menuOpen ? "menu-open" : ""} ${renaming ? "renaming" : ""}`}
      aria-busy={busy || undefined}
      onContextMenu={onMenu}
    >
      {renaming ? (
        <div className="session-open">
          <input
            ref={inputRef}
            className="session-rename"
            value={draftTitle}
            maxLength={80}
            onChange={(event) => setDraftTitle(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                skipBlur.current = true;
                onCancelRename();
              }
            }}
            onBlur={commitRename}
          />
          <small>{formatAgo(session.updatedAtMs ?? session.updatedAt)}</small>
        </div>
      ) : (
        <button
          className="session-open"
          type="button"
          title={busy ? "执行中" : session.title || "未命名对话"}
          onClick={() => {
            clearTimeout(openTimer.current);
            openTimer.current = setTimeout(() => onOpen(), 280);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            clearTimeout(openTimer.current);
            onStartRename();
          }}
        >
          <span className="session-title">
            <span className="session-title-text">{session.title || "未命名对话"}</span>
            {session.interrupted ? <span className="interrupt-chip" title="更新时中断">中断</span> : null}
            {busy ? (
              <span className="session-spinner" title="执行中">
                <Spinner />
              </span>
            ) : session.unread ? (
              <span className="unread-dot" title="未读" />
            ) : null}
          </span>
          <small>{formatAgo(session.updatedAtMs ?? session.updatedAt)}</small>
        </button>
      )}
      <div className="session-actions">
        <button className={`pin ${session.pinned ? "on" : ""}`} type="button" title={session.pinned ? "取消置顶" : "置顶"} onClick={onPin}>
          <PinIcon filled={Boolean(session.pinned)} />
        </button>
        <button className="kebab" type="button" title="会话操作" onClick={onMenu}>
          ⋯
        </button>
      </div>
    </div>
  );
}

type MenuEntry =
  | { type: "sep"; id: string }
  | { type: "label"; id: string; label: string }
  | { type: "item"; id: string; label: string; danger?: boolean; disabled?: boolean; checked?: boolean; onClick: () => void };

type AppMenu =
  | { kind: "session"; id: string; x: number; y: number }
  | { kind: "group"; id: string; x: number; y: number }
  | { kind: "sort"; x: number; y: number };

type SessionGroup = {
  key: string;
  label: string;
  cwd?: string;
  sessions: SessionSummary[];
  nested?: SessionGroup[];
};

function PopupMenu({ x, y, items }: { x: number; y: number; items: MenuEntry[] }) {
  const width = 204;
  const height = items.reduce((sum, item) => sum + (item.type === "sep" ? 9 : item.type === "label" ? 22 : 28), 8);
  const left = Math.min(Math.max(8, x - 8), window.innerWidth - width - 8);
  const top = y + 6 + height > window.innerHeight ? Math.max(8, y - height - 4) : y + 6;
  return createPortal(
    <div
      className="session-menu"
      role="menu"
      style={{ top, left, width }}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item) =>
        item.type === "sep" ? (
          <div className="menu-sep" key={item.id} />
        ) : item.type === "label" ? (
          <div className="menu-label" key={item.id}>
            {item.label}
          </div>
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={[item.danger ? "danger" : "", item.checked ? "checked" : ""].filter(Boolean).join(" ") || undefined}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

function HoverCard({
  x,
  y,
  title,
  path,
  lines,
}: {
  x: number;
  y: number;
  title: string;
  path?: string;
  lines: string[];
}) {
  const width = 300;
  const left = Math.min(x, window.innerWidth - width - 12);
  const top = Math.min(y, window.innerHeight - 160);
  return createPortal(
    <div className="hover-card" style={{ top, left, width }} role="tooltip">
      <h4>{title}</h4>
      {path ? <div className="hover-path">{path}</div> : null}
      {lines.length > 0 ? <div className="hover-meta">{lines.join(" · ")}</div> : null}
    </div>,
    document.body,
  );
}

export function App() {
  const [state, setState] = useState<AppSnapshot>(empty);
  const [draft, setDraft] = useState("");
  const [selectedToolId, setSelectedToolId] = useState<string | undefined>();
  const [busyError, setBusyError] = useState<string | undefined>();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountDockRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [menu, setMenu] = useState<AppMenu | undefined>();
  const [hover, setHover] = useState<{ group: SessionGroup; x: number; y: number } | undefined>();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);
  const [draftWorkspace, setDraftWorkspace] = useState("");
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const [renamingId, setRenamingId] = useState<string | undefined>();
  const inspectorWidthRef = useRef(320);
  const resizing = useRef(false);
  const slashQuery = useMemo(() => {
    const match = draft.match(/^\/([^\s]*)$/);
    return match ? match[1].toLowerCase() : null;
  }, [draft]);
  const slashHits = useMemo(() => {
    if (slashQuery == null) return [];
    return state.commands.filter((command) => command.name.toLowerCase().includes(slashQuery)).slice(0, 14);
  }, [slashQuery, state.commands]);

  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery]);

  useEffect(() => {
    const unsub = window.grok.onEvent((event) => {
      if (event.type === "snapshot") setState(event.snapshot);
    });
    void window.grok.getState().then((snap) => {
      setState(snap);
      setDraftWorkspace(snap.workspace ?? "");
      setInspectorWidth(snap.inspectorWidth || 320);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (state.inspectorWidth) setInspectorWidth(state.inspectorWidth);
  }, [state.inspectorWidth]);

  const lastTimeline = state.timeline[state.timeline.length - 1];
  const timelineTail =
    lastTimeline && "text" in lastTimeline
      ? `${lastTimeline.id}:${lastTimeline.text.length}`
      : lastTimeline?.id;
  useEffect(() => {
    if (!state.settings.pageFlipOnSend) return;
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [state.timeline.length, timelineTail, state.busy, state.settings.pageFlipOnSend]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(undefined);
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const dock = accountDockRef.current;
      if (!dock || !(event.target instanceof Node) || dock.contains(event.target)) return;
      setAccountOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);
  inspectorWidthRef.current = inspectorWidth;

  useEffect(() => {
    const onMove = (event: globalThis.MouseEvent) => {
      if (!resizing.current) return;
      const width = Math.min(720, Math.max(240, window.innerWidth - event.clientX));
      inspectorWidthRef.current = width;
      setInspectorWidth(width);
    };
    const onUp = () => {
      if (!resizing.current) return;
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      void window.grok.setInspectorWidth(inspectorWidthRef.current);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const selectedTool = useMemo(() => {
    return state.timeline.find(
      (item): item is Extract<TimelineItem, { kind: "tool" }> =>
        item.kind === "tool" && item.id === selectedToolId,
    );
  }, [state.timeline, selectedToolId]);

  async function startIn(folder: string) {
    await beginNew(folder);
  }

  async function beginNew(workspace?: string) {
    setBusyError(undefined);
    try {
      const snap = await window.grok.beginNewChat(workspace);
      setState(snap);
      setDraftWorkspace(workspace || snap.workspace || "");
    } catch (err) {
      setBusyError(err instanceof Error ? err.message : String(err));
    }
  }

  async function pickAndStart() {
    const folder = await window.grok.pickFolder();
    if (!folder) return;
    await beginNew(folder);
  }

  async function pickWorkspace() {
    const folder = await window.grok.pickFolder();
    if (!folder) return;
    const snap = await window.grok.setWorkspace(folder);
    setState(snap);
    setDraftWorkspace(snap.workspace ?? folder);
  }

  async function clearWorkspace(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const snap = await window.grok.setWorkspace("");
    setState(snap);
    setDraftWorkspace(snap.workspace ?? "");
  }

  async function openSession(session: SessionSummary) {
    setBusyError(undefined);
    try {
      setState(await window.grok.openSession(session.sessionId, session.cwd));
    } catch (err) {
      setBusyError(err instanceof Error ? err.message : String(err));
    }
  }

  async function renameSession(session: SessionSummary, title: string) {
    setRenamingId(undefined);
    setBusyError(undefined);
    try {
      setState(await window.grok.renameSession(session.sessionId, title));
    } catch (err) {
      setBusyError(err instanceof Error ? err.message : String(err));
    }
  }

  async function pinSession(event: MouseEvent, session: SessionSummary) {
    event.preventDefault();
    event.stopPropagation();
    setState(await window.grok.pinSession(session.sessionId, !session.pinned));
  }

  function placeMenu(event: MouseEvent, next: { kind: "session" | "group"; id: string }) {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(hoverTimer.current);
    setHover(undefined);
    const fromButton = event.type === "click";
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = fromButton ? rect.right : event.clientX;
    const y = fromButton ? rect.bottom : event.clientY;
    setMenu((current) =>
      fromButton && current?.kind === next.kind && current.id === next.id ? undefined : { ...next, x, y },
    );
  }

  function showGroupHover(event: MouseEvent<HTMLElement>, group: SessionGroup) {
    if (menu) return;
    const el = event.currentTarget;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setHover({ group, x: rect.right + 10, y: rect.top });
    }, 380);
  }

  function hideGroupHover() {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(undefined), 80);
  }

  async function archiveSession(session: SessionSummary) {
    setMenu(undefined);
    setState(await window.grok.archiveSession(session.sessionId, !session.archived));
  }

  async function deleteSession(session: SessionSummary) {
    setMenu(undefined);
    setBusyError(undefined);
    try {
      setState(await window.grok.deleteSession(session.sessionId));
    } catch (err) {
      setBusyError(err instanceof Error ? err.message : String(err));
    }
  }

  async function copyText(text: string) {
    setMenu(undefined);
    await window.grok.copyText(text);
  }

  async function openFolder(folder?: string) {
    setMenu(undefined);
    if (!folder) return;
    const result = await window.grok.openPath(folder);
    if (!result.ok) setBusyError(result.error || "无法打开工作目录");
  }

  async function send() {
    const text = draft.trim();
    if (!text || state.busy) return;
    setDraft("");
    setBusyError(undefined);
    try {
      if (!state.sessionId) {
        let workspace = draftWorkspace.trim();
        if (!workspace) {
          const folder = await window.grok.pickFolder();
          if (!folder) {
            setDraft(text);
            return;
          }
          workspace = folder;
          setDraftWorkspace(folder);
        }
        await window.grok.start(workspace, {
          workspace,
          mode: state.sessionMode,
          modelId: state.modelId || undefined,
          effort: state.effort || undefined,
        });
      }
      setState(await window.grok.send(text));
    } catch (err) {
      setDraft(text);
      setBusyError(err instanceof Error ? err.message : String(err));
    }
  }

  function completeSlash(name: string) {
    const command = state.commands.find((item) => item.name === name);
    setDraft(command?.hint ? `/${name} ` : `/${name}`);
  }

  async function onComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashHits.length > 0 && slashQuery != null) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((index) => (index + 1) % slashHits.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex((index) => (index - 1 + slashHits.length) % slashHits.length);
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        completeSlash(slashHits[slashIndex]?.name ?? slashHits[0].name);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDraft("");
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const hit = slashHits[slashIndex] ?? slashHits[0];
        const typed = draft.slice(1);
        if (typed === hit.name || typed.startsWith(`${hit.name} `)) {
          if (state.busy) {
            await window.grok.cancel();
            return;
          }
          await send();
          return;
        }
        completeSlash(hit.name);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (state.busy) {
        await window.grok.cancel();
        return;
      }
      await send();
    }
  }

  const account = state.account;
  const initial = (account.email ?? "G").slice(0, 1).toUpperCase();
  const quota = account.quota;
  const used = quota?.usedPercent ?? (quota?.remainingPercent != null ? 100 - quota.remainingPercent : undefined);
  const liveSessions = useMemo(
    () => state.sessions.filter((session) => !session.archived),
    [state.sessions],
  );
  const archivedSessions = useMemo(
    () => sortSessions(
      state.sessions.filter((session) => session.archived),
      state.sessionSort,
    ),
    [state.sessions, state.sessionSort],
  );
  const allLiveGroups = useMemo(
    () => buildGroups(liveSessions, state.groupSort, state.sessionSort),
    [liveSessions, state.groupSort, state.sessionSort],
  );
  const hiddenKeySet = useMemo(() => new Set(state.hiddenGroups), [state.hiddenGroups]);
  const liveGroups = useMemo(
    () => allLiveGroups.filter((group) => group.key === "__pinned__" || !hiddenKeySet.has(group.key)),
    [allLiveGroups, hiddenKeySet],
  );
  const hiddenWorkspaceGroups = useMemo(
    () => allLiveGroups.filter((group) => hiddenKeySet.has(group.key)),
    [allLiveGroups, hiddenKeySet],
  );
  const archivedGroup: SessionGroup = {
    key: "__archived__",
    label: "已归档",
    sessions: archivedSessions,
  };
  const menuSession =
    menu?.kind === "session" ? state.sessions.find((session) => session.sessionId === menu.id) : undefined;
  const menuGroup =
    menu?.kind === "group"
      ? menu.id === "__archived__"
        ? archivedGroup
        : allLiveGroups.find((group) => group.key === menu.id) ??
          allLiveGroups.flatMap((group) => group.nested ?? []).find((group) => group.key === menu.id)
      : undefined;
  const currentSession = state.sessions.find((session) => session.sessionId === state.sessionId);
  const archivedCollapsed = state.collapsedGroups.includes("__archived__");
  const hiddenCollapsed = state.collapsedGroups.includes("__hidden__");
  const sessionMenuItems: MenuEntry[] = menuSession
    ? [
        {
          type: "item",
          id: "rename",
          label: "重命名",
          onClick: () => {
            setMenu(undefined);
            setRenamingId(menuSession.sessionId);
          },
        },
        {
          type: "item",
          id: "copy-id",
          label: "复制会话 ID",
          onClick: () => void copyText(menuSession.sessionId),
        },
        {
          type: "item",
          id: "copy-session",
          label: "复制会话",
          onClick: () => void copyText(formatSessionCopy(menuSession)),
        },
        {
          type: "item",
          id: "open-cwd",
          label: "打开工作目录",
          disabled: !menuSession.cwd,
          onClick: () => void openFolder(menuSession.cwd),
        },
        { type: "sep", id: "sep-1" },
        {
          type: "item",
          id: "pin",
          label: menuSession.pinned ? "取消置顶" : "置顶",
          onClick: () => {
            setMenu(undefined);
            void window.grok.pinSession(menuSession.sessionId, !menuSession.pinned).then(setState);
          },
        },
        {
          type: "item",
          id: "archive",
          label: menuSession.archived ? "取消归档" : "归档",
          onClick: () => void archiveSession(menuSession),
        },
        { type: "sep", id: "sep-2" },
        {
          type: "item",
          id: "delete",
          label: "删除",
          danger: true,
          onClick: () => void deleteSession(menuSession),
        },
      ]
    : [];
  const groupMenuItems: MenuEntry[] = menuGroup
    ? [
        ...(menuGroup.cwd
          ? [
              {
                type: "item" as const,
                id: "new",
                label: "在此新建会话",
                onClick: () => {
                  setMenu(undefined);
                  void startIn(menuGroup.cwd!);
                },
              },
              {
                type: "item" as const,
                id: "open-cwd",
                label: "打开工作目录",
                onClick: () => void openFolder(menuGroup.cwd),
              },
              {
                type: "item" as const,
                id: "copy-path",
                label: "复制路径",
                onClick: () => void copyText(menuGroup.cwd!),
              },
              { type: "sep" as const, id: "sep-1" },
            ]
          : []),
        {
          type: "item",
          id: "toggle",
          label: state.collapsedGroups.includes(menuGroup.key) ? "展开" : "折叠",
          onClick: () => {
            setMenu(undefined);
            void window.grok.toggleGroup(menuGroup.key).then(setState);
          },
        },
        ...(menuGroup.cwd
          ? [
              {
                type: "item" as const,
                id: "hide",
                label: hiddenKeySet.has(menuGroup.key) ? "取消隐藏" : "隐藏工作区",
                onClick: () => {
                  setMenu(undefined);
                  void (
                    hiddenKeySet.has(menuGroup.key)
                      ? window.grok.revealWorkspace(menuGroup.key)
                      : window.grok.hideWorkspace(menuGroup.key)
                  ).then(setState);
                },
              },
              { type: "sep" as const, id: "sep-hide" },
              {
                type: "item" as const,
                id: "delete-workspace",
                label: "删除工作区",
                danger: true,
                onClick: () => {
                  setMenu(undefined);
                  void window.grok.deleteWorkspace(menuGroup.key).then(setState);
                },
              },
            ]
          : []),
      ]
    : [];
  const sortMenuItems: MenuEntry[] = [
    { type: "label", id: "group-sort", label: "分组" },
    ...GROUP_SORT_OPTIONS.map((option) => ({
      type: "item" as const,
      id: `group-${option.id}`,
      label: option.label,
      checked: state.groupSort === option.id,
      onClick: () => {
        setMenu(undefined);
        void window.grok.setSidebarSort(option.id, state.sessionSort).then(setState);
      },
    })),
    { type: "sep", id: "sort-sep" },
    { type: "label", id: "session-sort", label: "会话" },
    ...SESSION_SORT_OPTIONS.map((option) => ({
      type: "item" as const,
      id: `session-${option.id}`,
      label: option.label,
      checked: state.sessionSort === option.id,
      onClick: () => {
        setMenu(undefined);
        void window.grok.setSidebarSort(state.groupSort, option.id).then(setState);
      },
    })),
  ];

  const appClass = [
    "app",
    state.sidebarCollapsed ? "sidebar-collapsed" : "",
    state.inspectorOpen ? "inspector-open" : "",
    state.settings.compactMode ? "compact" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const home = !state.sessionId;

  return (
    <div className={appClass} style={{ ["--inspector" as string]: `${inspectorWidth}px` }}>
      {state.sidebarCollapsed ? (
        <aside className="rail pane">
          <button className="icon-btn" type="button" title="展开侧栏" onClick={() => void window.grok.setSidebarCollapsed(false)}>
            ›
          </button>
          <button className="icon-btn" type="button" title="添加对话" onClick={() => void beginNew()}>
            +
          </button>
          <div className="rail-foot">
            <button
              className="icon-btn"
              type="button"
              title="设置"
              onClick={() => setSettingsOpen(true)}
            >
              ⚙
            </button>
            {state.update?.updateAvailable ? (
              <button
                className="update-proto rail-update"
                type="button"
                title={`更新到 ${state.update.latestVersion}`}
                onClick={() => {
                  setChangelogOpen(true);
                  void window.grok.checkUpdate().then(setState);
                }}
              >
                更新
              </button>
            ) : null}
          </div>
        </aside>
      ) : (
        <aside className="sidebar pane">
          <div className="sidebar-head">
            <span className="brand-mark">Grok-Harness</span>
            <button className="icon-btn" type="button" title="收起侧栏" onClick={() => void window.grok.setSidebarCollapsed(true)}>
              ‹
            </button>
          </div>
          <div className="workspace-actions">
            <button className="linkish" type="button" onClick={() => void pickAndStart()}>
              + 添加工作区
            </button>
            <button className="linkish" type="button" onClick={() => void beginNew()}>
              + 添加对话
            </button>
            {(liveGroups.length > 0 || archivedSessions.length > 0) && (
              <div className="group-bulk">
                <button
                  className="icon-btn"
                  type="button"
                  title="Expand all"
                  onClick={() => void window.grok.setCollapsedGroups([]).then(setState)}
                >
                  <ExpandAllIcon />
                </button>
                <button
                  className="icon-btn"
                  type="button"
                  title="Collapse all"
                  onClick={() => {
                    const keys = [
                      ...liveGroups.flatMap((group) => [group.key, ...(group.nested?.map((child) => child.key) ?? [])]),
                      ...(hiddenWorkspaceGroups.length ? ["__hidden__"] : []),
                      ...(archivedSessions.length ? ["__archived__"] : []),
                    ];
                    void window.grok.setCollapsedGroups(keys).then(setState);
                  }}
                >
                  <CollapseAllIcon />
                </button>
                <button
                  className={`icon-btn ${menu?.kind === "sort" ? "on" : ""}`}
                  type="button"
                  title="排序方式"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    clearTimeout(hoverTimer.current);
                    setHover(undefined);
                    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                    setMenu((current) =>
                      current?.kind === "sort"
                        ? undefined
                        : { kind: "sort", x: rect.right, y: rect.bottom },
                    );
                  }}
                >
                  <SortIcon />
                </button>
              </div>
            )}
          </div>
          <div className="session-list">
            {liveSessions.length === 0 && archivedSessions.length === 0 && (
              <div className="session-empty">本机还没有会话</div>
            )}
            {liveGroups.map((group) => {
              const isCollapsed = state.collapsedGroups.includes(group.key);
              const nested = group.nested ?? [];
              return (
                <section className={`session-group ${group.key === "__pinned__" ? "pinned" : ""}`} key={group.key}>
                  <header
                    className={`session-group-head ${menu?.kind === "group" && menu.id === group.key ? "menu-open" : ""}`}
                    onMouseEnter={(event) => showGroupHover(event, group)}
                    onMouseLeave={hideGroupHover}
                    onContextMenu={(event) => placeMenu(event, { kind: "group", id: group.key })}
                  >
                    <button
                      className="session-group-toggle"
                      type="button"
                      onClick={() => void window.grok.toggleGroup(group.key).then(setState)}
                    >
                      <FoldChevron open={!isCollapsed} />
                      <span className="session-group-copy">
                        <strong>{group.label}</strong>
                      </span>
                      <span className="session-count">{group.sessions.length}</span>
                    </button>
                    {group.cwd && (
                      <button className="btn tiny" type="button" title="在此目录新建会话" onClick={() => void startIn(group.cwd!)}>
                        +
                      </button>
                    )}
                    {group.cwd ? (
                      <button
                        className="kebab"
                        type="button"
                        title="工作区操作"
                        onClick={(event) => placeMenu(event, { kind: "group", id: group.key })}
                      >
                        ⋯
                      </button>
                    ) : null}
                  </header>
                  <Fold collapsed={isCollapsed}>
                    {nested.length > 0
                      ? nested.map((child) => {
                          const childCollapsed = state.collapsedGroups.includes(child.key);
                          return (
                            <div className="session-subgroup" key={child.key}>
                              <header
                                className="session-group-head"
                                onMouseEnter={(event) => showGroupHover(event, child)}
                                onMouseLeave={hideGroupHover}
                                onContextMenu={(event) => placeMenu(event, { kind: "group", id: child.key })}
                              >
                                <button
                                  className="session-group-toggle"
                                  type="button"
                                  onClick={() => void window.grok.toggleGroup(child.key).then(setState)}
                                >
                                  <FoldChevron open={!childCollapsed} />
                                  <span className="session-group-copy">
                                    <strong>{child.label}</strong>
                                  </span>
                                  <span className="session-count">{child.sessions.length}</span>
                                </button>
                                {child.cwd && (
                                  <button
                                    className="btn tiny"
                                    type="button"
                                    title="在此目录新建会话"
                                    onClick={() => void startIn(child.cwd!)}
                                  >
                                    +
                                  </button>
                                )}
                              </header>
                              <Fold collapsed={childCollapsed}>
                                {child.sessions.map((session) => (
                                  <SessionRow
                                    key={session.sessionId}
                                    session={session}
                                    active={session.sessionId === state.sessionId}
                                    busy={state.busy && session.sessionId === state.sessionId}
                                    menuOpen={menu?.kind === "session" && menu.id === session.sessionId}
                                    renaming={renamingId === session.sessionId}
                                    onOpen={() => void openSession(session)}
                                    onPin={(event) => void pinSession(event, session)}
                                    onMenu={(event) => placeMenu(event, { kind: "session", id: session.sessionId })}
                                    onStartRename={() => setRenamingId(session.sessionId)}
                                    onRename={(title) => void renameSession(session, title)}
                                    onCancelRename={() => setRenamingId(undefined)}
                                  />
                                ))}
                              </Fold>
                            </div>
                          );
                        })
                      : group.sessions.map((session) => (
                          <SessionRow
                            key={session.sessionId}
                            session={session}
                            active={session.sessionId === state.sessionId}
                            busy={state.busy && session.sessionId === state.sessionId}
                            menuOpen={menu?.kind === "session" && menu.id === session.sessionId}
                            renaming={renamingId === session.sessionId}
                            onOpen={() => void openSession(session)}
                            onPin={(event) => void pinSession(event, session)}
                            onMenu={(event) => placeMenu(event, { kind: "session", id: session.sessionId })}
                            onStartRename={() => setRenamingId(session.sessionId)}
                            onRename={(title) => void renameSession(session, title)}
                            onCancelRename={() => setRenamingId(undefined)}
                          />
                        ))}
                  </Fold>
                </section>
              );
            })}
            {hiddenWorkspaceGroups.length > 0 && (
              <section className="session-group hidden-workspaces">
                <header className="session-group-head">
                  <button
                    className="session-group-toggle"
                    type="button"
                    onClick={() => void window.grok.toggleGroup("__hidden__").then(setState)}
                  >
                    <FoldChevron open={!hiddenCollapsed} />
                    <span className="session-group-copy">
                      <strong>已隐藏</strong>
                    </span>
                    <span className="session-count">{hiddenWorkspaceGroups.length}</span>
                  </button>
                </header>
                <Fold collapsed={hiddenCollapsed}>
                  {hiddenWorkspaceGroups.map((group) => (
                    <div
                      className={`session-group-head hidden-row ${menu?.kind === "group" && menu.id === group.key ? "menu-open" : ""}`}
                      key={group.key}
                    >
                      <button
                        className="session-group-toggle"
                        type="button"
                        title={group.cwd}
                        onClick={() => void window.grok.revealWorkspace(group.key).then(setState)}
                      >
                        <span className="session-group-copy">
                          <strong>{group.label}</strong>
                        </span>
                        <span className="session-count">{group.sessions.length}</span>
                      </button>
                      <button
                        className="kebab"
                        type="button"
                        title="工作区操作"
                        onClick={(event) => placeMenu(event, { kind: "group", id: group.key })}
                      >
                        ⋯
                      </button>
                    </div>
                  ))}
                </Fold>
              </section>
            )}
            {archivedSessions.length > 0 && (
              <section className="session-group archived">
                <header
                  className="session-group-head"
                  onMouseEnter={(event) => showGroupHover(event, archivedGroup)}
                  onMouseLeave={hideGroupHover}
                  onContextMenu={(event) => placeMenu(event, { kind: "group", id: "__archived__" })}
                >
                  <button
                    className="session-group-toggle"
                    type="button"
                    onClick={() => void window.grok.toggleGroup("__archived__").then(setState)}
                  >
                    <FoldChevron open={!archivedCollapsed} />
                    <span className="session-group-copy">
                      <strong>已归档</strong>
                    </span>
                    <span className="session-count">{archivedSessions.length}</span>
                  </button>
                </header>
                <Fold collapsed={archivedCollapsed}>
                  {archivedSessions.map((session) => (
                    <SessionRow
                      key={session.sessionId}
                      session={session}
                      active={session.sessionId === state.sessionId}
                      busy={state.busy && session.sessionId === state.sessionId}
                      menuOpen={menu?.kind === "session" && menu.id === session.sessionId}
                      renaming={renamingId === session.sessionId}
                      onOpen={() => void openSession(session)}
                      onPin={(event) => void pinSession(event, session)}
                      onMenu={(event) => placeMenu(event, { kind: "session", id: session.sessionId })}
                      onStartRename={() => setRenamingId(session.sessionId)}
                      onRename={(title) => void renameSession(session, title)}
                      onCancelRename={() => setRenamingId(undefined)}
                    />
                  ))}
                </Fold>
              </section>
            )}
          </div>
          <div className="user-dock" ref={accountDockRef}>
            {accountOpen && (
              <div
                className="user-pop"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <h3>{account.email ?? "未登录"}</h3>
                <dl>
                  <dt>状态</dt>
                  <dd>{statusLabel(state.connection)}</dd>
                  <dt>套餐</dt>
                  <dd>{account.plan ?? quota?.plan ?? "—"}</dd>
                  <dt>模型</dt>
                  <dd>{account.modelName ?? state.modelName ?? "—"}</dd>
                  <dt>版本</dt>
                  <dd>{account.agentVersion ?? state.agentVersion ?? "—"}</dd>
                </dl>
                <div className="quota">
                  <div className="user-copy">
                    <span>额度使用</span>
                  </div>
                  {used != null ? (
                    <>
                      <div className="quota-bar">
                        <i style={{ width: `${Math.min(100, Math.max(0, used))}%` }} />
                      </div>
                      <small>
                        已用 {Math.round(used)}%
                        {quota?.period ? ` · ${quota.period}` : ""}
                        {quota?.resetAt ? ` · 重置 ${new Date(quota.resetAt).toLocaleString()}` : ""}
                        {quota?.extraCredits ? ` · 额外 ${quota.extraCredits}` : ""}
                      </small>
                    </>
                  ) : (
                    <small>正在从 /usage 同步额度，每 5 分钟更新一次。</small>
                  )}
                </div>
                <button
                  className="linkish"
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    setChangelogOpen(true);
                    void window.grok.checkUpdate().then(setState);
                  }}
                >
                  更新日志
                </button>
                <button
                  className="linkish"
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  打开设置
                </button>
              </div>
            )}
            <div className="user-dock-bar">
              <button
                className="user-chip"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setAccountOpen((open) => !open);
                  if (!accountOpen) void window.grok.refreshAccount().then(setState);
                }}
              >
                <span className="avatar">{initial}</span>
                <span className="user-copy">
                  <strong>{account.email ?? "Grok 账号"}</strong>
                  <span>
                    <i className={`status-dot ${state.connection}`} />
                    {statusLabel(state.connection)}
                    {account.plan ? ` · ${account.plan}` : ""}
                  </span>
                </span>
              </button>
              <button
                className="icon-btn"
                type="button"
                title="设置"
                onClick={(event) => {
                  event.stopPropagation();
                  setAccountOpen(false);
                  setSettingsOpen(true);
                }}
              >
                ⚙
              </button>
              {state.update?.updateAvailable ? (
                <button
                  className="update-proto"
                  type="button"
                  title={`Grok Build ${state.update.currentVersion} → ${state.update.latestVersion}`}
                  onClick={() => {
                    setChangelogOpen(true);
                    void window.grok.checkUpdate().then(setState);
                  }}
                >
                  更新
                </button>
              ) : null}
            </div>
          </div>
        </aside>
      )}

      <section className="center pane">
        <div className="topbar">
          <div className="topbar-title" title={state.sessionTitle || undefined}>
            <strong>{home ? "新对话" : state.sessionTitle || "未选择对话"}</strong>
            {state.busy && !home ? (
              <span className="topbar-spinner" title="执行中">
                <Spinner />
              </span>
            ) : null}
            {(home ? draftWorkspace : state.workspace) ? (
              <span className="topbar-cwd">{folderLabel((home ? draftWorkspace : state.workspace) ?? "")}</span>
            ) : null}
          </div>
          <div className="topbar-actions">
            {state.busy && (
              <ComposerSubmit busy disabled={false} onClick={() => void window.grok.cancel()} />
            )}
            {currentSession && (
              <button
                className="icon-btn"
                type="button"
                title="会话操作"
                onClick={(event) => placeMenu(event, { kind: "session", id: currentSession.sessionId })}
              >
                ⋯
              </button>
            )}
            <button
              className="icon-btn"
              type="button"
              title={state.inspectorOpen ? "收起右侧" : "打开检查器"}
              onClick={() => void window.grok.setInspectorOpen(!state.inspectorOpen)}
            >
              {state.inspectorOpen ? "›|" : "|‹"}
            </button>
          </div>
        </div>
        {home ? (
          <div className="home">
            <h1>新对话</h1>
            <p>指定工作区、模型和思考长度，然后直接开聊。</p>
            <div className="composer home-composer">
              {slashHits.length > 0 && (
                <SlashMenu commands={slashHits} activeIndex={slashIndex} onPick={completeSlash} />
              )}
              <textarea
                value={draft}
                placeholder="今天要做什么？"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => void onComposerKey(e)}
                rows={4}
              />
              <div className="composer-toolbar">
                <div className={`chip workspace-chip ${draftWorkspace ? "has-value" : ""}`}>
                  <button
                    className="chip-main"
                    type="button"
                    title={draftWorkspace || "选择工作区"}
                    onClick={() => void pickWorkspace()}
                  >
                    {draftWorkspace ? folderLabel(draftWorkspace) : "工作区"}
                  </button>
                  {draftWorkspace ? (
                    <button className="chip-clear" type="button" title="移除工作区" onClick={(event) => void clearWorkspace(event)}>
                      ×
                    </button>
                  ) : null}
                </div>
                <ModelEffortPicker
                  models={state.models}
                  modelId={state.modelId}
                  effort={state.effort}
                  disabled={state.busy}
                  onChange={(modelId, effort) => void window.grok.setModelEffort(modelId, effort).then(setState)}
                />
                <ComposerSubmit
                  busy={state.busy}
                  disabled={!draft.trim() && !state.busy}
                  onClick={() => void (state.busy ? window.grok.cancel() : send())}
                />
              </div>
            </div>
            {(state.error || busyError) && <div className="error-banner">{busyError ?? state.error}</div>}
          </div>
        ) : (
          <>
            <div
              className="transcript"
              ref={scroller}
              onWheel={
                state.settings.invertScroll
                  ? (event) => {
                      event.currentTarget.scrollTop -= event.deltaY;
                      event.preventDefault();
                    }
                  : undefined
              }
            >
              <div className="thread">
                {currentSession?.interrupted ? (
                  <div className="interrupt-banner">
                    <span>这次对话在 Grok Build 更新时被中断。</span>
                    <button
                      className="btn ghost tiny"
                      type="button"
                      onClick={() => void window.grok.dismissInterrupted(currentSession.sessionId).then(setState)}
                    >
                      知道了
                    </button>
                  </div>
                ) : null}
                <TimelineView
                  items={state.timeline}
                  busy={state.busy}
                  selectedId={selectedToolId}
                  showThoughts={state.settings.showThinkingBlocks}
                  groupTools={state.settings.groupToolVerbs}
                  showTimestamps={state.settings.showTimestamps}
                  onSelectTool={(item) => {
                    setSelectedToolId(item.id);
                    if (!state.inspectorOpen) void window.grok.setInspectorOpen(true);
                  }}
                />
                {(state.error || busyError) && (
                  <div className="bubble">
                    <div className="kicker thought">错误</div>
                    <div className="error-banner">{busyError ?? state.error}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="composer-wrap">
              {state.permission && (
                <PermissionBar
                  permission={state.permission}
                  preferred={state.settings.defaultSelectedPermission}
                  rememberApprovals={state.settings.rememberToolApprovals}
                  onChoose={(optionId) => void window.grok.permission(state.permission!.requestId, optionId)}
                />
              )}
              <div className="composer">
                {slashHits.length > 0 && (
                  <SlashMenu commands={slashHits} activeIndex={slashIndex} onPick={completeSlash} />
                )}
                <textarea
                  value={draft}
                  placeholder="给 grok 下指令。打 / 可列出命令。Enter 发送，Shift+Enter 换行。"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => void onComposerKey(e)}
                  rows={3}
                />
                <div className="composer-toolbar">
                  <ModelEffortPicker
                    models={state.models}
                    modelId={state.modelId}
                    effort={state.effort}
                    disabled={state.busy}
                    onChange={(modelId, effort) => void window.grok.setModelEffort(modelId, effort).then(setState)}
                  />
                  <ComposerSubmit
                    busy={state.busy}
                    disabled={!draft.trim() && !state.busy}
                    onClick={() => void (state.busy ? window.grok.cancel() : send())}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {state.inspectorOpen && (
        <div className="inspector-slot">
          <div
            className="resize-handle"
            onMouseDown={(event) => {
              event.preventDefault();
              resizing.current = true;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
          />
          <Inspector item={selectedTool} collapsedEdits={state.settings.collapsedEditBlocks} />
        </div>
      )}

      {menu && menu.kind === "session" && menuSession && (
        <PopupMenu x={menu.x} y={menu.y} items={sessionMenuItems} />
      )}
      {menu && menu.kind === "group" && menuGroup && (
        <PopupMenu x={menu.x} y={menu.y} items={groupMenuItems} />
      )}
      {menu && menu.kind === "sort" && <PopupMenu x={menu.x} y={menu.y} items={sortMenuItems} />}
      {!menu && hover && (
        <HoverCard
          x={hover.x}
          y={hover.y}
          title={hover.group.label}
          path={hover.group.cwd}
          lines={groupHoverLines(hover.group)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={state.settings}
          models={state.models}
          onClose={() => setSettingsOpen(false)}
          onChange={(key, value) => void window.grok.setGrokSetting(key, value).then(setState)}
        />
      )}
      {changelogOpen && (
        <UpdatePanel
          update={state.update}
          onClose={() => setChangelogOpen(false)}
          onApply={() => {
            void window.grok.applyUpdate().then((snap) => {
              setState(snap);
              if (!snap.update?.updateAvailable && !snap.update?.error) setChangelogOpen(false);
            });
          }}
        />
      )}
    </div>
  );
}

function statusLabel(state: AppSnapshot["connection"]): string {
  switch (state) {
    case "ready":
      return "已连接";
    case "starting":
      return "启动中";
    case "error":
      return "出错";
    case "stopped":
      return "未连接";
    default:
      return "未连接";
  }
}

function sessionTitle(session: SessionSummary): string {
  return session.title?.trim() || "未命名对话";
}

function sortSessions(sessions: SessionSummary[], sort: SessionSort, pinFirst = false): SessionSummary[] {
  return [...sessions].sort((a, b) => {
    if (pinFirst && sort === "recent") {
      const pinDelta = (b.pinOrder ?? 0) - (a.pinOrder ?? 0);
      if (pinDelta) return pinDelta;
    }
    if (sort === "title-asc") return sessionTitle(a).localeCompare(sessionTitle(b), "zh-CN", { numeric: true });
    if (sort === "title-desc") return sessionTitle(b).localeCompare(sessionTitle(a), "zh-CN", { numeric: true });
    return (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0);
  });
}

function groupLatest(group: SessionGroup): number {
  return Math.max(0, ...group.sessions.map((session) => session.updatedAtMs ?? 0));
}

function sortGroups(groups: SessionGroup[], sort: GroupSort): SessionGroup[] {
  return [...groups].sort((a, b) => {
    if (sort === "name-asc") return a.label.localeCompare(b.label, "zh-CN", { numeric: true });
    if (sort === "name-desc") return b.label.localeCompare(a.label, "zh-CN", { numeric: true });
    if (sort === "count") {
      const countDelta = b.sessions.length - a.sessions.length;
      if (countDelta) return countDelta;
      return a.label.localeCompare(b.label, "zh-CN", { numeric: true });
    }
    return groupLatest(b) - groupLatest(a);
  });
}

function groupsByCwd(
  sessions: SessionSummary[],
  sort: SessionSort,
  groupSort: GroupSort,
  keyPrefix = "",
  pinFirst = false,
): SessionGroup[] {
  const map = new Map<string, SessionSummary[]>();
  for (const session of sessions) {
    const cwd = session.cwd?.trim() || "(unknown)";
    const key = keyPrefix ? `${keyPrefix}${normalizeGroupKey(cwd)}` : normalizeGroupKey(cwd);
    const list = map.get(key) ?? [];
    list.push(session);
    map.set(key, list);
  }
  const rest = [...map.entries()].map(([key, rows]) => ({
    key,
    label: folderLabel(rows[0]?.cwd?.trim() || key),
    cwd: key === "(unknown)" || key.startsWith("__") ? undefined : rows[0]?.cwd?.trim() || key,
    sessions: sortSessions(rows, sort, pinFirst),
  }));
  return sortGroups(rest, groupSort);
}

function buildGroups(sessions: SessionSummary[], groupSort: GroupSort, sessionSort: SessionSort): SessionGroup[] {
  const pinned = sessions.filter((session) => session.pinned);
  const unpinned = sessions.filter((session) => !session.pinned);
  const groups: SessionGroup[] = [];
  if (pinned.length) {
    groups.push({
      key: "__pinned__",
      label: "置顶",
      sessions: sortSessions(pinned, sessionSort, true),
    });
  }
  return [...groups, ...groupsByCwd(unpinned, sessionSort, groupSort)];
}

function folderLabel(cwd: string): string {
  if (cwd === "(unknown)") return "未知目录";
  const parts = cwd.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

function formatSessionCopy(session: SessionSummary): string {
  const lines = [session.title || "未命名对话", `会话 ID: ${session.sessionId}`];
  if (session.cwd) lines.push(`工作目录: ${session.cwd}`);
  const ms = session.updatedAtMs ?? (session.updatedAt ? Date.parse(session.updatedAt) : Number.NaN);
  if (Number.isFinite(ms)) lines.push(`更新时间: ${new Date(ms).toLocaleString()}`);
  return lines.join("\n");
}

function groupHoverLines(group: SessionGroup): string[] {
  const count =
    group.key === "__pinned__" || group.key.startsWith("__pinned__:")
      ? `${group.sessions.length} 个置顶会话`
      : group.key === "__archived__"
        ? `${group.sessions.length} 个已归档会话`
        : `${group.sessions.length} 个会话`;
  const latest = Math.max(0, ...group.sessions.map((session) => session.updatedAtMs ?? 0));
  return latest ? [count, `最近 ${formatAgo(latest)}`] : [count];
}

function formatAgo(value?: string | number): string {
  if (value == null || value === "") return "";
  const ms = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  const delta = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "刚刚";
  if (delta < hour) return `${Math.floor(delta / minute)} 分钟前`;
  if (delta < day) return `${Math.floor(delta / hour)} 小时前`;
  if (delta < 7 * day) return `${Math.floor(delta / day)} 天前`;
  return new Date(ms).toLocaleDateString();
}

function formatClock(at: number): string {
  const date = new Date(at);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
