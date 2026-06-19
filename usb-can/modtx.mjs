import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { buildSettingsFrame } from "./waveshare.mjs";
const all = await SerialPort.list();
const mod = all.find(p => (p.vendorId||"").toLowerCase()==="1a86");
const esp = all.find(p => (p.vendorId||"").toLowerCase()==="10c4");
console.log(`module=${mod.path} esp=${esp.path}`);
const sp = new SerialPort({ path: mod.path, baudRate: 2000000, dataBits:8, stopBits:1, parity:"none" });
sp.on("open", ()=>sp.write(buildSettingsFrame({bitrate:500000}), ()=>sp.drain(()=>{})));
const ep = new SerialPort({ path: esp.path, baudRate: 115200 });
ep.pipe(new ReadlineParser({delimiter:"\n"})).on("data", l=>console.log("ESP| "+l.trim()));
// module TX frame: AA C8 [id=0x200 LE: 00 02] [8 data 'MODTX' + 001] 55
let n=0;
const iv = setInterval(()=>{
  n++;
  const data = Buffer.from(("MODTX"+String(n%1000).padStart(3,"0")).slice(0,8).padEnd(8,"\0"),"ascii");
  const tx = Buffer.concat([Buffer.from([0xaa,0xc8,0x00,0x02]), data, Buffer.from([0x55])]);
  sp.write(tx, ()=>sp.drain(()=>{}));
  if(n%4===0) console.log(`  (sent ${n} module-TX commands; watch module TXD LED)`);
}, 300);
setTimeout(()=>{clearInterval(iv);console.log("\n[done]");process.exit(0);}, 15000);
