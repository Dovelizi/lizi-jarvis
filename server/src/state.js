import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';

let db;

export function initState() {
  fs.mkdirSync(config.DATA_DIR, { recursive: true });
  const dbPath = path.join(config.DATA_DIR, 'state.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      ts    INTEGER NOT NULL,
      role  TEXT    NOT NULL,
      text  TEXT    NOT NULL,
      meta  TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts DESC);

    CREATE TABLE IF NOT EXISTS plays (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ts         INTEGER NOT NULL,
      song_id    TEXT,
      name       TEXT,
      artist     TEXT,
      source     TEXT,
      dur_played INTEGER DEFAULT 0,
      liked      INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS plan (
      date   TEXT PRIMARY KEY,
      blocks TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prefs (
      k TEXT PRIMARY KEY,
      v TEXT
    );
  `);

  logger.info({ dbPath }, 'SQLite ready');
  return db;
}

// 全部参数化查询，杜绝 SQL 注入（security_rules Rule 1）
export const stmt = {
  insertMessage: () => db.prepare('INSERT INTO messages (ts, role, text, meta) VALUES (?, ?, ?, ?)'),
  listMessages:  () => db.prepare('SELECT id, ts, role, text, meta FROM messages ORDER BY ts DESC LIMIT ?'),

  insertPlay:    () => db.prepare('INSERT INTO plays (ts, song_id, name, artist, source, dur_played, liked) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  likeSong:      () => db.prepare('UPDATE plays SET liked = 1 WHERE song_id = ?'),
  listFavorites: () => db.prepare('SELECT DISTINCT song_id, name, artist FROM plays WHERE liked = 1 ORDER BY ts DESC LIMIT ?'),

  upsertPlan:    () => db.prepare('INSERT INTO plan (date, blocks) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET blocks = excluded.blocks'),
  getPlan:       () => db.prepare('SELECT blocks FROM plan WHERE date = ?'),

  getPref:       () => db.prepare('SELECT v FROM prefs WHERE k = ?'),
  setPref:       () => db.prepare('INSERT INTO prefs (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'),
};

export function recentMessages(n = 20) {
  return stmt.listMessages().all(n).reverse();
}

export function saveMessage(role, text, meta = null) {
  stmt.insertMessage().run(Date.now(), role, text, meta ? JSON.stringify(meta) : null);
}

/** 获取底层 db 实例（router 等需要执行批量 SQL 时用） */
export function getDb() { return db; }
