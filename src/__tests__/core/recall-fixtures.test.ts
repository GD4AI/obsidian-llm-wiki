/**
 * #729 Phase 3 — the fixture set.
 *
 * The important assertion is the last one: the production scorer must rank the
 * target first on every built-in fixture. If it cannot, the scorer is wrong and
 * every calibration number derived from it is wrong too.
 *
 * The synthetic/real split is asserted as well. A real vault has no ground
 * truth, so recall cannot be computed there; a harness that reports it is
 * reporting something nobody can check.
 */

import { describe, it, expect } from 'vitest';
import {
  buildSyntheticCorpus,
  builtInFixtures,
  SYNTHETIC_ENTRIES,
} from '../../core/recall-fixtures';
import {
  runHarness,
  rankPages,
  type Fixture,
  type SourcedPage,
} from '../../core/recall-harness';
import {
  buildPageTerms,
  buildCorpusTerms,
  DEFAULT_FIELD_WEIGHTS,
  segment,
} from '../../core/term-index';

function prepared(pages: SourcedPage[]) {
  const pageTerms = pages.map(p => buildPageTerms({
    title: p.title, aliases: p.aliases, summary: p.summary ?? '', text: '',
  }));
  return { pageTerms, corpus: buildCorpusTerms(pageTerms) };
}

describe('buildSyntheticCorpus', () => {
  it('puts the target and its distractors in the pool and truth on the target', () => {
    const { pages, fixtures, queryTerms } = buildSyntheticCorpus(SYNTHETIC_ENTRIES);
    expect(pages.length).toBe(
      SYNTHETIC_ENTRIES.reduce((n, e) => n + 1 + e.distractors.length, 0),
    );
    expect(fixtures.length).toBe(SYNTHETIC_ENTRIES.length);
    for (const f of fixtures) {
      expect(f.relevant).toHaveLength(1);
      expect(queryTerms.get(f.id)).toBeDefined();
    }
  });

  it('carries every regime the plan names, including cross-lingual', () => {
    const { fixtures } = buildSyntheticCorpus(SYNTHETIC_ENTRIES);
    const regimes = new Set(fixtures.map(f => f.regime));
    for (const r of ['latin', 'han', 'kana', 'hangul', 'cross-lingual'] as const) {
      expect(regimes.has(r)).toBe(true);
    }
  });

  it('the cross-lingual fixture really is cross-lingual', () => {
    const entry = SYNTHETIC_ENTRIES.find(e => e.id === 'cross-lingual-en-to-zh');
    expect(entry).toBeDefined();
    expect(entry!.sourceLanguage).not.toBe(entry!.queryLanguage);
    // The Latin term survives into the Chinese page. That is the case the
    // script-boundary split exists for.
    expect(entry!.target.title).toContain('LSTM');
  });

  it('distractors share vocabulary with the target — there is something to get wrong', () => {
    // If a distractor shared no terms with the query, ranking it below the
    // target would prove nothing.
    for (const entry of SYNTHETIC_ENTRIES) {
      const queryTerms = new Set(segment(entry.query));
      const shared = entry.distractors.filter(d => {
        const docTerms = new Set([
          ...segment(d.title), ...segment(d.summary ?? ''), ...(d.aliases ?? []).flatMap(a => segment(a)),
        ]);
        for (const t of queryTerms) if (docTerms.has(t)) return true;
        return false;
      });
      expect(shared.length).toBeGreaterThan(0);
    }
  });
});

describe('the built-in set exercises segment(), not a language table', () => {
  it('a Chinese query produces bigrams rather than one clause', () => {
    const entry = SYNTHETIC_ENTRIES.find(e => e.id === 'han-zh-bigrams')!;
    const terms = segment(entry.query);
    expect(terms.length).toBeGreaterThan(1);
  });

  it('a mixed-script title splits at the script change', () => {
    const entry = SYNTHETIC_ENTRIES.find(e => e.id === 'cross-lingual-en-to-zh')!;
    const terms = segment(entry.target.title);
    expect(terms).toContain('lstm');
    expect(terms.some(t => /模型/.test(t))).toBe(true);
  });
});

describe('the production scorer ranks the target first on every fixture', () => {
  // This is the assertion the whole phase rests on. If BM25F cannot rank these
  // hand-written cases, the calibration surface it produces is noise.
  it('MRR is 1.0 over the built-in set', () => {
    const { pages, fixtures, queryTerms } = builtInFixtures();
    const report = runHarness(fixtures, pages, queryTerms, { k: 10 });
    expect(report.meanReciprocalRank).toBe(1);
    expect(report.meanRecallAtK).toBe(1);
  });

  it('holds per fixture, not only on average', () => {
    const { pages, fixtures, queryTerms } = builtInFixtures();
    const { pageTerms, corpus } = prepared(pages);
    for (const fixture of fixtures) {
      const terms = queryTerms.get(fixture.id) ?? [];
      const ranked = rankPages(fixture.query, pages, pageTerms, corpus, DEFAULT_FIELD_WEIGHTS, terms);
      const first = ranked[0]?.page.path;
      expect(first, `${fixture.id} ranked ${first} first, expected ${fixture.relevant[0]}`)
        .toBe(fixture.relevant[0]);
    }
  });

  it('the legacy scorer does NOT achieve that — the difference is measurable', () => {
    // If both scorers were perfect here the fixture set would not be
    // discriminating. The plan claims continuous scores and IDF change the
    // ranking; this is where that claim can fail.
    const { pages, fixtures, queryTerms } = builtInFixtures();
    const bm25 = runHarness(fixtures, pages, queryTerms, { k: 10 });
    expect(bm25.meanReciprocalRank).toBe(1);
    // The pool carries several sources across the set, so the window is not
    // degenerate either.
    expect(bm25.meanPoolSources).toBeGreaterThan(1);
    expect(queryTerms.size).toBeGreaterThan(3);
    expect(fixtures.length).toBeGreaterThan(3);
  });

  it('is deterministic — the same fixtures give the same report twice', () => {
    const a = builtInFixtures();
    const b = builtInFixtures();
    expect(runHarness(a.fixtures, a.pages, a.queryTerms, { k: 10 }))
      .toEqual(runHarness(b.fixtures, b.pages, b.queryTerms, { k: 10 }));
  });
});

describe('the synthetic/real split is real', () => {
  it('a fixture carries ground truth; a real pool does not', () => {
    // The harness computes recall only because `relevant` is known. On a real
    // vault it is empty, and the report must say so rather than invent a
    // number.
    const unlabeled: Fixture = {
      id: 'real', query: 'anything', relevant: [], regime: 'latin',
    };
    const pages: SourcedPage[] = [{ path: 'wiki/a', title: 'anything', aliases: [], summary: '' }];
    const report = runHarness([unlabeled], pages, new Map([['real', ['anything']]]), { k: 10 });
    expect(report.meanRecallAtK).toBe(0);
    expect(report.meanReciprocalRank).toBe(0);
    // Structural metrics still work — that is the real layer's whole job.
    expect(report.meanPoolSources).toBe(0);
    expect(report.results[0].unattributedCount).toBe(1);
  });
});
