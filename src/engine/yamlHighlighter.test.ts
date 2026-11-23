import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeYamlLine } from './yamlHighlighter';

function reconstruct(line: string): string {
  return tokenizeYamlLine(line)
    .map((t) => t.value)
    .join('');
}

test('preserves exact line string across every YAML construct (lossless invariant)', () => {
  const samples = [
    '',
    '   ',
    '\t  pin: GPIO2 # modrá LED',
    'esphome: # hlavní konfigurace',
    '  name: "Stolni #1 LED" # inline poznámka',
    '  url: "http://192.168.1.10:8123"',
    '  - platform: gpio',
    '  - "obyvak"',
    '  brightness_pct: 80',
    '  inverted: true',
    '  timeout: null',
    '  state: >',
    "    {{ states('sensor.obyvak_teplota') }} °C # živá hodnota",
    '--- # začátek dokumentu',
  ];

  for (const line of samples) {
    assert.equal(reconstruct(line), line);
  }
});

test('distinguishes keys, colons, values, and inline comments', () => {
  const tokens = tokenizeYamlLine('  pin: GPIO2 # modrá LED');
  assert.deepEqual(tokens, [
    { type: 'whitespace', value: '  ' },
    { type: 'key', value: 'pin' },
    { type: 'colon', value: ':' },
    { type: 'text', value: ' ' },
    { type: 'string', value: 'GPIO2' },
    { type: 'text', value: ' ' },
    { type: 'comment', value: '# modrá LED' },
  ]);
});

test('highlights full-line comments and keeps # inside quoted strings as string values', () => {
  assert.deepEqual(tokenizeYamlLine('  # komentář k sekci'), [
    { type: 'whitespace', value: '  ' },
    { type: 'comment', value: '# komentář k sekci' },
  ]);

  const quotedHash = tokenizeYamlLine('  name: "LED #1" # poznámka');
  assert.deepEqual(quotedHash, [
    { type: 'whitespace', value: '  ' },
    { type: 'key', value: 'name' },
    { type: 'colon', value: ':' },
    { type: 'text', value: ' ' },
    { type: 'string', value: '"LED #1"' },
    { type: 'text', value: ' ' },
    { type: 'comment', value: '# poznámka' },
  ]);
});

test('handles numbers, booleans, null, list items, URLs, and Jinja2 blocks accurately', () => {
  const numLine = tokenizeYamlLine('  address: 0x76');
  assert.equal(numLine.find((t) => t.type === 'number')?.value, '0x76');

  const boolLine = tokenizeYamlLine('  restore_mode: true');
  assert.equal(boolLine.find((t) => t.type === 'boolean')?.value, 'true');

  const nullLine = tokenizeYamlLine('  fallback: ~');
  assert.equal(nullLine.find((t) => t.type === 'null')?.value, '~');

  const listKv = tokenizeYamlLine('  - platform: binary # světlo');
  assert.deepEqual(listKv, [
    { type: 'whitespace', value: '  ' },
    { type: 'dash', value: '- ' },
    { type: 'key', value: 'platform' },
    { type: 'colon', value: ':' },
    { type: 'text', value: ' ' },
    { type: 'string', value: 'binary' },
    { type: 'text', value: ' ' },
    { type: 'comment', value: '# světlo' },
  ]);

  const urlLine = tokenizeYamlLine('  broker: http://192.168.1.10:1883');
  assert.equal(urlLine.find((t) => t.type === 'key')?.value, 'broker');
  assert.equal(urlLine.find((t) => t.type === 'string')?.value, 'http://192.168.1.10:1883');

  const jinjaLine = tokenizeYamlLine("    state: {{ states('sensor.teplota') }} # °C");
  assert.equal(jinjaLine.find((t) => t.type === 'key')?.value, 'state');
  assert.equal(jinjaLine.find((t) => t.type === 'jinja')?.value, "{{ states('sensor.teplota') }}");
  assert.equal(jinjaLine.find((t) => t.type === 'comment')?.value, '# °C');
});
