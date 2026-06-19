import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
const all = await SerialPort.list();
const ftdi = all.find(p => (p.vendorId||"").toLowerCase() === "0403");
const sp = new SerialPort({ path: ftdi.path, baudRate: 115200 });
let n = 0;
sp.pipe(new ReadlineParser({ delimiter: "\n" })).on("data", l => {
  // only print the post-tx status + TX lines to keep it readable
  const t = l.trimEnd();
  if (t.includes("TX seq") || t.includes("post-tx") || t.includes("DIAGNOSTIC") || t.startsWith("init")) {
    n++; console.log(t);
  }
});
sp.on("open", () => console.log(`>>> watching Reader A. UNPLUG the USB-CAN-A's CAN H/L/G from the bus around the 10s mark <<<`));
setTimeout(() => { console.log(`\n[done]`); process.exit(0); }, 30000);
