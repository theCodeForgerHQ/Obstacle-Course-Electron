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
  customer_id: number;
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

function createSession(user: {
  id: number;
  role: "OWNER" | "MANAGER" | "OPERATOR";
}): Session | null {
  eraseSession();
  db.prepare(
    `INSERT INTO sessions (user_id, role) VALUES (@userId, @role)`,
  ).run({ userId: user.id, role: user.role });

  return readSession();
}

export function eraseSession() {
  db.prepare(`DELETE FROM sessions`).run();
}

export function readSession(): Session | null {
  const stmt = db.prepare(`
      SELECT
        user_id AS userId,
        role
      FROM sessions
      LIMIT 1
    `);
  return stmt.get() as Session | null;
}

function verifyPasswordHash(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function loginUser(text: string, password: string): Session | null {
  const user = db
    .prepare(
      `SELECT * FROM users WHERE (name = ? OR email = ?) AND is_deleted = 0`,
    )
    .get(text, text) as any;

  if (!user) throw new Error("User not found.");

  if (!verifyPasswordHash(password, user.password_hash))
    throw new Error("Invalid password.");

  return createSession({ id: user.id, role: user.role });
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*]/.test(password)) return false;
  return true;
}

export function createUser(input: User) {
  const session = readSession();
  if (
    session === null ||
    (session.role !== "MANAGER" && session.role !== "OWNER")
  ) {
    throw new Error("Permission denied.");
  }

  if (
    !input.name ||
    !input.email ||
    !input.phone ||
    !input.emergency_contact ||
    !input.address ||
    !input.date_of_birth ||
    !input.gender ||
    !input.blood_group ||
    !input.password
  ) {
    throw new Error("All fields are required.");
  }

  if (!/^\d{10}$/.test(input.phone.replace(/\D/g, ""))) {
    throw new Error("Phone number must be 10 digits.");
  }

  if (!/^\d{10}$/.test(input.emergency_contact.replace(/\D/g, ""))) {
    throw new Error("Emergency Contact number must be 10 digits.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error("Invalid email address.");
  }

  if (!isStrongPassword(input.password)) {
    throw new Error("Password is not strong enough.");
  }

  const stmt = db.prepare(
    `INSERT INTO users (name, email, phone, password_hash, gender, emergency_contact, address, date_of_birth, blood_group) 
         VALUES (@name, @email, @phone, @passwordHash, @gender, @emergency_contact, @address, @date_of_birth, @blood_group)`,
  );
  const result = stmt.run({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash: hashPassword(input.password),
    gender: input.gender,
    emergency_contact: input.emergency_contact,
    address: input.address,
    date_of_birth: input.date_of_birth,
    blood_group: input.blood_group,
  });
  return result.lastInsertRowid;
}

export function getCurrentUser(): User | null {
  const session = readSession();
  if (!session) {
    throw new Error("No active session.");
  }

  const user = db
    .prepare(`SELECT * FROM users WHERE id = ? and is_deleted = 0`)
    .get(session.userId) as User | null;

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    emergency_contact: user.emergency_contact,
    address: user.address,
    date_of_birth: user.date_of_birth,
    gender: user.gender as "M" | "F" | "O",
    blood_group: user.blood_group,
    created_at: user.created_at,
    role: user.role,
  };
}

export function getAllUsers(): User[] {
  const session = readSession();
  if (!session) {
    throw new Error("No active session.");
  }

  const stmt = db.prepare(
    `SELECT id, name, email, phone, emergency_contact, address, date_of_birth, gender, blood_group, created_at, role FROM users WHERE is_deleted = 0 AND role != 'OWNER' ORDER BY id ASC`,
  );

  return stmt.all() as User[];
}

function requireOwnerSession() {
  const session = readSession();
  if (!session || session.role !== "OWNER")
    throw new Error("Permission denied.");
  return session;
}

export function promoteUserToManager(userId: number): void {
  requireOwnerSession();
  if (!userId) throw new Error("User ID is required.");

  const result = db
    .prepare(
      `UPDATE users SET role = 'MANAGER' WHERE id = ? AND role = 'OPERATOR'`,
    )
    .run(userId);
  if (result.changes === 0)
    throw new Error("User not found or cannot be promoted.");
}

export function demoteUserToOperator(userId: number): void {
  requireOwnerSession();
  if (!userId) throw new Error("User ID is required.");

  const result = db
    .prepare(
      `UPDATE users SET role = 'OPERATOR' WHERE id = ? AND role = 'MANAGER'`,
    )
    .run(userId);
  if (result.changes === 0)
    throw new Error("User not found or cannot be demoted.");
}

export function updatePassword(oldPassword: string, newPassword: string): void {
  const session = readSession();
  if (!session) {
    throw new Error("No active session.");
  }

  if (!oldPassword || !newPassword) {
    throw new Error("Old password and new password are required.");
  }

  if (!isStrongPassword(newPassword)) {
    throw new Error("New password is not strong enough.");
  }

  const user = db
    .prepare(`SELECT password_hash FROM users WHERE id = ? AND is_deleted = 0`)
    .get(session.userId) as any;

  if (!user) {
    throw new Error("User not found.");
  }

  if (!verifyPasswordHash(oldPassword, user.password_hash)) {
    throw new Error("Old password is incorrect.");
  }

  const result = db
    .prepare(
      `UPDATE users SET password_hash = ? WHERE id = ? AND is_deleted = 0`,
    )
    .run(hashPassword(newPassword), session.userId);

  if (result.changes === 0) {
    throw new Error("Password update failed.");
  }
}

type EditableProfileFields = Pick<
  Customer,
  | "name"
  | "email"
  | "phone"
  | "emergency_contact"
  | "address"
  | "date_of_birth"
  | "gender"
  | "blood_group"
>;

function normalizeUpdates(updates: Partial<EditableProfileFields>) {
  const normalized: Partial<EditableProfileFields> = { ...updates };

  if (normalized.phone) {
    normalized.phone = normalized.phone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(normalized.phone)) {
      throw new Error("Phone number must be 10 digits.");
    }
  }

  if (normalized.emergency_contact) {
    normalized.emergency_contact = normalized.emergency_contact.replace(
      /\D/g,
      "",
    );
    if (!/^\d{10}$/.test(normalized.emergency_contact)) {
      throw new Error("Emergency contact number must be 10 digits.");
    }
  }

  if (normalized.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      throw new Error("Invalid email address.");
    }
  }

  if (normalized.gender && !["M", "F", "O"].includes(normalized.gender)) {
    throw new Error("Invalid gender.");
  }

  return normalized;
}

function buildSetClause(updates: Partial<EditableProfileFields>) {
  const columnMap = {
    name: "name",
    email: "email",
    phone: "phone",
    emergency_contact: "emergency_contact",
    address: "address",
    date_of_birth: "date_of_birth",
    gender: "gender",
    blood_group: "blood_group",
  } as const;

  const entries = Object.entries(updates).filter(
    ([, value]) => value !== undefined,
  );

  if (entries.length === 0) {
    return null;
  }

  return entries
    .map(([key]) => `${columnMap[key as keyof typeof columnMap]} = @${key}`)
    .join(", ");
}

export function updateUserProfile(
  updates: Partial<EditableProfileFields>,
): number {
  const session = readSession();
  if (!session) {
    throw new Error("No active session.");
  }

  const normalized = normalizeUpdates(updates);
  const setClause = buildSetClause(normalized);
  if (!setClause) return 0;

  const result = db
    .prepare(`UPDATE users SET ${setClause} WHERE id = @id AND is_deleted = 0`)
    .run({ id: session.userId, ...normalized });

  return result.changes;
}

export function deleteUser(userId: number): void {
  const session = readSession();
  if (!session) {
    throw new Error("Permission denied.");
  }

  if (session.userId === userId) {
    throw new Error("You cannot delete your own account.");
  }

  let stmt;

  if (session.role === "OWNER") {
    stmt = db.prepare(
      `UPDATE users
       SET is_deleted = 1
       WHERE id = ? AND role IN ('MANAGER', 'OPERATOR')`,
    );
  } else if (session.role === "MANAGER") {
    stmt = db.prepare(
      `UPDATE users
       SET is_deleted = 1
       WHERE id = ? AND role = 'OPERATOR'`,
    );
  } else {
    throw new Error("Permission denied.");
  }

  const result = stmt.run(userId);

  if (result.changes === 0) {
    throw new Error("User cannot be deleted.");
  }
}

export function createCustomer(input: Customer) {
  const session = readSession();
  if (!session) {
    throw new Error("No active session.");
  }

  if (
    !input.name ||
    !input.email ||
    !input.phone ||
    !input.emergency_contact ||
    !input.address ||
    !input.date_of_birth ||
    !input.gender ||
    !input.blood_group
  ) {
    throw new Error("Missing required participant fields.");
  }

  const phone = input.phone.replace(/\D/g, "");
  const emergency = input.emergency_contact.replace(/\D/g, "");

  if (!/^\d{10}$/.test(phone)) {
    throw new Error("Phone number must be 10 digits.");
  }

  if (!/^\d{10}$/.test(emergency)) {
    throw new Error("Emergency Contact number must be 10 digits.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error("Invalid email address.");
  }

  const stmt = db.prepare(
    `INSERT INTO customers (name, email, phone, gender, emergency_contact, address, date_of_birth, blood_group) 
         VALUES (@name, @email, @phone, @gender, @emergency_contact, @address, @date_of_birth, @blood_group)`,
  );

  const result = stmt.run({
    name: input.name,
    email: input.email,
    phone: input.phone,
    gender: input.gender,
    emergency_contact: input.emergency_contact,
    address: input.address,
    date_of_birth: input.date_of_birth,
    blood_group: input.blood_group,
  });
  return result.lastInsertRowid;
}

export function getCustomers(): Customer[] {
  const session = readSession();
  if (!session) {
    throw new Error("Permission denied.");
  }

  const stmt = db.prepare(
    `SELECT id, name, email, phone, emergency_contact, address, date_of_birth, gender, blood_group, created_at FROM customers WHERE is_deleted = 0 ORDER BY id ASC`,
  );

  return stmt.all() as Customer[];
}

export function updateCustomerProfile(
  customerId: number,
  updates: Partial<EditableProfileFields>,
): number {
  const session = readSession();
  if (!session) {
    throw new Error("Permission denied.");
  }

  if (!customerId) {
    throw new Error("Participant ID is required.");
  }

  const normalized = normalizeUpdates(updates);
  const setClause = buildSetClause(normalized);
  if (!setClause) return 0;

  const result = db
    .prepare(
      `UPDATE customers SET ${setClause} WHERE id = @id AND is_deleted = 0`,
    )
    .run({ id: customerId, ...normalized });

  return result.changes;
}

export function deleteCustomer(id: number) {
  const session = readSession();
  if (!session) {
    throw new Error("No active session.");
  }

  const result = db
    .prepare(
      `UPDATE customers SET is_deleted = 1 WHERE id = ? AND is_deleted = 0`,
    )
    .run(id);

  if (result.changes === 0) {
    throw new Error("Participant not found or already deleted.");
  }

  return result.changes;
}

export function getScores() {
  const session = readSession();
  if (!session) throw new Error("No active session.");

  const stmt = db.prepare(`
    SELECT
      scores.id,
      scores.customer_id,
      scores.score,
      scores.date,
      customers.name
    FROM scores
    INNER JOIN customers ON customers.id = scores.customer_id
    WHERE customers.is_deleted = 0
    ORDER BY scores.date DESC, scores.id DESC
  `);

  return stmt.all() as {
    id: number;
    customer_id: number;
    score: number;
    date: string;
    name: string;
  }[];
}

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}
