import { CheckCircle2, Flame, Lock, Play, Skull, Sparkles } from 'lucide-react';
import { LESSONS, WORLDS, type LessonNode } from '../engine/curriculum';
import { InlineCodeText } from './InlineCodeText';

interface CurriculumMapProps {
  completedLessons: string[];
  onSelectLesson: (lesson: LessonNode) => void;
}

export function CurriculumMap({ completedLessons, onSelectLesson }: CurriculumMapProps) {
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

      <div className="space-y-8">
        {WORLDS.map((world) => {
          const worldLessons = LESSONS.filter((l) => l.worldId === world.id);
          const worldCompletedCount = worldLessons.filter((l) =>
            completedLessons.includes(l.id)
          ).length;

          return (
            <section
              key={world.id}
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
                  {worldCompletedCount}/{worldLessons.length} hotovo ·{' '}
                  {world.mode === 'esphome' ? 'ESPHome 3D' : world.mode === 'ha' ? 'Home Assistant' : 'YAML Core'}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {worldLessons.map((lesson, idx) => {
                  const isDone = completedLessons.includes(lesson.id);
                  const globalIndex = LESSONS.findIndex((x) => x.id === lesson.id);
                  const prevLesson = globalIndex > 0 ? LESSONS[globalIndex - 1] : null;
                  const isRecommendedNext =
                    !isDone && (globalIndex === 0 || (prevLesson && completedLessons.includes(prevLesson.id)));
                  // Allow free exploration in sandbox spirit, while highlighting recommended progression
                  const isLocked = false;

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      disabled={isLocked}
                      onClick={() => onSelectLesson(lesson)}
                      className="group flex flex-col justify-between rounded-xl border p-4 text-left transition-transform hover:-translate-y-0.5"
                      style={{
                        backgroundColor: isRecommendedNext ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                        borderColor: isRecommendedNext ? 'var(--accent)' : 'var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span style={{ color: lesson.isBoss ? 'var(--warning)' : 'var(--text-muted)' }}>
                            {lesson.isBoss ? 'BOSS FIGHT' : `Mise ${world.id}.${idx + 1}`} · {lesson.durationLabel}
                          </span>
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--success)' }} />
                          ) : lesson.isBoss ? (
                            <Skull className="h-4 w-4" style={{ color: 'var(--warning)' }} />
                          ) : isRecommendedNext ? (
                            <Sparkles className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                          ) : isLocked ? (
                            <Lock className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                          ) : (
                            <Flame className="h-4 w-4 opacity-40" />
                          )}
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
