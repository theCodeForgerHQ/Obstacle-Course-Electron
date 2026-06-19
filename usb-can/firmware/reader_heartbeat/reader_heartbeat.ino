// Reader — SELF-HEALING CAN heartbeat (correct pins TX17/RX16, NO_ACK, 500k).
// Sends id 0x101 "HBnnnnnn" continuously and re-inits the controller whenever it
// leaves RUNNING (e.g. bus-off while alone), so it NEVER gets stuck. This lets you
// wire the module's CANH/CANL to Reader A live and watch frames appear on the
// laptop the instant the bus is complete (H<->H, L<->L, common ground, 120R term).

#include "driver/twai.h"

#define NODE_ID 0x101
#define CAN_TX GPIO_NUM_17
#define CAN_RX GPIO_NUM_16

unsigned long seq = 0;
twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();
twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

void startCan()
{
  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX, CAN_RX, TWAI_MODE_NO_ACK);
  twai_driver_install(&g, &t_config, &f_config);
  twai_start();
}

void setup()
{
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== Self-healing CAN heartbeat (TX17/RX16, NO_ACK, 500k) ===");
  Serial.println("Wire module CANH<->A CANH, CANL<->A CANL, G<->-V. Frames land on the laptop when complete.");
  startCan();
}

void loop()
{
  twai_status_info_t s;
  if (twai_get_status_info(&s) == ESP_OK && s.state != TWAI_STATE_RUNNING) {
    twai_stop();
    twai_driver_uninstall();
    startCan();
  }

  twai_message_t m = {};
  m.identifier = NODE_ID;
  m.data_length_code = 8;
  char buf[9];
  snprintf(buf, sizeof(buf), "HB%06lu", seq % 1000000UL);
  for (int i = 0; i < 8; i++) m.data[i] = (uint8_t)buf[i];
  seq++;

  esp_err_t r = twai_transmit(&m, pdMS_TO_TICKS(50));
  twai_get_status_info(&s);
  Serial.printf("TX %s = %-12s state=%s TEC=%u\n", buf, esp_err_to_name(r),
                s.state == TWAI_STATE_RUNNING ? "RUNNING" : s.state == TWAI_STATE_BUS_OFF ? "BUS_OFF"
                                                        : s.state == TWAI_STATE_RECOVERING ? "RECOVERING" : "STOPPED",
                (unsigned)s.tx_error_counter);
  delay(300);
}
