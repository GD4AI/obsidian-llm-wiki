// Pure-function tests for hub-detection.ts
//
// Contract (from #198 / 2026-06-24, simplified — clustering retirement
// is deferred to v1.24.0 with @DocTpoint):
//
//   detectHubs(graph, options?): Hub[]
//   Hub = { node: string; inDegree: number; totalDegree: number;
//           pprScore?: number; isHub: boolean }
//
//   options:
//     minInDegree?: number (default 2) — minimum in-degree to consider
//     topN?: number       (default 10) — return at most this many
//     pprSeed?: string    (optional) — if provided, run PPR from this
//                         seed and include PPR score in the hub record
//     pprOptions?: PPROptions — pass-through to personalizedPageRank
//
//   Returns hubs sorted by composite score (inDegree + normalized PPR
//   score, equal weight).
//
// Why inDegree + PPR: pure degree count misses context (CAD is a hub
// for ALL cardiology queries, not just "all patients"). PPR score
// from a query seed gives query-time relevance. The composite blends
// the static (degree) and dynamic (PPR) signals.

import { describe, it, expect } from 'vitest';
import { detectHubs, type Graph } from '../../core/hub-detection';
import { makeRng } from '../__support__/rng';

function graph(edges: Array<[string, string[]]>): Graph {
  return {
    nodes: Array.from(new Set(edges.flatMap(([from, tos]) => [from, ...tos]))),
    edges: new Map(edges),
  };
}

describe('detectHubs — the PPR arm is a function, not a lottery', () => {
  // Every test above supplies an `rng`, so the production default was never
  // exercised: `personalizedPageRank` falls back to `Math.random`, and a
  // hub's `pprScore` — and with it the composite score that decides whether
  // the page is a hub — moved on every run. The lint reads that number and
  // can strip a link because of it, so a finding that flickers is a finding
  // that fires at random.
  it('gives the same pprScore for the same graph when the caller supplies no rng', () => {
    const g = graph([
      ['Patient', ['CAD', 'MRI']],
      ['CAD', ['Patient', 'MRI']],
      ['MRI', ['Patient', 'CAD']],
    ]);
    const options = { minInDegree: 1, pprSeed: 'Patient', pprOptions: { numWalks: 200, maxSteps: 30 } };
    const first = detectHubs(g, options);
    const second = detectHubs(g, options);
    expect(first.map(h => h.pprScore)).toEqual(second.map(h => h.pprScore));
  });
});

describe('detectHubs — empty / trivial', () => {
  it('returns empty array for empty graph', () => {
    const g: Graph = { nodes: [], edges: new Map() };
    expect(detectHubs(g)).toEqual([]);
  });

  it('returns empty array when no node meets minInDegree', () => {
    // Each node has at most 1 incoming. With minInDegree=2, no hubs.
    const g = graph([['A', ['B']], ['B', ['C']]]);
    expect(detectHubs(g, { minInDegree: 2 })).toEqual([]);
  });
});

describe('detectHubs — basic in-degree ranking', () => {
  it('identifies hub by high in-degree', () => {
    // A→{B, C, D} — A has in-degree 3, rest have in-degree 0.
    // C is the hub (3 incoming from A, B, D).
    const g = graph([
      ['A', ['C']],
      ['B', ['C']],
      ['D', ['C']],
    ]);
    const result = detectHubs(g, { minInDegree: 2 });
    expect(result.length).toBe(1);
    expect(result[0].node).toBe('C');
    expect(result[0].inDegree).toBe(3);
    expect(result[0].isHub).toBe(true);
  });

  it('returns top-N by composite score', () => {
    // CAD (4 in), MI (2 in), HF (2 in). topN=2 → CAD and (MI or HF).
    const g = graph([
      ['A', ['CAD', 'MI', 'HF']],
      ['B', ['CAD', 'MI']],
      ['C', ['CAD', 'HF']],
      ['D', ['CAD']],
    ]);
    const result = detectHubs(g, { minInDegree: 2, topN: 2 });
    expect(result.length).toBe(2);
    expect(result[0].node).toBe('CAD');
    expect(result[0].inDegree).toBe(4);
  });

  it('hubs sorted by composite score descending', () => {
    // MI=4 in, HF=3 in, AF=2 in.
    const g = graph([
      ['A', ['MI', 'HF', 'AF']],
      ['B', ['MI', 'HF', 'AF']],
      ['C', ['MI', 'HF']],
      ['D', ['MI']],
    ]);
    const result = detectHubs(g, { minInDegree: 2 });
    expect(result[0].node).toBe('MI');
    expect(result[1].node).toBe('HF');
    expect(result[2].node).toBe('AF');
  });
});

describe('detectHubs — with PPR score', () => {
  it('includes PPR score when pprSeed provided', () => {
    const g = graph([
      ['Patient', ['CAD']],
      ['CAD', ['MI', 'HF']],
      ['MI', ['HF']],
    ]);
    const result = detectHubs(g, { minInDegree: 1, pprSeed: 'Patient', pprOptions: { numWalks: 500, maxSteps: 30, rng: makeRng(1) } });
    const cad = result.find(h => h.node === 'CAD');
    expect(cad).toBeDefined();
    expect(cad!.pprScore).toBeGreaterThan(0);
  });

  it('CAD marked as hub when seeded from a Patient leaf (cardiology fixture case)', () => {
    // Simulate the v1.23.0 fixture's hub sub-case. With minInDegree=1,
    // multiple nodes qualify; the composite (inDegree + PPR) determines
    // isHub. We test the isHub flag, not strict ranking, because
    // ranking depends on the composite weighting (inDegree vs PPR).
    const g = graph([
      ['Patient', ['CAD']],
      ['CAD', ['MI', 'HF', 'AF']],
      ['MI', ['HF']],
      ['AF', ['HF']],
    ]);
    const result = detectHubs(g, { minInDegree: 1, pprSeed: 'Patient', pprOptions: { numWalks: 1000, maxSteps: 30, rng: makeRng(2) } });
    const cad = result.find(h => h.node === 'CAD');
    expect(cad).toBeDefined();
    // CAD is the central node from the Patient seed — must be a hub.
    expect(cad!.isHub).toBe(true);
    // CAD has query-time relevance (Patient's only outgoing link).
    expect(cad!.pprScore).toBeGreaterThan(0);
  });
});

describe('detectHubs — isHub flag', () => {
  it('marks a node as hub when composite score above threshold', () => {
    // Default threshold: composite > median of all candidates.
    // CAD has inDegree 5, others have 0/1 — clear hub.
    const g = graph([
      ['A', ['CAD']], ['B', ['CAD']], ['C', ['CAD']], ['D', ['CAD']], ['E', ['CAD']],
      ['CAD', ['MI']],
      ['F', ['MI']],
    ]);
    const result = detectHubs(g, { minInDegree: 1 });
    const cad = result.find(h => h.node === 'CAD');
    expect(cad).toBeDefined();
    expect(cad!.isHub).toBe(true);
  });
});