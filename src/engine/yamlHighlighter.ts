export type YamlTokenType =
  | 'whitespace'
  | 'dash'
  | 'key'
  | 'colon'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'jinja'
  | 'comment'
  | 'operator'
  | 'text';

export interface YamlToken {
  type: YamlTokenType;
  value: string;
}

export const YAML_TOKEN_COLOR: Record<YamlTokenType, string> = {
  whitespace: 'transparent',
  dash: 'var(--accent)',
  key: 'var(--syntax-key)',
  colon: 'var(--text-muted)',
  string: 'var(--syntax-string)',
  number: 'var(--syntax-number)',
  boolean: 'var(--syntax-bool)',
  null: 'var(--text-muted)',
  jinja: 'var(--syntax-jinja)',
  comment: 'var(--syntax-comment)',
  operator: 'var(--accent)',
  text: 'var(--text-primary)',
};

/**
 * Splits a non-leading YAML segment into active YAML content and any trailing
 * `# comment` outside single/double quotes or Jinja2 blocks.
 */
function splitInlineComment(segment: string): { code: string; comment: string } {
  let quote: '"' | "'" | null = null;
  let inJinja: '}}' | '%}' | '#}' | null = null;

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    const next = segment[i + 1];

    if (inJinja) {
      if (ch === inJinja[0] && next === inJinja[1]) {
        inJinja = null;
        i++;
      }
      continue;
    }

    if (quote) {
      if (quote === '"' && ch === '\\') {
        i++; // skip escaped character
        continue;
      }
      if (quote === "'" && ch === "'" && next === "'") {
        i++; // skip doubled single quote
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '{' && (next === '{' || next === '%' || next === '#')) {
      inJinja = next === '{' ? '}}' : next === '%' ? '%}' : '#}';
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    // YAML starts a comment at `#` when at index 0 or preceded by whitespace
    if (ch === '#' && (i === 0 || /\s/.test(segment[i - 1]))) {
      return {
        code: segment.slice(0, i),
        comment: segment.slice(i),
      };
    }
  }

  return { code: segment, comment: '' };
}

/**
 * Finds the separator `:` index of a YAML mapping key in `content`, ignoring
 * colons inside quotes (e.g. "12:30") or unquoted URLs (`http://...`).
 */
function findMappingColonIndex(content: string): number {
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (quote) {
      if (quote === '"' && ch === '\\') {
        i++;
        continue;
      }
      if (quote === "'" && ch === "'" && next === "'") {
        i++;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '{' && (next === '{' || next === '%')) {
      return -1;
    }

    if (ch === '"' || ch === "'") {
      if (i === 0) {
        quote = ch;
        continue;
      }
      return -1;
    }

    if (ch === ':') {
      // Valid YAML key-value delimiter: colon at end of line or followed by space/tab
      if (i > 0 && (i + 1 === content.length || content[i + 1] === ' ' || content[i + 1] === '\t')) {
        return i;
      }
      // Colon followed by non-space (like http:// or 12:30) is part of a scalar value
      return -1;
    }
  }

  return -1;
}

function tokenizeValueSegment(value: string): YamlToken[] {
  if (!value) return [];

  const tokens: YamlToken[] = [];
  const leadSpaceMatch = value.match(/^([ \t]+)(.*)$/);
  const lead = leadSpaceMatch ? leadSpaceMatch[1] : '';
  const body = leadSpaceMatch ? leadSpaceMatch[2] : value;

  if (lead) {
    tokens.push({ type: 'text', value: lead });
  }
  if (!body) {
    return tokens;
  }

  const trailSpaceMatch = body.match(/^(.*?)([ \t]+)$/);
  const core = trailSpaceMatch ? trailSpaceMatch[1] : body;
  const trail = trailSpaceMatch ? trailSpaceMatch[2] : '';

  if (core.includes('{{') || core.includes('{%') || core.includes('{#')) {
    const parts = core.split(/(\{\{.*?\}\}|\{%.*?%\}|\{#.*?#\})/g);
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('{{') || part.startsWith('{%') || part.startsWith('{#')) {
        tokens.push({ type: 'jinja', value: part });
      } else {
        tokens.push({ type: 'string', value: part });
      }
    }
  } else if (/^([|>][+-]?|[&*][a-zA-Z0-9_-]+|![a-zA-Z0-9_-]+)$/.test(core)) {
    tokens.push({ type: 'operator', value: core });
  } else if (/^(true|false|yes|no|on|off)$/i.test(core)) {
    tokens.push({ type: 'boolean', value: core });
  } else if (/^(null|~)$/i.test(core)) {
    tokens.push({ type: 'null', value: core });
  } else if (/^-?\d+(\.\d+)?$|^0x[0-9a-fA-F]+$/.test(core)) {
    tokens.push({ type: 'number', value: core });
  } else {
    tokens.push({ type: 'string', value: core });
  }

  if (trail) {
    tokens.push({ type: 'text', value: trail });
  }

  return tokens;
}

/**
 * Lightweight, lossless YAML line tokenizer.
 * Invariant: joining all returned token values strictly equals `line`.
 */
export function tokenizeYamlLine(line: string): YamlToken[] {
  if (line.length === 0) return [];

  const tokens: YamlToken[] = [];
  const leadingMatch = line.match(/^([ \t]*)(.*)$/);
  const leading = leadingMatch ? leadingMatch[1] : '';
  const rest = leadingMatch ? leadingMatch[2] : line;

  if (leading) {
    tokens.push({ type: 'whitespace', value: leading });
  }

  if (!rest) {
    return tokens;
  }

  // Document start/end separators
  const docMatch = rest.match(/^(---|\.\.\.)(\s*#.*|\s*)$/);
  if (docMatch) {
    tokens.push({ type: 'operator', value: docMatch[1] });
    const suffix = docMatch[2];
    if (suffix) {
      const { code, comment } = splitInlineComment(suffix);
      if (code) tokens.push({ type: 'text', value: code });
      if (comment) tokens.push({ type: 'comment', value: comment });
    }
    return tokens;
  }

  const { code, comment } = splitInlineComment(rest);

  if (code) {
    let content = code;
    const listPrefixMatch = content.match(/^(-\s+|-)(.*)$/);
    if (listPrefixMatch && (listPrefixMatch[1].length > 1 || listPrefixMatch[2] === '')) {
      tokens.push({ type: 'dash', value: listPrefixMatch[1] });
      content = listPrefixMatch[2];
    }

    if (content) {
      const colonIdx = findMappingColonIndex(content);
      if (colonIdx > 0) {
        const keyPart = content.slice(0, colonIdx);
        const afterColon = content.slice(colonIdx + 1);
        tokens.push({ type: 'key', value: keyPart });
        tokens.push({ type: 'colon', value: ':' });
        tokens.push(...tokenizeValueSegment(afterColon));
      } else {
        tokens.push(...tokenizeValueSegment(content));
      }
    }
  }

  if (comment) {
    tokens.push({ type: 'comment', value: comment });
  }

  return tokens;
}
