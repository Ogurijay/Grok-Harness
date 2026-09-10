import { useMemo } from "react";
import hljs from "highlight.js/lib/common";

const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "xml",
  xml: "xml",
  md: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  rb: "ruby",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  sql: "sql",
  diff: "diff",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
};

export function langFromPath(path?: string): string | undefined {
  if (!path) return undefined;
  const base = path.split(/[\\/]/).pop() ?? path;
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1).toLowerCase() : "";
  return EXT_LANG[ext];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(code: string, language?: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

export function prettyUnknown(value: unknown): { code: string; language?: string } {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return { code: JSON.stringify(JSON.parse(trimmed), null, 2), language: "json" };
      } catch {
        /* keep string */
      }
    }
    return { code: value };
  }
  try {
    return { code: JSON.stringify(value, null, 2), language: "json" };
  } catch {
    return { code: String(value) };
  }
}

export function CodeView({
  code,
  language,
  path,
  fill,
}: {
  code: string;
  language?: string;
  path?: string;
  fill?: boolean;
}) {
  const lang = language ?? langFromPath(path);
  const html = useMemo(() => highlight(code, lang), [code, lang]);
  return (
    <div className={`code-view ${fill ? "fill" : ""}`}>
      {(path || lang) && <div className="path">{path ?? lang}</div>}
      <pre className="hljs">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
