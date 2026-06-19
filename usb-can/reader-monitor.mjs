import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
const all = await SerialPort.list();
const ftdi = all.find(p => (p.vendorId||"").toLowerCase() === "0403");
if (!ftdi) { console.log("FTDI reader port not found"); process.exit(1); }
console.log(`reader serial: ${ftdi.path} @115200 (opening resets the ESP32)`);
const sp = new SerialPort({ path: ftdi.path, baudRate: 115200 });
sp.pipe(new ReadlineParser({ delimiter: "\n" })).on("data", l => console.log("READER| " + l.trimEnd()));
sp.on("error", e => console.log("err", e.message));
setTimeout(() => { console.log("\n[monitor done]"); process.exit(0); }, 22000);
