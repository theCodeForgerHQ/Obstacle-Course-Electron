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
  if (process.env.NODE_ENV === "development" && process.env.RESET_DB === "1") {
    db.prepare("DROP TABLE IF EXISTS scores").run();
    db.prepare("DROP TABLE IF EXISTS customers").run();
  }

  const createCustomersTable = `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      customer_id INTEGER NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      date DATE NOT NULL DEFAULT (DATE('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
  `;

  db.prepare(createCustomersTable).run();
  db.prepare(createScoresTable).run();
  db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_scores_customer_id_date ON scores (customer_id, date)"
  ).run();

  if (process.env.NODE_ENV === "development" && process.env.SEED_DB === "1") {
    seedCustomers();
  }
}

export function createCustomer(input: CustomerInput) {
  const stmt = db.prepare(
    `
      INSERT INTO customers (
        name, address, date_of_birth, phone, secondary_phone, blood_group
      )
      VALUES (@name, @address, @dateOfBirth, @phone, @secondaryPhone, @bloodGroup)
    `
  );

  const result = stmt.run({
    name: input.name,
    address: input.address ?? null,
    dateOfBirth: input.dateOfBirth ?? null,
    phone: input.phone,
    secondaryPhone: input.secondaryPhone,
    bloodGroup: input.bloodGroup,
  });

  return result.lastInsertRowid;
}

export function getCustomer(id: number): CustomerRecord | undefined {
  const stmt = db.prepare(
    `
      SELECT
        id,
        name,
        address,
        created_at,
        date_of_birth AS dateOfBirth,
        phone,
        secondary_phone AS secondaryPhone,
        blood_group AS bloodGroup
      FROM customers
      WHERE id = ?
      LIMIT 1
    `
  );

  return stmt.get(id) as CustomerRecord | undefined;
}

export function getCustomers(): CustomerRecord[] {
  const stmt = db.prepare(
    `
      SELECT
        id,
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

export function updateCustomer(id: number, updates: CustomerUpdate): number {
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
    `UPDATE customers SET ${setClauses.join(", ")} WHERE id = @id`
  );

  const params = entries.reduce(
    (acc, [key, value]) => ({ ...acc, [key]: value ?? null }),
    { id }
  );

  const result = stmt.run(params);
  return result.changes;
}

export function deleteCustomer(id: number) {
  const stmt = db.prepare(`DELETE FROM customers WHERE id = ?`);
  const result = stmt.run(id);
  const stmt0 = db.prepare(`DELETE FROM scores WHERE customer_id = ?`);
  const result0 = stmt0.run(id);
  console.log(result0);
  return result0.changes;
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

function seedCustomers() {
  const customers: CustomerInput[] = [
    {
      name: "John Doe #1",
      address: "John Doe #1 Street",
      dateOfBirth: "01-01-1990",
      phone: "5550000001",
      secondaryPhone: "5551000001",
      bloodGroup: "O+",
    },
    {
      name: "John Doe #2",
      address: "John Doe #2 Street",
      dateOfBirth: "02-01-1990",
      phone: "5550000002",
      secondaryPhone: "5551000002",
      bloodGroup: "A+",
    },
    {
      name: "John Doe #3",
      address: "John Doe #3 Street",
      dateOfBirth: "03-01-1990",
      phone: "5550000003",
      secondaryPhone: "5551000003",
      bloodGroup: "B+",
    },
    {
      name: "John Doe #4",
      address: "John Doe #4 Street",
      dateOfBirth: "04-01-1990",
      phone: "5550000004",
      secondaryPhone: "5551000004",
      bloodGroup: "AB+",
    },
    {
      name: "John Doe #5",
      address: "John Doe #5 Street",
      dateOfBirth: "05-01-1990",
      phone: "5550000005",
      secondaryPhone: "5551000005",
      bloodGroup: "O-",
    },
    {
      name: "John Doe #6",
      address: "John Doe #6 Street",
      dateOfBirth: "06-01-1990",
      phone: "5550000006",
      secondaryPhone: "5551000006",
      bloodGroup: "A-",
    },
    {
      name: "John Doe #7",
      address: "John Doe #7 Street",
      dateOfBirth: "07-01-1990",
      phone: "5550000007",
      secondaryPhone: "5551000007",
      bloodGroup: "B-",
    },
    {
      name: "John Doe #8",
      address: "John Doe #8 Street",
      dateOfBirth: "08-01-1990",
      phone: "5550000008",
      secondaryPhone: "5551000008",
      bloodGroup: "AB-",
    },
    {
      name: "John Doe #9",
      address: "John Doe #9 Street",
      dateOfBirth: "09-01-1990",
      phone: "5550000009",
      secondaryPhone: "5551000009",
      bloodGroup: "O+",
    },
    {
      name: "John Doe #10",
      address: "John Doe #10 Street",
      dateOfBirth: "10-01-1990",
      phone: "5550000010",
      secondaryPhone: "5551000010",
      bloodGroup: "A+",
    },
  ];

  const insert = db.prepare(`
    INSERT INTO customers (
      name, address, date_of_birth, phone, secondary_phone, blood_group
    ) VALUES (@name, @address, @dateOfBirth, @phone, @secondaryPhone, @bloodGroup)
  `);

  const tx = db.transaction(() => {
    for (const c of customers) insert.run(c);
  });

  tx();

  const insertScore = db.prepare(`
    INSERT INTO scores (customer_id, score, date) VALUES (?, ?, ?)
  `);

  insertScore.run(1, 85, "01-01-2026");
  insertScore.run(1, 92, "02-01-2026");
  insertScore.run(2, 78, "01-01-2026");
  insertScore.run(2, 88, "02-01-2026");
  insertScore.run(3, 95, "01-01-2026");
  insertScore.run(3, 90, "02-01-2026");
  insertScore.run(4, 72, "01-01-2026");
  insertScore.run(4, 80, "02-01-2026");
  insertScore.run(5, 88, "01-01-2026");
  insertScore.run(5, 91, "02-01-2026");
  insertScore.run(6, 76, "01-01-2026");
  insertScore.run(6, 84, "02-01-2026");
  insertScore.run(7, 93, "01-01-2026");
  insertScore.run(7, 87, "02-01-2026");
  insertScore.run(8, 81, "01-01-2026");
  insertScore.run(8, 89, "02-01-2026");
  insertScore.run(9, 79, "01-01-2026");
  insertScore.run(9, 86, "02-01-2026");
  insertScore.run(10, 94, "01-01-2026");
  insertScore.run(10, 96, "02-01-2026");
}
