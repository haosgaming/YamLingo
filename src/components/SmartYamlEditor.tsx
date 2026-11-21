import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, GripVertical, Sparkles, Wand2 } from 'lucide-react';
import type { CodeBlock } from '../engine/curriculum';
import { autoFixYaml, type YamlDiagnostic } from '../engine/yamlValidator';
import { soundEngine } from '../utils/soundEngine';

interface SmartYamlEditorProps {
  value: string;
  onChange: (next: string) => void;
  diagnostics: YamlDiagnostic[];
  blocks?: CodeBlock[];
  shakeKey?: number;
  readOnly?: boolean;
}

const INDENT_GUIDE_COLORS = [
  'rgba(125, 168, 214, 0.28)',
  'rgba(143, 191, 159, 0.28)',
  'rgba(217, 176, 114, 0.28)',
  'rgba(167, 151, 209, 0.28)',
];

function renderHighlightedLine(
  line: string,
  showWhitespace: boolean
): React.ReactNode {
  if (!line) return ' ';

  const leadingMatch = line.match(/^([ \t]*)(.*)$/);
  const leading = leadingMatch ? leadingMatch[1] : '';
  const rest = leadingMatch ? leadingMatch[2] : line;

  // Render leading spaces/tabs with spatial markers
  const leadingNodes = Array.from(leading).map((ch, i) => {
    if (ch === '\t') {
      return (
        <span
          key={`w-${i}`}
          className="inline-block rounded-xs px-0.5 font-bold"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.28)', color: '#fca5a5' }}
        >
          →{' '}
        </span>
      );
    }
    return (
      <span
        key={`w-${i}`}
        style={{
          color: showWhitespace ? 'var(--text-muted)' : 'transparent',
          opacity: showWhitespace ? 0.65 : 0,
        }}
      >
        ·
      </span>
    );
  });

  // Comment line
  if (rest.startsWith('#')) {
    return (
      <>
        {leadingNodes}
        <span style={{ color: 'var(--syntax-comment)' }}>{rest}</span>
      </>
    );
  }

  // Highlight Jinja2 blocks inside rest
  const renderValueTokens = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return val;

    if (val.includes('{{') || val.includes('{%')) {
      const parts = val.split(/(\{\{.*?\}\}|\{%.*?%\})/g);
      return parts.map((p, idx) =>
        p.startsWith('{{') || p.startsWith('{%') ? (
          <span key={idx} style={{ color: 'var(--syntax-jinja)', fontWeight: 600 }}>
            {p}
          </span>
        ) : (
          <span key={idx} style={{ color: 'var(--syntax-string)' }}>
            {p}
          </span>
        )
      );
    }

    if (/^(true|false|yes|no|on|off)$/i.test(trimmed)) {
      return <span style={{ color: 'var(--syntax-bool)', fontWeight: 600 }}>{val}</span>;
    }
    if (/^-?\d+(\.\d+)?$|^0x[0-9a-fA-F]+$/.test(trimmed)) {
      return <span style={{ color: 'var(--syntax-number)' }}>{val}</span>;
    }
    return <span style={{ color: 'var(--syntax-string)' }}>{val}</span>;
  };

  // List dash + key: value or plain key: value
  const listPrefixMatch = rest.match(/^(-\s+)(.*)$/);
  const dashNode = listPrefixMatch ? (
    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{listPrefixMatch[1]}</span>
  ) : null;
  const content = listPrefixMatch ? listPrefixMatch[2] : rest;

  const kvMatch = content.match(/^([a-zA-Z0-9_.-]+)(:)(.*)$/);
  if (kvMatch) {
    return (
      <>
        {leadingNodes}
        {dashNode}
        <span style={{ color: 'var(--syntax-key)', fontWeight: 500 }}>{kvMatch[1]}</span>
        <span style={{ color: 'var(--text-muted)' }}>{kvMatch[2]}</span>
        {renderValueTokens(kvMatch[3])}
      </>
    );
  }

  return (
    <>
      {leadingNodes}
      {dashNode}
      {renderValueTokens(content)}
    </>
  );
}

export function SmartYamlEditor({
  value,
  onChange,
  diagnostics,
  blocks = [],
  shakeKey = 0,
  readOnly = false,
}: SmartYamlEditorProps) {
  const [showWhitespace, setShowWhitespace] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  const lines = useMemo(() => value.split(/\r?\n/), [value]);
  const errorLines = useMemo(() => {
    const map = new Map<number, YamlDiagnostic>();
    diagnostics.forEach((d) => {
      if (!map.has(d.line) || d.severity === 'error') {
        map.set(d.line, d);
      }
    });
    return map;
  }, [diagnostics]);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const insertSnippet = (snippet: string) => {
    if (readOnly) return;
    soundEngine.playPop();
    const ta = textareaRef.current;
    if (!ta) {
      onChange(value.trimEnd() + '\n' + snippet);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const needsNewlineBefore = before.length > 0 && !before.endsWith('\n');
    const insertion = (needsNewlineBefore ? '\n' : '') + snippet;
    const next = before + insertion + after;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = before.length + insertion.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly) return;
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (e.key === 'Tab') {
      e.preventDefault();
      const next = value.slice(0, start) + '  ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + 2, start + 2);
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.slice(lineStart, start);
      const indentMatch = currentLine.match(/^( *)/);
      let nextIndent = indentMatch ? indentMatch[1] : '';
      if (currentLine.trimEnd().endsWith(':')) {
        nextIndent += '  ';
      }
      const next = value.slice(0, start) + '\n' + nextIndent + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        const pos = start + 1 + nextIndent.length;
        ta.setSelectionRange(pos, pos);
      });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const snippet = e.dataTransfer.getData('text/plain');
    if (snippet) {
      insertSnippet(snippet);
    }
  };

  const hasFixableIssues = diagnostics.some(
    (d) =>
      d.code === 'TAB_INDENT' ||
      d.code === 'ODD_INDENT' ||
      d.code === 'MISSING_SPACE_AFTER_COLON'
  );

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;

  return (
    <div
      key={`shake-${shakeKey}`}
      className={`flex h-full flex-col overflow-hidden rounded-xl border ${
        shakeKey > 0 ? 'animate-editor-shake' : ''
      }`}
      style={{
        backgroundColor: 'var(--bg-editor)',
        borderColor: errorCount > 0 ? 'var(--danger)' : 'var(--border-subtle)',
      }}
    >
      {/* Editor Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
            config.yaml
          </span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span
            className="flex items-center gap-1.5 font-medium"
            style={{ color: errorCount > 0 ? 'var(--danger)' : 'var(--success)' }}
          >
            {errorCount > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                {errorCount} {errorCount === 1 ? 'chyba' : 'chyby'}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Syntaxe v pořádku
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWhitespace((s) => !s)}
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
            style={{
              backgroundColor: showWhitespace ? 'var(--accent-soft)' : 'transparent',
              borderColor: showWhitespace ? 'var(--accent)' : 'var(--border-subtle)',
              color: showWhitespace ? 'var(--accent)' : 'var(--text-secondary)',
            }}
            aria-pressed={showWhitespace}
          >
            <Eye className="h-3.5 w-3.5" />
            Mezery ({showWhitespace ? 'zap' : 'vyp'})
          </button>

          {hasFixableIssues && !readOnly && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playPop();
                onChange(autoFixYaml(value));
              }}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'var(--warning)',
                color: '#09090b',
              }}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Opravit odsazení
            </button>
          )}
        </div>
      </div>

      {/* Interactive Drag & Click Code Blocks */}
      {blocks.length > 0 && !readOnly && (
        <div
          className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            Vložit blok:
          </span>
          {blocks.map((block, idx) => (
            <button
              key={idx}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', block.snippet);
              }}
              onClick={() => insertSnippet(block.snippet)}
              className="flex items-center gap-1 rounded-md border px-2.5 py-1 font-mono text-xs transition-transform active:scale-95 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
              title="Klikni nebo přetáhni do editoru"
            >
              <GripVertical className="h-3 w-3 opacity-60" />
              {block.label.split('\n')[0].trim()}
            </button>
          ))}
        </div>
      )}

      {/* Main Editor Surface */}
      <div className="relative flex-1 min-h-[240px] overflow-hidden font-mono text-[13.5px] leading-[22px]">
        {/* Synchronized Highlight & Indent Guide Layer */}
        <div
          ref={backdropRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden py-3"
        >
          {lines.map((line, idx) => {
            const lineNum = idx + 1;
            const diag = errorLines.get(lineNum);
            const spaceMatch = line.match(/^( +)/);
            const indentDepth = spaceMatch ? Math.floor(spaceMatch[1].length / 2) : 0;

            return (
              <div
                key={idx}
                className="relative flex min-h-[22px] whitespace-pre px-3"
                style={{
                  backgroundColor:
                    diag?.severity === 'error'
                      ? 'rgba(239, 68, 68, 0.12)'
                      : diag?.severity === 'warning'
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'transparent',
                }}
              >
                {/* Line number */}
                <span
                  className="mr-4 inline-block w-7 shrink-0 select-none text-right tabular-nums text-xs leading-[22px]"
                  style={{
                    color: diag ? 'var(--danger)' : 'var(--text-muted)',
                    fontWeight: diag ? 700 : 400,
                  }}
                >
                  {lineNum}
                </span>

                {/* Vertical colored indentation guide lines */}
                <div className="relative flex-1">
                  {Array.from({ length: Math.min(indentDepth, 4) }).map((_, gIdx) => (
                    <span
                      key={gIdx}
                      className="pointer-events-none absolute top-0 bottom-0"
                      style={{
                        left: `${gIdx * 2}ch`,
                        width: '1.5px',
                        backgroundColor: INDENT_GUIDE_COLORS[gIdx % INDENT_GUIDE_COLORS.length],
                      }}
                    />
                  ))}
                  {renderHighlightedLine(line, showWhitespace)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actual Editable Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="YAML editor"
          className="yaml-input absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent py-3 pr-3 pl-[52px] font-mono text-[13.5px] leading-[22px] text-transparent caret-[var(--accent)] outline-none selection:bg-sky-500/30"
          style={{ tabSize: 2 }}
        />
      </div>

      {/* Real-Time Human-Readable Linter Footer */}
      {diagnostics.length > 0 && (
        <div
          className="max-h-32 overflow-y-auto border-t px-3 py-2 text-xs space-y-1.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {diagnostics.slice(0, 4).map((d, idx) => (
            <div key={idx} className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{
                    color: d.severity === 'error' ? 'var(--danger)' : 'var(--warning)',
                  }}
                />
                <span style={{ color: 'var(--text-primary)' }}>
                  <strong className="tabular-nums">Řádek {d.line}:</strong> {d.message}
                </span>
              </div>
              {d.quickFixLabel && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPop();
                    onChange(autoFixYaml(value));
                  }}
                  className="shrink-0 rounded px-2 py-0.5 font-medium underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {d.quickFixLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
