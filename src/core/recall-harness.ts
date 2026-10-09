// core/recall-harness.ts — #729 Phase 3: the thing that calibrates.
//
// This module exists because the plan said field weights are calibrated on a
// harness and never assumed, and the constant shipped alongside that sentence
// (`DEFAULT_FIELD_WEIGHTS = {title 3, alias 2, summary 1, text 1}`) was the old
// hand-tuned ratio wearing a new name. Nothing was measured. The harness moved
// ahead of the phases that need it so that no conclusion is drawn from a number
// nobody measured.
//
// It measures four things the plan names:
//   1. recall@K and MRR over a fixture set with known relevant pages
//   2. the cross-source share of what actually gets loaded — the issue's own
//      symptom, where the top-50 pool holds 9.3 sources and the top-10 loads 3.5
//   3. a seeds-only ablation arm, so the graph expansion's contribution can be
//      separated from lexical recall rather than assumed
//   4. the candidate pool's source count, because one measured question had a
//      single-source pool where assembly cannot help at all
//
// And it calibrates: a grid search over field weights, scored by MRR, returning
// the whole surface rather than a single winner so a reader can see how flat or
// how peaked the answer is. A calibration that returns one number hides the
// fact that everything nearby scored the same.
//
// Pure. No IO. The CLI in `tools/dev-instrument/` supplies the IO.

import type { PageRef } from './ppr-cascade';
import {
  buildPageTerms,
  buildCorpusTerms,
  bm25fScore,
  DEFAULT_FIELD_WEIGHTS,
  type FieldWeights,
  type PageTerms,
  type CorpusTerms,
} from './term-index';

/** One retrieval question with the pages that are known to answer it. */
export interface Fixture {
  readonly id: string;
  readonly query: string;
  /** Paths of the pages that answer the query. Ground truth. */
  readonly relevant: readonly string[];
  /** Segmentation regime this fixture exercises, for reporting only. */
  readonly regime: 'latin' | 'han' | 'kana' | 'hangul' | 'cross-lingual';
  /** Source language of the pages, when it differs from the query. */
  readonly sourceLanguage?: string;
  readonly queryLanguage?: string;
}

/** What a page was derived from, so cross-source share can be measured. */
export interface SourcedPage extends PageRef {
  /** Slug of the source note, or undefined when the page carries no `sources:`. */
  readonly sourceSlug?: string;
}

export interface RankedPage {
  readonly page: SourcedPage;
  readonly score: number;
  readonly rank: number;
}

export interface FixtureResult {
  readonly fixtureId: string;
  /** Recall at the cutoff the caller asked for. */
  readonly recallAtK: number;
  /** Reciprocal rank of the first relevant page, 0 when none is retrieved. */
  readonly reciprocalRank: number;
  readonly retrievedCount: number;
  readonly relevantCount: number;
  /** Distinct sources in the retrieved set. */
  readonly retrievedSources: number;
  /** Distinct sources in the whole pool. 0 when no page carries a source. */
  readonly poolSources: number;
  /** Largest single source's share of the retrieved set, 0 to 1. */
  readonly dominantSourceShare: number;
  /** Pages with no `sources:` ref — the assembly layer is blind to these. */
  readonly unattributedCount: number;
}

export interface HarnessReport {
  readonly results: readonly FixtureResult[];
  readonly meanRecallAtK: number;
  readonly meanReciprocalRank: number;
  /** Mean distinct sources loaded, and mean distinct sources available. */
  readonly meanRetrievedSources: number;
  readonly meanPoolSources: number;
  readonly meanDominantSourceShare: number;
  /** Mean over fixtures whose pool has more than one source. Assembly cannot
   *  help a single-source pool, so counting it would flatter or blame the
   *  layer for something it cannot do. */
  readonly meanCrossSourceGainWindow: number;
  /** How many fixtures had a single-source pool to begin with. */
  readonly singleSourcePoolCount: number;
  /** Fixtures where the top score is shared by more than one page. */
  readonly tieCount: number;
}

function sourceOf(page: SourcedPage): string | null {
  return page.sourceSlug ?? null;
}

/** Score and rank pages for one query using the production scorer. */
export function rankPages(
  query: string,
  pages: readonly SourcedPage[],
  pageTerms: readonly PageTerms[],
  corpus: CorpusTerms,
  weights: FieldWeights = DEFAULT_FIELD_WEIGHTS,
  queryTerms: readonly string[] = [],
): RankedPage[] {
  const terms = queryTerms.length > 0 ? queryTerms : undefined;
  const scored: Array<{ page: SourcedPage; score: number }> = [];
  for (let i = 0; i < pages.length; i += 1) {
    // The caller segments the query the same way the index does. Passing raw
    // text here would re-tokenise and drift from what production does.
    const score = terms
      ? bm25fScore(terms, pageTerms[i], corpus, weights)
      : bm25fScore([query], pageTerms[i], corpus, weights);
    if (score > 0) scored.push({ page: pages[i], score });
  }
  scored.sort((a, b) =>
    b.score - a.score
    || (a.page.path < b.page.path ? -1 : a.page.path > b.page.path ? 1 : 0));
  return scored.map((s, i) => ({ page: s.page, score: s.score, rank: i + 1 }));
}

/** Score one fixture. Pure. */
export function scoreFixture(
  fixture: Fixture,
  ranked: readonly RankedPage[],
  pool: readonly SourcedPage[],
  k: number,
  poolK: number = 50,
): FixtureResult {
  const topK = ranked.slice(0, k);
  const relevantSet = new Set(fixture.relevant);
  const hits = topK.filter(r => relevantSet.has(r.page.path)).length;
  const firstHit = ranked.find(r => relevantSet.has(r.page.path));
  const sources = new Map<string, number>();
  for (const r of topK) {
    const s = sourceOf(r.page);
    if (s === null) continue;
    sources.set(s, (sources.get(s) ?? 0) + 1);
  }
  // The blind count is over the pool, not the retrieved set. It answers "how
  // blind is the assembly layer on this vault" — the measured fact behind the
  // plan's limit that 25 % of a mixed-generation wiki carries a `sources:` ref
  // against 97 % of a freshly generated one. A page with no ref cannot be
  // diversified no matter how the assembly step picks.
  let unattributed = 0;
  for (const p of pool) {
    if (sourceOf(p) === null) unattributed += 1;
  }
  // "Available" means the candidate window, not the whole vault. The measured
  // question this reports is "the top-50 held 9.3 sources and the top-10 loaded
  // 3.5" — the pool is whatever the retrieval step produced for this query.
  // Counting the whole vault would make every pool look rich and hide the
  // case the plan found the hard way: one question whose window held a single
  // source, where no assembly step can diversify anything.
  const poolWindow = ranked.slice(0, poolK);
  const poolSources = new Set<string>();
  for (const r of poolWindow) {
    const s = sourceOf(r.page);
    if (s !== null) poolSources.add(s);
  }
  const loadedTotal = topK.length || 1;
  const dominant = sources.size > 0 ? Math.max(...sources.values()) / loadedTotal : 0;
  return {
    fixtureId: fixture.id,
    recallAtK: fixture.relevant.length > 0 ? hits / fixture.relevant.length : 0,
    reciprocalRank: firstHit ? 1 / firstHit.rank : 0,
    retrievedCount: topK.length,
    relevantCount: fixture.relevant.length,
    retrievedSources: sources.size,
    poolSources: poolSources.size,
    dominantSourceShare: dominant,
    unattributedCount: unattributed,
  };
}

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Run every fixture and aggregate. Pure. */
export function runHarness(
  fixtures: readonly Fixture[],
  pages: readonly SourcedPage[],
  queryTermsById: ReadonlyMap<string, readonly string[]>,
  options: {
    k?: number;
    weights?: FieldWeights;
    pageTerms?: readonly PageTerms[];
    corpus?: CorpusTerms;
  } = {},
): HarnessReport {
  const k = options.k ?? 10;
  const weights = options.weights ?? DEFAULT_FIELD_WEIGHTS;
  const pageTerms = options.pageTerms ?? pages.map(p => buildPageTerms({
    title: p.title,
    aliases: p.aliases,
    summary: p.summary ?? '',
    text: '',
  }));
  const corpus = options.corpus ?? buildCorpusTerms(pageTerms);

  const results: FixtureResult[] = [];
  let ties = 0;
  for (const fixture of fixtures) {
    const terms = queryTermsById.get(fixture.id) ?? [];
    const ranked = rankPages(fixture.query, pages, pageTerms, corpus, weights, terms);
    results.push(scoreFixture(fixture, ranked, pages, k));
    const top = ranked[0]?.score;
    if (top !== undefined && ranked.filter(r => r.score === top).length > 1) ties += 1;
  }
  const multiSource = results.filter(r => r.poolSources > 1);
  return {
    results,
    meanRecallAtK: mean(results.map(r => r.recallAtK)),
    meanReciprocalRank: mean(results.map(r => r.reciprocalRank)),
    meanRetrievedSources: mean(results.map(r => r.retrievedSources)),
    meanPoolSources: mean(results.map(r => r.poolSources)),
    meanDominantSourceShare: mean(results.map(r => r.dominantSourceShare)),
    meanCrossSourceGainWindow: mean(multiSource.map(r => r.retrievedSources)),
    singleSourcePoolCount: results.length - multiSource.length,
    tieCount: ties,
  };
}

/** One point on the calibration surface. */
export interface CalibrationPoint {
  readonly weights: FieldWeights;
  readonly meanReciprocalRank: number;
  readonly meanRecallAtK: number;
}

export interface CalibrationResult {
  readonly best: CalibrationPoint;
  /** The whole surface, sorted by MRR descending. A single number would hide
   *  how flat the answer is. */
  readonly surface: readonly CalibrationPoint[];
  /** MRR of the starting weights, so the reader sees what calibration bought. */
  readonly baseline: CalibrationPoint;
}

/**
 * Grid search over field weights, scored by MRR.
 *
 * The grid is coarse on purpose: this answers "is the title weight 3 or 1", not
 * "is it 2.7". A finer grid would give precision nobody has fixtures to
 * support, and the surface is returned so the reader can see that.
 */
export function calibrateFieldWeights(
  fixtures: readonly Fixture[],
  pages: readonly SourcedPage[],
  queryTermsById: ReadonlyMap<string, readonly string[]>,
  options: {
    k?: number;
    values?: readonly number[];
    pageTerms?: readonly PageTerms[];
    corpus?: CorpusTerms;
  } = {},
): CalibrationResult {
  const values = options.values ?? [0, 1, 2, 3, 5];
  const pageTerms = options.pageTerms ?? pages.map(p => buildPageTerms({
    title: p.title,
    aliases: p.aliases,
    summary: p.summary ?? '',
    text: '',
  }));
  const corpus = options.corpus ?? buildCorpusTerms(pageTerms);

  const surface: CalibrationPoint[] = [];
  for (const title of values) {
    for (const alias of values) {
      for (const summary of values) {
        const weights: FieldWeights = { title, alias, summary, text: 0 };
        const report = runHarness(fixtures, pages, queryTermsById, {
          k: options.k, weights, pageTerms, corpus,
        });
        surface.push({
          weights,
          meanReciprocalRank: report.meanReciprocalRank,
          meanRecallAtK: report.meanRecallAtK,
        });
      }
    }
  }
  surface.sort((a, b) =>
    b.meanReciprocalRank - a.meanReciprocalRank
    || b.meanRecallAtK - a.meanRecallAtK);
  const baselineReport = runHarness(fixtures, pages, queryTermsById, {
    k: options.k, pageTerms, corpus,
  });
  return {
    best: surface[0],
    surface,
    baseline: {
      weights: DEFAULT_FIELD_WEIGHTS,
      meanReciprocalRank: baselineReport.meanReciprocalRank,
      meanRecallAtK: baselineReport.meanRecallAtK,
    },
  };
}
