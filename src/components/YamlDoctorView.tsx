import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ExternalLink,
  FolderTree,
  GitCompare,
  Loader2,
  MapPin,
  Search,
  Stethoscope,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  analyzeYaml,
  autoFixYaml,
  computeLineDiff,
  type YamlTreeNode,
} from '../engine/yamlValidator';
import { soundEngine } from '../utils/soundEngine';
import { SmartYamlEditor } from './SmartYamlEditor';

interface AiFixResult {
  fixedYaml: string;
  summary: string;
  changes: Array<{ line: number; issue: string; explanation: string }>;
}

interface SearchResult {
  answer: string;
  sources: Array<{ title: string; uri: string }>;
}

interface MapsResult {
  answer: string;
  places: Array<{ title: string; uri: string; snippets: string[] }>;
}

const PRESET_BROKEN_HA = `alias: Ranni kava a svetlo
trigger:
  - platform: state
\t  entity_id: binary_sensor.pohyb_kuchyn
    to: "on"
action:
  - service: light.turn_on
    entity_id: light.kuchyn_linka
   data:
     brightness_pct: 80`;

const PRESET_BROKEN_ESPHOME = `esphome:
  name: koupelna-ventilator

esp32:
  board: esp32dev

switch:
  - platform: gpio
    name: "Ventilator"
    pin: GPIO6

i2c:
  sda:GPIO21
  scl: GPIO22`;

const PRESET_BROKEN_JINJA = `template:
  - sensor:
      - name: "Kontrola oken"
        state: >
          {% if is_state('binary_sensor.okno', 'on') %}
            Pozor, větráš při {{ states('sensor.obyvak_teplota') °C!
          {% else %}
            Vše zavřeno`;

const TREE_TYPE_COLORS: Record<YamlTreeNode['type'], string> = {
  object: 'var(--syntax-key)',
  array: 'var(--accent)',
  string: 'var(--syntax-string)',
  number: 'var(--syntax-number)',
  boolean: 'var(--syntax-bool)',
  null: 'var(--text-muted)',
};

function TreeNodeItem({ node }: { node: YamlTreeNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2 font-mono text-xs">
        <span style={{ color: TREE_TYPE_COLORS[node.type], fontWeight: 600 }}>{node.key}</span>
        {node.valuePreview !== undefined && (
          <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
            : {node.valuePreview}
          </span>
        )}
      </div>
      {node.children.length > 0 && (
        <div
          className="ml-3 space-y-1 border-l pl-3"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          {node.children.map((child) => (
            <TreeNodeItem key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function YamlDoctorView() {
  const [code, setCode] = useState<string>(PRESET_BROKEN_HA);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFix, setAiFix] = useState<AiFixResult | null>(null);

  const [searchQuery, setSearchQuery] = useState('Home Assistant automation target entity_id vs device_id');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [mapsQuery, setMapsQuery] = useState('Prodejna elektroniky, ESP32 a senzorů pro chytrou domácnost v okolí');
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsResult, setMapsResult] = useState<MapsResult | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeYaml(code), [code]);

  const diffLines = useMemo(() => {
    if (!aiFix?.fixedYaml) return [];
    return computeLineDiff(code, aiFix.fixedYaml);
  }, [code, aiFix]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCode(reader.result);
        setAiFix(null);
      }
    };
    reader.readAsText(file);
  };

  const runAiFix = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/yaml-doctor/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: code, context: 'Home Assistant / ESPHome' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chyba při AI analýze.');
      }
      setAiFix(data);
      soundEngine.playSuccessFanfare(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Nepodařilo se spustit AI opravu.');
      soundEngine.playErrorBonk();
    } finally {
      setAiLoading(false);
    }
  };

  const runDocSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/yaml-doctor/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, yaml: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba vyhledávání.');
      setSearchResult(data);
      soundEngine.playPop();
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Vyhledávání selhalo.');
    } finally {
      setSearchLoading(false);
    }
  };

  const runMapsLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMapsLoading(true);
    setMapsError(null);

    let coords: { latitude?: number; longitude?: number } = {};
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2500 })
        );
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch {
        // Fallback to server default if geolocation permission denied/unavailable
      }
    }

    try {
      const res = await fetch('/api/yaml-doctor/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mapsQuery, ...coords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba mapového dotazu.');
      setMapsResult(data);
      soundEngine.playPop();
    } catch (err) {
      setMapsError(err instanceof Error ? err.message : 'Mapové vyhledávání selhalo.');
    } finally {
      setMapsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            <Stethoscope className="h-6 w-6" style={{ color: 'var(--accent)' }} />
            YAML Doctor — Import &amp; Diagnostika
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Vlož (Ctrl+V) nebo nahraj vlastní .yaml soubor z Home Assistanta. Zkontroluj strom větví, nebo použij AI opravu s diffem.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCode(PRESET_BROKEN_HA);
              setAiFix(null);
            }}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            Ukázka: Rozbitá automatizace
          </button>
          <button
            type="button"
            onClick={() => {
              setCode(PRESET_BROKEN_ESPHOME);
              setAiFix(null);
            }}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            Ukázka: Flash pin ESP32
          </button>
          <button
            type="button"
            onClick={() => {
              setCode(PRESET_BROKEN_JINJA);
              setAiFix(null);
            }}
            className="rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            Ukázka: Chybná Jinja2
          </button>

          <label
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            Nahrát .yaml
            <input type="file" accept=".yaml,.yml,.txt" onChange={handleFileUpload} className="sr-only" />
          </label>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: YAML Editor + Action Bar */}
        <div className="flex flex-col gap-3 lg:col-span-7">
          <div className="h-[400px]">
            <SmartYamlEditor
              value={code}
              onChange={(next) => {
                setCode(next);
              }}
              diagnostics={analysis.diagnostics}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const fixed = autoFixYaml(code);
                setCode(fixed);
                soundEngine.playPop();
              }}
              className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            >
              <Wand2 className="h-4 w-4" style={{ color: 'var(--warning)' }} />
              Rychlá oprava syntaxe (lokální)
            </button>

            <button
              type="button"
              onClick={runAiFix}
              disabled={aiLoading}
              className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold transition-opacity disabled:opacity-60 whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
              Opravit &amp; Vysvětlit (AI)
            </button>
          </div>

          {aiError && (
            <div
              className="flex items-start gap-2 rounded-lg border p-3 text-xs"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'var(--danger)',
                color: 'var(--text-primary)',
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--danger)' }} />
              <span>{aiError}</span>
            </div>
          )}
        </div>

        {/* Right: AST Tree & AI Diff View */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {/* Barevný rozbor struktury (Tree Breakdown) */}
          <div
            className="rounded-xl border p-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <div className="mb-3 flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="flex items-center gap-2 text-sm font-bold">
                <FolderTree className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                Rozbor struktury (větve YAML)
              </span>
              <span className="text-xs font-mono" style={{ color: analysis.validSyntax ? 'var(--success)' : 'var(--danger)' }}>
                {analysis.validSyntax ? 'Platný strom' : 'Poškozený strom'}
              </span>
            </div>

            {analysis.tree.length > 0 ? (
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {analysis.tree.map((node) => (
                  <TreeNodeItem key={node.id} node={node} />
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Strom se zobrazí, jakmile bude mít YAML platnou základní strukturu (opravte červené řádky vlevo).
              </p>
            )}
          </div>

          {/* Diff & AI Explanation */}
          {aiFix && (
            <div
              className="rounded-xl border p-4 space-y-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--accent)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <GitCompare className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  Diff opravy &amp; vysvětlení
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCode(aiFix.fixedYaml);
                    soundEngine.playSuccessFanfare(false);
                  }}
                  className="flex items-center gap-1 rounded-md px-3 py-1 text-xs font-bold whitespace-nowrap"
                  style={{ backgroundColor: 'var(--success)', color: '#041208' }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Použít opravený kód
                </button>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {aiFix.summary}
              </p>

              {aiFix.changes?.length > 0 && (
                <ul className="space-y-1.5 text-xs">
                  {aiFix.changes.map((c, idx) => (
                    <li
                      key={idx}
                      className="rounded-md border px-2.5 py-1.5"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <strong className="tabular-nums">Řádek {c.line} ({c.issue}):</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{c.explanation}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div
                className="max-h-48 overflow-y-auto rounded-lg border p-2.5 font-mono text-xs"
                style={{
                  backgroundColor: 'var(--bg-editor)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                {diffLines.map((dl, idx) => (
                  <div
                    key={idx}
                    className="whitespace-pre px-1.5 py-0.5"
                    style={{
                      backgroundColor:
                        dl.type === 'added'
                          ? 'rgba(34, 197, 94, 0.14)'
                          : dl.type === 'removed'
                          ? 'rgba(239, 68, 68, 0.14)'
                          : 'transparent',
                      color:
                        dl.type === 'added'
                          ? 'var(--success)'
                          : dl.type === 'removed'
                          ? 'var(--danger)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {dl.type === 'added' ? '+ ' : dl.type === 'removed' ? '- ' : '  '}
                    {dl.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Google Search Grounding & Google Maps Grounding Tools */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Google Search Grounding: Home Assistant / ESPHome Documentation */}
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="text-sm font-bold flex items-center gap-2">
            <Search className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            Ověřit v aktuální dokumentaci (Google Search)
          </div>
          <form onSubmit={runDocSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Např. ESPHome BME280 I2C YAML změny..."
              aria-label="Vyhledat v dokumentaci Home Assistant a ESPHome"
              className="flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-editor)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-contrast)',
              }}
            >
              {searchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Hledat
            </button>
          </form>

          {searchError && (
            <div className="text-xs" style={{ color: 'var(--danger)' }}>
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="space-y-2 text-xs">
              <div
                className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border p-3 leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {searchResult.answer}
              </div>
              {searchResult.sources.length > 0 && (
                <div className="space-y-1">
                  <div className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Zdroje dokumentace:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchResult.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        {s.title || s.uri}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Google Maps Grounding: Local Electronics & Hardware Stores */}
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="text-sm font-bold flex items-center gap-2">
            <MapPin className="h-4 w-4" style={{ color: 'var(--warning)' }} />
            Kde koupit ESP32 &amp; senzory v okolí (Google Maps)
          </div>
          <form onSubmit={runMapsLookup} className="flex gap-2">
            <input
              type="text"
              value={mapsQuery}
              onChange={(e) => setMapsQuery(e.target.value)}
              placeholder="Hledat prodejnu elektroniky, ESP32, relé..."
              aria-label="Vyhledat prodejny elektroniky na mapě"
              className="flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-editor)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              disabled={mapsLoading}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap"
              style={{
                backgroundColor: 'var(--warning)',
                color: '#09090b',
              }}
            >
              {mapsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
              Najít na mapě
            </button>
          </form>

          {mapsError && (
            <div className="text-xs" style={{ color: 'var(--danger)' }}>
              {mapsError}
            </div>
          )}

          {mapsResult && (
            <div className="space-y-2 text-xs">
              <div
                className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg border p-3 leading-relaxed"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                {mapsResult.answer}
              </div>
              {mapsResult.places.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Odkazy na Google Maps:
                  </div>
                  <ul className="space-y-1">
                    {mapsResult.places.map((p, idx) => (
                      <li key={idx}>
                        <a
                          href={p.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium underline"
                          style={{ color: 'var(--accent)' }}
                        >
                          {p.title}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        {p.snippets[0] && (
                          <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                            — {p.snippets[0]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
