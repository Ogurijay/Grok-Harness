export type StatsCursor = {
  lastTokens?: number;
};

export type StepStats = {
  at?: number;
  durationMs?: number;
  tokens?: number;
};

export function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readEventStats(
  update: Record<string, unknown>,
  envelopeMeta?: Record<string, unknown>,
  fallbackAt?: number,
): { at?: number; totalTokens?: number } {
  const meta =
    update._meta && typeof update._meta === "object" && !Array.isArray(update._meta)
      ? (update._meta as Record<string, unknown>)
      : envelopeMeta;
  const at = asFiniteNumber(meta?.agentTimestampMs) ?? fallbackAt;
  const totalTokens = asFiniteNumber(meta?.totalTokens);
  return { at, totalTokens };
}

export function touchStats(item: StepStats, at: number | undefined, totalTokens: number | undefined, cursor: StatsCursor): void {
  if (at != null) {
    if (item.at == null) item.at = at;
    const durationMs = at - (item.at ?? at);
    if (durationMs >= 0) item.durationMs = durationMs;
  }
  if (totalTokens != null) {
    if (cursor.lastTokens != null) {
      const delta = totalTokens - cursor.lastTokens;
      if (delta > 0) item.tokens = (item.tokens ?? 0) + delta;
    }
    cursor.lastTokens = totalTokens;
  }
}

export function formatDuration(ms?: number): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.max(1, Math.round(ms))}ms`;
  if (ms < 60_000) {
    const seconds = ms / 1000;
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatTokens(count?: number): string {
  if (count == null || !Number.isFinite(count) || count <= 0) return "";
  if (count < 1000) return `${Math.round(count)}`;
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

export function formatStepStats(item: StepStats, live = false): string {
  const duration = formatDuration(
    item.durationMs ?? (live && item.at != null ? Math.max(0, Date.now() - item.at) : undefined),
  );
  const tokens = formatTokens(item.tokens);
  return [duration, tokens ? `${tokens} tok` : ""].filter(Boolean).join(" · ");
}

export function aggregateStats(items: StepStats[]): StepStats {
  const tokens = items.reduce((sum, item) => sum + (item.tokens ?? 0), 0);
  const starts = items.map((item) => item.at).filter((value): value is number => value != null);
  const ends = items
    .map((item) => (item.at ?? 0) + (item.durationMs ?? 0))
    .filter((value) => value > 0);
  const durationMs = starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : undefined;
  return {
    at: starts.length ? Math.min(...starts) : undefined,
    durationMs,
    tokens: tokens || undefined,
  };
}
