// Reader A — DIAGNOSTIC firmware (temporary).
//
// Goal: isolate whether the CAN problem is "no node ACKs us / bus-off" vs a
// physical open between this reader and the rest of the bus.
//
// Differences from the original:
//   * TWAI_MODE_NO_ACK  -> the controller transmits and does NOT require an
//     acknowledgment, so it never goes bus-off from a missing ACK and keeps
//     driving clean frames onto the bus. A correctly-wired receiver (the
//     USB-CAN-A) will still see these frames.
//   * Transmits a heartbeat frame (id 0x101, "DIAGnnnn") every 500 ms, so the
//     adapter has a continuous stream to catch with no tag scanning needed.
//   * Prints the controller status every cycle: state, TX/RX error counters,
//     and bus error / arbitration-lost / tx-fail counts.
//
// Interpretation with the adapter listening (node read.mjs):
//   A) Adapter prints "Reader 1 UID: DIAGnnnn"      -> bus path is GOOD; the
//      original failure was the ACK/bus-off dynamic (need an ACKing node).
//   B) Adapter prints nothing, reader state=RUNNING, TEC=0
//                                                  -> frames are driven but not
//      arriving: a physical OPEN between this reader's CANH/CANL and the adapter.
//   C) Reader TEC climbs / state=BUS_OFF even in NO_ACK / bus_error_count rises
//                                                  -> bus integrity fault at this
//      node's transceiver (shorted/floating CANH-CANL, no termination, bad xcvr).

#include "driver/twai.h"

#define NODE_ID 0x101
#define CAN_TX GPIO_NUM_16
#define CAN_RX GPIO_NUM_17

unsigned long lastTx = 0;
unsigned long seq = 0;

void printStatus(const char *tag)
{
  twai_status_info_t s;
  if (twai_get_status_info(&s) != ESP_OK) {
    Serial.printf("%s: status read FAILED\n", tag);
    return;
  }
  const char *st = s.state == TWAI_STATE_RUNNING     ? "RUNNING"
                 : s.state == TWAI_STATE_BUS_OFF      ? "BUS_OFF"
                 : s.state == TWAI_STATE_RECOVERING   ? "RECOVERING"
                                                      : "STOPPED";
  Serial.printf("%s state=%s TEC=%u REC=%u tx_q=%u tx_fail=%u bus_err=%u arb_lost=%u\n",
                tag, st,
                (unsigned)s.tx_error_counter, (unsigned)s.rx_error_counter,
                (unsigned)s.msgs_to_tx, (unsigned)s.tx_failed_count,
                (unsigned)s.bus_error_count, (unsigned)s.arb_lost_count);
}

void setup()
{
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== Reader A DIAGNOSTIC firmware (TWAI_MODE_NO_ACK, 500k) ===");

  twai_general_config_t g_config =
      TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX, CAN_RX, TWAI_MODE_NO_ACK);
  twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

  Serial.printf("driver_install: %s\n",
                esp_err_to_name(twai_driver_install(&g_config, &t_config, &f_config)));
  Serial.printf("twai_start: %s\n", esp_err_to_name(twai_start()));
  printStatus("init");
  Serial.println("Transmitting heartbeat every 500 ms...");
}

void loop()
{
  if (millis() - lastTx >= 500) {
    lastTx = millis();

    twai_message_t msg = {};
    msg.identifier = NODE_ID;
    msg.extd = 0;
    msg.rtr = 0;
    msg.data_length_code = 8;

    char buf[9];
    snprintf(buf, sizeof(buf), "DIAG%04lu", seq % 10000);
    for (int i = 0; i < 8; i++) msg.data[i] = (uint8_t)buf[i];
    seq++;

    esp_err_t r = twai_transmit(&msg, pdMS_TO_TICKS(50));
    Serial.printf("TX seq=%lu id=0x%03X data=%s -> %s\n",
                  seq, NODE_ID, buf, esp_err_to_name(r));
    printStatus("  post-tx");
  }
}
