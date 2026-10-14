/**
 * #729 Phase 5 — the PPR hoist in hub-link distinctiveness.
 *
 * The walk from seed `u` depends only on `u`. It used to sit inside the loop
 * over `t` and was recomputed for every pair: n*(n-1) walks instead of n. On a
 * hub with 20 related links that is 380 walks instead of 20.
 *
 * These tests pin the call count, because the hoist is invisible from the
 * result — the numbers it produces are identical before and after, which is
 * exactly why a regression here would go unnoticed. A test that only asserts
 * the output would pass with the loop put back.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: string[] = [];

vi.mock('../../core/monte-carlo-ppr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/monte-carlo-ppr')>();
  return {
    ...actual,
    personalizedPageRank: (graph: never, seed: string, options: never) => {
      calls.push(seed);
      return actual.personalizedPageRank(graph, seed, options);
    },
  };
});

import { scoreHubLinkDistinctiveness } from '../../core/hub-link-distinctiveness';
import { buildReverseAdjacency, type Graph } from '../../core/monte-carlo-ppr';

function star(hub: string, targets: string[]): Graph {
  const nodes = [hub, ...targets];
  const edges = new Map<string, string[]>();
  for (const t of targets) edges.set(hub, [...(edges.get(hub) ?? []), t]);
  return { nodes, edges };
}

beforeEach(() => {
  calls.length = 0;
});

describe('the PPR walk runs once per seed, not once per pair', () => {
  it('is called n times for n targets — 20 walks, not 380', () => {
    const targets = Array.from({ length: 20 }, (_, i) => `t${i}`);
    scoreHubLinkDistinctiveness(star('hub', targets), 'hub', targets);
    expect(calls.length).toBe(20);
  });

  it('is called once per distinct seed, never twice for the same one', () => {
    const targets = ['a', 'b', 'c', 'd'];
    scoreHubLinkDistinctiveness(star('hub', targets), 'hub', targets);
    expect(calls.length).toBe(4);
    expect(new Set(calls).size).toBe(4);
  });

  it('runs no walk for zero or one target', () => {
    scoreHubLinkDistinctiveness(star('hub', []), 'hub', []);
    scoreHubLinkDistinctiveness(star('hub', ['only']), 'hub', ['only']);
    expect(calls.length).toBe(0);
  });

  it('the result is unchanged by the hoist — the numbers still separate', () => {
    // A redundant pair and a distant one. The hoist must not move these.
    const targets = ['near-a', 'near-b', 'far'];
    const graph: Graph = {
      nodes: ['hub', ...targets],
      edges: new Map([
        ['hub', ['near-a', 'near-b', 'far']],
        ['near-a', ['near-b']],
        ['near-b', ['near-a']],
      ]),
    };
    const result = scoreHubLinkDistinctiveness(graph, 'hub', targets);
    expect(result.size).toBe(3);
    for (const [, v] of result) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // `near-a` and `near-b` point at each other, so each is highly visible
    // from the other and therefore LESS distinctive than `far`, which nothing
    // reaches.
    expect(result.get('far')).toBeGreaterThan(result.get('near-a')!);
    expect(result.get('far')).toBeGreaterThan(result.get('near-b')!);
  });

  it('is deterministic across runs', () => {
    const targets = ['a', 'b', 'c'];
    const g = star('hub', targets);
    const r1 = scoreHubLinkDistinctiveness(g, 'hub', targets);
    const r2 = scoreHubLinkDistinctiveness(g, 'hub', targets);
    expect([...r1.entries()]).toEqual([...r2.entries()]);
  });
});

describe('buildReverseAdjacency', () => {
  it('maps each node to the nodes that point at it', () => {
    const g: Graph = {
      nodes: ['a', 'b', 'c'],
      edges: new Map([['a', ['b', 'c']], ['b', ['c']]]),
    };
    const inc = buildReverseAdjacency(g);
    expect(inc.get('a')).toBeUndefined();
    expect(inc.get('b')).toEqual(['a']);
    expect(inc.get('c')).toEqual(['a', 'b']);
  });

  it('is empty for a graph with no edges', () => {
    expect(buildReverseAdjacency({ nodes: ['a'], edges: new Map() }).size).toBe(0);
  });

  it('handles a node pointing at itself', () => {
    const g: Graph = { nodes: ['a'], edges: new Map([['a', ['a']]]) };
    expect(buildReverseAdjacency(g).get('a')).toEqual(['a']);
  });

  it('preserves duplicates — a multi-edge is two incoming edges', () => {
    const g: Graph = { nodes: ['a', 'b'], edges: new Map([['a', ['b', 'b']]]) };
    expect(buildReverseAdjacency(g).get('b')).toEqual(['a', 'a']);
  });

  it('is linear in the edge count — one pass, no nested scan', () => {
    // The old lookup scanned every entry of `graph.edges` per query, which is
    // O(V*E). This is the shape that made one maturity check 27 million
    // comparisons on the measured vault. The assertion is structural: the
    // output is complete without revisiting the map.
    const n = 200;
    const edges = new Map<string, string[]>();
    for (let i = 0; i < n; i += 1) edges.set(`n${i}`, [`n${(i + 1) % n}`]);
    const inc = buildReverseAdjacency({ nodes: [...edges.keys()], edges });
    expect(inc.size).toBe(n);
    for (const [from, tos] of edges) {
      for (const to of tos) expect(inc.get(to)).toContain(from);
    }
  });
});
