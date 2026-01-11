#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

function getUserHome() {
  return process.env.HOME || os.homedir();
}

function getUserDataPath() {
  const name = "Obstacle Course";
  if (process.platform === "darwin") {
    return path.join(getUserHome(), "Library", "Application Support", name);
  }
  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(getUserHome(), "AppData", "Roaming");
    return path.join(appData, name);
  }
  return path.join(getUserHome(), ".config", name);
}

function readDotEnv(p) {
  if (!fs.existsSync(p)) return {};
  const content = fs.readFileSync(p, "utf8");
  const out = {};
  for (let line of content.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    let k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function makePlist(nodePath, scriptPath, env) {
  const envKeys = Object.keys(env || {});
  const envEntries = envKeys
    .map(
      (k) =>
        `      <key>${k}</key>\n      <string>${escapeXml(env[k])}</string>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n  <dict>\n    <key>Label</key>\n    <string>com.thecodeforger.obstacle-course.daily</string>\n    <key>ProgramArguments</key>\n    <array>\n      <string>${escapeXml(
    nodePath
  )}</string>\n      <string>${escapeXml(
    scriptPath
  )}</string>\n    </array>\n    <key>EnvironmentVariables</key>\n    <dict>\n${
    envEntries ? envEntries + "\n" : ""
  }    </dict>\n    <key>StartCalendarInterval</key>\n    <dict>\n      <key>Hour</key>\n      <integer>0</integer>\n      <key>Minute</key>\n      <integer>0</integer>\n    </dict>\n    <key>StandardOutPath</key>\n    <string>${escapeXml(
    path.join(
      getUserHome(),
      ".local",
      "share",
      "obstacle-course",
      "daily-send.out.log"
    )
  )}</string>\n    <key>StandardErrorPath</key>\n    <string>${escapeXml(
    path.join(
      getUserHome(),
      ".local",
      "share",
      "obstacle-course",
      "daily-send.err.log"
    )
  )}</string>\n    <key>RunAtLoad</key>\n    <false/>\n  </dict>\n</plist>`;
}

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function writePlist(plist) {
  const destDir = path.join(getUserHome(), "Library", "LaunchAgents");
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(
    destDir,
    "com.thecodeforger.obstacle-course.daily.plist"
  );
  fs.writeFileSync(dest, plist, "utf8");
  return dest;
}

function install(plistPath) {
  try {
    try {
      execSync(`launchctl unload ${plistPath}`, { stdio: "ignore" });
    } catch (e) {}
    execSync(`launchctl load ${plistPath}`);
    console.log("LaunchAgent installed and loaded:", plistPath);
  } catch (e) {
    console.error("Failed to load LaunchAgent. You can load it manually:");
    console.error("launchctl load ", plistPath);
  }
}

function main() {
  // scriptPath can be passed as first arg
  const scriptArg = process.argv[2];
  const scriptPath = scriptArg
    ? path.resolve(scriptArg)
    : path.resolve(process.cwd(), "scripts", "daily-send.mjs");
  const nodePath = process.execPath;

  const projectEnv = readDotEnv(path.resolve(process.cwd(), ".env"));
  const userEnv = readDotEnv(path.join(getUserDataPath(), ".env"));
  const combined = { ...projectEnv, ...userEnv };

  // Only include SMTP related keys and PATH
  const env = {};
  for (const k of [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_SECURE",
    "PATH",
  ]) {
    if (combined[k]) env[k] = combined[k];
  }

  const plist = makePlist(nodePath, scriptPath, env);
  const plistPath = writePlist(plist);
  install(plistPath);
}

if (require.main === module) main();
