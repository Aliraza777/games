import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../lib/rng';
import { BRANCHING, DEFAULT_TREE, buildTree, fractalDimension, layoutTree } from './tree';

describe('fractal tree', () => {
  it('sits in the relaxing mid-range fractal dimension (1.3–1.5)', () => {
    const d = fractalDimension(BRANCHING, DEFAULT_TREE.ratio);
    expect(d).toBeGreaterThanOrEqual(1.3);
    expect(d).toBeLessThanOrEqual(1.5);
    // Even at the extremes of the random length jitter it stays close.
    const lo = fractalDimension(BRANCHING, DEFAULT_TREE.ratio * (1 - DEFAULT_TREE.jitter / 2));
    const hi = fractalDimension(BRANCHING, DEFAULT_TREE.ratio * (1 + DEFAULT_TREE.jitter / 2));
    expect(lo).toBeGreaterThan(1.1);
    expect(hi).toBeLessThan(1.8);
  });

  it('has 2^(depth+1) − 1 branches, parents before children', () => {
    const nodes = buildTree(DEFAULT_TREE, mulberry32(1));
    expect(nodes).toHaveLength(2 ** (DEFAULT_TREE.depth + 1) - 1);
    nodes.forEach((n, i) => {
      if (i === 0) expect(n.parent).toBe(-1);
      else {
        expect(n.parent).toBeLessThan(i);
        expect(n.depth).toBe(nodes[n.parent].depth + 1);
        expect(n.len).toBeLessThan(nodes[n.parent].len);
      }
    });
  });

  it('is deterministic per seed', () => {
    expect(buildTree(DEFAULT_TREE, mulberry32(7))).toEqual(buildTree(DEFAULT_TREE, mulberry32(7)));
    expect(buildTree(DEFAULT_TREE, mulberry32(7))).not.toEqual(buildTree(DEFAULT_TREE, mulberry32(8)));
  });

  it('grows generation by generation', () => {
    const nodes = buildTree(DEFAULT_TREE, mulberry32(3));
    const layout = (growth: number) =>
      layoutTree(nodes, { x: 0, y: 0, trunk: 100, growth, maxDepth: DEFAULT_TREE.depth, sway: () => 0 });
    expect(layout(0)).toHaveLength(0);
    const full = layout(1);
    expect(full).toHaveLength(nodes.length);
    expect(full.every((s) => s.grown === 1)).toBe(true);
    let prev = 0;
    for (let g = 0.05; g <= 1; g += 0.05) {
      const n = layout(g).length;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    // The trunk grows straight up from the root.
    const trunk = full[0];
    expect(trunk.x2).toBeCloseTo(0);
    expect(trunk.y2).toBeCloseTo(-100);
  });
});
