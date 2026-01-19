import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";
import bcrypt from "bcrypt";

const dbPath = path.join(app.getPath("userData"), "app.db");
const db = new Database(dbPath);
const BCRYPT_ROUNDS = 12;

db.pragma("foreign_keys = ON");

export interface Session {
  userId: number;
  role: "OWNER" | "MANAGER" | "OPERATOR";
}

export interface Customer {
  id?: number;
  name: string;
  email: string;
  phone: string;
  emergency_contact: string;
  address: string;
  date_of_birth: string;
  gender: "M" | "F" | "O";
  blood_group: string;
  is_deleted?: number;
  created_at?: string;
}

export interface User extends Customer {
  role: "OWNER" | "MANAGER" | "OPERATOR";
  password?: string;
}

export interface Score {
  id: number;
  name: string;
  customerId: number;
  score: number;
  date: string;
}

export function initDb() {
  if (process.env.NODE_ENV === "development" && process.env.RESET_DB === "1") {
    db.prepare("DROP TABLE IF EXISTS scores").run();
    db.prepare("DROP TABLE IF EXISTS sessions").run();
    db.prepare("DROP TABLE IF EXISTS customers").run();
    db.prepare("DROP TABLE IF EXISTS users").run();
  }

  db.prepare(
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      emergency_contact TEXT NOT NULL,
      address TEXT NOT NULL,
      date_of_birth DATE NOT NULL,
      gender TEXT CHECK (gender IN ('M', 'F', 'O')) NOT NULL,
      blood_group TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      emergency_contact TEXT NOT NULL,
      address TEXT NOT NULL,
      date_of_birth DATE NOT NULL,
      gender TEXT CHECK (gender IN ('M', 'F', 'O')) NOT NULL,
      blood_group TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'OPERATOR')) DEFAULT 'OPERATOR',
      password_hash TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      password_reset_token_hash TEXT,
      password_reset_expires_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (DATE('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE
    );`,
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS sessions (
      user_id INTEGER NOT NULL PRIMARY KEY,
      role TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
  ).run();

  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_scores_customer_id_date ON scores (customer_id, date)",
  ).run();
}

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}
