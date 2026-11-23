import { useMemo } from 'react';
import { Award, BarChart3, CalendarDays, Flame, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LESSONS, WORLDS } from '../engine/curriculum';
import {
  buildLast30DaysActivity,
  summarizeActivity30Days,
  type DailyActivityPoint,
} from '../engine/gamification';

interface ProgressDashboardProps {
  completedLessons: string[];
  activityByDate: Record<string, number>;
  streakDays: number;
  xp: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyActivityPoint }>;
}

function ActivityTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0].payload;

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-strong)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex items-center justify-between gap-3 font-mono font-semibold">
        <span>{pt.label}</span>
        {pt.isToday && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px]"
            style={{
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
            }}
          >
            Dnes
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <span>Dokončené lekce:</span>
        <strong
          className="font-mono tabular-nums"
          style={{ color: pt.completions > 0 ? 'var(--success)' : 'var(--text-primary)' }}
        >
          {pt.completions}
        </strong>
      </div>
    </div>
  );
}

export function ProgressDashboard({
  completedLessons,
  activityByDate,
  streakDays,
  xp,
}: ProgressDashboardProps) {
  const days = useMemo(() => buildLast30DaysActivity(activityByDate), [activityByDate]);
  const summary = useMemo(() => summarizeActivity30Days(days), [days]);
  const completionPct = Math.round((completedLessons.length / LESSONS.length) * 100);

  return (
    <section
      aria-label="Přehled pokroku za posledních 30 dní"
      className="rounded-xl border p-5 space-y-5"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Top Row: Heading + KPI Summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="flex items-center gap-2 font-display text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            <BarChart3 className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            Aktivita za posledních 30 dní
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Denní počet dokončených lekcí a celkový postup napříč světy HomeCraft.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: 'var(--accent)' }} />
            Minulé dny
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: 'var(--success)' }} />
            Dnešní aktivita
          </span>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          className="rounded-lg border px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            Lekce za 30 dní
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {summary.totalCompletions}
          </div>
        </div>

        <div
          className="rounded-lg border px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <CalendarDays className="h-3.5 w-3.5" style={{ color: 'var(--success)' }} />
            Aktivní dny
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {summary.activeDays}
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              {' '}
              / 30
            </span>
          </div>
        </div>

        <div
          className="rounded-lg border px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <Flame className="h-3.5 w-3.5" style={{ color: 'var(--danger)' }} />
            Denní řada
          </div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {streakDays}d
          </div>
        </div>

        <div
          className="rounded-lg border px-3.5 py-2.5"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <Award className="h-3.5 w-3.5" style={{ color: 'var(--warning)' }} />
            Celkem misí &amp; XP
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono text-xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            <span>{completionPct}%</span>
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              ({xp} XP)
            </span>
          </div>
        </div>
      </div>

      {/* 30-Day Recharts Bar Chart */}
      <div
        data-testid="progress-chart-container"
        className="rounded-lg border px-3 pt-4 pb-2"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="h-[190px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border-subtle)"
              />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border-subtle)' }}
                interval={4}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                domain={[0, (dataMax: number) => Math.max(3, dataMax + 1)]}
              />
              <Tooltip
                cursor={{ fill: 'var(--accent-soft)' }}
                content={<ActivityTooltip />}
              />
              <Bar
                dataKey="completions"
                name="Dokončené lekce"
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
                minPointSize={2}
                isAnimationActive={false}
              >
                {days.map((entry) => (
                  <Cell
                    key={entry.date}
                    fill={
                      entry.completions === 0
                        ? 'var(--border-strong)'
                        : entry.isToday
                        ? 'var(--success)'
                        : 'var(--accent)'
                    }
                    fillOpacity={entry.completions === 0 ? 0.45 : 0.92}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {summary.totalCompletions === 0 && (
          <p className="pb-1 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Zatím nebyla dokončena žádná lekce za posledních 30 dní — po splnění první mise se zde vykreslí sloupec dnešní aktivity.
          </p>
        )}
      </div>

      {/* Per-World Mastery Strip */}
      <div className="grid gap-2.5 sm:grid-cols-5">
        {WORLDS.map((world) => {
          const wLessons = LESSONS.filter((l) => l.worldId === world.id);
          const doneCount = wLessons.filter((l) => completedLessons.includes(l.id)).length;
          const pct = Math.round((doneCount / wLessons.length) * 100);
          return (
            <div
              key={world.id}
              className="rounded-lg border px-3 py-2"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
                  Svět {world.id}
                </span>
                <span className="font-mono tabular-nums" style={{ color: doneCount === wLessons.length ? 'var(--success)' : 'var(--text-muted)' }}>
                  {doneCount}/{wLessons.length}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--bg-canvas)' }}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: doneCount === wLessons.length ? 'var(--success)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
