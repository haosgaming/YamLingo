import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cpu,
  Keyboard,
  Lightbulb,
  MousePointerClick,
  Palette,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  DEFAULT_SOUND_PREFERENCES,
  SHOP_CATALOG,
  type PlayerProgress,
  type ShopItem,
  type SoundPreferences,
} from '../engine/gamification';
import { soundEngine } from '../utils/soundEngine';

interface ShopViewProps {
  progress: PlayerProgress;
  onBuyOrEquip: (itemId: string) => void;
  onToggleMasterSound: () => void;
  onToggleSoundChannel: (channel: keyof SoundPreferences) => void;
  onResetSoundPreferences: () => void;
  feedbackMsg: string | null;
}

type ShopSubTab = 'catalog' | 'audio';

interface AudioChannelOption {
  key: keyof SoundPreferences;
  title: string;
  description: string;
  icon: typeof Volume2;
  accentVar: string;
  preview: () => void;
}

const AUDIO_CHANNELS: AudioChannelOption[] = [
  {
    key: 'uiClicks',
    title: 'UI kliknutí a přepínače',
    description: 'Zvuk tlačítek, karet, přepínačů v Lovelace a vkládání bloků.',
    icon: MousePointerClick,
    accentVar: 'var(--accent)',
    preview: () => soundEngine.playPop(),
  },
  {
    key: 'successFanfares',
    title: 'Fanfáry úspěchu',
    description: 'Melodická odměna při dokončení mise, Boss Fightu nebo AI opravy.',
    icon: Sparkles,
    accentVar: 'var(--success)',
    preview: () => soundEngine.playSuccessFanfare(false),
  },
  {
    key: 'typingFeedback',
    title: 'Zpětná vazba při psaní',
    description: 'Jemné mechanické ťuknutí při psaní a odsazování v YAML editoru.',
    icon: Keyboard,
    accentVar: 'var(--warning)',
    preview: () => soundEngine.playTypeTick(),
  },
  {
    key: 'errorAlerts',
    title: 'Chybová upozornění',
    description: 'Tlumený nízký tón při chybě syntaxe nebo vypršení času.',
    icon: AlertTriangle,
    accentVar: 'var(--danger)',
    preview: () => soundEngine.playErrorBonk(),
  },
];

export function ShopView({
  progress,
  onBuyOrEquip,
  onToggleMasterSound,
  onToggleSoundChannel,
  onResetSoundPreferences,
  feedbackMsg,
}: ShopViewProps) {
  const [subTab, setSubTab] = useState<ShopSubTab>('catalog');

  const categories: Array<{ id: ShopItem['category']; title: string; icon: typeof Palette }> = [
    { id: 'theme', title: 'Témata editoru & aplikace', icon: Palette },
    { id: 'skin', title: 'Skiny pro 3D desku ESP32', icon: Cpu },
    { id: 'powerup', title: 'Ochrana řady & nápovědy', icon: Shield },
  ];

  const prefs: SoundPreferences = {
    ...DEFAULT_SOUND_PREFERENCES,
    ...(progress.soundPreferences ?? {}),
  };
  const enabledChannelsCount = Object.values(prefs).filter(Boolean).length;

  const isOwned = (item: ShopItem) => {
    if (item.category === 'theme') return progress.unlockedThemes.includes(item.targetId as never);
    if (item.category === 'skin') return progress.unlockedSkins.includes(item.targetId as never);
    return false;
  };

  const isActive = (item: ShopItem) => {
    if (item.category === 'theme') return progress.activeTheme === item.targetId;
    if (item.category === 'skin') return progress.activeSkin === item.targetId;
    return false;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Dílna &amp; Obchod za Volty
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Odemkni nová témata editoru, sběratelské skiny pro 3D ESP32 desku, štíty řady nebo si uprav zvukové efekty.
          </p>
        </div>

        <div
          className="flex items-center gap-4 rounded-xl border px-4 py-2.5 text-sm font-mono tabular-nums"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-strong)',
          }}
        >
          <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--warning)' }}>
            <Zap className="h-4 w-4" />
            {progress.volts} Voltů
          </span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
            <Shield className="h-4 w-4" />
            {progress.streakFreezes} Štíty
          </span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
            <Lightbulb className="h-4 w-4" />
            {progress.hintsAvailable} Nápověd
          </span>
        </div>
      </div>

      {/* Shop Sub-Menu Navigation */}
      <div
        role="tablist"
        aria-label="Podmenu obchodu a nastavení"
        className="flex flex-wrap items-center gap-2 rounded-xl border p-1.5 w-fit"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'catalog'}
          data-testid="shop-tab-catalog"
          onClick={() => setSubTab('catalog')}
          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors"
          style={{
            backgroundColor: subTab === 'catalog' ? 'var(--accent-soft)' : 'transparent',
            color: subTab === 'catalog' ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          <Palette className="h-3.5 w-3.5" />
          Katalog vylepšení
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'audio'}
          data-testid="shop-tab-audio"
          onClick={() => setSubTab('audio')}
          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors"
          style={{
            backgroundColor: subTab === 'audio' ? 'var(--accent-soft)' : 'transparent',
            color: subTab === 'audio' ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {progress.soundEnabled ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5" />
          )}
          Nastavení zvuku
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: progress.soundEnabled ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {progress.soundEnabled ? `${enabledChannelsCount}/4` : 'Ztlumeno'}
          </span>
        </button>
      </div>

      {feedbackMsg && (
        <div
          className="rounded-lg border px-4 py-2.5 text-xs font-medium"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
            color: 'var(--text-primary)',
          }}
        >
          {feedbackMsg}
        </div>
      )}

      {subTab === 'catalog' ? (
        <div className="space-y-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const items = SHOP_CATALOG.filter((i) => i.category === cat.id);
            return (
              <section
                key={cat.id}
                className="rounded-xl border p-5"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
                  <Icon className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                  {cat.title}
                </h2>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {items.map((item) => {
                    const owned = isOwned(item);
                    const active = isActive(item);
                    const canAfford = progress.volts >= item.price;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col justify-between rounded-xl border p-4"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="h-5 w-5 rounded border"
                              style={{
                                backgroundColor: item.swatchColor,
                                borderColor: 'var(--border-strong)',
                              }}
                            />
                            <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--warning)' }}>
                              {owned ? (active ? 'Aktivní' : 'Odemčeno') : `${item.price} ⚡`}
                            </span>
                          </div>

                          <h3 className="mt-3 font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {item.name}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {item.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={!owned && !canAfford}
                          onClick={() => onBuyOrEquip(item.id)}
                          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-45 whitespace-nowrap"
                          style={{
                            backgroundColor: active
                              ? 'var(--success)'
                              : owned
                              ? 'var(--bg-surface)'
                              : 'var(--accent)',
                            color: active
                              ? '#041208'
                              : owned
                              ? 'var(--text-primary)'
                              : 'var(--accent-contrast)',
                            border: owned && !active ? '1px solid var(--border-strong)' : 'none',
                          }}
                        >
                          {active ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Používá se
                            </>
                          ) : owned ? (
                            'Aktivovat'
                          ) : (
                            `Odemknout (${item.price} ⚡)`
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section
          aria-label="Nastavení zvuku"
          data-testid="shop-audio-submenu"
          className="rounded-xl border p-5 space-y-5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                <Volume2 className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                Nastavení zvukových efektů
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Vyber si přesně, které typy zvuků mají při práci v YAMLingo hrát.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                role="switch"
                aria-checked={progress.soundEnabled}
                data-testid="audio-master-toggle"
                onClick={onToggleMasterSound}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: progress.soundEnabled
                    ? 'color-mix(in srgb, var(--success) 14%, transparent)'
                    : 'var(--bg-elevated)',
                  borderColor: progress.soundEnabled
                    ? 'color-mix(in srgb, var(--success) 40%, transparent)'
                    : 'var(--border-strong)',
                  color: progress.soundEnabled ? 'var(--success)' : 'var(--text-secondary)',
                }}
              >
                {progress.soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
                Hlavní zvuk: {progress.soundEnabled ? 'Zapnuto' : 'Ztlumeno'}
              </button>

              <button
                type="button"
                onClick={onResetSoundPreferences}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Obnovit výchozí
              </button>
            </div>
          </div>

          {!progress.soundEnabled && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--warning) 10%, transparent)',
                borderColor: 'color-mix(in srgb, var(--warning) 35%, transparent)',
                color: 'var(--text-primary)',
              }}
            >
              <span>
                Hlavní zvuk aplikace je momentálně ztlumený (klávesa <kbd className="font-mono font-semibold">M</kbd>). Zapni ho pro slyšitelnou zpětnou vazbu.
              </span>
              <button
                type="button"
                onClick={onToggleMasterSound}
                className="font-semibold underline underline-offset-2"
                style={{ color: 'var(--warning)' }}
              >
                Zapnout zvuk
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {AUDIO_CHANNELS.map((ch) => {
              const Icon = ch.icon;
              const isOn = prefs[ch.key];
              return (
                <div
                  key={ch.key}
                  className="flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: isOn
                      ? `color-mix(in srgb, ${ch.accentVar} 35%, transparent)`
                      : 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                        style={{
                          backgroundColor: isOn
                            ? `color-mix(in srgb, ${ch.accentVar} 14%, transparent)`
                            : 'var(--bg-surface)',
                          borderColor: isOn
                            ? `color-mix(in srgb, ${ch.accentVar} 38%, transparent)`
                            : 'var(--border-subtle)',
                        }}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: isOn ? ch.accentVar : 'var(--text-muted)' }}
                        />
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          {ch.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {ch.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn}
                      aria-label={ch.title}
                      data-testid={`audio-toggle-${ch.key}`}
                      onClick={() => onToggleSoundChannel(ch.key)}
                      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors"
                      style={{
                        backgroundColor: isOn ? ch.accentVar : 'var(--bg-canvas)',
                        borderColor: isOn ? ch.accentVar : 'var(--border-strong)',
                      }}
                    >
                      <span
                        className="inline-block h-4 w-4 transform rounded-full transition-transform"
                        style={{
                          backgroundColor: isOn ? 'var(--accent-contrast)' : 'var(--text-muted)',
                          transform: isOn ? 'translateX(22px)' : 'translateX(3px)',
                        }}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2.5 text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: isOn ? ch.accentVar : 'var(--text-muted)' }}
                    >
                      {isOn ? 'Aktivní' : 'Vypnuto'}
                    </span>
                    <button
                      type="button"
                      disabled={!isOn || !progress.soundEnabled}
                      onClick={ch.preview}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-strong)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Volume2 className="h-3 w-3" />
                      Přehrát ukázku
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
