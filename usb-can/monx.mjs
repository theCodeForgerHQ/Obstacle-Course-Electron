import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { buildSettingsFrame, FrameParser, decodeRfid } from "./waveshare.mjs";

const all = await SerialPort.list();
const mod = all.find(p => (p.vendorId||"").toLowerCase()==="1a86");
const rdr = all.find(p => (p.vendorId||"").toLowerCase()==="0403");

let adapterFrames = 0, lastReader = "(none)";

const sp = new SerialPort({ path: mod.path, baudRate: 2000000, dataBits:8, stopBits:1, parity:"none" });
const parser = new FrameParser(m => { adapterFrames++; const {reader,uid}=decodeRfid(m); console.log(`  >>> ADAPTER RECEIVED #${adapterFrames}: Reader ${reader} UID:"${uid}"`); });
sp.on("data", c => parser.push(c));
sp.on("open", () => sp.write(buildSettingsFrame({ bitrate:500000 }), ()=>sp.drain(()=>{})));

const rp = new SerialPort({ path: rdr.path, baudRate: 115200 });
rp.pipe(new ReadlineParser({ delimiter:"\n" })).on("data", l => { const t=l.trim(); if(t.startsWith("TX ")) lastReader=t; });

let n=0;
const iv = setInterval(()=>{ n++; console.log(`[${n*2}s] reader: ${lastReader}   |   module received so far: ${adapterFrames}`); }, 2000);
setTimeout(()=>{ clearInterval(iv); console.log(`\n=== TOTAL frames module received: ${adapterFrames} ===`); process.exit(0); }, 20000);
console.log("watching 20s (heartbeat already running)...");
