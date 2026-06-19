# usb-can

Laptop-side reader for the RFID/CAN bus. Replaces the ESP32 "CAN Receiver"
sketch with a Node tool that talks to a **Waveshare USB-CAN-A** adapter and
prints scans exactly like the receiver did:

```
Reader 1 UID: 01234567
Reader 2 UID: ABCDEF12
```

Topology: `laptop -> USB-CAN-A -> Reader A (0x101) -> Reader B (0x102) ...`

This folder is **self-contained**. It has its own `serialport` dependency and
does **not** touch the Electron app's build, native modules, or `node_modules`.
Nothing in the existing app changed.

## Install & run

```bash
cd usb-can
npm install          # one-time, pulls serialport (prebuilt N-API binary)

npm run list         # show serial ports, flag the adapter
npm run read         # auto-detect adapter, listen at 500 kbit, print scans
# or target a port explicitly:
node read.mjs --port /dev/cu.usbserial-XXXX
```

Defaults match the readers' firmware: **500 kbit/s CAN, standard frames,
2 Mbaud USB serial, normal mode.** The readers run `TWAI_TIMING_CONFIG_500KBITS()`,
so the CAN bitrate must stay 500000 or nothing decodes.

### Flags (`read.mjs`)

| Flag | Default | Notes |
|------|---------|-------|
| `--port <path>` | auto-detect | e.g. `/dev/cu.usbserial-1420` |
| `--bitrate <n>` | `500000` | CAN bitrate; must match the readers |
| `--mode <m>` | `normal` | `normal`, `silent` (listen-only), `loopback`, `loopback_and_silent` |
| `--frame <t>` | `STD` | `STD` or `EXT` |
| `--baud <n>` | `2000000` | USB-serial baud (adapter default) |
| `--raw` | off | also print raw `id/dlc/data` hex |

`silent` mode receives without ACKing the bus — useful if you only want to
sniff. `normal` lets the adapter participate (it will ACK frames). With both
readers on the bus they ACK each other, so either mode receives.

## How it works

The USB-CAN-A is a CH340 USB-serial bridge speaking a small binary protocol:

- **Settings command** (fixed 20 bytes): `AA 55 12 <speed> <frame> ...<checksum>`
  configures CAN bitrate / frame type / mode. Sent once on open.
- **Data frames** (variable length): `AA <type> <id LE> <data...> 55`, where
  `type = 0xC0 | (ext<<5) | (rtr<<4) | dlc`. Parsed incrementally.

Decode mirrors the ESP32 receiver: id `0x101/0x102/0x103` → Reader `1/2/3`,
data bytes → ASCII UID (non-zero bytes). Note a CAN frame holds **8 data
bytes**, so only the first 8 characters of a 10-char tag are transmitted —
same as the existing setup.

Code: [`waveshare.mjs`](waveshare.mjs) (protocol), [`ports.mjs`](ports.mjs)
(detection), [`read.mjs`](read.mjs) (CLI). `node selftest.mjs` runs hardware-free
checks of the protocol.

## Troubleshooting

**`No USB-CAN-A adapter detected` / not in `npm run list`.**
First confirm macOS even sees the USB device:

```bash
system_profiler SPUSBDataType | grep -iA6 -e CH34 -e serial -e CAN
```

- **Nothing at all shows up** → it's a physical/enumeration problem, not
  software. Check the USB cable is a **data** cable (not charge-only), try a
  different port / direct (no hub), and reseat the adapter. The Mac must list
  the device here before any port appears.
- **The USB device shows but no `/dev/cu.*` port exists** → the CH340 VCP
  driver isn't bound. Install WCH's macOS driver (CH34xVCPDriver), reboot, and
  re-check. After that a `/dev/cu.usbserial-*` (or `wchusbserial`) port appears.

**Port opens but no output when scanning.** Bitrate mismatch is the usual
cause — confirm `--bitrate 500000`. Use `--raw` to see whether any frames
arrive at all. If raw frames arrive with unexpected ids, the readers' `NODE_ID`
may differ from `0x101/0x102`.
