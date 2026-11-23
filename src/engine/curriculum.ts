import type { SimulationState, YamlDiagnostic } from './yamlValidator';

export type LessonMode = 'yaml' | 'esphome' | 'ha';
export type LessonDifficulty = 'easy' | 'medium' | 'hard';
export type DifficultyFilter = 'all' | LessonDifficulty;

export interface DifficultyMeta {
  id: LessonDifficulty;
  label: string;
  colorVar: string;
}

export const DIFFICULTY_META: Record<LessonDifficulty, DifficultyMeta> = {
  easy: { id: 'easy', label: 'Snadná', colorVar: 'var(--success)' },
  medium: { id: 'medium', label: 'Střední', colorVar: 'var(--warning)' },
  hard: { id: 'hard', label: 'Těžká', colorVar: 'var(--danger)' },
};

export interface CodeBlock {
  label: string;
  snippet: string;
}

export interface ValidationCheck {
  label: string;
  ok: boolean;
}

export interface LessonResult {
  passed: boolean;
  progressPct: number;
  checks: ValidationCheck[];
  feedback: string;
}

export interface LessonNode {
  id: string;
  worldId: number;
  worldTitle: string;
  order: number;
  title: string;
  mode: LessonMode;
  difficulty: LessonDifficulty;
  durationLabel: string;
  isBoss: boolean;
  bossTimeSec?: number;
  bossMaxAttempts?: number;
  brief: string;
  starterCode: string;
  solutionCode: string;
  hint: string;
  blocks: CodeBlock[];
  validate: (
    code: string,
    parsed: unknown,
    diagnostics: YamlDiagnostic[],
    sim: SimulationState
  ) => LessonResult;
}

export interface WorldInfo {
  id: number;
  title: string;
  subtitle: string;
  mode: LessonMode;
}

export const WORLDS: WorldInfo[] = [
  {
    id: 1,
    title: 'Svět 1: YAML Základy',
    subtitle: 'Skalární typy, seznamy, slovníky a zrádné odsazování',
    mode: 'yaml',
  },
  {
    id: 2,
    title: 'Svět 2: ESPHome Začátečník',
    subtitle: 'Definice desky ESP32, Wi-Fi, OTA a GPIO LED světla',
    mode: 'esphome',
  },
  {
    id: 3,
    title: 'Svět 3: Home Assistant Automatizace',
    subtitle: 'Spouštěče, podmínky, akce a správné target: entity_id',
    mode: 'ha',
  },
  {
    id: 4,
    title: 'Svět 4: Senzory & Integrace',
    subtitle: 'I2C sběrnice, senzor BME280, filtry dat a MQTT',
    mode: 'esphome',
  },
  {
    id: 5,
    title: 'Svět 5: Pokročilý Jinja2 & Šablony',
    subtitle: 'Proměnné, podmínky {% if %} a renderování stavů',
    mode: 'ha',
  },
];

function buildResult(checks: ValidationCheck[], diagnostics: YamlDiagnostic[], successFeedback: string): LessonResult {
  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  const passedCount = checks.filter((c) => c.ok).length;
  const progressPct = Math.round((passedCount / Math.max(1, checks.length)) * 100);
  const allChecksOk = checks.every((c) => c.ok);
  const passed = allChecksOk && !hasErrors;

  let feedback = successFeedback;
  if (hasErrors) {
    feedback = diagnostics.find((d) => d.severity === 'error')?.message || 'Oprav chybu syntaxe v editoru.';
  } else if (!allChecksOk) {
    const nextMissing = checks.find((c) => !c.ok);
    feedback = nextMissing ? `Zbývá splnit: ${nextMissing.label}` : 'Zkontroluj zadání.';
  }

  return { passed, progressPct, checks, feedback };
}

export const LESSONS: LessonNode[] = [
  // ================= SVĚT 1 =================
  {
    id: 'w1-1',
    worldId: 1,
    worldTitle: 'Svět 1: YAML Základy',
    order: 1,
    title: 'Skalární typy',
    mode: 'yaml',
    difficulty: 'easy',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Nastav textový název `name: Obyvak`, číselnou hodnotu `teplota: 22.5` a logickou hodnotu `aktivni: true`.',
    starterCode: `# Základní skalární typy v YAML\nname: Obyvak\nteplota: \naktivni: `,
    solutionCode: `# Základní skalární typy v YAML\nname: Obyvak\nteplota: 22.5\naktivni: true`,
    hint: 'Za dvojtečkou musí být vždy mezera. Čísla a boolean (`true` / `false`) se píší bez uvozovek.',
    blocks: [
      { label: 'teplota: 22.5', snippet: 'teplota: 22.5' },
      { label: 'aktivni: true', snippet: 'aktivni: true' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'Klíč name obsahuje text', ok: typeof obj.name === 'string' && obj.name.trim().length > 0 },
        { label: 'Klíč teplota je číslo (např. 22.5)', ok: typeof obj.teplota === 'number' },
        { label: 'Klíč aktivni je boolean (true/false)', ok: typeof obj.aktivni === 'boolean' },
      ];
      return buildResult(checks, diagnostics, 'Skvěle! YAML přesně rozeznal text, číslo i logickou hodnotu.');
    },
  },
  {
    id: 'w1-2',
    worldId: 1,
    worldTitle: 'Svět 1: YAML Základy',
    order: 2,
    title: 'Seznamy pomocí pomlčky',
    mode: 'yaml',
    difficulty: 'easy',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Vytvoř pod klíčem `mistnosti:` seznam nejméně 3 místností pomocí pomlčky a mezery (`- `).',
    starterCode: `mistnosti:\n  - Kuchyne\n  - `,
    solutionCode: `mistnosti:\n  - Kuchyne\n  - Obyvak\n  - Loznice`,
    hint: 'Každá položka seznamu začíná dvěma mezerami, pomlčkou a mezerou (`  - Obyvak`).',
    blocks: [
      { label: '  - Obyvak', snippet: '  - Obyvak' },
      { label: '  - Loznice', snippet: '  - Loznice' },
      { label: '  - Chodba', snippet: '  - Chodba' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const list = Array.isArray(obj.mistnosti) ? obj.mistnosti.filter((x) => typeof x === 'string' && x.trim()) : [];
      const checks: ValidationCheck[] = [
        { label: 'Klíč mistnosti je seznam', ok: Array.isArray(obj.mistnosti) },
        { label: 'Obsahuje alespoň 3 položky', ok: list.length >= 3 },
      ];
      return buildResult(checks, diagnostics, 'Výborně! Seznamy s odrážkou jsou základem všech senzorů i akcí.');
    },
  },
  {
    id: 'w1-3',
    worldId: 1,
    worldTitle: 'Svět 1: YAML Základy',
    order: 3,
    title: 'Slovníky a vnoření',
    mode: 'yaml',
    difficulty: 'easy',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Vnoř pod klíč `homeassistant:` klíč `name: Domov` a `unit_system: metric` s přesným 2-mezerovým odsazením.',
    starterCode: `homeassistant:\n  name: Domov\n`,
    solutionCode: `homeassistant:\n  name: Domov\n  unit_system: metric`,
    hint: 'Vnořené klíče musí mít přesně 2 mezery před názvem klíče.',
    blocks: [
      { label: '  unit_system: metric', snippet: '  unit_system: metric' },
      { label: '  time_zone: Europe/Prague', snippet: '  time_zone: Europe/Prague' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const ha = (obj.homeassistant && typeof obj.homeassistant === 'object' ? obj.homeassistant : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'Blok homeassistant existuje', ok: Boolean(obj.homeassistant && typeof obj.homeassistant === 'object') },
        { label: 'Vnořené name je vyplněno', ok: typeof ha.name === 'string' && ha.name.trim().length > 0 },
        { label: 'unit_system je nastaveno na metric', ok: ha.unit_system === 'metric' },
      ];
      return buildResult(checks, diagnostics, 'Perfektní struktura! Home Assistant teď mluví v metrických jednotkách.');
    },
  },
  {
    id: 'w1-4',
    worldId: 1,
    worldTitle: 'Svět 1: YAML Základy',
    order: 4,
    title: 'Boss Fight: Zrádné odsazování',
    mode: 'yaml',
    difficulty: 'hard',
    durationLabel: '3 min',
    isBoss: true,
    bossTimeSec: 90,
    bossMaxAttempts: 5,
    brief: 'Krizová situace! Někdo v konfiguraci použil tabulátory, 3 mezery a zapomněl mezeru za dvojtečkou. Oprav celý soubor dřív, než vyprší čas!',
    starterCode: `homeassistant:\n\tname:ChytryByt\n   unit_system: metric\n   latitude: 50.08`,
    solutionCode: `homeassistant:\n  name: ChytryByt\n  unit_system: metric\n  latitude: 50.08`,
    hint: 'Odstraň tabulátor, srovnej všechny vnořené řádky na 2 mezery a přidej mezeru za `name:`.',
    blocks: [
      { label: '  name: ChytryByt', snippet: '  name: ChytryByt' },
      { label: '  unit_system: metric', snippet: '  unit_system: metric' },
    ],
    validate: (code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const ha = (obj.homeassistant && typeof obj.homeassistant === 'object' ? obj.homeassistant : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'Žádné tabulátory v kódu', ok: !code.includes('\t') },
        { label: 'Správné 2-mezerové odsazení', ok: diagnostics.filter((d) => d.severity === 'error').length === 0 },
        { label: 'Platné klíče name, unit_system a latitude', ok: Boolean(ha.name && ha.unit_system && ha.latitude) },
      ];
      return buildResult(checks, diagnostics, 'Boss poražen! Konfigurace je čistá jako křišťál.');
    },
  },

  // ================= SVĚT 2 =================
  {
    id: 'w2-1',
    worldId: 2,
    worldTitle: 'Svět 2: ESPHome Začátečník',
    order: 1,
    title: 'Definice desky ESP32',
    mode: 'esphome',
    difficulty: 'easy',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Definuj základní projekt v ESPHome: nastav `esphome: name: lampicka` a pod `esp32:` vyber `board: esp32dev`.',
    starterCode: `esphome:\n  name: lampicka\n\nesp32:\n  board: `,
    solutionCode: `esphome:\n  name: lampicka\n\nesp32:\n  board: esp32dev`,
    hint: 'Pod sekci `esp32:` doplň `board: esp32dev`.',
    blocks: [
      { label: '  board: esp32dev', snippet: '  board: esp32dev' },
      { label: '  framework:\n    type: arduino', snippet: '  framework:\n    type: arduino' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const esphome = (obj.esphome && typeof obj.esphome === 'object' ? obj.esphome : {}) as Record<string, unknown>;
      const esp32 = (obj.esp32 && typeof obj.esp32 === 'object' ? obj.esp32 : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'esphome.name je nastaveno', ok: typeof esphome.name === 'string' && esphome.name.length > 0 },
        { label: 'esp32.board je nastaveno na esp32dev', ok: esp32.board === 'esp32dev' },
      ];
      return buildResult(checks, diagnostics, 'Deska ESP32 rozpoznána na virtuálním stole!');
    },
  },
  {
    id: 'w2-2',
    worldId: 2,
    worldTitle: 'Svět 2: ESPHome Začátečník',
    order: 2,
    title: 'Wi-Fi & OTA aktualizace',
    mode: 'esphome',
    difficulty: 'easy',
    durationLabel: '3 min',
    isBoss: false,
    brief: 'Připoj desku k síti přidáním `wifi:` (`ssid` a `password`) a povol bezdrátové nahrávání `ota:`.',
    starterCode: `esphome:\n  name: cidlo-chodba\n\nesp32:\n  board: esp32dev\n\nwifi:\n  ssid: "MojeSit"\n  password: \n`,
    solutionCode: `esphome:\n  name: cidlo-chodba\n\nesp32:\n  board: esp32dev\n\nwifi:\n  ssid: "MojeSit"\n  password: "TajneHeslo"\n\nota:\n  - platform: esphome`,
    hint: 'Doplň `password: "TajneHeslo"` a přidej blok `ota:` (např. s `- platform: esphome`).',
    blocks: [
      { label: '  password: "TajneHeslo"', snippet: '  password: "TajneHeslo"' },
      { label: 'ota:\n  - platform: esphome', snippet: 'ota:\n  - platform: esphome' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const wifi = (obj.wifi && typeof obj.wifi === 'object' ? obj.wifi : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'wifi.ssid je vyplněno', ok: typeof wifi.ssid === 'string' && wifi.ssid.length > 0 },
        { label: 'wifi.password je vyplněno', ok: typeof wifi.password === 'string' && wifi.password.length > 0 },
        { label: 'ota blok je přítomen', ok: 'ota' in obj },
      ];
      return buildResult(checks, diagnostics, 'Wi-Fi i OTA jsou online! Desku už nemusíš připojovat kabelem.');
    },
  },
  {
    id: 'w2-3',
    worldId: 2,
    worldTitle: 'Svět 2: ESPHome Začátečník',
    order: 3,
    title: 'GPIO LEDka & Výstup',
    mode: 'esphome',
    difficulty: 'medium',
    durationLabel: '3 min',
    isBoss: false,
    brief: 'Rozsviť modrou LEDku na 3D desce! Propoj `output:` (`platform: gpio`, `pin: GPIO2`, `id: led_pin`) se světlem `light:` (`platform: binary`, `name: "Stolni LED"`, `output: led_pin`).',
    starterCode: `esphome:\n  name: led-kontroler\n\nesp32:\n  board: esp32dev\n\noutput:\n  - platform: gpio\n    pin: GPIO2\n    id: led_pin\n\nlight:\n  - platform: binary\n    name: "Stolni LED"\n    output: `,
    solutionCode: `esphome:\n  name: led-kontroler\n\nesp32:\n  board: esp32dev\n\noutput:\n  - platform: gpio\n    pin: GPIO2\n    id: led_pin\n\nlight:\n  - platform: binary\n    name: "Stolni LED"\n    output: led_pin`,
    hint: 'Doplň `output: led_pin` na poslední řádek, aby světlo vědělo, který GPIO výstup má ovládat.',
    blocks: [
      { label: '    output: led_pin', snippet: '    output: led_pin' },
      { label: '    pin: GPIO2', snippet: '    pin: GPIO2' },
    ],
    validate: (_code, parsed, diagnostics, sim) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const hasOutput = Array.isArray(obj.output) && obj.output.length > 0;
      const firstLight = Array.isArray(obj.light) ? (obj.light[0] as Record<string, unknown>) : null;
      const checks: ValidationCheck[] = [
        { label: 'Definovaný GPIO výstup (output)', ok: hasOutput },
        { label: 'Definované světlo (light)', ok: Boolean(firstLight && firstLight.platform === 'binary') },
        { label: 'Světlo odkazuje na output: led_pin', ok: Boolean(firstLight && firstLight.output === 'led_pin') && sim.lights.length > 0 },
      ];
      return buildResult(checks, diagnostics, 'Budiž světlo! Sleduj rozsvícenou LED na 3D ESP32 i přepínač v Lovelace.');
    },
  },
  {
    id: 'w2-4',
    worldId: 2,
    worldTitle: 'Svět 2: ESPHome Začátečník',
    order: 4,
    title: 'Boss Fight: Zkrat na Flash pinu',
    mode: 'esphome',
    difficulty: 'hard',
    durationLabel: '3 min',
    isBoss: true,
    bossTimeSec: 90,
    bossMaxAttempts: 5,
    brief: 'POPLACH! Relé kotle je zapojeno na zakázaný flash pin `GPIO6` a má tabulátor v názvu. Přesuň pin na bezpečný `GPIO16` a oprav YAML!',
    starterCode: `esphome:\n  name: kotel-rele\n\nesp32:\n  board: esp32dev\n\nswitch:\n  - platform: gpio\n\t  name: "Kotel Rele"\n    pin: GPIO6`,
    solutionCode: `esphome:\n  name: kotel-rele\n\nesp32:\n  board: esp32dev\n\nswitch:\n  - platform: gpio\n    name: "Kotel Rele"\n    pin: GPIO16`,
    hint: 'Nahraď tabulátor mezerami a změň `GPIO6` (flash pin) na `GPIO16`.',
    blocks: [
      { label: '    name: "Kotel Rele"', snippet: '    name: "Kotel Rele"' },
      { label: '    pin: GPIO16', snippet: '    pin: GPIO16' },
    ],
    validate: (code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const sw = Array.isArray(obj.switch) ? (obj.switch[0] as Record<string, unknown>) : null;
      const checks: ValidationCheck[] = [
        { label: 'Bezpečný GPIO pin (ne GPIO6–11)', ok: Boolean(sw && sw.pin && !/^GPIO(6|7|8|9|10|11)$/i.test(String(sw.pin))) },
        { label: 'Žádné tabulátory a platná syntaxe', ok: !code.includes('\t') && diagnostics.filter((d) => d.severity === 'error').length === 0 },
        { label: 'Název relé zachován', ok: Boolean(sw && sw.name) },
      ];
      return buildResult(checks, diagnostics, 'Zkrat zažehnán! Relé bezpečně spíná na GPIO16.');
    },
  },

  // ================= SVĚT 3 =================
  {
    id: 'w3-1',
    worldId: 3,
    worldTitle: 'Svět 3: Home Assistant Automatizace',
    order: 1,
    title: 'Spouštěč (Trigger)',
    mode: 'ha',
    difficulty: 'easy',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Napiš automatizaci, která se spustí, když `binary_sensor.pohyb_chodba` přejde do stavu `"on"`.',
    starterCode: `alias: Svetlo na chodbe\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.pohyb_chodba\n    to: `,
    solutionCode: `alias: Svetlo na chodbe\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.pohyb_chodba\n    to: "on"\naction:\n  - service: light.turn_on\n    target:\n      entity_id: light.chodba`,
    hint: 'V YAML piš `"on"` v uvozovkách, jinak ho YAML interpretuje jako boolean `true`.',
    blocks: [
      { label: '    to: "on"', snippet: '    to: "on"' },
      { label: 'action:\n  - service: light.turn_on\n    target:\n      entity_id: light.chodba', snippet: 'action:\n  - service: light.turn_on\n    target:\n      entity_id: light.chodba' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const trigs = Array.isArray(obj.trigger) ? obj.trigger : [];
      const first = (trigs[0] || {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'Spouštěč platform: state', ok: first.platform === 'state' },
        { label: 'Entita binary_sensor.pohyb_chodba', ok: first.entity_id === 'binary_sensor.pohyb_chodba' },
        { label: 'Cílový stav "on"', ok: first.to === 'on' || first.to === true },
      ];
      return buildResult(checks, diagnostics, 'Spouštěč je připraven! Pohyb v chodbě okamžitě nastartuje automatizaci.');
    },
  },
  {
    id: 'w3-2',
    worldId: 3,
    worldTitle: 'Svět 3: Home Assistant Automatizace',
    order: 2,
    title: 'Podmínka (Condition)',
    mode: 'ha',
    difficulty: 'medium',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Světlo v chodbě nemá svítit ve dne. Přidej `condition:` se sluneční podmínkou `condition: sun` a `after: sunset`.',
    starterCode: `alias: Nocni svetlo\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.pohyb_chodba\n    to: "on"\ncondition:\n  - condition: sun\n\naction:\n  - service: light.turn_on\n    target:\n      entity_id: light.chodba`,
    solutionCode: `alias: Nocni svetlo\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.pohyb_chodba\n    to: "on"\ncondition:\n  - condition: sun\n    after: sunset\naction:\n  - service: light.turn_on\n    target:\n      entity_id: light.chodba`,
    hint: 'Pod `- condition: sun` vnoř o 2 mezery víc: `    after: sunset`.',
    blocks: [
      { label: '    after: sunset', snippet: '    after: sunset' },
      { label: '    before: sunrise', snippet: '    before: sunrise' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const conds = Array.isArray(obj.condition) ? obj.condition : [];
      const first = (conds[0] || {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'Podmínka typu sun', ok: first.condition === 'sun' },
        { label: 'Parametr after: sunset', ok: first.after === 'sunset' },
      ];
      return buildResult(checks, diagnostics, 'Výborně! Otestuj spouštěč i v Lovelace simulátoru vpravo.');
    },
  },
  {
    id: 'w3-3',
    worldId: 3,
    worldTitle: 'Svět 3: Home Assistant Automatizace',
    order: 3,
    title: 'Akce: target & entity_id',
    mode: 'ha',
    difficulty: 'medium',
    durationLabel: '3 min',
    isBoss: false,
    brief: 'Přesuň `entity_id: light.obyvak` správně pod blok `target:`, nikoli přímo pod akci. Vyhni se nečitelným `device_id`.',
    starterCode: `alias: Vecerni atmosfera\ntrigger:\n  - platform: sun\n    event: sunset\naction:\n  - service: light.turn_on\n    entity_id: light.obyvak`,
    solutionCode: `alias: Vecerni atmosfera\ntrigger:\n  - platform: sun\n    event: sunset\naction:\n  - service: light.turn_on\n    target:\n      entity_id: light.obyvak`,
    hint: 'Pod `- service: light.turn_on` napiš `    target:` a pod něj `      entity_id: light.obyvak`.',
    blocks: [
      { label: '    target:\n      entity_id: light.obyvak', snippet: '    target:\n      entity_id: light.obyvak' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const actions = Array.isArray(obj.action) ? obj.action : [];
      const first = (actions[0] || {}) as Record<string, unknown>;
      const target = (first.target && typeof first.target === 'object' ? first.target : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'Služba light.turn_on je definována', ok: first.service === 'light.turn_on' || first.action === 'light.turn_on' },
        { label: 'Blok target: je použit', ok: Boolean(first.target && typeof first.target === 'object') },
        { label: 'entity_id je uvnitř target:', ok: target.entity_id === 'light.obyvak' && !('entity_id' in first) },
      ];
      return buildResult(checks, diagnostics, 'Čistá práce! Používat entity_id místo device_id ti ušetří hodiny při výměně žárovky.');
    },
  },
  {
    id: 'w3-4',
    worldId: 3,
    worldTitle: 'Svět 3: Home Assistant Automatizace',
    order: 4,
    title: 'Boss Fight: Přetopený obývák',
    mode: 'ha',
    difficulty: 'hard',
    durationLabel: '3 min',
    isBoss: true,
    bossTimeSec: 90,
    bossMaxAttempts: 5,
    brief: 'KRIZOVÁ SITUACE! V obýváku je 29 °C! Automatizace má nastavenou `temperature: 29` a chybně umístěné `entity_id`. Sniž teplotu na `21` a oprav `target:` dřív, než se byt přetopí!',
    starterCode: `alias: Havarijni chlazeni\ntrigger:\n  - platform: numeric_state\n    entity_id: sensor.obyvak_teplota\n    above: 25\naction:\n  - service: climate.set_temperature\n    entity_id: climate.obyvak\n    data:\n      temperature: 29`,
    solutionCode: `alias: Havarijni chlazeni\ntrigger:\n  - platform: numeric_state\n    entity_id: sensor.obyvak_teplota\n    above: 25\naction:\n  - service: climate.set_temperature\n    target:\n      entity_id: climate.obyvak\n    data:\n      temperature: 21`,
    hint: 'Vlož `entity_id: climate.obyvak` pod `target:` a změň `temperature` na hodnotu `<= 22` (např. `21`).',
    blocks: [
      { label: '    target:\n      entity_id: climate.obyvak', snippet: '    target:\n      entity_id: climate.obyvak' },
      { label: '      temperature: 21', snippet: '      temperature: 21' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const actions = Array.isArray(obj.action) ? obj.action : [];
      const first = (actions[0] || {}) as Record<string, unknown>;
      const target = (first.target && typeof first.target === 'object' ? first.target : {}) as Record<string, unknown>;
      const data = (first.data && typeof first.data === 'object' ? first.data : {}) as Record<string, unknown>;
      const temp = Number(data.temperature);
      const checks: ValidationCheck[] = [
        { label: 'entity_id správně pod target:', ok: target.entity_id === 'climate.obyvak' && !('entity_id' in first) },
        { label: 'Cílová teplota snížena (<= 22 °C)', ok: !Number.isNaN(temp) && temp >= 16 && temp <= 22 },
      ];
      return buildResult(checks, diagnostics, 'Záchrana úspěšná! Termostat klesl na příjemných 21 °C.');
    },
  },

  // ================= SVĚT 4 =================
  {
    id: 'w4-1',
    worldId: 4,
    worldTitle: 'Svět 4: Senzory & Integrace',
    order: 1,
    title: 'I2C sběrnice & BME280',
    mode: 'esphome',
    difficulty: 'medium',
    durationLabel: '3 min',
    isBoss: false,
    brief: 'Zapoj senzor teploty a vlhkosti `bme280`. Nastav I2C piny (`sda: GPIO21`, `scl: GPIO22`) a přidej `address: 0x76`.',
    starterCode: `esphome:\n  name: meteo-stanice\n\nesp32:\n  board: esp32dev\n\ni2c:\n  sda: GPIO21\n  scl: \n\nsensor:\n  - platform: bme280_i2c\n    address: \n    temperature:\n      name: "Teplota Obyvak"`,
    solutionCode: `esphome:\n  name: meteo-stanice\n\nesp32:\n  board: esp32dev\n\ni2c:\n  sda: GPIO21\n  scl: GPIO22\n\nsensor:\n  - platform: bme280_i2c\n    address: 0x76\n    temperature:\n      name: "Teplota Obyvak"`,
    hint: 'Výchozí SCL pin na ESP32 je `GPIO22` a běžná adresa BME280 je `0x76`.',
    blocks: [
      { label: '  scl: GPIO22', snippet: '  scl: GPIO22' },
      { label: '    address: 0x76', snippet: '    address: 0x76' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const i2c = (obj.i2c && typeof obj.i2c === 'object' ? obj.i2c : {}) as Record<string, unknown>;
      const sensor = Array.isArray(obj.sensor) ? (obj.sensor[0] as Record<string, unknown>) : null;
      const checks: ValidationCheck[] = [
        { label: 'I2C piny sda a scl jsou nastaveny', ok: Boolean(i2c.sda && i2c.scl) },
        { label: 'Senzor BME280 má adresu (např. 0x76)', ok: Boolean(sensor && sensor.address) },
      ];
      return buildResult(checks, diagnostics, 'I2C sběrnice komunikuje! Podívej se na 3D drátky k BME280 senzoru.');
    },
  },
  {
    id: 'w4-2',
    worldId: 4,
    worldTitle: 'Svět 4: Senzory & Integrace',
    order: 2,
    title: 'Filtry dat (Median)',
    mode: 'esphome',
    difficulty: 'medium',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Surová data ze senzoru občas skáčou. Přidej pod `temperature:` seznam `filters:` s filtrem `- median:`.',
    starterCode: `sensor:\n  - platform: dht\n    pin: GPIO4\n    temperature:\n      name: "Teplota Dilna"\n      filters:\n        - `,
    solutionCode: `sensor:\n  - platform: dht\n    pin: GPIO4\n    temperature:\n      name: "Teplota Dilna"\n      filters:\n        - median:\n            window_size: 5`,
    hint: 'Pod `filters:` napiš `        - median:` nebo `        - sliding_window_moving_average:`.',
    blocks: [
      { label: '        - median:\n            window_size: 5', snippet: '        - median:\n            window_size: 5' },
      { label: '        - offset: -0.5', snippet: '        - offset: -0.5' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const sensor = Array.isArray(obj.sensor) ? (obj.sensor[0] as Record<string, unknown>) : null;
      const temp = (sensor?.temperature && typeof sensor.temperature === 'object' ? sensor.temperature : {}) as Record<string, unknown>;
      const filters = Array.isArray(temp.filters) ? temp.filters : [];
      const hasMedianOrWindow = filters.some((f) => {
        if (typeof f === 'string') return f === 'median' || f === 'sliding_window_moving_average';
        if (f && typeof f === 'object') return 'median' in f || 'sliding_window_moving_average' in f;
        return false;
      });
      const checks: ValidationCheck[] = [
        { label: 'Blok filters pod temperature', ok: filters.length > 0 },
        { label: 'Obsahuje median nebo sliding_window', ok: hasMedianOrWindow },
      ];
      return buildResult(checks, diagnostics, 'Šum vyhlazen! Graf teploty už nebude lítat nahoru a dolů.');
    },
  },
  {
    id: 'w4-3',
    worldId: 4,
    worldTitle: 'Svět 4: Senzory & Integrace',
    order: 3,
    title: 'MQTT Broker integrace',
    mode: 'esphome',
    difficulty: 'medium',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Připoj zařízení na `mqtt:` broker s adresou `broker: 192.168.1.10` a nastav `topic_prefix: dum/obyvak`.',
    starterCode: `esphome:\n  name: mqtt-uzel\n\nmqtt:\n  broker: 192.168.1.10\n  `,
    solutionCode: `esphome:\n  name: mqtt-uzel\n\nmqtt:\n  broker: 192.168.1.10\n  topic_prefix: dum/obyvak`,
    hint: 'Doplň `  topic_prefix: dum/obyvak` pod blok `mqtt:`.',
    blocks: [
      { label: '  topic_prefix: dum/obyvak', snippet: '  topic_prefix: dum/obyvak' },
      { label: '  username: mqtt_user', snippet: '  username: mqtt_user' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const mqtt = (obj.mqtt && typeof obj.mqtt === 'object' ? obj.mqtt : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'mqtt.broker je vyplněn', ok: typeof mqtt.broker === 'string' && mqtt.broker.length > 0 },
        { label: 'mqtt.topic_prefix je vyplněn', ok: typeof mqtt.topic_prefix === 'string' && mqtt.topic_prefix.length > 0 },
      ];
      return buildResult(checks, diagnostics, 'MQTT uzel připojen! Zprávy už proudí do brokera.');
    },
  },
  {
    id: 'w4-4',
    worldId: 4,
    worldTitle: 'Svět 4: Senzory & Integrace',
    order: 4,
    title: 'Boss Fight: Výpadek telemetrie',
    mode: 'esphome',
    difficulty: 'hard',
    durationLabel: '3 min',
    isBoss: true,
    bossTimeSec: 100,
    bossMaxAttempts: 5,
    brief: 'SERVEROVNA HOŘÍ! I2C je napojené na zakázaný flash pin `GPIO7`, chybí `scl: GPIO22` a u MQTT chybí `broker`. Oprav vše v limitu!',
    starterCode: `esphome:\n  name: serverovna-cidlo\n\ni2c:\n  sda: GPIO7\n\nmqtt:\n  topic_prefix: serverovna/rack\n\nsensor:\n  - platform: bme280_i2c\n    address: 0x76`,
    solutionCode: `esphome:\n  name: serverovna-cidlo\n\ni2c:\n  sda: GPIO21\n  scl: GPIO22\n\nmqtt:\n  broker: 192.168.1.10\n  topic_prefix: serverovna/rack\n\nsensor:\n  - platform: bme280_i2c\n    address: 0x76`,
    hint: 'Změň `sda` na `GPIO21`, přidej `scl: GPIO22` a pod `mqtt:` přidej `broker: 192.168.1.10`.',
    blocks: [
      { label: '  sda: GPIO21\n  scl: GPIO22', snippet: '  sda: GPIO21\n  scl: GPIO22' },
      { label: '  broker: 192.168.1.10', snippet: '  broker: 192.168.1.10' },
    ],
    validate: (_code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const i2c = (obj.i2c && typeof obj.i2c === 'object' ? obj.i2c : {}) as Record<string, unknown>;
      const mqtt = (obj.mqtt && typeof obj.mqtt === 'object' ? obj.mqtt : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'I2C má bezpečné piny sda i scl', ok: Boolean(i2c.sda && i2c.scl) && !/GPIO(6|7|8|9|10|11)/i.test(String(i2c.sda)) },
        { label: 'MQTT broker je definován', ok: typeof mqtt.broker === 'string' && mqtt.broker.length > 0 },
      ];
      return buildResult(checks, diagnostics, 'Telemetrie serverovny obnovena! Žádný flash pin už nezamrzá.');
    },
  },

  // ================= SVĚT 5 =================
  {
    id: 'w5-1',
    worldId: 5,
    worldTitle: 'Svět 5: Pokročilý Jinja2 & Šablony',
    order: 1,
    title: 'Renderování stavů {{ states() }}',
    mode: 'ha',
    difficulty: 'medium',
    durationLabel: '2 min',
    isBoss: false,
    brief: 'Vytvoř šablonový senzor, jehož `state:` vypíše aktuální teplotu pomocí `{{ states(\'sensor.obyvak_teplota\') }}`.',
    starterCode: `template:\n  - sensor:\n      - name: "Rychly Prehled Teploty"\n        unit_of_measurement: "°C"\n        state: "Teplota je "`,
    solutionCode: `template:\n  - sensor:\n      - name: "Rychly Prehled Teploty"\n        unit_of_measurement: "°C"\n        state: "{{ states('sensor.obyvak_teplota') }}"`,
    hint: 'Vlož do `state:` výraz `"{{ states(\'sensor.obyvak_teplota\') }}"`.',
    blocks: [
      { label: '{{ states(\'sensor.obyvak_teplota\') }}', snippet: `"{{ states('sensor.obyvak_teplota') }}"` },
    ],
    validate: (code, _parsed, diagnostics) => {
      const hasStates = /\{\{\s*states\(['"]sensor\.obyvak_teplota['"]\)/.test(code);
      const checks: ValidationCheck[] = [
        { label: 'Platný YAML bez chyb závorek', ok: diagnostics.filter((d) => d.severity === 'error').length === 0 },
        { label: 'Použití {{ states(\'sensor.obyvak_teplota\') }}', ok: hasStates },
      ];
      return buildResult(checks, diagnostics, 'Šablona žije! V náhledu vpravo vidíš její aktuální vyrenderovanou hodnotu.');
    },
  },
  {
    id: 'w5-2',
    worldId: 5,
    worldTitle: 'Svět 5: Pokročilý Jinja2 & Šablony',
    order: 2,
    title: 'Podmínky {% if %} v šabloně',
    mode: 'ha',
    difficulty: 'hard',
    durationLabel: '3 min',
    isBoss: false,
    brief: 'Napiš víceřádkovou Jinja2 šablonu (`>`), která zobrazí `"Větrej!"` pokud je `states(\'sensor.obyvak_teplota\') | float(0) > 24`, jinak `"Pohoda"`.',
    starterCode: `template:\n  - sensor:\n      - name: "Rada pro vetrani"\n        state: >\n          {% if states('sensor.obyvak_teplota') | float(0) > 24 %}\n            Větrej!\n          {% else %}\n            Pohoda\n          `,
    solutionCode: `template:\n  - sensor:\n      - name: "Rada pro vetrani"\n        state: >\n          {% if states('sensor.obyvak_teplota') | float(0) > 24 %}\n            Větrej!\n          {% else %}\n            Pohoda\n          {% endif %}`,
    hint: 'Každý blok `{% if ... %}` musí v Jinja2 končit uzavíracím tagem `{% endif %}`.',
    blocks: [
      { label: '          {% endif %}', snippet: '          {% endif %}' },
      { label: '          {% else %}', snippet: '          {% else %}' },
    ],
    validate: (code, _parsed, diagnostics) => {
      const hasIf = /\{%\s*if\s+/.test(code);
      const hasEndif = /\{%\s*endif\s*%\}/.test(code);
      const checks: ValidationCheck[] = [
        { label: 'Blok {% if ... %} otevřen', ok: hasIf },
        { label: 'Blok {% endif %} správně uzavřen', ok: hasEndif },
        { label: 'Bez syntaktických chyb YAML/Jinja2', ok: diagnostics.filter((d) => d.severity === 'error').length === 0 },
      ];
      return buildResult(checks, diagnostics, 'Skvělé! Vyzkoušej si posuvník teploty vpravo a sleduj, jak se věta mění.');
    },
  },
  {
    id: 'w5-3',
    worldId: 5,
    worldTitle: 'Svět 5: Pokročilý Jinja2 & Šablony',
    order: 3,
    title: 'Chytrá notifikace s | float',
    mode: 'ha',
    difficulty: 'hard',
    durationLabel: '3 min',
    isBoss: false,
    brief: 'Vytvoř notifikační akci `notify.mobile_app`, která v `message:` spojí podmínku `is_state(\'binary_sensor.okno\', \'on\')` s teplotou.',
    starterCode: `alias: Upozorneni na otevrene okno\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.okno\n    to: "on"\naction:\n  - service: notify.mobile_app\n    data:\n      message: >\n        {% if is_state('binary_sensor.okno', 'on') %}\n          Okno je otevřené při {{ states('sensor.obyvak_teplota') }} °C!\n        `,
    solutionCode: `alias: Upozorneni na otevrene okno\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.okno\n    to: "on"\naction:\n  - service: notify.mobile_app\n    data:\n      message: >\n        {% if is_state('binary_sensor.okno', 'on') %}\n          Okno je otevřené při {{ states('sensor.obyvak_teplota') }} °C!\n        {% endif %}`,
    hint: 'Uzavři podmínku na konci zprávy pomocí `        {% endif %}`.',
    blocks: [{ label: '        {% endif %}', snippet: '        {% endif %}' }],
    validate: (code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'Akce notify.mobile_app je definována', ok: Array.isArray(obj.action) },
        { label: 'Použito is_state(...) a {{ states(...) }}', ok: /is_state\(/.test(code) && /\{\{\s*states\(/.test(code) },
        { label: 'Ukončeno {% endif %}', ok: /\{%\s*endif\s*%\}/.test(code) },
      ];
      return buildResult(checks, diagnostics, 'Notifikace vypadá jako od profesionála!');
    },
  },
  {
    id: 'w5-4',
    worldId: 5,
    worldTitle: 'Svět 5: Pokročilý Jinja2 & Šablony',
    order: 4,
    title: 'Finální Boss: Totální výpadek domu',
    mode: 'ha',
    difficulty: 'hard',
    durationLabel: '4 min',
    isBoss: true,
    bossTimeSec: 120,
    bossMaxAttempts: 5,
    brief: 'FINÁLNÍ ZÁCHRANA! Hlavní automatizace má rozbité odsazení, `entity_id` mimo `target:`, a neuzavřenou Jinja2 závorku `{{ ... }}`. Zachraň chytrý dům!',
    starterCode: `alias: Hlavni ochrana domu\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.okno\n    to: "on"\naction:\n  - service: climate.turn_off\n    entity_id: climate.obyvak\n  - service: notify.mobile_app\n    data:\n      message: "Topení vypnuto při {{ states('sensor.obyvak_teplota') °C"`,
    solutionCode: `alias: Hlavni ochrana domu\ntrigger:\n  - platform: state\n    entity_id: binary_sensor.okno\n    to: "on"\naction:\n  - service: climate.turn_off\n    target:\n      entity_id: climate.obyvak\n  - service: notify.mobile_app\n    data:\n      message: "Topení vypnuto při {{ states('sensor.obyvak_teplota') }} °C"`,
    hint: '1) Obal `entity_id: climate.obyvak` do `target:`. 2) Doplň uzavírací `}}` za `states(\'sensor.obyvak_teplota\')`.',
    blocks: [
      { label: '    target:\n      entity_id: climate.obyvak', snippet: '    target:\n      entity_id: climate.obyvak' },
      { label: "      message: \"Topení vypnuto při {{ states('sensor.obyvak_teplota') }} °C\"", snippet: "      message: \"Topení vypnuto při {{ states('sensor.obyvak_teplota') }} °C\"" },
    ],
    validate: (code, parsed, diagnostics) => {
      const obj = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
      const actions = Array.isArray(obj.action) ? obj.action : [];
      const first = (actions[0] || {}) as Record<string, unknown>;
      const target = (first.target && typeof first.target === 'object' ? first.target : {}) as Record<string, unknown>;
      const checks: ValidationCheck[] = [
        { label: 'entity_id u climate.turn_off pod target:', ok: target.entity_id === 'climate.obyvak' && !('entity_id' in first) },
        { label: 'Uzavřená Jinja2 šablona {{ ... }}', ok: /\{\{\s*states\('sensor\.obyvak_teplota'\)\s*\}\}/.test(code) },
        { label: 'Bez chyb syntaxe', ok: diagnostics.filter((d) => d.severity === 'error').length === 0 },
      ];
      return buildResult(checks, diagnostics, 'MISTR YAML! Celý chytrý dům běží bez jediné chybičky!');
    },
  },
];

export function filterLessonsByDifficulty(lessons: LessonNode[], filter: DifficultyFilter): LessonNode[] {
  if (filter === 'all') return lessons;
  return lessons.filter((lesson) => lesson.difficulty === filter);
}

export function countLessonsByDifficulty(lessons: LessonNode[]): Record<DifficultyFilter, number> {
  const counts: Record<DifficultyFilter, number> = {
    all: lessons.length,
    easy: 0,
    medium: 0,
    hard: 0,
  };
  for (const lesson of lessons) {
    counts[lesson.difficulty] += 1;
  }
  return counts;
}
