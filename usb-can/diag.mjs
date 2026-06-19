import { SerialPort } from "serialport";
import { detectAdapterPort } from "./ports.mjs";
import { buildSettingsFrame } from "./waveshare.mjs";

const { port } = await detectAdapterPort();
if (!port) { console.log("NO ADAPTER PRESENT"); process.exit(1); }
console.log(`adapter: ${port}`);

const bauds = [2000000, 1000000, 921600, 460800, 230400, 115200];
const settings = buildSettingsFrame({ bitrate: 500000 }); // 500k STD normal

function trial(baud) {
  return new Promise((resolve) => {
    const sp = new SerialPort({ path: port, baudRate: baud, dataBits: 8, stopBits: 1, parity: "none" }, (err) => {
      if (err) { console.log(`  baud ${baud}: open error ${err.message}`); return resolve(); }
      let bytes = 0; let sample = "";
      sp.on("data", (c) => { bytes += c.length; if (sample.length < 60) sample += [...c].map(b=>b.toString(16).padStart(2,"0")).join(" ") + " "; });
      sp.write(settings, () => sp.drain(() => {}));
      console.log(`>> baud ${baud}: SCAN NOW (7s)`);
      setTimeout(() => { sp.close(() => { console.log(`   baud ${baud}: ${bytes} bytes ${sample?("| "+sample):""}`); resolve(); }); }, 7000);
    });
  });
}

for (const b of bauds) await trial(b);
console.log("\ndone. any baud with >0 bytes = adapter is alive and that's the serial baud.");
process.exit(0);
