import test from 'node:test';
import assert from 'node:assert/strict';
import * as yaml from 'js-yaml';
import { analyzeYaml } from './yamlValidator';
import {
  buildExportableYaml,
  detectDefaultExportTarget,
  ensureYamlExtension,
  slugifyYamlFilename,
  suggestExportFilename,
} from './yamlExport';

test('slugifyYamlFilename converts Czech diacritics and spaces cleanly', () => {
  assert.equal(slugifyYamlFilename('Světlo na chodbě!'), 'svetlo-na-chodbe');
  assert.equal(slugifyYamlFilename('  Příliš žluťoučký kůň  '), 'prilis-zlutoucky-kun');
  assert.equal(ensureYamlExtension('lampicka'), 'lampicka.yaml');
  assert.equal(ensureYamlExtension('moje.yml'), 'moje.yml');
});

test('detectDefaultExportTarget prioritizes YAML root keys then lesson mode', () => {
  assert.equal(
    detectDefaultExportTarget('yaml', { esphome: { name: 'node' } }),
    'esphome'
  );
  assert.equal(
    detectDefaultExportTarget('esphome', { alias: 'Nocni svetlo', trigger: [] }),
    'homeassistant'
  );
  assert.equal(detectDefaultExportTarget('esphome', {}), 'esphome');
  assert.equal(detectDefaultExportTarget('ha', {}), 'homeassistant');
});

test('suggestExportFilename uses esphome name, alias, or lesson fallback', () => {
  assert.equal(
    suggestExportFilename({
      target: 'esphome',
      parsed: { esphome: { name: 'čidlo-chodba' } },
      lessonId: 'w2-2',
      lessonTitle: 'Wi-Fi & OTA',
    }),
    'cidlo-chodba.yaml'
  );
  assert.equal(
    suggestExportFilename({
      target: 'homeassistant',
      parsed: { alias: 'Noční světlo', trigger: [] },
      lessonId: 'w3-2',
      lessonTitle: 'Podmínka',
    }),
    'nocni-svetlo.yaml'
  );
  assert.equal(
    suggestExportFilename({
      target: 'homeassistant',
      parsed: { homeassistant: { name: 'Domov' } },
      lessonId: 'w1-3',
      lessonTitle: 'Slovníky',
    }),
    'configuration.yaml'
  );
});

test('buildExportableYaml creates valid complete ESPHome config when blocks are missing', () => {
  const rawSensorYaml = `sensor:\r\n  - platform: dht\r\n    pin: GPIO4\r\n    temperature:\r\n      name: "Teplota Dilna"`;
  const parsed = yaml.load(rawSensorYaml);
  const result = buildExportableYaml({
    code: rawSensorYaml,
    target: 'esphome',
    parsed,
    lessonId: 'w4-2',
    lessonTitle: 'Filtry dat',
    esphomeFormat: 'complete',
  });

  assert.ok(!result.content.includes('\r\n'), 'Must normalize CRLF to LF');
  assert.ok(result.content.endsWith('\n'), 'Must end with trailing newline');
  assert.deepEqual(result.addedSections, [
    'esphome',
    'esp32',
    'logger',
    'api',
    'ota',
    'wifi',
  ]);

  const sanitizedForJsYaml = result.content.replace(/!secret\s+(\S+)/g, '"$1"');
  const reparsed = yaml.load(sanitizedForJsYaml) as Record<string, unknown>;
  assert.ok(reparsed.esphome);
  assert.ok(reparsed.esp32);
  assert.ok(reparsed.wifi);
  assert.ok(Array.isArray(reparsed.sensor));
  const check = analyzeYaml(sanitizedForJsYaml);
  assert.equal(check.validSyntax, true);
});

test('buildExportableYaml does not duplicate existing ESPHome sections', () => {
  const fullEsp = `esphome:\n  name: cidlo\n\nesp32:\n  board: esp32dev\n\nwifi:\n  ssid: "Sit"\n  password: "Heslo"\n\nota:\n  - platform: esphome\n\nlogger:\n\napi:`;
  const result = buildExportableYaml({
    code: fullEsp,
    target: 'esphome',
    parsed: yaml.load(fullEsp),
    lessonId: 'w2-2',
    lessonTitle: 'Wi-Fi',
    esphomeFormat: 'complete',
  });
  assert.deepEqual(result.addedSections, []);
});

test('buildExportableYaml wraps standalone HA automation for packages when requested', () => {
  const autoYaml = `alias: Svetlo na chodbe\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.pohyb_chodba\n    to: "on"\naction:\n  - service: light.turn_on\n    target:\n      entity_id: light.chodba`;
  const result = buildExportableYaml({
    code: autoYaml,
    target: 'homeassistant',
    parsed: yaml.load(autoYaml),
    lessonId: 'w3-1',
    lessonTitle: 'Spouštěč',
    haFormat: 'package',
  });

  assert.equal(result.isAutomationObject, true);
  assert.deepEqual(result.addedSections, ['automation', 'id']);

  const reparsed = yaml.load(result.content) as Record<string, unknown>;
  assert.ok(Array.isArray(reparsed.automation));
  const first = (reparsed.automation as Array<Record<string, unknown>>)[0];
  assert.equal(first.id, 'svetlo_na_chodbe');
  assert.equal(first.alias, 'Svetlo na chodbe');
  assert.ok(Array.isArray(first.trigger));
  assert.ok(Array.isArray(first.action));
});

test('buildExportableYaml keeps existing automation id when wrapping for HA packages', () => {
  const autoWithId = `id: moje_custom_id\nalias: Test\ntrigger:\n  - platform: state\n    entity_id: sensor.a\naction:\n  - service: light.turn_on`;
  const result = buildExportableYaml({
    code: autoWithId,
    target: 'homeassistant',
    parsed: yaml.load(autoWithId),
    lessonId: 'w3-1',
    lessonTitle: 'Test',
    haFormat: 'package',
  });

  const reparsed = yaml.load(result.content) as Record<string, unknown>;
  const first = (reparsed.automation as Array<Record<string, unknown>>)[0];
  assert.equal(first.id, 'moje_custom_id');
  assert.equal(first.alias, 'Test');
});
