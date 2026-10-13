import type { Soundscape as Kind } from '../store/settings';

/**
 * Everything is synthesized: brown-noise "waves" that swell with the breath,
 * pink-noise rain with scattered droplets, a soft drone, and bell-like chimes
 * on a pentatonic scale. No assets, nothing to license.
 */

const PENTA = [0, 2, 4, 7, 9];
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private fx!: GainNode;
  private bed: { stop: () => void; breath?: (level: number) => void } | null = null;
  private brown!: AudioBuffer;
  private pink!: AudioBuffer;
  private volume = 0.7;

  get available() {
    return typeof window !== 'undefined' && !!(window.AudioContext ?? (window as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  /** Create/resume the context. Call from a user gesture. */
  ensure(): AudioContext | null {
    if (!this.available) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(comp);
      this.fx = ctx.createGain();
      this.fx.connect(this.master);
      this.brown = this.noise('brown');
      this.pink = this.noise('pink');
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  private noise(kind: 'brown' | 'pink'): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 6;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else {
          // Paul Kellet's pink noise filter.
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      }
    }
    return buf;
  }

  private loop(buffer: AudioBuffer) {
    const src = this.ctx!.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }

  // ─── ambience ────────────────────────────────────────────────────────────

  startAmbience(kind: Kind) {
    const ctx = this.ensure();
    this.stopAmbience(0.4);
    if (!ctx || kind === 'silence') return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(1, t + 2.5);
    out.connect(this.master);
    const stops: (() => void)[] = [];

    // A quiet, low drone keeps the room from feeling empty.
    const drone = ctx.createGain();
    drone.gain.value = 0.025;
    drone.connect(out);
    for (const [f, detune] of [
      [110, -4],
      [164.8, 3],
      [220, 0],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(drone);
      o.start(t);
      stops.push(() => o.stop());
    }

    let breath: ((level: number) => void) | undefined;
    if (kind === 'waves') {
      const src = this.loop(this.brown);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      const g = ctx.createGain();
      g.gain.value = 0.06;
      src.connect(lp).connect(g).connect(out);
      src.start(t);
      stops.push(() => src.stop());
      // Waves swell as you breathe in and recede as you breathe out.
      breath = (level) => {
        const now = ctx.currentTime;
        g.gain.setTargetAtTime(0.05 + 0.2 * level, now, 0.25);
        lp.frequency.setTargetAtTime(280 + 1100 * level, now, 0.25);
      };
    } else {
      const src = this.loop(this.pink);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 500;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.value = 0.16;
      src.connect(hp).connect(lp).connect(g).connect(out);
      src.start(t);
      stops.push(() => src.stop());
      const timer = window.setInterval(() => this.droplet(out), 140);
      stops.push(() => clearInterval(timer));
    }

    this.bed = {
      breath,
      stop: () => {
        const now = ctx.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setTargetAtTime(0, now, 0.4);
        setTimeout(() => stops.forEach((s) => s()), 2000);
      },
    };
  }

  private droplet(out: AudioNode) {
    const ctx = this.ctx!;
    if (Math.random() > 0.55) return;
    const t = ctx.currentTime + Math.random() * 0.12;
    const src = ctx.createBufferSource();
    src.buffer = this.pink;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500 + Math.random() * 3000;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.05, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 2 - 1;
    src.connect(bp).connect(g).connect(pan).connect(out);
    src.start(t, Math.random() * 5);
    src.stop(t + 0.08);
  }

  /** 0..1 — only the waves bed responds. */
  setBreath(level: number) {
    this.bed?.breath?.(level);
  }

  stopAmbience(fade = 1.5) {
    if (!this.bed) return;
    const bed = this.bed;
    this.bed = null;
    if (fade <= 0.4) bed.stop();
    else setTimeout(() => bed.stop(), (fade - 0.4) * 1000);
  }

  // ─── chimes ──────────────────────────────────────────────────────────────

  /** A soft bell: fundamental plus a slightly inharmonic partial. */
  bell(freq: number, opts: { gain?: number; decay?: number; pan?: number; delay?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const decay = opts.decay ?? 2.4;
    const peak = opts.gain ?? 0.05;
    const pan = ctx.createStereoPanner();
    pan.pan.value = opts.pan ?? 0;
    pan.connect(this.fx);
    for (const [mult, amp] of [
      [1, 1],
      [2.76, 0.25],
      [5.4, 0.08],
    ]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak * amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay / mult ** 0.5);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
  }

  phaseChime(kind: 'in' | 'out' | 'hold') {
    const f = { in: midiHz(76), hold: midiHz(74), out: midiHz(71) }[kind];
    this.bell(f, { gain: 0.035, decay: 2.2 });
  }

  /** Pond: pitch from height (higher on screen = higher note), pan from x. */
  note(y01: number, x01: number) {
    const steps = 10;
    const i = Math.round((1 - Math.min(1, Math.max(0, y01))) * (steps - 1));
    const midi = 62 + PENTA[i % 5] + 12 * Math.floor(i / 5);
    this.bell(midiHz(midi), { gain: 0.06, decay: 3, pan: x01 * 1.6 - 0.8 });
  }

  star(n: number) {
    const i = Math.min(n, 9);
    this.bell(midiHz(67 + PENTA[i % 5] + 12 * Math.floor(i / 5)), { gain: 0.04, decay: 1.8 });
  }

  constellation() {
    [0, 4, 7, 12].forEach((s, i) => this.bell(midiHz(67 + s), { gain: 0.04, decay: 3, delay: i * 0.12 }));
  }

  gentleReset() {
    this.bell(midiHz(64), { gain: 0.035, decay: 1.6 });
    this.bell(midiHz(60), { gain: 0.03, decay: 2, delay: 0.18 });
  }

  finish() {
    [60, 64, 67, 71, 74].forEach((m, i) => this.bell(midiHz(m), { gain: 0.035, decay: 4, delay: i * 0.16 }));
  }

  ui() {
    this.bell(midiHz(84), { gain: 0.015, decay: 0.6 });
  }
}

export const sound = new SoundscapeEngine();
