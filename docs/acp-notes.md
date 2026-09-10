# ACP notes (grok 1.0.4)

Recorded by `npm run probe` against `~/.grok/bin/grok.exe`.

- Transport: `grok agent --no-leader serve --bind 127.0.0.1:<port> --secret <token>`
- WebSocket: `ws://127.0.0.1:<port>/ws?server-key=<token>`
- Handshake: `initialize` (protocolVersion 1) → `authenticate { methodId: "cached_token" }`
- Auth methods: `cached_token`, `grok.com`
- `loadSession`: true; `sessionCapabilities.list/resume/close` present
- Prompt images: false
- Default model: `grok-4.6`
