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
  username: string;
  role: "OWNER" | "MANAGER" | "OPERATOR";
}

interface UserInput {
  username: string;
  email: string;
  phone: string;
  password: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  phone: string;
  role: "OWNER" | "MANAGER" | "OPERATOR";
}

interface Customer {
  id?: number;
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
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'OPERATOR')) DEFAULT 'OPERATOR',
    password_hash TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    password_reset_token_hash TEXT,
    password_reset_expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

  const createSessionsTable = `
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`;

  db.prepare(createCustomersTable).run();
  db.prepare(createScoresTable).run();
  db.prepare(createUsersTable).run();
  db.prepare(createSessionsTable).run();
  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_scores_customer_id_date ON scores (customer_id, date)"
  ).run();
}

function createSession(user: {
  id: number;
  username: string;
  role: "OWNER" | "MANAGER" | "OPERATOR";
}) {
  eraseSession();
  const stmt = db.prepare(
    `INSERT INTO sessions (user_id, username, role) VALUES (@userId, @username, @role)`
  );
  stmt.run({
    userId: user.id,
    username: user.username,
    role: user.role,
  });
  return readSession();
}

export function eraseSession() {
  db.prepare(`DELETE FROM sessions`).run();
}

export function readSession(): Session | null {
  const stmt = db.prepare(`
      SELECT
        user_id AS userId,
        username,
        role
      FROM sessions
      LIMIT 1
    `);
  return stmt.get() as Session | null;
}

export function createUser(input: UserInput) {
  const session = readSession();
  if (
    session === null ||
    (session.role !== "MANAGER" && session.role !== "OWNER")
  ) {
    throw new Error("Permission denied.");
  }

  if (!input.username || !input.email || !input.phone || !input.password) {
    throw new Error("All fields are required.");
  }

  if (!/^\d{10}$/.test(input.phone.replace(/\D/g, ""))) {
    throw new Error("Phone number must be 10 digits.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error("Invalid email address.");
  }

  if (!isStrongPassword(input.password)) {
    throw new Error("Password is not strong enough.");
  }

  const stmt = db.prepare(
    `INSERT INTO users (username, email, phone, password_hash) 
         VALUES (@username, @email, @phone, @passwordHash)`
  );
  const result = stmt.run({
    username: input.username,
    email: input.email,
    phone: input.phone,
    passwordHash: hashPassword(input.password),
  });
  return result.lastInsertRowid;
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPasswordHash(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*]/.test(password)) return false;
  return true;
}

export function getCurrentUserInfo(): User | null {
  const session = readSession();
  if (session === null) {
    return null;
  }

  const stmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
  const user = stmt.get(session.userId) as any;

  if (!user) {
    return null;
  }

  return {
    username: user.username,
    email: user.email,
    id: user.id,
    phone: user.phone,
    role: user.role as "OWNER" | "MANAGER" | "OPERATOR",
  };
}

export function getAllUsers(): User[] {
  const session = readSession();
  if (
    session === null ||
    (session.role !== "MANAGER" && session.role !== "OWNER")
  ) {
    throw new Error("Permission denied.");
  }

  const stmt = db.prepare(
    `SELECT id, username, email, phone, role FROM users where is_deleted = 0 ORDER BY id ASC`
  );

  return stmt.all() as User[];
}

export function deleteUser(userId: number): void {
  const session = readSession();
  if (
    session === null ||
    (session.role !== "OWNER" && session.role !== "MANAGER")
  ) {
    throw new Error("Permission denied.");
  }

  if (!userId) {
    throw new Error("User ID is required.");
  }

  if (userId === session.userId) {
    throw new Error("Cannot delete your own account.");
  }

  const stmt = db.prepare(`UPDATE users SET is_deleted = 1 WHERE id = ?`);
  stmt.run(userId);
}

export function promoteUserToManager(userId: number): void {
  const session = readSession();
  if (
    session === null ||
    (session.role !== "OWNER" && session.role !== "MANAGER")
  ) {
    throw new Error("Permission denied.");
  }

  if (userId === session.userId) {
    throw new Error("Cannot modify your own role.");
  }

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const stmt = db.prepare(
    `UPDATE users SET role = 'MANAGER' WHERE id = ? AND role = 'OPERATOR'`
  );
  stmt.run(userId);
}

export function demoteUserToOperator(userId: number): void {
  const session = readSession();
  if (
    session === null ||
    (session.role !== "OWNER" && session.role !== "MANAGER")
  ) {
    throw new Error("Permission denied.");
  }

  if (userId === session.userId) {
    throw new Error("Cannot modify your own role.");
  }

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const stmt = db.prepare(
    `UPDATE users SET role = 'OPERATOR' WHERE id = ? AND role = 'MANAGER'`
  );
  stmt.run(userId);
}

export function verifyPassword(password: string): boolean {
  const session = readSession();
  if (session === null) {
    return false;
  }

  const stmt = db.prepare(`SELECT password_hash FROM users WHERE id = ?`);
  const user = stmt.get(session.userId) as any;

  if (!user) {
    return false;
  }

  return verifyPasswordHash(password, user.password_hash);
}

export function updatePassword(newPassword: string): void {
  const session = readSession();
  if (session === null) {
    throw new Error("No active session.");
  }

  if (!newPassword) {
    throw new Error("Password is required.");
  }

  if (!isStrongPassword(newPassword)) {
    throw new Error("Password is not strong enough.");
  }

  const stmt = db.prepare(
    `UPDATE users SET password_hash = ? WHERE id = ? AND is_deleted = 0`
  );
  stmt.run(hashPassword(newPassword), session.userId);
}

export function updatePhoneNumber(newPhone: string): void {
  const session = readSession();
  if (session === null) {
    throw new Error("No active session.");
  }

  if (!newPhone) {
    throw new Error("Phone number is required.");
  }

  if (!/^\d{10}$/.test(newPhone.replace(/\D/g, ""))) {
    throw new Error("Phone number must be 10 digits.");
  }

  const stmt = db.prepare(
    `UPDATE users SET phone = ? WHERE id = ? AND is_deleted = 0`
  );
  stmt.run(newPhone, session.userId);
}

export function loginUser(text: string, password: string): Session | null {
  const stmt = db.prepare(
    `SELECT * FROM users WHERE (username = ? OR email = ?) AND is_deleted = 0`
  );
  const user = stmt.get(text, text) as any;

  if (!user) {
    throw new Error("User not found.");
  }

  if (!verifyPasswordHash(password, user.password_hash)) {
    throw new Error("Invalid password.");
  }

  return createSession({
    id: user.id,
    username: user.username,
    role: user.role,
  });
}

export function createCustomer(input: Customer) {
  const session = readSession();
  if (!session) {
    throw new Error("No active session.");
  }

  if (
    !input.name ||
    !input.phone ||
    !input.secondaryPhone ||
    !input.bloodGroup
  ) {
    throw new Error("Missing required customer fields.");
  }

  const phone = input.phone.replace(/\D/g, "");
  const secondaryPhone = input.secondaryPhone.replace(/\D/g, "");

  if (!/^\d{10}$/.test(phone)) {
    throw new Error("Phone number must be 10 digits.");
  }

  if (!/^\d{10}$/.test(secondaryPhone)) {
    throw new Error("Secondary phone number must be 10 digits.");
  }

  const stmt = db.prepare(`
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
    `);

  const result = stmt.run({
    name: input.name,
    address: input.address,
    dateOfBirth: input.dateOfBirth,
    phone,
    secondaryPhone,
    bloodGroup: input.bloodGroup,
    createdBy: session.username,
  });

  return result.lastInsertRowid;
}

export function getCustomers(): Customer[] {
  const session = readSession();
  if (session === null) {
    throw new Error("No active session.");
  }

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

  return stmt.all() as Customer[];
}

export function updateCustomer(id: number, updates: Customer): number {
  const session = readSession();
  if (session === null) {
    throw new Error("No active session.");
  }

  if (updates.phone && !/^\d{10}$/.test(updates.phone.replace(/\D/g, ""))) {
    throw new Error("Phone number must be 10 digits.");
  }

  if (
    updates.secondaryPhone &&
    !/^\d{10}$/.test(updates.secondaryPhone.replace(/\D/g, ""))
  ) {
    throw new Error("Secondary phone number must be 10 digits.");
  }

  const columnMap: Record<keyof Customer, string> = {
    id: "id",
    name: "name",
    address: "address",
    dateOfBirth: "date_of_birth",
    phone: "phone",
    secondaryPhone: "secondary_phone",
    bloodGroup: "blood_group",
  };

  const entries = (
    Object.entries(updates) as [keyof Customer, string | undefined][]
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
    `UPDATE customers SET ${setClauses.join(
      ", "
    )} WHERE id = @id AND is_deleted = 0`
  );

  const modifiedBy = session.username;
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
  const session = readSession();
  if (session === null) {
    throw new Error("No active session.");
  }

  const stmt = db.prepare(`UPDATE customers SET is_deleted = 1 WHERE id = ?`);
  const result = stmt.run(id);
  return result.changes;
}

export function getScores() {
  const session = readSession();
  if (session === null) {
    throw new Error("No active session.");
  }

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
