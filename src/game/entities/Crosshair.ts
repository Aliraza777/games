import { Container, Graphics } from 'pixi.js';
import type { CrosshairSettings } from '../../store/settings';
import { parseHex } from '../../lib/math';

/** Same geometry as the SVG preview in Settings (components/CrosshairSvg). */
export class Crosshair {
  readonly view = new Container();
  private g = new Graphics();
  private kick = 0;

  constructor(cfg: CrosshairSettings) {
    this.view.addChild(this.g);
    this.draw(cfg);
  }

  draw(c: CrosshairSettings) {
    const g = this.g.clear();
    const th = c.thickness;
    const half = th / 2;
    const paint = (e: number, color: number, alpha: number) => {
      if (c.shape === 'cross' || c.shape === 'cross-dot') {
        g.rect(c.gap - e, -half - e, c.size + 2 * e, th + 2 * e);
        g.rect(-c.gap - c.size - e, -half - e, c.size + 2 * e, th + 2 * e);
        g.rect(-half - e, -c.gap - c.size - e, th + 2 * e, c.size + 2 * e);
        g.rect(-half - e, c.gap - e, th + 2 * e, c.size + 2 * e);
        g.fill({ color, alpha });
      }
      if (c.shape === 'cross-dot') g.circle(0, 0, Math.max(1, th * 0.75) + e).fill({ color, alpha });
      if (c.shape === 'dot') g.circle(0, 0, Math.max(2, c.size * 0.35) + e).fill({ color, alpha });
      if (c.shape === 'circle') {
        g.circle(0, 0, c.size + c.gap).stroke({ width: th + 2 * e, color, alpha });
        g.circle(0, 0, Math.max(1, th * 0.75) + e).fill({ color, alpha });
      }
    };
    if (c.outline) paint(1, 0x000000, 0.7);
    paint(0, parseHex(c.color), 1);
  }

  fire() {
    this.kick = 1;
  }

  update(dt: number, x: number, y: number) {
    this.kick = Math.max(0, this.kick - dt * 9);
    this.view.scale.set(1 + 0.35 * this.kick * this.kick);
    this.view.position.set(Math.round(x), Math.round(y));
  }
}
