import { SerialPort } from "serialport";
import { detectAdapterPort } from "./ports.mjs";
import { buildSettingsFrame, FrameParser, decodeRfid, MODE } from "./waveshare.mjs";

const { port } = await detectAdapterPort();
if (!port) { console.log("NO ADAPTER"); process.exit(1); }

const sp = new SerialPort({ path: port, baudRate: 2000000, dataBits: 8, stopBits: 1, parity: "none" });
const parser = new FrameParser((m) => {
  console.log(`RECEIVED BACK: id=0x${m.id.toString(16)} data=${[...m.data].map(b=>b.toString(16).padStart(2,"0")).join(" ")} -> decoded:`, decodeRfid(m));
});
let raw = 0;
sp.on("data", (c) => { raw += c.length; process.stdout.write("raw<< " + [...c].map(b=>b.toString(16).padStart(2,"0")).join(" ") + "\n"); parser.push(c); });
sp.on("error", (e) => console.log("err", e.message));

sp.on("open", () => {
  // configure loopback @ 500k, STD
  sp.write(buildSettingsFrame({ bitrate: 500000, mode: MODE.loopback }), () => sp.drain(() => {
    console.log("loopback configured; transmitting a test frame (id 0x101, 'TESTUID0')...");
    // variable-protocol TX: AA, type=0xC0|dlc, id LE (2), data(8), 0x55
    const data = Buffer.from("TESTUID0", "ascii");
    const tx = Buffer.concat([Buffer.from([0xaa, 0xc0 | 8, 0x01, 0x01]), data, Buffer.from([0x55])]);
    setTimeout(() => sp.write(tx, () => sp.drain(() => {})), 300);
  }));
});

setTimeout(() => { console.log(`\nTOTAL RAW BYTES BACK: ${raw}`); console.log(raw>0 ? "=> ADAPTER + SOFTWARE PROVEN GOOD. Problem is the external CAN bus/readers." : "=> No echo. Adapter not echoing loopback."); sp.close(()=>process.exit(0)); }, 4000);
