/**
 * Synthesized sound: an engine whose pitch follows wheel speed, a pen
 * scribble while drawing, ink-specific effects, and a synthwave loop.
 */

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const PENTA = [0, 3, 5, 7, 10];

interface Volumes {
  sfx: number;
  music: number;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private fxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private vol: Volumes = { sfx: 0.8, music: 0.5 };
  private engineNodes: { o1: OscillatorNode; o2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private scribbleNodes: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private music: { timer: number; step: number; start: number } | null = null;
  muted = false;

  ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.connect(comp);
      this.fxBus = ctx.createGain();
      this.fxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolumes(v: Volumes) {
    this.vol = v;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.6, t, 0.05);
  }

  private get live() {
    return this.ctx && this.ctx.state === 'running' && !this.muted ? this.ctx : null;
  }

  private tone(type: OscillatorType, freq: number, t: number, dur: number, peak: number, opts: { to?: number; dest?: AudioNode; filter?: number } = {}) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f);
      node = f;
    }
    node.connect(g).connect(opts.dest ?? this.fxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private hiss(t: number, dur: number, peak: number, type: BiquadFilterType, freq: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest ?? this.fxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ─── continuous ──────────────────────────────────────────────────────────

  engine(speedRatio: number, throttle: number, grounded: boolean) {
    const ctx = this.live;
    if (!ctx) return;
    if (!this.engineNodes) {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o2.type = 'square';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      o1.connect(filter);
      o2.connect(filter);
      filter.connect(gain).connect(this.fxBus);
      o1.start();
      o2.start();
      this.engineNodes = { o1, o2, filter, gain };
    }
    const { o1, o2, filter, gain } = this.engineNodes;
    const t = ctx.currentTime;
    const rev = (grounded ? speedRatio : speedRatio * 0.8 + Math.max(0, throttle) * 0.3) * 1;
    const f = 42 + rev * 90;
    o1.frequency.setTargetAtTime(f, t, 0.05);
    o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    filter.frequency.setTargetAtTime(300 + rev * 900 + Math.max(0, throttle) * 300, t, 0.08);
    gain.gain.setTargetAtTime(0.025 + Math.max(0, throttle) * 0.03 + rev * 0.02, t, 0.08);
  }

  engineStop() {
    if (!this.engineNodes || !this.ctx) return;
    const { o1, o2, gain } = this.engineNodes;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    o1.stop(this.ctx.currentTime + 0.5);
    o2.stop(this.ctx.currentTime + 0.5);
    this.engineNodes = null;
  }

  /** Pen-on-paper hiss while drawing. */
  scribble(on: boolean, intensity = 1) {
    const ctx = this.live;
    if (!ctx) {
      if (!on && this.scribbleNodes && this.ctx) this.scribbleNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      return;
    }
    if (on && !this.scribbleNodes) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      filter.Q.value = 1.5;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.fxBus);
      src.start();
      this.scribbleNodes = { src, filter, gain };
    }
    if (!this.scribbleNodes) return;
    const t = ctx.currentTime;
    this.scribbleNodes.gain.gain.setTargetAtTime(on ? 0.05 * intensity : 0, t, 0.03);
    if (on) this.scribbleNodes.filter.frequency.setTargetAtTime(1800 + Math.random() * 1600, t, 0.04);
  }

  // ─── one-shots ───────────────────────────────────────────────────────────

  pickup(kind: 'ink' | 'star') {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === 'ink') {
      this.tone('sine', 660, t, 0.18, 0.12, { to: 1320 });
      this.tone('triangle', 990, t + 0.05, 0.2, 0.06);
    } else {
      [0, 4, 7, 12].forEach((s, i) => this.tone('square', midiHz(76 + s), t + i * 0.05, 0.16, 0.04, { filter: 3000 }));
    }
  }

  inkSwitch(index: number) {
    const ctx = this.live;
    if (!ctx) return;
    this.tone('triangle', midiHz(72 + index * 4), ctx.currentTime, 0.08, 0.06);
  }

  bounce() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone('sine', 140, t, 0.35, 0.22, { to: 560 });
    this.tone('triangle', 280, t, 0.25, 0.06, { to: 900 });
  }

  land(intensity: number) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(t, 0.12, 0.12 + intensity * 0.2, 'lowpass', 500);
    this.tone('sine', 90, t, 0.18, 0.15 * intensity + 0.05, { to: 45 });
  }

  trick(flips: number) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = 3 + Math.min(flips, 3);
    for (let i = 0; i < n; i++) this.tone('square', midiHz(69 + PENTA[i % 5] + 12 * Math.floor(i / 5)), t + i * 0.06, 0.14, 0.045, { filter: 2600 });
  }

  crash() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(t, 0.9, 0.5, 'lowpass', 900);
    this.tone('sawtooth', 120, t, 0.6, 0.18, { to: 30, filter: 600 });
  }

  fall() {
    const ctx = this.live;
    if (!ctx) return;
    this.tone('sine', 600, ctx.currentTime, 0.9, 0.12, { to: 60 });
  }

  erase() {
    const ctx = this.live;
    if (!ctx) return;
    this.hiss(ctx.currentTime, 0.18, 0.08, 'highpass', 3000);
  }

  empty() {
    const ctx = this.live;
    if (!ctx) return;
    this.tone('square', 220, ctx.currentTime, 0.1, 0.05, { filter: 800 });
    this.tone('square', 180, ctx.currentTime + 0.1, 0.12, 0.05, { filter: 800 });
  }

  ui() {
    const ctx = this.live;
    if (!ctx) return;
    this.tone('triangle', 880, ctx.currentTime, 0.05, 0.05);
  }

  // ─── synthwave loop ──────────────────────────────────────────────────────

  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.music) return;
    const bpm = 104;
    const stepDur = 60 / bpm / 4;
    const start = ctx.currentTime + 0.1;
    const m = { timer: 0, step: 0, start };
    const chords = [57, 53, 48, 55]; // A F C G
    const schedule = () => {
      if (!this.ctx) return;
      const horizon = this.ctx.currentTime + 0.15;
      while (m.start + m.step * stepDur < horizon) {
        const t = m.start + m.step * stepDur;
        const s = m.step % 16;
        const root = chords[Math.floor(m.step / 16) % 4];
        const out = this.musicBus;
        if (s % 4 === 0) this.tone('sine', 120, t, 0.25, 0.4, { to: 40, dest: out });
        if (s === 4 || s === 12) this.hiss(t, 0.18, 0.18, 'bandpass', 1600, out);
        if (s % 2 === 1) this.hiss(t, 0.04, 0.05, 'highpass', 8000, out);
        if (s % 2 === 0) this.tone('sawtooth', midiHz(root - 24), t, stepDur * 1.8, 0.07, { dest: out, filter: 500 });
        const arp = [0, 3, 7, 12][s % 4];
        this.tone('square', midiHz(root + arp + 12), t, stepDur * 0.9, 0.022, { dest: out, filter: 2200 });
        m.step++;
      }
    };
    m.timer = window.setInterval(schedule, 40);
    schedule();
    this.music = m;
  }

  stopMusic() {
    if (!this.music) return;
    clearInterval(this.music.timer);
    this.music = null;
  }
}

export const sfx = new Sfx();
