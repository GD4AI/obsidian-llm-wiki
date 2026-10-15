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

import { segment, buildPageTerms, bm25fScore, DEFAULT_FIELD_WEIGHTS, type PageTerms, type CorpusTerms } from './term-index';

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
): string[] {
  if (queryTerms.length === 0 || pages.length === 0) return queryTerms;
  const pts: PageTerms[] = pages.map(p => buildPageTerms({
    title: p.title,
    aliases: [],
    summary: p.summary,
    text: p.text,
  }));

  const first = [...queryTerms, ...distinctive(pages, scoredIndices(queryTerms, pts, corpus, opts.k1), queryTerms, opts.m1)];
  if (opts.k2 <= 0 || opts.m2 <= 0) return first;

  const reranked = scoredIndices(first, pts, corpus, opts.k2);
  const second = [...first, ...distinctive(pages, reranked, first, opts.m2)];
  return second;
}

/** Indices whose score is above zero, in rank order. A page that scores zero
 *  shares no term with the query, so its vocabulary is not this query's
 *  vocabulary and reading it would add noise. */
function scoredIndices(terms: string[], pts: PageTerms[], corpus: CorpusTerms, k: number): number[] {
  return pts
    .map((pt, j) => ({ j, score: bm25fScore(terms, pt, corpus, DEFAULT_FIELD_WEIGHTS) }))
    .filter(e => e.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.j < b.j ? -1 : 1))
    .slice(0, k)
    .map(e => e.j);
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
): string[] {
  if (topM <= 0 || indices.length === 0) return [];
  const said = new Set(queryTerms);
  const df = new Map<string, number>();
  for (const p of pages) {
    for (const w of new Set([...segment(p.title), ...segment(p.summary), ...segment(p.text)])) {
      df.set(w, (df.get(w) ?? 0) + 1);
    }
  }
  const N = pages.length || 1;
  const scores = new Map<string, number>();
  for (const j of indices) {
    const p = pages[j];
    if (!p) continue;
    const words = new Set([...segment(p.title), ...segment(p.summary), ...segment(p.text)]);
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
