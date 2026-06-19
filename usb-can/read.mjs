#!/usr/bin/env node
// Professional RFID-over-CAN receiver for the obstacle course.
//
// Topology:  laptop  <-USB->  Waveshare USB-CAN-A  <-CAN bus->  Reader(s)
//
// Each band scan arrives as one 8-byte CAN frame (see firmware/reader_pro):
//   CAN id     = 0x100 + reader#          -> reader_id
//   data[0..4] = UID packed as 5 bytes    -> full 10-hex-char UID
//   data[5..7] = reader millis (uint24)   -> capture clock (informational; see below)
//
// TIME: the readers have no RTC and the Waveshare module is effectively
// half-duplex (it stops relaying received frames while transmitting), so the
// laptop does NOT send anything onto the bus. Instead it stamps each scan with
// its own wall-clock the moment the frame arrives. With the receiver always
// running this equals the scan time within a few milliseconds of CAN latency.
// (The reader's own millis is still carried in the frame as `reader_ms` for
// anyone who later wants to reconstruct exact capture spacing.)
//
// Output: one JSON line per scan to stdout (DB-ready) plus a human summary on
// stderr, and an append to events.jsonl unless --no-file is given.
//
// Usage:
//   node read.mjs                       auto-detect port, write events.jsonl
//   node read.mjs --port /dev/cu.usbserial-XXXX
//   node read.mjs --no-file             do not append to events.jsonl
//   node read.mjs --raw                 also print raw frame hex
//
// Flags: --port --baud --bitrate --mode --frame --no-file --raw

import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SerialPort } from "serialport";
import {
  DEFAULT_SERIAL_BAUD,
  FRAME_TYPE,
  MODE,
  SCAN_ID_BASE,
  buildSettingsFrame,
  FrameParser,
  decodeScan,
} from "./waveshare.mjs";
import { detectAdapterPort } from "./ports.mjs";

const EVENTS_FILE = join(dirname(fileURLToPath(import.meta.url)), "events.jsonl");

function parseArgs(argv) {
  const args = { baud: DEFAULT_SERIAL_BAUD, bitrate: 500_000, mode: "normal", frame: "STD", raw: false, file: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--raw") args.raw = true;
    else if (a === "--no-file") args.file = false;
    else if (a === "--port") args.port = argv[++i];
    else if (a === "--baud") args.baud = Number(argv[++i]);
    else if (a === "--bitrate") args.bitrate = Number(argv[++i]);
    else if (a === "--mode") args.mode = argv[++i];
    else if (a === "--frame") args.frame = argv[++i];
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

const hex = (buf) => [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");

async function resolvePort(requested) {
  if (requested) return requested;
  const { port, candidates, all } = await detectAdapterPort();
  if (port) {
    console.error(`Auto-detected adapter on ${port}` + (candidates.length > 1 ? " (first of several)" : ""));
    return port;
  }
  console.error("Could not auto-detect a USB-CAN-A adapter.");
  console.error(all.length ? `Serial ports seen: ${all.map((p) => p.path).join(", ")}` : "No serial ports present.");
  console.error("Plug the adapter in (or pass --port <path>). See README.md > Troubleshooting.");
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv);

  const mode = MODE[args.mode];
  if (mode === undefined) {
    console.error(`Invalid --mode ${args.mode}. Use: ${Object.keys(MODE).join(", ")}`);
    process.exit(1);
  }
  const frameType = FRAME_TYPE[args.frame];
  if (frameType === undefined) {
    console.error(`Invalid --frame ${args.frame}. Use: STD, EXT`);
    process.exit(1);
  }

  const portPath = await resolvePort(args.port);
  const settings = buildSettingsFrame({ bitrate: args.bitrate, frameType, mode });

  const port = new SerialPort({
    path: portPath,
    baudRate: args.baud,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    autoOpen: false,
  });

  async function recordScan(msg) {
    const arrival = Date.now();
    const { reader, uid, readerMs } = decodeScan(msg);

    const record = {
      reader,
      uid,
      time: new Date(arrival).toISOString(),
      epoch_ms: arrival,
      reader_ms: readerMs,
      can_id: `0x${msg.id.toString(16)}`,
    };

    // DB-ready line on stdout.
    process.stdout.write(JSON.stringify(record) + "\n");
    // Human summary on stderr (keeps stdout a clean JSON stream).
    console.error(
      `Reader ${reader} | UID ${uid} | ${record.time}` + (args.raw ? `  [id=${record.can_id} data=${hex(msg.data)}]` : ""),
    );

    if (args.file) {
      try {
        await appendFile(EVENTS_FILE, JSON.stringify(record) + "\n");
      } catch (err) {
        console.error(`WARN: could not write ${EVENTS_FILE}: ${err.message}`);
      }
    }
  }

  const parser = new FrameParser((msg) => {
    if (msg.rtr) return; // ignore remote-request frames
    if (msg.id <= SCAN_ID_BASE || msg.id > SCAN_ID_BASE + 0x0f) {
      if (args.raw) console.error(`(ignored frame id=0x${msg.id.toString(16)} data=${hex(msg.data)})`);
      return;
    }
    recordScan(msg);
  });

  port.on("data", (chunk) => parser.push(chunk));
  port.on("error", (err) => {
    console.error(`Serial error: ${err.message}`);
    process.exit(1);
  });
  port.on("close", () => {
    console.error("Serial port closed.");
    process.exit(1);
  });

  await new Promise((resolve, reject) => port.open((err) => (err ? reject(err) : resolve()))).catch((err) => {
    console.error(`Failed to open ${portPath}: ${err.message}`);
    process.exit(1);
  });

  await new Promise((resolve, reject) => {
    port.write(settings, (err) => (err ? reject(err) : port.drain(resolve)));
  }).catch((err) => {
    console.error(`Failed to send settings command: ${err.message}`);
    process.exit(1);
  });

  console.error(
    `Listening on ${portPath} @ ${args.baud} baud, CAN ${args.bitrate} bit/s, ${args.mode} mode.` +
      (args.file ? ` Writing ${EVENTS_FILE}.` : ""),
  );
  console.error("Scan a band. JSON records -> stdout, summary -> stderr. Ctrl+C to stop.\n");

  const shutdown = () => {
    if (port.isOpen) port.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
