// Plain ESP32 + transceiver CAN RECEIVER (TX17/RX16, NORMAL, 500k).
// Used to test the OTHER direction: does the USB-CAN module's transmit reach us?
#include "driver/twai.h"
#define CAN_TX GPIO_NUM_17
#define CAN_RX GPIO_NUM_16

void setup()
{
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== Plain ESP32 CAN RECEIVER (TX17/RX16, NORMAL, 500k) ===");
  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX, CAN_RX, TWAI_MODE_NORMAL);
  twai_timing_config_t t = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  Serial.printf("install=%s start=%s\n",
                esp_err_to_name(twai_driver_install(&g, &t, &f)),
                esp_err_to_name(twai_start()));
  Serial.println("waiting for frames...");
}

void loop()
{
  twai_message_t m;
  if (twai_receive(&m, pdMS_TO_TICKS(1000)) == ESP_OK) {
    Serial.printf("GOT id=0x%X dlc=%d data=", m.identifier, m.data_length_code);
    for (int i = 0; i < m.data_length_code; i++) Serial.printf("%02X ", m.data[i]);
    Serial.println();
  }
}
