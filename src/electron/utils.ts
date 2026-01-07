import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

const dbPath = path.join(app.getPath("userData"), "app.db");
export const db = new Database(dbPath);

export function initDb() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (DATE('now'))
    );
  `;
  db.prepare(createTableSQL).run();
}

export function addScore(uid: string, score = 0, date?: string) {
  const stmt = db.prepare(
    `INSERT INTO scores (uid, score, date) VALUES (?, ?, ?)`
  );
  const result = stmt.run(
    uid,
    score,
    date || new Date().toISOString().split("T")[0]
  );
  return result.lastInsertRowid;
}

export function getScores() {
  const stmt = db.prepare(`SELECT * FROM scores`);
  return stmt.all();
}

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}
