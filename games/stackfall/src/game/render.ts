import { H, HIDDEN, W, cellsOf, type ClearEvent, type Engine, type EngineEvent } from './engine';
import { ID_PIECE, SHAPE_CELLS, type PieceType } from './pieces';
import type { BlockStyle, Theme } from './themes';

export interface RenderOpts {
  theme: Theme;
  ghost: boolean;
  grid: boolean;
  reducedMotion: boolean;
}

const GARBAGE = '#5b6077';

// ── colour helpers ─────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex: string, to: number, amt: number) {
  const [r, g, b] = rgb(hex);
  const m = (c: number) => Math.round(c + (to - c) * amt);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
const lighten = (hex: string, a: number) => mix(hex, 255, a);
const darken = (hex: string, a: number) => mix(hex, 0, a);
export const alpha = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── block sprites (cached per style/colour/size) ───────────────────────

const sprites = new Map<string, HTMLCanvasElement>();
const PAD = 0.3;

function paintBlock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, style: BlockStyle) {
  const g = Math.max(1, s * 0.05);
  const bx = x + g;
  const by = y + g;
  const bs = s - g * 2;
  if (style === 'flat') {
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bs, bs);
    ctx.fillStyle = darken(color, 0.25);
    ctx.fillRect(bx, by + bs * 0.82, bs, bs * 0.18);
    return;
  }
  if (style === 'pixel') {
    ctx.fillStyle = darken(color, 0.55);
    ctx.fillRect(bx, by, bs, bs);
    ctx.fillStyle = color;
    ctx.fillRect(bx + bs * 0.12, by + bs * 0.12, bs * 0.76, bs * 0.76);
    ctx.fillStyle = darken(color, 0.35);
    ctx.fillRect(bx + bs * 0.32, by + bs * 0.32, bs * 0.36, bs * 0.36);
    return;
  }
  const r = bs * 0.2;
  if (style === 'neon') {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = s * 0.35;
    rrect(ctx, bx + 1, by + 1, bs - 2, bs - 2, r);
    ctx.fillStyle = alpha(color, 0.16);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.09);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.restore();
    return;
  }
  // gloss
  ctx.save();
  ctx.shadowColor = alpha(color, 0.55);
  ctx.shadowBlur = s * 0.28;
  rrect(ctx, bx, by, bs, bs, r);
  const grd = ctx.createLinearGradient(0, by, 0, by + bs);
  grd.addColorStop(0, lighten(color, 0.22));
  grd.addColorStop(0.55, color);
  grd.addColorStop(1, darken(color, 0.28));
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.restore();
  // top shine
  rrect(ctx, bx + bs * 0.12, by + bs * 0.08, bs * 0.76, bs * 0.32, r * 0.7);
  const sh = ctx.createLinearGradient(0, by, 0, by + bs * 0.4);
  sh.addColorStop(0, 'rgba(255,255,255,0.55)');
  sh.addColorStop(1, 'rgba(255,255,255,0.05)');
  ctx.fillStyle = sh;
  ctx.fill();
  // rim
  rrect(ctx, bx + 0.5, by + 0.5, bs - 1, bs - 1, r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
}

function sprite(color: string, size: number, style: BlockStyle, dpr: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = `${style}|${color}|${size}|${dpr}`;
  let c = sprites.get(key);
  if (!c) {
    c = document.createElement('canvas');
    const pad = Math.ceil(size * PAD);
    c.width = Math.ceil((size + pad * 2) * dpr);
    c.height = c.width;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    paintBlock(ctx, pad, pad, size, color, style);
    if (sprites.size > 400) sprites.clear();
    sprites.set(key, c);
  }
  return c;
}

function blit(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, style: BlockStyle, dpr: number) {
  const sp = sprite(color, size, style, dpr);
  if (!sp) return;
  const pad = Math.ceil(size * PAD);
  ctx.drawImage(sp, x - pad, y - pad, size + pad * 2, size + pad * 2);
}

export const pieceColor = (theme: Theme, v: number) => {
  const p = ID_PIECE[v];
  return p ? theme.colors[p] : GARBAGE;
};

/** Draw one piece centred in a small canvas (hold / next previews). */
export function drawPreview(canvas: HTMLCanvasElement, type: PieceType | null, theme: Theme, dimmed = false) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || 80;
  const cssH = canvas.clientHeight || 48;
  if (canvas.width !== Math.round(cssW * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  if (!type) return;
  const cells = SHAPE_CELLS[type][0];
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const w = Math.max(...xs) - Math.min(...xs) + 1;
  const h = Math.max(...ys) - Math.min(...ys) + 1;
  const s = Math.floor(Math.min(cssW / 4.4, cssH / 2.6));
  const ox = (cssW - w * s) / 2 - Math.min(...xs) * s;
  const oy = (cssH - h * s) / 2 - Math.min(...ys) * s;
  ctx.globalAlpha = dimmed ? 0.3 : 1;
  for (const [cx, cy] of cells) blit(ctx, ox + cx * s, oy + cy * s, s, theme.colors[type], theme.style, dpr);
  ctx.globalAlpha = 1;
}

// ── effects ───────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Draws the well, pieces and all the juice. Coordinates are in cells. */
export class Renderer {
  private ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  cell = 28;
  private particles: Particle[] = [];
  private flashes: { rows: number[]; t: number; strong: boolean }[] = [];
  private collapse: { shift: number[]; t: number } | null = null;
  private trails: { cells: [number, number][]; dist: number; color: string; t: number }[] = [];
  private lockFlash: { cells: [number, number][]; t: number } | null = null;
  private shake = { mag: 0, t: 0 };
  private pulse = -1e9;
  private last = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  /** Size the canvas to the largest whole-cell well that fits. */
  fit(maxW: number, maxH: number): number {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const cell = Math.max(8, Math.floor(Math.min(maxW / W, maxH / (H - HIDDEN + 1.2))));
    this.cell = cell;
    const cssW = cell * W;
    const cssH = cell * H;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    return cell;
  }

  onEvent(e: EngineEvent, theme: Theme, reduced: boolean, now = performance.now()) {
    if (e.type === 'lock') {
      this.lockFlash = { cells: e.cells.map(([x, y]) => [x, y]), t: now };
      if (e.dropped > 0) {
        this.trails.push({ cells: e.cells.map(([x, y]) => [x, y]), dist: e.dropped, color: theme.colors[e.piece], t: now });
        if (!reduced && e.dropped >= 6) this.kick(1.5, now);
      }
    } else if (e.type === 'clear' && e.lines > 0) {
      this.onClear(e, theme, reduced, now);
    } else if (e.type === 'levelUp') {
      this.pulse = now;
    } else if (e.type === 'zenClear') {
      this.pulse = now;
      if (!reduced) for (let i = 0; i < 80; i++) this.spark(Math.random() * W, HIDDEN + Math.random() * (H - HIDDEN), theme.accent, now, 1.2);
    }
  }

  private onClear(e: ClearEvent, theme: Theme, reduced: boolean, now: number) {
    this.lockFlash = null;
    const big = e.lines === 4 || e.spin !== 'none' || e.perfect;
    this.flashes.push({ rows: e.rows, t: now, strong: big });
    if (reduced) return;
    // Rows above a cleared line slide down into place.
    const shift = new Array<number>(H).fill(0);
    for (let o = 0; o < H; o++) {
      if (e.rows.includes(o)) continue;
      const below = e.rows.filter((r) => r > o).length;
      if (o + below < H) shift[o + below] = below;
    }
    this.collapse = { shift, t: now };
    e.rows.forEach((y, i) => {
      for (let x = 0; x < W; x++) {
        const color = pieceColor(theme, e.cleared[i][x]);
        for (let k = 0; k < (big ? 4 : 2); k++) this.spark(x + Math.random(), y + Math.random(), color, now, big ? 1.4 : 1);
      }
    });
    if (e.perfect) for (let i = 0; i < 120; i++) this.spark(Math.random() * W, H - Math.random() * 6, theme.accent, now, 1.8);
    if (big) this.kick(e.lines === 4 || e.perfect ? 9 : 6, now);
    else if (e.lines >= 2) this.kick(2.5, now);
  }

  private spark(x: number, y: number, color: string, now: number, power: number) {
    const a = Math.random() * Math.PI * 2;
    const v = (2 + Math.random() * 7) * power;
    this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4 * power, life: 0, max: 0.5 + Math.random() * 0.5, color, size: 0.08 + Math.random() * 0.14 });
    void now;
  }

  private kick(mag: number, now: number) {
    this.shake = { mag: Math.max(mag, this.shake.mag * Math.max(0, 1 - (now - this.shake.t) / 350)), t: now };
  }

  draw(e: Engine, o: RenderOpts, now = performance.now(), danger = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0);
    this.last = now;
    const c = this.cell;
    const { theme } = o;
    const style = theme.style;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W * c, H * c);

    // Screen shake decays over ~350ms.
    const st = (now - this.shake.t) / 350;
    if (!o.reducedMotion && st < 1 && this.shake.mag > 0) {
      const m = this.shake.mag * (1 - st) * (1 - st);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.3) * m);
    }

    // Well
    const top = HIDDEN * c;
    const wh = (H - HIDDEN) * c;
    const bg = ctx.createLinearGradient(0, top, 0, top + wh);
    bg.addColorStop(0, theme.well[0]);
    bg.addColorStop(1, theme.well[1]);
    ctx.fillStyle = bg;
    rrect(ctx, 0, top, W * c, wh, Math.min(12, c * 0.4));
    ctx.fill();

    if (o.grid) {
      ctx.strokeStyle = theme.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < W; x++) {
        ctx.moveTo(x * c + 0.5, top);
        ctx.lineTo(x * c + 0.5, top + wh);
      }
      for (let y = HIDDEN + 1; y < H; y++) {
        ctx.moveTo(0, y * c + 0.5);
        ctx.lineTo(W * c, y * c + 0.5);
      }
      ctx.stroke();
    }

    // Locked cells (sliding down after a clear).
    const cp = this.collapse ? ease((now - this.collapse.t) / 170) : 1;
    if (cp >= 1) this.collapse = null;
    for (let y = 0; y < H; y++) {
      const off = this.collapse ? this.collapse.shift[y] * (1 - cp) : 0;
      for (let x = 0; x < W; x++) {
        const v = e.board[y][x];
        if (v) blit(ctx, x * c, (y - off) * c, c, pieceColor(theme, v), style, dpr);
      }
    }

    // Hard-drop trails
    this.trails = this.trails.filter((t) => now - t.t < 180);
    for (const t of this.trails) {
      const k = 1 - (now - t.t) / 180;
      const cols = new Map<number, number>();
      for (const [x, y] of t.cells) cols.set(x, Math.min(cols.get(x) ?? 99, y));
      for (const [x, y] of cols) {
        const y0 = Math.max(0, y - Math.min(t.dist, 5));
        const g = ctx.createLinearGradient(0, y0 * c, 0, y * c);
        g.addColorStop(0, alpha(t.color, 0));
        g.addColorStop(1, alpha(t.color, 0.22 * k));
        ctx.fillStyle = g;
        ctx.fillRect(x * c + c * 0.2, y0 * c, c * 0.6, (y - y0) * c);
      }
    }

    const p = e.active;
    if (p) {
      const color = theme.colors[p.type];
      // Ghost
      if (o.ghost) {
        const gy = e.ghostY ?? p.y;
        if (gy !== p.y) {
          for (const [x, y] of cellsOf({ ...p, y: gy })) {
            rrect(ctx, x * c + c * 0.08, y * c + c * 0.08, c * 0.84, c * 0.84, c * 0.18);
            ctx.fillStyle = alpha(color, 0.1);
            ctx.fill();
            ctx.lineWidth = Math.max(1, c * 0.06);
            ctx.strokeStyle = alpha(color, 0.55);
            ctx.stroke();
          }
        }
      }
      for (const [x, y] of cellsOf(p)) blit(ctx, x * c, y * c, c, color, style, dpr);
    }

    // Lock flash
    if (this.lockFlash) {
      const k = 1 - (now - this.lockFlash.t) / 140;
      if (k <= 0) this.lockFlash = null;
      else {
        ctx.fillStyle = `rgba(255,255,255,${0.45 * k})`;
        for (const [x, y] of this.lockFlash.cells) {
          rrect(ctx, x * c + c * 0.05, y * c + c * 0.05, c * 0.9, c * 0.9, c * 0.2);
          ctx.fill();
        }
      }
    }

    // Line-clear flashes
    this.flashes = this.flashes.filter((f) => now - f.t < 320);
    for (const f of this.flashes) {
      const t = (now - f.t) / 320;
      const k = 1 - t;
      for (const y of f.rows) {
        const hgt = c * (1 + t * (f.strong ? 1.4 : 0.6));
        const grd = ctx.createLinearGradient(0, 0, W * c, 0);
        grd.addColorStop(0, `rgba(255,255,255,0)`);
        grd.addColorStop(0.5, `rgba(255,255,255,${0.9 * k})`);
        grd.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(-c * t * 2, y * c + c / 2 - hgt / 2, W * c + c * t * 4, hgt);
      }
    }

    // Particles
    ctx.globalCompositeOperation = 'lighter';
    this.particles = this.particles.filter((q) => (q.life += dt) < q.max);
    for (const q of this.particles) {
      q.vy += 18 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const k = 1 - q.life / q.max;
      ctx.fillStyle = alpha(q.color, k);
      const s = q.size * c * (0.6 + k * 0.6);
      ctx.fillRect(q.x * c - s / 2, q.y * c - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';

    // Danger + level-up border
    const pk = 1 - (now - this.pulse) / 900;
    const dk = danger ? 0.45 + 0.35 * Math.sin(now / 160) : 0;
    rrect(ctx, 1, top + 1, W * c - 2, wh - 2, Math.min(12, c * 0.4));
    ctx.lineWidth = 2;
    ctx.strokeStyle = dk > 0 ? `rgba(255,60,90,${dk})` : alpha(theme.accent, 0.25 + Math.max(0, pk) * 0.75);
    ctx.stroke();
    if (dk > 0) {
      const g = ctx.createLinearGradient(0, top, 0, top + c * 5);
      g.addColorStop(0, `rgba(255,40,80,${dk * 0.35})`);
      g.addColorStop(1, 'rgba(255,40,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, W * c, c * 5);
    }
  }
}
