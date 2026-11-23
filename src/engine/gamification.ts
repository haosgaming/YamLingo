export type EditorThemeId = 'minimal-dark' | 'ha-blue' | 'retro-terminal' | 'light';
export type BoardSkinId = 'pcb-emerald' | 'pcb-obsidian' | 'pcb-gold' | 'pcb-ha-cyan';

export interface ShopItem {
  id: string;
  category: 'theme' | 'skin' | 'powerup';
  targetId: string;
  name: string;
  description: string;
  price: number;
  swatchColor: string;
}

export interface SoundPreferences {
  uiClicks: boolean;
  successFanfares: boolean;
  errorAlerts: boolean;
  typingFeedback: boolean;
}

export interface PlayerProgress {
  volts: number;
  xp: number;
  streakDays: number;
  streakFreezes: number;
  lastActiveDate: string; // YYYY-MM-DD
  completedLessons: string[];
  activityByDate: Record<string, number>;
  unlockedThemes: EditorThemeId[];
  activeTheme: EditorThemeId;
  unlockedSkins: BoardSkinId[];
  activeSkin: BoardSkinId;
  hintsAvailable: number;
  hintsUsedCount: number;
  flawlessLessonsCount: number;
  soundEnabled: boolean;
  soundPreferences: SoundPreferences;
  zenMode: boolean;
}

export interface DailyActivityPoint {
  date: string;
  label: string;
  shortLabel: string;
  completions: number;
  isToday: boolean;
}

export interface ActivitySummary30Days {
  totalCompletions: number;
  activeDays: number;
  bestDayCount: number;
  averagePerActiveDay: number;
}

export const SHOP_CATALOG: ShopItem[] = [
  {
    id: 'theme-minimal-dark',
    category: 'theme',
    targetId: 'minimal-dark',
    name: 'Minimal OLED Dark',
    description: 'Klidný grafitový vzhled šetřící oči při nočním bastlení.',
    price: 0,
    swatchColor: '#111317',
  },
  {
    id: 'theme-ha-blue',
    category: 'theme',
    targetId: 'ha-blue',
    name: 'Home Assistant Blue',
    description: 'Tlumená modrá paleta komunity Home Assistant.',
    price: 40,
    swatchColor: '#4ea3d1',
  },
  {
    id: 'theme-retro-terminal',
    category: 'theme',
    targetId: 'retro-terminal',
    name: 'Retro Terminal',
    description: 'Příjemný tlumený zelený terminál bez ostrého záření.',
    price: 75,
    swatchColor: '#58b878',
  },
  {
    id: 'theme-light',
    category: 'theme',
    targetId: 'light',
    name: 'Světlý režim',
    description: 'Čistý denní kontrast s ocelově modrým akcentem.',
    price: 0,
    swatchColor: '#f4f5f7',
  },
  {
    id: 'skin-pcb-emerald',
    category: 'skin',
    targetId: 'pcb-emerald',
    name: 'Klasická zelená PCB',
    description: 'Tradiční solder maska ESP32 vývojové desky.',
    price: 0,
    swatchColor: '#11613b',
  },
  {
    id: 'skin-pcb-obsidian',
    category: 'skin',
    targetId: 'pcb-obsidian',
    name: 'Matná černá Developer',
    description: 'Prémiová černá PCB deska s bílým potiskem.',
    price: 60,
    swatchColor: '#16191f',
  },
  {
    id: 'skin-pcb-ha-cyan',
    category: 'skin',
    targetId: 'pcb-ha-cyan',
    name: 'Home Assistant Edition',
    description: 'Speciální břidlicově modrá edice pro sběratele.',
    price: 90,
    swatchColor: '#0c6b94',
  },
  {
    id: 'skin-pcb-gold',
    category: 'skin',
    targetId: 'pcb-gold',
    name: 'Zlatá Collector PCB',
    description: 'Zlacené spoje na královské fialovo-zlaté desce.',
    price: 140,
    swatchColor: '#c9942a',
  },
  {
    id: 'powerup-freeze',
    category: 'powerup',
    targetId: 'streak-freeze',
    name: 'Streak Freeze štít',
    description: 'Ochrání vaši denní řadu, pokud jeden den vynecháte.',
    price: 35,
    swatchColor: '#5b9bd5',
  },
  {
    id: 'powerup-hints',
    category: 'powerup',
    targetId: 'hint-pack',
    name: 'Balíček 3 nápověd',
    description: 'Rychlé vysvětlení bez ztráty bodů v lekcích.',
    price: 25,
    swatchColor: '#d49a45',
  },
];

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  uiClicks: true,
  successFanfares: true,
  errorAlerts: true,
  typingFeedback: true,
};

export function createDefaultProgress(todayStr = getLocalDateKey()): PlayerProgress {
  return {
    volts: 60,
    xp: 0,
    streakDays: 1,
    streakFreezes: 1,
    lastActiveDate: todayStr,
    completedLessons: [],
    activityByDate: {},
    unlockedThemes: ['minimal-dark', 'light'],
    activeTheme: 'minimal-dark',
    unlockedSkins: ['pcb-emerald'],
    activeSkin: 'pcb-emerald',
    hintsAvailable: 3,
    hintsUsedCount: 0,
    flawlessLessonsCount: 0,
    soundEnabled: true,
    soundPreferences: { ...DEFAULT_SOUND_PREFERENCES },
    zenMode: false,
  };
}

export function toggleSoundPreference(
  progress: PlayerProgress,
  channel: keyof SoundPreferences
): PlayerProgress {
  const currentPrefs: SoundPreferences = {
    ...DEFAULT_SOUND_PREFERENCES,
    ...(progress.soundPreferences ?? {}),
  };
  return {
    ...progress,
    soundPreferences: {
      ...currentPrefs,
      [channel]: !currentPrefs[channel],
    },
  };
}

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function calculateLessonReward(params: {
  isBoss: boolean;
  alreadyCompleted: boolean;
  mistakesCount: number;
  remainingSeconds?: number;
}): { volts: number; xp: number } {
  if (params.alreadyCompleted) {
    return { volts: 5, xp: 15 };
  }
  const baseVolts = params.isBoss ? 50 : 25;
  const baseXp = params.isBoss ? 120 : 50;
  const flawlessBonus = params.mistakesCount === 0 ? 10 : 0;
  const speedBonus = params.isBoss && (params.remainingSeconds ?? 0) > 20 ? 15 : 0;
  return {
    volts: baseVolts + flawlessBonus + speedBonus,
    xp: baseXp + flawlessBonus * 2,
  };
}

export function applyLessonCompletion(
  progress: PlayerProgress,
  lessonId: string,
  reward: { volts: number; xp: number },
  todayStr = getLocalDateKey(),
  options?: { flawless?: boolean }
): PlayerProgress {
  const updatedStreak = updateStreakOnActivity(progress, todayStr);
  const completedLessons = progress.completedLessons.includes(lessonId)
    ? progress.completedLessons
    : [...progress.completedLessons, lessonId];
  const prevMap = progress.activityByDate ?? {};
  const activityByDate: Record<string, number> = {
    ...prevMap,
    [todayStr]: (prevMap[todayStr] ?? 0) + 1,
  };
  const flawlessLessonsCount =
    (progress.flawlessLessonsCount ?? 0) + (options?.flawless ? 1 : 0);

  return {
    ...updatedStreak,
    volts: updatedStreak.volts + reward.volts,
    xp: updatedStreak.xp + reward.xp,
    completedLessons,
    activityByDate,
    flawlessLessonsCount,
  };
}

export function buildLast30DaysActivity(
  activityByDate: Record<string, number> = {},
  todayStr = getLocalDateKey()
): DailyActivityPoint[] {
  const anchor = new Date(`${todayStr}T12:00:00`);
  const points: DailyActivityPoint[] = [];

  for (let offset = 29; offset >= 0; offset--) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - offset);
    const dateKey = getLocalDateKey(d);
    const rawCount = activityByDate[dateKey] ?? 0;
    const completions = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 0;

    points.push({
      date: dateKey,
      label: `${d.getDate()}. ${d.getMonth() + 1}.`,
      shortLabel: `${d.getDate()}.`,
      completions,
      isToday: offset === 0,
    });
  }

  return points;
}

export function summarizeActivity30Days(
  points: DailyActivityPoint[]
): ActivitySummary30Days {
  let totalCompletions = 0;
  let activeDays = 0;
  let bestDayCount = 0;

  for (const pt of points) {
    totalCompletions += pt.completions;
    if (pt.completions > 0) {
      activeDays += 1;
    }
    if (pt.completions > bestDayCount) {
      bestDayCount = pt.completions;
    }
  }

  return {
    totalCompletions,
    activeDays,
    bestDayCount,
    averagePerActiveDay:
      activeDays > 0 ? Math.round((totalCompletions / activeDays) * 10) / 10 : 0,
  };
}

export function updateStreakOnActivity(
  progress: PlayerProgress,
  todayStr: string
): PlayerProgress {
  if (progress.lastActiveDate === todayStr) {
    return progress;
  }

  const prev = new Date(`${progress.lastActiveDate}T00:00:00`);
  const curr = new Date(`${todayStr}T00:00:00`);
  const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return {
      ...progress,
      streakDays: progress.streakDays + 1,
      lastActiveDate: todayStr,
    };
  }

  if (diffDays === 2 && progress.streakFreezes > 0) {
    // Streak Freeze saves the streak automatically!
    return {
      ...progress,
      streakDays: progress.streakDays + 1,
      streakFreezes: progress.streakFreezes - 1,
      lastActiveDate: todayStr,
    };
  }

  return {
    ...progress,
    streakDays: 1,
    lastActiveDate: todayStr,
  };
}

export function purchaseShopItem(
  progress: PlayerProgress,
  itemId: string
): { success: boolean; progress: PlayerProgress; reason?: string } {
  const item = SHOP_CATALOG.find((i) => i.id === itemId);
  if (!item) {
    return { success: false, progress, reason: 'Položka v obchodě neexistuje.' };
  }

  if (item.category === 'theme') {
    const themeId = item.targetId as EditorThemeId;
    if (progress.unlockedThemes.includes(themeId)) {
      return { success: true, progress: { ...progress, activeTheme: themeId } };
    }
    if (progress.volts < item.price) {
      return { success: false, progress, reason: 'Nemáte dostatek Voltů.' };
    }
    return {
      success: true,
      progress: {
        ...progress,
        volts: progress.volts - item.price,
        unlockedThemes: [...progress.unlockedThemes, themeId],
        activeTheme: themeId,
      },
    };
  }

  if (item.category === 'skin') {
    const skinId = item.targetId as BoardSkinId;
    if (progress.unlockedSkins.includes(skinId)) {
      return { success: true, progress: { ...progress, activeSkin: skinId } };
    }
    if (progress.volts < item.price) {
      return { success: false, progress, reason: 'Nemáte dostatek Voltů.' };
    }
    return {
      success: true,
      progress: {
        ...progress,
        volts: progress.volts - item.price,
        unlockedSkins: [...progress.unlockedSkins, skinId],
        activeSkin: skinId,
      },
    };
  }

  if (item.category === 'powerup') {
    if (progress.volts < item.price) {
      return { success: false, progress, reason: 'Nemáte dostatek Voltů.' };
    }
    if (item.targetId === 'streak-freeze') {
      return {
        success: true,
        progress: {
          ...progress,
          volts: progress.volts - item.price,
          streakFreezes: progress.streakFreezes + 1,
        },
      };
    }
    if (item.targetId === 'hint-pack') {
      return {
        success: true,
        progress: {
          ...progress,
          volts: progress.volts - item.price,
          hintsAvailable: progress.hintsAvailable + 3,
        },
      };
    }
  }

  return { success: false, progress, reason: 'Neznámý typ položky.' };
}

export function getSmartNudgeMessage(hour: number, streakDays: number): string {
  if (hour >= 20 || hour < 5) {
    return 'Tvoje virtuální ESP32 pláče v koutě. Dej jí 2 minuty kódu, ať může spát.';
  }
  if (hour >= 5 && hour < 11) {
    return `Ranní káva a ${streakDays}. den v řadě? Stačí jedna mikro-lekce pro udržení tempa.`;
  }
  if (hour >= 11 && hour < 16) {
    return 'Rychlá 2minutová pauza: oprav jedno relé v ESPHome a posbírej Volty.';
  }
  return 'K večeru se nejlíp ladí automatizace po západu slunce. Chceš jednu vyzkoušet?';
}
