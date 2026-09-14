import { app, clipboard, nativeImage } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import type { MentionHit, PromptAttachment } from "../shared/types";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "tif", "tiff", "avif", "heic"]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
  "coverage",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".grok",
  ".idea",
  ".vscode",
]);
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  pdf: "application/pdf",
  json: "application/json",
  md: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
  css: "text/css",
  ts: "text/plain",
  tsx: "text/plain",
  js: "text/javascript",
  jsx: "text/javascript",
  py: "text/x-python",
  rs: "text/plain",
  go: "text/plain",
  zip: "application/zip",
};
export const MAX_ATTACHMENTS = 20;
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
const INLINE_IMAGE_BYTES = 6 * 1024 * 1024;

export type PromptContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string }
  | { type: "resource_link"; uri: string; name: string; mimeType?: string; size?: number };

function extOf(name: string): string {
  return extname(name).slice(1).toLowerCase();
}

export function mimeFromName(name: string): string {
  return MIME[extOf(name)] ?? "application/octet-stream";
}

export function isImageName(name: string): boolean {
  return IMAGE_EXT.has(extOf(name));
}

function previewFor(filePath: string, kind: PromptAttachment["kind"]): string | undefined {
  if (kind !== "image") return undefined;
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) return undefined;
  const { width, height } = image.getSize();
  const scale = Math.min(1, 96 / Math.max(width, height, 1));
  const resized =
    scale < 1 ? image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }) : image;
  return resized.toDataURL();
}

export async function inspectPath(filePath: string): Promise<PromptAttachment | undefined> {
  const full = resolve(filePath.trim());
  let info;
  try {
    info = await stat(full);
  } catch {
    return undefined;
  }
  if (!info.isFile() || info.size <= 0 || info.size > MAX_FILE_BYTES) return undefined;
  const name = basename(full);
  const kind = isImageName(name) ? "image" : "file";
  return {
    id: randomUUID(),
    name,
    path: full,
    mimeType: mimeFromName(name),
    size: info.size,
    kind,
    preview: previewFor(full, kind),
  };
}

export async function inspectPaths(paths: string[]): Promise<PromptAttachment[]> {
  const out: PromptAttachment[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    if (out.length >= MAX_ATTACHMENTS) break;
    const item = await inspectPath(String(raw ?? ""));
    if (!item || seen.has(item.path)) continue;
    seen.add(item.path);
    out.push(item);
  }
  return out;
}

function stampName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `screenshot-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
}

export function saveClipboardImage(): PromptAttachment | undefined {
  const image = clipboard.readImage();
  if (image.isEmpty()) return undefined;
  const dir = join(app.getPath("userData"), "uploads");
  mkdirSync(dir, { recursive: true });
  const name = stampName();
  const filePath = join(dir, name);
  writeFileSync(filePath, image.toPNG());
  const kind = "image" as const;
  return {
    id: randomUUID(),
    name,
    path: filePath,
    mimeType: "image/png",
    size: image.toPNG().length,
    kind,
    preview: previewFor(filePath, kind),
  };
}

export async function searchWorkspaceFiles(root: string, query: string, limit = 12): Promise<MentionHit[]> {
  const base = root.trim();
  if (!base) return [];
  const q = query.trim().toLowerCase();
  const home = resolve(homedir());
  const resolved = resolve(base);
  const shallow = resolved === home;
  if (shallow && q.length < 2) return [];
  const maxDepth = shallow ? 3 : 8;
  const hits: MentionHit[] = [];

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (hits.length >= limit || depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (hits.length >= limit) return;
      const name = entry.name;
      const full = join(dir, name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(name) || (name.startsWith(".") && name !== ".github")) continue;
        await walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = relative(resolved, full).replace(/\\/g, "/");
      const hay = `${name} ${rel}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      hits.push({
        id: `file:${full}`,
        kind: "file",
        label: name,
        detail: rel,
        path: full,
      });
    }
  };

  await walk(resolved, 0);
  if (q) {
    hits.sort((a, b) => {
      const aName = a.label.toLowerCase().startsWith(q) ? 0 : 1;
      const bName = b.label.toLowerCase().startsWith(q) ? 0 : 1;
      return aName - bName;
    });
  }
  return hits.slice(0, limit);
}

export async function buildPromptBlocks(opts: {
  text: string;
  attachments: PromptAttachment[];
  sessionNotes: string[];
}): Promise<{ blocks: PromptContentBlock[]; hasImages: boolean }> {
  const { readFile } = await import("node:fs/promises");
  const blocks: PromptContentBlock[] = [];
  const paths = [...new Set(opts.attachments.map((item) => item.path).filter(Boolean))];
  const parts: string[] = [];
  if (opts.text.trim()) parts.push(opts.text.trim());
  if (paths.length) parts.push(paths.map((item) => `@${item}`).join("\n"));
  if (opts.sessionNotes.length) parts.push(opts.sessionNotes.join("\n\n"));
  const body = parts.join("\n\n");
  if (body) blocks.push({ type: "text", text: body });

  let hasImages = false;
  for (const item of opts.attachments) {
    const uri = pathToFileURL(item.path).href;
    blocks.push({
      type: "resource_link",
      uri,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
    });
    if (item.kind === "image" && item.size > 0 && item.size <= INLINE_IMAGE_BYTES) {
      try {
        const data = (await readFile(item.path)).toString("base64");
        blocks.push({ type: "image", mimeType: item.mimeType || "image/png", data });
        hasImages = true;
      } catch {
        /* path still in the text / resource_link */
      }
    }
  }
  return { blocks, hasImages };
}
