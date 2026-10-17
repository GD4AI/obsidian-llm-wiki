// Pure-function tests for monte-carlo-ppr.ts
//
// Contract (from #198 / 2026-06-24 consensus, Fogaras 2005):
//
//   personalizedPageRank(
//     graph: Graph,
//     seed: string,
//     options?: { numWalks?: number; maxSteps?: number; damping?: number }
//   ): Map<string, number>
//
//   Graph: { nodes: string[]; edges: Map<string, string[]> }
//
//   Returns a map of node -> visit probability (0-1). Probabilities sum
//   to ≈ 1.0 across all visited nodes.
//
// Behavior:
// - For each walk, start at `seed`. With probability `damping`, teleport
//   back to seed; otherwise follow a random outgoing edge. Continue for
//   `maxSteps` hops.
// - Repeat `numWalks` times. Visit counts are normalized to probabilities.
// - If `seed` has no outgoing edges, all probability stays on `seed`.
// - If `seed` is not in the graph, return empty map.
// - Pure function: zero IO, deterministic given a seeded RNG.
//
// Why Monte Carlo (not power-iteration): per @DocTpoint on #198 Q4/Q5,
// K×L cost is independent of |V|. For a 2000-page vault with K=1000
// and L=50, cost is identical to a 200-page vault. Power-iteration
// does 50 sweeps over V+E every time.
//
// Why not seedable RNG in this signature: the public API takes no
// RNG; tests inject one for determinism. (See deterministicRandom
// helper below.)

import { describe, it, expect } from 'vitest';
import { personalizedPageRank, DEFAULT_DAMPING, DEFAULT_MAX_STEPS, DEFAULT_NUM_WALKS, type Graph } from '../../core/monte-carlo-ppr';

// Deterministic PRNG (mulberry32). Used for reproducible tests.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helper to build a simple graph
function graph(edges: Array<[string, string[]]>): Graph {
  return {
    nodes: Array.from(new Set(edges.flatMap(([from, tos]) => [from, ...tos]))),
    edges: new Map(edges),
  };
}

describe('personalizedPageRank — empty / degenerate graphs', () => {
  it('returns empty map when graph has no nodes', () => {
    const g: Graph = { nodes: [], edges: new Map() };
    expect(personalizedPageRank(g, 'A').size).toBe(0);
  });

  it('returns empty map when seed is not in graph', () => {
    const g = graph([['A', ['B']]]);
    expect(personalizedPageRank(g, 'Z').size).toBe(0);
  });

  it('isolated seed (no outgoing edges) keeps all probability on seed', () => {
    // A is in graph but has no outgoing edges. With damping=0.15,
    // every step teleports back to A. After numWalks walks, all visits
    // are on A.
    const g = graph([['A', []]]);
    const result = personalizedPageRank(g, 'A', { numWalks: 100, maxSteps: 10, rng: makeRng(42) });
    expect(result.get('A')).toBe(1);
    expect(result.size).toBe(1);
  });
});

describe('personalizedPageRank — single-edge graph', () => {
  it('A→B: walks spread probability between A and B', () => {
    // A → B. With damping=0.15, at each step the walk has 15% chance to
    // teleport back to A. After maxSteps, the visit distribution should
    // show A and B both with non-zero probability, with A higher (because
    // it teleports back to A often).
    const g = graph([['A', ['B']]]);
    const result = personalizedPageRank(g, 'A', { numWalks: 2000, maxSteps: 50, rng: makeRng(1) });
    const pA = result.get('A') ?? 0;
    const pB = result.get('B') ?? 0;
    expect(pA + pB).toBeCloseTo(1, 1);
    expect(pA).toBeGreaterThan(pB);
    expect(pA).toBeGreaterThan(0.3);
    expect(pB).toBeGreaterThan(0.3);
  });
});

describe('personalizedPageRank — multi-hop graph', () => {
  it('A→B→C: walk reaches C with some probability', () => {
    const g = graph([['A', ['B']], ['B', ['C']]]);
    const result = personalizedPageRank(g, 'A', { numWalks: 5000, maxSteps: 100, rng: makeRng(2) });
    expect(result.has('A')).toBe(true);
    expect(result.has('B')).toBe(true);
    expect(result.has('C')).toBe(true);
    // C is reachable but should be lower than A (A gets teleport bias).
    const pA = result.get('A') ?? 0;
    const pC = result.get('C') ?? 0;
    expect(pA).toBeGreaterThan(pC);
  });

  it('A→B and A→C (direct): PPR gives C and B similar probability when both direct', () => {
    // A has two outgoing edges, both to leaf nodes. Symmetric — should
    // get roughly equal probability.
    const g = graph([['A', ['B', 'C']]]);
    const result = personalizedPageRank(g, 'A', { numWalks: 3000, maxSteps: 50, rng: makeRng(3) });
    const pB = result.get('B') ?? 0;
    const pC = result.get('C') ?? 0;
    expect(Math.abs(pB - pC)).toBeLessThan(0.1);
  });
});

describe('personalizedPageRank — hub detection (cardiology fixture sub-case)', () => {
  it('hub node with high in-degree scores high when seeded from a leaf', () => {
    // CAD is the hub. Seed from Patient (a leaf), CAD should rank
    // highest because all paths lead through it.
    const g: Graph = {
      nodes: ['Patient', 'CAD', 'MI', 'HF'],
      edges: new Map([
        ['Patient', ['CAD']],
        ['CAD', ['MI', 'HF']],
        ['MI', ['HF']],
      ]),
    };
    const result = personalizedPageRank(g, 'Patient', { numWalks: 3000, maxSteps: 50, rng: makeRng(4) });
    const pCAD = result.get('CAD') ?? 0;
    const pMI = result.get('MI') ?? 0;
    expect(pCAD).toBeGreaterThan(pMI);
  });

  it('seed node always has non-zero probability (it is the teleport target)', () => {
    const g = graph([['A', ['B', 'C', 'D', 'E']]]);
    const result = personalizedPageRank(g, 'A', { numWalks: 1000, maxSteps: 50, rng: makeRng(5) });
    const pA = result.get('A') ?? 0;
    expect(pA).toBeGreaterThan(0);
  });
});

describe('personalizedPageRank — determinism', () => {
  it('same seed produces same output', () => {
    const g = graph([['A', ['B', 'C']], ['B', ['D']], ['C', ['D']]]);
    const r1 = personalizedPageRank(g, 'A', { numWalks: 1000, maxSteps: 30, rng: makeRng(42) });
    const r2 = personalizedPageRank(g, 'A', { numWalks: 1000, maxSteps: 30, rng: makeRng(42) });
    expect([...r1.entries()]).toEqual([...r2.entries()]);
  });

  it('different seed produces different output (sampling noise)', () => {
    const g = graph([['A', ['B', 'C', 'D', 'E', 'F']]]);
    const r1 = personalizedPageRank(g, 'A', { numWalks: 100, maxSteps: 30, rng: makeRng(1) });
    const r2 = personalizedPageRank(g, 'A', { numWalks: 100, maxSteps: 30, rng: makeRng(2) });
    // At least one entry should differ (sampling noise on different seeds).
    const same = [...r1.entries()].every(([k, v]) => r2.get(k) === v);
    expect(same).toBe(false);
  });
});

describe('personalizedPageRank — probability normalization', () => {
  it('probabilities sum to ≈ 1.0', () => {
    const g = graph([
      ['A', ['B', 'C']],
      ['B', ['C', 'D']],
      ['C', ['D']],
    ]);
    const result = personalizedPageRank(g, 'A', { numWalks: 1000, maxSteps: 50, rng: makeRng(7) });
    const sum = [...result.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 1);
  });
});

describe('personalizedPageRank — options defaults', () => {
  it('uses sensible defaults when options omitted (no rng provided)', () => {
    // Should not throw. Returns a probability map.
    const g = graph([['A', ['B']]]);
    const result = personalizedPageRank(g, 'A');
    expect(result.size).toBeGreaterThan(0);
    const sum = [...result.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 1);
  });

  it('walks with the calibrated defaults: damping 0.30, maxSteps 10, numWalks 3000', () => {
    // These are not round numbers chosen for tidiness. They were measured on the
    // ground-truth evaluation set across two vaults (test10, 358 pages; test8,
    // 177 pages), sweeping damping x maxSteps against bridge recall@10 and self
    // MRR. Bridge moved +8% and +11% over the previous 0.05 / 50, self recall@10
    // stayed 1.000 on both vaults, and numWalks was flat across 500 / 3000 /
    // 10000 so it is fixed at the shipped 3000.
    //
    // Re-tuning these changes the retrieval contract. Re-measure on both vaults
    // before touching them, and never tune them on one vault alone.
    expect(DEFAULT_DAMPING).toBe(0.30);
    expect(DEFAULT_MAX_STEPS).toBe(10);
    expect(DEFAULT_NUM_WALKS).toBe(3000);
  });

  it('stays concentrated near the seed under the calibrated defaults', () => {
    // The behavioural half of the same calibration: high damping and few steps
    // mean the walk rarely leaves the seed's own neighbourhood. A line graph
    // makes the two ends easy to separate.
    const g = graph([['S', ['A']], ['A', ['B']], ['B', ['C']], ['C', ['D']], ['D', ['E']]]);
    const result = personalizedPageRank(g, 'S');
    const near = (result.get('S') ?? 0) + (result.get('A') ?? 0);
    const far = (result.get('D') ?? 0) + (result.get('E') ?? 0);
    expect(near).toBeGreaterThan(far);
  });
});