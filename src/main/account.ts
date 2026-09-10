import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AccountInfo, QuotaInfo } from "../shared/types";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function findEmail(value: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  if (typeof value === "string" && value.includes("@") && value.length < 200) return value;
  const rec = asRecord(value);
  if (!rec) return undefined;
  for (const key of ["email", "user_email", "accountEmail"]) {
    const hit = asString(rec[key]);
    if (hit?.includes("@")) return hit;
  }
  for (const nested of Object.values(rec)) {
    const hit = findEmail(nested, depth + 1);
    if (hit) return hit;
  }
  return undefined;
}

function findToken(value: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  const rec = asRecord(value);
  if (!rec) return undefined;
  for (const key of ["access_token", "accessToken", "token"]) {
    const hit = asString(rec[key]);
    if (hit && hit.length > 20) return hit;
  }
  for (const nested of Object.values(rec)) {
    const hit = findToken(nested, depth + 1);
    if (hit) return hit;
  }
  return undefined;
}

async function readAuthFile(): Promise<unknown> {
  const home = process.env.GROK_HOME?.trim() || join(homedir(), ".grok");
  const raw = await readFile(join(home, "auth.json"), "utf8");
  return JSON.parse(raw);
}

function parseQuota(payload: unknown): QuotaInfo | undefined {
  const rec = asRecord(payload);
  if (!rec) return undefined;
  const data = asRecord(rec.data) ?? rec;
  const percent =
    typeof data.used_percent === "number"
      ? data.used_percent
      : typeof data.usedPercent === "number"
        ? data.usedPercent
        : typeof data.percent_used === "number"
          ? data.percent_used
          : undefined;
  const remaining =
    typeof data.remaining_percent === "number"
      ? data.remaining_percent
      : typeof percent === "number"
        ? Math.max(0, 100 - percent)
        : undefined;
  const plan = asString(data.plan) ?? asString(data.tier) ?? asString(data.subscription_tier);
  const resetAt =
    asString(data.reset_at) ??
    asString(data.resetAt) ??
    (typeof data.reset_at_unix === "number" ? new Date(data.reset_at_unix * 1000).toISOString() : undefined);
  const extra = asString(data.extra_credits) ?? asString(data.extraCredits);
  if (percent == null && remaining == null && !plan && !extra) return undefined;
  return {
    usedPercent: percent,
    remainingPercent: remaining,
    plan,
    resetAt,
    extraCredits: extra,
  };
}

export async function loadAccountSeed(): Promise<Partial<AccountInfo>> {
  try {
    const auth = await readAuthFile();
    return { email: findEmail(auth) };
  } catch {
    return {};
  }
}

export async function fetchQuota(): Promise<QuotaInfo | undefined> {
  try {
    const auth = await readAuthFile();
    const token = findToken(auth);
    if (!token) return undefined;
    const res = await fetch("https://cli-chat-proxy.grok.com/v1/billing?format=credits", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    return parseQuota(await res.json());
  } catch {
    return undefined;
  }
}
