import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  ClipboardPaste,
  Code2,
  Download,
  FileCode2,
  FolderOpen,
  Terminal,
  X,
} from 'lucide-react';
import {
  buildPSPadCliCommand,
  formatYamlForPSPad,
  generatePSPadClipsDef,
  PSPAD_RECOMMENDED_SETTINGS,
  type LineEndingMode,
} from '../engine/pspad';
import type { YamlDiagnostic } from '../engine/yamlValidator';
import { soundEngine } from '../utils/soundEngine';

interface PSPadIntegrationModalProps {
  open: boolean;
  onClose: () => void;
  yaml: string;
  diagnostics: YamlDiagnostic[];
  onImportYaml?: (yaml: string) => void;
  defaultFileName?: string;
}

type PSPadTab = 'sync' | 'clips' | 'cli';

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function PSPadIntegrationModal({
  open,
  onClose,
  yaml,
  diagnostics,
  onImportYaml,
  defaultFileName = 'configuration.yaml',
}: PSPadIntegrationModalProps) {
  const [tab, setTab] = useState<PSPadTab>('sync');
  const [lineEnding, setLineEnding] = useState<LineEndingMode>('lf');
  const [fileName, setFileName] = useState(defaultFileName);
  const [exePath, setExePath] = useState('C:\\Program Files\\PSPad editor\\PSPad.exe');
  const [remoteFilePath, setRemoteFilePath] = useState('Z:\\config\\configuration.yaml');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setFileName(defaultFileName);
  }, [defaultFileName]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  const firstErrorLine = useMemo(() => {
    const err = diagnostics.find((d) => d.severity === 'error');
    return err?.line ?? 1;
  }, [diagnostics]);

  const formattedYaml = useMemo(
    () => formatYamlForPSPad(yaml, lineEnding),
    [yaml, lineEnding]
  );

  const clipsDef = useMemo(() => generatePSPadClipsDef(), []);

  const cliCommand = useMemo(
    () =>
      buildPSPadCliCommand({
        exePath,
        filePath: remoteFilePath,
        line: firstErrorLine,
      }),
    [exePath, remoteFilePath, firstErrorLine]
  );

  if (!open) return null;

  const markCopied = (id: string, msg: string) => {
    soundEngine.playPop();
    setCopiedId(id);
    setStatusMsg(msg);
    window.setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const handleCopy = async (text: string, id: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      markCopied(id, msg);
    } catch {
      setStatusMsg('Schránka není dostupná — můžeš text označit a zkopírovat ručně.');
    }
  };

  const handlePasteFromPSPad = async () => {
    if (!onImportYaml) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setStatusMsg('Schránka je prázdná — zkopíruj YAML z PSPadu pomocí Ctrl+C.');
        return;
      }
      onImportYaml(text);
      soundEngine.playPop();
      setStatusMsg('Kód ze schránky byl načten do editoru.');
    } catch {
      setStatusMsg('Prohlížeč nepovolil čtení schránky — vlož kód přímo do editoru (Ctrl+V).');
    }
  };

  const handleOpenDiskFile = async () => {
    if (!onImportYaml) return;
    const win = window as unknown as {
      showOpenFilePicker?: (opts: unknown) => Promise<Array<{ getFile: () => Promise<File> }>>;
    };
    if (typeof win.showOpenFilePicker === 'function') {
      try {
        const [handle] = await win.showOpenFilePicker({
          types: [
            {
              description: 'YAML soubory',
              accept: { 'text/yaml': ['.yaml', '.yml'] },
            },
          ],
        });
        const file = await handle.getFile();
        const text = await file.text();
        setFileName(file.name);
        onImportYaml(text);
        soundEngine.playPop();
        setStatusMsg(`Načten soubor ${file.name}.`);
        return;
      } catch {
        // User cancelled or permission blocked
        return;
      }
    }
    setStatusMsg('Použij tlačítko „Nahrát .yaml“ v nástrojové liště pro výběr souboru z disku.');
  };

  const handleSaveToDisk = async () => {
    const cleanName = fileName.trim() || 'configuration.yaml';
    const win = window as unknown as {
      showSaveFilePicker?: (opts: unknown) => Promise<{
        createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
      }>;
    };
    if (typeof win.showSaveFilePicker === 'function') {
      try {
        const handle = await win.showSaveFilePicker({
          suggestedName: cleanName,
          types: [
            {
              description: 'YAML konfigurace',
              accept: { 'text/yaml': ['.yaml', '.yml'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(formattedYaml);
        await writable.close();
        soundEngine.playSuccessFanfare(false);
        setStatusMsg(`Soubor ${cleanName} byl uložen přímo na disk pro PSPad.`);
        return;
      } catch {
        // Fallback to standard download if cancelled/blocked
      }
    }
    downloadTextFile(cleanName, formattedYaml);
    soundEngine.playPop();
    setStatusMsg(`Soubor ${cleanName} (${lineEnding.toUpperCase()}) byl stažen pro PSPad.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Integrace s programem PSPad"
      data-testid="pspad-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-strong)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg border"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <FileCode2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold">
                Integrace s programem PSPad
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Přenos konfigurace, klipy <code className="font-mono">YAML.DEF</code> a příkazy pro skok na řádek chyby.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít integraci PSPad"
            className="rounded-lg border p-1.5 transition-colors hover:opacity-80"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div
          role="tablist"
          aria-label="Sekce integrace PSPad"
          className="flex flex-wrap gap-1.5 border-b px-5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {(
            [
              { id: 'sync', label: 'Přenos kódu & Soubor', icon: FolderOpen },
              { id: 'clips', label: 'PSPad Klipy (YAML.DEF)', icon: Code2 },
              { id: 'cli', label: 'CLI & Nastavení PSPadu', icon: Terminal },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`pspad-tab-${item.id}`}
                onClick={() => setTab(item.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-surface)',
                  borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {statusMsg && (
            <div
              data-testid="pspad-status"
              className="rounded-lg border px-3.5 py-2 text-xs font-medium"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent)',
                color: 'var(--text-primary)',
              }}
            >
              {statusMsg}
            </div>
          )}

          {tab === 'sync' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pspad-filename"
                    className="mb-1 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Název souboru pro PSPad
                  </label>
                  <input
                    id="pspad-filename"
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-editor)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <span
                    className="mb-1 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Konce řádků (Line Endings)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setLineEnding('lf')}
                      aria-pressed={lineEnding === 'lf'}
                      className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold"
                      style={{
                        backgroundColor: lineEnding === 'lf' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                        borderColor: lineEnding === 'lf' ? 'var(--accent)' : 'var(--border-subtle)',
                        color: lineEnding === 'lf' ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      Unix LF (HA)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineEnding('crlf')}
                      aria-pressed={lineEnding === 'crlf'}
                      className="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold"
                      style={{
                        backgroundColor: lineEnding === 'crlf' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                        borderColor: lineEnding === 'crlf' ? 'var(--accent)' : 'var(--border-subtle)',
                        color: lineEnding === 'crlf' ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                    >
                      Windows CRLF
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveToDisk}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Uložit / Stáhnout pro PSPad
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      formattedYaml,
                      'yaml',
                      'YAML zkopírován do schránky — v PSPadu stačí stisknout Ctrl+V.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {copiedId === 'yaml' ? (
                    <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
                  ) : (
                    <Clipboard className="h-3.5 w-3.5" />
                  )}
                  Kopírovat do PSPadu
                </button>

                {onImportYaml && (
                  <>
                    <button
                      type="button"
                      onClick={handlePasteFromPSPad}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" style={{ color: 'var(--warning)' }} />
                      Vložit ze schránky PSPadu
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenDiskFile}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Otevřít soubor z disku
                    </button>
                  </>
                )}
              </div>

              <div
                className="rounded-lg border p-3"
                style={{
                  backgroundColor: 'var(--bg-editor)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  <span>Náhled exportu ({lineEnding.toUpperCase()} · UTF-8 bez BOM)</span>
                  <span>{formattedYaml.split('\n').length - 1} řádků</span>
                </div>
                <pre className="max-h-48 overflow-auto font-mono text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {formattedYaml}
                </pre>
              </div>
            </div>
          )}

          {tab === 'clips' && (
            <div className="space-y-4">
              <div
                className="rounded-lg border p-3.5 text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                PSPad podporuje vlastní kontextové šablony (klipy) v souboru{' '}
                <code className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  Context\YAML.DEF
                </code>
                . Po uložení souboru do složky PSPadu stačí při psaní stisknout{' '}
                <kbd
                  className="rounded border px-1.5 py-0.5 font-mono text-[11px]"
                  style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
                >
                  Ctrl + Mezerník
                </kbd>{' '}
                pro okamžité vložení automatizací, BME280 senzorů nebo Jinja2 šablon.
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    downloadTextFile('YAML.DEF', clipsDef);
                    soundEngine.playPop();
                    setStatusMsg('Soubor YAML.DEF stažen — zkopíruj ho do podsložky Context\\ v PSPadu.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Stáhnout YAML.DEF pro PSPad
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      clipsDef,
                      'clips',
                      'Obsah souboru YAML.DEF byl zkopírován do schránky.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {copiedId === 'clips' ? (
                    <Check className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
                  ) : (
                    <Clipboard className="h-3.5 w-3.5" />
                  )}
                  Kopírovat definice klipů
                </button>
              </div>

              <pre
                data-testid="pspad-clips-preview"
                className="max-h-60 overflow-auto rounded-lg border p-3.5 font-mono text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-editor)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                {clipsDef}
              </pre>
            </div>
          )}

          {tab === 'cli' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="pspad-exe-path"
                    className="mb-1 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cesta k PSPad.exe
                  </label>
                  <input
                    id="pspad-exe-path"
                    type="text"
                    value={exePath}
                    onChange={(e) => setExePath(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-editor)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="pspad-remote-file"
                    className="mb-1 block text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cesta ke konfiguraci (např. Samba disk Z:\)
                  </label>
                  <input
                    id="pspad-remote-file"
                    type="text"
                    value={remoteFilePath}
                    onChange={(e) => setRemoteFilePath(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--bg-editor)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              <div
                className="rounded-lg border p-3.5 space-y-2"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Příkaz pro otevření v PSPadu přímo na řádku {firstErrorLine}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        cliCommand,
                        'cli',
                        'Příkaz pro PSPad zkopírován (Win+R nebo terminál).'
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--accent)',
                    }}
                  >
                    {copiedId === 'cli' ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}
                    Kopírovat příkaz
                  </button>
                </div>
                <code
                  data-testid="pspad-cli-command"
                  className="block overflow-x-auto rounded border px-3 py-2 font-mono text-xs"
                  style={{
                    backgroundColor: 'var(--bg-editor)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--syntax-string)',
                  }}
                >
                  {cliCommand}
                </code>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Doporučené nastavení PSPadu pro bezchybný YAML
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PSPAD_RECOMMENDED_SETTINGS.map((item) => (
                    <div
                      key={item.setting}
                      className="rounded-lg border p-3 text-xs"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {item.section}
                      </div>
                      <div className="mt-0.5 font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.setting}:{' '}
                        <span style={{ color: 'var(--success)' }}>{item.value}</span>
                      </div>
                      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
