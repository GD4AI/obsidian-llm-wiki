// tools/dev-instrument/src/recall-diagnostic.ts — #729 Phase 3: the diagnostic.
//
// The harness answers "is the scorer correct". This answers "what does MY vault
// look like", because the constants the plan needs are corpus statistics and
// the corpus is the user's, not ours. The measured fact that makes this
// necessary: `CANDIDATE_WINDOW_DF_CAP = 0.5` was calibrated on long body text
// and on real summaries `the` measured 0.25, so the cap did nothing. A constant
// cannot be right for a corpus nobody has seen.
//
// Reports four things the plan names:
//   1. the DF tail — how concentrated term frequency is, which is what tells a
//      reader whether stop-word suppression can even work on their corpus
//   2. rank inversions — where the scorer's order disagrees with the fixture's
//      ground truth; on a real vault there is no truth so this reports the
//      synthetic layer only, and says so
//   3. the needsLLM ratio — how often the lexical gate is not strong enough and
//      the LLM gets called. This is the number the lexStrong constants control,
//      and the reason phase 4 has to happen at all.
//   4. the candidate-pool source count — top-50 against top-10, the issue's own
//      symptom. Also the number that says whether an assembly step can help at
//      all: a single-source window cannot be diversified.
//
// Pure. No IO. The runner in `tools/dev-instrument/` reads the vault.

import {
  segment,
  buildPageTerms,
  buildCorpusTerms,
  type PageTerms,
  type CorpusTerms,
} from '../../../src/core/term-index';
import type { SourcedPage, Fixture } from '../../../src/core/recall-harness';
import { rankPages, scoreFixture } from '../../../src/core/recall-harness';

/** A page with the raw text the diagnostic needs. */
export interface DiagnosticPage extends SourcedPage {
  readonly summary: string;
  readonly body: string;
}

export interface DfTailReport {
  readonly docCount: number;
  readonly termCount: number;
  /** Terms appearing in more than this share of documents. */
  readonly highDfTerms: ReadonlyArray<{ term: string; df: number }>;
  /** Terms appearing in exactly one document — the rare tail. */
  readonly hapaxCount: number;
  /** Median and 90th percentile document frequency, 0 to 1. */
  readonly medianDf: number;
  readonly p90Df: number;
  /** Share of documents carrying no `sources:` ref. The assembly layer is blind
   *  to these, and the measured figure on a mixed-generation vault was 75 %. */
  readonly unattributedShare: number;
}

export function dfTail(pages: readonly DiagnosticPage[]): DfTailReport {
  const pageTerms = pages.map(p => buildPageTerms({
    title: p.title,
    aliases: p.aliases,
    summary: p.summary,
    text: p.body,
  }));
  const corpus = buildCorpusTerms(pageTerms);
  const dfs = [...corpus.docFreq.values()].map(df => df / (corpus.docCount || 1)).sort((a, b) => a - b);
  const high = [...corpus.docFreq.entries()]
    .map(([term, df]) => ({ term, df: df / (corpus.docCount || 1) }))
    .filter(x => x.df >= 0.5)
    .sort((a, b) => b.df - a.df)
    .slice(0, 25);
  const unattributed = pages.filter(p => !p.sourceSlug).length;
  return {
    docCount: corpus.docCount,
    termCount: corpus.docFreq.size,
    highDfTerms: high,
    hapaxCount: dfs.filter(d => d <= 1 / (corpus.docCount || 1)).length,
    medianDf: dfs.length > 0 ? dfs[Math.floor(dfs.length / 2)] : 0,
    p90Df: dfs.length > 0 ? dfs[Math.floor(dfs.length * 0.9)] : 0,
    unattributedShare: pages.length > 0 ? unattributed / pages.length : 0,
  };
}

export interface PoolReport {
  readonly fixtureId: string;
  readonly query: string;
  /** Distinct sources in the top-50 candidate window. */
  readonly poolSources: number;
  /** Distinct sources in what actually loaded (top-K). */
  readonly loadedSources: number;
  readonly dominantShare: number;
  /** True when the window itself is single-source: assembly cannot help. */
  readonly singleSourceWindow: boolean;
  readonly unattributedInWindow: number;
}

/** The candidate-pool source count — the issue's own symptom, measured. */
export function poolReport(
  fixtures: readonly Fixture[],
  pages: readonly SourcedPage[],
  queryTermsById: ReadonlyMap<string, readonly string[]>,
  options: { k?: number; poolK?: number; pageTerms?: readonly PageTerms[]; corpus?: CorpusTerms } = {},
): PoolReport[] {
  const k = options.k ?? 10;
  const poolK = options.poolK ?? 50;
  const pageTerms = options.pageTerms ?? pages.map(p => buildPageTerms({
    title: p.title,
    aliases: p.aliases,
    summary: p.summary ?? '',
    text: '',
  }));
  const corpus = options.corpus ?? buildCorpusTerms(pageTerms);
  return fixtures.map(fixture => {
    const terms = queryTermsById.get(fixture.id) ?? [];
    const ranked = rankPages(fixture.query, pages, pageTerms, corpus, undefined, terms);
    const r = scoreFixture(fixture, ranked, pages, k, poolK);
    return {
      fixtureId: fixture.id,
      query: fixture.query,
      poolSources: r.poolSources,
      loadedSources: r.retrievedSources,
      dominantShare: r.dominantSourceShare,
      singleSourceWindow: r.poolSources <= 1,
      unattributedInWindow: r.unattributedCount,
    };
  });
}

export interface InversionReport {
  readonly fixtureId: string;
  /** How many pairs are in the wrong order. 0 is perfect. */
  readonly inversions: number;
  readonly pairs: number;
}

/**
 * Rank inversions against ground truth. Synthetic layer only.
 *
 * A real vault has no relevant set, so this cannot run there — and the caller
 * is expected to say so rather than report zeros that look like a clean result.
 */
export function rankInversions(
  fixtures: readonly Fixture[],
  pages: readonly SourcedPage[],
  queryTermsById: ReadonlyMap<string, readonly string[]>,
  options: { pageTerms?: readonly PageTerms[]; corpus?: CorpusTerms } = {},
): InversionReport[] {
  const pageTerms = options.pageTerms ?? pages.map(p => buildPageTerms({
    title: p.title,
    aliases: p.aliases,
    summary: p.summary ?? '',
    text: '',
  }));
  const corpus = options.corpus ?? buildCorpusTerms(pageTerms);
  return fixtures.map(fixture => {
    const terms = queryTermsById.get(fixture.id) ?? [];
    const ranked = rankPages(fixture.query, pages, pageTerms, corpus, undefined, terms);
    const position = new Map(ranked.map(r => [r.page.path, r.rank]));
    const relevant = fixture.relevant.filter(p => position.has(p));
    const nonRelevant = ranked.filter(r => !fixture.relevant.includes(r.page.path)).map(r => r.page.path);
    let inversions = 0;
    let pairs = 0;
    for (const rel of relevant) {
      for (const non of nonRelevant) {
        pairs += 1;
        if (position.get(non)! < position.get(rel)!) inversions += 1;
      }
    }
    return { fixtureId: fixture.id, inversions, pairs };
  });
}

export interface EscalationReport {
  /** Queries where the lexical gate is weak and the LLM would be called. */
  readonly needsLLM: number;
  readonly total: number;
  readonly ratio: number;
  readonly details: ReadonlyArray<{ query: string; topScore: number; hitCount: number; needsLLM: boolean }>;
}

/**
 * The needsLLM ratio, from the gate as production runs it.
 *
 * This is the number the `lexStrong` constants control. The reason phase 4 has
 * to move them is visible here: with the absolute-scale thresholds and BM25F
 * scores the ratio goes to 1 and the LLM is called on every query, which is the
 * measured silent failure.
 */
export function escalationReport(
  queries: readonly string[],
  score: (query: string) => { topScore: number; hitCount: number; reliable: boolean },
  minTopScore: number,
  minCount: number,
): EscalationReport {
  const details = queries.map(query => {
    const { topScore, hitCount, reliable } = score(query);
    const needsLLM = !(topScore >= minTopScore && hitCount >= minCount && reliable);
    return { query, topScore, hitCount, needsLLM };
  });
  const needsLLM = details.filter(d => d.needsLLM).length;
  return {
    needsLLM,
    total: queries.length,
    ratio: queries.length > 0 ? needsLLM / queries.length : 0,
    details,
  };
}

/** Convenience: build the page term set once and share it across reports. */
export function prepare(pages: readonly DiagnosticPage[]): {
  pageTerms: PageTerms[];
  corpus: CorpusTerms;
} {
  const pageTerms = pages.map(p => buildPageTerms({
    title: p.title,
    aliases: p.aliases,
    summary: p.summary,
    text: p.body,
  }));
  return { pageTerms, corpus: buildCorpusTerms(pageTerms) };
}

export { segment };
