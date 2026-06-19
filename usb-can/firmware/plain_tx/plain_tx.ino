// Plain ESP32 + SN65HVD230 transceiver -> USB-CAN module.
// Clean, isolated CAN transmitter to prove the module receives external frames.
// NO_ACK + self-healing so it transmits continuously regardless of the bus.
//
// Wiring (ESP32 <-> transceiver):
//   ESP 3V3   -> transceiver 3.3
//   ESP GND   -> transceiver GND  (and module -V/GND: common ground!)
//   ESP GPIO21 -> transceiver "CAN TX"
//   ESP GPIO22 -> transceiver "CAN RX"
//   transceiver CANH -> module CANH (yellow)
//   transceiver CANL -> module CANL (green)

#include "driver/twai.h"

#define NODE_ID 0x101
#define CAN_TX GPIO_NUM_21
#define CAN_RX GPIO_NUM_22

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
  Serial.println("\n=== Plain ESP32 CAN transmitter (GPIO21=TX, GPIO22=RX, NO_ACK, 500k) ===");
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
                s.state == TWAI_STATE_RUNNING ? "RUNNING" : s.state == TWAI_STATE_BUS_OFF ? "BUS_OFF" : "OTHER",
                (unsigned)s.tx_error_counter);
  delay(300);
}
