export type PermissionMode = "ask" | "auto" | "always-approve";

export type GrokSettings = {
  autoUpdate: boolean;
  cliChannel: string;
  showTips: boolean;
  defaultModel: string;
  defaultEffort: string;
  webSearchModel: string;
  sessionSummaryModel: string;
  imageDescriptionModel: string;
  permissionMode: PermissionMode;
  rememberToolApprovals: boolean;
  defaultSelectedPermission: string;
  showThinkingBlocks: boolean;
  groupToolVerbs: boolean;
  collapsedEditBlocks: boolean;
  pageFlipOnSend: boolean;
  followUpBehavior: "queue" | "steer";
  compactMode: boolean;
  showTimestamps: boolean;
  showTimeline: boolean;
  combineQueuedPrompts: boolean;
  forkSecondaryModel: string;
  maxThoughtsWidth: number;
  promptSuggestions: boolean;
  theme: string;
  autoDarkTheme: string;
  autoLightTheme: string;
  simpleMode: boolean;
  vimMode: boolean;
  screenMode: string;
  renderMermaid: string;
  scrollSpeed: number;
  scrollMode: string;
  scrollLines: number | null;
  invertScroll: boolean;
  cancelSubagentsOnTurnCancel: string;
  hunkTrackerMode: string;
  voiceKeybindEnabled: boolean;
  voiceCaptureMode: string;
  telemetry: boolean;
  feedback: boolean;
  lspTools: boolean;
  codebaseIndexing: boolean;
  twoPassCompaction: boolean;
  remoteFetch: boolean;
  webFetch: boolean;
  writeFile: boolean;
  toolSearch: boolean;
  memoryEnabled: boolean;
  subagentsEnabled: boolean;
  workflowsEnabled: boolean;
  traceUpload: boolean;
  disableCodebaseUpload: boolean;
  autoCompactPercent: number;
  loadEnvrc: boolean;
  respectGitignore: boolean;
  bashTimeoutSecs: number;
  bashOutputByteLimit: number;
  bashMaxTimeoutSecs: number;
  bashAutoBackgroundOnTimeout: boolean;
  askQuestionTimeoutEnabled: boolean;
  askQuestionTimeoutSecs: number;
  webFetchAllowLocal: boolean;
  webFetchAllowedDomains: string;
  webSearchAllowedDomains: string;
  webSearchExcludedDomains: string;
  sandboxProfile: string;
  sandboxAutoAllowBash: boolean;
  newSessionWorktreeMode: string;
  forkWorktreeMode: string;
  notifyMethod: string;
  notifyCondition: string;
  notifyIdleSecs: number;
  notifyTurnComplete: boolean;
  notifyApproval: boolean;
  notifySleepPrevention: boolean;
  notifyProgressBar: boolean;
  notifyTitleEnabled: boolean;
  cursorSkills: boolean;
  cursorRules: boolean;
  cursorAgents: boolean;
  cursorMcps: boolean;
  cursorHooks: boolean;
  claudeSkills: boolean;
  claudeRules: boolean;
  claudeAgents: boolean;
  claudeMcps: boolean;
  claudeHooks: boolean;
};

export const GROK_SETTINGS_DEFAULTS: GrokSettings = {
  autoUpdate: true,
  cliChannel: "stable",
  showTips: true,
  defaultModel: "grok-4.6",
  defaultEffort: "high",
  webSearchModel: "",
  sessionSummaryModel: "",
  imageDescriptionModel: "",
  permissionMode: "ask",
  rememberToolApprovals: true,
  defaultSelectedPermission: "always_allow_all_sessions",
  showThinkingBlocks: true,
  groupToolVerbs: true,
  collapsedEditBlocks: false,
  pageFlipOnSend: true,
  followUpBehavior: "queue",
  compactMode: false,
  showTimestamps: true,
  showTimeline: false,
  combineQueuedPrompts: false,
  forkSecondaryModel: "",
  maxThoughtsWidth: 120,
  promptSuggestions: true,
  theme: "groknight",
  autoDarkTheme: "groknight",
  autoLightTheme: "grokday",
  simpleMode: true,
  vimMode: false,
  screenMode: "fullscreen",
  renderMermaid: "auto",
  scrollSpeed: 50,
  scrollMode: "auto",
  scrollLines: null,
  invertScroll: false,
  cancelSubagentsOnTurnCancel: "ask",
  hunkTrackerMode: "agent_only",
  voiceKeybindEnabled: true,
  voiceCaptureMode: "hold",
  telemetry: false,
  feedback: true,
  lspTools: false,
  codebaseIndexing: true,
  twoPassCompaction: false,
  remoteFetch: true,
  webFetch: false,
  writeFile: true,
  toolSearch: true,
  memoryEnabled: false,
  subagentsEnabled: true,
  workflowsEnabled: true,
  traceUpload: false,
  disableCodebaseUpload: false,
  autoCompactPercent: 85,
  loadEnvrc: true,
  respectGitignore: false,
  bashTimeoutSecs: 120,
  bashOutputByteLimit: 20000,
  bashMaxTimeoutSecs: 36000,
  bashAutoBackgroundOnTimeout: true,
  askQuestionTimeoutEnabled: true,
  askQuestionTimeoutSecs: 1800,
  webFetchAllowLocal: false,
  webFetchAllowedDomains: "",
  webSearchAllowedDomains: "",
  webSearchExcludedDomains: "",
  sandboxProfile: "off",
  sandboxAutoAllowBash: false,
  newSessionWorktreeMode: "never",
  forkWorktreeMode: "ask",
  notifyMethod: "auto",
  notifyCondition: "unfocused",
  notifyIdleSecs: 3,
  notifyTurnComplete: true,
  notifyApproval: true,
  notifySleepPrevention: true,
  notifyProgressBar: true,
  notifyTitleEnabled: true,
  cursorSkills: true,
  cursorRules: true,
  cursorAgents: true,
  cursorMcps: true,
  cursorHooks: true,
  claudeSkills: true,
  claudeRules: true,
  claudeAgents: true,
  claudeMcps: true,
  claudeHooks: true,
};

export function isGrokSettingKey(key: string): key is keyof GrokSettings {
  return Object.prototype.hasOwnProperty.call(GROK_SETTINGS_DEFAULTS, key);
}

export type SettingsField =
  | { key: keyof GrokSettings; kind: "toggle"; label: string; hint: string }
  | { key: keyof GrokSettings; kind: "select"; label: string; hint: string; options: { value: string; label: string }[] }
  | { key: keyof GrokSettings; kind: "text" | "list"; label: string; hint: string }
  | {
      key: keyof GrokSettings;
      kind: "number";
      label: string;
      hint: string;
      min?: number;
      max?: number;
      optional?: boolean;
    };

const THEME_OPTIONS = [
  { value: "auto", label: "auto · 跟随系统" },
  { value: "groknight", label: "groknight" },
  { value: "grokday", label: "grokday" },
  { value: "tokyonight", label: "tokyonight" },
  { value: "rosepine", label: "rosepine" },
  { value: "oscura", label: "oscura" },
];

const WORKTREE_OPTIONS = [
  { value: "ask", label: "ask · 每次询问" },
  { value: "always", label: "always · 总是创建" },
  { value: "never", label: "never · 跳过" },
];

export const SETTINGS_SECTIONS: { title: string; fields: SettingsField[] }[] = [
  {
    title: "权限与批准",
    fields: [
      {
        key: "permissionMode",
        kind: "select",
        label: "权限模式",
        hint: "询问先确认敏感操作；自动放过安全操作；自动批准不再询问。",
        options: [
          { value: "ask", label: "询问" },
          { value: "auto", label: "自动" },
          { value: "always-approve", label: "自动批准" },
        ],
      },
      {
        key: "rememberToolApprovals",
        kind: "toggle",
        label: "记住批准",
        hint: "把本次工具批准记下来，后续同类操作不再问。",
      },
      {
        key: "defaultSelectedPermission",
        kind: "select",
        label: "批准条默认项",
        hint: "弹出批准条时默认选中的项，例如始终允许。",
        options: [
          { value: "always_allow_all_sessions", label: "始终允许" },
          { value: "allow_command_always", label: "允许该命令" },
          { value: "allow_once", label: "仅一次" },
          { value: "reject", label: "拒绝" },
        ],
      },
      {
        key: "askQuestionTimeoutEnabled",
        kind: "toggle",
        label: "Ask-Question 超时",
        hint: "[toolset.ask_user_question] timeout_enabled",
      },
      {
        key: "askQuestionTimeoutSecs",
        kind: "number",
        label: "Ask-Question 超时（秒）",
        hint: "[toolset.ask_user_question] timeout_secs",
        min: 1,
        max: 86400,
      },
      {
        key: "cancelSubagentsOnTurnCancel",
        kind: "select",
        label: "取消回合时的子代理",
        hint: "[ui] cancel_subagents_on_turn_cancel",
        options: [
          { value: "ask", label: "ask" },
          { value: "always_stop", label: "always_stop" },
          { value: "always_continue", label: "always_continue" },
        ],
      },
    ],
  },
  {
    title: "模型",
    fields: [
      { key: "defaultModel", kind: "text", label: "默认模型", hint: "[models] default" },
      {
        key: "defaultEffort",
        kind: "select",
        label: "默认 reasoning effort",
        hint: "[models] default_reasoning_effort",
        options: [
          { value: "minimal", label: "minimal" },
          { value: "low", label: "low" },
          { value: "medium", label: "medium" },
          { value: "high", label: "high" },
          { value: "xhigh", label: "xhigh" },
        ],
      },
      { key: "webSearchModel", kind: "text", label: "web_search 模型", hint: "[models] web_search，留空跟随默认模型" },
      { key: "sessionSummaryModel", kind: "text", label: "会话摘要模型", hint: "[models] session_summary，留空跟随默认" },
      { key: "imageDescriptionModel", kind: "text", label: "图片描述模型", hint: "[models] image_description，留空跟随默认" },
      { key: "forkSecondaryModel", kind: "text", label: "Fork 副模型", hint: "[ui] fork_secondary_model，留空跟随默认" },
    ],
  },
  {
    title: "外观",
    fields: [
      { key: "showThinkingBlocks", kind: "toggle", label: "显示思考过程", hint: "[ui] show_thinking_blocks" },
      { key: "groupToolVerbs", kind: "toggle", label: "合并工具链", hint: "[ui] group_tool_verbs" },
      { key: "collapsedEditBlocks", kind: "toggle", label: "折叠编辑 diff", hint: "[ui] collapsed_edit_blocks" },
      { key: "pageFlipOnSend", kind: "toggle", label: "发送后滚到最新", hint: "[ui] page_flip_on_send" },
      { key: "compactMode", kind: "toggle", label: "紧凑模式", hint: "[ui] compact_mode" },
      { key: "showTimestamps", kind: "toggle", label: "显示时间戳", hint: "[ui] show_timestamps" },
      { key: "showTimeline", kind: "toggle", label: "时间轴刻度", hint: "[ui] show_timeline。主要给 grok TUI 用。" },
      { key: "promptSuggestions", kind: "toggle", label: "下一句建议", hint: "[ui] prompt_suggestions" },
      {
        key: "followUpBehavior",
        kind: "select",
        label: "追问行为",
        hint: "[ui] follow_up_behavior",
        options: [
          { value: "queue", label: "queue" },
          { value: "steer", label: "steer" },
        ],
      },
      { key: "combineQueuedPrompts", kind: "toggle", label: "合并排队追问", hint: "[ui] combine_queued_prompts" },
      {
        key: "theme",
        kind: "select",
        label: "TUI 主题",
        hint: "[ui] theme。写入 config，grok TUI 使用。",
        options: THEME_OPTIONS,
      },
      {
        key: "autoDarkTheme",
        kind: "select",
        label: "自动深色主题",
        hint: "[ui] auto_dark_theme",
        options: THEME_OPTIONS.filter((row) => row.value !== "auto"),
      },
      {
        key: "autoLightTheme",
        kind: "select",
        label: "自动浅色主题",
        hint: "[ui] auto_light_theme",
        options: THEME_OPTIONS.filter((row) => row.value !== "auto"),
      },
      {
        key: "screenMode",
        kind: "select",
        label: "TUI 默认屏幕模式",
        hint: "[ui] screen_mode。fullscreen / minimal。",
        options: [
          { value: "fullscreen", label: "fullscreen" },
          { value: "minimal", label: "minimal" },
        ],
      },
      { key: "simpleMode", kind: "toggle", label: "Readline 输入（关则 vim 输入）", hint: "[ui] simple_mode" },
      { key: "vimMode", kind: "toggle", label: "Vim 回滚导航", hint: "[ui] vim_mode" },
      {
        key: "renderMermaid",
        kind: "select",
        label: "Mermaid 图",
        hint: "[ui] render_mermaid",
        options: [
          { value: "auto", label: "auto" },
          { value: "on", label: "on" },
          { value: "off", label: "off" },
        ],
      },
      {
        key: "maxThoughtsWidth",
        kind: "number",
        label: "思考区最大列宽",
        hint: "[ui] max_thoughts_width",
        min: 40,
        max: 500,
      },
      { key: "voiceKeybindEnabled", kind: "toggle", label: "语音快捷键", hint: "[ui] voice_keybind_enabled" },
      {
        key: "voiceCaptureMode",
        kind: "select",
        label: "语音采集",
        hint: "[ui] voice_capture_mode",
        options: [
          { value: "hold", label: "hold" },
          { value: "toggle", label: "toggle" },
        ],
      },
      {
        key: "hunkTrackerMode",
        kind: "select",
        label: "文件变更追踪",
        hint: "[ui] hunk_tracker_mode",
        options: [
          { value: "agent_only", label: "agent_only" },
          { value: "all_dirty", label: "all_dirty" },
          { value: "off", label: "off" },
        ],
      },
    ],
  },
  {
    title: "滚动",
    fields: [
      {
        key: "scrollSpeed",
        kind: "number",
        label: "滚动速度",
        hint: "[ui] scroll_speed，1–100，50 为 1.0x",
        min: 1,
        max: 100,
      },
      {
        key: "scrollMode",
        kind: "select",
        label: "滚动输入",
        hint: "[ui] scroll_mode",
        options: [
          { value: "auto", label: "auto" },
          { value: "wheel", label: "wheel" },
          { value: "trackpad", label: "trackpad" },
        ],
      },
      {
        key: "scrollLines",
        kind: "number",
        label: "每格行数",
        hint: "[ui] scroll_lines。留空则跟终端配置。",
        min: 1,
        max: 10,
        optional: true,
      },
      { key: "invertScroll", kind: "toggle", label: "反转滚动", hint: "[ui] invert_scroll" },
    ],
  },
  {
    title: "功能",
    fields: [
      { key: "telemetry", kind: "toggle", label: "匿名遥测", hint: "[features] telemetry" },
      { key: "traceUpload", kind: "toggle", label: "上传会话 traces", hint: "[telemetry] trace_upload" },
      { key: "feedback", kind: "toggle", label: "反馈", hint: "[features] feedback" },
      { key: "disableCodebaseUpload", kind: "toggle", label: "禁止上传代码库", hint: "[harness] disable_codebase_upload" },
      { key: "lspTools", kind: "toggle", label: "LSP 工具", hint: "[features] lsp_tools" },
      { key: "codebaseIndexing", kind: "toggle", label: "代码索引", hint: "[features] codebase_indexing" },
      { key: "twoPassCompaction", kind: "toggle", label: "双通道压缩", hint: "[features] two_pass_compaction" },
      { key: "remoteFetch", kind: "toggle", label: "在线模型目录", hint: "[features] remote_fetch" },
      { key: "webFetch", kind: "toggle", label: "web_fetch 工具", hint: "[features] web_fetch" },
      { key: "writeFile", kind: "toggle", label: "write 工具", hint: "[features] write_file" },
      { key: "toolSearch", kind: "toggle", label: "MCP 工具发现", hint: "[features] tool_search" },
      { key: "memoryEnabled", kind: "toggle", label: "跨会话记忆", hint: "[memory] enabled" },
      { key: "subagentsEnabled", kind: "toggle", label: "子代理", hint: "[subagents] enabled" },
      { key: "workflowsEnabled", kind: "toggle", label: "后台 workflow", hint: "[workflows] enabled" },
    ],
  },
  {
    title: "会话",
    fields: [
      {
        key: "autoCompactPercent",
        kind: "number",
        label: "自动压缩阈值 %",
        hint: "[session] auto_compact_threshold_percent",
        min: 50,
        max: 99,
      },
      { key: "loadEnvrc", kind: "toggle", label: "加载 .envrc", hint: "[session] load_envrc" },
    ],
  },
  {
    title: "工具",
    fields: [
      { key: "respectGitignore", kind: "toggle", label: "遵守 gitignore", hint: "[tools] respect_gitignore" },
      {
        key: "bashTimeoutSecs",
        kind: "number",
        label: "bash 超时（秒）",
        hint: "[toolset.bash] timeout_secs",
        min: 1,
        max: 3600,
      },
      {
        key: "bashOutputByteLimit",
        kind: "number",
        label: "bash 输出上限（字节）",
        hint: "[toolset.bash] output_byte_limit",
        min: 1000,
        max: 2_000_000,
      },
      {
        key: "bashMaxTimeoutSecs",
        kind: "number",
        label: "bash 最大超时（秒）",
        hint: "[toolset.bash] max_timeout_secs",
        min: 1,
        max: 86400,
      },
      {
        key: "bashAutoBackgroundOnTimeout",
        kind: "toggle",
        label: "超时时自动转后台",
        hint: "[toolset.bash] auto_background_on_timeout",
      },
      { key: "webFetchAllowLocal", kind: "toggle", label: "web_fetch 允许 localhost", hint: "[toolset.web_fetch] allow_local" },
      {
        key: "webFetchAllowedDomains",
        kind: "list",
        label: "web_fetch 域名白名单",
        hint: "[toolset.web_fetch] allowed_domains，逗号分隔，留空不限制",
      },
      {
        key: "webSearchAllowedDomains",
        kind: "list",
        label: "web_search 域名白名单",
        hint: "[toolset.web_search] allowed_domains。与黑名单互斥，白名单优先。",
      },
      {
        key: "webSearchExcludedDomains",
        kind: "list",
        label: "web_search 域名黑名单",
        hint: "[toolset.web_search] excluded_domains",
      },
    ],
  },
  {
    title: "沙箱",
    fields: [
      {
        key: "sandboxProfile",
        kind: "select",
        label: "沙箱配置",
        hint: "[sandbox] profile",
        options: [
          { value: "off", label: "off" },
          { value: "workspace", label: "workspace" },
          { value: "devbox", label: "devbox" },
          { value: "read-only", label: "read-only" },
          { value: "strict", label: "strict" },
        ],
      },
      { key: "sandboxAutoAllowBash", kind: "toggle", label: "沙箱内自动允许 bash", hint: "[sandbox] auto_allow_bash" },
    ],
  },
  {
    title: "Worktree",
    fields: [
      {
        key: "newSessionWorktreeMode",
        kind: "select",
        label: "/new 时创建 worktree",
        hint: "[hints] new_session_worktree_mode",
        options: WORKTREE_OPTIONS,
      },
      {
        key: "forkWorktreeMode",
        kind: "select",
        label: "/fork 时创建 worktree",
        hint: "[hints] fork_worktree_mode",
        options: WORKTREE_OPTIONS,
      },
    ],
  },
  {
    title: "通知",
    fields: [
      {
        key: "notifyMethod",
        kind: "select",
        label: "通知方式",
        hint: "[ui.notifications] method。本壳在 auto/非 none 时用系统通知。",
        options: [
          { value: "auto", label: "auto" },
          { value: "osc9", label: "osc9" },
          { value: "osc99", label: "osc99" },
          { value: "osc777", label: "osc777" },
          { value: "bel", label: "bel" },
          { value: "none", label: "none" },
        ],
      },
      {
        key: "notifyCondition",
        kind: "select",
        label: "何时通知",
        hint: "[ui.notifications] condition",
        options: [
          { value: "unfocused", label: "unfocused · 失焦时" },
          { value: "always", label: "always" },
          { value: "never", label: "never" },
        ],
      },
      {
        key: "notifyIdleSecs",
        kind: "number",
        label: "失焦多久后通知（秒）",
        hint: "[ui.notifications] idle_threshold_secs",
        min: 0,
        max: 120,
      },
      { key: "notifyTurnComplete", kind: "toggle", label: "回合结束通知", hint: "events 含 turn_complete" },
      { key: "notifyApproval", kind: "toggle", label: "需要批准时通知", hint: "events 含 approval_required" },
      { key: "notifySleepPrevention", kind: "toggle", label: "回合中防止休眠", hint: "[ui.notifications] sleep_prevention" },
      { key: "notifyProgressBar", kind: "toggle", label: "标签进度条", hint: "[ui.notifications] progress_bar" },
      { key: "notifyTitleEnabled", kind: "toggle", label: "终端标题反映状态", hint: "[ui.notifications.title] enabled" },
    ],
  },
  {
    title: "兼容扫描",
    fields: [
      { key: "cursorSkills", kind: "toggle", label: "扫描 Cursor skills", hint: "[compat.cursor] skills" },
      { key: "cursorRules", kind: "toggle", label: "扫描 Cursor rules", hint: "[compat.cursor] rules" },
      { key: "cursorAgents", kind: "toggle", label: "扫描 Cursor agents", hint: "[compat.cursor] agents" },
      { key: "cursorMcps", kind: "toggle", label: "扫描 Cursor MCP", hint: "[compat.cursor] mcps" },
      { key: "cursorHooks", kind: "toggle", label: "扫描 Cursor hooks", hint: "[compat.cursor] hooks" },
      { key: "claudeSkills", kind: "toggle", label: "扫描 Claude skills", hint: "[compat.claude] skills" },
      { key: "claudeRules", kind: "toggle", label: "扫描 Claude rules", hint: "[compat.claude] rules" },
      { key: "claudeAgents", kind: "toggle", label: "扫描 Claude agents", hint: "[compat.claude] agents" },
      { key: "claudeMcps", kind: "toggle", label: "扫描 Claude MCP", hint: "[compat.claude] mcps" },
      { key: "claudeHooks", kind: "toggle", label: "扫描 Claude hooks", hint: "[compat.claude] hooks" },
    ],
  },
  {
    title: "CLI",
    fields: [
      { key: "autoUpdate", kind: "toggle", label: "自动更新 grok", hint: "[cli] auto_update" },
      {
        key: "cliChannel",
        kind: "select",
        label: "更新通道",
        hint: "[cli] channel",
        options: [
          { value: "stable", label: "stable" },
          { value: "alpha", label: "alpha" },
        ],
      },
      { key: "showTips", kind: "toggle", label: "启动提示", hint: "[cli] show_tips" },
    ],
  },
];
