/**
 * One-shot ACP handshake against a local `grok agent serve`.
 * Prints initialize/authenticate results then exits.
 */
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const grokBin = process.env.GROK_BINARY ?? join(homedir(), ".grok", "bin", "grok.exe");
const port = 19311;
const secret = randomBytes(16).toString("hex");
const bind = `127.0.0.1:${port}`;

function waitPort(host, p, timeoutMs = 20_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = createConnection({ host, port: p }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`timed out waiting for ${host}:${p}`));
        } else {
          setTimeout(tryOnce, 150);
        }
      });
    };
    tryOnce();
  });
}

function rpc(ws, id, method, params) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 30_000);
    const onMessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  });
}

const child = spawn(
  grokBin,
  ["agent", "--no-leader", "serve", "--bind", bind, "--secret", secret],
  { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);

let stderr = "";
child.stderr.on("data", (buf) => {
  const s = buf.toString();
  stderr += s;
  process.stderr.write(s);
});
child.stdout.on("data", (buf) => process.stderr.write(buf));

let exiting = false;
async function shutdown() {
  if (exiting) return;
  exiting = true;
  child.kill();
  await new Promise((r) => setTimeout(r, 400));
  if (child.exitCode == null) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  }
}

try {
  await waitPort("127.0.0.1", port);
  const url = `ws://127.0.0.1:${port}/ws?server-key=${secret}`;
  console.log("connecting", url.replace(secret, "***"));
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("ws error")));
  });

  const init = await rpc(ws, 1, "initialize", {
    protocolVersion: 1,
    clientInfo: { name: "grok-harness-probe", version: "0.1.0" },
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
    },
  });
  console.log("\n=== initialize ===");
  console.log(JSON.stringify(init, null, 2));

  const methods = init?.authMethods ?? [];
  const methodId =
    methods.find((m) => m.id === "cached_token")?.id ?? methods[0]?.id;
  if (methodId) {
    const auth = await rpc(ws, 2, "authenticate", { methodId });
    console.log("\n=== authenticate ===");
    console.log(JSON.stringify(auth, null, 2));
  } else {
    console.log("\n=== authenticate skipped (no authMethods) ===");
  }

  ws.close();
} catch (err) {
  console.error("PROBE FAILED:", err);
  console.error("--- stderr ---");
  console.error(stderr.slice(-4000));
  await shutdown();
  process.exit(1);
}

await shutdown();
process.exit(0);
