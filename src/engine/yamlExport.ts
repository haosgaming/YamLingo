import type { LessonMode } from './curriculum';

export type ExportTarget = 'homeassistant' | 'esphome';
export type HomeAssistantExportFormat = 'direct' | 'package';
export type EspHomeExportFormat = 'complete' | 'raw';

export interface ExportBuildParams {
  code: string;
  target: ExportTarget;
  parsed: unknown;
  lessonId: string;
  lessonTitle: string;
  haFormat?: HomeAssistantExportFormat;
  esphomeFormat?: EspHomeExportFormat;
}

export interface ExportBuildResult {
  content: string;
  addedSections: string[];
  detectedKind: string;
  notes: string;
  isAutomationObject: boolean;
}

const CZECH_CHAR_MAP: Record<string, string> = {
  á: 'a',
  ä: 'a',
  č: 'c',
  ď: 'd',
  é: 'e',
  ě: 'e',
  ë: 'e',
  í: 'i',
  ň: 'n',
  ó: 'o',
  ö: 'o',
  ř: 'r',
  š: 's',
  ť: 't',
  ú: 'u',
  ů: 'u',
  ü: 'u',
  ý: 'y',
  ž: 'z',
};

export function slugifyYamlFilename(input: string): string {
  const lowered = input.trim().toLowerCase();
  let ascii = '';
  for (const ch of lowered) {
    ascii += CZECH_CHAR_MAP[ch] ?? ch;
  }
  const normalized = ascii
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return normalized || 'config';
}

export function ensureYamlExtension(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return 'config.yaml';
  if (/\.ya?ml$/i.test(trimmed)) return trimmed;
  return `${trimmed}.yaml`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function hasRootKey(code: string, parsedObj: Record<string, unknown>, key: string): boolean {
  if (key in parsedObj) return true;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\s*:`, 'm').test(code);
}

export function normalizeLineEndingsLf(code: string): string {
  const normalized = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  return normalized ? `${normalized}\n` : '\n';
}

export function detectDefaultExportTarget(
  lessonMode: LessonMode,
  parsed: unknown
): ExportTarget {
  const obj = asRecord(parsed);
  if (
    'esphome' in obj ||
    'esp32' in obj ||
    'esp8266' in obj ||
    'i2c' in obj ||
    'output' in obj
  ) {
    return 'esphome';
  }
  if (
    'alias' in obj ||
    'trigger' in obj ||
    'triggers' in obj ||
    'action' in obj ||
    'actions' in obj ||
    'template' in obj ||
    'homeassistant' in obj ||
    'automation' in obj
  ) {
    return 'homeassistant';
  }
  return lessonMode === 'esphome' ? 'esphome' : 'homeassistant';
}

export function isStandaloneAutomation(code: string, parsed: unknown): boolean {
  const obj = asRecord(parsed);
  const hasRootDomain =
    hasRootKey(code, obj, 'automation') ||
    hasRootKey(code, obj, 'homeassistant') ||
    hasRootKey(code, obj, 'template') ||
    hasRootKey(code, obj, 'esphome');
  if (hasRootDomain) return false;

  return (
    hasRootKey(code, obj, 'alias') ||
    hasRootKey(code, obj, 'trigger') ||
    hasRootKey(code, obj, 'triggers') ||
    hasRootKey(code, obj, 'action') ||
    hasRootKey(code, obj, 'actions')
  );
}

export function suggestExportFilename(params: {
  target: ExportTarget;
  parsed: unknown;
  lessonId: string;
  lessonTitle: string;
  haFormat?: HomeAssistantExportFormat;
}): string {
  const obj = asRecord(params.parsed);

  if (params.target === 'esphome') {
    const esphomeObj = asRecord(obj.esphome);
    if (typeof esphomeObj.name === 'string' && esphomeObj.name.trim()) {
      return `${slugifyYamlFilename(esphomeObj.name)}.yaml`;
    }
    return `${slugifyYamlFilename(`${params.lessonId}-${params.lessonTitle}`)}.yaml`;
  }

  if (typeof obj.alias === 'string' && obj.alias.trim()) {
    return `${slugifyYamlFilename(obj.alias)}.yaml`;
  }
  if ('homeassistant' in obj) {
    return 'configuration.yaml';
  }
  if ('template' in obj) {
    return `${slugifyYamlFilename(`${params.lessonId}-template`)}.yaml`;
  }
  return `${slugifyYamlFilename(`${params.lessonId}-${params.lessonTitle}`)}.yaml`;
}

function wrapAutomationAsPackage(normalizedCode: string, slug: string, hasId: boolean): string {
  const lines = normalizedCode.trimEnd().split('\n');
  const leadingComments: string[] = [];
  let idx = 0;

  while (idx < lines.length && (!lines[idx].trim() || lines[idx].trim().startsWith('#'))) {
    if (lines[idx].trim()) {
      leadingComments.push(lines[idx]);
    }
    idx += 1;
  }

  const bodyLines = lines.slice(idx);
  const out: string[] = [];
  if (leadingComments.length > 0) {
    out.push(...leadingComments);
  }
  out.push('automation:');

  if (bodyLines.length === 0) {
    out.push(`  - id: "${slug}"`);
    return `${out.join('\n')}\n`;
  }

  if (hasId) {
    out.push(`  - ${bodyLines[0]}`);
    for (let i = 1; i < bodyLines.length; i += 1) {
      out.push(bodyLines[i].trim() ? `    ${bodyLines[i]}` : '');
    }
  } else {
    out.push(`  - id: "${slug}"`);
    for (const line of bodyLines) {
      out.push(line.trim() ? `    ${line}` : '');
    }
  }

  return `${out.join('\n')}\n`;
}

export function buildExportableYaml(params: ExportBuildParams): ExportBuildResult {
  const normalized = normalizeLineEndingsLf(params.code);
  const obj = asRecord(params.parsed);
  const haFormat = params.haFormat ?? 'direct';
  const esphomeFormat = params.esphomeFormat ?? 'complete';
  const standaloneAutomation = isStandaloneAutomation(normalized, params.parsed);

  if (params.target === 'esphome') {
    if (esphomeFormat === 'raw') {
      return {
        content: normalized,
        addedSections: [],
        detectedKind: 'Aktuální YAML z editoru (1:1)',
        notes: 'Obsah přesně odpovídá kódu v editoru (UTF-8, konce řádků UNIX LF).',
        isAutomationObject: standaloneAutomation,
      };
    }

    const addedSections: string[] = [];
    const headerBlocks: string[] = [];
    const footerBlocks: string[] = [];

    const esphomeObj = asRecord(obj.esphome);
    const deviceSlug =
      typeof esphomeObj.name === 'string' && esphomeObj.name.trim()
        ? slugifyYamlFilename(esphomeObj.name)
        : slugifyYamlFilename(`${params.lessonId}-${params.lessonTitle}`);

    if (!hasRootKey(normalized, obj, 'esphome')) {
      addedSections.push('esphome');
      headerBlocks.push(`esphome:\n  name: ${deviceSlug}`);
    }

    const hasPlatform =
      hasRootKey(normalized, obj, 'esp32') ||
      hasRootKey(normalized, obj, 'esp8266') ||
      hasRootKey(normalized, obj, 'rp2040') ||
      hasRootKey(normalized, obj, 'bk72xx') ||
      hasRootKey(normalized, obj, 'rtl87xx');

    if (!hasPlatform) {
      addedSections.push('esp32');
      headerBlocks.push('esp32:\n  board: esp32dev');
    }

    if (!hasRootKey(normalized, obj, 'logger')) {
      addedSections.push('logger');
      footerBlocks.push('logger:');
    }

    if (!hasRootKey(normalized, obj, 'api')) {
      addedSections.push('api');
      footerBlocks.push('api:');
    }

    if (!hasRootKey(normalized, obj, 'ota')) {
      addedSections.push('ota');
      footerBlocks.push('ota:\n  - platform: esphome');
    }

    if (!hasRootKey(normalized, obj, 'wifi')) {
      addedSections.push('wifi');
      footerBlocks.push(
        'wifi:\n  ssid: !secret wifi_ssid\n  password: !secret wifi_password'
      );
    }

    const parts: string[] = [];
    if (headerBlocks.length > 0) parts.push(headerBlocks.join('\n\n'));
    if (normalized.trim()) parts.push(normalized.trimEnd());
    if (footerBlocks.length > 0) parts.push(footerBlocks.join('\n\n'));

    return {
      content: `${parts.join('\n\n')}\n`,
      addedSections,
      detectedKind: 'Kompletní ESPHome konfigurace (.yaml)',
      notes:
        addedSections.length > 0
          ? 'Doplněny povinné základní sekce, aby šel soubor rovnou nahrát do ESPHome Dashboardu.'
          : 'Konfigurace už obsahuje všechny povinné ESPHome sekce.',
      isAutomationObject: standaloneAutomation,
    };
  }

  // Home Assistant export
  if (haFormat === 'package' && standaloneAutomation) {
    const slug = slugifyYamlFilename(
      typeof obj.alias === 'string' && obj.alias.trim()
        ? obj.alias
        : `${params.lessonId}_${params.lessonTitle}`
    ).replace(/-/g, '_');
    const hasId = hasRootKey(normalized, obj, 'id');
    return {
      content: wrapAutomationAsPackage(normalized, slug, hasId),
      addedSections: hasId ? ['automation'] : ['automation', 'id'],
      detectedKind: 'Home Assistant balíček (packages/*.yaml)',
      notes: 'Automatizace je zabalena pod klíč automation:, takže soubor stačí vložit do složky /config/packages/.',
      isAutomationObject: true,
    };
  }

  if (standaloneAutomation) {
    return {
      content: normalized,
      addedSections: [],
      detectedKind: 'Home Assistant automatizace (UI YAML)',
      notes: 'Vhodné pro přímé vložení v Home Assistant: Nastavení → Automatizace → Upravit v YAML.',
      isAutomationObject: true,
    };
  }

  if (hasRootKey(normalized, obj, 'template')) {
    return {
      content: normalized,
      addedSections: [],
      detectedKind: 'Home Assistant Template senzor',
      notes: 'Připraveno pro configuration.yaml nebo soubor v /config/packages/.',
      isAutomationObject: false,
    };
  }

  if (hasRootKey(normalized, obj, 'homeassistant') || hasRootKey(normalized, obj, 'automation')) {
    return {
      content: normalized,
      addedSections: [],
      detectedKind: 'Home Assistant configuration.yaml',
      notes: 'Obsahuje kořenovou konfiguraci Home Assistant (UTF-8, UNIX LF).',
      isAutomationObject: false,
    };
  }

  return {
    content: normalized,
    addedSections: [],
    detectedKind: 'Obecný YAML soubor',
    notes: 'Exportováno v čistém formátu UTF-8 bez BOM s UNIX konci řádků (LF).',
    isAutomationObject: false,
  };
}
