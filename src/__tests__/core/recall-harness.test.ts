/**
 * #729 Phase 3 — the harness that calibrates.
 *
 * These tests pin the measurements the plan depends on, and one limit the plan
 * found the hard way: a single-source candidate pool cannot be diversified by
 * an assembly step, and a harness that counts it blames or credits the layer
 * for something it cannot do.
 */

import { describe, it, expect } from 'vitest';
import {
  rankPages,
  scoreFixture,
  runHarness,
  calibrateFieldWeights,
  type Fixture,
  type SourcedPage,
} from '../../core/recall-harness';
import {
  buildPageTerms,
  buildCorpusTerms,
  DEFAULT_FIELD_WEIGHTS,
} from '../../core/term-index';

function page(path: string, title: string, opts: {
  aliases?: string[]; summary?: string; sourceSlug?: string;
} = {}): SourcedPage {
  return {
    path,
    title,
    aliases: opts.aliases ?? [],
    summary: opts.summary ?? '',
    ...(opts.sourceSlug ? { sourceSlug: opts.sourceSlug } : {}),
  };
}

function prepared(pages: SourcedPage[]) {
  const pageTerms = pages.map(p => buildPageTerms({
    title: p.title, aliases: p.aliases, summary: p.summary ?? '', text: '',
  }));
  return { pageTerms, corpus: buildCorpusTerms(pageTerms) };
}

describe('rankPages', () => {
  it('ranks by score descending and numbers ranks from 1', () => {
    const pages = [
      page('a', 'beta', { summary: 'beta beta' }),
      page('b', 'alpha', { summary: 'alpha' }),
    ];
    const { pageTerms, corpus } = prepared(pages);
    const ranked = rankPages('alpha', pages, pageTerms, corpus, DEFAULT_FIELD_WEIGHTS, ['alpha']);
    expect(ranked.map(r => r.page.path)).toEqual(['b']);
    expect(ranked[0].rank).toBe(1);
  });

  it('excludes pages with no match — zero is not a rank', () => {
    const pages = [page('a', 'alpha'), page('b', 'unrelated')];
    const { pageTerms, corpus } = prepared(pages);
    const ranked = rankPages('alpha', pages, pageTerms, corpus, DEFAULT_FIELD_WEIGHTS, ['alpha']);
    expect(ranked.map(r => r.page.path)).toEqual(['a']);
  });

  it('is deterministic on equal scores — path ascending', () => {
    const pages = [page('z', 'alpha'), page('a', 'alpha')];
    const { pageTerms, corpus } = prepared(pages);
    const r1 = rankPages('alpha', pages, pageTerms, corpus, DEFAULT_FIELD_WEIGHTS, ['alpha']);
    const r2 = rankPages('alpha', [...pages].reverse(), pageTerms, corpus, DEFAULT_FIELD_WEIGHTS, ['alpha']);
    expect(r1.map(r => r.page.path)).toEqual(['a', 'z']);
    expect(r2.map(r => r.page.path)).toEqual(r1.map(r => r.page.path));
  });
});

describe('scoreFixture — the metrics', () => {
  const pool = [
    page('s1/a', 'Alpha', { sourceSlug: 'paper-1' }),
    page('s1/b', 'Alpha methods', { sourceSlug: 'paper-1' }),
    page('s2/c', 'Alpha theory', { sourceSlug: 'paper-2' }),
  ];

  it('recall@K is hits over the relevant set', () => {
    const fixture: Fixture = { id: 'f', query: 'alpha', relevant: ['s1/a', 's2/c'], regime: 'latin' };
    const ranked = [
      { page: pool[0], score: 3, rank: 1 },
      { page: pool[1], score: 2, rank: 2 },
      { page: pool[2], score: 1, rank: 3 },
    ];
    const r = scoreFixture(fixture, ranked, pool, 10);
    expect(r.recallAtK).toBe(1);
    expect(r.reciprocalRank).toBe(1);
  });

  it('recall@K is a fraction when only some relevant pages make the cut', () => {
    const fixture: Fixture = { id: 'f', query: 'alpha', relevant: ['s1/a', 's2/c', 'missing'], regime: 'latin' };
    const ranked = [{ page: pool[0], score: 3, rank: 1 }];
    const r = scoreFixture(fixture, ranked, pool, 10);
    expect(r.recallAtK).toBeCloseTo(1 / 3);
    expect(r.reciprocalRank).toBe(1);
  });

  it('reciprocal rank is 1/rank of the first hit, 0 when there is none', () => {
    const fixture: Fixture = { id: 'f', query: 'alpha', relevant: ['s2/c'], regime: 'latin' };
    const ranked = [
      { page: pool[0], score: 3, rank: 1 },
      { page: pool[2], score: 1, rank: 2 },
    ];
    expect(scoreFixture(fixture, ranked, pool, 10).reciprocalRank).toBe(0.5);
    const miss: Fixture = { id: 'f', query: 'alpha', relevant: ['nope'], regime: 'latin' };
    expect(scoreFixture(miss, ranked, pool, 10).reciprocalRank).toBe(0);
  });

  it('counts distinct sources loaded against distinct sources available', () => {
    const fixture: Fixture = { id: 'f', query: 'alpha', relevant: [], regime: 'latin' };
    // All three pages rank, so the candidate window holds both papers. What
    // loads is top-K; what was available is the window.
    const ranked = [
      { page: pool[0], score: 3, rank: 1 },
      { page: pool[1], score: 2, rank: 2 },
      { page: pool[2], score: 1, rank: 3 },
    ];
    const r = scoreFixture(fixture, ranked, pool, 10);
    expect(r.retrievedSources).toBe(2);
    expect(r.poolSources).toBe(2);
    expect(r.dominantSourceShare).toBeCloseTo(2 / 3);
  });

  it('a window cut before a second source loads sees only one source', () => {
    // The plan's other limit, in miniature: when the window itself is
    // single-source, no assembly step can diversify it. K=2 here is the cut.
    const fixture: Fixture = { id: 'f', query: 'alpha', relevant: [], regime: 'latin' };
    const ranked = [
      { page: pool[0], score: 3, rank: 1 },
      { page: pool[1], score: 2, rank: 2 },
      { page: pool[2], score: 1, rank: 3 },
    ];
    const r = scoreFixture(fixture, ranked, pool, 2, 2);
    expect(r.poolSources).toBe(1);
    expect(r.retrievedSources).toBe(1);
    expect(r.dominantSourceShare).toBe(1);
  });

  it('reports pages with no source ref — the assembly layer is blind to these', () => {
    const bare = page('x/a', 'Alpha');
    const fixture: Fixture = { id: 'f', query: 'alpha', relevant: [], regime: 'latin' };
    const ranked = [{ page: bare, score: 1, rank: 1 }];
    const r = scoreFixture(fixture, ranked, [bare], 10);
    expect(r.unattributedCount).toBe(1);
    expect(r.retrievedSources).toBe(0);
    expect(r.poolSources).toBe(0);
    expect(r.dominantSourceShare).toBe(0);
  });

  it('honours K — a relevant page past the cutoff does not count', () => {
    const fixture: Fixture = { id: 'f', query: 'alpha', relevant: ['s2/c'], regime: 'latin' };
    const ranked = [
      { page: pool[0], score: 3, rank: 1 },
      { page: pool[2], score: 1, rank: 2 },
    ];
    expect(scoreFixture(fixture, ranked, pool, 1).recallAtK).toBe(0);
  });
});

describe('runHarness — aggregation and the limits it must not hide', () => {
  it('separates a single-source pool from the cross-source gain window', () => {
    // The plan's limit, found on a real vault: one of six questions had a
    // single-source pool, where no assembly step can diversify anything.
    // Counting it would credit or blame the layer for something it cannot do.
    const multi = [
      page('p1/a', 'Alpha', { sourceSlug: 'paper-1' }),
      page('p2/b', 'Alpha', { sourceSlug: 'paper-2' }),
    ];
    const single = [
      page('q1/c', 'Beta', { sourceSlug: 'only' }),
      page('q1/d', 'Beta again', { sourceSlug: 'only' }),
    ];
    const pages = [...multi, ...single];
    const fixtures: Fixture[] = [
      { id: 'multi', query: 'alpha', relevant: ['p1/a'], regime: 'latin' },
      { id: 'single', query: 'beta', relevant: ['q1/c'], regime: 'latin' },
    ];
    const terms = new Map([['multi', ['alpha']], ['single', ['beta']]]);
    const report = runHarness(fixtures, pages, terms, { k: 10 });
    expect(report.singleSourcePoolCount).toBe(1);
    expect(report.meanPoolSources).toBeCloseTo(1.5);
    // The gain window only averages the multi-source fixture, and there the
    // window held both papers so the loaded set spans 2 sources.
    expect(report.meanCrossSourceGainWindow).toBeCloseTo(2);
  });

  it('counts a fixture whose top score is shared as a tie', () => {
    const pages = [page('a', 'Alpha'), page('b', 'Alpha')];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: [], regime: 'latin' }];
    const terms = new Map([['f', ['alpha']]]);
    const report = runHarness(fixtures, pages, terms, { k: 10 });
    expect(report.tieCount).toBe(1);
  });

  it('reports zero rather than NaN when there are no fixtures', () => {
    const report = runHarness([], [], new Map(), { k: 10 });
    expect(report.meanRecallAtK).toBe(0);
    expect(report.meanReciprocalRank).toBe(0);
    expect(report.singleSourcePoolCount).toBe(0);
    expect(report.tieCount).toBe(0);
  });

  it('is deterministic — the same fixtures give the same report', () => {
    const pages = [page('a', 'Alpha', { summary: 'alpha' }), page('b', 'Beta')];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: ['a'], regime: 'latin' }];
    const terms = new Map([['f', ['alpha']]]);
    const r1 = runHarness(fixtures, pages, terms, { k: 10 });
    const r2 = runHarness(fixtures, pages, terms, { k: 10 });
    expect(r1).toEqual(r2);
  });
});

describe('calibrateFieldWeights', () => {
  it('returns the whole surface, not just a winner', () => {
    // A single number would hide how flat the answer is. The plan's own
    // measurement says the title weight is the difference between MRR 0.86 and
    // 0.55 — that is only visible if the surface is returned.
    const pages = [
      page('a', 'Alpha', { summary: 'nothing here' }),
      page('b', 'Nothing', { summary: 'alpha alpha' }),
    ];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: ['a'], regime: 'latin' }];
    const terms = new Map([['f', ['alpha']]]);
    const result = calibrateFieldWeights(fixtures, pages, terms, {
      values: [0, 1, 3], k: 10,
    });
    expect(result.surface.length).toBe(27);
    expect(result.surface[0].meanReciprocalRank).toBeGreaterThanOrEqual(result.baseline.meanReciprocalRank);
    expect(result.baseline.weights).toEqual(DEFAULT_FIELD_WEIGHTS);
  });

  it('surfaces a title-heavy answer when the fixture set rewards it', () => {
    const pages = [
      page('a', 'Alpha', { summary: 'noise' }),
      page('b', 'Noise', { summary: 'alpha' }),
    ];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: ['a'], regime: 'latin' }];
    const terms = new Map([['f', ['alpha']]]);
    const result = calibrateFieldWeights(fixtures, pages, terms, {
      values: [0, 1, 3], k: 10,
    });
    expect(result.best.weights.title).toBeGreaterThanOrEqual(result.best.weights.summary);
    expect(result.best.meanReciprocalRank).toBe(1);
  });

  it('is deterministic', () => {
    const pages = [page('a', 'Alpha')];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: ['a'], regime: 'latin' }];
    const terms = new Map([['f', ['alpha']]]);
    const r1 = calibrateFieldWeights(fixtures, pages, terms, { values: [0, 1], k: 10 });
    const r2 = calibrateFieldWeights(fixtures, pages, terms, { values: [0, 1], k: 10 });
    expect(r1.best).toEqual(r2.best);
  });
});

describe('the regimes the plan requires are representable', () => {
  // The harness reports a regime per fixture; it must not branch on it. These
  // assert that a fixture set can carry all of them and cross-lingual pairs.
  it('accepts every regime and a cross-lingual pair without branching', () => {
    const regimes: Fixture['regime'][] = ['latin', 'han', 'kana', 'hangul', 'cross-lingual'];
    for (const regime of regimes) {
      const f: Fixture = {
        id: regime, query: 'x', relevant: [], regime,
        sourceLanguage: 'en', queryLanguage: 'zh',
      };
      expect(f.regime).toBe(regime);
      expect(f.sourceLanguage).not.toBe(f.queryLanguage);
    }
  });
});
