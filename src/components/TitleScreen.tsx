import { useEffect } from 'react';
import type { BoardSkinId } from '../engine/gamification';
import type { SimulationState } from '../engine/yamlValidator';
import { Esp32Workbench3D } from './Esp32Workbench3D';

interface TitleScreenProps {
  onStart: () => void;
  onOpenDoctor: () => void;
  skin: BoardSkinId;
}

const DEMO_SIMULATION: SimulationState = {
  validSyntax: true,
  board: 'esp32dev',
  wifiSsid: 'HomeCraft-IoT',
  hasOta: true,
  hasI2c: true,
  i2cSda: 'GPIO21',
  i2cScl: 'GPIO22',
  mqttBroker: '192.168.1.10',
  lights: [{ id: 'demo', name: 'Stolni LED', platform: 'binary', pin: 'GPIO2', isOn: true, brightness: 95 }],
  switches: [],
  sensors: [],
  automations: [],
  climateTargetTemp: null,
  jinjaExpressions: [],
  unitSystem: 'metric',
};

export function TitleScreen({ onStart, onOpenDoctor, skin }: TitleScreenProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#111317] text-[#e6e9ef]">
      {/* Live 3D ESP32 Workbench Stage */}
      <div className="absolute inset-0">
        <Esp32Workbench3D
          skin={skin}
          simulation={DEMO_SIMULATION}
          lightOverrideOn={true}
          lightBrightness={85}
          ambientOrbit={true}
        />
      </div>

      {/* Left-third negative-space contrast scrim (solid gradient, zero backdrop-filter) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(17,19,23,0.95) 0%, rgba(17,19,23,0.82) 34%, rgba(17,19,23,0.16) 62%, rgba(17,19,23,0.0) 100%)',
        }}
      />

      {/* Foreground Title & Primary Actions */}
      <div className="relative z-10 flex h-full flex-col justify-between px-8 py-10 sm:px-14 lg:px-20">
        <div />

        <div className="max-w-lg space-y-6">
          {/* Bespoke inline SVG Title Lockup */}
          <svg
            viewBox="0 0 470 86"
            className="h-16 w-auto sm:h-20"
            role="img"
            aria-label="YAMLingo"
          >
            <rect
              x="2"
              y="8"
              width="66"
              height="66"
              rx="14"
              fill="#181d25"
              stroke="#5b9bd5"
              strokeWidth="2"
            />
            <path
              d="M19 26 L35 42 L19 58 M38 56 H54"
              fill="none"
              stroke="#7da8d6"
              strokeWidth="3.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="53" cy="25" r="4" fill="#4fa876" />
            <text
              x="86"
              y="55"
              fill="#e6e9ef"
              fontFamily="Outfit, system-ui, sans-serif"
              fontWeight="800"
              fontSize="46"
              letterSpacing="-1"
            >
              YAMLingo
            </text>
            <text
              x="88"
              y="76"
              fill="#7da8d6"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="600"
              fontSize="12"
              letterSpacing="2"
            >
              HOMECRAFT · ESPHOME &amp; HOME ASSISTANT
            </text>
          </svg>

          <h1 className="font-display text-3xl font-bold leading-tight text-[#e6e9ef] sm:text-4xl">
            Piš čistý YAML pro chytrou domácnost bez slepého tápání.
          </h1>

          <p className="text-base leading-relaxed text-[#9ca4b3]">
            Krátké 3minutové mise, barevná vodítka odsazení, živý 3D simulátor desky ESP32 a AI diagnostika YAML Doctor.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="rounded-lg bg-[#5b9bd5] px-7 py-3.5 text-base font-bold text-[#0c131d] transition-transform hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            >
              Spustit výuku
            </button>
            <button
              type="button"
              onClick={onOpenDoctor}
              className="rounded-lg border border-white/15 bg-[#181b21]/95 px-5 py-3.5 text-sm font-semibold text-[#e6e9ef] transition-colors hover:border-[#5b9bd5] whitespace-nowrap"
            >
              Otevřít YAML Doctor
            </button>
          </div>
        </div>

        {/* Single flat borderless control-hint line */}
        <div className="text-xs font-mono tracking-wide text-[#7c8596]">
          Enter Spustit · Tab Odsazení 2 mezery · Esc Pauza
        </div>
      </div>
    </div>
  );
}
