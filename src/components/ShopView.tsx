import { Check, Cpu, Lightbulb, Palette, Shield, Zap } from 'lucide-react';
import {
  SHOP_CATALOG,
  type PlayerProgress,
  type ShopItem,
} from '../engine/gamification';

interface ShopViewProps {
  progress: PlayerProgress;
  onBuyOrEquip: (itemId: string) => void;
  feedbackMsg: string | null;
}

export function ShopView({ progress, onBuyOrEquip, feedbackMsg }: ShopViewProps) {
  const categories: Array<{ id: ShopItem['category']; title: string; icon: typeof Palette }> = [
    { id: 'theme', title: 'Témata editoru & aplikace', icon: Palette },
    { id: 'skin', title: 'Skiny pro 3D desku ESP32', icon: Cpu },
    { id: 'powerup', title: 'Ochrana řady & nápovědy', icon: Shield },
  ];

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
            Odemkni nová témata editoru, sběratelské skiny pro 3D ESP32 desku nebo ochranné štíty řady.
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
    </div>
  );
}
