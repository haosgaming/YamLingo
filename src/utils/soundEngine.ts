import {
  DEFAULT_SOUND_PREFERENCES,
  type SoundPreferences,
} from '../engine/gamification';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private prefs: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES };

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setPreferences(prefs: Partial<SoundPreferences> | undefined) {
    this.prefs = {
      ...DEFAULT_SOUND_PREFERENCES,
      ...(prefs ?? {}),
    };
  }

  getPreferences(): SoundPreferences {
    return { ...this.prefs };
  }

  private canPlay(channel: keyof SoundPreferences): boolean {
    return this.enabled && Boolean(this.prefs[channel]);
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private vibrate(pattern: number | number[]) {
    if (!this.enabled || typeof navigator === 'undefined') return;
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on unsupported devices
      }
    }
  }

  playPop() {
    if (!this.canPlay('uiClicks')) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.08;
    osc.frequency.setValueAtTime(520 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(780 * pitchJitter, now + 0.07);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
    this.vibrate(10);
  }

  playToggle(on: boolean) {
    if (!this.canPlay('uiClicks')) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(on ? 440 : 620, now);
    osc.frequency.exponentialRampToValueAtTime(on ? 680 : 380, now + 0.08);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
    this.vibrate(12);
  }

  playTypeTick() {
    if (!this.canPlay('typingFeedback')) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const pitchJitter = 1 + (Math.random() - 0.5) * 0.12;
    osc.frequency.setValueAtTime(1150 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(620 * pitchJitter, now + 0.022);
    gain.gain.setValueAtTime(0.028, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.028);
  }

  playErrorBonk() {
    if (!this.canPlay('errorAlerts')) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.16);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
    this.vibrate([25, 30, 25]);
  }

  playSuccessFanfare(isBoss = false) {
    if (!this.canPlay('successFanfares')) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = isBoss ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + i * 0.085;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
    this.vibrate(isBoss ? [30, 40, 50] : [20, 30, 20]);
  }
}

export const soundEngine = new SoundEngine();
