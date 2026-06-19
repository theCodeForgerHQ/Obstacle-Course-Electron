# RFID-over-CAN debug log (checkpoint — current accurate state)

## Goal
Get RFID reader band UIDs onto the laptop. Reader (ESP32 + RFID + NeoPixel + CAN transceiver, on SMPS power) → CAN bus → a receiver → laptop serial.

## CORRECTED understanding (important — earlier notes were wrong)
- The **reader** and the **receiver** legitimately use **OPPOSITE CAN pins** because each ESP is wired to its own transceiver differently. This is NOT a bug:
  - **Reader firmware:** `CAN_TX=GPIO16, CAN_RX=GPIO17`  (NORMAL mode, 500k)
  - **Receiver firmware:** `CAN_TX=GPIO17, CAN_RX=GPIO16` (NORMAL mode, 500k)
- An earlier "pin fix" (changing the reader to TX17/RX16) was WRONG and broke the reader. **Reader must stay TX16/RX17.** Both are now flashed with the user's EXACT original code (`firmware/reader_original`, `firmware/receiver_orig`).
- This exact code + setup **worked a day ago** (reader → ESP receiver, no USB module involved).

## What works
- **Reader transmits fine.** With original code it reads bands (`UID: 4100B82E6F`) and queues CAN frames. Serial shows `CAN Sent` x6 then `CAN Failed` — that's the TX buffer (~6 deep) filling because **nothing ACKs** = receiver not hearing it. (`CAN Sent` = queued, NOT received.)
- **USB-CAN-A module receives reliably** — proved with 83 frames from a plain ESP+SN65HVD230 transmitter. The module is robust (TVS-protected) and tolerates bridging SMPS ground ↔ laptop USB ground.
- read.mjs decodes module output into `Reader N UID:` (auto-detects module by vid 1a86).

## THE BLOCKER (current)
The **bare ESP receiver (plain ESP + SN65HVD230) cannot tolerate the common-ground tie** needed for CAN:
- CAN requires a shared ground between the reader (SMPS) and receiver (laptop USB) — non-negotiable physics; without it the differential is out of range and nothing decodes ("CAN Failed").
- BUT tying the bare ESP's GND → SMPS −V electrically disrupts it: first produced **66k lines of garbage serial in 6s**, then the ESP **dropped off USB entirely**. Laptop on battery did not fix it.
- So: without the ground tie → receiver hears nothing; with it → bare ESP gets knocked out. The bare ESP is the weak link.

## RECOMMENDED PATH (next session)
Use the **USB-CAN module as the laptop receiver** instead of the bare ESP — it is proven to receive and is robust to the ground bridging:
1. Reader: keep `reader_original` (TX16/RX17), on SMPS.
2. Wire reader CANH/CANL → **module** CANH/CANL. Module **GND → SMPS −V**. Module **USB → laptop**.
3. Module 120Ω jumper ON. Reader board likely has its own 120Ω too.
4. Laptop: `cd usb-can && node read.mjs` → scan band → `Reader 1 UID: 4100B82E...` (note: only first 8 chars fit in a CAN frame; full UID is 10 chars `4100B82E6F`).
- If reader→module still 0: it was failing earlier only because the reader had the WRONG pins (TX17/RX16) then. Now it's TX16/RX17 (correct) and proven to transmit, so retest fresh.

## Alt if they insist on the ESP receiver (reproduce yesterday)
The ground tie disruption suggests a ground-loop/potential issue that wasn't present yesterday. Options: power the receiver ESP from the SAME SMPS as the reader (inherent shared ground), or use a USB isolator between laptop and receiver ESP. Verify the bare ESP doesn't drop off USB once grounded before trusting results.

## reader_v2 (the user's desired reader firmware — serial test PASSED)
`firmware/reader_v2`: idle LEDs red @ 15% brightness, green on read, serial `Reader N | UID: <band> | Time: <ms>`. Works on serial. NOTE: reader_v2 currently has CAN pins TX17/RX16 — **must change to TX16/RX17** before using on the real bus. (timestamp is uptime ms; stamp real time on the laptop side for the leaderboard.)

## Toolchain / ports / flashing
- `arduino-cli` (esp32:esp32 core 3.3.10) + `esptool` (pipx). NeoPixel lib installed.
- **Plain ESP** = CP2102 (vid 10c4, `usbserial-0001`), auto-reset → flash directly, no BOOT dance. (This is the one that drops off when grounded.)
- **Reader** = FTDI (vid 0403, `usbserial-A5XK3RJT`), NO auto-reset → hold BOOT, tap EN, release BOOT to flash; tap EN alone to boot after flashing.
- **USB-CAN module** = CH340 (vid 1a86, port number varies e.g. usbserial-140/1140).
- Flash: `esptool --port <p> --baud 460800 write-flash 0x0 <merged.bin>` (use 115200 for the FTDI reader).
- Built bins: reader_original → /tmp/origbuild, receiver_orig → /tmp/rxorig, reader_v2 → /tmp/v2build.

## Monitors (node, in usb-can/)
- `read.mjs --port <module>` — decode module → `Reader N UID:`.
- `monorig.mjs` — show receiver ESP (10c4) + reader (0403) serials side by side.
- `modsniff.mjs` / `monfinal.mjs` — raw + decoded module output (needs settings cmd).
- `loopback.mjs` — module internal loopback self-test (controller+USB sanity).

## Waveshare USB-CAN-A facts
- Serial 2 Mbaud default; CAN code 0x03 = 500k. Variable frame: `AA <type=0xC0|dlc> <id LE> <data> 55`.
- Saves settings across power-off; reset button (hold during power-on) restores factory.
- Module GND tie to the CAN reference IS required for it to receive across power domains.
- Docs: https://www.waveshare.com/wiki/USB-CAN-A
