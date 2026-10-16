// query-expansion.ts — two-stage Rocchio relevance feedback (Issue #729).
//
// Query-side only. The corpus is not rewritten, no page is created, and no
// external knowledge enters: every word added comes from the user's own notes.
//
// Rocchio (1971) says a ranking's neighbourhood already knows the topic's
// vocabulary. Read its distinctive words and put them in the query. One shot
// does that and stops. This does it twice, with a re-rank between.
//
// Why twice. The first neighbourhood is the topic's rim — the pages the query's
// own words already reached. Their vocabulary adds breadth and, on a query
// whose words and the answer's words are disjoint, mostly noise: measured on
// test8's strict layer, one shot is -0.040 r@10 against baseline. The re-rank
// pulls the query onto the topic; the second neighbourhood is then the topic's
// interior, and those words are the ones that bridge the gap. Two shots are
// +0.048 r@10 on average and positive in all four cells measured.
//
// The cost is two extra lexical rankings per query. Measured 2026-10-15 on
// 2,000 pages that is well under a millisecond each; the graph walk it feeds
// is orders of magnitude more expensive.

import { segment, buildPageTerms, buildCorpusTerms, buildInvertedIndex, bm25fScore, wordGrams, FIELD_ORDER, DEFAULT_FIELD_WEIGHTS, type PageTerms, type CorpusTerms, type InvertedIndex } from './term-index';
import { tokenizeQuery } from './ppr-cascade';

export interface ExpansionPage {
  key: string;
  title: string;
  summary: string;
  text: string;
}

export interface ExpansionOptions {
  /** Neighbourhood size for the first pass. 5 is the measured optimum. */
  k1: number;
  /** Words taken from the first neighbourhood. 10 is the measured optimum. */
  m1: number;
  /** Neighbourhood size for the second pass. */
  k2: number;
  /** Words taken from the second neighbourhood. */
  m2: number;
}

/** The measured optimum on both vaults (2026-10-15 sweep, 8 settings). */
export const DEFAULT_EXPANSION: ExpansionOptions = { k1: 5, m1: 10, k2: 5, m2: 10 };

/**
 * Expand `queryTerms` with the distinctive words of its own neighbourhood,
 * twice. The original terms stay first and in order, so a caller that treats
 * the head of the list as the user's intent still reads the user's intent.
 *
 * Returns the input unchanged when there is no neighbourhood to read — an
 * empty corpus, a query matching nothing, or a `k2` of 0 for a one-shot call.
 */
export function twoStageExpand(
  queryTerms: string[],
  pages: readonly ExpansionPage[],
  corpus: CorpusTerms,
  opts: ExpansionOptions = DEFAULT_EXPANSION,
  /**
   * Terms built once per index file and reused across queries. #855 review
   * point 4: `buildPageTerms` over every page with a body is the 4.4 s per
   * query that #843 measured and removed. A caller that rebuilds them here
   * on every keystroke reintroduces that cost.
   */
  prebuilt?: readonly PageTerms[],
  /**
   * Inverted index over `pts`. When given, the scorer visits only pages that
   * contain at least one query term — a page that contains none contributes
   * zero — and the ranking is identical. Without one, every page is visited.
   */
  index?: InvertedIndex,
  /**
   * Cheap pre-filter budget. The scorer visits at most this many pages,
   * chosen by how many query terms they carry. 0 or less disables it.
   * `expansion-prefilter.test.ts` pins that a generous budget produces the
   * full-scan result.
   */
  prefilterN?: number,
): string[] {
  if (queryTerms.length === 0 || pages.length === 0) return queryTerms;
  const pts: PageTerms[] = prebuilt ? [...prebuilt] : buildExpansionTerms(pages);

  const first = [...queryTerms, ...distinctive(pages, scoredIndices(queryTerms, pts, corpus, opts.k1, index, prefilterN), queryTerms, opts.m1, pts)];
  if (opts.k2 <= 0 || opts.m2 <= 0) return first;

  const reranked = scoredIndices(first, pts, corpus, opts.k2, index, prefilterN);
  const second = [...first, ...distinctive(pages, reranked, first, opts.m2, pts)];
  return second;
}

/**
 * Build the per-page term tables `twoStageExpand` scores against. Cache the
 * result keyed on the index file: the terms change only when the pages change,
 * and rebuilding them per query is the cost #855 review point 4 is about.
 */
export function buildExpansionTerms(pages: readonly ExpansionPage[]): PageTerms[] {
  return pages.map(p => buildPageTerms({
    title: p.title,
    aliases: [],
    summary: p.summary,
    text: p.text,
  }));
}

/**
 * Per-session cache of the expansion tables. Keyed on the same signature the
 * term-index cache uses, so a session that reads one index file builds once
 * and every query after that scores against the prebuilt tables.
 *
 * #855 review point 4: `buildPageTerms` over every page with a body is 4.4 s
 * per query on 2,864 pages. #843 removed that cost from the seed scorer. The
 * expansion must not reintroduce it.
 */
export class ExpansionTermsCache {
  private key = '';
  private terms: PageTerms[] = [];
  private corpus: CorpusTerms | null = null;
  private index: InvertedIndex | null = null;
  private _buildCount = 0;

  /** Build once per key. A repeat call with the same key returns the cached tables. */
  get(key: string, pages: readonly ExpansionPage[]): { terms: PageTerms[]; corpus: CorpusTerms; index: InvertedIndex } {
    if (this.key !== key || this.terms.length === 0) {
      this.terms = buildExpansionTerms(pages);
      this.corpus = buildCorpusTerms(this.terms);
      this.index = buildInvertedIndex(this.terms);
      this.key = key;
      this._buildCount += 1;
    }
    return { terms: this.terms, corpus: this.corpus as CorpusTerms, index: this.index as InvertedIndex };
  }

  /** Exposed for tests that want to prove a rebuild happened. */
  get buildCount(): number {
    return this._buildCount;
  }
}

/**
 * The one-call entry point. Tokenizes the query, expands it twice, and joins
 * the result. The original terms come first and in order, so a scorer that
 * weights the head of the list still reads the user's intent.
 */
export function expandQueryForRetrieval(
  query: string,
  pages: readonly ExpansionPage[],
  corpus: CorpusTerms,
  opts: ExpansionOptions = DEFAULT_EXPANSION,
  prebuilt?: readonly PageTerms[],
): string {
  const terms = tokenizeQuery(query);
  return twoStageExpand(terms, pages, corpus, opts, prebuilt).join(' ');
}

/** Indices whose score is above zero, in rank order. A page that scores zero
 *  shares no term with the query, so its vocabulary is not this query's
 *  vocabulary and reading it would add noise. */
function scoredIndices(terms: string[], pts: PageTerms[], corpus: CorpusTerms, k: number, index?: InvertedIndex, prefilterN?: number): number[] {
  const candidates = prefilterN && prefilterN > 0
    ? prefilterIndices(terms, pts, prefilterN)
    : candidateIndices(terms, pts.length, index);
  return candidates
    .map(j => ({ j, score: bm25fScore(terms, pts[j], corpus, DEFAULT_FIELD_WEIGHTS) }))
    .filter(e => e.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.j < b.j ? -1 : 1))
    .slice(0, k)
    .map(e => e.j);
}

/**
 * The cheap pre-filter: keep the top `n` pages by how many query terms they
 * carry. No IDF, no field weights, no length normalisation — just a count.
 *
 * Returns every page when `n <= 0` or `n >= pages.length`, so a caller that
 * passes no budget gets the full scan. A page that matches nothing is dropped
 * rather than filling the budget with pages that would score zero.
 */
export function prefilterIndices(terms: readonly string[], pts: readonly PageTerms[], n: number): number[] {
  if (n <= 0 || n >= pts.length) return Array.from({ length: pts.length }, (_, i) => i);
  const counts: Array<{ j: number; count: number }> = [];
  for (let j = 0; j < pts.length; j += 1) {
    let count = 0;
    for (const t of terms) {
      if (ptHasTerm(pts[j], t)) count += 1;
    }
    if (count > 0) counts.push({ j, count });
  }
  counts.sort((a, b) => (b.count - a.count) || (a.j < b.j ? -1 : 1));
  return counts.slice(0, n).map(e => e.j);
}

function ptHasTerm(pt: PageTerms, term: string): boolean {
  for (const field of FIELD_ORDER) {
    if (pt.fields[field].tf.has(term)) return true;
  }
  return false;
}

/**
 * The page indices worth scoring. With an index, the union of the pages that
 * contain at least one query term. Without one, every page.
 */
function candidateIndices(terms: readonly string[], pageCount: number, index?: InvertedIndex): number[] {
  if (!index) return Array.from({ length: pageCount }, (_, i) => i);
  const out = new Set<number>();
  for (const t of terms) {
    const direct = index.termToPages.get(t);
    if (direct) for (const p of direct) out.add(p);
    // The scorer falls back to character trigrams for a term the corpus has
    // never seen (`bm25fScore`'s `df === 0` branch). The candidate set must
    // follow the same rule or a page the scorer would match through its grams
    // is skipped and the ranking changes. `wordGrams` is the scorer's own
    // function, so the two cannot drift.
    if (!direct || direct.length === 0) {
      for (const g of wordGrams(t)) {
        const pages = index.termToPages.get(g);
        if (pages) for (const p of pages) out.add(p);
      }
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * The words these pages carry that the query does not say, ordered by how
 * rare they are across the corpus. Rarity is the whole filter: a word every
 * page uses tells us nothing about which page this query wants, and a word
 * only the neighbourhood uses is the topic's own vocabulary.
 */
function distinctive(
  pages: readonly ExpansionPage[],
  indices: readonly number[],
  queryTerms: readonly string[],
  topM: number,
  /** The per-page term tables. When given, the function reads the segmented
   *  terms from them instead of re-segmenting every page — that was 2,148
   *  `segment()` calls per query on a 358-page corpus. */
  pts?: readonly PageTerms[],
): string[] {
  if (topM <= 0 || indices.length === 0) return [];
  const said = new Set(queryTerms);
  // Words of one page, deduplicated. With `pts` this is the keys of the four
  // field tf maps; without it, the page is segmented on the spot (the old
  // behaviour, kept for callers that have no tables).
  const wordsOf = (j: number): Set<string> => {
    if (pts && pts[j]) {
      const out = new Set<string>();
      for (const field of FIELD_ORDER) {
        for (const w of pts[j].fields[field].tf.keys()) out.add(w);
      }
      return out;
    }
    const p = pages[j];
    return new Set([...segment(p.title), ...segment(p.summary), ...segment(p.text)]);
  };
  const df = new Map<string, number>();
  for (let j = 0; j < pages.length; j += 1) {
    for (const w of wordsOf(j)) {
      df.set(w, (df.get(w) ?? 0) + 1);
    }
  }
  const N = pages.length || 1;
  const scores = new Map<string, number>();
  for (const j of indices) {
    if (!pages[j]) continue;
    const words = wordsOf(j);
    for (const w of words) {
      if (said.has(w)) continue;
      const idf = Math.log(N / ((df.get(w) ?? 0) + 1));
      if (idf <= 0) continue;
      scores.set(w, (scores.get(w) ?? 0) + idf);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1))
    .slice(0, topM)
    .map(([w]) => w);
}
