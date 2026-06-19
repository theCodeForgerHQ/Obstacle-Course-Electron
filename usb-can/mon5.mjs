import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
const all = await SerialPort.list();
const ftdi = all.find(p => (p.vendorId||"").toLowerCase() === "0403");
const sp = new SerialPort({ path: ftdi.path, baudRate: 115200 });
let prev = null;
sp.pipe(new ReadlineParser({ delimiter: "\n" })).on("data", l => {
  const m = l.match(/bus_err=(\d+) arb_lost=(\d+)/);
  if (m) {
    const be = +m[1], al = +m[2];
    const d = prev ? ` (Δbus_err=${be-prev.be}, Δarb_lost=${al-prev.al})` : "";
    console.log(`bus_err=${be} arb_lost=${al}${d}`);
    prev = { be, al };
  } else if (l.includes("TX seq")) {
    const r = l.match(/-> (\w+)/);
    if (r) process.stdout.write(`TX:${r[1]}  `);
  }
});
sp.on("open", () => console.log(">>> Δ shows per-cycle error growth. Disconnect Reader B now -> watch if Δ drops to 0 <<<"));
setTimeout(() => { console.log("\n[done]"); process.exit(0); }, 28000);
