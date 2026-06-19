#!/usr/bin/env node
// Lists serial ports and flags the one that looks like the USB-CAN-A adapter.
// Run:  npm run list   (or: node list-ports.mjs)

import { listPorts, detectAdapterPort } from "./ports.mjs";

const all = await listPorts();
const { port, candidates } = await detectAdapterPort();

if (all.length === 0) {
  console.log("No serial ports found at all.");
} else {
  console.log(`Serial ports (${all.length}):`);
  for (const p of all) {
    const mark = candidates.some((c) => c.path === p.path) ? " <-- likely USB-CAN-A" : "";
    const vid = p.vendorId ? ` vid=${p.vendorId}` : "";
    const pid = p.productId ? ` pid=${p.productId}` : "";
    const mfr = p.manufacturer ? ` (${p.manufacturer})` : "";
    console.log(`  ${p.path}${vid}${pid}${mfr}${mark}`);
  }
}

console.log("");
if (port) {
  console.log(`Detected adapter port: ${port}`);
  console.log(`Read from it with:  node read.mjs --port ${port}`);
} else {
  console.log("No USB-CAN-A adapter detected.");
  console.log("If the adapter is plugged in but missing here, see README.md > Troubleshooting.");
}
