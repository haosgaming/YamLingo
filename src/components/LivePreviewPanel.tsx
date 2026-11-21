import { useMemo, useState } from 'react';
import {
  Activity,
  Box,
  Flame,
  LayoutDashboard,
  Lightbulb,
  Play,
  Terminal,
  Thermometer,
  Wifi,
} from 'lucide-react';
import type { BoardSkinId } from '../engine/gamification';
import {
  evaluateJinjaPreview,
  type SimulationState,
  type YamlDiagnostic,
} from '../engine/yamlValidator';
import { soundEngine } from '../utils/soundEngine';
import { Esp32Workbench3D } from './Esp32Workbench3D';
import { InlineCodeText } from './InlineCodeText';

interface LivePreviewPanelProps {
  simulation: SimulationState;
  diagnostics: YamlDiagnostic[];
  skin: BoardSkinId;
  defaultTab?: 'lovelace' | '3d' | 'serial';
}

export function LivePreviewPanel({
  simulation,
  diagnostics,
  skin,
  defaultTab = 'lovelace',
}: LivePreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'lovelace' | '3d' | 'serial'>(defaultTab);
  const [cameraPreset, setCameraPreset] = useState<'board' | 'desk' | 'sensor'>('desk');
  const [manualLightOn, setManualLightOn] = useState<boolean | undefined>(undefined);
  const [brightness, setBrightness] = useState(90);
  const [automationLog, setAutomationLog] = useState<string | null>(null);
  const [mockTemp, setMockTemp] = useState(25);
  const [mockWindowOpen, setMockWindowOpen] = useState(true);

  const hasLightEntity = simulation.lights.length > 0 || simulation.switches.length > 0;
  const effectiveLightOn = manualLightOn !== undefined ? manualLightOn : hasLightEntity;

  const serialLines = useMemo(() => {
    const lines: Array<{ level: 'I' | 'D' | 'W' | 'E'; tag: string; msg: string }> = [
      { level: 'I', tag: 'app:029', msg: `ESPHome Boot · Deska: ${simulation.board || 'esp32dev'}` },
    ];
    if (simulation.wifiSsid) {
      lines.push({ level: 'I', tag: 'wifi:384', msg: `Připojeno k SSID "${simulation.wifiSsid}" (RSSI -54 dBm)` });
    }
    if (simulation.hasOta) {
      lines.push({ level: 'I', tag: 'ota:088', msg: 'OTA server naslouchá na portu 3232' });
    }
    if (simulation.hasI2c) {
      lines.push({
        level: 'D',
        tag: 'i2c:044',
        msg: `Sběrnice I2C inicializována (SDA=${simulation.i2cSda || '?'}, SCL=${simulation.i2cScl || '?'})`,
      });
    }
    if (simulation.mqttBroker) {
      lines.push({ level: 'I', tag: 'mqtt:112', msg: `MQTT připojeno na ${simulation.mqttBroker}` });
    }
    simulation.lights.forEach((l) => {
      lines.push({
        level: 'D',
        tag: 'light:036',
        msg: `'${l.name}' (${l.pin || 'GPIO2'}) -> ${effectiveLightOn ? `ZAPNUTO (${brightness}%)` : 'VYPNUTO'}`,
      });
    });
    simulation.switches.forEach((s) => {
      lines.push({
        level: 'D',
        tag: 'switch:051',
        msg: `'${s.name}' (${s.pin || 'GPIO'}) -> ${effectiveLightOn ? 'SEPNUTO' : 'ROZEPNUTO'}`,
      });
    });
    simulation.sensors.forEach((s) => {
      lines.push({
        level: 'D',
        tag: 'sensor:092',
        msg: `'${s.name}' odeslala hodnotu: ${s.value} ${s.unit}${
          s.filters.length ? ` (filtry: ${s.filters.join(', ')})` : ''
        }`,
      });
    });
    diagnostics
      .filter((d) => d.severity === 'error')
      .forEach((d) => {
        lines.push({ level: 'E', tag: `yaml:${d.line}`, msg: d.message });
      });
    return lines;
  }, [simulation, effectiveLightOn, brightness, diagnostics]);

  const jinjaResults = useMemo(() => {
    const mockEntities = {
      'sensor.obyvak_teplota': mockTemp,
      'binary_sensor.okno': mockWindowOpen ? 'on' : 'off',
    };
    return simulation.jinjaExpressions.map((expr) => ({
      expr,
      output: evaluateJinjaPreview(expr, mockEntities),
    }));
  }, [simulation.jinjaExpressions, mockTemp, mockWindowOpen]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-xl border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Tab Switcher Header */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'lovelace'}
            onClick={() => setActiveTab('lovelace')}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            style={{
              backgroundColor: activeTab === 'lovelace' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'lovelace' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Lovelace náhled
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === '3d'}
            onClick={() => setActiveTab('3d')}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            style={{
              backgroundColor: activeTab === '3d' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === '3d' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Box className="h-3.5 w-3.5" />
            3D Deska ESP32
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'serial'}
            onClick={() => setActiveTab('serial')}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            style={{
              backgroundColor: activeTab === 'serial' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'serial' ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Terminal className="h-3.5 w-3.5" />
            Sériový log
          </button>
        </div>

        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {simulation.board ? `ESP32 · ${simulation.board}` : 'Home Assistant Core'}
        </span>
      </div>

      {/* Tab Body */}
      <div className="relative flex-1 overflow-y-auto p-4">
        {activeTab === '3d' && (
          <div className="relative flex h-full min-h-[300px] flex-col gap-3">
            <div className="relative flex-1 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
              <Esp32Workbench3D
                skin={skin}
                simulation={simulation}
                lightOverrideOn={effectiveLightOn}
                lightBrightness={brightness}
                cameraPreset={cameraPreset}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                {(['desk', 'board', 'sensor'] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCameraPreset(preset)}
                    className="rounded-md border px-2.5 py-1 font-medium transition-colors whitespace-nowrap"
                    style={{
                      backgroundColor: cameraPreset === preset ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      borderColor: cameraPreset === preset ? 'var(--accent)' : 'var(--border-subtle)',
                      color: cameraPreset === preset ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {preset === 'desk' ? 'Celý stůl' : preset === 'board' ? 'Deska zblízka' : 'I2C Senzor'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !effectiveLightOn;
                  setManualLightOn(next);
                  soundEngine.playToggle(next);
                }}
                className="rounded-md border px-3 py-1 font-semibold transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: effectiveLightOn ? 'var(--accent)' : 'var(--bg-elevated)',
                  borderColor: 'var(--border-strong)',
                  color: effectiveLightOn ? 'var(--accent-contrast)' : 'var(--text-primary)',
                }}
              >
                {effectiveLightOn ? 'Vypnout LED / Lampa' : 'Rozsvítit LED / Lampa'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'lovelace' && (
          <div className="space-y-4">
            {/* Compact Live Hardware Preview Strip */}
            <div
              className="flex items-center justify-between rounded-lg border p-3"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: effectiveLightOn ? 'rgba(250, 204, 21, 0.2)' : 'var(--bg-surface)',
                    color: effectiveLightOn ? '#facc15' : 'var(--text-muted)',
                  }}
                >
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {simulation.board ? `Zařízení ${simulation.board}` : 'Virtuální chytrý dům'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {simulation.wifiSsid ? `Wi-Fi: ${simulation.wifiSsid}` : 'Připraveno k testování'} ·{' '}
                    {simulation.unitSystem === 'metric' ? 'Jednotky: °C / km' : 'Režim náhledu'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('3d')}
                className="rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--accent)',
                }}
              >
                Zobrazit 3D desku
              </button>
            </div>

            {/* Interactive Lights & Switches */}
            {(simulation.lights.length > 0 || simulation.switches.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {[...simulation.lights, ...simulation.switches].map((device) => (
                  <div
                    key={device.id}
                    className="rounded-xl border p-3.5 transition-colors"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: effectiveLightOn ? 'var(--accent)' : 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {device.name}
                        </div>
                        <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                          {device.platform} · {device.pin || 'GPIO2'}
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={effectiveLightOn}
                        aria-label={`Přepnout ${device.name}`}
                        onClick={() => {
                          const next = !effectiveLightOn;
                          setManualLightOn(next);
                          soundEngine.playToggle(next);
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap"
                        style={{
                          backgroundColor: effectiveLightOn ? 'var(--accent)' : 'var(--bg-surface)',
                          color: effectiveLightOn ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                          border: '1px solid var(--border-strong)',
                        }}
                      >
                        {effectiveLightOn ? 'ZAPNUTO' : 'VYPNUTO'}
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span style={{ color: 'var(--text-secondary)' }}>Jas:</span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        aria-label="Jas světla"
                        className="flex-1 accent-[var(--accent)]"
                      />
                      <span className="w-9 text-right font-mono tabular-nums">{brightness}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sensors Cards */}
            {simulation.sensors.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {simulation.sensors.map((sensor) => (
                  <div
                    key={sensor.id}
                    className="rounded-xl border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {sensor.name}
                      </span>
                      <Thermometer className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    </div>
                    <div
                      className="mt-1.5 text-2xl font-bold font-mono tabular-nums"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {sensor.value} {sensor.unit}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Platforma: {sensor.platform}
                      {sensor.filters.length > 0 ? ` · Filtry: ${sensor.filters.join(', ')}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Climate / Thermostat Card */}
            {simulation.climateTargetTemp !== null && (
              <div
                className="flex items-center justify-between rounded-xl border p-3.5"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: simulation.climateTargetTemp > 25 ? 'var(--danger)' : 'var(--success)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Flame
                    className="h-6 w-6"
                    style={{
                      color: simulation.climateTargetTemp > 25 ? 'var(--danger)' : 'var(--success)',
                    }}
                  />
                  <div>
                    <div className="text-sm font-semibold">Termostat Obývák</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {simulation.climateTargetTemp > 25
                        ? 'POZOR: Přetopeno! Sniž cílovou teplotu.'
                        : 'Teplota v bezpečném komfortním pásmu.'}
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {simulation.climateTargetTemp} °C
                </div>
              </div>
            )}

            {/* Automations Runner */}
            {simulation.automations.length > 0 && (
              <div className="space-y-2.5">
                {simulation.automations.map((auto, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {auto.alias}
                        </div>
                        <div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                          Spouštěč: {auto.triggerPlatform}{' '}
                          {auto.triggerEntity ? `(${auto.triggerEntity})` : ''} · Akce:{' '}
                          {auto.actionService || 'čeka'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playToggle(true);
                          setManualLightOn(true);
                          setAutomationLog(
                            `Spouštěč aktivován -> ${
                              auto.hasCondition ? `Podmínka (${auto.conditionType}) splněna -> ` : ''
                            }Vykonána akce ${auto.actionService || 'ok'} na ${auto.targetEntity || 'zařízení'}`
                          );
                        }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-contrast)',
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Simulovat spouštěč
                      </button>
                    </div>
                    {automationLog && (
                      <div
                        className="mt-2.5 rounded-md border px-2.5 py-1.5 text-xs font-mono"
                        style={{
                          backgroundColor: 'var(--bg-editor)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--success)',
                        }}
                      >
                        {automationLog}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Live Jinja2 Template Evaluator */}
            {simulation.jinjaExpressions.length > 0 && (
              <div
                className="rounded-xl border p-3.5 space-y-3"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Živý Jinja2 vyhodnocovač</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--syntax-jinja)' }}>
                    {'{{ template }}'}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <label className="flex flex-col gap-1">
                    <span style={{ color: 'var(--text-secondary)' }}>
                      sensor.obyvak_teplota: <strong className="tabular-nums">{mockTemp} °C</strong>
                    </span>
                    <input
                      type="range"
                      min={15}
                      max={32}
                      value={mockTemp}
                      onChange={(e) => setMockTemp(Number(e.target.value))}
                      className="accent-[var(--accent)]"
                    />
                  </label>
                  <div className="flex items-center justify-between rounded-md border px-2.5 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>binary_sensor.okno</span>
                    <button
                      type="button"
                      onClick={() => setMockWindowOpen((v) => !v)}
                      className="rounded px-2 py-0.5 font-mono font-semibold"
                      style={{
                        backgroundColor: mockWindowOpen ? 'var(--warning)' : 'var(--bg-surface)',
                        color: mockWindowOpen ? '#09090b' : 'var(--text-primary)',
                      }}
                    >
                      {mockWindowOpen ? 'on (otevřeno)' : 'off (zavřeno)'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {jinjaResults.map((res, i) => (
                    <div
                      key={i}
                      className="rounded-md border px-3 py-2 font-mono text-xs"
                      style={{
                        backgroundColor: 'var(--bg-editor)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Výstup šablony:
                      </div>
                      <div className="mt-0.5 text-sm font-semibold" style={{ color: 'var(--success)' }}>
                        {res.output || '(prázdný výstup)'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty / Basic YAML Preview */}
            {simulation.lights.length === 0 &&
              simulation.switches.length === 0 &&
              simulation.sensors.length === 0 &&
              simulation.automations.length === 0 &&
              simulation.jinjaExpressions.length === 0 && (
                <div
                  className="rounded-xl border p-4 text-sm space-y-2"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <Activity className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    Stav živého simulátoru
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <InlineCodeText text="Jakmile v editoru nadefinuješ `light:`, `switch:`, `sensor:`, `automation:` nebo `wifi:`, okamžitě se zde objeví interaktivní karty Home Assistant a rozsvítí se komponenty na 3D desce ESP32." />
                  </p>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1">
                      <Wifi className="h-3.5 w-3.5" />
                      Wi-Fi: {simulation.wifiSsid || 'neaktivní'}
                    </span>
                    <span>OTA: {simulation.hasOta ? 'povoleno' : 'vypnuto'}</span>
                    <span>I2C: {simulation.hasI2c ? 'aktivní' : 'neaktivní'}</span>
                  </div>
                </div>
              )}
          </div>
        )}

        {activeTab === 'serial' && (
          <div
            className="h-full min-h-[260px] rounded-lg border p-3 font-mono text-xs leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-editor)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {serialLines.map((line, i) => (
              <div key={i} className="py-0.5">
                <span
                  className="mr-2 font-bold"
                  style={{
                    color:
                      line.level === 'E'
                        ? 'var(--danger)'
                        : line.level === 'W'
                        ? 'var(--warning)'
                        : line.level === 'D'
                        ? 'var(--accent)'
                        : 'var(--success)',
                  }}
                >
                  [{line.level}][{line.tag}]:
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{line.msg}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
