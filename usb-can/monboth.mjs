import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { buildSettingsFrame, FrameParser, decodeRfid } from "./waveshare.mjs";
const all = await SerialPort.list();
const mod = all.find(p => (p.vendorId||"").toLowerCase()==="1a86");
const rdr = all.find(p => (p.vendorId||"").toLowerCase()==="0403");
console.log(`module=${mod?.path}  reader=${rdr?.path}`);
let got=0;
const sp = new SerialPort({ path: mod.path, baudRate: 2000000, dataBits:8, stopBits:1, parity:"none" });
const parser = new FrameParser(m=>{got++;const {reader,uid}=decodeRfid(m);console.log(`  >>> MODULE GOT #${got}: Reader ${reader} UID:"${uid}" (raw id=0x${m.id.toString(16)})`);});
sp.on("data", c=>parser.push(c));
sp.on("open", ()=>sp.write(buildSettingsFrame({bitrate:500000}), ()=>sp.drain(()=>{})));
if (rdr){ const rp=new SerialPort({path:rdr.path,baudRate:115200}); rp.pipe(new ReadlineParser({delimiter:"\n"})).on("data",l=>{const t=l.trim(); if(t.startsWith("Reader")) console.log("READER| "+t);}); }
let s=0; const iv=setInterval(()=>{s+=5;console.log(`[${s}s] module received: ${got}  (ensure module GND -> readers -V; scan a band)`);},5000);
setTimeout(()=>{clearInterval(iv);console.log(`\n=== module received ${got} frames ===`);process.exit(0);},30000);
