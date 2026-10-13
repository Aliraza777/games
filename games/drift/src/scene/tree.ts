import { clamp } from '../lib/math';
import type { Rng } from '../lib/rng';

/**
 * A recursive tree whose self-similar (fractal) dimension sits in the
 * mid-range (D ≈ 1.3–1.5) that people find most relaxing to look at (Taylor
 * et al.). For a tree that splits into N branches scaled by r each time,
 * D = log N / log(1/r).
 */
export interface TreeSpec {
  depth: number;
  ratio: number;
  spread: number;
  jitter: number;
}

export const BRANCHING = 2;
export const DEFAULT_TREE: TreeSpec = { depth: 9, ratio: 0.61, spread: 0.92, jitter: 0.18 };

export function fractalDimension(branches: number, ratio: number): number {
  return Math.log(branches) / Math.log(1 / ratio);
}

export interface TreeNode {
  parent: number;
  depth: number;
  /** Angle relative to the parent, in radians. */
  offset: number;
  /** Length relative to the trunk (trunk = 1). */
  len: number;
  /** Per-branch phase so the sway isn't uniform. */
  swayPhase: number;
}

/** Nodes in breadth-first order: every parent precedes its children. */
export function buildTree(spec: TreeSpec, rng: Rng): TreeNode[] {
  const nodes: TreeNode[] = [{ parent: -1, depth: 0, offset: 0, len: 1, swayPhase: 0 }];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.depth >= spec.depth) continue;
    for (let b = 0; b < BRANCHING; b++) {
      const side = b === 0 ? -1 : 1;
      nodes.push({
        parent: i,
        depth: n.depth + 1,
        offset: side * (spec.spread / 2) + (rng() - 0.5) * spec.jitter,
        len: n.len * spec.ratio * (1 + (rng() - 0.5) * spec.jitter),
        swayPhase: rng() * Math.PI * 2,
      });
    }
  }
  return nodes;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
  /** 0..1 how grown this branch is. */
  grown: number;
  tip: boolean;
}

/**
 * Positions every branch for this frame. `growth` (0..1) reveals the tree
 * generation by generation; `sway(node)` adds a small wind offset.
 */
export function layoutTree(
  nodes: TreeNode[],
  opts: { x: number; y: number; trunk: number; growth: number; maxDepth: number; sway: (n: TreeNode) => number },
): Segment[] {
  const reveal = clamp(opts.growth, 0, 1) * (opts.maxDepth + 1);
  const angles = new Float64Array(nodes.length);
  const ends = new Float64Array(nodes.length * 2);
  const segs: Segment[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const grown = clamp(reveal - n.depth, 0, 1);
    const baseAngle = n.parent < 0 ? -Math.PI / 2 : angles[n.parent];
    const angle = baseAngle + n.offset + opts.sway(n);
    angles[i] = angle;
    const x1 = n.parent < 0 ? opts.x : ends[n.parent * 2];
    const y1 = n.parent < 0 ? opts.y : ends[n.parent * 2 + 1];
    const len = n.len * opts.trunk * grown;
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 + Math.sin(angle) * len;
    ends[i * 2] = x2;
    ends[i * 2 + 1] = y2;
    if (grown > 0) segs.push({ x1, y1, x2, y2, depth: n.depth, grown, tip: n.depth === opts.maxDepth });
  }
  return segs;
}
