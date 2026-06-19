import { SerialPort } from "serialport";

// CH340 (the USB-serial bridge on the USB-CAN-A) enumerates with this vendor id.
const CH340_VENDOR_ID = "1a86";

// FTDI (0403) is the reader's programming UART on this rig, never the adapter.
const FTDI_VENDOR_ID = "0403";

// Things that are serial ports but are never our adapter.
const IGNORE = /bluetooth|airpods|debug-console|wlan-debug|incoming-port|buds|airdopes|airbass|hph|croma/i;

function looksLikeAdapter(p) {
  const vid = (p.vendorId || "").toLowerCase();
  const path = p.path || "";
  if (vid === CH340_VENDOR_ID) return true;
  if (vid === FTDI_VENDOR_ID) return false; // that's the ESP32 reader, not the CAN adapter
  if (IGNORE.test(path)) return false;
  // CH340 ports show up as /dev/cu.usbserial-* or /dev/cu.wchusbserial-* on macOS,
  // /dev/ttyUSB* on Linux, COM* on Windows.
  return /usbserial|wchusbserial|ttyusb|ttyacm|^com\d+/i.test(path);
}

/** List every serial port the OS currently exposes. */
export async function listPorts() {
  return SerialPort.list();
}

/**
 * Pick the most likely USB-CAN-A port. Returns { port, candidates } where
 * `port` is the chosen path (or null) and `candidates` are all plausible ones.
 */
export async function detectAdapterPort() {
  const ports = await SerialPort.list();
  const candidates = ports.filter(looksLikeAdapter);
  return { port: candidates[0]?.path ?? null, candidates, all: ports };
}
