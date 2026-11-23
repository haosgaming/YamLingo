export type LineEndingMode = 'lf' | 'crlf';

export interface PSPadSettingItem {
  section: string;
  setting: string;
  value: string;
  reason: string;
}

export const PSPAD_RECOMMENDED_SETTINGS: PSPadSettingItem[] = [
  {
    section: 'Nastavení programu → Editor - chování',
    setting: 'Reálné tabulátory',
    value: 'Vypnuto (převádět na mezery)',
    reason: 'YAML zakazuje znak Tab pro odsazování bloků.',
  },
  {
    section: 'Nastavení programu → Editor - chování',
    setting: 'Šířka tabulátoru / Odsazení',
    value: '2 mezery',
    reason: 'Standardní odsazování v Home Assistant a ESPHome.',
  },
  {
    section: 'Formát → Kódování',
    setting: 'UTF-8 (bez BOM)',
    value: 'UTF-8',
    reason: 'HA parser odmítá soubory s Windows-1250 nebo UTF-8 BOM hlavičkou.',
  },
  {
    section: 'Formát → Konec řádků',
    setting: 'Konec řádku',
    value: 'UNIX (LF)',
    reason: 'Linuxové servery Home Assistant očekávají LF (\\n).',
  },
];

export function formatYamlForPSPad(
  yaml: string,
  lineEnding: LineEndingMode = 'lf'
): string {
  const normalized = yaml.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const withTrailingNewline = normalized.endsWith('\n')
    ? normalized
    : `${normalized}\n`;

  if (lineEnding === 'crlf') {
    return withTrailingNewline.replace(/\n/g, '\r\n');
  }
  return withTrailingNewline;
}

export function buildPSPadCliCommand(params: {
  exePath: string;
  filePath: string;
  line?: number;
}): string {
  const exe = params.exePath.trim() || 'C:\\Program Files\\PSPad editor\\PSPad.exe';
  const file = params.filePath.trim() || 'C:\\HomeAssistant\\configuration.yaml';
  const linePart =
    typeof params.line === 'number' && Number.isFinite(params.line) && params.line > 0
      ? ` -${Math.floor(params.line)}`
      : '';
  return `"${exe}"${linePart} "${file}"`;
}

export function generatePSPadClipsDef(): string {
  return `; PSPad Clip definition file for Home Assistant & ESPHome YAML
; Uložte do složky: <PSPad>\\Context\\YAML.DEF
; Vyvolání v PSPadu: Ctrl + Mezerník
;
[Macro definition]
;
[ha_auto | Home Assistant Automatizace (target: entity_id)]
alias: "|Název automatizace"
description: ""
mode: single
trigger:
  - platform: state
    entity_id: binary_sensor.pohyb
    to: "on"
condition: []
action:
  - service: light.turn_on
    target:
      entity_id: light.obyvak
;
[ha_template | Home Assistant Template Sensor (Jinja2)]
template:
  - sensor:
      - name: "|Název senzoru"
        unit_of_measurement: "°C"
        state: "{{ states('sensor.obyvak_teplota') }}"
;
[ha_if | Jinja2 podmínka {% if %}]
{% if states('|sensor.teplota') | float(0) > 24 %}
  Větrej!
{% else %}
  Pohoda
{% endif %}
;
[esp_base | ESPHome Základní deska ESP32]
esphome:
  name: |moje-deska

esp32:
  board: esp32dev

wifi:
  ssid: "MojeSit"
  password: "TajneHeslo"

ota:
  - platform: esphome
;
[esp_gpio_led | ESPHome GPIO LED výstup]
output:
  - platform: gpio
    pin: GPIO2
    id: |led_pin

light:
  - platform: binary
    name: "Stavová LED"
    output: led_pin
;
[esp_bme280 | ESPHome I2C & BME280 senzor]
i2c:
  sda: GPIO21
  scl: GPIO22

sensor:
  - platform: bme280_i2c
    address: 0x76
    temperature:
      name: "|Teplota"
      filters:
        - median:
            window_size: 5
;
[esp_mqtt | ESPHome MQTT Broker]
mqtt:
  broker: |192.168.1.10
  topic_prefix: dum/obyvak
;
`;
}
