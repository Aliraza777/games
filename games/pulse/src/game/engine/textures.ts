import { Texture } from 'pixi.js';

export interface FxTextures {
  /** Soft round particle. */
  dot: Texture;
  /** Large smooth radial glow. */
  glow: Texture;
  /** Thin ring, radius RING_RADIUS within the texture. */
  ring: Texture;
  petal: Texture;
  spark: Texture;
  vignette: Texture;
  /** Transparent center, bright edges — Overdrive glow. */
  edge: Texture;
}

export const RING_RADIUS = 120;

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return Texture.from(c);
}

function radial(ctx: CanvasRenderingContext2D, size: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/** All textures are generated at startup — nothing to download. */
export function createTextures(): FxTextures {
  return {
    dot: canvasTexture(64, 64, (ctx) =>
      radial(ctx, 64, [
        [0, 'rgba(255,255,255,1)'],
        [0.35, 'rgba(255,255,255,0.9)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    ),
    glow: canvasTexture(256, 256, (ctx) =>
      radial(ctx, 256, [
        [0, 'rgba(255,255,255,1)'],
        [0.2, 'rgba(255,255,255,0.55)'],
        [0.5, 'rgba(255,255,255,0.14)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    ),
    ring: canvasTexture(256, 256, (ctx) => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(128, 128, RING_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }),
    petal: canvasTexture(64, 96, (ctx) => {
      const g = ctx.createLinearGradient(0, 96, 0, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.15)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(32, 48, 22, 46, 0, 0, Math.PI * 2);
      ctx.fill();
    }),
    spark: canvasTexture(64, 12, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 64, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0.6)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(32, 6, 32, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }),
    vignette: canvasTexture(512, 512, (ctx) =>
      radial(ctx, 512, [
        [0, 'rgba(0,0,0,0)'],
        [0.55, 'rgba(0,0,0,0)'],
        [1, 'rgba(0,0,0,0.75)'],
      ]),
    ),
    edge: canvasTexture(512, 512, (ctx) =>
      radial(ctx, 512, [
        [0, 'rgba(255,255,255,0)'],
        [0.6, 'rgba(255,255,255,0)'],
        [1, 'rgba(255,255,255,0.9)'],
      ]),
    ),
  };
}
