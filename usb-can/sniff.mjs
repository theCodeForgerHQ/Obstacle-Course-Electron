import { SerialPort } from "serialport";
import { detectAdapterPort } from "./ports.mjs";
const { port } = await detectAdapterPort();
if (!port) { console.log("no adapter present"); process.exit(1); }
const sp = new SerialPort({ path: port, baudRate: 2000000, dataBits: 8, stopBits: 1, parity: "none" });
let total = 0;
sp.on("data", (c) => { total += c.length; process.stdout.write("RAW: " + [...c].map(b=>b.toString(16).padStart(2,"0")).join(" ") + "\n"); });
sp.on("error", (e) => console.log("err", e.message));
sp.on("close", () => console.log("[port closed - link dropped]"));
setTimeout(() => { console.log(`\nTOTAL RAW BYTES: ${total}`); process.exit(0); }, 14000);
console.log(`raw-sniffing ${port} for 14s - scan a tag NOW`);
