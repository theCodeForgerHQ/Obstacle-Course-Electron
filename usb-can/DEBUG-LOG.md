# RFID-over-CAN — what was wrong and how it was fixed

Authoritative reference for the working setup. Topology:

```
Reader (ESP32 + 125 kHz RFID + CAN transceiver, on SMPS power)
   -> CAN bus (CANH/CANL + shared ground)
   -> Waveshare USB-CAN-A module (on laptop USB)
   -> laptop  (node read.mjs)
```

**End state: working.** A band scan produces a clean record on the laptop with
`reader`, full 10-char `uid`, and a `time`. Firmware: `firmware/reader_pro`.
Receiver: `read.mjs`.

---

## The four problems we hit (in order) and the fixes

### 1. `CAN Failed` on the reader, nothing on the laptop
**Cause:** the Waveshare module only goes bus-active (and **ACKs** frames) once
`read.mjs` has sent it the settings command putting it in **500k / normal** mode.
With nothing configuring the module, the reader transmitted into a bus with no
ACK; its TX buffer (~6 deep) filled and it printed `CAN Failed`.
**Fix:** run `read.mjs` (normal mode) — the module then ACKs and the reader shows
`CAN Sent`. `CAN Sent` only means *queued+ACKed*, not *received by software*.

### 2. UID truncated to 8 characters
**Cause:** the original firmware sent the UID as **ASCII** (`"4100BB0845"` =
10 bytes) but a classic CAN frame holds only **8 data bytes**, so the last 2 chars
were dropped. Two bands differing only in their last chars would collide.
**Fix:** pack the 10 hex chars into **5 raw bytes** (`41 00 BB 08 45`). The laptop
unpacks them back to the full 10-char string. Reader id rides in the CAN
arbitration id (`0x100 + reader#`), costing no data bytes.

### 3. Reader stuck — `TX ESP_ERR_INVALID_STATE`
**Cause:** during testing the module was repeatedly stopped/restarted; while it
wasn't ACKing, the reader's TX-error counter climbed past 255 and the TWAI
controller went **BUS_OFF and stopped**. The firmware had **no recovery**, so it
stayed dead (couldn't even queue a frame) until a manual reset.
**Fix:** `canRecover()` runs every loop: `BUS_OFF -> twai_initiate_recovery()`,
`STOPPED -> twai_start()`. The reader now self-heals from a quiet/ACK-less bus —
important in the field if the laptop ever disconnects.

### 4. With laptop time-sync ON, the laptop received nothing
We first tried giving the reader real time by having the **laptop broadcast a
time-sync frame** on the bus (so the reader could stamp absolute time). The moment
`read.mjs` started transmitting, **all reception stopped** — the reader showed
`TX ESP_OK` but no frames reached the laptop, and the reader never saw the sync.
**Cause:** the cheap **Waveshare USB-CAN-A is effectively half-duplex** — it stops
relaying received frames over USB while it is transmitting. Confirmed by toggling:
sync off → frames flow again immediately (with backlog flush); sync on → silence.
**Fix:** the laptop **never transmits**. It is receive-only on the bus.

---

## Time: how it's handled (and why)

The ESP32 readers have **no RTC**, and problem 4 rules out laptop→bus sync on this
module. So:

- The reader stamps each scan with its **own `millis()`** at capture and ships it
  in the frame (bytes 5..7, uint24). This is carried as `reader_ms` — it reflects
  *when the band was actually read*, robust to delivery delay.
- The laptop stamps `time` / `epoch_ms` with **its own wall-clock on arrival**.
  With the receiver always running, arrival ≈ capture within a few ms of CAN/USB
  latency (verified: records land exactly on the reader's 3 s debounce cadence).
- If sub-ms-exact capture spacing is ever needed, the laptop can map
  `reader_ms -> epoch` (offset = min observed `arrival - reader_ms`, the NTP trick)
  with **no firmware change** — the data is already in every frame.

Originally the user asked for absolute reader-side time; we settled on laptop-side
stamping after confirming the module can't do bidirectional traffic. The reader
clock is preserved in the frame so the door stays open.

---

## Frame format (reader_pro -> laptop)

Standard CAN frame, `dlc 8`, arbitration id = `0x100 + READER_NUM`:

| bytes | field | notes |
|-------|-------|-------|
| 0..4  | UID   | 5 raw bytes = full 10 hex chars |
| 5..7  | reader millis | low 24 bits, little-endian, wraps ~4.66 h |

Laptop record: `{ reader, uid, time, epoch_ms, reader_ms, can_id }` → stdout (JSON),
appended to `events.jsonl`. Human summary → stderr.

---

## Hardware / toolchain facts

- **Reader** = FTDI board (vid 0403, e.g. `usbserial-A5XK3RJT`), **no auto-reset**:
  hold `BOOT`, tap `EN`, release `BOOT` to enter download mode; tap `EN` to boot.
  Flash at 115200: `esptool --port <p> --baud 115200 write-flash 0x0 reader_pro.ino.merged.bin`.
- **Module** = CH340 (vid 1a86, e.g. `usbserial-140`). Auto-detected by `ports.mjs`.
- **CAN pins on this reader board:** `CAN_TX=GPIO16, CAN_RX=GPIO17`, 500k, NORMAL.
  (Do not swap — these are proven correct for this board.)
- A **shared ground** between the reader's SMPS and the laptop USB is required for
  CAN; the module tolerates the ground bridge fine (it's TVS-protected).
- Build: `arduino-cli compile --fqbn esp32:esp32:esp32 --build-path /tmp/probuild firmware/reader_pro`
  (esp32 core 3.3.10, Adafruit NeoPixel lib).
- Waveshare protocol: serial 2 Mbaud; settings code `0x03` = 500k; variable data
  frame `AA <type=0xC0|dlc> <id LE> <data> 55`. Docs:
  https://www.waveshare.com/wiki/USB-CAN-A

## Adding more readers

Set a unique `READER_NUM` per unit (2, 3, …) → CAN id `0x102`, `0x103`. They all
share the one bus; the module receives all of them; `read.mjs` decodes `reader`
from the id automatically. No laptop change needed.
