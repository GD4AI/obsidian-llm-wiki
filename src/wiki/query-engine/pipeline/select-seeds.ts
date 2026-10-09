// PR #3 split: PPR cascade seed-selection phase (Phase 2 of buildWikiContext).
// Extracted from query-engine.ts (1119-1173).
//
// v1.24.1 PATCH Phase 5.5.1: 5-stage seed selection pipeline.
//
//   Stage 1 (lex)            pure keyword match against title+aliases
//   Stage 1.5a (LLM keywords) when Stage 1 weak, LLM generates 5-10 keywords
//   Stage 1.5b (scan)        keywords substring scan all pageRefs
//   Stage FALLBACK (LLM KB)  when keyword scan finds NOTHING → pure LLM KB
//   Stage 3 (PPR)            always run PPR when wiki seeds exist
//
// Chip format (per user direction 2026-07-13):
//   - "Lex+PPR"   — Stage 1 strong, lex provided seeds → PPR expanded
//   - "LLM+PPR"   — Stage 1.5a→1.5b found wiki seeds → PPR expanded
//   - "LLM+KB"    — keyword scan found nothing → pure LLM knowledge base
//                    (no wiki sources, no PPR). UI must show verify-vault
//                    banner to remind user this answer is NOT wiki-backed.
//   - "Lex++PPR"  — Lex returned weak/non-strong hits, but LLM
//                    augmentation (keyword scan + legacy selector) found
//                    nothing; lex top-K used as last-resort seeds for PPR.
//
// Why Stage 1.5a→1.5b (vs the old "feed LLM 50 candidates" approach):
//   - Old: candidates = lex top-50 OR all pageRefs (slice 0..50 by wiki
//     INTERNAL order, missing the actual relevant page at line 1410 in
//     the user's vault). LLM with 50 random pageRefs returns seeds=[].
//   - New: LLM extracts CONCEPT NAMES (e.g. "对比学习", "Contrastive
//     Learning") from the user's natural-language question. Local
//     substring scan of ALL 2137 pageRefs with those keywords finds the
//     correct page in milliseconds (zero tokens). This works for i18n
//     queries where lex tokenization can't bridge the gap between
//     full-sentence phrasings and concept-name titles.
//
// Why a separate LLM KB fallback (vs always LLM-backed):
//   - When the wiki has nothing relevant (e.g. user asks about
//     "量子纠缠的本质" but the vault is a DeepSeek-focused wiki), we
//     should NOT pretend to have wiki sources. Stage FALLBACK returns
//     empty matches with pureLLM=true, and the chat LLM answers from
//     general knowledge with a UI banner reminding the user to verify.

import {
  pprCascade,
  lexMatchByTitleAndAliases,
  scorePagesByNeedles,
  tokenizeQuery,
  lexIsReliable,
  type PageRef,
  type PageMatch,
} from '../../../core/ppr-cascade';
import type { Graph } from '../../../core/build-graph';
import { selectSeedsWithLLM, type SeedLLMClient, type SeedSelectorSettings } from './seed-selector';
import { generateQueryKeywords } from './query-keywords';
import {
  DEFAULT_QUERY_TOP_N_PAGES,
  LEX_MATCH_MIN_COUNT,
  LEX_FALLBACK_TOP_K,
  QUERY_SEED_LLM_MAX_CANDIDATES,
} from '../../../constants';
import {
  segment,
  buildPageTerms,
  buildCorpusTerms,
  nameTierCoverage,
  LEX_COVERAGE_MIN,
} from '../../../core/term-index';

export interface SeedSelectionResult {
  matches: PageMatch[];
  /**
   * Display label per user direction 2026-07-13:
   *   "Lex+PPR" | "LLM+PPR" | "LLM+KB" | "Lex++PPR"
   * Uses `+` separator (NOT `/` mix) so the user always knows which
   * stage contributed the seeds vs. the retrieval method.
   */
  armLabel: string;
  /** Whether LLM augmentation actually improved results. */
  llmAugmented: boolean;
  /**
   * v1.24.1 PATCH Phase 5.5.1: true when no wiki source was found
   * (Stage FALLBACK: pure LLM knowledge base). Caller should show a
   * verify-vault UI banner to remind the user this answer is NOT
   * wiki-backed.
   */
  pureLLM: boolean;
}

/**
 * Pure pipeline: 5-stage seed selection.
 * Does NOT mutate caller's `_graph` or `_lastRetrieval` (QueryView's job).
 */
export async function selectPprSeeds(
  query: string,
  pageRefs: PageRef[],
  graph: Graph | null | undefined,
  llmClient: SeedLLMClient | undefined,
  settings: SeedSelectorSettings,
  texts: Record<string, string>,
  onProgress?: (phase: string) => void,
): Promise<SeedSelectionResult> {
  onProgress?.(texts.queryPhaseSearching);

  const effectiveTopN = Math.max(1, Math.min(DEFAULT_QUERY_TOP_N_PAGES, pageRefs.length));

  // === Stage 1: lex match against title + aliases (NO summary) ===
  // One corpus table per query, shared by the lex scoring and the coverage
  // gate. Building it twice was the performance trap this layer has.
  const nameTierTerms = pageRefs.map(p => buildPageTerms({
    title: p.title, aliases: p.aliases, summary: '', text: '',
  }));
  const corpusTerms = buildCorpusTerms(nameTierTerms);
  const lexHits = lexMatchByTitleAndAliases(query, pageRefs, { corpus: corpusTerms });
  const lexCount = lexHits.length;

  const tokens = tokenizeQuery(query);
  const reliable = lexIsReliable(tokens);
  // The gate is a ratio now, not a score. `lexTopScore >= 5` was calibrated on
  // the title 3 / alias 2 weight table and its meaning left with that table —
  // measured, the LLM escalation gate fired 4 times where it must fire 0, and
  // 100 % of queries escalated on a real 174-page vault. Nothing reported it.
  // `nameTierCoverage` is the name tier's share of the query's total IDF: no
  // scale to drift against, and a matched rare term moves it more than a
  // matched stop word. See `term-index.ts`.
  const queryTerms = tokens.flatMap(t => segment(t));
  const topPageTerms = lexCount > 0
    ? buildPageTerms({
        title: lexHits[0].page.title,
        aliases: lexHits[0].page.aliases,
        summary: '',
        text: '',
      })
    : null;
  const coverage = topPageTerms ? nameTierCoverage(queryTerms, topPageTerms, corpusTerms) : 0;
  console.debug(
    `[Stage 1] lex match: count=${lexCount} coverage=${coverage.toFixed(3)} ` +
    `threshold(coverage=${LEX_COVERAGE_MIN}, count=${LEX_MATCH_MIN_COUNT})`,
  );
  // Lex is "strong" — no LLM escalation — only when structural + reliable
  // BOTH pass. See select-seeds.ts history (Phase 5.5.0 escalation bug
  // fix) for the conjunction rationale.
  const lexStrong = coverage >= LEX_COVERAGE_MIN
    && lexCount >= LEX_MATCH_MIN_COUNT
    && reliable;
  const needsLLM = !lexStrong;

  // === Stage 1.5a: LLM generates 5-10 candidate keywords ===
  // Only when lex is weak AND we have an LLM client. The LLM extracts
  // concept names from the natural-language question, language-aware
  // (auto-detect, with English as universal fallback — see
  // query-keywords.ts for prompt design).
  let keywords: string[] = [];
  if (needsLLM && llmClient) {
    keywords = await generateQueryKeywords(query, llmClient, settings);
    console.debug(`[Stage 1.5a] generated ${keywords.length} keywords: ${JSON.stringify(keywords)}`);
  }

  // === Stage 1.5b: local substring scan with LLM-generated keywords ===
  // Scan ALL pageRefs (no slice cap) with the keywords. Each keyword
  // contributes +1 to a page's match score; pages with the most
  // keyword hits win. This is O(n) over ~2000 pages — milliseconds,
  // zero tokens. The previous design (slice 0..50 by wiki internal
  // order) silently dropped the relevant page (e.g. 对比学习 at
  // index line 1410, not in top 50).
  let keywordMatches: PageRef[] = [];
  if (keywords.length > 0) {
    keywordMatches = scanPageRefsByKeywords(pageRefs, keywords);
    console.debug(
      `[Stage 1.5b] keyword scan: ${keywordMatches.length} matches ` +
      `(top: ${keywordMatches.slice(0, 3).map(p => p.path).join(', ')})`,
    );
  }

  // === Stage 1.5 (legacy path): LLM seed selector with candidate list ===
  // Kept for cases where keyword scan returns NOTHING but the LLM
  // could still disambiguate from a focused candidate set. The legacy
  // path's `selectSeedsWithLLM` reads (path, title, aliases) for up
  // to 50 candidates — when keyword scan returns hits, we feed those
  // as the focused candidate set.
  let llmSeeds: string[] = [];
  if (needsLLM && llmClient && keywords.length === 0) {
    // Only the legacy path runs when we have NO keywords (e.g. LLM
    // keyword generation failed). When keywords exist, the scan is
    // faster and more accurate.
    const lexTopForLLM = lexHits
      .slice(0, QUERY_SEED_LLM_MAX_CANDIDATES)
      .map(h => h.page);
    const candidates = lexTopForLLM.length > 0 ? lexTopForLLM : pageRefs;
    console.debug(`[Stage 1.5 legacy] LLM seed selector triggered (candidates=${candidates.length})`);
    llmSeeds = await selectSeedsWithLLM(query, candidates, llmClient, settings);
    console.debug(`[Stage 1.5 legacy] LLM returned ${llmSeeds.length} seeds`);
  }

  // === Decide chip + seeds ===
  let seeds: string[];
  let chip: string;
  let pureLLM = false;
  let llmAugmented = false;

  if (lexStrong) {
    // Stage 1 strong — no LLM call.
    seeds = lexHits.slice(0, LEX_FALLBACK_TOP_K).map(h => h.page.path);
    chip = 'Lex+PPR';
  } else if (keywordMatches.length > 0) {
    // Stage 1.5a→1.5b found wiki seeds via LLM-generated keywords.
    // Take top-LEX_FALLBACK_TOP_K by scan score.
    seeds = keywordMatches.slice(0, LEX_FALLBACK_TOP_K).map(p => p.path);
    chip = 'LLM+PPR';
    llmAugmented = true;
  } else if (llmSeeds.length > 0) {
    // Legacy Stage 1.5 (LLM seed selector) succeeded.
    seeds = llmSeeds;
    chip = 'LLM+PPR';
    llmAugmented = true;
  } else if (lexHits.length > 0) {
    // Lex had weak/non-strong hits, but LLM augmentation (keyword scan
    // + legacy selector) found nothing — use lex top-K as last-resort seeds.
    seeds = lexHits.slice(0, LEX_FALLBACK_TOP_K).map(h => h.page.path);
    chip = 'Lex++PPR';
  } else {
    // Stage FALLBACK: pure LLM KB (no wiki sources).
    seeds = [];
    chip = 'LLM+KB';
    pureLLM = true;
  }

  // === Stage 3: PPR expansion ===
  // Only runs when we have seeds. In pureLLM mode, skip PPR entirely —
  // we don't want random pageRefs[0] as a seed (the bug fixed in
  // Phase 5.5.0).
  const finalMatches = pureLLM || seeds.length === 0
    ? []
    : pprCascade(query, pageRefs, {
        graph: graph ?? undefined,
        topN: effectiveTopN,
        seeds,
      });

  const relevantPages = finalMatches.map(m => m.page.path);
  const pageNames = relevantPages.map(p => p.split('/').pop() || p).join(', ');
  const foundText = texts.queryPhaseFoundPages
    .replace('{count}', relevantPages.length.toString())
    .replace('{pages}', pageNames);
  onProgress?.(`${foundText} · ${chip}`);

  return { matches: finalMatches, armLabel: chip, llmAugmented, pureLLM };
}

/**
 * Stage 1.5b: scan all pageRefs' title + aliases with the LLM-generated
 * keywords. Returns pages sorted by match score (most keyword hits
 * first). Pure function — no IO, no LLM.
 *
 * Uses the same {@link scorePagesByNeedles} primitive as Stage 1 (lex):
 * substring match over LLM-generated concept names instead of
 * tokenized query words. This is what makes the 5-stage pipeline work
 * for queries like "什么叫对比学习？" where Stage 1 tokenization can't
 * bridge full-sentence phrasing to concept-name titles.
 */
function scanPageRefsByKeywords(pageRefs: PageRef[], keywords: string[]): PageRef[] {
  const keywordsLower = keywords.map(k => k.toLowerCase());
  return scorePagesByNeedles(pageRefs, keywordsLower).map(s => s.page);
}