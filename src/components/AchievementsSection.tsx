import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Flame,
  Lightbulb,
  Lock,
  Palette,
  Skull,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  evaluateAchievements,
  summarizeAchievements,
  type AchievementIconId,
} from '../engine/achievements';
import type { PlayerProgress } from '../engine/gamification';

interface AchievementsSectionProps {
  progress: PlayerProgress;
}

type AchievementFilter = 'all' | 'unlocked' | 'locked';

function renderBadgeIcon(icon: AchievementIconId, color: string) {
  const cls = 'h-4 w-4';
  switch (icon) {
    case 'sparkles':
      return <Sparkles className={cls} style={{ color }} />;
    case 'compass':
      return <Compass className={cls} style={{ color }} />;
    case 'trophy':
      return <Trophy className={cls} style={{ color }} />;
    case 'lightbulb':
      return <Lightbulb className={cls} style={{ color }} />;
    case 'skull':
      return <Skull className={cls} style={{ color }} />;
    case 'check':
      return <CheckCircle2 className={cls} style={{ color }} />;
    case 'flame':
      return <Flame className={cls} style={{ color }} />;
    case 'palette':
      return <Palette className={cls} style={{ color }} />;
  }
}

export function AchievementsSection({ progress }: AchievementsSectionProps) {
  const [filter, setFilter] = useState<AchievementFilter>('all');

  const statuses = useMemo(() => evaluateAchievements(progress), [progress]);
  const summary = useMemo(() => summarizeAchievements(statuses), [statuses]);

  const visibleStatuses = useMemo(() => {
    if (filter === 'unlocked') return statuses.filter((s) => s.unlocked);
    if (filter === 'locked') return statuses.filter((s) => !s.unlocked);
    return statuses;
  }, [statuses, filter]);

  return (
    <section
      aria-label="Odznaky a úspěchy"
      data-testid="achievements-section"
      className="rounded-xl border p-5 space-y-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <h2
            className="flex items-center gap-2 font-display text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            <Trophy className="h-5 w-5" style={{ color: 'var(--warning)' }} />
            Odznaky a úspěchy
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Milníky za dokončené lekce, využité nápovědy, poražené Boss Fighty a denní návyk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filtrovat odznaky"
            className="flex items-center gap-1 rounded-lg border p-1"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {(
              [
                { id: 'all', label: `Vše (${summary.totalCount})` },
                { id: 'unlocked', label: `Odemčené (${summary.unlockedCount})` },
                { id: 'locked', label: `Zamčené (${summary.totalCount - summary.unlockedCount})` },
              ] as const
            ).map((opt) => {
              const active = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(opt.id)}
                  className="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <span
            data-testid="achievements-summary-count"
            className="font-mono text-xs font-semibold tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {summary.unlockedCount} / {summary.totalCount} odemčeno
          </span>
        </div>
      </div>

      {visibleStatuses.length === 0 ? (
        <div
          className="rounded-lg border px-4 py-6 text-center text-xs"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          {filter === 'unlocked'
            ? 'Zatím nemáš odemčený žádný odznak — splň první misi nebo použij nápovědu.'
            : 'Všechny odznaky jsou již odemčené. Skvělá práce!'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleStatuses.map((item) => {
            const iconColor = item.unlocked ? item.accentVar : 'var(--text-muted)';
            return (
              <div
                key={item.id}
                data-testid={`achievement-card-${item.id}`}
                data-unlocked={item.unlocked ? 'true' : 'false'}
                className="flex flex-col justify-between rounded-xl border p-3.5 transition-colors"
                style={{
                  backgroundColor: item.unlocked
                    ? `color-mix(in srgb, ${item.accentVar} 7%, var(--bg-elevated))`
                    : 'var(--bg-elevated)',
                  borderColor: item.unlocked
                    ? `color-mix(in srgb, ${item.accentVar} 38%, transparent)`
                    : 'var(--border-subtle)',
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        backgroundColor: item.unlocked
                          ? `color-mix(in srgb, ${item.accentVar} 14%, transparent)`
                          : 'var(--bg-surface)',
                        borderColor: item.unlocked
                          ? `color-mix(in srgb, ${item.accentVar} 38%, transparent)`
                          : 'var(--border-subtle)',
                      }}
                    >
                      {renderBadgeIcon(item.icon, iconColor)}
                    </div>

                    {item.unlocked ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          color: item.accentVar,
                          backgroundColor: `color-mix(in srgb, ${item.accentVar} 13%, transparent)`,
                          borderColor: `color-mix(in srgb, ${item.accentVar} 35%, transparent)`,
                        }}
                      >
                        Odemčeno
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Lock className="h-3 w-3" />
                        {item.current}/{item.target}
                      </span>
                    )}
                  </div>

                  <h3
                    className="mt-2.5 font-display text-sm font-bold"
                    style={{ color: item.unlocked ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {item.description}
                  </p>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    <span>Postup</span>
                    <span style={{ color: item.unlocked ? item.accentVar : 'var(--text-secondary)' }}>
                      {item.current} / {item.target}
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: 'var(--bg-canvas)' }}
                  >
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${item.progressPct}%`,
                        backgroundColor: item.unlocked ? item.accentVar : 'var(--accent)',
                        opacity: item.unlocked ? 1 : 0.65,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
