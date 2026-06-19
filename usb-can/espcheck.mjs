import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
const all = await SerialPort.list();
const esp = all.find(p => (p.vendorId||"").toLowerCase()==="10c4");
if(!esp){console.log("no 10c4 ESP found");process.exit(1);}
console.log(`reading ${esp.path} 6s (opening should reset it & show banner)`);
const ep=new SerialPort({path:esp.path,baudRate:115200});
ep.pipe(new ReadlineParser({delimiter:"\n"})).on("data",l=>console.log("ESP| "+l.trim()));
setTimeout(()=>process.exit(0),6000);
