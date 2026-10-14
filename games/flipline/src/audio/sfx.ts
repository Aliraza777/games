/** Fully synthesized sound: engine, spin whoosh, landings, pickups, music. */

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];

class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private fx!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private eng: { o1: OscillatorNode; o2: OscillatorNode; f: BiquadFilterNode; g: GainNode; wg: GainNode; wf: BiquadFilterNode; ws: AudioBufferSourceNode } | null = null;
  private music: number | null = null;
  private vol = { sound: 0.8, music: 0.4 };

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
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
  }

  private get live() {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
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

  /** speed 0..1; accelerating on the ground; spinning in the air (whoosh). */
  engine(speed: number, accel: boolean, spinning = false) {
    const ctx = this.live;
    if (!ctx) return;
    if (!this.eng) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth';
      o2.type = 'square';
      const f = ctx.createBiquadFilter();
      f.frequency.value = 500;
      const g = ctx.createGain();
      g.gain.value = 0;
      o1.connect(f);
      o2.connect(f);
      f.connect(g).connect(this.fx);
      const ws = ctx.createBufferSource();
      ws.buffer = this.noise;
      ws.loop = true;
      const wf = ctx.createBiquadFilter();
      wf.type = 'bandpass';
      wf.frequency.value = 900;
      const wg = ctx.createGain();
      wg.gain.value = 0;
      ws.connect(wf).connect(wg).connect(this.fx);
      o1.start();
      o2.start();
      ws.start();
      this.eng = { o1, o2, f, g, wg, wf, ws };
    }
    const t = ctx.currentTime;
    const pitch = 55 + speed * 110 + (accel ? 25 : 0);
    this.eng.o1.frequency.setTargetAtTime(pitch, t, 0.06);
    this.eng.o2.frequency.setTargetAtTime(pitch * 0.5, t, 0.06);
    this.eng.f.frequency.setTargetAtTime(400 + speed * 1400 + (accel ? 500 : 0), t, 0.06);
    this.eng.g.gain.setTargetAtTime(speed > 0.02 || accel ? 0.02 + (accel ? 0.035 : 0) + speed * 0.02 : 0, t, 0.08);
    this.eng.wg.gain.setTargetAtTime(spinning ? 0.07 : 0, t, 0.05);
    this.eng.wf.frequency.setTargetAtTime(spinning ? 700 + Math.random() * 500 : 900, t, 0.05);
  }

  land(intensity: number) {
    const ctx = this.live;
    if (!ctx) return;
    this.hiss(ctx.currentTime, 0.1, 0.1 + intensity * 0.2, 'lowpass', 500);
    this.tone('sine', 95, ctx.currentTime, 0.16, 0.12 + intensity * 0.1, { to: 45 });
  }

  landTrick(flips: number, perfect: boolean) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.land(0.6);
    const n = 2 + Math.min(flips, 4);
    for (let i = 0; i < n; i++) this.tone('triangle', midiHz(72 + PENTA[i % 5] + 12 * Math.floor(i / 5)), t + i * 0.055, 0.16, 0.07);
    if (perfect) this.tone('sine', midiHz(96), t + n * 0.055, 0.6, 0.06);
  }

  gem(n: number) {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone('sine', midiHz(81 + n * 2), t, 0.25, 0.1, { to: midiHz(88 + n * 2) });
    this.tone('triangle', midiHz(93 + n * 2), t + 0.05, 0.2, 0.04);
  }

  checkpoint() {
    const ctx = this.live;
    if (!ctx) return;
    [0, 7].forEach((s, i) => this.tone('triangle', midiHz(76 + s), ctx.currentTime + i * 0.08, 0.25, 0.07));
  }

  crash() {
    const ctx = this.live;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(t, 0.7, 0.45, 'lowpass', 1200);
    this.tone('sawtooth', 160, t, 0.5, 0.12, { to: 40, lp: 700 });
  }

  finish() {
    const ctx = this.live;
    if (!ctx) return;
    [0, 4, 7, 12, 16].forEach((s, i) => this.tone('square', midiHz(72 + s), ctx.currentTime + i * 0.08, 0.3, 0.05, { lp: 3000 }));
  }

  ui() {
    const ctx = this.live;
    if (!ctx) return;
    this.tone('triangle', 900, ctx.currentTime, 0.05, 0.05);
  }

  /** A mellow synth loop under the ride. */
  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.music != null) return;
    const step = 60 / 100 / 4;
    let next = ctx.currentTime + 0.1;
    let i = 0;
    const chords = [57, 53, 60, 55];
    const tick = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.15) {
        const s = i % 16;
        const root = chords[Math.floor(i / 16) % 4];
        if (s % 4 === 0) this.tone('sine', 110, next, 0.2, 0.25, { to: 45, dest: this.musicBus });
        if (s % 4 === 2) this.hiss(next, 0.04, 0.04, 'highpass', 8000, this.musicBus);
        if (s % 2 === 0) this.tone('triangle', midiHz(root - 12), next, step * 1.6, 0.05, { dest: this.musicBus, lp: 600 });
        if (s % 3 === 0) this.tone('sine', midiHz(root + 12 + [0, 3, 7, 10][s % 4]), next, step * 2, 0.025, { dest: this.musicBus });
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
