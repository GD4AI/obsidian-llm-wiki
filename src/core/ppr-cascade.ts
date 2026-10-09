// ppr-cascade.ts — v1.23.0 Graph Engine hybrid cascade
//
// Pure function. Per #198 / 2026-06-24 Q3 consensus (cold-start
// cascade), the query-time retrieval uses a 3-arm cascade that picks
// the right retrieval strategy based on graph maturity:
//
//   1. lex — when graph is below threshold or seed is isolated.
//   2. lex-seeded-ppr — when graph has neighbors but is below the
//      graph-first density threshold.
//   3. graph-first-ppr — when graph is mature (edges/nodes >= threshold
//      AND largest weak component > 50% of nodes).
//
// Each arm is annotated in the returned PageMatch.arm field, so the
// UI can show the user "Powered by graph-first PPR" or "Lex fallback
// (graph too sparse)" — making the cascade transparent.
//
// The cascade is a pure function. The graph is passed in by the caller
// (query-engine caches the graph and rebuilds it on ingest). This
// keeps the cascade testable without an Obsidian dependency.

import { personalizedPageRank, seededRngFrom, type Graph, type PPROptions } from './monte-carlo-ppr';
import {
  needleHits,
  scoreProfile,
  WORD_CHAR_CLASS,
  BOUNDED_WORD_CHAR,
} from './retrieval-profile';
import {
  segment,
  buildPageTerms,
  buildCorpusTerms,
  bm25fScore,
  DEFAULT_FIELD_WEIGHTS,
  FIELD_ORDER,
  type CorpusTerms,
  type FieldWeights,
} from './term-index';

// `needleHits` moves to `retrieval-profile.ts`, which owns "how a query matches
// a page", and is re-exported here so existing callers keep their import path.
export { needleHits };

export type { Graph, PPROptions };

export interface PageRef {
  path: string;
  title: string;
  aliases: string[];
  /**
   * Optional text representation of the page — typically the summary
   * line from the wiki index. When provided, lexMatch uses this in
   * addition to title/aliases. The full text makes matching robust
   * across languages (e.g. CJK queries about English-topic pages still
   * match because the summary mentions the topic).
   */
  summary?: string;
}

/**
 * v1.24.1 PATCH Phase 5.5.0: render a PageRef as a compact markdown
 * line (`path — title | aliases: ...`) for LLM candidate lists and the
 * chat-prompt page-summary hint. Shared so the Stage 1.5 seed-selector
 * prompt and the Phase 5.5.0 pageSummaryHint emit an identical format
 * (one formatter, no drift). Pure function.
 */
export function formatPageRefSummary(p: PageRef): string {
  const aliasPart = p.aliases.length > 0
    ? ` | aliases: ${p.aliases.join(' / ')}`
    : '';
  return `- ${p.path} — ${p.title}${aliasPart}`;
}

/**
 * Score pages by per-needle overlap. Shared primitive behind Stage 1 (lex,
 * needles = tokenized query) and Stage 1.5b (LLM-generated keywords). Needles
 * are expected lowercased; each page's title + aliases are lowercased
 * internally. Returns pages with score > 0, sorted by score descending, with
 * the count of needles matched (`tokensFound`) so callers can apply a
 * multi-needle bonus. Pure function — no IO.
 *
 * #729 Phase 2: the default scorer is now BM25F over a term index built from
 * title, aliases and summary. The hand-tuned linear scorer (`scoreProfile`,
 * title 3 / alias 2 / summary 1 / text 1) is kept behind `scorer: 'legacy'`
 * and is not the default. The project convention is a new feature on by
 * default with a switch to turn it off, not the reverse.
 *
 * Why BM25F rather than another weight table: a linear weight over text with
 * no IDF cannot say that a generic term is worth less than a specific one, and
 * every anomaly that produced became another patch — eleven on one function.
 * See `term-index.ts`.
 *
 * The corpus IDF table is built once per call unless the caller passes one.
 * Callers that score many queries over the same page set should build it once
 * and pass it; rebuilding it per query is the one performance trap in this
 * layer.
 */
export interface ScorePagesOptions {
  /** `bm25f` (default) or `legacy` — the old linear scorer, kept for A/B. */
  readonly scorer?: 'bm25f' | 'legacy';
  /** A prebuilt IDF table over the same page set. Built from `pages` when absent. */
  readonly corpus?: CorpusTerms;
  /** Field weights. Defaults to the old ratio; the harness calibrates them. */
  readonly weights?: FieldWeights;
}

export function scorePagesByNeedles(
  pages: PageRef[],
  needles: string[],
  options: ScorePagesOptions = {},
): Array<{ page: PageRef; score: number; tokensFound: number }> {
  const useLegacy = options.scorer === 'legacy';
  // BM25F needs one query term list, segmented the same way the index is.
  // A needle is already a token; segmenting it turns a Chinese clause into
  // bigrams, which is what makes a Chinese query match at all.
  const queryTerms = useLegacy ? needles : needles.flatMap(n => segment(n));
  const pageTerms = useLegacy ? [] : pages.map(p => buildPageTerms({
    title: p.title,
    aliases: p.aliases,
    summary: p.summary ?? '',
    text: '',
  }));
  const corpus = useLegacy ? undefined : (options.corpus ?? buildCorpusTerms(pageTerms));
  const weights = options.weights ?? DEFAULT_FIELD_WEIGHTS;

  const scored: Array<{ page: PageRef; score: number; tokensFound: number }> = [];
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    let score: number;
    let tokensFound: number;
    if (useLegacy) {
      // Four tiers — title, alias, summary, prose — from one table. The summary
      // tier is the fix for #729's measured loss; see `retrieval-profile.ts`.
      const s = scoreProfile(
        { title: page.title, aliases: page.aliases, summary: page.summary },
        needles,
      );
      score = s.score;
      tokensFound = s.tokensFound;
    } else {
      score = bm25fScore(queryTerms, pageTerms[i], corpus!, weights);
      // Breadth still matters to callers that apply a multi-needle bonus, so
      // count how many distinct needles landed rather than how many terms.
      tokensFound = needles.filter(n => segment(n).some(t => {
        for (const f of FIELD_ORDER) if (pageTerms[i].fields[f].tf.has(t)) return true;
        return false;
      })).length;
    }
    if (score > 0) {
      scored.push({ page, score, tokensFound });
    }
  }
  // Ties do not follow the array. Two pages with the same score separate on
  // the breadth of the match — more distinct needles matched is a better page —
  // and only then on a stable identity. Sorting by the caller's order made the
  // cut a lottery; sorting by path alone would make it an alphabetical rule,
  // which is the same defect in a different hat.
  scored.sort(
    (a, b) =>
      b.score - a.score
      || b.tokensFound - a.tokensFound
      || (a.page.path < b.page.path ? -1 : a.page.path > b.page.path ? 1 : 0),
  );
  return scored;
}

// The character classes and the needle matcher live in `retrieval-profile.ts`.
// The tokenizer keeps its two own regexes here because nothing else uses them.
const WORD_RUN = new RegExp(`${BOUNDED_WORD_CHAR}{2,}`, 'gu');
/**
 * Leading/trailing characters that are not part of any word — punctuation
 * for our purposes. Two alternatives so a token that is nothing but
 * punctuation collapses to the empty string.
 */
const EDGE_PUNCTUATION = new RegExp(`^[^${WORD_CHAR_CLASS}]+|[^${WORD_CHAR_CLASS}]+$`, 'gu');

/**
 * v1.24.1 PATCH Phase 5.5.0: lex match against TITLE + ALIASES only
 * (no summary). Powers the Stage 1 of the 4-stage seed-selection
 * pipeline.
 *
 * Why no summary: user vault pages frequently lack summary frontmatter
 * (e.g. entities/Janus.md has no `summary:` field but rich aliases).
 * Using summary in Stage 1 would silently drop many pages from
 * consideration — including the page the user just searched for.
 * Aliases carry the curated "what is this page" signal — stable,
 * short, and explicitly written.
 *
 * Scoring (per token, first matching location wins):
 *   - title hit: 3
 *   - alias hit: 2
 *
 * Multi-token bonus: when ALL tokens are found somewhere in the
 * page's title+aliases, +2 (strong relevance signal).
 *
 * Returns scored+ranked pages sorted by score descending. Pages
 * with zero overlap are NOT included. Pure function — no IO.
 */
export function lexMatchByTitleAndAliases(
  query: string,
  pages: PageRef[],
): Array<{ page: PageRef; score: number; arm: 'lex' }> {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  // The lex stage keeps the **legacy** scorer for now, and that is deliberate
  // rather than a hedge: this function's documented contract is the absolute
  // score scale (title 3 / alias 2), and `lexStrong`'s gate is calibrated on
  // exactly that scale (`LEX_MATCH_MIN_TOP_SCORE = 5`). Moving one without the
  // other is the silent failure the #729 plan names — the gate stops firing and
  // nothing reports it. Measured on the way to this commit: with BM25F here the
  // LLM escalation gate fired 4 times where it must fire 0. Phase 3 moves the
  // scorer and the gate together, and makes the gate a unitless coverage
  // statistic so no scale survives to drift against.
  return scorePagesByNeedles(pages, tokens, { scorer: 'legacy' }).map(s => {
    let score = s.score;
    if (s.tokensFound === tokens.length && tokens.length > 1) {
      score += 2;
    }
    return { page: s.page, score, arm: 'lex' as const };
  });
}

export interface PageMatch {
  page: PageRef;
  score: number;
  arm: 'lex' | 'lex-seeded-ppr' | 'graph-first-ppr';
}

export interface PPRCascadeOptions {
  graph?: Graph;
  minPages?: number;
  minEdges?: number;
  minEdgeDensity?: number;
  seedMinDegree?: number;
  topN?: number;
  pprOptions?: PPROptions;
  /**
   * Explicit seed list (typically from LLM semantic selection).
   * When provided AND non-empty, these seeds drive PPR walks instead of
   * the implicit lex top-3. Validated against graph.nodes; invalid seeds
   * (not in graph) are silently dropped.
   */
  seeds?: string[];
  /** Optional RNG (mulberry32 helper) for deterministic PPR sampling. */
  rng?: () => number;
}

const DEFAULT_MIN_PAGES = 30;
const DEFAULT_MIN_EDGES = 30;
const DEFAULT_MIN_EDGE_DENSITY = 1.0;
const DEFAULT_SEED_MIN_DEGREE = 1;
const DEFAULT_TOP_N = 10;
/** Share of the top PPR mass the lex rank hint may add — see mergeWithPPR. */
const LEX_HINT_WEIGHT = 0.1;

/**
 * Tokenize a query into individual searchable terms. Language-aware:
 *
 * - ASCII runs of length ≥ 2 are extracted (handles mixed-language queries
 *   like "什么是Obsidian？" → "obsidian")
 * - Whitespace-split tokens (length ≥ 2) are kept
 * - **CJK runs of length ≥ 2** are extracted (handles "深度学习" → "深度学习")
 * - Single-character tokens (ASCII or CJK) are NOT extracted — they are
 *   noise that produces spurious matches (e.g. "深" hits any page with
 *   "深" anywhere). Per first-principles (2026-07-13 user direction):
 *   text segmentation should be by meaningful run, not by character.
 *
 * All tokens are lowercased and de-duplicated.
 */
export function tokenizeQuery(query: string): string[] {
  if (!query) return [];
  const tokens = new Set<string>();
  const queryLower = query.toLowerCase();

  // Word runs of length ≥ 2 in any space-delimited script, diacritics
  // included. An ASCII-only class split "über" into "ber" and
  // "eingeschränkter" into "eingeschr" + "nkter": fragments that matched
  // titles the query never named, and "ber" double-counted every title
  // "über" already hit. Cyrillic, Greek, Arabic … get the same treatment.
  const wordRuns = queryLower.match(WORD_RUN);
  if (wordRuns) for (const r of wordRuns) tokens.add(r);

  // Whitespace-split tokens of length ≥ 2 (catches words with CJK
  // mixed in: "InterVL和Janus" → "intervl和janus", "和" rejected by length).
  // Edge punctuation is stripped so "Creatin." and "nehmen?" do not
  // survive as needles that can never match a title.
  for (const raw of queryLower.split(/\s+/)) {
    const t = raw.replace(EDGE_PUNCTUATION, '');
    if (t.length >= 2) tokens.add(t);
  }

  // CJK Unified Ideographs (Chinese, Japanese Kanji) + Hiragana +
  // Katakana (Japanese) + Hangul Syllables / Jamo (Korean) +
  // CJK Ext A (rare Chinese). Extract CONTINUOUS runs of length ≥ 2
  // (single CJK characters are noise: they match too widely and
  // dilute lex precision — the substring "深" hits "深度", "深思",
  // "深色" etc. with equal weight, all spurious).
  const cjkRun = query.match(
    /[一-鿿぀-ゟ゠-ヿ가-힯ퟀ-퟿㐀-䶿]{2,}/g,
  );
  if (cjkRun) for (const r of cjkRun) tokens.add(r.toLowerCase());

  return [...tokens];
}

/**
 * v1.24.1 PATCH Phase 5.5.0: decide whether lex scoring is statistically
 * reliable for a given tokenized query.
 *
 * Per user direction (2026-07-13): avoid hardcoded CJK regex
 * detection. The fundamental signal is the distribution of token
 * LENGTHS in the tokenized query, not the character ranges
 * themselves.
 *
 * Lex scoring is reliable when:
 *   1. At least 2 tokens are multi-character (≥ 2 chars). A single
 *      multi-char token can only substring-match page titles with no
 *      way to break ties — the score collapses to "matched / not
 *      matched" with no granularity.
 *   2. AND most tokens are multi-character (≥ 50%). A query that
 *      tokenizes to 1 multi-char + 10 single-char tokens (typical
 *      for CJK-heavy queries with embedded Latin keywords) is
 *      dominated by low-discrimination single-char matches.
 *
 * Both conditions together — count AND proportion — give a robust
 * "is this lex-query worth trusting?" signal without enumerating
 * any character range.
 *
 * Examples:
 *   "DeepSeek DSA HCA" → 3 multi-char tokens (100%) → reliable
 *   "DSA" → 1 multi-char token → unreliable (single signal)
 *   "为我梳理DeepSeek的DSA和HCA" → 4 multi-char / 21 total (19%) → unreliable
 *   "你好世界" → 1 multi-char / 5 total (20%) → unreliable
 *   "???!!" → 1 multi-char token → unreliable
 *
 * Pure function. No IO. Use after tokenizeQuery.
 */
export function lexIsReliable(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  let multiCharCount = 0;
  for (const t of tokens) {
    if (t.length >= 2) multiCharCount++;
  }
  // Need BOTH at least 2 multi-char tokens AND ≥ 50% multi-char ratio.
  return multiCharCount >= 2 && multiCharCount / tokens.length >= 0.5;
}

/**
 * Lex-only match: scores pages by per-token keyword overlap against the
 * page's full text representation (title + aliases + optional summary).
 *
 * Robust across languages because:
 * - The summary provides context the LLM also uses
 * - tokenizeQuery extracts ASCII runs from mixed-language queries
 *
 * Scoring per query token (first matching location wins):
 * - title match: 3
 * - alias match: 2
 * - summary match: 1
 *
 * Page-level bonus:
 * - all query tokens found in page text: +2 (strong relevance signal)
 */
function lexMatch(query: string, pages: PageRef[]): PageRef[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];
  const scored: { page: PageRef; score: number }[] = [];
  for (const page of pages) {
    const titleLower = page.title.toLowerCase();
    const aliasLowers = page.aliases.map(a => a.toLowerCase());
    const summaryLower = (page.summary ?? '').toLowerCase();

    let score = 0;
    let tokensFound = 0;
    for (const kw of tokens) {
      if (needleHits(titleLower, kw)) { score += 3; tokensFound++; }
      else if (aliasLowers.some(a => needleHits(a, kw))) { score += 2; tokensFound++; }
      else if (needleHits(summaryLower, kw)) { score += 1; tokensFound++; }
    }
    if (tokensFound === tokens.length && tokens.length > 1) score += 2;
    if (score > 0) scored.push({ page, score });
  }
  return scored.sort((a, b) => b.score - a.score).map(s => s.page);
}

/**
 * Quick graph-maturity probe: returns true if the graph qualifies for
 * the graph-first PPR arm (per @GioiaZheng's consensus thresholds).
 */
function isGraphMature(graph: Graph, options: PPRCascadeOptions): boolean {
  const minPages = options.minPages ?? DEFAULT_MIN_PAGES;
  const minEdges = options.minEdges ?? DEFAULT_MIN_EDGES;
  const minEdgeDensity = options.minEdgeDensity ?? DEFAULT_MIN_EDGE_DENSITY;
  if (graph.nodes.length < minPages) return false;
  // Count edges (sum of out-degrees).
  let edgeCount = 0;
  for (const targets of graph.edges.values()) edgeCount += targets.length;
  if (edgeCount < minEdges) return false;
  // Edge density: edges/nodes ratio.
  if (edgeCount / graph.nodes.length < minEdgeDensity) return false;
  // Largest weak component: BFS from any node, count reachable.
  // (We do a single BFS from the first node; if it reaches > 50%
  // of nodes, the graph is connected-enough.)
  if (graph.nodes.length === 0) return false;
  const firstNode = graph.nodes[0];
  const visited = new Set<string>([firstNode]);
  const queue: string[] = [firstNode];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const next of graph.edges.get(node) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
    // Reverse edges: also follow incoming edges (treat as undirected
    // for connectivity).
    for (const [from, targets] of graph.edges) {
      if (targets.includes(node) && !visited.has(from)) {
        visited.add(from);
        queue.push(from);
      }
    }
  }
  return visited.size / graph.nodes.length > 0.5;
}

/**
 * Build a path → PPR score map by running PPR for each seed and
 * merging (max score per node).
 */
function pprFromSeeds(
  graph: Graph,
  seeds: string[],
  pprOptions: PPROptions | undefined,
  rng: (() => number) | undefined,
  query: string,
): Map<string, number> {
  // The walk is a function of its inputs. Without a seed the old
  // `Math.random` default made two runs over one query differ, which is a
  // lottery rather than a ranking: #729 cannot separate two arms under that
  // variance, and a user who asks twice gets two answers.
  const walkRng = rng ?? seededRngFrom(query, seeds, graph.nodes.length);
  const merged = new Map<string, number>();
  for (const seed of seeds) {
    if (!graph.nodes.includes(seed)) continue;
    const result = personalizedPageRank(graph, seed, { ...(pprOptions ?? {}), rng: walkRng });
    for (const [node, score] of result) {
      const existing = merged.get(node) ?? 0;
      if (score > existing) merged.set(node, score);
    }
  }
  return merged;
}

/**
 * Filter user-provided seeds to those present in the graph. Returns an
 * empty array if no valid seeds (caller should fall back to other arms).
 */
function filterSeedsToGraph(seeds: string[], graph: Graph): string[] {
  const nodeSet = new Set(graph.nodes);
  return seeds.filter(s => nodeSet.has(s));
}

export function pprCascade(
  query: string,
  pages: PageRef[],
  options: PPRCascadeOptions = {},
): PageMatch[] {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const lex = lexMatch(query, pages);
  const graph = options.graph;
  // Explicit seeds (from LLM) take precedence over implicit lex seeds.
  // Filter to graph nodes upfront — invalid seeds silently dropped.
  const explicitSeeds = options.seeds && graph
    ? filterSeedsToGraph(options.seeds, graph)
    : [];

  // v1.23.0 P2: When there's no graph yet (first query) but LLM provided
  // explicit seeds, those seeds should be returned directly as lex matches
  // rather than silently dropped. The seeds arrived via LLM semantic selection
  // which is a stronger signal than empty lex.
  if (!graph && explicitSeeds.length === 0 && options.seeds && options.seeds.length > 0) {
    const fallbackMatches: { page: PageRef; score: number; arm: 'lex' }[] = [];
    const seedPaths = new Set(options.seeds);
    for (const page of pages) {
      if (seedPaths.has(page.path)) {
        fallbackMatches.push({ page, score: 2, arm: 'lex' });
      }
    }
    if (fallbackMatches.length > 0) {
      return fallbackMatches;
    }
  }

  // Arm 1: pure lex if no graph or graph not mature.
  if (!graph || !isGraphMature(graph, options)) {
    // For the sparse arm, prefer explicit seeds if provided and they
    // have graph neighbors; otherwise fall back to lex-derived seeds.
    if (graph && explicitSeeds.length > 0) {
      const seedMinDegree = options.seedMinDegree ?? DEFAULT_SEED_MIN_DEGREE;
      const validSeeds = explicitSeeds.filter(s => (graph.edges.get(s)?.length ?? 0) >= seedMinDegree);
      if (validSeeds.length > 0) {
        const pprScores = pprFromSeeds(graph, validSeeds, options.pprOptions, options.rng, query);
        return mergeWithPPR(lex, pprScores, pages, topN, 'lex-seeded-ppr');
      }
    }
    if (graph && lex.length > 0) {
      const seedMinDegree = options.seedMinDegree ?? DEFAULT_SEED_MIN_DEGREE;
      const seedPaths = lex.slice(0, 3).map(p => p.path);
      const validSeeds = seedPaths.filter(s => (graph.edges.get(s)?.length ?? 0) >= seedMinDegree);
      if (validSeeds.length > 0) {
        const pprScores = pprFromSeeds(graph, validSeeds, options.pprOptions, options.rng, query);
        return mergeWithPPR(lex, pprScores, pages, topN, 'lex-seeded-ppr');
      }
    }
    // No usable graph seeds AND no lex matches → return what lex has,
    // or empty. (Degree-rank fallback removed: the LLM seeds path in
    // buildWikiContext now handles this case upstream.)
    return lex.slice(0, topN).map(page => ({ page, score: lexScoreOf(page, lex), arm: 'lex' }));
  }

  // Arm 3: graph-expanded PPR. PPR's value is graph-based recall
  // expansion — given query-relevant seeds, walk the graph to find
  // graph-adjacent pages.
  //
  // v1.24.1 PATCH Phase 5.5.0 user direction (2026-07-13): PPR from
  // an ARBITRARY seed (e.g. `pages[0]`) is query-irrelevant noise — a
  // random walk from "the wiki index's first page" produces graph-
  // neighbors of that page, not pages related to the query. The
  // pre-fix code did exactly that and surfaced "concepts/自我修正算法"
  // for a "DeepSeek DSA HCA" query.
  //
  // New rule: PPR only fires when there are QUERY-RELEVANT seeds:
  //   1. explicitSeeds (LLM-provided) — strongest signal.
  //   2. lex hits — top of the keyword-matched pages, since these
  //      are query-relevant by construction. PPR amplifies recall
  //      from lex-discovered seeds (this is what PPR is for).
  //   3. No lex hits AND no explicit seeds → return empty (caller
  //      should escalate to LLM seed selector). Running PPR with
  //      no query-relevant seed is wasted compute + noise.
  let seedList: string[];
  if (explicitSeeds.length > 0) {
    seedList = explicitSeeds;
  } else if (lex.length > 0) {
    const seedMinDegree = options.seedMinDegree ?? DEFAULT_SEED_MIN_DEGREE;
    const lexSeedPaths = lex.slice(0, 3).map(p => p.path);
    const validSeeds = lexSeedPaths.filter(s => (graph.edges.get(s)?.length ?? 0) >= seedMinDegree);
    if (validSeeds.length === 0) {
      // Lex hits exist but none have graph neighbors worth expanding
      // from (small vault or all orphan pages). Skip PPR — return
      // pure lex ordering. Better relevance than random walk from
      // an arbitrary seed.
      return lex.slice(0, topN).map(page => ({ page, score: lexScoreOf(page, lex), arm: 'lex' }));
    }
    seedList = validSeeds;
  } else {
    return [];
  }
  const pprScores = pprFromSeeds(graph, seedList, options.pprOptions, options.rng, query);
  return mergeWithPPR(lex, pprScores, pages, topN, 'graph-first-ppr');
}

function lexScoreOf(page: PageRef, ranked: PageRef[]): number {
  // Placeholder score: highest-ranked = 1.0, descending by rank.
  const idx = ranked.indexOf(page);
  if (idx === -1) return 0;
  return Math.max(1, ranked.length - idx) / ranked.length;
}

function mergeWithPPR(
  lex: PageRef[],
  pprScores: Map<string, number>,
  pages: PageRef[],
  topN: number,
  arm: 'lex-seeded-ppr' | 'graph-first-ppr',
): PageMatch[] {
  // Build a path → PageRef index for O(1) lookup.
  const byPath = new Map<string, PageRef>();
  for (const p of pages) byPath.set(p.path, p);

  // Merge: PPR mass is the ranker; the lex rank hint breaks ties among
  // reached pages and orders the pages PPR never reached. The two live
  // on different scales — lexScoreOf is a rank placeholder in (0, 1],
  // PPR mass on a 3,000-node graph is ~0.05 for a seed — so the old
  // `max(lex, ppr)` let any keyword hit outrank every PPR seed: with 76
  // lex hits the top ten were all lex, and the seeds the LLM stage had
  // just paid for were gone.
  //
  // Reached pages: ppr + hint × LEX_HINT_WEIGHT × maxPpr — the hint can
  // reorder pages within a tenth of the top mass (e.g. several seeds of
  // equal mass), nothing further apart. Unreached pages: hint scaled
  // strictly below the smallest mass, so one monotone key sorts both.
  let minPpr = Infinity;
  let maxPpr = 0;
  for (const v of pprScores.values()) {
    if (v <= 0) continue;
    if (v < minPpr) minPpr = v;
    if (v > maxPpr) maxPpr = v;
  }
  const reachedHintScale = maxPpr * LEX_HINT_WEIGHT;
  const unreachedHintScale = Number.isFinite(minPpr) ? minPpr / 2 : 1;

  const merged = new Map<string, { page: PageRef; score: number; arm: PageMatch['arm'] }>();

  for (const page of lex) {
    const ppr = pprScores.get(page.path) ?? 0;
    const hint = lexScoreOf(page, lex);
    const score = ppr > 0
      ? ppr + hint * reachedHintScale
      : hint * unreachedHintScale;
    merged.set(page.path, { page, score, arm });
  }
  for (const [path, ppr] of pprScores) {
    if (merged.has(path)) continue;
    const page = byPath.get(path);
    if (!page) continue;
    merged.set(path, { page, score: ppr, arm });
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ page, score }) => ({ page, score, arm }));
}