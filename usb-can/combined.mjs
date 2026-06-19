import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { buildSettingsFrame, FrameParser, decodeRfid } from "./waveshare.mjs";

const all = await SerialPort.list();
const mod = all.find(p => (p.vendorId||"").toLowerCase()==="1a86");
const rdr = all.find(p => (p.vendorId||"").toLowerCase()==="0403");
console.log(`module=${mod?.path}  reader=${rdr?.path}`);

// CAN module (adapter)
const sp = new SerialPort({ path: mod.path, baudRate: 2000000, dataBits:8, stopBits:1, parity:"none" });
const parser = new FrameParser(m => {
  if (m.rtr) return;
  const { reader, uid } = decodeRfid(m);
  console.log(`  >>> ADAPTER GOT FRAME: Reader ${reader} UID:"${uid}" [id=0x${m.id.toString(16)} data=${[...m.data].map(b=>b.toString(16).padStart(2,"0")).join(" ")}]`);
});
sp.on("data", c => parser.push(c));
sp.on("open", () => sp.write(buildSettingsFrame({ bitrate:500000 }), () => sp.drain(()=>{})));

// reader serial
const rp = new SerialPort({ path: rdr.path, baudRate: 115200 });
rp.pipe(new ReadlineParser({ delimiter:"\n" })).on("data", l => console.log("READER| " + l.trimEnd()));

console.log(">>> connect module CANH/CANL/G to Reader A, then SCAN tags. Watching 40s... <<<");
setTimeout(()=>{ console.log("\n[done]"); process.exit(0); }, 40000);
