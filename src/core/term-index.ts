// core/term-index.ts — #729 Phase 2: the representation layer.
//
// The scorer this replaces was a hand-tuned linear weight over text with no IDF
// (`retrieval-profile.ts`, `PROFILE_WEIGHTS = { title: 3, alias: 2, summary: 1,
// text: 1 }`). That shape keeps producing anomalies — stop words, generic words,
// long documents, ties — and each anomaly invited another patch. Eleven had
// accumulated on one scoring function before this was seen. BM25F folds them
// into one probabilistic function whose `k1` and `b` have literature defaults
// and whose **field weights do not**: dropping the title weight from 3 to 1
// moved MRR from 0.86 to 0.55, so they are calibrated on a harness and never
// assumed.
//
// Segmentation and the ranker land together for one reason: without
// segmentation a Chinese query is one token and the IDF table is built over
// whole clauses, which is not a ranker.
//
// NO LANGUAGE NAMES APPEAR IN THIS FILE. The split is Unicode script
// properties, which is the corpus-statistics principle the plan requires:
// `NO_BOUNDARY_SCRIPT` (Han, Hiragana, Katakana, Hangul, Thai) has no spaces to
// split on, so it contributes character bigrams; every other script contributes
// whole words. That covers English/German (spaces), Russian (spaces), Chinese,
// and Japanese/Korean — the four regimes the fixtures cover — without a single
// `if (lang === …)` branch. A boundary-less script is a fact about the writing
// system, not a guess about the user's language.

import {
  WORD_CHAR_CLASS,
  NO_BOUNDARY_SCRIPT,
} from './retrieval-profile';

/** Scripts with no inter-word separator. Splitting them on whitespace yields
 *  whole clauses, which is why the old lexical stage saw a Chinese query as one
 *  all-or-nothing needle. */
const NO_BOUNDARY = new RegExp(`[${NO_BOUNDARY_SCRIPT}]`, 'u');
const WORD_CHAR = new RegExp(`[${WORD_CHAR_CLASS}]`, 'u');
const NOT_WORD_CHAR = new RegExp(`[^${WORD_CHAR_CLASS}]`, 'u');

/**
 * Segment text into index terms.
 *
 * Terms are lowercased. Bounded-word runs become whole terms; runs of a
 * boundary-less script become character bigrams, and a run of exactly one
 * character becomes that character alone (a bigram needs two). A run mixing a
 * boundary-less script with a word character is split at the script change, so
 * `LSTM模型` contributes `lstm` and `模型`.
 *
 * Pure. No IO. Deterministic for the same input.
 */
export function segment(text: string): string[] {
  const terms: string[] = [];
  const lower = text.toLowerCase();
  const chars = [...lower];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (NOT_WORD_CHAR.test(ch)) {
      i += 1;
      continue;
    }
    const boundaryless = NO_BOUNDARY.test(ch);
    let j = i;
    while (j < chars.length) {
      const c = chars[j];
      if (NOT_WORD_CHAR.test(c)) break;
      if (NO_BOUNDARY.test(c) !== boundaryless) break;
      j += 1;
    }
    const run = chars.slice(i, j).join('');
    if (boundaryless) {
      if (run.length === 1) terms.push(run);
      else for (let k = 0; k + 1 < run.length; k += 1) terms.push(run.slice(k, k + 2));
    } else if (WORD_CHAR.test(run)) {
      terms.push(run);
    }
    i = j;
  }
  return terms;
}

/** One page's term statistics for one field. `tf` counts terms. */
export interface FieldTerms {
  readonly tf: ReadonlyMap<string, number>;
  readonly length: number;
}

/** Which field a term was found in. Field weights are calibrated, not assumed. */
export type FieldName = 'title' | 'alias' | 'summary' | 'text';

export const FIELD_ORDER: readonly FieldName[] = ['title', 'alias', 'summary', 'text'];

/** Per-page term statistics across the four fields. */
export interface PageTerms {
  readonly fields: Readonly<Record<FieldName, FieldTerms>>;
}

/** Term-frequency statistics over a corpus. The IDF table. */
export interface CorpusTerms {
  readonly docCount: number;
  /** term → number of documents containing it, counted once per document. */
  readonly docFreq: ReadonlyMap<string, number>;
  /** Mean length per field, for BM25F length normalisation. */
  readonly avgFieldLength: Readonly<Record<FieldName, number>>;
}

function countField(texts: readonly string[]): FieldTerms {
  const tf = new Map<string, number>();
  let length = 0;
  for (const t of texts) {
    for (const term of segment(t)) {
      length += 1;
      tf.set(term, (tf.get(term) ?? 0) + 1);
    }
  }
  return { tf, length };
}

/** Build one page's term statistics. Pure. */
export function buildPageTerms(input: {
  title: string;
  aliases: readonly string[];
  summary: string;
  text: string;
}): PageTerms {
  return {
    fields: {
      title: countField([input.title]),
      alias: countField(input.aliases),
      summary: countField([input.summary]),
      text: countField([input.text]),
    },
  };
}

/** Build the corpus IDF table. Pure. */
export function buildCorpusTerms(pages: readonly PageTerms[]): CorpusTerms {
  const docFreq = new Map<string, number>();
  const totals: Record<FieldName, number> = { title: 0, alias: 0, summary: 0, text: 0 };
  for (const page of pages) {
    // Document frequency counts a DOCUMENT once, not once per field. Counting
    // per field let one page push `df` past `docCount`, which made
    // `N - df + 0.5` negative and every score negative with it.
    const seen = new Set<string>();
    for (const field of FIELD_ORDER) {
      const f = page.fields[field];
      totals[field] += f.length;
      for (const term of f.tf.keys()) {
        if (seen.has(term)) continue;
        seen.add(term);
        docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      }
    }
  }
  const n = pages.length;
  const avgFieldLength: Record<FieldName, number> = {
    title: n ? totals.title / n : 0,
    alias: n ? totals.alias / n : 0,
    summary: n ? totals.summary / n : 0,
    text: n ? totals.text / n : 0,
  };
  return { docCount: n, docFreq, avgFieldLength };
}

/**
 * BM25F. Returns the query-independent denominator pieces per term so callers
 * can also ask for a per-term explanation (the diagnostic command needs it).
 *
 * `idf` is the standard BM25 form `ln(1 + (N - df + 0.5)/(df + 0.5))`, which
 * stays positive for terms in every document instead of going to zero.
 *
 * The **field weights are the calibrated part**. `k1 = 1.2` and `b = 0.75` are
 * literature defaults and are not tuned here. Passing weights is how the
 * harness finds them; the default is the old hand-tuned ratio expressed as
 * numbers this function owns, so behaviour is comparable from day one.
 */
export const BM25_K1 = 1.2;
export const BM25_B = 0.75;

export interface FieldWeights {
  readonly title: number;
  readonly alias: number;
  readonly summary: number;
  readonly text: number;
}

/** The old hand-tuned ratio, as a starting point for the harness to move. */
export const DEFAULT_FIELD_WEIGHTS: FieldWeights = { title: 3, alias: 2, summary: 1, text: 1 };

/** Score one page against a query. Pure. */
export function bm25fScore(
  queryTerms: readonly string[],
  page: PageTerms,
  corpus: CorpusTerms,
  weights: FieldWeights = DEFAULT_FIELD_WEIGHTS,
  k1: number = BM25_K1,
  b: number = BM25_B,
): number {
  let score = 0;
  for (const term of new Set(queryTerms)) {
    const df = corpus.docFreq.get(term) ?? 0;
    if (df === 0) continue;
    const idf = Math.log(1 + (corpus.docCount - df + 0.5) / (df + 0.5));
    let weighted = 0;
    for (const field of FIELD_ORDER) {
      const f = page.fields[field];
      const tf = f.tf.get(term) ?? 0;
      if (tf === 0) continue;
      const avg = corpus.avgFieldLength[field] || 1;
      const norm = 1 - b + (b * f.length) / avg;
      weighted += weights[field] * (tf / norm);
    }
    if (weighted === 0) continue;
    score += (idf * weighted) / (k1 + weighted);
  }
  return score;
}
