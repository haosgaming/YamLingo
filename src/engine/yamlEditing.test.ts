import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleYamlComments, unindentYamlSelection } from './yamlEditing';

test('unindentYamlSelection removes 2 leading spaces cleanly across single and multiple lines', () => {
  const src = 'esphome:\n  name: lampa\n    board: esp32dev';
  const res = unindentYamlSelection(src, 11, src.length);
  assert.equal(res.value, 'esphome:\nname: lampa\n  board: esp32dev');
});

test('toggleYamlComments comments and uncomments selected YAML lines while preserving indent', () => {
  const src = 'output:\n  - platform: gpio\n    pin: GPIO2';
  const commented = toggleYamlComments(src, 10, src.length);
  assert.equal(commented.value, 'output:\n  # - platform: gpio\n    # pin: GPIO2');

  const uncommented = toggleYamlComments(commented.value, 10, commented.value.length);
  assert.equal(uncommented.value, src);
});
