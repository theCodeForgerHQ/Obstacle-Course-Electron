// Reader PRO — professional RFID checkpoint reader for the obstacle course.
//
// Emits, per band scan, a single 8-byte CAN frame that the laptop turns into a
// clean DB record { reader_id, uid, capture_time }:
//
//   CAN ID  = 0x100 + READER_NUM        -> reader_id  (1, 2, 3, ...)
//   data[0..4] = UID packed as 5 raw bytes  -> full 10-hex-char UID (no truncation)
//   data[5..7] = millis() & 0xFFFFFF        -> reader capture clock (uint24 LE, ms)
//   dlc        = 8
//
// REAL TIME WITHOUT AN RTC (the ESP32 has none):
//   The reader stamps every scan with its own monotonic millis() at the instant
//   the band is read. The laptop is the time authority: it continuously learns
//   offset = epoch - reader_millis (from the minimum observed arrival latency)
//   and reconstructs the TRUE capture instant = reader_millis + offset. Because
//   the timestamp is the reader's clock, it reflects WHEN the band was scanned,
//   not when the frame happened to be delivered (robust to bursts / retries).
//
//   The 24-bit millis field wraps every ~4.66 h; the laptop reconstructs the
//   full timeline and re-anchors if the reader reboots (millis resets). This
//   design needs NO frame FROM the laptop, because the Waveshare USB-CAN-A
//   module cannot relay received frames while it is transmitting (half-duplex).
//
// Hardware: ESP32 + 125 kHz RFID (Serial2) + NeoPixel ring + CAN transceiver,
// powered from the SMPS. CAN pins TX16/RX17, 500 kbit, NORMAL mode (proven-correct
// pins for this reader board — do not swap).

#include <Adafruit_NeoPixel.h>
#include "driver/twai.h"

#define READER_NUM 1                       // Reader 1, 2, 3, ... (unique per unit)
#define SCAN_CAN_ID (0x100 + READER_NUM)   // arbitration id carries the reader id

#define LED_PIN     4
#define NUM_LEDS    24
#define BRIGHTNESS  38                      // ~15% idle brightness

#define RFID_RX_PIN 13

#define CAN_TX GPIO_NUM_16                  // proven-correct mapping for this board
#define CAN_RX GPIO_NUM_17

#define DEBOUNCE_MS  3000                   // ignore same band re-read within 3 s
#define UID_HEX_LEN  10                     // 125 kHz EM4100 UID = 10 hex chars = 5 bytes

Adafruit_NeoPixel pixels(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);
HardwareSerial RFIDSerial(2);

String lastUID = "";
unsigned long lastReadTime = 0;

void fill(uint8_t r, uint8_t g, uint8_t b)
{
  for (int i = 0; i < NUM_LEDS; i++) pixels.setPixelColor(i, pixels.Color(r, g, b));
  pixels.show();
}

// Pack a 10-char hex UID string into 5 bytes. Returns false on malformed input.
bool packUid(const String &uid, uint8_t out[5])
{
  if (uid.length() != UID_HEX_LEN) return false;
  auto nib = [](char c) -> int {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
  };
  for (int i = 0; i < 5; i++) {
    int hi = nib(uid[i * 2]);
    int lo = nib(uid[i * 2 + 1]);
    if (hi < 0 || lo < 0) return false;
    out[i] = (uint8_t)((hi << 4) | lo);
  }
  return true;
}

// Self-heal the CAN controller. If the bus is quiet (e.g. the laptop receiver is
// not running) the reader's TX errors climb until it goes BUS_OFF and stops.
//   BUS_OFF -> initiate recovery (controller re-syncs to the bus)
//   STOPPED -> recovery finished (or never started) -> start running again
void canRecover()
{
  twai_status_info_t s;
  if (twai_get_status_info(&s) != ESP_OK) return;
  if (s.state == TWAI_STATE_BUS_OFF) {
    twai_initiate_recovery();
  } else if (s.state == TWAI_STATE_STOPPED) {
    twai_start();
  }
}

void sendScan(const String &uid, uint32_t captureMs)
{
  uint8_t packed[5];
  if (!packUid(uid, packed)) {
    Serial.printf("UID malformed, not sent: %s\n", uid.c_str());
    return;
  }

  uint32_t ms24 = captureMs & 0xFFFFFF;      // low 24 bits of the capture clock

  twai_message_t m = {};
  m.identifier = SCAN_CAN_ID;
  m.extd = 0;
  m.rtr = 0;
  m.data_length_code = 8;
  m.data[0] = packed[0];
  m.data[1] = packed[1];
  m.data[2] = packed[2];
  m.data[3] = packed[3];
  m.data[4] = packed[4];
  m.data[5] = (uint8_t)(ms24 & 0xFF);        // uint24 LE
  m.data[6] = (uint8_t)((ms24 >> 8) & 0xFF);
  m.data[7] = (uint8_t)((ms24 >> 16) & 0xFF);

  esp_err_t r = twai_transmit(&m, pdMS_TO_TICKS(100));
  Serial.printf("Reader %d | UID: %s | t=%lums | TX %s\n",
                READER_NUM, uid.c_str(), (unsigned long)captureMs, esp_err_to_name(r));
}

bool readTag(String &uid)
{
  static String buffer = "";
  while (RFIDSerial.available()) {
    char c = RFIDSerial.read();
    if (c == 0x02) {
      buffer = "";
    } else if (c == 0x03) {
      if (buffer.length() >= UID_HEX_LEN) {
        uid = buffer.substring(0, UID_HEX_LEN);
        return true;
      }
    } else {
      buffer += c;
    }
  }
  return false;
}

void setup()
{
  Serial.begin(115200);
  delay(200);

  pixels.begin();
  pixels.setBrightness(BRIGHTNESS);
  fill(255, 0, 0);                           // idle red

  RFIDSerial.begin(9600, SERIAL_8N1, RFID_RX_PIN, -1);

  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX, CAN_RX, TWAI_MODE_NORMAL);
  twai_timing_config_t  t = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t  f = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  twai_driver_install(&g, &t, &f);
  twai_start();

  Serial.printf("Reader %d PRO ready (CAN id 0x%03X, 500k)\n", READER_NUM, SCAN_CAN_ID);
}

void loop()
{
  canRecover();                              // auto-heal from bus-off (quiet bus)

  String uid;
  if (readTag(uid)) {
    uint32_t ts = millis();                  // capture instant on the reader's clock
    if (uid == lastUID && ts - lastReadTime < DEBOUNCE_MS) return;
    lastUID = uid;
    lastReadTime = ts;

    fill(0, 255, 0);                         // green on read
    sendScan(uid, ts);
    delay(400);
    fill(255, 0, 0);                         // back to idle red
  }
}
