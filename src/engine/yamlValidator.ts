import * as yaml from 'js-yaml';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface YamlDiagnostic {
  line: number; // 1-indexed
  column: number;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  quickFixLabel?: string;
}

export interface YamlTreeNode {
  id: string;
  key: string;
  valuePreview?: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  depth: number;
  line?: number;
  children: YamlTreeNode[];
}

export interface SimulatedLight {
  id: string;
  name: string;
  platform?: string;
  pin?: string;
  isOn: boolean;
  brightness: number;
}

export interface SimulatedSensor {
  id: string;
  name: string;
  platform: string;
  unit: string;
  value: number;
  filters: string[];
}

export interface SimulatedAutomation {
  alias: string;
  triggerPlatform: string;
  triggerEntity?: string;
  triggerTo?: string;
  hasCondition: boolean;
  conditionType?: string;
  actionService?: string;
  targetEntity?: string;
  usesTargetBlock: boolean;
}

export interface SimulationState {
  validSyntax: boolean;
  board: string | null;
  wifiSsid: string | null;
  hasOta: boolean;
  hasI2c: boolean;
  i2cSda: string | null;
  i2cScl: string | null;
  mqttBroker: string | null;
  lights: SimulatedLight[];
  switches: SimulatedLight[];
  sensors: SimulatedSensor[];
  automations: SimulatedAutomation[];
  climateTargetTemp: number | null;
  jinjaExpressions: string[];
  unitSystem: string | null;
}

export interface DiffLine {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
  lineNumber?: number;
}

const ESP32_FLASH_PINS = new Set(['GPIO6', 'GPIO7', 'GPIO8', 'GPIO9', 'GPIO10', 'GPIO11']);

export function analyzeYaml(code: string): {
  diagnostics: YamlDiagnostic[];
  parsed: unknown;
  validSyntax: boolean;
  tree: YamlTreeNode[];
  simulation: SimulationState;
} {
  const diagnostics: YamlDiagnostic[] = [];
  const lines = code.split(/\r?\n/);

  // 1. Pre-parse human-friendly spatial indentation & syntax checks
  let prevIndent = 0;
  let prevEndedWithColon = false;
  const seenKeysAtIndent = new Map<string, number>();

  lines.forEach((rawLine, idx) => {
    const lineNum = idx + 1;
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) {
      return;
    }

    // Check for tab characters
    const tabIdx = rawLine.indexOf('\t');
    if (tabIdx !== -1) {
      diagnostics.push({
        line: lineNum,
        column: tabIdx + 1,
        severity: 'error',
        code: 'TAB_INDENT',
        message: `Pozor! Řádek ${lineNum} obsahuje tabulátor (→). YAML povoluje výhradně mezery (doporučeno 2).`,
        quickFixLabel: 'Nahradit tabulátory 2 mezerami',
      });
    }

    // Measure leading spaces
    const leadingSpacesMatch = rawLine.match(/^( +)/);
    const spaces = leadingSpacesMatch ? leadingSpacesMatch[1].length : 0;
    const trimmed = rawLine.trim();

    if (spaces % 2 !== 0 && tabIdx === -1) {
      const evenPrev = Math.floor(prevIndent / 2) * 2;
      const target = prevEndedWithColon
        ? evenPrev + 2
        : Math.abs(spaces - evenPrev) <= 1
        ? evenPrev
        : Math.max(0, Math.floor(spaces / 2) * 2);
      diagnostics.push({
        line: lineNum,
        column: 1,
        severity: 'error',
        code: 'ODD_INDENT',
        message: `Pozor! Řádek ${lineNum} je odsazen o ${spaces} ${spaces === 1 ? 'mezeru' : 'mezery'} místo ${target}. YAML vyžaduje násobky 2 mezer.`,
        quickFixLabel: `Zarovnat na ${target} mezery`,
      });
    }

    // Detect missing space after colon (e.g. `name:obyvak`, ignoring URLs and Jinja/time)
    if (!trimmed.startsWith('-') && !trimmed.startsWith('{{') && !trimmed.startsWith('{%')) {
      const colonMatch = trimmed.match(/^([a-zA-Z0-9_.-]+):([^\s/"'{].*)$/);
      if (colonMatch) {
        diagnostics.push({
          line: lineNum,
          column: rawLine.indexOf(':') + 2,
          severity: 'error',
          code: 'MISSING_SPACE_AFTER_COLON',
          message: `Chybí mezera za dvojtečkou na řádku ${lineNum} („${colonMatch[1]}: ${colonMatch[2]}“).`,
          quickFixLabel: 'Přidat mezeru za dvojtečku',
        });
      }
    }

    // Detect unexpected indent increase when parent didn't end with ':' or '-'
    if (spaces > prevIndent + 2 && !prevEndedWithColon && tabIdx === -1) {
      diagnostics.push({
        line: lineNum,
        column: 1,
        severity: 'warning',
        code: 'DEEP_INDENT',
        message: `Řádek ${lineNum} skáče příliš hluboko (${spaces} mezer). Zkontrolujte, zda předchozí řádek končí dvojtečkou.`,
      });
    }

    // Reset deeper key map when indent drops
    if (spaces < prevIndent) {
      for (const k of Array.from(seenKeysAtIndent.keys())) {
        const keyIndent = Number(k.split(':')[0]);
        if (keyIndent > spaces) {
          seenKeysAtIndent.delete(k);
        }
      }
    }

    // Check duplicate keys at same top-level or same block
    const keyMatch = trimmed.match(/^([a-zA-Z0-9_.-]+):\s*/);
    if (keyMatch && !trimmed.startsWith('-')) {
      const scopeKey = `${spaces}:${keyMatch[1]}`;
      if (spaces === 0 && seenKeysAtIndent.has(scopeKey)) {
        const firstLine = seenKeysAtIndent.get(scopeKey);
        diagnostics.push({
          line: lineNum,
          column: 1,
          severity: 'warning',
          code: 'DUPLICATE_KEY',
          message: `Klíč „${keyMatch[1]}“ na řádku ${lineNum} už byl použit na řádku ${firstLine}. Druhý výskyt přepíše první!`,
        });
      }
      seenKeysAtIndent.set(scopeKey, lineNum);
    }

    // Detect unbalanced Jinja2 brackets on single line
    const openCurly = (trimmed.match(/\{\{/g) || []).length;
    const closeCurly = (trimmed.match(/\}\}/g) || []).length;
    if (openCurly !== closeCurly) {
      diagnostics.push({
        line: lineNum,
        column: 1,
        severity: 'error',
        code: 'JINJA_UNCLOSED',
        message: `Na řádku ${lineNum} chybí uzavírací nebo otevírací složené závorky Jinja2 šablony ({{ ... }}).`,
      });
    }

    const openTag = (trimmed.match(/\{%/g) || []).length;
    const closeTag = (trimmed.match(/%\}/g) || []).length;
    if (openTag !== closeTag) {
      diagnostics.push({
        line: lineNum,
        column: 1,
        severity: 'error',
        code: 'JINJA_TAG_UNCLOSED',
        message: `Na řádku ${lineNum} není správně uzavřený řídicí tag Jinja2 ({% ... %}).`,
      });
    }

    prevIndent = spaces;
    prevEndedWithColon = trimmed.endsWith(':') || trimmed.startsWith('-');
  });

  // 2. Parse with js-yaml
  let parsed: unknown = null;
  let validSyntax = false;

  try {
    parsed = yaml.load(code);
    validSyntax = true;
  } catch (err) {
    validSyntax = false;
    const mark = (err as { mark?: { line?: number; column?: number }; reason?: string })?.mark;
    const reason = (err as { reason?: string })?.reason || (err instanceof Error ? err.message : 'Syntaktická chyba');
    const lineNum = mark?.line !== undefined ? mark.line + 1 : 1;
    const colNum = mark?.column !== undefined ? mark.column + 1 : 1;

    // Avoid duplicating if we already flagged TAB or ODD_INDENT on same line
    const alreadyOnLine = diagnostics.some((d) => d.line === lineNum && d.severity === 'error');
    if (!alreadyOnLine) {
      diagnostics.push({
        line: lineNum,
        column: colNum,
        severity: 'error',
        code: 'YAML_PARSE_ERROR',
        message: `Chyba syntaxe na řádku ${lineNum}: ${translateYamlReason(reason)}`,
      });
    }
  }

  // 3. Domain-specific Home Assistant & ESPHome semantic checks
  if (validSyntax && parsed && typeof parsed === 'object') {
    runDomainSemanticChecks(parsed as Record<string, unknown>, lines, diagnostics);
  }

  const tree = validSyntax ? buildYamlTree(parsed) : [];
  const simulation = extractSimulationState(code, parsed, validSyntax);

  // Sort diagnostics by line
  diagnostics.sort((a, b) => a.line - b.line);

  return { diagnostics, parsed, validSyntax, tree, simulation };
}

function translateYamlReason(reason: string): string {
  if (/bad indentation/i.test(reason)) return 'Nesprávné odsazení vnořeného prvku.';
  if (/can not read a block mapping entry/i.test(reason)) return 'Neplatný zápis klíče nebo chybějící odsazení.';
  if (/end of the stream/i.test(reason)) return 'Neuzavřený blok nebo neplatný konec řádku.';
  if (/duplicated mapping key/i.test(reason)) return 'Duplicitní klíč v jednom objektu.';
  if (/found character that cannot start/i.test(reason)) return 'Nepovolený speciální znak (např. tabulátor nebo neuzavřené uvozovky).';
  return reason;
}

function findLineForKey(lines: string[], key: string): number {
  const idx = lines.findIndex((l) => new RegExp(`^\\s*(-\\s*)?${key}\\s*:`).test(l));
  return idx >= 0 ? idx + 1 : 1;
}

function runDomainSemanticChecks(
  doc: Record<string, unknown>,
  lines: string[],
  diagnostics: YamlDiagnostic[]
) {
  // Check ESP32 flash pins (GPIO6-11)
  const checkPin = (pinVal: unknown) => {
    if (typeof pinVal === 'string') {
      const norm = pinVal.toUpperCase().trim();
      if (ESP32_FLASH_PINS.has(norm)) {
        const line = findLineForKey(lines, 'pin');
        diagnostics.push({
          line,
          column: 1,
          severity: 'error',
          code: 'ESP32_FLASH_PIN',
          message: `Nebezpečný pin ${norm}! Piny GPIO6–GPIO11 jsou na ESP32 rezervovány pro interní SPI flash paměť a deska by se restartovala.`,
        });
      }
    }
  };

  // Traverse lights/outputs/sensors for pin checks
  const inspectArrayOrObj = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(inspectArrayOrObj);
    } else if (node && typeof node === 'object') {
      const rec = node as Record<string, unknown>;
      if ('pin' in rec) checkPin(rec.pin);
      Object.values(rec).forEach(inspectArrayOrObj);
    }
  };
  inspectArrayOrObj(doc);

  // Check Home Assistant Automation best practices: entity_id outside target
  const checkAutomation = (auto: Record<string, unknown>) => {
    const actions = auto.action ?? auto.actions;
    const actionList = Array.isArray(actions) ? actions : actions ? [actions] : [];
    actionList.forEach((act) => {
      if (act && typeof act === 'object') {
        const a = act as Record<string, unknown>;
        if ('entity_id' in a && !('target' in a) && ('service' in a || 'action' in a)) {
          const line = findLineForKey(lines, 'entity_id');
          diagnostics.push({
            line,
            column: 1,
            severity: 'warning',
            code: 'HA_ENTITY_WITHOUT_TARGET',
            message: `Doporučení Home Assistant: V akcích vložte „entity_id“ pod blok „target:“ místo přímo pod akci.`,
            quickFixLabel: 'Obalit do target:',
          });
        }
      }
    });
  };

  if (Array.isArray(doc.automation)) {
    doc.automation.forEach((a) => {
      if (a && typeof a === 'object') checkAutomation(a as Record<string, unknown>);
    });
  } else if (doc.automation && typeof doc.automation === 'object') {
    checkAutomation(doc.automation as Record<string, unknown>);
  } else if ('trigger' in doc || 'triggers' in doc || 'action' in doc || 'actions' in doc) {
    checkAutomation(doc);
  }
}

export function autoFixYaml(code: string): string {
  const lines = code.split(/\r?\n/);
  let prevIndent = 0;
  let prevEndedWithColon = false;

  const fixedLines = lines.map((line) => {
    if (!line.trim()) return '';
    // 1. Replace tabs with 2 spaces
    let next = line.replace(/\t/g, '  ');

    // 2. Fix odd indentation to even multiple of 2
    const leading = next.match(/^( +)/);
    if (leading) {
      const len = leading[1].length;
      if (len % 2 !== 0) {
        const evenPrev = Math.floor(prevIndent / 2) * 2;
        const evenLen = prevEndedWithColon
          ? evenPrev + 2
          : Math.abs(len - evenPrev) <= 1
          ? evenPrev
          : Math.max(0, Math.floor(len / 2) * 2);
        next = ' '.repeat(evenLen) + next.trimStart();
      }
      prevIndent = next.match(/^( +)/)?.[1].length ?? 0;
    } else {
      prevIndent = 0;
    }

    // 3. Add space after colon if missing (`key:value` -> `key: value`)
    const trimmed = next.trim();
    if (!trimmed.startsWith('#') && !trimmed.startsWith('{{') && !trimmed.startsWith('{%')) {
      next = next.replace(/^(\s*(?:-\s+)?[a-zA-Z0-9_.-]+):([^\s/"'{].*)$/, '$1: $2');
    }
    prevEndedWithColon = trimmed.endsWith(':') || trimmed.startsWith('-');

    return next;
  });

  return fixedLines.join('\n');
}

export function buildYamlTree(data: unknown, keyName = 'root', depth = 0): YamlTreeNode[] {
  if (data === null || data === undefined) {
    return [];
  }
  if (Array.isArray(data)) {
    return data.map((item, idx) => {
      const isObj = item !== null && typeof item === 'object';
      return {
        id: `${keyName}-${idx}-${depth}`,
        key: `[${idx}]`,
        valuePreview: isObj ? undefined : String(item),
        type: Array.isArray(item) ? 'array' : isObj ? 'object' : typeof item === 'number' ? 'number' : typeof item === 'boolean' ? 'boolean' : 'string',
        depth,
        children: isObj ? buildYamlTree(item, `${keyName}-${idx}`, depth + 1) : [],
      };
    });
  }
  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).map(([k, v], idx) => {
      const isObj = v !== null && typeof v === 'object';
      const type: YamlTreeNode['type'] =
        v === null
          ? 'null'
          : Array.isArray(v)
          ? 'array'
          : typeof v === 'object'
          ? 'object'
          : typeof v === 'number'
          ? 'number'
          : typeof v === 'boolean'
          ? 'boolean'
          : 'string';
      return {
        id: `${keyName}-${k}-${idx}-${depth}`,
        key: k,
        valuePreview: isObj ? (Array.isArray(v) ? `${v.length} položek` : `${Object.keys(v as object).length} klíčů`) : String(v),
        type,
        depth,
        children: isObj ? buildYamlTree(v, `${keyName}-${k}`, depth + 1) : [],
      };
    });
  }
  return [];
}

export function extractSimulationState(
  code: string,
  parsed: unknown,
  validSyntax: boolean
): SimulationState {
  const state: SimulationState = {
    validSyntax,
    board: null,
    wifiSsid: null,
    hasOta: false,
    hasI2c: false,
    i2cSda: null,
    i2cScl: null,
    mqttBroker: null,
    lights: [],
    switches: [],
    sensors: [],
    automations: [],
    climateTargetTemp: null,
    jinjaExpressions: [],
    unitSystem: null,
  };

  // Extract Jinja2 expressions even if YAML isn't fully parsed
  const jinjaMatches = code.match(/(\{\{[^}]+\}\}|\{%[^%]+%\})/g);
  if (jinjaMatches) {
    state.jinjaExpressions = jinjaMatches;
  }

  if (!validSyntax || !parsed || typeof parsed !== 'object') {
    return state;
  }

  const doc = parsed as Record<string, unknown>;

  if (doc.homeassistant && typeof doc.homeassistant === 'object') {
    const ha = doc.homeassistant as Record<string, unknown>;
    if (typeof ha.unit_system === 'string') {
      state.unitSystem = ha.unit_system;
    }
  }

  if (doc.esp32 && typeof doc.esp32 === 'object') {
    const esp = doc.esp32 as Record<string, unknown>;
    state.board = typeof esp.board === 'string' ? esp.board : 'esp32dev';
  } else if (doc.esp8266 && typeof doc.esp8266 === 'object') {
    const esp = doc.esp8266 as Record<string, unknown>;
    state.board = typeof esp.board === 'string' ? esp.board : 'd1_mini';
  }

  if (doc.wifi && typeof doc.wifi === 'object') {
    const w = doc.wifi as Record<string, unknown>;
    if (typeof w.ssid === 'string') state.wifiSsid = w.ssid;
  }

  if ('ota' in doc) {
    state.hasOta = true;
  }

  if (doc.i2c && typeof doc.i2c === 'object') {
    const i2cObj = Array.isArray(doc.i2c) ? doc.i2c[0] : doc.i2c;
    if (i2cObj && typeof i2cObj === 'object') {
      const rec = i2cObj as Record<string, unknown>;
      state.hasI2c = true;
      state.i2cSda = rec.sda ? String(rec.sda) : null;
      state.i2cScl = rec.scl ? String(rec.scl) : null;
    }
  }

  if (doc.mqtt && typeof doc.mqtt === 'object') {
    const m = doc.mqtt as Record<string, unknown>;
    state.mqttBroker = typeof m.broker === 'string' ? m.broker : 'core-mosquitto';
  }

  // Extract lights (ESPHome list or Home Assistant object)
  if (Array.isArray(doc.light)) {
    doc.light.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const l = item as Record<string, unknown>;
        state.lights.push({
          id: `light_${idx}`,
          name: String(l.name || l.output || `Světlo ${idx + 1}`),
          platform: l.platform ? String(l.platform) : 'binary',
          pin: l.pin ? String(l.pin) : l.output ? String(l.output) : undefined,
          isOn: true,
          brightness: 100,
        });
      }
    });
  }

  if (Array.isArray(doc.output)) {
    doc.output.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        if (o.pin && state.lights.length > 0 && !state.lights[0].pin) {
          state.lights[0].pin = String(o.pin);
        } else if (o.pin && state.lights.length === 0) {
          state.switches.push({
            id: `output_${idx}`,
            name: String(o.id || `Výstup ${o.pin}`),
            platform: String(o.platform || 'gpio'),
            pin: String(o.pin),
            isOn: true,
            brightness: 100,
          });
        }
      }
    });
  }

  if (Array.isArray(doc.switch)) {
    doc.switch.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const s = item as Record<string, unknown>;
        state.switches.push({
          id: `switch_${idx}`,
          name: String(s.name || `Relé ${idx + 1}`),
          platform: String(s.platform || 'gpio'),
          pin: s.pin ? String(s.pin) : undefined,
          isOn: s.restore_mode !== 'ALWAYS_OFF',
          brightness: 100,
        });
      }
    });
  }

  if (Array.isArray(doc.sensor)) {
    doc.sensor.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const s = item as Record<string, unknown>;
        const filters = Array.isArray(s.filters)
          ? s.filters.map((f) => (typeof f === 'string' ? f : Object.keys(f as object)[0] || 'filter'))
          : [];
        if (s.platform === 'bme280' || s.temperature || s.humidity) {
          state.sensors.push({
            id: `bme280_temp_${idx}`,
            name: String((s.temperature as Record<string, unknown>)?.name || 'Teplota BME280'),
            platform: 'bme280',
            unit: '°C',
            value: 22.4,
            filters,
          });
          if (s.humidity) {
            state.sensors.push({
              id: `bme280_hum_${idx}`,
              name: String((s.humidity as Record<string, unknown>)?.name || 'Vlhkost BME280'),
              platform: 'bme280',
              unit: '%',
              value: 48,
              filters,
            });
          }
        } else {
          state.sensors.push({
            id: `sensor_${idx}`,
            name: String(s.name || `Senzor ${idx + 1}`),
            platform: String(s.platform || 'template'),
            unit: String(s.unit_of_measurement || '°C'),
            value: 21.8,
            filters,
          });
        }
      }
    });
  }

  if (doc.climate && typeof doc.climate === 'object') {
    const c = Array.isArray(doc.climate) ? doc.climate[0] : doc.climate;
    if (c && typeof c === 'object') {
      const rec = c as Record<string, unknown>;
      const t = Number(rec.target_temperature ?? rec.max_temp ?? 21);
      if (!Number.isNaN(t)) state.climateTargetTemp = t;
    }
  }

  // Extract automations
  const parseAutomation = (a: Record<string, unknown>) => {
    const triggers = Array.isArray(a.trigger)
      ? a.trigger
      : a.trigger
      ? [a.trigger]
      : Array.isArray(a.triggers)
      ? a.triggers
      : a.triggers
      ? [a.triggers]
      : [];
    const firstTrigger = (triggers[0] || {}) as Record<string, unknown>;

    const conditions = Array.isArray(a.condition)
      ? a.condition
      : a.condition
      ? [a.condition]
      : Array.isArray(a.conditions)
      ? a.conditions
      : a.conditions
      ? [a.conditions]
      : [];
    const firstCondition = (conditions[0] || {}) as Record<string, unknown>;

    const actions = Array.isArray(a.action)
      ? a.action
      : a.action
      ? [a.action]
      : Array.isArray(a.actions)
      ? a.actions
      : a.actions
      ? [a.actions]
      : [];
    const firstAction = (actions[0] || {}) as Record<string, unknown>;
    const targetObj = (firstAction.target || {}) as Record<string, unknown>;

    state.automations.push({
      alias: String(a.alias || 'Chytrá automatizace'),
      triggerPlatform: String(firstTrigger.platform || firstTrigger.trigger || 'state'),
      triggerEntity: firstTrigger.entity_id ? String(firstTrigger.entity_id) : undefined,
      triggerTo: firstTrigger.to ? String(firstTrigger.to) : undefined,
      hasCondition: conditions.length > 0,
      conditionType: firstCondition.condition ? String(firstCondition.condition) : undefined,
      actionService: String(firstAction.service || firstAction.action || ''),
      targetEntity: String(targetObj.entity_id || firstAction.entity_id || ''),
      usesTargetBlock: Boolean(firstAction.target && targetObj.entity_id),
    });
  };

  if (Array.isArray(doc.automation)) {
    doc.automation.forEach((a) => {
      if (a && typeof a === 'object') parseAutomation(a as Record<string, unknown>);
    });
  } else if (doc.automation && typeof doc.automation === 'object') {
    parseAutomation(doc.automation as Record<string, unknown>);
  } else if ('trigger' in doc || 'triggers' in doc || 'action' in doc || 'actions' in doc) {
    parseAutomation(doc);
  }

  return state;
}

export function computeLineDiff(original: string, fixed: string): DiffLine[] {
  const a = original.split(/\r?\n/);
  const b = fixed.split(/\r?\n/);
  const result: DiffLine[] = [];

  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      result.push({ type: 'unchanged', text: a[i], lineNumber: j + 1 });
      i++;
      j++;
    } else if (i < a.length && (j >= b.length || a[i + 1] === b[j])) {
      result.push({ type: 'removed', text: a[i] });
      i++;
    } else if (j < b.length && (i >= a.length || a[i] === b[j + 1])) {
      result.push({ type: 'added', text: b[j], lineNumber: j + 1 });
      j++;
    } else {
      if (i < a.length) {
        result.push({ type: 'removed', text: a[i] });
        i++;
      }
      if (j < b.length) {
        result.push({ type: 'added', text: b[j], lineNumber: j + 1 });
        j++;
      }
    }
  }
  return result;
}

/**
 * Lightweight client-side evaluator for Home Assistant Jinja2 template lessons
 */
export function evaluateJinjaPreview(
  templateStr: string,
  mockEntities: Record<string, string | number>
): string {
  let out = templateStr;

  // Replace states('entity')
  out = out.replace(/\{\{\s*states\(['"]([^'"]+)['"]\)(?:\s*\|\s*float(?:\([^)]*\))?)?\s*\}\}/g, (_m, entity) => {
    const val = mockEntities[entity];
    return val !== undefined ? String(val) : 'unknown';
  });

  // Handle simple {% if ... %} ... {% else %} ... {% endif %}
  const ifElseRegex =
    /\{%\s*if\s+(.+?)\s*%\}([\s\S]*?)(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/g;

  out = out.replace(ifElseRegex, (_m, cond: string, trueBranch: string, falseBranch = '') => {
    let evalCond = cond;
    evalCond = evalCond.replace(/states\(['"]([^'"]+)['"]\)(?:\s*\|\s*float(?:\([^)]*\))?)?/g, (_s, entity) => {
      const val = mockEntities[entity];
      if (typeof val === 'number') return String(val);
      return JSON.stringify(String(val ?? ''));
    });
    evalCond = evalCond.replace(/is_state\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]\)/g, (_s, entity, expected) => {
      return String(String(mockEntities[entity] ?? '') === expected);
    });

    let passed = false;
    try {
      const gt = evalCond.match(/^(-?\d+(?:\.\d+)?)\s*>\s*(-?\d+(?:\.\d+)?)$/);
      const lt = evalCond.match(/^(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)$/);
      const eq = evalCond.match(/^("[^"]*"|true|false|-?\d+(?:\.\d+)?)\s*==\s*("[^"]*"|true|false|-?\d+(?:\.\d+)?)$/);
      if (gt) passed = Number(gt[1]) > Number(gt[2]);
      else if (lt) passed = Number(lt[1]) < Number(lt[2]);
      else if (eq) passed = eq[1] === eq[2];
      else if (evalCond.trim() === 'true') passed = true;
      else if (evalCond.includes('and')) {
        const parts = evalCond.split(/\s+and\s+/);
        passed = parts.every((p) => {
          const pTrim = p.trim();
          if (pTrim === 'true') return true;
          const mGt = pTrim.match(/^(-?\d+(?:\.\d+)?)\s*>\s*(-?\d+(?:\.\d+)?)$/);
          if (mGt) return Number(mGt[1]) > Number(mGt[2]);
          const mEq = pTrim.match(/^("[^"]*")\s*==\s*("[^"]*")$/);
          if (mEq) return mEq[1] === mEq[2];
          return false;
        });
      }
    } catch {
      passed = false;
    }

    const branch = passed ? trueBranch : falseBranch;
    return evaluateJinjaPreview(branch.trim(), mockEntities);
  });

  return out.trim();
}
