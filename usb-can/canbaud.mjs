import { SerialPort } from "serialport";
import { detectAdapterPort } from "./ports.mjs";
import { buildSettingsFrame } from "./waveshare.mjs";
const { port } = await detectAdapterPort();
if (!port) { console.log("NO ADAPTER"); process.exit(1); }
console.log(`adapter ${port}\nKEEP TAGS ON / RE-SCAN both readers throughout (~50s)\n`);
const rates = [500000, 250000, 1000000, 125000, 800000, 100000];
function trial(rate) {
  return new Promise((res) => {
    const sp = new SerialPort({ path: port, baudRate: 2000000, dataBits: 8, stopBits: 1, parity: "none" }, (e) => {
      if (e) { console.log(`CAN ${rate}: open err ${e.message}`); return res(); }
      let bytes = 0, sample = "";
      sp.on("data", (c) => { bytes += c.length; if (sample.length < 50) sample += [...c].map(b=>b.toString(16).padStart(2,"0")).join(" ")+" "; });
      sp.write(buildSettingsFrame({ bitrate: rate }), () => sp.drain(()=>{}));
      console.log(`>> CAN ${rate} bit/s : scanning (7s)`);
      setTimeout(()=>sp.close(()=>{ console.log(`   CAN ${rate}: ${bytes} bytes ${sample?"| "+sample:""}`); res(); }), 7000);
    });
  });
}
for (const r of rates) await trial(r);
console.log("\ndone");
process.exit(0);
