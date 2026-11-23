import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Eye,
  EyeOff,
  Flame,
  HelpCircle,
  Map as MapIcon,
  Pause,
  Shield,
  ShoppingBag,
  Stethoscope,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { CurriculumMap } from './components/CurriculumMap';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { LessonWorkspace } from './components/LessonWorkspace';
import { ParticleBurst } from './components/ParticleBurst';
import { ShopView } from './components/ShopView';
import { TitleScreen } from './components/TitleScreen';
import { YamlDoctorView } from './components/YamlDoctorView';
import { evaluateAchievements, type AchievementStatus } from './engine/achievements';
import { LESSONS, type LessonNode } from './engine/curriculum';
import {
  applyLessonCompletion,
  calculateLessonReward,
  createDefaultProgress,
  DEFAULT_SOUND_PREFERENCES,
  getLocalDateKey,
  getSmartNudgeMessage,
  purchaseShopItem,
  toggleSoundPreference,
  type EditorThemeId,
  type PlayerProgress,
  type SoundPreferences,
} from './engine/gamification';
import { soundEngine } from './utils/soundEngine';

type GamePhase = 'title' | 'playing' | 'paused';
type ActiveTab = 'map' | 'lesson' | 'doctor' | 'shop';

const STORAGE_KEY = 'yamlingo_progress_v1';

function loadInitialProgress(): PlayerProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
      const defaults = createDefaultProgress();
      return {
        ...defaults,
        ...parsed,
        soundPreferences: {
          ...DEFAULT_SOUND_PREFERENCES,
          ...(parsed.soundPreferences ?? {}),
        },
      };
    }
  } catch {
    // Ignore storage parse failures
  }
  return createDefaultProgress();
}

export default function App() {
  const [progress, setProgress] = useState<PlayerProgress>(loadInitialProgress);
  const [phase, setPhase] = useState<GamePhase>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      return 'playing';
    }
    return 'title';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [activeLesson, setActiveLesson] = useState<LessonNode>(LESSONS[0]);
  const [burstKey, setBurstKey] = useState(0);
  const [shopFeedback, setShopFeedback] = useState<string | null>(null);
  const [nudgeVisible, setNudgeVisible] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [unlockedToast, setUnlockedToast] = useState<AchievementStatus | null>(null);
  const prevUnlockedIdsRef = useRef<Set<string> | null>(null);

  // Sync body dataset.state for Game Shell state machine
  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  // Sync active theme onto root HTML element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', progress.activeTheme);
    if (progress.activeTheme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
  }, [progress.activeTheme]);

  // Sync sound engine and localStorage
  useEffect(() => {
    soundEngine.setEnabled(progress.soundEnabled);
    soundEngine.setPreferences(progress.soundPreferences);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore quota errors
    }
  }, [progress]);

  // Detect newly unlocked achievements and show a non-intrusive toast
  useEffect(() => {
    const currentStatuses = evaluateAchievements(progress);
    const unlockedNow = new Set(
      currentStatuses.filter((s) => s.unlocked).map((s) => s.id)
    );
    if (prevUnlockedIdsRef.current === null) {
      prevUnlockedIdsRef.current = unlockedNow;
      return;
    }
    const newlyUnlocked = currentStatuses.find(
      (s) => s.unlocked && !prevUnlockedIdsRef.current?.has(s.id)
    );
    prevUnlockedIdsRef.current = unlockedNow;
    if (newlyUnlocked) {
      setUnlockedToast(newlyUnlocked);
    }
  }, [progress]);

  useEffect(() => {
    if (!unlockedToast) return;
    const timer = window.setTimeout(() => setUnlockedToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [unlockedToast]);

  // Global keyboard shortcuts (navigation, Zen mode, sound, pause, cheat sheet)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === '?' && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (phase !== 'title') {
          e.preventDefault();
          setShortcutsOpen((prev) => !prev);
        }
        return;
      }

      if (shortcutsOpen) {
        return;
      }

      if (e.key === 'Escape') {
        if (phase === 'playing') {
          setPhase('paused');
        } else if (phase === 'paused') {
          setPhase('playing');
        }
        return;
      }

      if (isTyping || e.ctrlKey || e.metaKey || e.altKey || phase !== 'playing') {
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === 'p') {
        setPhase('paused');
      } else if (lower === 'z') {
        setProgress((p) => ({ ...p, zenMode: !p.zenMode }));
      } else if (lower === 'm') {
        setProgress((p) => ({ ...p, soundEnabled: !p.soundEnabled }));
      } else if (e.key === '1') {
        setActiveTab('map');
      } else if (e.key === '2') {
        setActiveTab('lesson');
      } else if (e.key === '3') {
        setActiveTab('doctor');
      } else if (e.key === '4') {
        setActiveTab('shop');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, shortcutsOpen]);

  const handleStartFromTitle = useCallback(() => {
    soundEngine.playPop();
    setPhase('playing');
    setActiveTab('map');
  }, []);

  const handleOpenDoctorFromTitle = useCallback(() => {
    soundEngine.playPop();
    setPhase('playing');
    setActiveTab('doctor');
  }, []);

  const handleSelectLesson = (lesson: LessonNode) => {
    soundEngine.playPop();
    setActiveLesson(lesson);
    setActiveTab('lesson');
  };

  const handleLessonComplete = (stats: { mistakesCount: number; remainingSeconds?: number }) => {
    const alreadyCompleted = progress.completedLessons.includes(activeLesson.id);
    const reward = calculateLessonReward({
      isBoss: activeLesson.isBoss,
      alreadyCompleted,
      mistakesCount: stats.mistakesCount,
      remainingSeconds: stats.remainingSeconds,
    });
    setProgress((prev) =>
      applyLessonCompletion(prev, activeLesson.id, reward, getLocalDateKey(), {
        flawless: !alreadyCompleted && stats.mistakesCount === 0,
      })
    );
    setBurstKey((k) => k + 1);
    return reward;
  };

  const handleUseHint = () => {
    setProgress((prev) => ({
      ...prev,
      hintsAvailable: Math.max(0, prev.hintsAvailable - 1),
      hintsUsedCount: (prev.hintsUsedCount ?? 0) + 1,
    }));
    return true;
  };

  const handleNextLesson = () => {
    const idx = LESSONS.findIndex((l) => l.id === activeLesson.id);
    if (idx >= 0 && idx + 1 < LESSONS.length) {
      soundEngine.playPop();
      setActiveLesson(LESSONS[idx + 1]);
    } else {
      setActiveTab('map');
    }
  };

  const handleBuyOrEquip = (itemId: string) => {
    const res = purchaseShopItem(progress, itemId);
    if (res.success) {
      soundEngine.playSuccessFanfare(false);
      setProgress(res.progress);
      setShopFeedback('Položka úspěšně aktivována!');
    } else {
      soundEngine.playErrorBonk();
      setShopFeedback(res.reason || 'Nákup se nezdařil.');
    }
  };

  const cycleTheme = (themeId: EditorThemeId) => {
    if (progress.unlockedThemes.includes(themeId)) {
      soundEngine.playPop();
      setProgress((p) => ({ ...p, activeTheme: themeId }));
    } else {
      setActiveTab('shop');
      setShopFeedback('Toto téma si můžeš odemknout za nasbírané Volty.');
    }
  };

  if (phase === 'title') {
    return (
      <TitleScreen
        skin={progress.activeSkin}
        onStart={handleStartFromTitle}
        onOpenDoctor={handleOpenDoctorFromTitle}
      />
    );
  }

  const nudgeText = getSmartNudgeMessage(new Date().getHours(), progress.streakDays);

  return (
    <div
      data-zen={progress.zenMode ? 'true' : 'false'}
      className="flex min-h-screen flex-col transition-colors duration-300"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
      }}
    >
      <ParticleBurst triggerKey={burstKey} />

      {/* Top Game Shell HUD Bar */}
      <header
        className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b px-4 py-2.5 sm:px-6 transition-all duration-300"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className="font-display text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0"
          style={{ color: 'var(--text-primary)' }}
        >
          YAMLingo
        </button>

        {/* Zone 2: Navigation Tabs (smoothly faded & collapsed in Zen Mode) */}
        <div
          className="zen-fade-x shrink-0"
          data-zen-hidden={progress.zenMode ? 'true' : 'false'}
          aria-hidden={progress.zenMode}
        >
          <nav className="flex flex-nowrap items-center gap-1 sm:gap-2 whitespace-nowrap" aria-label="Hlavní navigace">
            <button
              type="button"
              tabIndex={progress.zenMode ? -1 : undefined}
              onClick={() => setActiveTab('map')}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] sm:px-3 sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: activeTab === 'map' ? 'var(--accent-soft)' : 'transparent',
                color: activeTab === 'map' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <MapIcon className="h-3.5 w-3.5" />
              Mapa výuky
            </button>

            <button
              type="button"
              tabIndex={progress.zenMode ? -1 : undefined}
              onClick={() => setActiveTab('lesson')}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] sm:px-3 sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: activeTab === 'lesson' ? 'var(--accent-soft)' : 'transparent',
                color: activeTab === 'lesson' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Zap className="h-3.5 w-3.5" />
              Aktivní mise
            </button>

            <button
              type="button"
              tabIndex={progress.zenMode ? -1 : undefined}
              onClick={() => setActiveTab('doctor')}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] sm:px-3 sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: activeTab === 'doctor' ? 'var(--accent-soft)' : 'transparent',
                color: activeTab === 'doctor' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              YAML Doctor
            </button>

            <button
              type="button"
              tabIndex={progress.zenMode ? -1 : undefined}
              onClick={() => setActiveTab('shop')}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] sm:px-3 sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
              style={{
                backgroundColor: activeTab === 'shop' ? 'var(--accent-soft)' : 'transparent',
                color: activeTab === 'shop' ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Obchod
            </button>
          </nav>
        </div>

        {/* Zone 3: Economy, Theme, Sound & Zen Mode */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className="zen-fade-x hidden md:flex items-center gap-3 text-xs font-mono tabular-nums mr-1 whitespace-nowrap"
            data-zen-hidden={progress.zenMode ? 'true' : 'false'}
            aria-hidden={progress.zenMode}
          >
            <span className="flex items-center gap-1 font-bold" style={{ color: 'var(--warning)' }} title="Volty">
              <Zap className="h-3.5 w-3.5" />
              {progress.volts}
            </span>
            <span className="flex items-center gap-1" style={{ color: 'var(--danger)' }} title="Denní řada">
              <Flame className="h-3.5 w-3.5" />
              {progress.streakDays}d
            </span>
            <span className="flex items-center gap-1" style={{ color: 'var(--accent)' }} title="Streak Freeze štíty">
              <Shield className="h-3.5 w-3.5" />
              {progress.streakFreezes}
            </span>
          </div>

          <select
            aria-label="Téma editoru"
            value={progress.activeTheme}
            onChange={(e) => cycleTheme(e.target.value as EditorThemeId)}
            className="rounded-lg border px-2 py-1 text-xs font-medium outline-none"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="minimal-dark">Minimal OLED</option>
            <option value="light">Světlý režim</option>
            <option value="ha-blue">
              HA Blue {progress.unlockedThemes.includes('ha-blue') ? '' : '(40 ⚡)'}
            </option>
            <option value="retro-terminal">
              Retro Terminal {progress.unlockedThemes.includes('retro-terminal') ? '' : '(75 ⚡)'}
            </option>
          </select>

          <button
            type="button"
            onClick={() =>
              setProgress((p) => ({ ...p, zenMode: !p.zenMode }))
            }
            aria-label={progress.zenMode ? 'Ukončit režim soustředění' : 'Zapnout režim soustředění'}
            aria-pressed={progress.zenMode}
            title="Režim soustředění (Zen Mode)"
            className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200"
            style={{
              backgroundColor: progress.zenMode ? 'var(--accent)' : 'var(--bg-elevated)',
              borderColor: progress.zenMode ? 'var(--accent)' : 'var(--border-strong)',
              color: progress.zenMode ? 'var(--accent-contrast)' : 'var(--text-primary)',
            }}
          >
            {progress.zenMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Soustředění</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setProgress((p) => ({ ...p, soundEnabled: !p.soundEnabled }))
            }
            aria-label={progress.soundEnabled ? 'Vypnout zvuky' : 'Zapnout zvuky'}
            aria-pressed={progress.soundEnabled}
            className="rounded-lg border p-1.5"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: progress.soundEnabled ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {progress.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Klávesové zkratky (?)"
            aria-expanded={shortcutsOpen}
            title="Klávesové zkratky (?)"
            className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-mono font-bold transition-colors"
            style={{
              backgroundColor: shortcutsOpen ? 'var(--accent-soft)' : 'var(--bg-elevated)',
              borderColor: shortcutsOpen ? 'var(--accent)' : 'var(--border-strong)',
              color: shortcutsOpen ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <HelpCircle className="h-4 w-4" />
            <span aria-hidden="true">?</span>
          </button>

          <button
            type="button"
            onClick={() => setPhase('paused')}
            aria-label="Pozastavit hru"
            className="rounded-lg border p-1.5"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-secondary)',
            }}
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Smart Nudge Bar (Smoothly collapsed & faded in Zen Mode) */}
      {nudgeVisible && activeTab === 'map' && (
        <div
          className="zen-collapse-y mx-auto mt-3 w-[calc(100%-2rem)] max-w-5xl"
          data-zen-hidden={progress.zenMode ? 'true' : 'false'}
          aria-hidden={progress.zenMode}
        >
          <div className="zen-collapse-inner">
            <div
              className="flex items-center justify-between gap-3 rounded-xl border px-4 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                <span>{nudgeText}</span>
              </div>
              <button
                type="button"
                tabIndex={progress.zenMode ? -1 : undefined}
                onClick={() => setNudgeVisible(false)}
                aria-label="Zavřít oznámení"
                className="p-1 hover:opacity-80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content View */}
      <main className="flex-1">
        {activeTab === 'map' && (
          <CurriculumMap
            progress={progress}
            onSelectLesson={handleSelectLesson}
          />
        )}

        {activeTab === 'lesson' && (
          <LessonWorkspace
            lesson={activeLesson}
            skin={progress.activeSkin}
            zenMode={progress.zenMode}
            hintsAvailable={progress.hintsAvailable}
            onUseHint={handleUseHint}
            onComplete={handleLessonComplete}
            onNextLesson={handleNextLesson}
            hasNextLesson={
              LESSONS.findIndex((l) => l.id === activeLesson.id) + 1 < LESSONS.length
            }
            onBackToMap={() => setActiveTab('map')}
          />
        )}

        {activeTab === 'doctor' && <YamlDoctorView />}

        {activeTab === 'shop' && (
          <ShopView
            progress={progress}
            onBuyOrEquip={handleBuyOrEquip}
            onToggleMasterSound={() =>
              setProgress((p) => ({ ...p, soundEnabled: !p.soundEnabled }))
            }
            onToggleSoundChannel={(channel: keyof SoundPreferences) => {
              setProgress((p) => {
                const updated = toggleSoundPreference(p, channel);
                soundEngine.setPreferences(updated.soundPreferences);
                return updated;
              });
            }}
            onResetSoundPreferences={() => {
              setProgress((p) => ({
                ...p,
                soundEnabled: true,
                soundPreferences: { ...DEFAULT_SOUND_PREFERENCES },
              }));
              soundEngine.setEnabled(true);
              soundEngine.setPreferences(DEFAULT_SOUND_PREFERENCES);
              soundEngine.playPop();
            }}
            feedbackMsg={shopFeedback}
          />
        )}
      </main>

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.78)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Hra pozastavena"
        >
          <div
            className="w-full max-w-sm rounded-xl border p-6 text-center space-y-5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
            }}
          >
            <h2 className="font-display text-2xl font-bold">Pauza</h2>
            <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-xs font-mono tabular-nums" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Mise</div>
                <div className="mt-0.5 text-base font-bold">{progress.completedLessons.length}/{LESSONS.length}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Volty</div>
                <div className="mt-0.5 text-base font-bold" style={{ color: 'var(--warning)' }}>{progress.volts}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Řada</div>
                <div className="mt-0.5 text-base font-bold" style={{ color: 'var(--danger)' }}>{progress.streakDays}d</div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setPhase('playing')}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-bold"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                Pokračovat
              </button>
              <button
                type="button"
                onClick={() => setPhase('title')}
                className="w-full rounded-lg border px-4 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-primary)' }}
              >
                Úvodní obrazovka
              </button>
              <button
                type="button"
                onClick={() => {
                  const fresh = createDefaultProgress();
                  setProgress(fresh);
                  setActiveLesson(LESSONS[0]);
                  setActiveTab('map');
                  setPhase('playing');
                }}
                className="w-full rounded-lg px-4 py-2 text-xs font-medium"
                style={{ color: 'var(--danger)' }}
              >
                Resetovat veškerý pokrok
              </button>
            </div>
          </div>
        </div>
      )}
      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {unlockedToast && (
        <div
          role="status"
          data-testid="achievement-toast"
          className="fixed right-4 bottom-4 z-50 flex max-w-xs items-start gap-3 rounded-xl border p-3.5 shadow-xl"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: unlockedToast.accentVar,
          }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: `color-mix(in srgb, ${unlockedToast.accentVar} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${unlockedToast.accentVar} 40%, transparent)`,
            }}
          >
            <Trophy className="h-4 w-4" style={{ color: unlockedToast.accentVar }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-mono font-semibold" style={{ color: unlockedToast.accentVar }}>
              Odznak odemčen!
            </div>
            <div className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {unlockedToast.title}
            </div>
            <div className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {unlockedToast.description}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUnlockedToast(null)}
            aria-label="Zavřít oznámení o odznaku"
            className="p-0.5 hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
