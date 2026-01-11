import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import nodemailer from "nodemailer";
import url from "url";

function getUserDataPath() {
  const name = "Obstacle Course";
  if (process.platform === "darwin") {
    return path.join(
      process.env.HOME || os.homedir(),
      "Library",
      "Application Support",
      name
    );
  }

  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA ||
      path.join(process.env.HOME || os.homedir(), "AppData", "Roaming");
    return path.join(appData, name);
  }

  return path.join(process.env.HOME || os.homedir(), ".config", name);
}

function log(message) {
  const dir = path.join(getUserDataPath(), "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(
    path.join(dir, "daily-send.log"),
    `${new Date().toISOString()} - ${message}\n`
  );
}

function parseDotEnv(content) {
  const out = {};
  const lines = String(content).split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFiles() {
  try {
    const envPaths = [];

    // script dir
    const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
    envPaths.push(path.join(scriptDir, ".env"));

    // project cwd .env (useful when running from repo)
    envPaths.push(path.join(process.cwd(), ".env"));

    // userData .env
    envPaths.push(path.join(getUserDataPath(), ".env"));

    for (const p of envPaths) {
      if (!p) continue;
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, "utf8");
          const parsed = parseDotEnv(content);
          for (const [k, v] of Object.entries(parsed)) {
            if (!process.env[k]) process.env[k] = v;
          }
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
}

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(rows, headers) {
  if (!rows || rows.length === 0) return "";
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(",")),
  ];
  return lines.join("\n");
}

async function main() {
  try {
    // load .env files from script dir, project root, and userData
    loadEnvFiles();
    const userData = getUserDataPath();
    const dbPath = path.join(userData, "app.db");

    if (!fs.existsSync(dbPath)) {
      log("Database not found");
      return;
    }

    const db = new Database(dbPath, { readonly: true });

    const settings = db
      .prepare("SELECT email FROM settings WHERE id = 1 LIMIT 1")
      .get();
    const to = settings?.email;

    if (!to) {
      log("No recipient email configured");
      db.close();
      return;
    }

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      log("SMTP configuration incomplete");
      db.close();
      return;
    }

    const customers = db
      .prepare(
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
      `
      )
      .all();

    const scores = db
      .prepare(
        `
        SELECT
          id,
          customer_id,
          score,
          date
        FROM scores
      `
      )
      .all();

    const customersCsv = rowsToCsv(customers, [
      "id",
      "name",
      "address",
      "created_at",
      "dateOfBirth",
      "phone",
      "secondaryPhone",
      "bloodGroup",
    ]);

    const scoresCsv = rowsToCsv(scores, ["id", "customer_id", "score", "date"]);

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_USER,
      to,
      subject: "Daily export: Participants & Scores",
      text: "Attached are the daily exports for participants and scores.",
      attachments: [
        { filename: "participants.csv", content: customersCsv },
        { filename: "scores.csv", content: scoresCsv },
      ],
    });

    db.close();
  } catch (e) {
    log(e?.message || String(e));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
