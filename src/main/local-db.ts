import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { app } from "electron";
import initSqlJs, { type Database } from "sql.js";
import type { SessionSummary, TokenDay, TokenUsageSummary } from "../shared/types";

const require = createRequire(import.meta.url);

export type SessionFlags = {
  pinned: boolean;
  pinOrder: number;
  lastReadMs: number;
  unread: boolean;
  archived: boolean;
};

export class LocalDb {
  private db: Database | undefined;
  private file = "";

  async init(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (name) => join(dirname(require.resolve("sql.js")), name),
    });
    const dir = app.getPath("userData");
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, "state.sqlite");
    if (existsSync(this.file)) {
      this.db = new SQL.Database(readFileSync(this.file));
    } else {
      this.db = new SQL.Database();
    }
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_flags (
        session_id TEXT PRIMARY KEY,
        pinned INTEGER NOT NULL DEFAULT 0,
        pin_order INTEGER NOT NULL DEFAULT 0,
        last_read_ms INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    this.ensureColumn("session_flags", "archived", "archived INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("session_flags", "title", "title TEXT");
    this.ensureColumn("session_flags", "interrupted", "interrupted INTEGER NOT NULL DEFAULT 0");
    this.ensureColumn("session_flags", "update_interrupted", "update_interrupted INTEGER NOT NULL DEFAULT 0");
    if (this.getKv("interruptMeaning") !== "turn") {
      this.db.run("UPDATE session_flags SET update_interrupted = interrupted, interrupted = 0 WHERE interrupted = 1");
      this.setKv("interruptMeaning", "turn");
    }
    this.db.run(`
      CREATE TABLE IF NOT EXISTS token_days (
        day TEXT PRIMARY KEY,
        tokens INTEGER NOT NULL DEFAULT 0
      );
    `);
    this.persist();
  }

  static dayKey(at = Date.now()): string {
    const date = new Date(at);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  addTokens(delta: number, at = Date.now()): void {
    if (!this.db || !Number.isFinite(delta) || delta <= 0) return;
    const day = LocalDb.dayKey(at);
    this.db.run(
      `INSERT INTO token_days(day, tokens) VALUES (?, ?)
       ON CONFLICT(day) DO UPDATE SET tokens = tokens + excluded.tokens`,
      [day, Math.round(delta)],
    );
    this.persist();
  }

  tokenSummary(): TokenUsageSummary {
    const days: TokenDay[] = [];
    let total = 0;
    if (this.db) {
      const stmt = this.db.prepare("SELECT day, tokens FROM token_days ORDER BY day ASC");
      while (stmt.step()) {
        const row = stmt.get();
        const day = String(row[0] ?? "");
        const tokens = Number(row[1] ?? 0);
        if (!day || !Number.isFinite(tokens) || tokens <= 0) continue;
        days.push({ day, tokens });
        total += tokens;
      }
      stmt.free();
    }
    const today = days.find((row) => row.day === LocalDb.dayKey())?.tokens ?? 0;
    return { days, total, today };
  }

  private ensureColumn(table: string, column: string, ddl: string): void {
    if (!this.db) return;
    const stmt = this.db.prepare(`PRAGMA table_info(${table})`);
    let found = false;
    while (stmt.step()) {
      if (String(stmt.get()[1]) === column) found = true;
    }
    stmt.free();
    if (!found) this.db.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }

  private persist(): void {
    if (!this.db || !this.file) return;
    writeFileSync(this.file, Buffer.from(this.db.export()));
  }

  getKv(key: string): string | undefined {
    if (!this.db) return undefined;
    const stmt = this.db.prepare("SELECT value FROM kv WHERE key = ?");
    stmt.bind([key]);
    const value = stmt.step() ? String(stmt.get()[0]) : undefined;
    stmt.free();
    return value;
  }

  setKv(key: string, value: string): void {
    this.db?.run("INSERT INTO kv(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
      key,
      value,
    ]);
    this.persist();
  }

  getBool(key: string, fallback = false): boolean {
    const value = this.getKv(key);
    if (value == null) return fallback;
    return value === "1" || value === "true";
  }

  getNumber(key: string, fallback: number): number {
    const value = this.getKv(key);
    if (value == null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  getJson<T>(key: string, fallback: T): T {
    const raw = this.getKv(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  mergeSessions(sessions: SessionSummary[], currentId?: string): SessionSummary[] {
    if (!this.db) return sessions;
    const bootstrapped = this.getKv("bootstrapped") === "1";
    const now = Date.now();
    const merged = sessions.map((session) => {
      const stmt = this.db!.prepare(
        "SELECT pinned, pin_order, last_read_ms, archived, title, interrupted, update_interrupted FROM session_flags WHERE session_id = ?",
      );
      stmt.bind([session.sessionId]);
      const existing = stmt.step() ? stmt.get() : undefined;
      stmt.free();
      const updatedAtMs = session.updatedAtMs ?? 0;
      if (!existing) {
        const lastRead = bootstrapped ? 0 : Math.max(updatedAtMs, now);
        this.db!.run(
          "INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms, archived, interrupted) VALUES (?, 0, 0, ?, 0, 0)",
          [session.sessionId, lastRead],
        );
        return {
          ...session,
          pinned: false,
          pinOrder: 0,
          archived: false,
          unread: bootstrapped && session.sessionId !== currentId && updatedAtMs > lastRead,
          interrupted: false,
          updateInterrupted: false,
        };
      }
      const pinned = Number(existing[0]) === 1;
      const pinOrder = Number(existing[1]) || 0;
      const lastReadMs = Number(existing[2]) || 0;
      const archived = Number(existing[3]) === 1;
      const localTitle = typeof existing[4] === "string" ? existing[4].trim() : "";
      const interrupted = Number(existing[5]) === 1;
      const updateInterrupted = Number(existing[6]) === 1;
      const unread = session.sessionId !== currentId && updatedAtMs > lastReadMs + 500;
      return {
        ...session,
        title: localTitle || session.title,
        pinned,
        pinOrder,
        archived,
        unread,
        interrupted,
        updateInterrupted,
      };
    });
    if (!bootstrapped) this.setKv("bootstrapped", "1");
    else this.persist();
    return merged;
  }

  setPinned(sessionId: string, pinned: boolean): void {
    if (!this.db) return;
    const order = pinned ? Date.now() : 0;
    this.db.run(
      `INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(session_id) DO UPDATE SET pinned = excluded.pinned, pin_order = excluded.pin_order`,
      [sessionId, pinned ? 1 : 0, order],
    );
    this.persist();
  }

  markRead(sessionId: string, at = Date.now()): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms, archived)
       VALUES (?, 0, 0, ?, 0)
       ON CONFLICT(session_id) DO UPDATE SET last_read_ms = MAX(session_flags.last_read_ms, excluded.last_read_ms)`,
      [sessionId, at],
    );
    this.persist();
  }

  setArchived(sessionId: string, archived: boolean): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms, archived)
       VALUES (?, 0, 0, 0, ?)
       ON CONFLICT(session_id) DO UPDATE SET archived = excluded.archived`,
      [sessionId, archived ? 1 : 0],
    );
    this.persist();
  }

  setTitle(sessionId: string, title: string): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms, archived, title)
       VALUES (?, 0, 0, 0, 0, ?)
       ON CONFLICT(session_id) DO UPDATE SET title = excluded.title`,
      [sessionId, title],
    );
    this.persist();
  }

  deleteFlags(sessionId: string): void {
    if (!this.db) return;
    this.db.run("DELETE FROM session_flags WHERE session_id = ?", [sessionId]);
    this.persist();
  }

  markInterrupted(sessionIds: string[]): void {
    if (!this.db || !sessionIds.length) return;
    for (const sessionId of sessionIds) {
      this.db.run(
        `INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms, archived, interrupted)
         VALUES (?, 0, 0, 0, 0, 1)
         ON CONFLICT(session_id) DO UPDATE SET interrupted = 1`,
        [sessionId],
      );
    }
    this.persist();
  }

  markUpdateInterrupted(sessionIds: string[]): void {
    if (!this.db || !sessionIds.length) return;
    for (const sessionId of sessionIds) {
      this.db.run(
        `INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms, archived, interrupted, update_interrupted)
         VALUES (?, 0, 0, 0, 0, 0, 1)
         ON CONFLICT(session_id) DO UPDATE SET update_interrupted = 1`,
        [sessionId],
      );
    }
    this.persist();
  }

  clearInterrupted(sessionId: string): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms, archived, interrupted)
       VALUES (?, 0, 0, 0, 0, 0)
       ON CONFLICT(session_id) DO UPDATE SET interrupted = 0`,
      [sessionId],
    );
    this.persist();
  }

  clearUpdateInterrupted(sessionId: string): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO session_flags(session_id, pinned, pin_order, last_read_ms, archived, interrupted, update_interrupted)
       VALUES (?, 0, 0, 0, 0, 0, 0)
       ON CONFLICT(session_id) DO UPDATE SET update_interrupted = 0`,
      [sessionId],
    );
    this.persist();
  }
}
