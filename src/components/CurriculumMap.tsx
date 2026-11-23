import { useMemo, useState } from 'react';
import { CheckCircle2, Filter, Flame, Lock, Play, Skull, Sparkles } from 'lucide-react';
import {
  countLessonsByDifficulty,
  DIFFICULTY_META,
  filterLessonsByDifficulty,
  LESSONS,
  WORLDS,
  type DifficultyFilter,
  type LessonNode,
} from '../engine/curriculum';
import type { PlayerProgress } from '../engine/gamification';
import { AchievementsSection } from './AchievementsSection';
import { InlineCodeText } from './InlineCodeText';
import { ProgressDashboard } from './ProgressDashboard';

interface CurriculumMapProps {
  progress: PlayerProgress;
  onSelectLesson: (lesson: LessonNode) => void;
}

const FILTER_OPTIONS: { id: DifficultyFilter; label: string; colorVar?: string }[] = [
  { id: 'all', label: 'Vše' },
  { id: 'easy', label: DIFFICULTY_META.easy.label, colorVar: DIFFICULTY_META.easy.colorVar },
  { id: 'medium', label: DIFFICULTY_META.medium.label, colorVar: DIFFICULTY_META.medium.colorVar },
  { id: 'hard', label: DIFFICULTY_META.hard.label, colorVar: DIFFICULTY_META.hard.colorVar },
];

export function CurriculumMap({
  progress,
  onSelectLesson,
}: CurriculumMapProps) {
  const { completedLessons, activityByDate, streakDays, xp } = progress;
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');

  const difficultyCounts = useMemo(() => countLessonsByDifficulty(LESSONS), []);
  const filteredLessons = useMemo(
    () => filterLessonsByDifficulty(LESSONS, difficultyFilter),
    [difficultyFilter]
  );

  const visibleWorlds = useMemo(
    () =>
      WORLDS.map((world) => {
        const allWorldLessons = LESSONS.filter((l) => l.worldId === world.id);
        const matchingLessons = filteredLessons.filter((l) => l.worldId === world.id);
        return { world, allWorldLessons, matchingLessons };
      }).filter((entry) => entry.matchingLessons.length > 0),
    [filteredLessons]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            Výuková mapa HomeCraft
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Krátké 2–4minutové mise od základů YAML až po Jinja2 šablony. Každý svět končí krizovým Boss Fightem.
          </p>
        </div>
        <div className="text-sm font-mono tabular-nums" style={{ color: 'var(--accent)' }}>
          Dokončeno {completedLessons.length} / {LESSONS.length} misí
        </div>
      </div>

      <ProgressDashboard
        completedLessons={completedLessons}
        activityByDate={activityByDate ?? {}}
        streakDays={streakDays}
        xp={xp}
      />

      <AchievementsSection progress={progress} />

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Filter className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            Obtížnost:
          </span>
          <div
            role="group"
            aria-label="Filtrovat mise podle obtížnosti"
            className="flex flex-wrap items-center gap-1.5"
          >
            {FILTER_OPTIONS.map((opt) => {
              const active = difficultyFilter === opt.id;
              const count = difficultyCounts[opt.id];
              const accentColor = opt.colorVar ?? 'var(--accent)';
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDifficultyFilter(opt.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: active
                      ? `color-mix(in srgb, ${accentColor} 16%, transparent)`
                      : 'var(--bg-elevated)',
                    borderColor: active
                      ? `color-mix(in srgb, ${accentColor} 45%, transparent)`
                      : 'var(--border-subtle)',
                    color: active ? accentColor : 'var(--text-secondary)',
                  }}
                >
                  {opt.colorVar && (
                    <span
                      className="h-2 w-2 rounded-full"
                      aria-hidden="true"
                      style={{ backgroundColor: opt.colorVar }}
                    />
                  )}
                  <span>{opt.label}</span>
                  <span
                    className="font-mono text-[11px] tabular-nums opacity-75"
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
          <span data-testid="filtered-lessons-count">
            Zobrazeno {filteredLessons.length} z {LESSONS.length} misí
          </span>
          {difficultyFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setDifficultyFilter('all')}
              className="font-sans font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Zobrazit vše
            </button>
          )}
        </div>
      </div>

      <div className="space-y-8" data-testid="curriculum-worlds">
        {visibleWorlds.map(({ world, allWorldLessons, matchingLessons }) => {
          const worldCompletedCount = allWorldLessons.filter((l) =>
            completedLessons.includes(l.id)
          ).length;

          return (
            <section
              key={world.id}
              data-testid={`world-section-${world.id}`}
              className="rounded-xl border p-5"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h2 className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {world.title}
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {world.subtitle}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {worldCompletedCount}/{allWorldLessons.length} hotovo ·{' '}
                  {world.mode === 'esphome' ? 'ESPHome 3D' : world.mode === 'ha' ? 'Home Assistant' : 'YAML Core'}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {matchingLessons.map((lesson) => {
                  const isDone = completedLessons.includes(lesson.id);
                  const globalIndex = LESSONS.findIndex((x) => x.id === lesson.id);
                  const prevLesson = globalIndex > 0 ? LESSONS[globalIndex - 1] : null;
                  const isRecommendedNext =
                    !isDone && (globalIndex === 0 || (prevLesson && completedLessons.includes(prevLesson.id)));
                  // Allow free exploration in sandbox spirit, while highlighting recommended progression
                  const isLocked = false;
                  const diffMeta = DIFFICULTY_META[lesson.difficulty];

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      disabled={isLocked}
                      data-testid={`lesson-card-${lesson.id}`}
                      data-difficulty={lesson.difficulty}
                      onClick={() => onSelectLesson(lesson)}
                      className="group flex flex-col justify-between rounded-xl border p-4 text-left transition-transform hover:-translate-y-0.5"
                      style={{
                        backgroundColor: isRecommendedNext ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                        borderColor: isRecommendedNext ? 'var(--accent)' : 'var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs font-mono">
                          <span style={{ color: lesson.isBoss ? 'var(--warning)' : 'var(--text-muted)' }}>
                            {lesson.isBoss ? 'BOSS FIGHT' : `Mise ${world.id}.${lesson.order}`} · {lesson.durationLabel}
                          </span>
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />
                          ) : lesson.isBoss ? (
                            <Skull className="h-4 w-4 shrink-0" style={{ color: 'var(--warning)' }} />
                          ) : isRecommendedNext ? (
                            <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                          ) : isLocked ? (
                            <Lock className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                          ) : (
                            <Flame className="h-4 w-4 shrink-0 opacity-40" />
                          )}
                        </div>

                        <div className="mt-2">
                          <span
                            data-testid={`difficulty-badge-${lesson.id}`}
                            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold"
                            style={{
                              color: diffMeta.colorVar,
                              backgroundColor: `color-mix(in srgb, ${diffMeta.colorVar} 12%, transparent)`,
                              borderColor: `color-mix(in srgb, ${diffMeta.colorVar} 34%, transparent)`,
                            }}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              aria-hidden="true"
                              style={{ backgroundColor: diffMeta.colorVar }}
                            />
                            {diffMeta.label}
                          </span>
                        </div>

                        <h3 className="mt-2 font-display text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                          {lesson.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          <InlineCodeText text={lesson.brief} />
                        </p>
                      </div>

                      <div
                        className="mt-4 flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: isDone ? 'var(--success)' : 'var(--accent)' }}
                      >
                        <Play className="h-3.5 w-3.5" />
                        {isDone ? 'Zopakovat misi' : lesson.isBoss ? 'Spustit krizový boj' : 'Začít misi'}
                      </div>
                    </button>
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
