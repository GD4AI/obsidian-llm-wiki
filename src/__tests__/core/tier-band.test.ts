/**
 * TIER SEMANTICS — what the band is a promise OF.
 *
 * DocTpoint found this by reading the code against its own comment
 * (#837, 2026-10-13). `mergeWithPPR` labelled tier 0 as "the seeds the LLM
 * stage paid for and their neighbourhood" while the code put EVERY page PPR
 * reached into tier 0. On a 2,829-page vault the walks reach 1,925 pages per
 * query, so with a budget of 10 the lex-only tier is served 0.00 times on both
 * bridge and cross-source sets. The band did not separate paid seeds from
 * keyword hits; it separated pages the graph can reach from pages it cannot —
 * and a page it cannot reach is never returned however well it matches. Those
 * are the orphans, the new pages and the stubs: exactly the pages a reader most
 * needs surfaced.
 *
 * The fix is the comment's own words made true:
 *   tier 0  the seeds this query paid for (LLM seeds, or the lex-derived seeds
 *           the arm used). A promise to the caller that a paid seed is served.
 *   tier 1  everything else — PPR neighbourhood AND lex-only hits compete on
 *           score. A lexical match PPR cannot reach is no longer locked out.
 *
 * Two properties, one test each:
 *   1. A paid seed cannot be displaced from the result by pages PPR reached.
 *   2. A lexically-perfect page that PPR cannot reach IS returnable.
 */
import { describe, it, expect } from 'vitest';
import { pprCascade, type PageRef, type Graph } from '../../core/ppr-cascade';

function buildGraph(paths: string[], edges: Array<[string, string]> = []): Graph {
  const m = new Map<string, string[]>();
  for (const p of paths) m.set(p, []);
  for (const [from, to] of edges) {
    const existing = m.get(from) ?? [];
    existing.push(to);
    m.set(from, existing);
  }
  return { nodes: paths, edges: m };
}

describe('tier band — a promise about paid seeds, not about graph reach', () => {
  it('a page PPR cannot reach is still returned when it matches lexically', () => {
    // `orphan` carries the query in its TITLE and has no edges at all. Before
    // the fix it landed in tier 1 while every PPR-reached page sat in tier 0,
    // and a budget of 10 never served tier 1 — so the best lexical match in the
    // vault was dropped for a page the walk happened to pass through.
    const pages: PageRef[] = [
      { path: 'seed', title: 'quantum', aliases: [], summary: 'a seed' },
      // 30 pages the walk reaches. They match nothing but fill tier 0.
      ...Array.from({ length: 30 }, (_, i) => ({
        path: `reached${String(i).padStart(2, '0')}`,
        title: `filler ${i}`,
        aliases: [],
        summary: 'unrelated prose',
      })),
      // The best lexical match, and unreachable: no edges in either direction.
      { path: 'orphan', title: 'quantum', aliases: [], summary: 'perfect match' },
    ];
    // Hub graph: seed links to every reached page. `orphan` has none.
    const graph = buildGraph(
      ['seed', 'orphan', ...Array.from({ length: 30 }, (_, i) => `reached${String(i).padStart(2, '0')}`)],
      Array.from({ length: 30 }, (_, i) => ['seed', `reached${String(i).padStart(2, '0')}`] as [string, string]),
    );

    const res = pprCascade('quantum', pages, {
      graph,
      topN: 10,
      seeds: ['seed'],
    });
    const got = res.map(m => m.page.path);

    expect(got).toContain('orphan');
  });

  it('a paid seed is served before any neighbour the walk found', () => {
    // The band's reason to exist: without it a lex rank-1 and a PPR rank-1 tie
    // at 1/(60+1) and the seed the LLM stage paid for vanishes. The seed must
    // be in the result even when 40 neighbours crowd the walk.
    const pages: PageRef[] = [
      // The seed matches NOTHING lexically — it is here because it was paid for.
      { path: 'paidSeed', title: 'zzz unrelated', aliases: [], summary: 'nothing' },
      ...Array.from({ length: 40 }, (_, i) => ({
        path: `neighbour${String(i).padStart(2, '0')}`,
        title: `topic ${i}`,
        aliases: [],
        summary: 'topic words here',
      })),
    ];
    const graph = buildGraph(
      ['paidSeed', ...Array.from({ length: 40 }, (_, i) => `neighbour${String(i).padStart(2, '0')}`)],
      Array.from({ length: 40 }, (_, i) => ['paidSeed', `neighbour${String(i).padStart(2, '0')}`] as [string, string]),
    );

    const res = pprCascade('topic words', pages, {
      graph,
      topN: 10,
      seeds: ['paidSeed'],
    });
    const got = res.map(m => m.page.path);

    expect(got).toContain('paidSeed');
  });
});
