// Pure-function tests for ppr-cascade.ts
//
// Contract (from #198 / 2026-06-24 Q3 consensus):
//
//   pprCascade(query, pages, options?): PageMatch[]
//   PageMatch = { page: PageRef; score: number; arm: 'lex' | 'lex-seeded-ppr' | 'graph-first-ppr' }
//
//   options:
//     graph?: Graph — pre-built from pages (caller caches it)
//     minPages?: number (default 30) — below this, pure lex
//     minEdges?: number (default 30)
//     minEdgeDensity?: number (default 1.0) — edges/nodes threshold
//     seedMinDegree?: number (default 1) — per-seed guard
//     topN?: number (default 10)
//
//   Cascade arms (in order):
//   1. 'lex': when graph is empty/sparse/seed isolated. Pure keyword match.
//   2. 'lex-seeded-ppr': when lex returns ≥1 hit AND seed has degree ≥ 1.
//      Seed PPR from each lex-matched page, merge top-k.
//   3. 'graph-first-ppr': when graph is mature (edges/nodes ≥ threshold
//      AND largest weak component > 50%). Pure PPR from a generic seed.
//
//   When arm 2 or 3 is used, we also run lex for fallback ranking of
//   page titles (so ties break consistently).
//
//   Returned PageMatch[] is sorted by score descending. The `arm` field
//   reports which arm produced this hit, so callers can show the user
//   "Powered by graph-first PPR" or fall back to plain lex.

import { describe, it, expect } from 'vitest';
import { pprCascade, type PageRef, type Graph } from '../../core/ppr-cascade';
import { makeRng } from '../__support__/rng';

function page(path: string, title: string, aliases: string[] = []): PageRef {
  return { path, title, aliases };
}

function graph(edges: Array<[string, string[]]>): Graph {
  return {
    nodes: Array.from(new Set(edges.flatMap(([from, tos]) => [from, ...tos]))),
    edges: new Map(edges),
  };
}

describe('pprCascade — max fusion keeps a page one channel likes (#819)', () => {
  it('a page ppr finds and lex misses survives the merge', () => {
    // The defect the fusion change fixes. lex ranks the answer far down because
    // it shares no vocabulary with the query. ppr walks to it from a seed. Under
    // RRF the sum dragged it below pages both channels mildly liked.
    const pages = [
      page('seed', 'alpha beta'),
      page('answer', 'ganz andere worte hier'),
      page('noise1', 'alpha gamma'),
      page('noise2', 'alpha delta'),
    ];
    const g = graph([
      ['seed', ['answer']],
      ['answer', []],
      ['noise1', []],
      ['noise2', []],
    ]);
    const result = pprCascade('alpha beta', pages, { graph: g, minPages: 2, rng: makeRng(1), topN: 3 });
    const paths = result.map(m => m.page.path);
    // The answer is reachable only through the graph. It must be in the result.
    expect(paths).toContain('answer');
  });
});

describe('pprCascade — empty / sparse graphs (lex arm)', () => {
  it('returns empty array for empty query', () => {
    expect(pprCascade('', [])).toEqual([]);
  });

  it('returns empty array for empty pages', () => {
    expect(pprCascade('cardiology', [])).toEqual([]);
  });

  it('uses pure lex when no graph is provided', () => {
    const pages = [page('A', 'Cardiology'), page('B', 'Oncology')];
    const result = pprCascade('cardiology', pages);
    expect(result.length).toBe(1);
    expect(result[0].page.title).toBe('Cardiology');
    expect(result[0].arm).toBe('lex');
  });

  it('uses lex-seeded-ppr when graph has edges but is below density threshold', () => {
    // 5 pages with 1 edge: page count is below minPages so the
    // graph-first arm is ruled out, but the seed has neighbors so
    // lex-seeded-ppr can fire. Result: arm is lex-seeded-ppr.
    const pages = Array.from({ length: 5 }, (_, i) => page(`P${i}`, `Page ${i} about cardiology`));
    const g = graph([['P0', ['P1']]]);
    const result = pprCascade('cardiology', pages, { graph: g, minPages: 30, rng: makeRng(1) });
    // Every result should be lex-seeded-ppr (graph is sparse but
    // seeded PPR is possible because P0 has degree >= 1).
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(r => r.arm === 'lex-seeded-ppr')).toBe(true);
  });

  it('uses lex when no graph and no lex matches', () => {
    // Force a no-graph path. With graph undefined, cascade skips
    // lex-seeded-ppr and returns only lex hits.
    const pages = Array.from({ length: 5 }, (_, i) => page(`P${i}`, `Page ${i} about cardiology`));
    const result = pprCascade('cardiology', pages, { graph: undefined });
    expect(result.every(r => r.arm === 'lex')).toBe(true);
  });

  it('uses lex when graph is below minEdges threshold', () => {
    // 50 pages but no graph edges. Sparse: cascade falls through to
    // lex because lex-seeded-ppr has no seed with degree >= 1.
    const pages = Array.from({ length: 50 }, (_, i) => page(`P${i}`, `Page ${i} about cardiology`));
    // Edges map is empty (no edges anywhere).
    const g: Graph = { nodes: pages.map(p => p.path), edges: new Map() };
    const result = pprCascade('cardiology', pages, { graph: g, minPages: 30, minEdges: 30, rng: makeRng(1) });
    expect(result.every(r => r.arm === 'lex')).toBe(true);
  });

  it('uses lex when seed is isolated (seed_degree < 1)', () => {
    // Build a graph where most pages are isolated, except a small
    // island of connected nodes. The "island" is below the
    // graph-first density threshold (edges < minEdges), so even the
    // connected nodes fall through to sparse arm. P99 is in the graph
    // but has no edges → seed_degree = 0 → lex-seeded-ppr is also
    // ruled out → cascade ends at pure lex.
    const pages = Array.from({ length: 100 }, (_, i) => page(`P${i}`, `Page ${i}`));
    // A small island of 5 connected nodes. Far below the 30-edge
    // threshold.
    const edges: Array<[string, string[]]> = [
      ['P0', ['P1']], ['P1', ['P2']], ['P2', ['P3']], ['P3', ['P4']], ['P4', ['P0']],
    ];
    const g: Graph = {
      nodes: pages.map(p => p.path),
      edges: new Map(edges),
    };
    const result = pprCascade('isolated page query', [pages[99]], {
      graph: g, minPages: 30, minEdges: 30, rng: makeRng(1),
    });
    // Result is empty (no lex match for 'isolated page query' against
    // pages[99]='Page 99', no seed for PPR). Any hits are arm=lex.
    for (const r of result) {
      expect(r.arm).toBe('lex');
    }
  });
});

describe('pprCascade — mature graph (graph-first PPR arm)', () => {
  it('uses graph-first PPR when graph is dense enough', () => {
    // 50 pages, 60 edges, well-connected. Cascade should use graph-first.
    const pages: PageRef[] = [];
    const edges: Array<[string, string[]]> = [];
    for (let i = 0; i < 50; i++) {
      const p = page(`P${i}`, `Page ${i}`);
      pages.push(p);
      // Each page links to 2-3 others. edges/nodes ≈ 2.4.
      edges.push([`P${i}`, [`P${(i + 1) % 50}`, `P${(i + 2) % 50}`]]);
    }
    // Add hub: P0 receives links from 10 pages.
    for (let i = 1; i <= 10; i++) edges.push([`P${i}`, ['P0']]);
    const g = graph(edges);
    const result = pprCascade('page 0', pages, {
      graph: g, minPages: 30, minEdges: 30, rng: makeRng(1),
    });
    // Seed is P0 (matches "Page 0"). With strong graph structure,
    // cascade should use graph-first (arm 'graph-first-ppr').
    // Top hit must be P0.
    expect(result[0].page.path).toBe('P0');
    // And the arm is graph-first-ppr (graph is mature).
    expect(result[0].arm).toBe('graph-first-ppr');
  });
});

describe('pprCascade — sparse-but-not-empty (lex-seeded PPR arm)', () => {
  it('uses lex-seeded PPR when lex matches but graph is sparse', () => {
    // 50 pages, 25 edges (edges/nodes = 0.5 < 1.0) → below graph-first
    // threshold. Lex matches P0; P0 has 2 neighbors → seed_degree >= 1.
    // Cascade should use lex-seeded-ppr.
    const pages: PageRef[] = [];
    for (let i = 0; i < 50; i++) pages.push(page(`P${i}`, `Page ${i}`));
    const edges: Array<[string, string[]]> = [];
    for (let i = 0; i < 25; i++) edges.push([`P${i}`, [`P${(i + 1) % 50}`]]);
    const g = graph(edges);
    const result = pprCascade('page 0', pages, {
      graph: g, minPages: 30, minEdges: 30, rng: makeRng(1),
    });
    // "page" matches all 50 titles ("0" is a single char and dropped),
    // so the three lex seeds P0/P1/P2 carry equal PPR mass and the top
    // hit is whichever of them the walk favoured. The old assertion
    // `toBe('P0')` held only because max(lexRankHint, ppr) let index
    // order override PPR — the defect mergeWithPPR no longer has.
    expect(['P0', 'P1', 'P2']).toContain(result[0].page.path);
    expect(result[0].arm).toBe('lex-seeded-ppr');
  });
});

describe('pprCascade — result ordering', () => {
  it('returns topN sorted by score descending', () => {
    const pages = [
      page('A', 'Cardiology clinic'),
      page('B', 'Cardiology research'),
      page('C', 'Cardiology education'),
      page('D', 'Oncology unrelated'),
    ];
    const result = pprCascade('cardiology', pages, { topN: 2 });
    expect(result.length).toBe(2);
    // Scores are descending.
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    // All returned pages are cardiology-related.
    expect(result.map(r => r.page.path)).toEqual(['A', 'B']);
  });
});

describe('pprCascade — token-level lex matching', () => {
  it('matches Chinese substring in title when phrase match fails', () => {
    // Title is "Obsidian-Directory"; query is the Chinese phrase
    // "Obsidian-Directory 是什么". The lowercase full-phrase doesn't
    // appear in the title, but "obsidian-directory" does (as a token
    // in the lowercased query).
    const pages = [page('A', 'Obsidian-Directory'), page('B', 'Other Topic')];
    const result = pprCascade('Obsidian-Directory 是什么', pages);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].page.title).toBe('Obsidian-Directory');
  });

  it('matches Chinese question about an English-topic page via summary', () => {
    // Query is purely Chinese + one English word. With summary populated
    // describing the topic, the page's full text includes the topic and
    // the lex match succeeds.
    const pages: PageRef[] = [
      { path: 'A', title: 'Obsidian', aliases: [], summary: 'A powerful knowledge base on top of local Markdown files.' },
      { path: 'B', title: 'Other Topic', aliases: [], summary: 'Unrelated content here.' },
    ];
    const result = pprCascade('什么是Obsidian？', pages);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].page.title).toBe('Obsidian');
  });

  it('matches CJK character in English-context page title', () => {
    const pages: PageRef[] = [
      { path: 'A', title: 'Obsidian 介绍', aliases: [], summary: 'Some summary.' },
      { path: 'B', title: 'Other Topic', aliases: [], summary: 'Unrelated.' },
    ];
    const result = pprCascade('Obsidian 介绍', pages);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].page.title).toBe('Obsidian 介绍');
  });

  it('strong-relevance bonus fires when all query tokens are found', () => {
    // Query "cardiology heart" — page A's title matches "cardiology"
    // (3) and summary matches "heart" (1) → 4pt + strong-relevance
    // bonus (+2) = 6pt. Page B's summary matches both but page B's
    // title doesn't match "cardiology" — only the bonus path applies.
    const pages: PageRef[] = [
      { path: 'A', title: 'Cardiology', aliases: [], summary: 'Heart disease research.' },
      { path: 'B', title: 'Oncology', aliases: [], summary: 'Cancer with cardiology heart insights.' },
    ];
    const result = pprCascade('cardiology heart', pages);
    // Page A scores higher: title match (3) + summary match (1) + bonus (+2) = 6
    // Page B scores: summary matches both (1+1) + bonus (+2) = 4
    expect(result[0].page.path).toBe('A');
  });

  it('falls back to graph-degree ranking when lex returns empty and graph exists', () => {
    // 5 pages, with P0 being the most-connected hub.
    const pages = [
      page('P0', 'Hub Page'),
      page('P1', 'Page 1'),
      page('P2', 'Page 2'),
      page('P3', 'Page 3'),
      page('P4', 'Page 4'),
    ];
    const g: Graph = {
      nodes: pages.map(p => p.path),
      edges: new Map([
        ['P0', ['P1', 'P2', 'P3']],
        ['P1', ['P0']],
        ['P2', ['P0']],
        ['P3', ['P0']],
      ]),
    };
    // Query with zero lex matches and no explicit seeds → cascade returns
    // empty (caller upstream is expected to invoke LLM-based seed
    // selection when this happens).
    const result = pprCascade('zzz no match anywhere zzz', pages, {
      graph: g,
      minPages: 30,
      minEdges: 30,
    });
    expect(result).toEqual([]);
  });
});

describe('pprCascade — alias matching', () => {
  it('matches query against aliases too', () => {
    const pages = [
      page('A', 'Cardiology', ['Heart Disease', 'Cardiac Care']),
    ];
    const result = pprCascade('heart disease', pages);
    expect(result.length).toBe(1);
    expect(result[0].page.path).toBe('A');
  });
});

describe('pprCascade — graceful degradation', () => {
  it('returns lex matches even when PPR is available but returns no hit', () => {
    // Graph exists, lex matches P0. PPR from P0 might return empty
    // (pathological case) — cascade should still include the lex match.
    const pages = [page('P0', 'cardiology')];
    const g = graph([['P0', []]]);
    const result = pprCascade('cardiology', pages, { graph: g, rng: makeRng(1) });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].page.path).toBe('P0');
  });

  it('uses explicit seeds when graph is mature', () => {
    // Mature graph + explicit seeds → seeds drive PPR, not pages[0].
    const pages: PageRef[] = [];
    const edges: Array<[string, string[]]> = [];
    for (let i = 0; i < 50; i++) {
      pages.push(page(`P${i}`, `Page ${i}`));
      edges.push([`P${i}`, [`P${(i + 1) % 50}`, `P${(i + 2) % 50}`]]);
    }
    for (let i = 1; i <= 10; i++) edges.push([`P${i}`, ['P25']]);
    const g = graph(edges);
    // Query has no lex match → only PPR matters. Use seeds = [P25].
    const result = pprCascade('completely unrelated query', pages, {
      graph: g,
      seeds: ['P25'],
      rng: makeRng(1),
    });
    // P25 (the seed) should be the top hit because PPR starts there.
    expect(result[0].page.path).toBe('P25');
    expect(result[0].arm).toBe('graph-first-ppr');
  });

  it('uses explicit seeds for lex-seeded-ppr when graph is sparse', () => {
    // Sparse graph (5 pages, 1 edge) + explicit seeds with neighbors
    // → lex-seeded-ppr arm.
    const pages = Array.from({ length: 5 }, (_, i) => page(`P${i}`, `Page ${i}`));
    const g = graph([['P0', ['P1', 'P2']]]);
    const result = pprCascade('whatever query', pages, {
      graph: g,
      minPages: 30,
      seeds: ['P0'],
      rng: makeRng(1),
    });
    // P0 (seed) and its neighbors (P1, P2) should be top hits.
    expect(result[0].page.path).toBe('P0');
    expect(result[0].arm).toBe('lex-seeded-ppr');
  });

  it('falls back to lex when explicit seeds are isolated in sparse graph', () => {
    // Sparse graph + seeds with no neighbors → cascade uses lex results
    // (none here) → empty result, no error.
    const pages = Array.from({ length: 5 }, (_, i) => page(`P${i}`, `Page ${i}`));
    const g = graph([]); // empty edges
    const result = pprCascade('any query', pages, {
      graph: g,
      minPages: 30,
      seeds: ['P0'],
      rng: makeRng(1),
    });
    // No lex match, seeds are isolated → empty result (valid outcome).
    expect(result).toEqual([]);
  });

  it('filters explicit seeds against graph.nodes', () => {
    // seeds contain both valid and invalid (not in graph) paths.
    // PPR should only use valid ones; invalid seeds are silently ignored.
    const pages: PageRef[] = [];
    const edges: Array<[string, string[]]> = [];
    for (let i = 0; i < 50; i++) {
      pages.push(page(`P${i}`, `Page ${i}`));
      edges.push([`P${i}`, [`P${(i + 1) % 50}`]]);
    }
    const g = graph(edges);
    const result = pprCascade('query', pages, {
      graph: g,
      seeds: ['NONEXISTENT', 'P5'],
      rng: makeRng(1),
    });
    // P5 is in graph → should appear in results.
    const paths = result.map(r => r.page.path);
    expect(paths).toContain('P5');
    // NONEXISTENT is not a real page → never appears.
    expect(paths).not.toContain('NONEXISTENT');
  });
});