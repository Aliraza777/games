/**
 * All audio is synthesized with the Web Audio API — no asset loading, no latency
 * from decoding, and no music licensing. Music is scheduled against
 * AudioContext.currentTime (never setTimeout) so Flow mode stays on the beat.
 */

export type MusicStyle = 'flow' | 'ambient';

interface MusicState {
  style: MusicStyle;
  stepDur: number;
  startAt: number;
  nextStep: number;
  endStep: number;
  timer: number;
  intensity: number;
  paused: boolean;
  pausedPos: number;
}

export interface Volumes {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
}

/** Major pentatonic — any run of hits sounds musical. */
const PENTA = [0, 2, 4, 7, 9];
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Am – F – C – G, as triads (MIDI). */
const PROGRESSION = [
  { root: 45, triad: [57, 60, 64] },
  { root: 41, triad: [53, 57, 60] },
  { root: 48, triad: [55, 60, 64] },
  { root: 43, triad: [55, 59, 62] },
];

class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private musicFade!: GainNode;
  private noise!: AudioBuffer;
  private vol: Volumes = { master: 0.8, sfx: 0.8, music: 0.6, muted: false };
  private tone: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  private music: MusicState | null = null;

  /** Create/resume the context. Must be called from a user gesture the first time. */
  ensure(): AudioContext | null {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.connect(comp);
      this.sfx = ctx.createGain();
      this.sfx.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.musicFade = ctx.createGain();
      this.musicFade.connect(this.musicBus);

      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** ensure() + wait until the context is actually running. */
  async unlock(): Promise<boolean> {
    const ctx = this.ensure();
    if (!ctx) return false;
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* blocked — stay silent */
      }
    }
    return ctx.state === 'running';
  }

  setVolumes(v: Volumes) {
    this.vol = v;
    this.applyVolumes();
  }

  private applyVolumes() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.02);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.02);
  }

  /** Context only if it's already running — UI sounds never force-create audio. */
  private get live(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  // ─── primitives ──────────────────────────────────────────────────────────

  private voice(
    type: OscillatorType,
    freq: number,
    t: number,
    decay: number,
    peak: number,
    opts: { attack?: number; dest?: AudioNode; sweepTo?: number; filter?: number } = {},
  ) {
    const ctx = this.ctx!;
    const attack = opts.attack ?? 0.003;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.sweepTo) o.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + attack + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(opts.dest ?? this.sfx);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  private burst(t: number, dur: number, peak: number, type: BiquadFilterType, freq: number, dest?: AudioNode, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest ?? this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ─── game sfx ────────────────────────────────────────────────────────────

  /** Pitch climbs the pentatonic scale with the combo, resetting on a break. */
  hit(combo: number, perfect: boolean) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    const i = Math.min(Math.max(combo - 1, 0), 10);
    const f = midiHz(67 + PENTA[i % 5] + 12 * Math.floor(i / 5));
    this.voice('triangle', f, t, 0.12, 0.22);
    this.voice('sine', f * 2, t, 0.06, 0.05);
    this.burst(t, 0.025, 0.1, 'highpass', 3500);
    if (perfect) {
      this.voice('sine', f * 2, t + 0.012, 0.45, 0.08);
      this.voice('sine', f * 3, t + 0.024, 0.35, 0.045);
    }
  }

  soft(combo: number) {
    const ctx = this.live;
    if (!ctx) return;
    const f = midiHz(60 + PENTA[combo % 5] + 12 * (Math.floor(combo / 5) % 2));
    this.voice('sine', f, ctx.currentTime, 0.7, 0.12, { attack: 0.012 });
    this.voice('sine', f * 2, ctx.currentTime, 0.4, 0.03, { attack: 0.012 });
  }

  miss() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.voice('sine', 150, t, 0.12, 0.14, { sweepTo: 70 });
    this.burst(t, 0.08, 0.06, 'lowpass', 700);
  }

  comboBreak() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.voice('triangle', 392, t, 0.1, 0.1);
    this.voice('triangle', 294, t + 0.08, 0.16, 0.1);
  }

  early() {
    const ctx = this.live;
    if (!ctx) return;
    this.voice('square', 220, ctx.currentTime, 0.06, 0.05, { filter: 900 });
  }

  ping() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.voice('sine', 1760, t, 0.6, 0.1);
    this.voice('sine', 2637, t + 0.01, 0.4, 0.04);
  }

  tierUp(tier: number) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 72 + tier * 2;
    [0, 4, 7, 12].forEach((s, i) => this.voice('triangle', midiHz(base + s), t + i * 0.045, 0.18, 0.09));
  }

  countdown(final: boolean) {
    const ctx = this.live;
    if (!ctx) return;
    this.voice('sine', final ? 988 : 659, ctx.currentTime, final ? 0.3 : 0.12, 0.16);
  }

  end() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    [60, 64, 67, 72].forEach((m, i) => this.voice('sine', midiHz(m), t + i * 0.03, 1.2, 0.07, { attack: 0.01 }));
  }

  stamp() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.burst(t, 0.12, 0.25, 'lowpass', 260);
    this.voice('sine', 110, t, 0.25, 0.25, { sweepTo: 55 });
  }

  fanfare() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84, 88].forEach((m, i) => this.voice('triangle', midiHz(m), t + i * 0.07, 0.35, 0.08));
  }

  // ─── ui ──────────────────────────────────────────────────────────────────

  uiHover() {
    const ctx = this.live;
    if (!ctx) return;
    this.voice('sine', 1400, ctx.currentTime, 0.025, 0.018);
  }

  uiClick() {
    const ctx = this.live;
    if (!ctx) return;
    this.voice('triangle', 620, ctx.currentTime, 0.05, 0.07);
  }

  // ─── tracking hum ────────────────────────────────────────────────────────

  /** A soft drone that swells while the crosshair is on the orb. */
  setTrackTone(on: boolean) {
    const ctx = this.live;
    if (!ctx) return;
    if (!this.tone) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.sfx);
      const oscs = [220, 330.5, 440.8].map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'triangle' : 'sine';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.6 : 0.25;
        o.connect(g).connect(gain);
        o.start();
        return o;
      });
      this.tone = { oscs, gain };
    }
    this.tone.gain.gain.setTargetAtTime(on ? 0.09 : 0, ctx.currentTime, on ? 0.03 : 0.08);
  }

  stopTrackTone() {
    if (!this.tone || !this.ctx) return;
    const { oscs, gain } = this.tone;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    oscs.forEach((o) => o.stop(this.ctx!.currentTime + 0.3));
    this.tone = null;
  }

  // ─── music ───────────────────────────────────────────────────────────────

  startMusic(opts: { bpm: number; style: MusicStyle; lengthSec?: number }) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopMusic(true);
    const t = ctx.currentTime;
    this.musicFade.gain.cancelScheduledValues(t);
    this.musicFade.gain.setValueAtTime(1, t);
    const stepDur = 60 / opts.bpm / 4;
    this.music = {
      style: opts.style,
      stepDur,
      startAt: t + 0.1,
      nextStep: 0,
      endStep: opts.lengthSec ? Math.ceil(opts.lengthSec / stepDur) : Infinity,
      timer: window.setInterval(() => this.schedule(), 25),
      intensity: 0,
      paused: false,
      pausedPos: 0,
    };
    this.schedule();
  }

  /** Song position in seconds, compensated for output latency (what the player hears). */
  musicTime(): number {
    const m = this.music, ctx = this.ctx;
    if (!m || !ctx) return 0;
    const raw = m.paused ? m.pausedPos : ctx.currentTime - m.startAt;
    return raw - (ctx.outputLatency || ctx.baseLatency || 0);
  }

  /** True when music is playing on a running clock (Flow can trust musicTime()). */
  get musicActive(): boolean {
    return !!this.music && this.ctx?.state === 'running';
  }

  setMusicIntensity(level: number) {
    if (this.music) this.music.intensity = level;
  }

  pauseMusic() {
    const m = this.music, ctx = this.ctx;
    if (!m || !ctx || m.paused) return;
    m.paused = true;
    m.pausedPos = ctx.currentTime - m.startAt;
    clearInterval(m.timer);
    this.musicFade.gain.cancelScheduledValues(ctx.currentTime);
    this.musicFade.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
  }

  resumeMusic() {
    const m = this.music, ctx = this.ctx;
    if (!m || !ctx || !m.paused) return;
    const t = ctx.currentTime + 0.05;
    m.paused = false;
    m.startAt = t - m.pausedPos;
    m.nextStep = Math.ceil(m.pausedPos / m.stepDur);
    this.musicFade.gain.cancelScheduledValues(ctx.currentTime);
    this.musicFade.gain.setValueAtTime(0, ctx.currentTime);
    this.musicFade.gain.linearRampToValueAtTime(1, t + 0.05);
    m.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stopMusic(immediate = false) {
    const m = this.music, ctx = this.ctx;
    if (!m || !ctx) return;
    clearInterval(m.timer);
    this.music = null;
    if (!immediate) {
      this.musicFade.gain.cancelScheduledValues(ctx.currentTime);
      this.musicFade.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    }
  }

  private schedule() {
    const m = this.music, ctx = this.ctx;
    if (!m || !ctx || m.paused) return;
    const horizon = ctx.currentTime + 0.12;
    while (m.nextStep < m.endStep) {
      const time = m.startAt + m.nextStep * m.stepDur;
      if (time > horizon) break;
      if (time >= ctx.currentTime - 0.01) {
        if (m.style === 'flow') this.flowStep(m, m.nextStep, time);
        else this.ambientStep(m, m.nextStep, time);
      }
      m.nextStep++;
    }
  }

  private flowStep(m: MusicState, step: number, t: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = PROGRESSION[bar % 4];
    const I = m.intensity;
    const out = this.musicFade;
    const intro = bar === 0;

    if (s % 4 === 0) this.kick(t);
    if (s % 4 === 2) this.burst(t, 0.045, 0.07, 'highpass', 8000, out);
    if (I >= 1 && s % 2 === 1) this.burst(t, 0.03, 0.03, 'highpass', 9000, out);
    if (intro) return;

    if (s === 4 || s === 12) {
      this.burst(t, 0.14, 0.16, 'bandpass', 1800, out, 0.8);
      this.voice('triangle', 190, t, 0.08, 0.06, { dest: out });
    }
    if ([0, 3, 6, 10, 14].includes(s)) {
      this.voice('sawtooth', midiHz(chord.root), t, m.stepDur * 1.6, 0.12, { dest: out, filter: 380 + I * 260 });
    }
    if (s === 0) this.pad(chord.triad, t, m.stepDur * 16, 0.022);
    if (I >= 2) {
      const n = chord.triad[step % 3] + 12 * (s % 8 >= 4 ? 2 : 1);
      this.voice('triangle', midiHz(n), t, 0.12, 0.035, { dest: out });
    }
    if (I >= 3 && (s === 6 || s === 14)) {
      chord.triad.forEach((n) => this.voice('square', midiHz(n + 12), t, 0.2, 0.018, { dest: out, filter: 2400 }));
    }
  }

  private ambientStep(m: MusicState, step: number, t: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = PROGRESSION[(bar >> 1) % 4];
    if (s === 0 && bar % 2 === 0) this.pad(chord.triad, t, m.stepDur * 32, 0.03);
    if (s === 8 && bar % 2 === 1) {
      const n = chord.triad[(bar >> 1) % 3] + 12;
      this.voice('sine', midiHz(n), t, 2.4, 0.03, { attack: 0.02, dest: this.musicFade });
    }
  }

  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g).connect(this.musicFade);
    o.start(t);
    o.stop(t + 0.35);
  }

  private pad(notes: number[], t: number, dur: number, peak: number) {
    const ctx = this.ctx!;
    for (const n of notes) {
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = midiHz(n);
        o.detune.value = detune;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.4);
        g.gain.setTargetAtTime(0, t + dur - 0.3, 0.3);
        o.connect(g).connect(this.musicFade);
        o.start(t);
        o.stop(t + dur + 1.5);
      }
    }
  }
}

export const audio = new AudioManager();
