#!/usr/bin/env node
// Hardware-free sanity checks for the protocol code. Run: node selftest.mjs
import assert from "node:assert";
import { buildSettingsFrame, FrameParser, decodeRfid } from "./waveshare.mjs";

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

// 1. Settings frame for 500 kbit / STD / normal matches the documented bytes.
check("settings frame (500k, STD, normal)", () => {
  const f = buildSettingsFrame({ bitrate: 500_000 });
  assert.equal(f.length, 20);
  assert.equal(f[0], 0xaa);
  assert.equal(f[1], 0x55);
  assert.equal(f[2], 0x12);
  assert.equal(f[3], 0x03, "500 kbit speed code");
  assert.equal(f[4], 0x01, "STD frame type");
  assert.equal(f[13], 0x00, "normal mode");
  assert.equal(f[14], 0x01);
  // checksum = low 8 bits of sum(bytes[2..18])
  let sum = 0;
  for (let i = 2; i <= 18; i++) sum += f[i];
  assert.equal(f[19], sum & 0xff);
});

// 2. A reader-A frame decodes to "Reader 1 UID: 01234567".
check("decode standard data frame -> reader + uid", () => {
  // AA C8 <id LE: 01 01> <8 ascii data> 55  (id 0x101, dlc 8)
  const uidChars = Buffer.from("01234567", "ascii"); // first 8 of a 10-char tag
  const frame = Buffer.concat([Buffer.from([0xaa, 0xc8, 0x01, 0x01]), uidChars, Buffer.from([0x55])]);
  const out = [];
  new FrameParser((m) => out.push(decodeRfid(m))).push(frame);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 0x101);
  assert.equal(out[0].reader, "1");
  assert.equal(out[0].uid, "01234567");
});

// 3. Frames split across two serial chunks reassemble correctly.
check("reassembles frame across chunk boundary", () => {
  const uidChars = Buffer.from("ABCDEF12", "ascii");
  const full = Buffer.concat([Buffer.from([0xaa, 0xc8, 0x02, 0x01]), uidChars, Buffer.from([0x55])]); // id 0x102
  const out = [];
  const parser = new FrameParser((m) => out.push(decodeRfid(m)));
  parser.push(full.subarray(0, 5));
  parser.push(full.subarray(5));
  assert.equal(out.length, 1);
  assert.equal(out[0].reader, "2");
  assert.equal(out[0].uid, "ABCDEF12");
});

// 4. A 20-byte status frame is skipped, and a trailing data frame still parses.
check("skips 20-byte status frame", () => {
  const status = Buffer.alloc(20, 0);
  status[0] = 0xaa;
  status[1] = 0x55;
  const data = Buffer.concat([Buffer.from([0xaa, 0xc8, 0x03, 0x01]), Buffer.from("99999999", "ascii"), Buffer.from([0x55])]);
  const out = [];
  new FrameParser((m) => out.push(decodeRfid(m))).push(Buffer.concat([status, data]));
  assert.equal(out.length, 1);
  assert.equal(out[0].reader, "3");
});

// 5. Trailing zero data bytes are dropped from the UID (matches the ESP sketch).
check("drops zero padding bytes from uid", () => {
  const data = Buffer.from([0xaa, 0xc8, 0x01, 0x01, 0x41, 0x42, 0x43, 0, 0, 0, 0, 0, 0x55]); // "ABC" + zeros
  const out = [];
  new FrameParser((m) => out.push(decodeRfid(m))).push(data);
  assert.equal(out[0].uid, "ABC");
});

console.log(`\n${passed}/5 checks passed.`);
