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
 * Inverted index: term to the indices of the pages that carry it.
 *
 * Why. `bm25fScore` contributes zero for a page that contains none of the
 * query's terms, but a full scan visits every page anyway. The index lets the
 * scorer visit only pages that can score. The result is identical; only the
 * work is smaller.
 *
 * A term appears once per page even when the page repeats it across fields:
 * the index answers "which pages contain this term", not "how often".
 */
export interface InvertedIndex {
  readonly termToPages: ReadonlyMap<string, readonly number[]>;
}

export function buildInvertedIndex(pages: readonly PageTerms[]): InvertedIndex {
  const termToPages = new Map<string, number[]>();
  const add = (key: string, i: number, seen: Set<string>) => {
    if (seen.has(key)) return;
    seen.add(key);
    const list = termToPages.get(key);
    if (list) list.push(i);
    else termToPages.set(key, [i]);
  };
  for (let i = 0; i < pages.length; i += 1) {
    const seen = new Set<string>();
    for (const field of FIELD_ORDER) {
      const f = pages[i].fields[field];
      for (const term of f.tf.keys()) add(term, i, seen);
      // The scorer falls back to character trigrams for a term the corpus has
      // never seen (`bm25fScore`'s `df === 0` branch). The index must offer
      // those grams as candidates too, or a page that the scorer would match
      // through its grams is skipped and the ranking changes.
      for (const gram of f.gramTf.keys()) add(gram, i, seen);
    }
  }
  return { termToPages };
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
/**
 * Field weights for BM25F. `text` is the page BODY.
 *
 * B-1 (#819): the body is the only lexical lever that crosses a real vocabulary
 * gap. Measured on the strict set — pairs where A and B share under a third of
 * their terms — the lex channel scores 0.000 with `text: ''` and 0.385 at
 * weight 1 on test8, 0.268 on test10.
 *
 * The weight is 1, not a discount. Measured across 0.15 / 0.3 / 0.6 / 1.0 on
 * both vaults the curve is MONOTONIC — 0.221 / 0.334 / 0.385 on test8 — and
 * self-resolution stays 1.000 at every value, up to and including 2.0. There is
 * no trade to make here, so there is no reason to discount.
 *
 * A 0.3 value was tried and reverted. It came from an external calibration that
 * reported a 0.3-0.6 plateau on a different corpus; on ours the plateau does
 * not exist in that range. External numbers describe external corpora.
 */
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
function fieldLengthNorm(field: FieldName, length: number, corpus: CorpusTerms): number {
  // THE BODY IS NOT LENGTH-NORMALISED.
  //
  // Measured on two vaults, truth edge removed, strict set (pairs sharing under
  // a third of their terms): turning the normaliser off for `text` moves recall
  // from 0.385 to 0.431 at k=10 on test8 and 0.268 to 0.326 on test10. That is
  // the whole gap between the production substring scorer and BM25F.
  //
  // The reason is structural. `1 - b + b * len / avg` damps a field much longer
  // than average, and the body is the only long field — hundreds of words
  // against a title's few. On the strict set a body hit is the RARE signal:
  // 99 % of the bridging terms live in the body and nowhere else. The
  // normaliser was damping exactly the evidence the strict layer exists to
  // find.
  //
  // BM25's assumption is "a long field matched by chance more often". True for
  // prose about a common word; false for a rare term in one page's body.
  // `title`, `alias` and `summary` keep the classic form — short fields, where
  // the normaliser is close to neutral. Zero cost: one comparison.
  if (field === 'text') return 1;
  const avg = corpus.avgFieldLength[field] || 1;
  return 1 - BM25_B + (BM25_B * length) / avg;
}

/**
 * A query term with its own weight. A caller that mixes history into the
 * query weights the history's words lower than the question's; the scorer
 * does not know why, only by how much. Plain strings mean weight 1.
 */
export interface WeightedTerm {
  readonly term: string;
  readonly weight: number;
}

function asWeighted(terms: readonly (string | WeightedTerm)[]): WeightedTerm[] {
  return terms.map(t => (typeof t === 'string' ? { term: t, weight: 1 } : t));
}

export function bm25fScore(
  queryTerms: readonly (string | WeightedTerm)[],
  page: PageTerms,
  corpus: CorpusTerms,
  weights: FieldWeights = DEFAULT_FIELD_WEIGHTS,
  k1: number = BM25_K1,
  b: number = BM25_B,
): number {
  let score = 0;
  const weighted = asWeighted(queryTerms);
  // A repeated query term is counted once (the query is a set of terms, not a
  // bag). If the same term arrives with different weights the first wins —
  // the caller that repeats a term is not asking for more of it.
  const byTerm = new Map<string, number>();
  for (const { term, weight } of weighted) {
    if (!byTerm.has(term)) byTerm.set(term, weight);
  }
  for (const [term, termWeight] of byTerm) {
    if (termWeight === 0) continue;
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
          const norm = fieldLengthNorm(field, f.length, corpus);
          weighted += weights[field] * (tf / (k1 * norm + tf));
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
      score += termWeight * (acc / grams.length);
      continue;
    }
    const idf = Math.log(1 + (corpus.docCount - df + 0.5) / (df + 0.5));
    let weighted = 0;
    for (const field of FIELD_ORDER) {
      const f = page.fields[field];
      const tf = f.tf.get(term) ?? 0;
      if (tf === 0) continue;
      const norm = fieldLengthNorm(field, f.length, corpus);
      // Per-field tf saturation (#819 P0-1), in the classic BM25 form
      // `tf / (k1*norm + tf)`. Repetition is weak evidence — saying a word three
      // times is not three facts. With a LINEAR tf inside the field sum, `1 x 3`
      // in summary exactly cancels `3 x 1` in title and the two tie, which is
      // how a keyword-stuffed distractor outranked a title hit.
      //
      // The length normaliser sits INSIDE the saturation denominator, not
      // outside it. Dividing a saturated tf by `norm` over-corrects: a page that
      // repeats a term and is proportionally longer then scores BELOW a shorter
      // page mentioning it once, which is wrong — density is what should be
      // rewarded. In this form repetition helps with diminishing returns and
      // length still damps it.
      weighted += weights[field] * (tf / (k1 * norm + tf));
    }
    if (weighted === 0) continue;
    // The caller's per-term weight scales the whole contribution. A history
    // word at 0.3 is worth a third of the question's own word; the scorer
    // does not know why, only by how much.
    score += termWeight * (idf * weighted) / (k1 + weighted);
  }
  return score;
}
