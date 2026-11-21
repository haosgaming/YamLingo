import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeYaml,
  autoFixYaml,
  computeLineDiff,
  evaluateJinjaPreview,
} from './yamlValidator';
import { LESSONS } from './curriculum';

test('detects tab indentation and odd space indentation with human Czech messages', () => {
  const broken = `homeassistant:\n\tname:Test\n   unit_system: metric`;
  const result = analyzeYaml(broken);
  assert.equal(result.diagnostics.some((d) => d.code === 'TAB_INDENT'), true);
  assert.equal(result.diagnostics.some((d) => d.code === 'ODD_INDENT'), true);
  assert.equal(result.diagnostics.some((d) => d.code === 'MISSING_SPACE_AFTER_COLON'), true);
});

test('autoFixYaml fixes tabs, odd indents, and missing colon spaces', () => {
  const broken = `homeassistant:\n\tname:Test\n   unit_system: metric`;
  const fixed = autoFixYaml(broken);
  const recheck = analyzeYaml(fixed);
  assert.equal(recheck.validSyntax, true);
  assert.equal(recheck.diagnostics.filter((d) => d.severity === 'error').length, 0);

  const nestedBroken = `alias: Ranni kava\naction:\n  - service: light.turn_on\n    entity_id: light.kuchyn\n   data:\n     brightness_pct: 80`;
  const nestedFixed = autoFixYaml(nestedBroken);
  const nestedRecheck = analyzeYaml(nestedFixed);
  assert.equal(nestedRecheck.validSyntax, true);
  assert.equal(nestedRecheck.diagnostics.filter((d) => d.severity === 'error').length, 0);
});

test('flags dangerous ESP32 flash pin GPIO6', () => {
  const code = `switch:\n  - platform: gpio\n    name: Relé\n    pin: GPIO6`;
  const res = analyzeYaml(code);
  assert.equal(res.diagnostics.some((d) => d.code === 'ESP32_FLASH_PIN'), true);
});

test('flags Home Assistant entity_id outside target block', () => {
  const code = `alias: Test\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.okno\naction:\n  - service: light.turn_on\n    entity_id: light.obyvak`;
  const res = analyzeYaml(code);
  assert.equal(res.diagnostics.some((d) => d.code === 'HA_ENTITY_WITHOUT_TARGET'), true);
});

test('extracts ESPHome light, I2C, and board simulation state', () => {
  const code = `esphome:\n  name: demo\nesp32:\n  board: esp32dev\ni2c:\n  sda: GPIO21\n  scl: GPIO22\nlight:\n  - platform: binary\n    name: "Stolni LED"\n    output: led_pin`;
  const res = analyzeYaml(code);
  assert.equal(res.simulation.board, 'esp32dev');
  assert.equal(res.simulation.hasI2c, true);
  assert.equal(res.simulation.lights.length, 1);
  assert.equal(res.simulation.lights[0].name, 'Stolni LED');
});

test('all curriculum solutionCode values pass their respective lesson validators', () => {
  for (const lesson of LESSONS) {
    const analysis = analyzeYaml(lesson.solutionCode);
    const result = lesson.validate(
      lesson.solutionCode,
      analysis.parsed,
      analysis.diagnostics,
      analysis.simulation
    );
    assert.equal(result.passed, true, `Solution failed for lesson ${lesson.id}: ${result.feedback}`);
  }
});

test('evaluates Jinja2 preview expressions dynamically', () => {
  const tpl = `{% if states('sensor.obyvak_teplota') | float(0) > 24 %}Větrej!{% else %}Pohoda{% endif %}`;
  assert.equal(evaluateJinjaPreview(tpl, { 'sensor.obyvak_teplota': 26 }), 'Větrej!');
  assert.equal(evaluateJinjaPreview(tpl, { 'sensor.obyvak_teplota': 21 }), 'Pohoda');
});

test('computes line diff between original and fixed YAML', () => {
  const diff = computeLineDiff('a: 1\nb:2', 'a: 1\nb: 2');
  assert.equal(diff.some((d) => d.type === 'removed' && d.text === 'b:2'), true);
  assert.equal(diff.some((d) => d.type === 'added' && d.text === 'b: 2'), true);
});
