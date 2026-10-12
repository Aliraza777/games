import { audio } from '../../audio/AudioManager';
import type { Target } from '../entities/Target';
import { BaseMode, type ModeSummary } from './BaseMode';

const COUNT = 3;

/** No timer, no score, no penalties. Soft targets drift; you pop them. */
export class ZenMode extends BaseMode {
  readonly id = 'zen' as const;
  showScore = false;
  allowHitstop = false;
  private targets: Target[] = [];
  private respawnAt: number[] = [];

  start() {
    for (let i = 0; i < COUNT; i++) this.spawn();
    audio.startMusic({ bpm: 64, style: 'ambient' });
  }

  private spawn() {
    const e = this.e;
    const r = e.baseRadius() * 1.2;
    const p = this.randomPoint(r * 2, this.targets[this.targets.length - 1], r * 5);
    const t = e.spawnTarget({ x: p.x, y: p.y, radius: r, style: 'zen' });
    const a = e.rng() * Math.PI * 2;
    const speed = 14 + e.rng() * 18;
    t.data.vx = Math.cos(a) * speed;
    t.data.vy = Math.sin(a) * speed;
    this.targets.push(t);
  }

  step(dt: number) {
    const e = this.e;
    for (const t of this.targets) {
      const r = t.radius;
      const pf = e.playfield(r);
      t.x += t.data.vx * dt;
      t.y += t.data.vy * dt;
      if (t.x < pf.x || t.x > pf.x + pf.w) t.data.vx *= -1;
      if (t.y < pf.y || t.y > pf.y + pf.h) t.data.vy *= -1;
    }
    this.respawnAt = this.respawnAt.filter((at) => {
      if (e.time < at) return true;
      this.spawn();
      return false;
    });
  }

  pointerDown(x: number, y: number) {
    for (const t of this.targets) {
      const hit = t.hit(x, y);
      if (!hit) continue;
      this.e.reward({ x: t.x, y: t.y, radius: t.radius, points: 0, soft: true, offset: hit });
      t.kill('hit');
      this.targets = this.targets.filter((o) => o !== t);
      this.respawnAt.push(this.e.time + 0.5);
      return;
    }
  }

  pause() {
    audio.pauseMusic();
  }
  resume() {
    audio.resumeMusic();
  }
  destroy() {
    audio.stopMusic();
  }

  isOver() {
    return false;
  }
  progress() {
    return -1;
  }
  timeLeft() {
    return null;
  }
  liveAccuracy() {
    return null;
  }

  summary(): ModeSummary {
    return { accuracy: 1, rating: 1, histogram: null, extra: [] };
  }
}
