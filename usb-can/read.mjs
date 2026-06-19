#!/usr/bin/env node
// Read RFID-reader CAN frames from the Waveshare USB-CAN-A adapter and print
// them the same way the ESP32 receiver sketch does:  "Reader 1 UID: 0123456789".
//
// Topology:  laptop -> USB-CAN-A -> Reader A (0x101) -> Reader B (0x102) ...
//
// Usage:
//   node read.mjs                     auto-detect port, 500 kbit, normal mode
//   node read.mjs --port /dev/cu.usbserial-XXXX
//   node read.mjs --bitrate 500000 --mode silent
//   node read.mjs --raw               also print raw hex of every frame
//
// Flags:
//   --port <path>     serial device (default: auto-detect)
//   --baud <n>        USB-serial baud (default: 2000000)
//   --bitrate <n>     CAN bitrate, must match the readers (default: 500000)
//   --mode <m>        normal | silent | loopback | loopback_and_silent (default: normal)
//   --frame <t>       STD | EXT (default: STD)
//   --raw             print raw frame hex alongside decoded output

import { SerialPort } from "serialport";
import {
  DEFAULT_SERIAL_BAUD,
  FRAME_TYPE,
  MODE,
  buildSettingsFrame,
  FrameParser,
  decodeRfid,
} from "./waveshare.mjs";
import { detectAdapterPort } from "./ports.mjs";

function parseArgs(argv) {
  const args = { baud: DEFAULT_SERIAL_BAUD, bitrate: 500_000, mode: "normal", frame: "STD", raw: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--raw") args.raw = true;
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

function hex(buf) {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

async function resolvePort(requested) {
  if (requested) return requested;
  const { port, candidates, all } = await detectAdapterPort();
  if (port) {
    console.log(`Auto-detected adapter on ${port}` + (candidates.length > 1 ? " (first of several candidates)" : ""));
    return port;
  }
  console.error("Could not auto-detect a USB-CAN-A adapter.");
  console.error(
    all.length
      ? `Serial ports seen: ${all.map((p) => p.path).join(", ")}`
      : "No serial ports are present on this machine.",
  );
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

  const parser = new FrameParser((msg) => {
    if (msg.rtr) return; // ignore remote-request frames
    const { reader, uid } = decodeRfid(msg);
    const line = `Reader ${reader} UID: ${uid}`;
    if (args.raw) {
      console.log(`${line}    [id=0x${msg.id.toString(16)} dlc=${msg.dlc} data=${hex(msg.data)}]`);
    } else {
      console.log(line);
    }
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

  await new Promise((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve()));
  }).catch((err) => {
    console.error(`Failed to open ${portPath}: ${err.message}`);
    process.exit(1);
  });

  // Configure the adapter (CAN bitrate / frame type / mode) before reading.
  await new Promise((resolve, reject) => {
    port.write(settings, (err) => (err ? reject(err) : port.drain(resolve)));
  }).catch((err) => {
    console.error(`Failed to send settings command: ${err.message}`);
    process.exit(1);
  });

  console.log(
    `Listening on ${portPath} @ ${args.baud} baud, CAN ${args.bitrate} bit/s, ${args.mode} mode, ${args.frame} frames.`,
  );
  console.log("Scan a tag on a reader. Ctrl+C to stop.\n");

  const shutdown = () => {
    console.log("\nClosing...");
    if (port.isOpen) port.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
