// CAN pin-mapping test — run with the reader ALONE on the bus.
//
// Both readers showed the same "RX stuck dominant" error storm. The reader and
// receiver sketches use OPPOSITE CAN pin assignments, so this checks whether the
// firmware's TX/RX pins are swapped relative to how the board is actually wired.
//
// It configures the TWAI controller twice — once each way — transmits a few
// frames in NO_ACK mode, and prints the error counters.
//
//   * The mapping with LOW bus_err/arb_lost and tx=ESP_OK is the CORRECT wiring.
//   * If BOTH mappings show huge bus_err/arb_lost, the pins are fine and the
//     fault is the transceiver itself (no power / standby pin / broken CANH-CANL).

#include "driver/twai.h"

void testMapping(gpio_num_t tx, gpio_num_t rx, const char *name)
{
  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT(tx, rx, TWAI_MODE_NO_ACK);
  twai_timing_config_t t = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f = TWAI_FILTER_CONFIG_ACCEPT_ALL();

  esp_err_t inst = twai_driver_install(&g, &t, &f);
  esp_err_t st = twai_start();
  Serial.printf("\n--- Mapping %s (CAN_TX=GPIO%d, CAN_RX=GPIO%d) install=%s start=%s ---\n",
                name, (int)tx, (int)rx, esp_err_to_name(inst), esp_err_to_name(st));

  for (int k = 0; k < 8; k++) {
    twai_message_t m = {};
    m.identifier = 0x101;
    m.data_length_code = 8;
    for (int j = 0; j < 8; j++) m.data[j] = 'A' + j;

    esp_err_t r = twai_transmit(&m, pdMS_TO_TICKS(50));
    delay(200);

    twai_status_info_t s;
    twai_get_status_info(&s);
    Serial.printf("  tx#%d=%-14s bus_err=%u arb_lost=%u TEC=%u REC=%u tx_q=%u\n",
                  k, esp_err_to_name(r),
                  (unsigned)s.bus_error_count, (unsigned)s.arb_lost_count,
                  (unsigned)s.tx_error_counter, (unsigned)s.rx_error_counter,
                  (unsigned)s.msgs_to_tx);
  }

  twai_stop();
  twai_driver_uninstall();
}

void setup()
{
  Serial.begin(115200);
  delay(400);
  Serial.println("\n=== CAN pin-mapping test (reader ALONE on bus) ===");
  Serial.println("Correct mapping => bus_err/arb_lost stay LOW and tx=ESP_OK.");

  testMapping(GPIO_NUM_16, GPIO_NUM_17, "A: reader-sketch  TX16/RX17");
  delay(500);
  testMapping(GPIO_NUM_17, GPIO_NUM_16, "B: receiver-sketch TX17/RX16");

  Serial.println("\n=== done. Lower-error mapping = correct wiring. ===");
  Serial.println("(If BOTH are high -> transceiver power/standby/wiring fault, not pins.)");
}

void loop() {}
