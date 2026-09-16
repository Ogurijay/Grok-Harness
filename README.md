# Grok-Harness v0.1

Local Mac / Windows desktop shell for [Grok Build](https://github.com/xai-org/grok-build). The window talks to a local agent over ACP; it does not rewrite Grok.

本机 Mac / Windows 桌面壳：窗口里管 Grok Build，经 ACP 连接本机 agent，不重写 Grok。

```
Grok-Harness (Electron)
    │ ACP / WebSocket bound to 127.0.0.1 only
    ▼
grok agent serve
```

Auth and sessions stay in `~/.grok` (`grok login` or `XAI_API_KEY`).

认证和会话沿用 `~/.grok`（先 `grok login` 或设置 `XAI_API_KEY`）。

## Requirements / 要求

- Node.js 22+
- Official `grok` CLI (`GROK_BINARY` → `~/.grok/bin/grok` → `PATH`)

## Develop / 开发

```sh
git clone https://github.com/Ogurijay/Grok-Harness.git
cd Grok-Harness
# If Electron download hangs in China:
#   $env:ELECTRON_MIRROR="https://cdn.npmmirror.com/binaries/electron/"
npm install
npm run dev
```

Probe handshake without a window / 不启动窗口只测握手：

```sh
npm run probe
```

## Versioning / 版本

Every GitHub iteration **must** bump `package.json` version and add a bilingual section to `CHANGELOG.md`. Rules: [`AGENTS.md`](./AGENTS.md).

每次迭代到 GitHub **必须**升版本号并在 `CHANGELOG.md` 新增中英双语说明。规则见 [`AGENTS.md`](./AGENTS.md)。

Current / 当前：**v0.4.2**

## Safety / 安全

- Agent listens on `127.0.0.1` only
- Per-launch random serve secret; not exposed to the renderer
- Do not bind serve to `0.0.0.0` or a public host

- agent 只听 `127.0.0.1`
- 每次启动生成随机 secret，不进渲染进程
- 不要把 serve 绑到 `0.0.0.0` 或挂到公网
