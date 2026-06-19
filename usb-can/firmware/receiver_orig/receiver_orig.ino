#include "driver/twai.h"

#define CAN_TX GPIO_NUM_17
#define CAN_RX GPIO_NUM_16

void setup()
{
  Serial.begin(115200);

  twai_general_config_t g_config =
      TWAI_GENERAL_CONFIG_DEFAULT(
          CAN_TX,
          CAN_RX,
          TWAI_MODE_NORMAL);

  twai_timing_config_t t_config =
      TWAI_TIMING_CONFIG_500KBITS();

  twai_filter_config_t f_config =
      TWAI_FILTER_CONFIG_ACCEPT_ALL();

  twai_driver_install(&g_config,&t_config,&f_config);
  twai_start();

  Serial.println("CAN Receiver Ready");
}

void loop()
{
  twai_message_t msg;

  if(twai_receive(&msg,pdMS_TO_TICKS(1000)) == ESP_OK)
  {
    Serial.print("Reader ");

    if(msg.identifier == 0x101)
      Serial.print("1");
    else if(msg.identifier == 0x102)
      Serial.print("2");
    else if(msg.identifier == 0x103)
      Serial.print("3");
    else
      Serial.print("?");

    Serial.print(" UID: ");

    for(int i=0;i<msg.data_length_code;i++)
    {
      if(msg.data[i] != 0)
        Serial.write(msg.data[i]);
    }

    Serial.println();
  }
}
