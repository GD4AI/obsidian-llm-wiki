// graph-audit.test.ts — the graph-shape metrics that decide #729's P4.
//
// The four questions the audit answers, in the order the maintainer asked them:
//   1. Is the graph planet-shaped?        (topInDegreeShare)
//   2. Are edges born from the same note? (intraSourceEdgeShare)
//   3. Do the main nodes link each other? (topNodeEdges)
//   4. Can the main nodes reach each other at 2-3 hops, in both directions?
//
// Every number below is computed by hand from the fixture. A test that only
// asserts "the number is between 0 and 1" would pass on a broken metric.

import { describe, it, expect } from 'vitest';
import {
  graphAudit,
  topByInDegree,
  reachableWithin,
  intraSourceEdgeShare,
} from '../../../../tools/dev-instrument/src/graph-audit';
import {
  sourceSlugOf,
  sourceMapOf,
  type VaultPage,
} from '../../../../tools/dev-instrument/src/graph-audit-cli';

type Graph = { nodes: string[]; edges: Map<string, string[]> };

function g(list: Array<[string, string[]]>): Graph {
  return { nodes: list.map(([p]) => p), edges: new Map(list) };
}

/**
 * Fixture, drawn so every metric has a hand-checkable value.
 *
 *   s1 <- a <- s1     (a and b are born from s1; they link s1 and each other's hub)
 *   s1 <- b
 *   s2 <- c, s2 <- d
 *   s3 <- e
 *   plus two cross-note edges: a->c and b->d
 *
 * sources: s1->s1, s2->s2, s3->s3, a->s1, b->s1, c->s2, d->s2, e->s3
 */
const FIXTURE: Graph = g([
  ['a', ['s1', 'c']],
  ['b', ['s1', 'd']],
  ['c', ['s2']],
  ['d', ['s2']],
  ['e', ['s3']],
  ['s1', ['a', 'b']],
  ['s2', ['c', 'd']],
  ['s3', ['e']],
]);

const SOURCE_OF = new Map<string, string[]>([
  ['s1', ['s1']], ['s2', ['s2']], ['s3', ['s3']],
  ['a', ['s1']], ['b', ['s1']], ['c', ['s2']], ['d', ['s2']], ['e', ['s3']],
]);

describe('topByInDegree', () => {
  it('ranks by in-degree and breaks ties by path ascending', () => {
    // in-degree: s1=2 (a,b) · s2=2 (c,d) · s3=1 (e) · a=1 (s1)
    //            b=1 (s1)  · c=2 (s2,a)  · d=2 (s2,b) · e=1 (s3)
    const top = topByInDegree(FIXTURE, 3);
    expect(top.map(t => t.path)).toEqual(['c', 'd', 's1']);
    // c, d, s1 all hold in-degree 2 and sort by path ascending.
    expect(top.map(t => t.inDegree)).toEqual([2, 2, 2]);
  });

  it('is deterministic when the node array order changes', () => {
    const shuffled = g([...FIXTURE.edges].reverse());
    expect(topByInDegree(shuffled, 3)).toEqual(topByInDegree(FIXTURE, 3));
  });

  it('keeps a per-node list for the planet share', () => {
    const all = topByInDegree(FIXTURE, 8);
    expect(all).toHaveLength(8);
    expect(all[0].inDegree).toBeGreaterThanOrEqual(all[7].inDegree);
  });
});

describe('intraSourceEdgeShare', () => {
  it('counts shared-source edges against attributed edges only', () => {
    // 12 edges. Intra: a->s1 b->s1 c->s2 d->s2 e->s3 s1->a s1->b s2->c s2->d s3->e = 10.
    // Cross: a->c and b->d = 2. Unattributed: 0.
    const r = intraSourceEdgeShare(FIXTURE, SOURCE_OF);
    expect(r.intra).toBe(10);
    expect(r.cross).toBe(2);
    expect(r.unattributed).toBe(0);
    expect(r.share).toBeCloseTo(10 / 12, 10);
  });

  it('reports a page with no source as unattributed, not as cross', () => {
    const without = new Map(SOURCE_OF);
    without.delete('e');
    const r = intraSourceEdgeShare(FIXTURE, without);
    // Losing e's source touches both edges that meet e: `e->s3` and `s3->e`.
    // Neither can be attributed, so they are counted apart rather than as
    // cross-source. What remains attributed is 8 intra (a->s1 b->s1 c->s2
    // d->s2 s1->a s1->b s2->c s2->d) and 2 cross (a->c b->d).
    expect(r.unattributed).toBe(2);
    expect(r.intra).toBe(8);
    expect(r.cross).toBe(2);
    expect(r.share).toBeCloseTo(8 / 10, 10);
  });
});

describe('reachableWithin', () => {
  it('follows out-edges only in the directed form', () => {
    // s1 -> a -> c -> s2 -> d. Within 3 hops s1 reaches a, c, s2 (and s1 itself).
    const hit = reachableWithin(FIXTURE, 's1', 3, 'directed');
    expect(hit.has('a')).toBe(true);
    expect(hit.has('c')).toBe(true);
    expect(hit.has('s2')).toBe(true);
    expect(hit.has('e')).toBe(false); // s3/e sit in their own component
  });

  it('follows both directions in the undirected form', () => {
    const hit = reachableWithin(FIXTURE, 's1', 1, 'undirected');
    // s1's neighbours in both directions: a, b (out) — and nothing points back
    // at s1 except a and b, already counted.
    expect(hit.has('a')).toBe(true);
    expect(hit.has('b')).toBe(true);
    expect(hit.has('c')).toBe(false);
  });
});

describe('sourceSlugOf — one source, one identity', () => {
  it('collapses the three spellings a source can carry to one slug', () => {
    expect(sourceSlugOf('sources/n1')).toBe('n1');
    expect(sourceSlugOf('sources/n1.md')).toBe('n1');
    expect(sourceSlugOf('/sources/n1/')).toBe('n1');
  });

  it('keeps the bare name a source page writes about itself', () => {
    expect(sourceSlugOf('n1')).toBe('n1');
  });
});

describe('sourceMapOf — a source page carries its own identity', () => {
  const page = (path: string, fm: string): VaultPage => ({ path, content: `---\n${fm}\n---\nbody` });

  it('gives a source page its own slug even with no frontmatter ref', () => {
    const m = sourceMapOf([page('sources/n1', 'type: source')]);
    expect(m.get('sources/n1')).toEqual(['n1']);
  });

  it('takes an entity page\'s sources from its frontmatter refs', () => {
    const m = sourceMapOf([
      page('entities/a', 'type: entity\nsources:\n  - "[[sources/n1]]"'),
    ]);
    expect(m.get('entities/a')).toEqual(['n1']);
  });

  it('de-duplicates when both spellings name one source', () => {
    const m = sourceMapOf([
      page('entities/a', 'type: entity\nsources:\n  - "[[sources/n1]]"\n  - "sources/n1.md"'),
    ]);
    expect(m.get('entities/a')).toEqual(['n1']);
  });

  it('keeps a merged page as multi-source, which is what makes it a bridge', () => {
    const m = sourceMapOf([
      page('entities/a', 'type: entity\nsources:\n  - "[[sources/n1]]"\n  - "[[sources/n2]]"'),
    ]);
    expect(m.get('entities/a')).toEqual(['n1', 'n2']);
  });

  it('reports a page with no source as empty rather than throwing', () => {
    const m = sourceMapOf([page('entities/a', 'type: entity')]);
    expect(m.get('entities/a')).toEqual([]);
  });
});

describe('graphAudit', () => {
  const r = graphAudit({ graph: FIXTURE, sourceOf: SOURCE_OF });

  it('reports the size', () => {
    expect(r.nodeCount).toBe(8);
    expect(r.edgeCount).toBe(12);
  });

  it('reports the planet share of the top-k by in-degree', () => {
    // in-degree total = 12. Top 3 hold 2+2+2 = 6.
    expect(r.topInDegreeShare).toEqual({ k: 3, share: 0.5 });
  });

  it('reports how many of the top nodes link each other directly', () => {
    // Top 3 = c, d, s1. Ordered pairs = 3*2 = 6.
    // Edges among them: s1->? c? no. d? no. c->s1? no. d->s1? no.
    // c->d? no. d->c? no.  => 0 of 6.
    expect(r.topNodeEdges).toEqual({ k: 3, edgesAmong: 0, possible: 6, density: 0 });
  });

  it('reports how many of the top nodes reach each other within N hops', () => {
    const two = r.topNodeReach.find(x => x.hops === 2)!;
    // Top 3 = c, d, s1. Directed, within 2 hops, self-pairs excluded (6 pairs):
    //   c -> s2 -> d        reaches d  ✓
    //   d -> s2 -> c        reaches c  ✓
    //   c -> s1?  c->s2->c, c->s2->d   no
    //   s1 -> c?  s1->a->c             YES (2 hops)
    //   s1 -> d?  s1->a->c->d / s1->b->d  YES via b->d (2 hops)
    //   d -> s1?  no   c -> s1? no   s1 -> s1 self  d -> d self  c -> c self
    // Ordered non-self pairs that reach: (c,d) (d,c) (s1,c) (s1,d) = 4 of 6.
    expect(two.directed).toBe(4);
    expect(two.pairs).toBe(6);
    // The same row carries the undirected form. Ignoring direction every pair
    // is connected within two hops.
    expect(two.undirected).toBe(6);
  });

  it('reports the share of other-source pages each source reaches', () => {
    const two = r.crossSourceReach.find(x => x.hops === 2)!;
    // Sources: s1, s2, s3. From s1's pages {a,b,s1} within 2 hops (directed):
    //   a -> s1, a -> c -> s2 ; b -> s1, b -> d -> s2 ; s1 -> a, s1 -> b
    //   reached other-source pages: c, d, s2  (3 of the 5 pages not in s1:
    //   c, d, s2, s3, e)  => 3/5
    // From s2's pages {c,d,s2}: c->s2, d->s2, s2->c, s2->d — no cross-source
    //   reach at 2 hops => 0/5
    // From s3's pages {e,s3}: e->s3, s3->e — none => 0/5
    // Mean over sources = (0.6 + 0 + 0) / 3 = 0.2
    expect(two.directed).toBeCloseTo(0.2, 10);
    // Undirected: s1's block reaches c, d, s2 (and via c->a nothing new) = 3/5;
    // s2 reaches a, b, s1 via a->c and b->d = 3/5; s3 reaches e, s3 only = 0/5.
    expect(two.undirected).toBeCloseTo((0.6 + 0.6 + 0) / 3, 10);
  });

  it('is order-independent', () => {
    const shuffled = g([...FIXTURE.edges].reverse());
    const b = graphAudit({ graph: shuffled, sourceOf: SOURCE_OF });
    expect(b.topInDegreeShare).toEqual(r.topInDegreeShare);
    expect(b.topNodeEdges).toEqual(r.topNodeEdges);
    expect(b.intraSourceEdgeShare.share).toBeCloseTo(r.intraSourceEdgeShare.share, 10);
    expect(b.crossSourceReach).toEqual(r.crossSourceReach);
    expect(b.topNodeReach).toEqual(r.topNodeReach);
  });
});
