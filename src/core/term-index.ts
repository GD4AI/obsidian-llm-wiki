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
 * The input is normalised to **NFKC** first (#819 review, fix A). That composes
 * NFD Hangul and accents to their canonical form, folds full-width Latin, and
 * composes half-width katakana, so a page written either way indexes the same
 * terms. It does **not** strip diacritics: `café` stays `café` and is a different
 * term from `cafe`. Folding is reserved for the unseen-word fallback, where it
 * can only rescue a zero score and can never merge two exact terms.
 *
 * Runs are kept as **code-point** arrays, never as strings (#819 review, fix B).
 * Slicing a joined string by UTF-16 units split astral-plane ideographs such as
 * 𠮷 (U+20BB7) and emitted an orphaned low surrogate as a term.
 *
 * Pure. No IO. Deterministic for the same input.
 */
export function segment(text: string): string[] {
  const terms: string[] = [];
  const lower = text.normalize('NFKC').toLowerCase();
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
    const run = chars.slice(i, j);
    if (boundaryless) {
      if (run.length === 1) terms.push(run[0]);
      else for (let k = 0; k + 1 < run.length; k += 1) terms.push(run[k] + run[k + 1]);
    } else {
      const word = run.join('');
      if (WORD_CHAR.test(word)) terms.push(word);
    }
    i = j;
  }
  return terms;
}

/** One page's term statistics for one field. `tf` counts terms. */
export interface FieldTerms {
  readonly tf: ReadonlyMap<string, number>;
  /** Character-gram counts for the unseen-word fallback (#819 review, fix D). */
  readonly gramTf: ReadonlyMap<string, number>;
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
  /** Character-gram document frequency, for the unseen-word fallback. */
  readonly gramDocFreq: ReadonlyMap<string, number>;
}

function countField(texts: readonly string[]): FieldTerms {
  const tf = new Map<string, number>();
  const gramTf = new Map<string, number>();
  let length = 0;
  for (const t of texts) {
    for (const term of segment(t)) {
      length += 1;
      tf.set(term, (tf.get(term) ?? 0) + 1);
      // Grams are a rescue path for unseen query words, not a second content
      // stream. They are counted separately and never in `length`, so they
      // cannot distort the length normalisation.
      for (const g of new Set(wordGrams(term))) {
        gramTf.set(g, (gramTf.get(g) ?? 0) + 1);
      }
    }
  }
  return { tf, gramTf, length };
}

/** Character width of the fallback gram. Three letters survives an inflection. */
export const GRAM_N = 3;

/**
 * Character n-grams of one bounded-word term, for the unseen-word fallback
 * (#819 review, fix D). A boundaryless run is already bigrammed and gets none.
 *
 * Combining diacritics U+0300–U+036F are folded **here only**. The primary term
 * keeps them, so `café` and `cafe` remain distinct exact terms and Vietnamese
 * `má`/`ma`/`mạ` each match their own page. Folding happens on the rescue path,
 * where it can only lift a zero score and can never merge two exact terms.
 *
 * Pure. No IO.
 */
export function wordGrams(term: string): string[] {
  if (term.length === 0 || NO_BOUNDARY.test(term)) return [];
  const cps = [...term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')];
  if (cps.length < GRAM_N) return [];
  const out: string[] = [];
  for (let k = 0; k + GRAM_N <= cps.length; k += 1) out.push(cps.slice(k, k + GRAM_N).join(''));
  return out;
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
  // Pages that HAVE a non-empty field (#819 review, fix C). Averaging field
  // length over ALL pages dragged `alias` to 0.055 when most pages have none,
  // which made an alias hit worth about a seventh of a title hit. The design
  // intent is the declared weight ratio of 2:3. A field nobody holds stays 0 and
  // the scorer's `|| 1` keeps it out of the way.
  const having: Record<FieldName, number> = { title: 0, alias: 0, summary: 0, text: 0 };
  const gramDocFreq = new Map<string, number>();
  for (const page of pages) {
    // Document frequency counts a DOCUMENT once, not once per field. Counting
    // per field let one page push `df` past `docCount`, which made
    // `N - df + 0.5` negative and every score negative with it.
    const seen = new Set<string>();
    const seenGrams = new Set<string>();
    for (const field of FIELD_ORDER) {
      const f = page.fields[field];
      totals[field] += f.length;
      if (f.length > 0) having[field] += 1;
      for (const g of f.gramTf.keys()) {
        if (seenGrams.has(g)) continue;
        seenGrams.add(g);
        gramDocFreq.set(g, (gramDocFreq.get(g) ?? 0) + 1);
      }
      for (const term of f.tf.keys()) {
        if (seen.has(term)) continue;
        seen.add(term);
        docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      }
    }
  }
  const n = pages.length;
  const avgFieldLength: Record<FieldName, number> = {
    title: having.title ? totals.title / having.title : 0,
    alias: having.alias ? totals.alias / having.alias : 0,
    summary: having.summary ? totals.summary / having.summary : 0,
    text: having.text ? totals.text / having.text : 0,
  };
  return { docCount: n, docFreq, avgFieldLength, gramDocFreq };
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

/**
 * The name tier's share of the query's total IDF. Unitless, in [0, 1].
 *
 * This replaces `lexStrong`'s absolute-scale gate. The old gate read
 * `lexTopScore >= 5`, where the score was title 3 / alias 2 — a number whose
 * meaning came entirely from that weight table. BM25F has no absolute scale,
 * so the same comparison fails silently: measured, the LLM escalation gate
 * fired 4 times on a suite where it must fire 0, and 100 % of queries
 * escalated on a real 174-page vault. Nothing in the code reported it.
 *
 * A ratio has no scale to drift against. Matching a rare term moves it more
 * than matching a stop word, which is the discrimination the old count could
 * not express: two pages matching one needle each were equal even when one
 * needle was `deepseek` and the other was `the`.
 *
 * The threshold is a separate question from the statistic and is calibrated on
 * the harness, not assumed. `LEX_COVERAGE_MIN` is the starting point.
 */
export function nameTierCoverage(
  queryTerms: readonly string[],
  page: PageTerms,
  corpus: CorpusTerms,
): number {
  const unique = [...new Set(queryTerms)];
  if (unique.length === 0) return 0;
  let total = 0;
  let matched = 0;
  for (const term of unique) {
    const df = corpus.docFreq.get(term) ?? 0;
    // A term in no document has no IDF to contribute and cannot match. It
    // counts in the denominator only when it exists somewhere, so a typo in
    // the query does not drag the ratio toward zero for every page.
    if (df === 0) continue;
    const idf = Math.log(1 + (corpus.docCount - df + 0.5) / (df + 0.5));
    total += idf;
    const inNameTier = page.fields.title.tf.has(term) || page.fields.alias.tf.has(term);
    if (inNameTier) matched += idf;
  }
  if (total === 0) return 0;
  return matched / total;
}

/** Starting point for the coverage gate. Calibrated on the harness. */
export const LEX_COVERAGE_MIN = 0.5;

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
    if (df === 0) {
      // Unseen word (#819 review, fix D). Its trigrams stand in for it, and the
      // average keeps a full overlap worth exactly one term. The exact path is
      // untouched: a word present in the corpus never reaches this branch, so
      // the fallback cannot compete with the very term it would approximate.
      const grams = [...new Set(wordGrams(term))];
      if (grams.length === 0) continue;
      let acc = 0;
      let matched = 0;
      for (const g of grams) {
        const gdf = corpus.gramDocFreq.get(g) ?? 0;
        if (gdf === 0) continue;
        const gidf = Math.log(1 + (corpus.docCount - gdf + 0.5) / (gdf + 0.5));
        let weighted = 0;
        for (const field of FIELD_ORDER) {
          const f = page.fields[field];
          const tf = f.gramTf.get(g) ?? 0;
          if (tf === 0) continue;
          const avg = corpus.avgFieldLength[field] || 1;
          const norm = 1 - b + (b * f.length) / avg;
          weighted += weights[field] * (tf / norm);
        }
        if (weighted === 0) continue;
        matched += 1;
        acc += (gidf * weighted) / (k1 + weighted);
      }
      // A fallback needs at least two overlapping grams AND at least three
      // grams to begin with. One trigram is coincidence, and a short word has
      // too little signal: `kann` matched `Pekannüsse` on both its grams. This
      // is the same reasoning the boundary-less path uses — a two-character
      // needle has one bigram and would open the floor to half the vault. So a
      // word under five characters cannot fall back at all; it still matches
      // exactly when it exists in the corpus.
      if (grams.length < 3 || matched < 2) continue;
      score += acc / grams.length;
      continue;
    }
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
