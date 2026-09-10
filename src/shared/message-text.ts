/** Strip harness wrappers so every session's user turns look like the same chat. */
export function normalizeUserText(text: string): string | undefined {
  const trimmed = text.replace(/\u0000/g, "").trim();
  if (!trimmed) return undefined;
  if (/^this session is being continued from a previous conversation/i.test(trimmed)) return undefined;
  if (/^<user_info>[\s\S]*<\/user_info>\s*$/i.test(trimmed)) return undefined;
  if (/^<system-reminder>[\s\S]*<\/system-reminder>\s*$/i.test(trimmed)) return undefined;
  const query = trimmed.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i);
  if (query) {
    const inner = query[1].trim();
    return inner || undefined;
  }
  if (/^<(user_info|system-reminder)\b/i.test(trimmed)) return undefined;
  return trimmed;
}
