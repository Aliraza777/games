import { mulberry32 } from '../lib/rng';
import { PIECES, type PieceType } from './pieces';

/** The 7-bag: every run of seven pieces holds each tetromino exactly once. */
export class Bag {
  private rng: () => number;
  private buf: PieceType[] = [];

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  private refill() {
    const b = [...PIECES];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    this.buf.push(...b);
  }

  /** Look ahead without consuming. */
  peek(n: number): PieceType[] {
    while (this.buf.length < n) this.refill();
    return this.buf.slice(0, n);
  }

  next(): PieceType {
    if (!this.buf.length) this.refill();
    return this.buf.shift()!;
  }
}
