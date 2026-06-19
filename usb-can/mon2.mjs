import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
const all = await SerialPort.list();
const ftdi = all.find(p => (p.vendorId||"").toLowerCase() === "0403");
if (!ftdi) { console.log("no FTDI"); process.exit(1); }
const sp = new SerialPort({ path: ftdi.path, baudRate: 115200, autoOpen: false });
sp.open((e) => {
  if (e) { console.log("open err", e.message); process.exit(1); }
  sp.set({ dtr: false, rts: false }, () => {});
  console.log(`opened ${ftdi.path} (no reset). If silent for 4s I'll pulse a reset via RTS...`);
});
let got = 0;
sp.pipe(new ReadlineParser({ delimiter: "\n" })).on("data", l => { got++; console.log("READER| " + l.trimEnd()); });
// after 4s with no data, try an RTS-based reset pulse (works if RTS->EN)
setTimeout(() => { if (got === 0) { console.log("[no data -> pulsing RTS reset]"); sp.set({ rts: true }, () => setTimeout(() => sp.set({ rts: false }, () => {}), 120)); } }, 4000);
setTimeout(() => { console.log(`\n[done; ${got} lines]`); process.exit(0); }, 16000);
