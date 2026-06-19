// Reader A — ORIGINAL firmware (verbatim, for restoring after diagnostics).
// NODE_ID 0x101, 125 kHz RFID over Serial2, NeoPixel feedback, CAN @ 500 kbit.
#include <Adafruit_NeoPixel.h>
#include "driver/twai.h"

#define NODE_ID 0x101

#define LED_PIN 4
#define NUM_LEDS 24

#define RFID_RX_PIN 13

#define CAN_TX GPIO_NUM_16
#define CAN_RX GPIO_NUM_17

Adafruit_NeoPixel pixels(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

HardwareSerial RFIDSerial(2);

String lastUID = "";
unsigned long lastReadTime = 0;

void setRed()
{
  for(int i=0;i<NUM_LEDS;i++)
    pixels.setPixelColor(i,pixels.Color(255,0,0));

  pixels.show();
}

void blinkGreen()
{
  for(int j=0;j<3;j++)
  {
    for(int i=0;i<NUM_LEDS;i++)
      pixels.setPixelColor(i,pixels.Color(0,255,0));

    pixels.show();
    delay(250);

    pixels.clear();
    pixels.show();
    delay(250);
  }

  setRed();
}

void sendCAN(String uid)
{
  twai_message_t msg;

  msg.identifier = NODE_ID;
  msg.extd = 0;
  msg.rtr = 0;

  msg.data_length_code = 8;

  for(int i=0;i<8;i++)
  {
    if(i < uid.length())
      msg.data[i] = uid[i];
    else
      msg.data[i] = 0;
  }

  if(twai_transmit(&msg,pdMS_TO_TICKS(100)) == ESP_OK)
  {
    Serial.println("CAN Sent");
  }
  else
  {
    Serial.println("CAN Failed");
  }
}

bool readTag(String &uid)
{
  static String buffer="";

  while(RFIDSerial.available())
  {
    char c = RFIDSerial.read();

    if(c == 0x02)
    {
      buffer="";
    }
    else if(c == 0x03)
    {
      if(buffer.length() >= 10)
      {
        uid = buffer.substring(0,10);
        return true;
      }
    }
    else
    {
      buffer += c;
    }
  }

  return false;
}

void setup()
{
  Serial.begin(115200);

  pixels.begin();
  pixels.setBrightness(128);
  setRed();

  RFIDSerial.begin(9600,SERIAL_8N1,RFID_RX_PIN,-1);

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

  Serial.println("Reader Ready");
}

void loop()
{
  String uid;

  if(readTag(uid))
  {
    if(uid == lastUID && millis()-lastReadTime < 3000)
      return;

    lastUID = uid;
    lastReadTime = millis();

    Serial.print("UID: ");
    Serial.println(uid);

    blinkGreen();

    sendCAN(uid);
  }
}
