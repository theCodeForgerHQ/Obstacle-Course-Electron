import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
const all = await SerialPort.list();
const esp = all.find(p => (p.vendorId||"").toLowerCase()==="10c4");
if(!esp){console.log("receiver ESP (10c4) NOT FOUND");process.exit(1);}
console.log(`reading receiver ${esp.path} 5s...`);
let n=0;
const ep=new SerialPort({path:esp.path,baudRate:115200});
ep.pipe(new ReadlineParser({delimiter:"\n"})).on("data",l=>{ if(n<15){console.log("RX| "+l.trim());} n++; });
setTimeout(()=>{console.log(`(total lines: ${n})`);process.exit(0);},5000);
