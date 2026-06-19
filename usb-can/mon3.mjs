import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
const all = await SerialPort.list();
const ftdi = all.find(p => (p.vendorId||"").toLowerCase() === "0403");
const sp = new SerialPort({ path: ftdi.path, baudRate: 115200 });
let n = 0;
sp.pipe(new ReadlineParser({ delimiter: "\n" })).on("data", l => { n++; console.log("READER| " + l.trimEnd()); });
sp.on("open", () => console.log(`monitoring ${ftdi.path} @115200 -> PRESS EN/RST (or power-cycle) Reader A NOW`));
setTimeout(() => { console.log(`\n[done; ${n} lines]`); process.exit(0); }, 25000);
