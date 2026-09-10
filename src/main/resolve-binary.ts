import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

function firstExisting(candidates: string[]): string | undefined {
  return candidates.find((p) => p && existsSync(p));
}

export function resolveGrokBinary(): string {
  const fromEnv = process.env.GROK_BINARY?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const home = homedir();
  const grokHome = process.env.GROK_HOME?.trim() || join(home, ".grok");
  const isWin = process.platform === "win32";

  const local = firstExisting([
    join(grokHome, "bin", isWin ? "grok.exe" : "grok"),
    join(home, ".local", "bin", "grok"),
  ]);
  if (local) return local;

  const pathDirs = (process.env.PATH ?? "").split(delimiter);
  const names = isWin ? ["grok.exe", "grok.cmd", "grok"] : ["grok"];
  for (const dir of pathDirs) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate) && !candidate.endsWith(".ps1")) return candidate;
    }
  }

  throw new Error(
    "找不到 grok 可执行文件。请先安装官方 CLI，或设置 GROK_BINARY 指向 grok.exe。",
  );
}
