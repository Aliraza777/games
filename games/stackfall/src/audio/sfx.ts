/** Fully synthesized sound: moves, rotations, locks, clears that climb with combos, and music. */

import type { ClearEvent } from '../game/engine';

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];

class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private fx!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private music: number | null = null;
  private vol = { sound: 0.8, music: 0.5 };
  private lastMove = 0;
  private tempo = { level: 1, danger: false, calm: false };

  ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(comp);
      this.fx = ctx.createGain();
      this.fx.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolumes(sound: number, music: number) {
    this.vol = { sound, music };
    this.apply();
  }

  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fx.gain.setTargetAtTime(this.vol.sound, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.45, t, 0.05);
  }

  private get live() {
    return this.ctx && this.ctx.state === 'running' && this.vol.sound > 0 ? this.ctx : null;
  }

  private tone(type: OscillatorType, f: number, t: number, dur: number, peak: number, o: { to?: number; dest?: AudioNode; lp?: number } = {}) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let n: AudioNode = osc;
    if (o.lp) {
      const lp = ctx.createBiquadFilter();
      lp.frequency.value = o.lp;
      osc.connect(lp);
      n = lp;
    }
    n.connect(g).connect(o.dest ?? this.fx);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private hiss(t: number, dur: number, peak: number, type: BiquadFilterType, f: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bq = ctx.createBiquadFilter();
    bq.type = type;
    bq.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(g).connect(dest ?? this.fx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  move() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (t - this.lastMove < 0.03) return;
    this.lastMove = t;
    this.tone('square', 1400, t, 0.025, 0.018, { lp: 3000 });
  }

  rotate(spinReady: boolean) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone('triangle', 700, t, 0.05, 0.04, { to: 950 });
    if (spinReady) this.tone('sine', midiHz(91), t + 0.02, 0.12, 0.04);
  }

  hold() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone('sine', 520, t, 0.09, 0.06, { to: 780 });
    this.hiss(t, 0.08, 0.03, 'bandpass', 3000);
  }

  softDrop() {
    const ctx = this.live;
    if (!ctx) return;
    this.tone('sine', 300, ctx.currentTime, 0.03, 0.02);
  }

  lock(dropped: number) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    const hard = dropped > 0;
    this.tone('sine', hard ? 140 : 190, t, hard ? 0.14 : 0.08, hard ? 0.16 : 0.08, { to: hard ? 55 : 120 });
    this.hiss(t, hard ? 0.09 : 0.05, hard ? 0.09 : 0.04, 'lowpass', hard ? 1600 : 2400);
  }

  clear(e: ClearEvent) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (e.lines === 0) {
      // T-spin with no lines: a little sparkle.
      [0, 7].forEach((s, i) => this.tone('sine', midiHz(84 + s), t + i * 0.05, 0.18, 0.04));
      return;
    }
    // Rising pitch with the combo makes chains feel like they're building.
    const base = 64 + Math.min(e.combo, 12) * 2;
    const notes = e.lines === 4 || e.spin !== 'none' ? [0, 4, 7, 12, 16] : [0, 4, 7].slice(0, e.lines + 1);
    notes.forEach((s, i) => this.tone(e.lines === 4 ? 'square' : 'triangle', midiHz(base + s), t + i * 0.045, 0.22, e.lines === 4 ? 0.05 : 0.07, { lp: 4000 }));
    this.hiss(t, 0.25 + e.lines * 0.05, 0.05 + e.lines * 0.02, 'highpass', 2500);
    if (e.lines === 4) this.tone('sine', 70, t, 0.5, 0.2, { to: 40 });
    if (e.spin !== 'none') [0, 5, 9].forEach((s, i) => this.tone('sine', midiHz(96 + s), t + 0.12 + i * 0.05, 0.3, 0.035));
    if (e.b2b) this.tone('sawtooth', midiHz(base + 24), t + 0.2, 0.3, 0.025, { lp: 2500 });
    if (e.perfect) [0, 4, 7, 11, 14, 19].forEach((s, i) => this.tone('triangle', midiHz(76 + s), t + 0.3 + i * 0.07, 0.4, 0.05));
  }

  levelUp() {
    const ctx = this.live;
    if (!ctx) return;
    [0, 4, 7, 12].forEach((s, i) => this.tone('square', midiHz(72 + s), ctx.currentTime + i * 0.07, 0.25, 0.045, { lp: 3500 }));
  }

  zenClear() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(t, 1.2, 0.1, 'bandpass', 800);
    [0, 7, 12].forEach((s, i) => this.tone('sine', midiHz(60 + s), t + i * 0.12, 1.2, 0.05));
  }

  countdown(n: number) {
    const ctx = this.live;
    if (!ctx) return;
    if (n > 0) this.tone('triangle', midiHz(69), ctx.currentTime, 0.12, 0.08);
    else [0, 12].forEach((s) => this.tone('square', midiHz(81 + s), ctx.currentTime, 0.3, 0.05, { lp: 4000 }));
  }

  gameOver(good: boolean) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (good) {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone('triangle', midiHz(67 + s), t + i * 0.07, 0.4, 0.06));
    } else {
      [0, -3, -7, -12].forEach((s, i) => this.tone('triangle', midiHz(64 + s), t + i * 0.13, 0.35, 0.07));
      this.hiss(t, 0.6, 0.08, 'lowpass', 900);
    }
  }

  best() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 8; i++) this.tone('sine', midiHz(84 + PENTA[i % 5] + 12 * Math.floor(i / 5)), t + 0.5 + i * 0.05, 0.25, 0.04);
  }

  ui() {
    const ctx = this.live;
    if (!ctx) return;
    this.tone('triangle', 900, ctx.currentTime, 0.05, 0.04);
  }

  /** Music follows the game: faster with level, tense near the top, slow and soft in Zen. */
  setMood(level: number, danger: boolean, calm = false) {
    this.tempo = { level, danger, calm };
  }

  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.music != null) return;
    let next = ctx.currentTime + 0.1;
    let i = 0;
    const chords = [57, 53, 60, 55];
    const tick = () => {
      if (!this.ctx) return;
      const { level, danger, calm } = this.tempo;
      const bpm = calm ? 78 : Math.min(150, 104 + (level - 1) * 3);
      const step = 60 / bpm / 4;
      while (next < this.ctx.currentTime + 0.15) {
        const s = i % 16;
        const root = chords[Math.floor(i / 16) % 4] - (danger ? 1 : 0);
        const bus = this.musicBus;
        if (!calm && s % 4 === 0) this.tone('sine', 110, next, 0.18, 0.22, { to: 45, dest: bus });
        if (!calm && s % 4 === 2) this.hiss(next, 0.04, danger ? 0.07 : 0.035, 'highpass', 8000, bus);
        if (danger && s % 2 === 1) this.hiss(next, 0.02, 0.03, 'highpass', 9000, bus);
        if (s % 2 === 0) this.tone('triangle', midiHz(root - 12), next, step * 1.6, calm ? 0.035 : 0.05, { dest: bus, lp: 600 });
        if (s % 3 === 0) this.tone('sine', midiHz(root + 12 + [0, 3, 7, 10][s % 4]), next, step * (calm ? 4 : 2), 0.022, { dest: bus });
        if (calm && s === 0) this.tone('sine', midiHz(root), next, step * 14, 0.03, { dest: bus });
        next += step;
        i++;
      }
    };
    this.music = window.setInterval(tick, 40);
    tick();
  }

  stopMusic() {
    if (this.music != null) clearInterval(this.music);
    this.music = null;
  }
}

export const sfx = new Sfx();

export function buzz(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(pattern);
}
