import { app, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage, shell } from "electron";
import { join } from "node:path";
import { AgentHost } from "./agent-host";
import { isGrokSettingKey } from "../shared/grok-settings";
import type { GroupSort, SessionMode, SessionSort } from "../shared/types";

const host = new AgentHost();
let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let quitting = false;

function iconDir(): string {
  return join(app.getAppPath(), "resources");
}

function windowIconFile(): string {
  return join(iconDir(), "icon.png");
}

function trayIconFile(): string {
  return join(iconDir(), process.platform === "win32" ? "icon.ico" : "icon.png");
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function createMenu(): void {
  const isMac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: "appMenu" as const }] : []),
      { role: "editMenu" },
      ...(isMac ? [{ role: "windowMenu" as const }] : []),
    ]),
  );
}

function createTray(): void {
  const image = nativeImage.createFromPath(trayIconFile());
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }));
  tray.setToolTip("Grok-Harness");
  tray.on("click", () => showWindow());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "显示窗口", click: () => showWindow() },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function createWindow(): void {
  const icon = nativeImage.createFromPath(windowIconFile());
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 880,
    minHeight: 560,
    backgroundColor: "#f5f5f7",
    autoHideMenuBar: process.platform !== "darwin",
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: "Grok-Harness",
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  if (process.platform === "win32") app.setAppUserModelId("ai.x.grok-harness");
  createMenu();
  await host.initLocal();
  createTray();
  createWindow();

  host.onEvent((event) => {
    const win = mainWindow;
    if (!win || win.isDestroyed()) return;
    win.webContents.send("grok:event", event);
  });

  ipcMain.handle("grok:getState", () => host.getSnapshot());
  ipcMain.handle("grok:pickFolder", async () => {
    const win = mainWindow;
    const options: Electron.OpenDialogOptions = {
      title: "选择工作目录",
      properties: ["openDirectory"],
    };
    const result =
      win && !win.isDestroyed()
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });
  ipcMain.handle("grok:start", async (_evt, workspace: string, options?: unknown) => {
    if (options && typeof options === "object") {
      const rec = options as Record<string, unknown>;
      await host.start(String(workspace), {
        workspace: String(workspace),
        mode: rec.mode as "ask" | "auto" | "yolo" | "plan" | undefined,
        modelId: typeof rec.modelId === "string" ? rec.modelId : undefined,
        effort: typeof rec.effort === "string" ? rec.effort : undefined,
      });
    } else {
      await host.start(String(workspace), Boolean(options));
    }
    return host.getSnapshot();
  });
  ipcMain.handle("grok:beginNewChat", async (_evt, workspace?: string) => {
    await host.beginNewChat(workspace ? String(workspace) : undefined);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setWorkspace", (_evt, folder: string) => {
    host.setWorkspace(String(folder ?? ""));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setInspectorWidth", (_evt, width: number) => {
    host.setInspectorWidth(Number(width));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:send", async (_evt, text: string) => {
    await host.sendPrompt(String(text ?? ""));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:cancel", async () => {
    await host.cancel();
    return host.getSnapshot();
  });
  ipcMain.handle("grok:permission", (_evt, requestId: string, optionId: string | null) => {
    host.resolvePermission(String(requestId), optionId);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:openSession", async (_evt, sessionId: string, cwd?: string) => {
    await host.openSession(String(sessionId), cwd ? String(cwd) : undefined);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:loadSession", async (_evt, sessionId: string, cwd?: string) => {
    await host.openSession(String(sessionId), cwd ? String(cwd) : undefined);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:refreshSessions", async () => {
    await host.refreshSessions();
    return host.getSnapshot();
  });
  ipcMain.handle("grok:renameSession", async (_evt, sessionId: string, title: string) => {
    await host.renameSession(String(sessionId), String(title ?? ""));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:pinSession", async (_evt, sessionId: string, pinned: boolean) => {
    await host.setPinned(String(sessionId), Boolean(pinned));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:archiveSession", async (_evt, sessionId: string, archived: boolean) => {
    await host.setArchived(String(sessionId), Boolean(archived));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:deleteSession", async (_evt, sessionId: string) => {
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    const options: Electron.MessageBoxOptions = {
      type: "warning",
      buttons: ["删除", "取消"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: "删除会话",
      message: "永久删除这个会话？",
      detail: "会从 grok 历史中删除，无法恢复。",
    };
    const result = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    if (result.response !== 0) return host.getSnapshot();
    await host.deleteSession(String(sessionId));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setSidebarCollapsed", (_evt, collapsed: boolean) => {
    host.setSidebarCollapsed(Boolean(collapsed));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setInspectorOpen", (_evt, open: boolean) => {
    host.setInspectorOpen(Boolean(open));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:toggleGroup", (_evt, cwd: string) => {
    host.toggleGroup(String(cwd));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setCollapsedGroups", (_evt, keys: string[]) => {
    host.setCollapsedGroups(Array.isArray(keys) ? keys.map(String) : []);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:hideWorkspace", (_evt, key: string) => {
    host.hideWorkspace(String(key ?? ""));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:revealWorkspace", (_evt, key: string) => {
    host.revealWorkspace(String(key ?? ""));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:deleteWorkspace", async (_evt, cwd: string) => {
    const target = String(cwd ?? "").trim();
    if (!target) return host.getSnapshot();
    const count = host.getSnapshot().sessions.filter((session) => (session.cwd?.trim() || "(unknown)") === target).length;
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    const options: Electron.MessageBoxOptions = {
      type: "warning",
      buttons: ["删除", "取消"],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: "删除工作区",
      message: "删除这个工作区的全部会话？",
      detail: `将删除 ${count} 个会话，无法恢复。不会删除磁盘上的项目文件夹。`,
    };
    const result = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    if (result.response !== 0) return host.getSnapshot();
    await host.deleteWorkspace(target);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setSidebarSort", (_evt, groupSort?: unknown, sessionSort?: unknown) => {
    host.setSidebarSort(groupSort as GroupSort | undefined, sessionSort as SessionSort | undefined);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:refreshAccount", async () => {
    await host.refreshAccount();
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setAlwaysApprove", (_evt, value: boolean) => {
    host.setAlwaysApprove(Boolean(value));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setSessionMode", (_evt, mode: string) => {
    const next: SessionMode =
      mode === "auto" || mode === "yolo" || mode === "plan" || mode === "ask" ? mode : "ask";
    host.setSessionMode(next);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setGrokSetting", (_evt, key: string, value: unknown) => {
    if (isGrokSettingKey(key)) host.setGrokSetting(key, value);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:setModelEffort", async (_evt, modelId: string, effort?: string) => {
    await host.setModelEffort(String(modelId ?? ""), effort ? String(effort) : undefined);
    return host.getSnapshot();
  });
  ipcMain.handle("grok:checkUpdate", async () => {
    await host.refreshUpdate();
    return host.getSnapshot();
  });
  ipcMain.handle("grok:applyUpdate", async () => {
    try {
      await host.applyGrokUpdate();
    } catch (err) {
      console.error("apply grok update failed", err);
    }
    return host.getSnapshot();
  });
  ipcMain.handle("grok:dismissInterrupted", async (_evt, sessionId: string) => {
    await host.dismissInterrupted(String(sessionId));
    return host.getSnapshot();
  });
  ipcMain.handle("grok:copyText", (_evt, text: string) => {
    clipboard.writeText(String(text ?? ""));
    return true;
  });
  ipcMain.handle("grok:openPath", async (_evt, folder: string) => {
    const target = String(folder ?? "").trim();
    if (!target) return { ok: false, error: "没有可打开的路径" };
    const error = await shell.openPath(target);
    return error ? { ok: false, error } : { ok: true };
  });

  app.on("activate", () => showWindow());
});

app.on("window-all-closed", () => {
  /* keep tray */
});

app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void host.stop().finally(() => app.quit());
});
