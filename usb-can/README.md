# usb-can

RFID-checkpoint pipeline for the obstacle course:

```
Reader (ESP32 + 125 kHz RFID + CAN)  ->  Waveshare USB-CAN-A  ->  laptop
```

Each band scan becomes one DB-ready JSON record on the laptop:

```json
{"reader":1,"uid":"4100BB0845","time":"2026-06-19T08:23:04.565Z","epoch_ms":1781857384565,"reader_ms":21263,"can_id":"0x101"}
```

- **reader** — which checkpoint (from the CAN id, `0x100 + reader#`)
- **uid** — the full 10-hex-char band UID
- **time / epoch_ms** — stamped on the laptop when the scan arrives
- **reader_ms** — the reader's own millis at capture (informational; see [DEBUG-LOG.md](DEBUG-LOG.md))

This folder is **self-contained**: its own `serialport` dependency, separate from
the Electron app's build and `node_modules`.

## Install & run

```bash
cd usb-can
npm install          # one-time, pulls serialport (prebuilt N-API binary)

npm run list         # show serial ports, flag the adapter
npm run read         # auto-detect adapter, listen at 500 kbit, print + log scans
# or target a port explicitly:
node read.mjs --port /dev/cu.usbserial-XXXX
```

`read.mjs` writes each record to **stdout** (clean JSON stream, pipe it into a DB
loader) and a human summary to **stderr**, and appends to **`events.jsonl`**.

Defaults match the reader firmware: **500 kbit/s CAN, standard frames, 2 Mbaud USB
serial, normal mode.** The reader runs `TWAI_TIMING_CONFIG_500KBITS()`, so the CAN
bitrate must stay 500000 or nothing decodes.

### Flags (`read.mjs`)

| Flag | Default | Notes |
|------|---------|-------|
| `--port <path>` | auto-detect | e.g. `/dev/cu.usbserial-1420` |
| `--bitrate <n>` | `500000` | CAN bitrate; must match the reader |
| `--mode <m>` | `normal` | `normal`, `silent` (listen-only), `loopback`, `loopback_and_silent` |
| `--frame <t>` | `STD` | `STD` or `EXT` |
| `--baud <n>` | `2000000` | USB-serial baud (adapter default) |
| `--no-file` | off | do not append to `events.jsonl` |
| `--raw` | off | also print raw `id/data` hex |

The module must run in **`normal`** mode so its CAN controller ACKs the reader on
the bus; without an ACK the reader's TX-error counter climbs until it goes
bus-off. (The reader firmware self-heals from bus-off, but it can't deliver while
the module isn't listening.)

## Firmware

[`firmware/reader_pro`](firmware/reader_pro) — the checkpoint reader. Flash with
`arduino-cli` + `esptool` (the reader is an FTDI board with no auto-reset: hold
`BOOT`, tap `EN`, release `BOOT` to enter download mode, then `esptool ... write-flash
0x0 reader_pro.ino.merged.bin`; tap `EN` to boot). Set `READER_NUM` per unit.

Scan frame (`dlc 8`, CAN id `0x100 + READER_NUM`):

| bytes | meaning |
|-------|---------|
| `0..4` | UID packed as 5 raw bytes → full 10 hex chars |
| `5..7` | `millis()` low 24 bits (uint24 LE) at capture |

## How it works

The USB-CAN-A is a CH340 USB-serial bridge speaking a small binary protocol:

- **Settings command** (fixed 20 bytes): `AA 55 12 <speed> <frame> …<checksum>`
  configures bitrate / frame type / mode. Sent once on open.
- **Data frames** (variable length): `AA <type> <id LE> <data…> 55`, where
  `type = 0xC0 | (ext<<5) | (rtr<<4) | dlc`. Parsed incrementally.

The laptop is **receive-only on the CAN bus** — it never transmits. The Waveshare
module is effectively half-duplex (it stops relaying received frames while it is
transmitting), so all timing is done on the laptop with its own clock. See
[DEBUG-LOG.md](DEBUG-LOG.md) for the full story and the dead-ends we ruled out.

Code: [`waveshare.mjs`](waveshare.mjs) (protocol), [`ports.mjs`](ports.mjs)
(detection), [`read.mjs`](read.mjs) (CLI). `node selftest.mjs` runs hardware-free
protocol checks; `node loopback.mjs` self-tests the adapter's controller.

## Troubleshooting

**Reader serial shows `TX ESP_OK` but the laptop sees nothing.** The module isn't
relaying. Make sure exactly **one** `read.mjs` is running, in `normal` mode, and
nothing is trying to make the module transmit. Restart `read.mjs`.

**Reader serial shows `TX ESP_ERR_INVALID_STATE`.** The reader's CAN controller is
bus-off (the bus had no ACK for a while). It self-heals once the module is
listening again; if not, tap `EN` to reset the reader.

**`No USB-CAN-A adapter detected` / not in `npm run list`.** Confirm macOS sees the
device: `system_profiler SPUSBDataType | grep -iA6 -e CH34 -e serial`. If the USB
device shows but no `/dev/cu.*` appears, install WCH's CH34xVCPDriver and reboot.

**Port opens but no output when scanning.** Usually a bitrate mismatch — confirm
`--bitrate 500000`. Use `--raw` to see whether any frames arrive at all.
