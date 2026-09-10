import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createConnection, createServer } from "node:net";

export type ServeHandle = {
  child: ChildProcess;
  port: number;
  secret: string;
  url: string;
};

function randomSecret(): string {
  return randomBytes(24).toString("hex");
}

function waitPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`等待 grok agent 监听 ${host}:${port} 超时`));
        } else {
          setTimeout(tryOnce, 120);
        }
      });
    };
    tryOnce();
  });
}

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("无法分配本地端口"));
        return;
      }
      const port = addr.port;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

export async function startGrokServe(binary: string): Promise<ServeHandle> {
  const port = await pickFreePort();
  const secret = randomSecret();
  const bind = `127.0.0.1:${port}`;
  const child = spawn(
    binary,
    ["agent", "--no-leader", "serve", "--bind", bind, "--secret", secret],
    {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        GROK_DISABLE_AUTOUPDATER: "1",
      },
    },
  );

  let stderr = "";
  child.stderr?.on("data", (buf: Buffer) => {
    stderr += buf.toString();
    if (stderr.length > 32_000) stderr = stderr.slice(-16_000);
  });
  child.stdout?.on("data", (buf: Buffer) => {
    stderr += buf.toString();
  });

  const exitPromise = new Promise<never>((_, reject) => {
    child.once("exit", (code, signal) => {
      reject(
        new Error(
          `grok agent 在就绪前退出 (code=${code}, signal=${signal})\n${stderr.slice(-2000)}`,
        ),
      );
    });
    child.once("error", reject);
  });

  try {
    await Promise.race([waitPort("127.0.0.1", port, 25_000), exitPromise]);
  } catch (err) {
    await stopGrokServe(child);
    throw err;
  }

  child.removeAllListeners("exit");
  child.removeAllListeners("error");

  return {
    child,
    port,
    secret,
    url: `ws://127.0.0.1:${port}/ws?server-key=${secret}`,
  };
}

export async function stopGrokServe(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode != null || child.pid == null) return;
  const pid = child.pid;
  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
      setTimeout(resolve, 3000);
    });
    return;
  }
  try {
    child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 400));
  if (child.exitCode == null) {
    try {
      child.kill("SIGKILL");
    } catch {
      /* ignore */
    }
  }
}
