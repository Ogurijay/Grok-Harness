export type SlashCommand = {
  name: string;
  description: string;
  hint?: string;
  source?: string;
};

const FALLBACK: SlashCommand[] = [
  { name: "compact", description: "压缩对话历史，节省上下文", hint: "可选保留说明" },
  { name: "always-approve", description: "开关自动批准工具", hint: "on|off" },
  { name: "auto", description: "开关自动权限模式" },
  { name: "context", description: "查看上下文窗口占用" },
  { name: "session-info", description: "查看会话详情" },
  { name: "model", description: "切换模型", hint: "模型名" },
  { name: "effort", description: "设置推理力度", hint: "low|medium|high|xhigh" },
  { name: "plan", description: "进入 plan mode", hint: "可选说明" },
  { name: "view-plan", description: "查看当前 plan" },
  { name: "fork", description: "从当前点分出新会话" },
  { name: "rewind", description: "回退到更早的一轮" },
  { name: "rename", description: "重命名当前会话", hint: "标题" },
  { name: "new", description: "开始新会话" },
  { name: "delete", description: "删除当前会话" },
  { name: "export", description: "导出对话" },
  { name: "copy", description: "复制最近一条回复", hint: "序号或路径" },
  { name: "usage", description: "查看额度与用量" },
  { name: "privacy", description: "编码数据与保留设置" },
  { name: "remember", description: "立刻写入一条记忆", hint: "内容" },
  { name: "flush", description: "把当前会话总结进记忆" },
  { name: "dream", description: "整理并合并记忆" },
  { name: "memory", description: "浏览或开关记忆", hint: "on|off" },
  { name: "goal", description: "设置或管理 goal", hint: "目标 | status | pause" },
  { name: "deep-research", description: "启动深度调研", hint: "问题" },
  { name: "workflow", description: "启动或管理 workflow", hint: "名称" },
  { name: "workflows", description: "浏览已保存的 workflow" },
  { name: "loop", description: "按间隔循环执行", hint: "30m 任务" },
  { name: "imagine", description: "生成图片", hint: "描述" },
  { name: "imagine-video", description: "生成视频", hint: "描述" },
  { name: "btw", description: "旁路提问，不打断当前任务", hint: "问题" },
  { name: "feedback", description: "发送反馈" },
  { name: "docs", description: "打开内置文档", hint: "标题" },
  { name: "login", description: "重新登录" },
  { name: "logout", description: "登出" },
  { name: "settings", description: "打开设置" },
  { name: "hooks", description: "查看 hooks" },
  { name: "plugins", description: "查看插件" },
  { name: "personas", description: "管理 personas" },
  { name: "config-agents", description: "管理 agent 定义" },
  { name: "history", description: "搜索历史输入" },
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function isSkillOrMcpCommand(command: SlashCommand): boolean {
  const name = command.name.toLowerCase();
  const source = (command.source ?? "").toLowerCase();
  if (name === "skill" || name === "skills" || name === "mcp" || name === "mcps") return true;
  if (name.includes("mcp") || name.startsWith("skill")) return true;
  if (name.includes(":")) return true;
  if (/(skill|mcp)/.test(source)) return true;
  return false;
}

export function parseSlashCommands(raw: unknown): SlashCommand[] {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw)?.commands)
      ? (asRecord(raw)?.commands as unknown[])
      : Array.isArray(asRecord(raw)?.availableCommands)
        ? (asRecord(raw)?.availableCommands as unknown[])
        : [];
  const out: SlashCommand[] = [];
  for (const row of rows) {
    const rec = asRecord(row);
    const name = asString(rec?.name) ?? asString(rec?.command);
    if (!name) continue;
    const input = asRecord(rec?.input);
    const command: SlashCommand = {
      name: name.replace(/^\//, ""),
      description: asString(rec?.description) ?? "",
      hint: asString(rec?.hint) ?? asString(input?.hint),
      source: asString(rec?.source) ?? asString(rec?.kind) ?? asString(rec?.type),
    };
    if (isSkillOrMcpCommand(command)) continue;
    out.push(command);
  }
  return out;
}

export function mergeSlashCommands(...lists: SlashCommand[][]): SlashCommand[] {
  const map = new Map<string, SlashCommand>();
  for (const command of FALLBACK) map.set(command.name, command);
  for (const list of lists) {
    for (const command of list) {
      if (isSkillOrMcpCommand(command)) continue;
      const prev = map.get(command.name);
      map.set(command.name, {
        name: command.name,
        description: command.description || prev?.description || "",
        hint: command.hint ?? prev?.hint,
        source: command.source ?? prev?.source,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
