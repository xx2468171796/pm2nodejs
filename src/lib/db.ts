import Database from "better-sqlite3";
import path from "path";
import { hashSync } from "bcryptjs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "pm2manager.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const fs = require("fs");
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initTables(db);
  ensureDefaultAdmin(db);

  return db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      ssh_user TEXT NOT NULL,
      auth_type TEXT NOT NULL CHECK(auth_type IN ('password', 'key')),
      encrypted_credential TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id TEXT NOT NULL,
      cpu_percent REAL NOT NULL,
      mem_used_mb REAL NOT NULL,
      mem_total_mb REAL NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_machine_time ON metrics(machine_id, timestamp);
  `);
}

function ensureDefaultAdmin(db: Database.Database) {
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (row.count === 0) {
    const hash = hashSync("admin", 10);
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run("admin", hash);
  }
}
