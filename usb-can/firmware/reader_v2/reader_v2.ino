// Reader v2 — RFID checkpoint reader.
//   * Idle: all NeoPixels RED at 15% brightness.
//   * On band read: turn GREEN briefly, then back to red.
//   * Serial output: reader id, band UID, and timestamp (ms since boot).
//   * Also sends the UID over CAN (corrected pins TX17/RX16) for when it's on
//     the bus — best-effort, never blocks the serial output.
//
// Note on timestamp: the ESP32 has no real-time clock, so this prints uptime
// (millis). For true wall-clock time on the leaderboard, the laptop should stamp
// each event when it arrives (most accurate), or add NTP/RTC to the reader.

#include <Adafruit_NeoPixel.h>
#include "driver/twai.h"

#define NODE_ID    0x101              // Reader 1 = 0x101, Reader 2 = 0x102, ...
#define READER_NUM (NODE_ID - 0x100)

#define LED_PIN     4
#define NUM_LEDS    24
#define BRIGHTNESS  38                // ~15% of 255

#define RFID_RX_PIN 13

#define CAN_TX GPIO_NUM_17            // corrected mapping for these boards
#define CAN_RX GPIO_NUM_16

Adafruit_NeoPixel pixels(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);
HardwareSerial RFIDSerial(2);

String lastUID = "";
unsigned long lastReadTime = 0;

void fill(uint8_t r, uint8_t g, uint8_t b)
{
  for (int i = 0; i < NUM_LEDS; i++) pixels.setPixelColor(i, pixels.Color(r, g, b));
  pixels.show();
}

void sendCAN(const String &uid)
{
  twai_message_t msg = {};
  msg.identifier = NODE_ID;
  msg.extd = 0;
  msg.rtr = 0;
  msg.data_length_code = 8;
  for (int i = 0; i < 8; i++) msg.data[i] = (i < (int)uid.length()) ? uid[i] : 0;
  twai_transmit(&msg, pdMS_TO_TICKS(50)); // best-effort; ignore result for serial test
}

bool readTag(String &uid)
{
  static String buffer = "";
  while (RFIDSerial.available()) {
    char c = RFIDSerial.read();
    if (c == 0x02) {
      buffer = "";
    } else if (c == 0x03) {
      if (buffer.length() >= 10) {
        uid = buffer.substring(0, 10);
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
  fill(255, 0, 0); // idle red @ 15%

  RFIDSerial.begin(9600, SERIAL_8N1, RFID_RX_PIN, -1);

  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX, CAN_RX, TWAI_MODE_NORMAL);
  twai_timing_config_t t = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  twai_driver_install(&g, &t, &f);
  twai_start();

  Serial.printf("Reader %d ready (idle red @ 15%%, green on read)\n", READER_NUM);
}

void loop()
{
  String uid;
  if (readTag(uid)) {
    unsigned long ts = millis();
    if (uid == lastUID && ts - lastReadTime < 3000) return; // debounce same band 3s
    lastUID = uid;
    lastReadTime = ts;

    fill(0, 255, 0); // green on read
    Serial.printf("Reader %d | UID: %s | Time: %lu ms\n", READER_NUM, uid.c_str(), ts);
    sendCAN(uid);
    delay(500);
    fill(255, 0, 0); // back to idle red
  }
}
