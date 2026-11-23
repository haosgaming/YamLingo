import { LESSONS } from './curriculum';
import type { PlayerProgress } from './gamification';

export type AchievementIconId =
  | 'sparkles'
  | 'compass'
  | 'trophy'
  | 'lightbulb'
  | 'skull'
  | 'check'
  | 'flame'
  | 'palette';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: AchievementIconId;
  accentVar: string;
  target: number;
  getCurrent: (progress: PlayerProgress) => number;
}

export interface AchievementStatus {
  id: string;
  title: string;
  description: string;
  icon: AchievementIconId;
  accentVar: string;
  current: number;
  target: number;
  progressPct: number;
  unlocked: boolean;
}

const BOSS_LESSON_IDS = LESSONS.filter((l) => l.isBoss).map((l) => l.id);

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-lesson',
    title: 'První jiskra',
    description: 'Dokonči 1. výukovou misi v libovolném světě.',
    icon: 'sparkles',
    accentVar: 'var(--success)',
    target: 1,
    getCurrent: (p) => p.completedLessons.length,
  },
  {
    id: 'lessons-10',
    title: 'Půlka cesty',
    description: 'Dokonči alespoň 10 různých výukových misí.',
    icon: 'compass',
    accentVar: 'var(--accent)',
    target: 10,
    getCurrent: (p) => p.completedLessons.length,
  },
  {
    id: 'lessons-all',
    title: 'Mistr YAMLingu',
    description: 'Dokonči všech 20 misí od YAML základů po Jinja2.',
    icon: 'trophy',
    accentVar: 'var(--warning)',
    target: LESSONS.length,
    getCurrent: (p) => p.completedLessons.length,
  },
  {
    id: 'hints-50',
    title: 'Věčný badatel',
    description: 'Využij celkem 50 nápověd během řešení misí.',
    icon: 'lightbulb',
    accentVar: 'var(--warning)',
    target: 50,
    getCurrent: (p) => p.hintsUsedCount ?? 0,
  },
  {
    id: 'boss-slayer',
    title: 'Krotitel krizí',
    description: 'Poraz všech 5 krizových Boss Fightů napříč světy.',
    icon: 'skull',
    accentVar: 'var(--danger)',
    target: BOSS_LESSON_IDS.length,
    getCurrent: (p) =>
      BOSS_LESSON_IDS.filter((id) => p.completedLessons.includes(id)).length,
  },
  {
    id: 'flawless-3',
    title: 'Čistý zápis',
    description: 'Splň 3 mise bez jediné chyby při kontrole kódu.',
    icon: 'check',
    accentVar: 'var(--success)',
    target: 3,
    getCurrent: (p) => p.flawlessLessonsCount ?? 0,
  },
  {
    id: 'streak-3',
    title: 'Železný návyk',
    description: 'Udrž denní řadu alespoň 3 dny v kuse.',
    icon: 'flame',
    accentVar: 'var(--danger)',
    target: 3,
    getCurrent: (p) => p.streakDays ?? 1,
  },
  {
    id: 'collector-2',
    title: 'Bastlířský sběratel',
    description: 'Odemkni alespoň 2 prémiová témata editoru nebo PCB skiny.',
    icon: 'palette',
    accentVar: 'var(--accent)',
    target: 2,
    getCurrent: (p) => {
      const extraThemes = Math.max(0, (p.unlockedThemes?.length ?? 2) - 2);
      const extraSkins = Math.max(0, (p.unlockedSkins?.length ?? 1) - 1);
      return extraThemes + extraSkins;
    },
  },
];

export function evaluateAchievements(progress: PlayerProgress): AchievementStatus[] {
  return ACHIEVEMENTS.map((def) => {
    const rawCurrent = def.getCurrent(progress);
    const current = Math.max(0, Math.min(def.target, Math.floor(rawCurrent)));
    const progressPct = Math.round((current / Math.max(1, def.target)) * 100);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      accentVar: def.accentVar,
      current,
      target: def.target,
      progressPct,
      unlocked: rawCurrent >= def.target,
    };
  });
}

export function summarizeAchievements(statuses: AchievementStatus[]): {
  unlockedCount: number;
  totalCount: number;
  completionPct: number;
} {
  const totalCount = statuses.length;
  const unlockedCount = statuses.filter((s) => s.unlocked).length;
  const completionPct =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  return { unlockedCount, totalCount, completionPct };
}
