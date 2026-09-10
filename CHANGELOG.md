# Changelog / 更新日志

Every GitHub iteration must add a section here in both Chinese and English. See `AGENTS.md`.

每次推到 GitHub 的迭代都必须在此新增中英双语一节。见 `AGENTS.md`。

---

## 0.1.0 — 2026-09-11

### 中文

- 以 Electron + React 做本机 Mac / Windows 壳，经 ACP WebSocket 连接 `grok agent serve`（仅 `127.0.0.1`）。
- 从 `~/.grok/sessions` 加载本机会话，按工作区分组；支持置顶、归档、未读、重命名。
- 置顶只移动单条会话到「置顶」组，不把整个工作区一起置顶；取消后回到原工作区组。
- 对话列居中；思考块、工具链、折叠 diff、时间戳跟随 Grok 配置。
- 新对话与进行中的会话都可用下拉框改权限模式、记住批准、首次批准默认项。
- 工作区芯片可选目录，选中后用 × 清除（点一次即生效）。
- 设置写入 `~/.grok/config.toml`，与 Grok Build TUI 共用；不展示密钥。
- 检测到 Grok Build 新版本时，左下信息栏最右侧显示「更新」；更新会警告并标记中断的会话。
- 更新完成后用 Grok 把说明译成中文，追加到 `~/.grok/webui-changelog.zh.md`。
- Slash 命令上下键选择时，下拉列表跟随高亮项滚动。
- 侧栏可改分组 / 会话排序方式，并记住选择。

### English

- Local Mac/Windows Electron + React shell that drives `grok agent serve` over ACP WebSocket on `127.0.0.1` only.
- Loads local sessions from `~/.grok/sessions`, grouped by workspace; pin, archive, unread, rename.
- Pin moves a single session into a Pin group without pinning the whole workspace; unpin restores it to its workspace group.
- Centered transcript; thinking blocks, tool grouping, collapsed diffs, and timestamps follow Grok config.
- Permission mode, remembered approvals, and first-prompt default are dropdowns on new and in-progress chats.
- Workspace chip picks a folder; × clears it in one click.
- Settings write `~/.grok/config.toml` shared with the Grok Build TUI; secrets stay out of the UI.
- When Grok Build has an update, an Update control sits at the far right of the account bar; applying warns and flags interrupted sessions.
- After an update, Grok translates the notes to Chinese and appends them to `~/.grok/webui-changelog.zh.md`.
- Slash-command lists scroll with the highlighted item when using arrow keys.
- Sidebar group/session sort is configurable and persisted.
