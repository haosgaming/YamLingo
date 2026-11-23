import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPSPadCliCommand,
  formatYamlForPSPad,
  generatePSPadClipsDef,
  PSPAD_RECOMMENDED_SETTINGS,
} from './pspad';

test('formatYamlForPSPad normalizes line endings to LF and CRLF cleanly', () => {
  const mixed = 'a: 1\r\nb: 2\nc: 3';
  assert.equal(formatYamlForPSPad(mixed, 'lf'), 'a: 1\nb: 2\nc: 3\n');
  assert.equal(formatYamlForPSPad(mixed, 'crlf'), 'a: 1\r\nb: 2\r\nc: 3\r\n');
});

test('buildPSPadCliCommand includes jump-to-line flag when positive line given', () => {
  const cmdWithLine = buildPSPadCliCommand({
    exePath: 'C:\\Program Files\\PSPad editor\\PSPad.exe',
    filePath: 'D:\\HA\\configuration.yaml',
    line: 4,
  });
  assert.equal(
    cmdWithLine,
    '"C:\\Program Files\\PSPad editor\\PSPad.exe" -4 "D:\\HA\\configuration.yaml"'
  );

  const cmdNoLine = buildPSPadCliCommand({
    exePath: '',
    filePath: '',
  });
  assert.ok(cmdNoLine.includes('PSPad.exe'));
  assert.ok(cmdNoLine.includes('configuration.yaml'));
  assert.ok(!cmdNoLine.includes(' -'));
});

test('generatePSPadClipsDef returns valid PSPad Macro definition clips for HA & ESPHome', () => {
  const def = generatePSPadClipsDef();
  assert.ok(def.includes('[Macro definition]'));
  assert.ok(def.includes('[ha_auto |'));
  assert.ok(def.includes('[esp_bme280 |'));
  assert.ok(def.includes('target:'));
  assert.ok(PSPAD_RECOMMENDED_SETTINGS.length >= 4);
});
