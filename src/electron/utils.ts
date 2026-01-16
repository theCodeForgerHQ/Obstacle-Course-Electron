import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

const dbPath = path.join(app.getPath("userData"), "app.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

export interface CustomerInput {
  name: string;
  address?: string;
  dateOfBirth?: string;
  phone: string;
  secondaryPhone: string;
  bloodGroup: string;
  createdBy: string;
}

export interface CustomerRecord extends CustomerInput {
  id: number;
  createdAt: string;
}

export interface CustomerUpdate {
  name?: string;
  address?: string;
  dateOfBirth?: string;
  phone?: string;
  secondaryPhone?: string;
  bloodGroup?: string;
}

export function initDb() {
  if (process.env.NODE_ENV === "development" && process.env.RESET_DB === "1") {
    db.prepare("DROP TABLE IF EXISTS scores").run();
    db.prepare("DROP TABLE IF EXISTS customers").run();
    db.prepare("DROP TABLE IF EXISTS users").run();
  }

  const createCustomersTable = `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL,
      modified_at TEXT DEFAULT '[]',
      modified_by TEXT DEFAULT '[]',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      date_of_birth DATE,
      phone TEXT NOT NULL,
      secondary_phone TEXT NOT NULL,
      blood_group TEXT NOT NULL
    );
  `;

  const createScoresTable = `
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (DATE('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `;

  const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'OPERATOR')),
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    password_reset_token_hash TEXT,
    password_reset_expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

  db.prepare(createCustomersTable).run();
  db.prepare(createScoresTable).run();
  db.prepare(createUsersTable).run();
  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_scores_customer_id_date ON scores (customer_id, date)"
  ).run();
}

export function createCustomer(input: CustomerInput) {
  const stmt = db.prepare(
    `
      INSERT INTO customers (
        name,
        address,
        date_of_birth,
        phone,
        secondary_phone,
        blood_group,
        created_by
      )
      VALUES (
        @name,
        @address,
        @dateOfBirth,
        @phone,
        @secondaryPhone,
        @bloodGroup,
        @createdBy
      )
    `
  );

  const result = stmt.run({
    name: input.name,
    address: input.address ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    phone: input.phone,
    secondaryPhone: input.secondaryPhone,
    bloodGroup: input.bloodGroup,
    createdBy: input.createdBy,
  });

  return result.lastInsertRowid;
}

export function getCustomers(): CustomerRecord[] {
  const stmt = db.prepare(
    `
      SELECT
        id,
        name,
        address,
        created_at AS createdAt,
        date_of_birth AS dateOfBirth,
        phone,
        secondary_phone AS secondaryPhone,
        blood_group AS bloodGroup
      FROM customers
      WHERE is_deleted = 0
      ORDER BY created_at DESC, id DESC
    `
  );

  return stmt.all() as CustomerRecord[];
}

export function updateCustomer(
  id: number,
  updates: CustomerUpdate,
  modifiedBy: string
): number {
  const columnMap: Record<keyof CustomerUpdate, string> = {
    name: "name",
    address: "address",
    dateOfBirth: "date_of_birth",
    phone: "phone",
    secondaryPhone: "secondary_phone",
    bloodGroup: "blood_group",
  };

  const entries = (
    Object.entries(updates) as [keyof CustomerUpdate, string | undefined][]
  ).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return 0;
  }

  const setClauses = [
    ...entries.map(([key]) => `${columnMap[key]} = @${key}`),
    `modified_by = json_array_append(modified_by, '$', @modifiedBy)`,
    `modified_at = json_array_append(modified_at, '$', @modifiedAt)`,
  ];

  const stmt = db.prepare(
    `UPDATE customers SET ${setClauses.join(", ")} WHERE id = @id`
  );

  const params = entries.reduce(
    (acc, [key, value]) => ({ ...acc, [key]: value ?? null }),
    {
      id,
      modifiedBy,
      modifiedAt: new Date().toISOString(),
    }
  );

  const result = stmt.run(params);
  return result.changes;
}

export function deleteCustomer(id: number) {
  const stmt = db.prepare(`UPDATE customers SET is_deleted = 1 WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes;
}

export function getScores() {
  const stmt = db.prepare(
    `
      SELECT
        scores.id,
        scores.customer_id,
        scores.score,
        scores.date,
        customers.name
      FROM scores
      LEFT JOIN customers ON customers.id = scores.customer_id
      ORDER BY scores.date DESC, scores.id DESC
    `
  );
  return stmt.all();
}

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}
