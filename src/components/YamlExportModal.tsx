import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clipboard,
  Cpu,
  Download,
  Home,
  X,
} from 'lucide-react';
import type { LessonMode } from '../engine/curriculum';
import type { YamlDiagnostic } from '../engine/yamlValidator';
import {
  buildExportableYaml,
  detectDefaultExportTarget,
  ensureYamlExtension,
  suggestExportFilename,
  type EspHomeExportFormat,
  type ExportTarget,
  type HomeAssistantExportFormat,
} from '../engine/yamlExport';
import { soundEngine } from '../utils/soundEngine';

interface YamlExportModalProps {
  open: boolean;
  onClose: () => void;
  code: string;
  parsed: unknown;
  diagnostics: YamlDiagnostic[];
  lessonId: string;
  lessonTitle: string;
  lessonMode: LessonMode;
}

function triggerYamlFileDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function YamlExportModal({
  open,
  onClose,
  code,
  parsed,
  diagnostics,
  lessonId,
  lessonTitle,
  lessonMode,
}: YamlExportModalProps) {
  const defaultTarget = useMemo(
    () => detectDefaultExportTarget(lessonMode, parsed),
    [lessonMode, parsed]
  );

  const [target, setTarget] = useState<ExportTarget>(defaultTarget);
  const [haFormat, setHaFormat] = useState<HomeAssistantExportFormat>('direct');
  const [esphomeFormat, setEsphomeFormat] = useState<EspHomeExportFormat>('complete');
  const [customFilename, setCustomFilename] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync defaults cleanly each time modal opens or lesson changes
  useEffect(() => {
    if (!open) return;
    setTarget(defaultTarget);
    setCustomFilename(null);
    setCopied(false);
    setStatusMessage(null);
  }, [open, lessonId, defaultTarget]);

  // Escape closes modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  const suggestedFilename = useMemo(
    () =>
      suggestExportFilename({
        target,
        parsed,
        lessonId,
        lessonTitle,
        haFormat,
      }),
    [target, parsed, lessonId, lessonTitle, haFormat]
  );

  const effectiveFilename = ensureYamlExtension(customFilename ?? suggestedFilename);

  const exportResult = useMemo(
    () =>
      buildExportableYaml({
        code,
        target,
        parsed,
        lessonId,
        lessonTitle,
        haFormat,
        esphomeFormat,
      }),
    [code, target, parsed, lessonId, lessonTitle, haFormat, esphomeFormat]
  );

  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').length,
    [diagnostics]
  );

  if (!open) return null;

  const lineCount = exportResult.content.trimEnd().split('\n').length;
  const byteSize = new TextEncoder().encode(exportResult.content).length;

  const handleDownload = () => {
    triggerYamlFileDownload(effectiveFilename, exportResult.content);
    soundEngine.playPop();
    setStatusMessage(`Soubor "${effectiveFilename}" byl stažen (UTF-8, UNIX LF).`);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportResult.content);
      soundEngine.playPop();
      setCopied(true);
      setStatusMessage('Exportovaný YAML byl zkopírován do schránky.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMessage('Schránka není dostupná — můžeš použít tlačítko Stáhnout .yaml.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 9, 14, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Export YAML souboru"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="yaml-export-modal"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-strong)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 border-b px-5 py-3.5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <h2 className="font-display text-base font-bold sm:text-lg" style={{ color: 'var(--text-primary)' }}>
              Export YAML pro Home Assistant / ESPHome
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Připraví čistý soubor (UTF-8 bez BOM, konce řádků UNIX LF) připravený k přímému importu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playPop();
              onClose();
            }}
            className="rounded-lg border p-1.5 transition-colors"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            aria-label="Zavřít dialog exportu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Target Platform Selection */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cílová platforma
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="export-target-ha"
                  aria-pressed={target === 'homeassistant'}
                  onClick={() => {
                    soundEngine.playPop();
                    setTarget('homeassistant');
                    setCustomFilename(null);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor:
                      target === 'homeassistant' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                    borderColor:
                      target === 'homeassistant' ? 'var(--accent)' : 'var(--border-subtle)',
                    color:
                      target === 'homeassistant' ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  <Home className="h-3.5 w-3.5" />
                  Home Assistant
                </button>
                <button
                  type="button"
                  data-testid="export-target-esphome"
                  aria-pressed={target === 'esphome'}
                  onClick={() => {
                    soundEngine.playPop();
                    setTarget('esphome');
                    setCustomFilename(null);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor:
                      target === 'esphome' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                    borderColor:
                      target === 'esphome' ? 'var(--accent)' : 'var(--border-subtle)',
                    color:
                      target === 'esphome' ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  ESPHome
                </button>
              </div>
            </div>

            {/* Target-Specific Format */}
            <div>
              <span
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                Struktura souboru
              </span>
              {target === 'homeassistant' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="export-ha-direct"
                    aria-pressed={haFormat === 'direct'}
                    onClick={() => {
                      soundEngine.playPop();
                      setHaFormat('direct');
                    }}
                    className="rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor:
                        haFormat === 'direct' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      borderColor:
                        haFormat === 'direct' ? 'var(--accent)' : 'var(--border-subtle)',
                      color:
                        haFormat === 'direct' ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    Přímý YAML (UI)
                  </button>
                  <button
                    type="button"
                    data-testid="export-ha-package"
                    aria-pressed={haFormat === 'package'}
                    onClick={() => {
                      soundEngine.playPop();
                      setHaFormat('package');
                    }}
                    className="rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor:
                        haFormat === 'package' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      borderColor:
                        haFormat === 'package' ? 'var(--accent)' : 'var(--border-subtle)',
                      color:
                        haFormat === 'package' ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    HA Balíček (packages)
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-testid="export-esphome-complete"
                    aria-pressed={esphomeFormat === 'complete'}
                    onClick={() => {
                      soundEngine.playPop();
                      setEsphomeFormat('complete');
                    }}
                    className="rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor:
                        esphomeFormat === 'complete' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      borderColor:
                        esphomeFormat === 'complete' ? 'var(--accent)' : 'var(--border-subtle)',
                      color:
                        esphomeFormat === 'complete' ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    Kompletní uzel
                  </button>
                  <button
                    type="button"
                    data-testid="export-esphome-raw"
                    aria-pressed={esphomeFormat === 'raw'}
                    onClick={() => {
                      soundEngine.playPop();
                      setEsphomeFormat('raw');
                    }}
                    className="rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors"
                    style={{
                      backgroundColor:
                        esphomeFormat === 'raw' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      borderColor:
                        esphomeFormat === 'raw' ? 'var(--accent)' : 'var(--border-subtle)',
                      color:
                        esphomeFormat === 'raw' ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    Pouze editor (1:1)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filename Input */}
          <div>
            <label
              htmlFor="yaml-export-filename"
              className="mb-1.5 block text-xs font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              Název výsledného souboru
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="yaml-export-filename"
                type="text"
                value={customFilename ?? suggestedFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 font-mono text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-editor)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
                placeholder="configuration.yaml"
              />
              <span
                className="rounded-md border px-2.5 py-2 font-mono text-[11px]"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {effectiveFilename}
              </span>
            </div>
          </div>

          {/* Syntax Warning OR Readiness Banner */}
          {errorCount > 0 ? (
            <div
              data-testid="export-syntax-warning"
              className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs"
              style={{
                backgroundColor: 'rgba(217, 107, 107, 0.12)',
                borderColor: 'var(--danger)',
                color: 'var(--text-primary)',
              }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--danger)' }} />
              <div>
                <p className="font-semibold">
                  V editoru je momentálně {errorCount} {errorCount === 1 ? 'chyba' : 'chyby'} syntaxe.
                </p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Soubor můžeš stáhnout i teď, ale před ostrým importem do {target === 'esphome' ? 'ESPHome' : 'Home Assistant'} chyby nejprve oprav.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs"
              style={{
                backgroundColor: 'rgba(79, 168, 118, 0.1)',
                borderColor: 'var(--success)',
                color: 'var(--text-primary)',
              }}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {exportResult.detectedKind} · {lineCount} řádků ({byteSize} B)
                </p>
                <p style={{ color: 'var(--text-secondary)' }}>{exportResult.notes}</p>
                {exportResult.addedSections.length > 0 && (
                  <p className="font-mono text-[11px]" style={{ color: 'var(--accent)' }}>
                    Automaticky doplněno pro přímý import: {exportResult.addedSections.join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* File Preview */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Náhled exportovaného souboru
              </span>
              <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
                UTF-8 (bez BOM) · LF (\n)
              </span>
            </div>
            <pre
              data-testid="export-yaml-preview"
              className="max-h-56 overflow-auto rounded-lg border p-3 font-mono text-xs leading-5"
              style={{
                backgroundColor: 'var(--bg-editor)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {exportResult.content}
            </pre>
          </div>

          {statusMessage && (
            <p
              role="status"
              className="rounded-lg border px-3 py-2 text-xs font-medium"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent)',
                color: 'var(--text-primary)',
              }}
            >
              {statusMessage}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <p className="max-w-sm text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {target === 'esphome'
              ? 'ESPHome: Nahraj soubor v ESPHome Dashboardu (Edit / Upload) a nezapomeň na secrets.yaml.'
              : haFormat === 'package'
              ? 'Home Assistant: Umísti do /config/packages/ a v configuration.yaml povol packages: !include_dir_named packages.'
              : 'Home Assistant: Vlož obsah v Nastavení → Automatizace → Upravit v YAML nebo do configuration.yaml.'}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="export-copy-btn"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
              ) : (
                <Clipboard className="h-3.5 w-3.5" />
              )}
              {copied ? 'Zkopírováno' : 'Zkopírovat YAML'}
            </button>
            <button
              type="button"
              data-testid="export-download-btn"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-transform active:scale-95 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Stáhnout .yaml
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
