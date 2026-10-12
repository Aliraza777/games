import { Graphics } from 'pixi.js';

/** Tapered polyline of recent positions — orb paths, cursor ribbons. */
export class Trail {
  readonly view = new Graphics();
  private pts: { x: number; y: number }[] = [];

  constructor(
    private opts: { length: number; width: number; color: number; alpha: number },
  ) {}

  set color(c: number) {
    this.opts.color = c;
  }

  push(x: number, y: number) {
    const last = this.pts[this.pts.length - 1];
    if (last && Math.abs(last.x - x) < 0.5 && Math.abs(last.y - y) < 0.5) return;
    this.pts.push({ x, y });
    if (this.pts.length > this.opts.length) this.pts.shift();
  }

  clear() {
    this.pts.length = 0;
    this.view.clear();
  }

  redraw(alphaScale = 1) {
    const g = this.view.clear();
    const n = this.pts.length;
    if (n < 2 || alphaScale <= 0.01) return;
    const { width, color, alpha } = this.opts;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      g.moveTo(this.pts[i - 1].x, this.pts[i - 1].y)
        .lineTo(this.pts[i].x, this.pts[i].y)
        .stroke({ width: Math.max(0.5, width * t), color, alpha: alpha * t * alphaScale, cap: 'round' });
    }
  }
}
