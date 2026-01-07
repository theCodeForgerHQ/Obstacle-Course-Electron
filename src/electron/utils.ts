import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

const dbPath = path.join(app.getPath("userData"), "app.db");
const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

export interface CustomerInput {
  uid: string;
  name: string;
  address?: string;
  dateOfBirth?: string;
  phone: string;
  secondaryPhone: string;
  bloodGroup: string;
}

export interface CustomerRecord extends CustomerInput {
  id: number;
  created_at: string;
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
  const createCustomersTable = `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      date_of_birth DATE,
      phone TEXT NOT NULL,
      secondary_phone TEXT NOT NULL,
      blood_group TEXT NOT NULL
    );
  `;

  const createScoresTable = `
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (DATE('now')),
      FOREIGN KEY (uid) REFERENCES customers(uid) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `;

  db.prepare(createCustomersTable).run();
  db.prepare(createScoresTable).run();
  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_scores_uid_date ON scores (uid, date)"
  ).run();
}

export function createCustomer(input: CustomerInput) {
  const stmt = db.prepare(
    `
      INSERT INTO customers (
        uid, name, address, date_of_birth, phone, secondary_phone, blood_group
      )
      VALUES (@uid, @name, @address, @dateOfBirth, @phone, @secondaryPhone, @bloodGroup)
    `
  );

  const result = stmt.run({
    uid: input.uid,
    name: input.name,
    address: input.address ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    phone: input.phone,
    secondaryPhone: input.secondaryPhone,
    bloodGroup: input.bloodGroup,
  });

  return result.lastInsertRowid;
}

export function getCustomer(uid: string): CustomerRecord | undefined {
  const stmt = db.prepare(
    `
      SELECT
        id,
        uid,
        name,
        address,
        created_at,
        date_of_birth AS dateOfBirth,
        phone,
        secondary_phone AS secondaryPhone,
        blood_group AS bloodGroup
      FROM customers
      WHERE uid = ?
      LIMIT 1
    `
  );

  return stmt.get(uid) as CustomerRecord | undefined;
}

export function getCustomers(): CustomerRecord[] {
  const stmt = db.prepare(
    `
      SELECT
        id,
        uid,
        name,
        address,
        created_at,
        date_of_birth AS dateOfBirth,
        phone,
        secondary_phone AS secondaryPhone,
        blood_group AS bloodGroup
      FROM customers
      ORDER BY created_at DESC, id DESC
    `
  );

  return stmt.all() as CustomerRecord[];
}

export function updateCustomer(uid: string, updates: CustomerUpdate): number {
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

  const setClauses = entries.map(([key]) => `${columnMap[key]} = @${key}`);

  const stmt = db.prepare(
    `UPDATE customers SET ${setClauses.join(", ")} WHERE uid = @uid`
  );

  const params = entries.reduce(
    (acc, [key, value]) => ({ ...acc, [key]: value ?? null }),
    { uid }
  );

  const result = stmt.run(params);
  return result.changes;
}

export function deleteCustomer(uid: string) {
  const stmt = db.prepare(`DELETE FROM customers WHERE uid = ?`);
  const result = stmt.run(uid);
  return result.changes;
}

export function getScores() {
  const stmt = db.prepare(
    `
      SELECT
        scores.id,
        scores.uid,
        scores.score,
        scores.date,
        customers.name
      FROM scores
      LEFT JOIN customers ON customers.uid = scores.uid
      ORDER BY scores.date DESC, scores.id DESC
    `
  );
  return stmt.all();
}

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(",")),
  ];
  return lines.join("\n");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function csvToRows(csv: string): any[] {
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce(
      (acc, h, i) => ({ ...acc, [h]: values[i] || "" }),
      {}
    );
  });
}

export function exportCustomersCsv(): string {
  const rows = db
    .prepare(
      `
        SELECT
          id,
          uid,
          name,
          address,
          created_at,
          date_of_birth AS dateOfBirth,
          phone,
          secondary_phone AS secondaryPhone,
          blood_group AS bloodGroup
        FROM customers
      `
    )
    .all();

  return rowsToCsv(rows);
}

export function importCustomersCsv(csv: string) {
  const rows = csvToRows(csv);

  const stmt = db.prepare(
    `
      INSERT OR REPLACE INTO customers (
        id,
        uid,
        name,
        address,
        created_at,
        date_of_birth,
        phone,
        secondary_phone,
        blood_group
      )
      VALUES (
        @id,
        @uid,
        @name,
        @address,
        @created_at,
        @dateOfBirth,
        @phone,
        @secondaryPhone,
        @bloodGroup
      )
    `
  );

  const tx = db.transaction(() => {
    for (const r of rows) {
      if (!r.uid || !r.name) continue;

      stmt.run({
        id: r.id ? Number(r.id) : null,
        uid: r.uid.trim(),
        name: r.name.trim(),
        address: r.address ? r.address.trim() : null,
        created_at: r.created_at || null,
        dateOfBirth: r.dateOfBirth || null,
        phone: r.phone?.trim(),
        secondaryPhone: r.secondaryPhone?.trim(),
        bloodGroup: r.bloodGroup?.trim(),
      });
    }
  });

  tx();
}

export function exportScoresCsv(): string {
  const rows = db
    .prepare(
      `
        SELECT
          id,
          uid,
          score,
          date
        FROM scores
      `
    )
    .all();

  return rowsToCsv(rows);
}

export function importScoresCsv(csv: string) {
  const rows = csvToRows(csv);

  const stmt = db.prepare(
    `
      INSERT OR REPLACE INTO scores (
        id,
        uid,
        score,
        date
      )
      VALUES (
        @id,
        @uid,
        @score,
        @date
      )
    `
  );

  const tx = db.transaction(() => {
    for (const r of rows) stmt.run(r);
  });

  tx();
}
