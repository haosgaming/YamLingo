import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FileCode2, GripVertical, Sparkles, Wand2 } from 'lucide-react';
import type { CodeBlock } from '../engine/curriculum';
import { autoFixYaml, type YamlDiagnostic } from '../engine/yamlValidator';
import { tokenizeYamlLine, YAML_TOKEN_COLOR } from '../engine/yamlHighlighter';
import { toggleYamlComments, unindentYamlSelection } from '../engine/yamlEditing';
import { soundEngine } from '../utils/soundEngine';
import { PSPadIntegrationModal } from './PSPadIntegrationModal';

interface SmartYamlEditorProps {
  value: string;
  onChange: (next: string) => void;
  diagnostics: YamlDiagnostic[];
  blocks?: CodeBlock[];
  shakeKey?: number;
  readOnly?: boolean;
  onSubmit?: () => void;
}

const INDENT_GUIDE_COLORS = [
  'rgba(125, 168, 214, 0.28)',
  'rgba(143, 191, 159, 0.28)',
  'rgba(217, 176, 114, 0.28)',
  'rgba(167, 151, 209, 0.28)',
];

function renderLeadingWhitespace(
  leading: string,
  showWhitespace: boolean,
  lineIdx: number
): React.ReactNode {
  return Array.from(leading).map((ch, i) => {
    if (ch === '\t') {
      return (
        <span
          key={`w-${lineIdx}-${i}`}
          className="inline-block w-[2ch] text-center"
          style={{
            backgroundColor: 'rgba(217, 107, 107, 0.24)',
            color: 'var(--danger)',
          }}
        >
          →
        </span>
      );
    }
    return (
      <span
        key={`w-${lineIdx}-${i}`}
        style={{
          color: showWhitespace ? 'var(--text-muted)' : 'transparent',
          opacity: showWhitespace ? 0.65 : 0,
        }}
      >
        ·
      </span>
    );
  });
}

function renderHighlightedLine(
  line: string,
  showWhitespace: boolean,
  lineIdx: number
): React.ReactNode {
  if (!line) return ' ';

  const tokens = tokenizeYamlLine(line);
  return tokens.map((token, tIdx) => {
    if (token.type === 'whitespace') {
      return (
        <React.Fragment key={`tok-${lineIdx}-${tIdx}`}>
          {renderLeadingWhitespace(token.value, showWhitespace, lineIdx)}
        </React.Fragment>
      );
    }

    return (
      <span
        key={`tok-${lineIdx}-${tIdx}`}
        data-token-type={token.type}
        style={{ color: YAML_TOKEN_COLOR[token.type] }}
      >
        {token.value}
      </span>
    );
  });
}

export function SmartYamlEditor({
  value,
  onChange,
  diagnostics,
  blocks = [],
  shakeKey = 0,
  readOnly = false,
  onSubmit,
}: SmartYamlEditorProps) {
  const [showWhitespace, setShowWhitespace] = useState(true);
  const [activeLine, setActiveLine] = useState(1);
  const [pspadOpen, setPspadOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

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

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (backdropRef.current) {
      backdropRef.current.scrollTop = ta.scrollTop;
      backdropRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  const syncActiveLine = (ta: HTMLTextAreaElement | null) => {
    if (!ta) return;
    const pos = ta.selectionStart ?? 0;
    const lineNum = ta.value.slice(0, pos).split(/\r?\n/).length;
    setActiveLine(lineNum);
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
      syncActiveLine(ta);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
      return;
    }

    if (readOnly) return;
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      const res = toggleYamlComments(value, start, end);
      onChange(res.value);
      soundEngine.playPop();
      requestAnimationFrame(() => {
        ta.setSelectionRange(res.selectionStart, res.selectionEnd);
        syncActiveLine(ta);
      });
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      const fixed = autoFixYaml(value);
      if (fixed !== value) {
        onChange(fixed);
        soundEngine.playPop();
      }
      return;
    }

    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      const res = unindentYamlSelection(value, start, end);
      onChange(res.value);
      requestAnimationFrame(() => {
        ta.setSelectionRange(res.selectionStart, res.selectionEnd);
        syncActiveLine(ta);
      });
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const next = value.slice(0, start) + '  ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + 2, start + 2);
        syncActiveLine(ta);
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
        syncActiveLine(ta);
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

          {!readOnly && (
            <button
              type="button"
              data-testid="editor-pspad-btn"
              onClick={() => {
                soundEngine.playPop();
                setPspadOpen(true);
              }}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
              title="Export, klipy YAML.DEF a příkazy pro PSPad"
            >
              <FileCode2 className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              PSPad
            </button>
          )}

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
        {/* Fixed Line Number Gutter (Synced vertically) */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-[48px] overflow-hidden border-r py-3 select-none"
          style={{
            backgroundColor: 'var(--bg-editor)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const diag = errorLines.get(lineNum);
            const isActive = lineNum === activeLine;
            return (
              <div
                key={idx}
                className="h-[22px] pr-2.5 text-right tabular-nums text-xs leading-[22px]"
                style={{
                  color: diag
                    ? diag.severity === 'error'
                      ? 'var(--danger)'
                      : 'var(--warning)'
                    : isActive
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                  fontWeight: diag || isActive ? 600 : 400,
                }}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Synchronized Highlight & Indent Guide Layer */}
        <div
          ref={backdropRef}
          aria-hidden="true"
          data-testid="yaml-highlight-backdrop"
          className="pointer-events-none absolute left-[48px] right-0 top-0 bottom-0 overflow-hidden py-3"
        >
          <div className="min-w-full w-max">
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const diag = errorLines.get(lineNum);
              const isActive = lineNum === activeLine;
              const spaceMatch = line.match(/^( +)/);
              const indentDepth = spaceMatch ? Math.floor(spaceMatch[1].length / 2) : 0;

              return (
                <div
                  key={idx}
                  className="relative h-[22px] whitespace-pre px-3"
                  style={{
                    backgroundColor:
                      diag?.severity === 'error'
                        ? 'rgba(217, 107, 107, 0.12)'
                        : diag?.severity === 'warning'
                        ? 'rgba(212, 154, 69, 0.09)'
                        : isActive
                        ? 'var(--accent-soft)'
                        : 'transparent',
                  }}
                >
                  <div className="relative">
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
                    {renderHighlightedLine(line, showWhitespace, idx)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actual Editable Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            syncActiveLine(e.currentTarget);
            if (!readOnly) {
              soundEngine.playTypeTick();
            }
          }}
          onClick={(e) => syncActiveLine(e.currentTarget)}
          onKeyUp={(e) => syncActiveLine(e.currentTarget)}
          onSelect={(e) => syncActiveLine(e.currentTarget)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          readOnly={readOnly}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label="YAML editor"
          className="yaml-input absolute left-[48px] right-0 top-0 bottom-0 h-full w-[calc(100%-48px)] resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 font-mono text-[13.5px] leading-[22px] text-transparent outline-none"
          style={{ tabSize: 2, caretColor: 'var(--accent)' }}
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

      <PSPadIntegrationModal
        open={pspadOpen}
        onClose={() => setPspadOpen(false)}
        yaml={value}
        diagnostics={diagnostics}
        onImportYaml={readOnly ? undefined : onChange}
      />
    </div>
  );
}
