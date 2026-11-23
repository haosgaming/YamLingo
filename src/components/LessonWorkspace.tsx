import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Lightbulb,
  RotateCcw,
  ShieldAlert,
  Skull,
  Sparkles,
} from 'lucide-react';
import type { LessonNode } from '../engine/curriculum';
import type { BoardSkinId } from '../engine/gamification';
import { analyzeYaml } from '../engine/yamlValidator';
import { soundEngine } from '../utils/soundEngine';
import { InlineCodeText } from './InlineCodeText';
import { LivePreviewPanel } from './LivePreviewPanel';
import { SmartYamlEditor } from './SmartYamlEditor';
import { YamlExportModal } from './YamlExportModal';

interface LessonWorkspaceProps {
  lesson: LessonNode;
  skin: BoardSkinId;
  zenMode: boolean;
  hintsAvailable: number;
  onUseHint: () => boolean;
  onComplete: (stats: { mistakesCount: number; remainingSeconds?: number }) => {
    volts: number;
    xp: number;
  };
  onNextLesson: () => void;
  hasNextLesson: boolean;
  onBackToMap: () => void;
}

export function LessonWorkspace({
  lesson,
  skin,
  zenMode,
  hintsAvailable,
  onUseHint,
  onComplete,
  onNextLesson,
  hasNextLesson,
  onBackToMap,
}: LessonWorkspaceProps) {
  const [code, setCode] = useState(lesson.starterCode);
  const [shakeKey, setShakeKey] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [bossSecondsLeft, setBossSecondsLeft] = useState(lesson.bossTimeSec ?? 90);
  const [bossFailed, setBossFailed] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
    reward?: { volts: number; xp: number };
  } | null>(null);
  const [lessonWon, setLessonWon] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Reset state whenever lesson changes
  useEffect(() => {
    setCode(lesson.starterCode);
    setShakeKey(0);
    setShowHint(false);
    setMistakes(0);
    setAttemptsUsed(0);
    setBossSecondsLeft(lesson.bossTimeSec ?? 90);
    setBossFailed(false);
    setFeedbackBanner(null);
    setLessonWon(false);
    setExportOpen(false);
  }, [lesson]);

  // Boss Fight countdown timer
  useEffect(() => {
    if (!lesson.isBoss || lessonWon || bossFailed) return;
    const timer = window.setInterval(() => {
      setBossSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setBossFailed(true);
          soundEngine.playErrorBonk();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lesson.isBoss, lesson.id, lessonWon, bossFailed]);

  const analysis = useMemo(() => analyzeYaml(code), [code]);
  const validation = useMemo(
    () =>
      lesson.validate(
        code,
        analysis.parsed,
        analysis.diagnostics,
        analysis.simulation
      ),
    [lesson, code, analysis]
  );

  const handleCheck = () => {
    if (bossFailed) return;
    if (validation.passed) {
      soundEngine.playSuccessFanfare(lesson.isBoss);
      if (!lessonWon) {
        const reward = onComplete({
          mistakesCount: mistakes,
          remainingSeconds: lesson.isBoss ? bossSecondsLeft : undefined,
        });
        setLessonWon(true);
        setFeedbackBanner({
          type: 'success',
          text: validation.feedback,
          reward,
        });
      } else {
        setFeedbackBanner({
          type: 'success',
          text: validation.feedback,
        });
      }
      return;
    }

    // Error / incomplete feedback
    soundEngine.playErrorBonk();
    setShakeKey((k) => k + 1);
    setMistakes((m) => m + 1);

    if (lesson.isBoss && lesson.bossMaxAttempts) {
      const nextAttempts = attemptsUsed + 1;
      setAttemptsUsed(nextAttempts);
      if (nextAttempts >= lesson.bossMaxAttempts) {
        setBossFailed(true);
        return;
      }
    }

    setFeedbackBanner({
      type: 'error',
      text: validation.feedback,
    });
  };

  const handleReset = () => {
    soundEngine.playPop();
    setCode(lesson.starterCode);
    setBossSecondsLeft(lesson.bossTimeSec ?? 90);
    setAttemptsUsed(0);
    setBossFailed(false);
    setLessonWon(false);
    setFeedbackBanner(null);
  };

  const handleRevealHint = () => {
    if (showHint) return;
    onUseHint();
    soundEngine.playPop();
    setShowHint(true);
  };

  return (
    <div
      className={`mx-auto flex h-full flex-col gap-3 p-3 sm:p-5 transition-[max-width,padding] duration-300 ease-out ${
        zenMode ? 'max-w-[1540px]' : 'max-w-[1440px]'
      }`}
    >
      {/* Lesson Header Strip */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-all duration-300"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: lesson.isBoss ? 'var(--warning)' : 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="zen-fade-x"
            data-zen-hidden={zenMode ? 'true' : 'false'}
            aria-hidden={zenMode}
          >
            <button
              type="button"
              tabIndex={zenMode ? -1 : undefined}
              onClick={onBackToMap}
              className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap"
              style={{
                borderColor: 'var(--border-strong)',
                color: 'var(--text-secondary)',
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Mapa
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-mono" style={{ color: lesson.isBoss ? 'var(--warning)' : 'var(--accent)' }}>
              {lesson.isBoss ? (
                <>
                  <Skull className="h-3.5 w-3.5" />
                  KRIZOVÁ MISE (BOSS FIGHT)
                </>
              ) : (
                <span>
                  {lesson.worldTitle} · {lesson.durationLabel}
                </span>
              )}
            </div>
            <h1 className="font-display text-lg font-bold sm:text-xl" style={{ color: 'var(--text-primary)' }}>
              {lesson.title}
            </h1>
          </div>
        </div>

        {/* Progress, Export & Boss Metrics */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono tabular-nums">
          <button
            type="button"
            data-testid="lesson-export-btn"
            onClick={() => {
              soundEngine.playPop();
              setExportOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-sans text-xs font-semibold transition-colors whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
            }}
            title="Exportovat aktuální YAML pro Home Assistant nebo ESPHome"
          >
            <Download className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
            Exportovat YAML
          </button>

          {lesson.isBoss && (
            <div className="flex items-center gap-3">
              <span
                className="flex items-center gap-1 font-bold"
                style={{ color: bossSecondsLeft <= 20 ? 'var(--danger)' : 'var(--warning)' }}
              >
                <Clock className="h-4 w-4" />
                {bossSecondsLeft}s
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Pokusy: {(lesson.bossMaxAttempts ?? 5) - attemptsUsed}/{lesson.bossMaxAttempts ?? 5}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div
              className="h-2 w-24 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <div
                className="h-full transition-all duration-200"
                style={{
                  width: `${validation.progressPct}%`,
                  backgroundColor: validation.passed ? 'var(--success)' : 'var(--accent)',
                }}
              />
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>{validation.progressPct}%</span>
          </div>
        </div>
      </div>

      {/* Micro-Brief & Live Checkpoints */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <p className="max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          <InlineCodeText text={lesson.brief} />
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {validation.checks.map((chk, idx) => (
            <span
              key={idx}
              className="flex items-center gap-1.5 font-medium"
              style={{ color: chk.ok ? 'var(--success)' : 'var(--text-secondary)' }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" style={{ opacity: chk.ok ? 1 : 0.35 }} />
              {chk.label}
            </span>
          ))}
        </div>
      </div>

      {/* Split-Screen Core: Left Editor | Right Live Preview */}
      <div className="grid flex-1 gap-4 lg:grid-cols-12 min-h-[440px]">
        {/* Left: Smart YAML Editor + Controls */}
        <div className="flex flex-col gap-3 lg:col-span-6">
          <div className="flex-1 min-h-[320px]">
            <SmartYamlEditor
              value={code}
              onChange={setCode}
              diagnostics={analysis.diagnostics}
              blocks={lesson.blocks}
              shakeKey={shakeKey}
              onSubmit={handleCheck}
            />
          </div>

          {/* Hint Box */}
          {showHint && (
            <div
              className="flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed"
              style={{
                backgroundColor: 'var(--accent-soft)',
                borderColor: 'var(--accent)',
                color: 'var(--text-primary)',
              }}
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--warning)' }} />
              <span>
                <InlineCodeText text={lesson.hint} />
              </span>
            </div>
          )}

          {/* Feedback Banner */}
          {feedbackBanner && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium"
              style={{
                backgroundColor:
                  feedbackBanner.type === 'success'
                    ? 'rgba(34, 197, 94, 0.14)'
                    : 'rgba(239, 68, 68, 0.12)',
                borderColor:
                  feedbackBanner.type === 'success' ? 'var(--success)' : 'var(--danger)',
                color: 'var(--text-primary)',
              }}
            >
              <div className="flex items-center gap-2">
                {feedbackBanner.type === 'success' ? (
                  <Sparkles className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />
                ) : (
                  <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: 'var(--danger)' }} />
                )}
                <span>{feedbackBanner.text}</span>
              </div>
              {feedbackBanner.reward && (
                <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--warning)' }}>
                  +{feedbackBanner.reward.volts} ⚡ · +{feedbackBanner.reward.xp} XP
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRevealHint}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
              >
                <Lightbulb className="h-3.5 w-3.5" style={{ color: 'var(--warning)' }} />
                Nápověda
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Resetovat
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCheck}
                className="rounded-lg px-5 py-2.5 text-xs font-bold transition-transform active:scale-95 whitespace-nowrap"
                style={{
                  backgroundColor: validation.passed ? 'var(--success)' : 'var(--accent)',
                  color: validation.passed ? '#041208' : 'var(--accent-contrast)',
                }}
              >
                Zkontrolovat kód
              </button>

              {lessonWon && hasNextLesson && (
                <button
                  type="button"
                  onClick={onNextLesson}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold whitespace-nowrap"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  Další mise
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Live Virtual Preview */}
        <div className="min-h-[340px] lg:col-span-6">
          <LivePreviewPanel
            simulation={analysis.simulation}
            diagnostics={analysis.diagnostics}
            skin={skin}
            defaultTab={lesson.mode === 'esphome' ? '3d' : 'lovelace'}
          />
        </div>
      </div>

      {/* Boss Fight Defeat Modal */}
      {bossFailed && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.78)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Krizová mise neúspěšná"
        >
          <div
            className="w-full max-w-md rounded-xl border p-6 text-center space-y-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--danger)',
            }}
          >
            <Skull className="mx-auto h-10 w-10" style={{ color: 'var(--danger)' }} />
            <h2 className="font-display text-xl font-bold">Čas nebo pokusy vypršely!</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              V chytré domácnosti došlo k přetížení, ale v YAMLingo se chyby netrestají ztrátou řady. Zkus to znovu s čistou hlavou!
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onBackToMap}
                className="rounded-lg border px-4 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
              >
                Zpět na mapu
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg px-5 py-2 text-xs font-bold"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                Zkusit znovu
              </button>
            </div>
          </div>
        </div>
      )}
      <YamlExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        code={code}
        parsed={analysis.parsed}
        diagnostics={analysis.diagnostics}
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        lessonMode={lesson.mode}
      />
    </div>
  );
}
