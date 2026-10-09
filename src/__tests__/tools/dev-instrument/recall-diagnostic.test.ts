/**
 * #729 Phase 3 — the diagnostic.
 *
 * These pin the numbers a community member gets from their own vault, and one
 * rule that keeps those numbers honest: rank inversions need ground truth, so
 * they cannot be reported on a real vault and a caller must say so rather than
 * print zeros that read like a clean result.
 */

import { describe, it, expect } from 'vitest';
import {
  dfTail,
  poolReport,
  rankInversions,
  escalationReport,
  prepare,
  type DiagnosticPage,
} from '../../../../tools/dev-instrument/src/recall-diagnostic';
import { builtInFixtures } from '../../../core/recall-fixtures';
import type { Fixture, SourcedPage } from '../../../core/recall-harness';

function dp(path: string, title: string, opts: {
  summary?: string; body?: string; aliases?: string[]; sourceSlug?: string;
} = {}): DiagnosticPage {
  return {
    path,
    title,
    aliases: opts.aliases ?? [],
    summary: opts.summary ?? '',
    body: opts.body ?? '',
    ...(opts.sourceSlug ? { sourceSlug: opts.sourceSlug } : {}),
  };
}

describe('dfTail', () => {
  it('reports the corpus size and the term count', () => {
    const pages = [
      dp('a', 'Alpha', { summary: 'alpha beta' }),
      dp('b', 'Beta', { summary: 'beta gamma' }),
    ];
    const r = dfTail(pages);
    expect(r.docCount).toBe(2);
    expect(r.termCount).toBeGreaterThan(2);
  });

  it('puts a term in every document at df 1 — the top of the tail', () => {
    const pages = [
      dp('a', 'Shared', { summary: 'shared alpha' }),
      dp('b', 'Shared', { summary: 'shared beta' }),
      dp('c', 'Shared', { summary: 'shared gamma' }),
    ];
    const r = dfTail(pages);
    expect(r.highDfTerms[0].term).toBe('shared');
    expect(r.highDfTerms[0].df).toBe(1);
  });

  it('counts hapax terms — the rare tail the plan wants to see', () => {
    const pages = [
      dp('a', 'Alpha', { summary: 'alpha uniquea' }),
      dp('b', 'Beta', { summary: 'beta uniqueb' }),
    ];
    const r = dfTail(pages);
    // `uniquea` and `uniqueb` appear once each. Titles and summaries both feed
    // the table, so this is a floor rather than an exact count.
    expect(r.hapaxCount).toBeGreaterThanOrEqual(2);
  });

  it('reports the share of pages with no source ref — the assembly blind spot', () => {
    const pages = [
      dp('a', 'Alpha', { sourceSlug: 's1' }),
      dp('b', 'Beta'),
      dp('c', 'Gamma'),
    ];
    expect(dfTail(pages).unattributedShare).toBeCloseTo(2 / 3);
  });

  it('reports zero rather than NaN on an empty corpus', () => {
    const r = dfTail([]);
    expect(r.docCount).toBe(0);
    expect(r.termCount).toBe(0);
    expect(r.unattributedShare).toBe(0);
  });
});

describe('poolReport — the issue own symptom, measured', () => {
  it('reports the window sources against what loaded', () => {
    const { pages, fixtures, queryTerms } = builtInFixtures();
    const reports = poolReport(fixtures, pages, queryTerms, { k: 10, poolK: 50 });
    expect(reports.length).toBe(fixtures.length);
    for (const r of reports) {
      expect(r.loadedSources).toBeLessThanOrEqual(r.poolSources);
      expect(r.singleSourceWindow).toBe(r.poolSources <= 1);
    }
  });

  it('flags a single-source window — assembly cannot diversify it', () => {
    const pages: SourcedPage[] = [
      { path: 'q/a', title: 'Alpha', aliases: [], summary: 'alpha', sourceSlug: 'only' },
      { path: 'q/b', title: 'Alpha two', aliases: [], summary: 'alpha', sourceSlug: 'only' },
    ];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: [], regime: 'latin' }];
    const terms = new Map([['f', ['alpha']]]);
    const [r] = poolReport(fixtures, pages, terms, { k: 10, poolK: 50 });
    expect(r.singleSourceWindow).toBe(true);
    expect(r.poolSources).toBe(1);
  });

  it('a window cut below the second source reads as single-source', () => {
    const pages: SourcedPage[] = [
      { path: 'q/a', title: 'Alpha', aliases: [], summary: 'alpha alpha alpha', sourceSlug: 's1' },
      { path: 'q/b', title: 'Alpha', aliases: [], summary: 'alpha', sourceSlug: 's2' },
    ];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: [], regime: 'latin' }];
    const terms = new Map([['f', ['alpha']]]);
    const [r] = poolReport(fixtures, pages, terms, { k: 10, poolK: 1 });
    expect(r.poolSources).toBe(1);
  });
});

describe('rankInversions — synthetic layer only', () => {
  it('is zero when the scorer ranks the target first', () => {
    const { pages, fixtures, queryTerms } = builtInFixtures();
    const inv = rankInversions(fixtures, pages, queryTerms);
    for (const r of inv) expect(r.inversions).toBe(0);
  });

  it('counts pairs so a reader can tell zero from not-enough-data', () => {
    // An inversion count of 0 with 0 pairs is not a clean result. The pair
    // count is what makes the number interpretable.
    const { pages, fixtures, queryTerms } = builtInFixtures();
    const inv = rankInversions(fixtures, pages, queryTerms);
    for (const r of inv) {
      expect(r.pairs).toBeGreaterThan(0);
    }
  });

  it('is empty when there is no ground truth — and that is not the same as clean', () => {
    const pages: SourcedPage[] = [{ path: 'a', title: 'Alpha', aliases: [], summary: 'alpha' }];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: [], regime: 'latin' }];
    const terms = new Map([['f', ['alpha']]]);
    const [r] = rankInversions(fixtures, pages, terms);
    expect(r.inversions).toBe(0);
    expect(r.pairs).toBe(0);
  });
});

describe('escalationReport', () => {
  const pass = () => ({ topScore: 6, hitCount: 3, reliable: true });
  const fail = () => ({ topScore: 0.5, hitCount: 1, reliable: false });

  it('reports the share of queries that would call the LLM', () => {
    const r = escalationReport(['a', 'b', 'c'], q => (q === 'a' ? pass() : fail()), 5, 3);
    expect(r.needsLLM).toBe(2);
    expect(r.total).toBe(3);
    expect(r.ratio).toBeCloseTo(2 / 3);
  });

  it('is 1.0 when every query fails the gate — the measured silent failure', () => {
    // With BM25F scores near 0.5 and a threshold of 5, this is what production
    // looked like before phase 4. The number makes the failure visible instead
    // of hidden behind "the LLM was called more".
    const r = escalationReport(['a', 'b'], fail, 5, 3);
    expect(r.ratio).toBe(1);
  });

  it('is 0.0 when the gate holds on every query', () => {
    expect(escalationReport(['a', 'b'], pass, 5, 3).ratio).toBe(0);
  });

  it('reports zero rather than NaN with no queries', () => {
    const r = escalationReport([], pass, 5, 3);
    expect(r.total).toBe(0);
    expect(r.ratio).toBe(0);
  });
});

describe('prepare', () => {
  it('builds the page terms once so reports can share them', () => {
    const pages = [dp('a', 'Alpha', { summary: 'alpha' })];
    const { pageTerms, corpus } = prepare(pages);
    expect(pageTerms).toHaveLength(1);
    expect(corpus.docCount).toBe(1);
    expect(corpus.docFreq.get('alpha')).toBe(1);
  });
});

describe('the window flags are three answers, not two', () => {
  // Regression. `poolSources <= 1` labelled a window with NO source refs as
  // "single-source: assembly cannot help", which is a different fact with a
  // different consequence. Zero means the layer cannot see; one means it can
  // see and there is only one thing to load.
  it('a window with no source refs is unattributed, not single-source', () => {
    const pages: SourcedPage[] = [
      { path: 'q/a', title: 'Alpha', aliases: [], summary: 'alpha' },
      { path: 'q/b', title: 'Alpha two', aliases: [], summary: 'alpha' },
    ];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: [], regime: 'latin' }];
    const [r] = poolReport(fixtures, pages, new Map([['f', ['alpha']]]), { k: 10, poolK: 50 });
    expect(r.poolSources).toBe(0);
    expect(r.unattributedWindow).toBe(true);
    expect(r.singleSourceWindow).toBe(false);
  });

  it('a window with exactly one source is single-source, not unattributed', () => {
    const pages: SourcedPage[] = [
      { path: 'q/a', title: 'Alpha', aliases: [], summary: 'alpha', sourceSlug: 'only' },
      { path: 'q/b', title: 'Alpha two', aliases: [], summary: 'alpha', sourceSlug: 'only' },
    ];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: [], regime: 'latin' }];
    const [r] = poolReport(fixtures, pages, new Map([['f', ['alpha']]]), { k: 10, poolK: 50 });
    expect(r.poolSources).toBe(1);
    expect(r.singleSourceWindow).toBe(true);
    expect(r.unattributedWindow).toBe(false);
  });

  it('a window with two sources is neither', () => {
    const pages: SourcedPage[] = [
      { path: 'q/a', title: 'Alpha', aliases: [], summary: 'alpha', sourceSlug: 's1' },
      { path: 'q/b', title: 'Alpha two', aliases: [], summary: 'alpha', sourceSlug: 's2' },
    ];
    const fixtures: Fixture[] = [{ id: 'f', query: 'alpha', relevant: [], regime: 'latin' }];
    const [r] = poolReport(fixtures, pages, new Map([['f', ['alpha']]]), { k: 10, poolK: 50 });
    expect(r.poolSources).toBe(2);
    expect(r.singleSourceWindow).toBe(false);
    expect(r.unattributedWindow).toBe(false);
  });
});
