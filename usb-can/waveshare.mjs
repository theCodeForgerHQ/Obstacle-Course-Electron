// Waveshare USB-CAN-A protocol helpers.
//
// The USB-CAN-A presents itself as a USB-serial port (CH340 bridge) running at
// 2 Mbaud, 8 data bits, no parity, 1 stop bit by default. It speaks a small
// binary protocol documented by Waveshare and implemented by python-can's
// "seeedstudio" backend (same hardware). Two on-wire framings exist; we use the
// variable-length one for data and the fixed 20-byte one only for the settings
// command, exactly as the reference implementations do.
//
// References:
//   https://www.waveshare.com/wiki/Secondary_Development_Serial_Conversion_Definition_of_CAN_Protocol
//   python-can can/interfaces/seeedstudio/seeedstudio.py

export const DEFAULT_SERIAL_BAUD = 2_000_000; // USB-serial side, not the CAN bitrate

// CAN bitrate -> Waveshare speed code. Readers use TWAI_TIMING_CONFIG_500KBITS().
export const BITRATE_CODE = {
  1_000_000: 0x01,
  800_000: 0x02,
  500_000: 0x03,
  400_000: 0x04,
  250_000: 0x05,
  200_000: 0x06,
  125_000: 0x07,
  100_000: 0x08,
  50_000: 0x09,
  20_000: 0x0a,
  10_000: 0x0b,
  5_000: 0x0c,
};

export const FRAME_TYPE = { STD: 0x01, EXT: 0x02 };

export const MODE = {
  normal: 0x00,
  loopback: 0x01,
  silent: 0x02, // listen-only: receives without ACKing the bus
  loopback_and_silent: 0x03,
};

/**
 * Build the fixed 20-byte settings command that configures CAN bitrate,
 * frame type and operating mode on the adapter.
 *
 * @param {{ bitrate?: number, frameType?: number, mode?: number }} opts
 * @returns {Buffer}
 */
export function buildSettingsFrame({
  bitrate = 500_000,
  frameType = FRAME_TYPE.STD,
  mode = MODE.normal,
} = {}) {
  const speedCode = BITRATE_CODE[bitrate];
  if (speedCode === undefined) {
    throw new Error(
      `Unsupported CAN bitrate ${bitrate}. Valid: ${Object.keys(BITRATE_CODE).join(", ")}`,
    );
  }

  const f = Buffer.alloc(20, 0);
  f[0] = 0xaa; // packet header
  f[1] = 0x55; // packet header
  f[2] = 0x12; // type = settings command
  f[3] = speedCode;
  f[4] = frameType;
  // [5..12] filter id (4) + mask id (4) -> left as 0 = accept all
  f[13] = mode;
  f[14] = 0x01; // fixed per Waveshare reference
  // [15..18] reserved -> 0

  // Checksum: low 8 bits of the sum of bytes [2..18] inclusive.
  let sum = 0;
  for (let i = 2; i <= 18; i++) sum += f[i];
  f[19] = sum & 0xff;

  return f;
}

/**
 * Incremental parser for the variable-length data framing:
 *   0xAA  <type>  <id LE: 2 or 4 bytes>  <data: dlc bytes>  0x55
 * where type = 0xC0 | (ext<<5) | (rtr<<4) | dlc.
 *
 * 20-byte status frames (0xAA 0x55 ...) are recognised and skipped.
 *
 * Feed it raw serial chunks via push(); it invokes onMessage for each decoded
 * CAN frame: { id, ext, rtr, dlc, data: Buffer }.
 */
export class FrameParser {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.buf = Buffer.alloc(0);
  }

  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;

    let i = 0;
    const buf = this.buf;
    const n = buf.length;

    while (i < n) {
      if (buf[i] !== 0xaa) {
        i++; // resync to next packet header
        continue;
      }
      if (i + 1 >= n) break; // need the type byte

      const type = buf[i + 1];

      // 20-byte status / config-echo frame.
      if (type === 0x55) {
        if (i + 20 > n) break; // wait for the rest
        i += 20;
        continue;
      }

      // Data frame: high two bits of the type byte must be set.
      if ((type & 0xc0) !== 0xc0) {
        i++; // not a valid header, resync
        continue;
      }

      const dlc = type & 0x0f;
      const ext = (type & 0x20) !== 0;
      const rtr = (type & 0x10) !== 0;
      const idLen = ext ? 4 : 2;
      const total = 2 + idLen + dlc + 1; // header + type + id + data + end byte

      if (i + total > n) break; // incomplete, wait for more bytes
      if (buf[i + total - 1] !== 0x55) {
        i++; // misframed, resync
        continue;
      }

      let id = 0;
      for (let k = 0; k < idLen; k++) id |= buf[i + 2 + k] << (8 * k);
      id >>>= 0;

      const data = Buffer.from(buf.subarray(i + 2 + idLen, i + 2 + idLen + dlc));
      this.onMessage({ id, ext, rtr, dlc, data });

      i += total;
    }

    // Keep the unconsumed tail for next time.
    this.buf = i >= n ? Buffer.alloc(0) : Buffer.from(buf.subarray(i));
  }
}

// Reader id -> human number, mirroring the ESP32 receiver sketch.
export const READER_BY_ID = { 0x101: "1", 0x102: "2", 0x103: "3" };

/**
 * Decode a CAN frame into { reader, uid } exactly like the ESP32 receiver:
 * map the arbitration id to a reader number and turn the non-zero data bytes
 * into the ASCII UID. (Only the first 8 UID chars fit in a CAN frame.)
 *
 * @param {{ id: number, data: Buffer }} msg
 */
export function decodeRfid(msg) {
  const reader = READER_BY_ID[msg.id] ?? `?(0x${msg.id.toString(16)})`;
  let uid = "";
  for (const b of msg.data) {
    if (b !== 0) uid += String.fromCharCode(b);
  }
  return { reader, uid, id: msg.id };
}
