// v1.24.0: dedup-phase extracted from controller.ts:runLintWiki (lines 142-320).
//
// This phase performs the LLM-assisted duplicate detection step:
//   1. Filter entity/concept files (sources are excluded — they don't have
//      aliases and are not user-named pages)
//   2. Run `generateDuplicateCandidates` (programmatic, O(N²) pair scan with
//      3 signals: crossLang, caseVariant, bigram, sharedLinks)
//   3. Classify candidates into Tier 1 (must-verify) and Tier 2 (fill budget)
//   4. Build a token-budgeted verify batch
//   5. Run LLM verify in parallel, respecting `pageGenerationConcurrency`
//   6. Detect rate-limit failures and emit a Notice with suggested mitigation
//
// Pure helpers (`classifyTiers`, `computeVerifyBatch`) are exported for
// unit testing — the rest of the phase is integration-level (async IO, LLM
// client, status notices) and is covered by the runDedupPhase integration
// tests in `__tests__/wiki/lint/llm-phases/dedup-phase.test.ts`.
//
// Behavior MUST be identical to the original inline implementation in
// controller.ts:runLintWiki (lines 142-320). Any change here is a
// behavior regression unless explicitly called out in a release commit.

import { Notice } from 'obsidian';
import { getText } from '../../../core/i18n';
import { TEXTS } from '../../../texts';
import { generateDuplicateCandidates, buildIncomingLinkIndex } from '../duplicate-detection';
import type { DuplicateCandidate } from '../duplicate-detection';
import { resolveModelForTask } from '../../../core/model-resolver';
import { parseJsonResponse } from '../../../core/json';
import { detectRateLimitFailures, formatRateLimitNotice, isRateLimitFailure } from '../../../core/rate-limit';
import { normalizeLLMPath } from '../../../core/prompt-builders';
import { renderTemplate } from '../../../core/template-renderer';
import { PROMPTS } from '../../../prompts';
import type { LLMClient } from '../../../types';
import type { LintPhaseContext, DuplicateResult, ScannerPage } from '../types';
import { DedupResultLLMSchema } from '../../../llm-sdk/output-schemas';
import { callLlm } from '../../../core/llm-dispatch';
import {
  TOKENS_LINT_DEDUP_LLM,
  NOTICE_RATE_LIMIT,
  NOTICE_ERROR,
  LINT_CANDIDATE_TOKEN_ESTIMATE,
  LINT_MAX_INPUT_TOKENS,
  LINT_DEDUP_BATCH_SIZE,
  LINT_DEDUP_PROMPT_CHAR_BUDGET,
  LINT_DEDUP_BIGRAM_TIER1_CUTOFF,
  WIKI_SUBFOLDERS,
} from '../../../constants';

export interface DedupPhaseInput {
  wikiFiles: Array<{ path: string; basename: string }>;
  pageMap: Map<string, ScannerPage>;
}

/**
 * Tier classification — pure function, mirrors the logic in
 * controller.ts:runLintWiki lines 184-194.
 *
 * - `crossLang` and `caseVariant` signals are always Tier 1 (high-precision).
 * - `bigram` with score >= LINT_DEDUP_BIGRAM_TIER1_CUTOFF is Tier 1; below is Tier 2.
 * - `sharedLinks` is always Tier 2.
 * - `sourceFingerprint` (v1.26.0 #382 item 1, Batch 2) is always Tier 1:
 *   body-hash equality is a deterministic, high-precision signal.
 * - `sharedIncoming` is always Tier 2 (Jaccard of incoming-source sets;
 *   same precision tier as sharedLinks).
 *
 * Stable ordering: input order is preserved within each tier.
 */
export function classifyTiers(
  candidates: DuplicateCandidate[],
  tier1Cutoff: number = LINT_DEDUP_BIGRAM_TIER1_CUTOFF,
): { tier1: DuplicateCandidate[]; tier2: DuplicateCandidate[] } {
  const tier1: DuplicateCandidate[] = [];
  const tier2: DuplicateCandidate[] = [];
  for (const c of candidates) {
    if (c.signal === 'crossLang' || c.signal === 'caseVariant' || c.signal === 'sourceFingerprint') {
      tier1.push(c);
    } else if (c.signal === 'bigram') {
      (c.score >= tier1Cutoff ? tier1 : tier2).push(c);
    } else if (c.signal === 'sharedLinks' || c.signal === 'sharedIncoming') {
      tier2.push(c);
    }
  }
  return { tier1, tier2 };
}

/**
 * Token-budgeted verify batch — pure function, mirrors controller.ts lines
 * 213-221.
 *
 * Tier 1 is always included in full (matches OLD behavior — even when tier1
 * alone exceeds `maxTotal`, we send all tier1 candidates; truncating would
 * silently drop high-precision duplicates). Tier 2 fills any remaining
 * budget (`maxTotal - tier1.length`). If the combined list is larger than
 * `maxTotal`, the LLM is told about more pairs than the budget suggests —
 * a rare edge case that mirrors the OLD inline code's behavior exactly.
 */
export function computeVerifyBatch(
  tier1: DuplicateCandidate[],
  tier2: DuplicateCandidate[],
  maxTotal: number,
): { verifyList: DuplicateCandidate[]; tier2Included: number } {
  const verifyList: DuplicateCandidate[] = [];
  // Tier 1: always include in full (no cap). Matches OLD `[...tier1]`.
  for (let i = 0; i < tier1.length; i++) {
    verifyList.push(tier1[i]);
  }
  const tier2Budget = Math.max(0, maxTotal - verifyList.length);
  const tier2Included = Math.min(tier2.length, tier2Budget);
  for (let i = 0; i < tier2Included; i++) {
    verifyList.push(tier2[i]);
  }
  return { verifyList, tier2Included };
}

/**
 * Run the duplicate detection phase. Returns the list of LLM-confirmed
 * duplicate pairs (target, source, reason). The caller is responsible
 * for surfacing the result to the lint report — this function only
 * emits a Notice on rate-limit detection and lets the caller decide
 * what to do with the empty array.
 *
 * On any error, returns `[]` and logs. Does NOT throw.
 */
export async function runDedupPhase(
  ctx: LintPhaseContext,
  input: DedupPhaseInput,
  checkCancelled: () => void,
): Promise<DuplicateResult[]> {
  // v1.26.0 (#382 item 1, Batch 2): include sources/ in dedup-eligible
  // files when `lintDedupIncludeSources !== false` (the settings field
  // is `?: boolean` so undefined = on by default).
  //
  // Cross-type behaviour (post v1.26.3 PATCH follow-up — was a known
  // gap in v1.26.0 Batch 2):
  //   - Pair-level rejection happens inside generateDuplicateCandidates
  //     via isCrossTypePairAllowed (added in v1.26.3 PATCH B3 fix).
  //     The forbidden combinations are entity↔source and
  //     concept↔source (in any order); the allowed combinations are
  //     entity↔entity, concept↔concept, entity↔concept, and
  //     source↔source. Pages outside the three content folders
  //     (log.md, schema/, index.md) are still filtered at file level.
  //   - Why this matters per #358 complementary memory model: a source
  //     that mentions an entity by name is NOT a duplicate of the
  //     entity — they live in different cognitive registers. Showing
  //     "is this entity page a duplicate of this source page?" to the
  //     LLM verify path was misleading noise that the LLM tended to
  //     return false-positives on (especially on small vaults with
  //     shared bigram titles like Transformer / Transformer Reference).
  //   - Source↔source detection still uses sourceFingerprint
  //     (body-hash equality) as its tier-1 gate; the cross-type
  //     filter does not affect that path.
  const includeSources = ctx.settings.lintDedupIncludeSources !== false;
  const dedupEligibleFiles = input.wikiFiles.filter(f =>
    f.path.includes(`/${WIKI_SUBFOLDERS.entities}/`) ||
    f.path.includes(`/${WIKI_SUBFOLDERS.concepts}/`) ||
    (includeSources && f.path.includes(`/${WIKI_SUBFOLDERS.sources}/`))
  );
  if (dedupEligibleFiles.length < 2) return [];
  // B3 fix: invoke the getter closure (was direct ref → snapshot).
  if (!ctx.llmClient()) return [];

  const t = TEXTS[ctx.settings.language];

  try {
    const pagesForDedup: Array<{ path: string; content: string; title: string }> = [];
    for (const file of dedupEligibleFiles) {
      const info = input.pageMap.get(file.path);
      if (info) {
        pagesForDedup.push({ path: file.path, content: info.content, title: info.basename });
      }
    }

    // Update UI before any work — mirrors controller.ts:runLintWiki
    // lines 167-168 which updated the status bar/stage notice before
    // running the candidate generation. The v1.24.0 refactor's first pass
    // accidentally moved the UI updates inside the verify loop, leaving
    // "wiki is clean" runs without any visible "Checking duplicates"
    // feedback. This regression-fix restores the OLD observable behavior.
    ctx.wikiEngine.updateStatusBar(getText(ctx.settings.language, 'lintStageDedup'));
    ctx.stageNotice?.setMessage(t.lintCheckingDuplicates);

    // Layer 1: Programmatic candidates (3 signals: crossLang, bigram, sharedLinks).
    // v1.26.0 (#382 item 2): per-vault threshold overrides flow from
    // ctx.settings. The fields are optional; unset values are coalesced
    // and clamped to [0,1] inside generateDuplicateCandidates (see
    // DEFAULT_DEDUP_THRESHOLDS there) so users who have not opted into
    // Custom Advanced Settings see identical behavior. The tier-1 cutoff
    // is intentionally NOT settable — see the constants.ts docblock for
    // LINT_DEDUP_BIGRAM_TIER1_CUTOFF for the rationale.
    //
    // v1.26.0 (#382 item 1, Batch 2): build the incoming-link reverse
    // index via the pure helper in duplicate-detection.ts. The helper
    // resolves link targets via Map<title|basename> lookup (O(1) per
    // link) instead of the previous O(N) Array.find, dropping the
    // build from O(N² × L) to O(N × L).
    const incomingIndex = buildIncomingLinkIndex(pagesForDedup);
    // B3 (v1.26.3 PATCH, DocT CR): count pairs rejected by the cross-type
    // filter so its effect shows up in the dedup debug output below —
    // without this number the filter is silent and a path-convention drift
    // would degrade dedup to a no-op with no signal.
    let crossTypeRejected = 0;
    const allCandidates = await generateDuplicateCandidates(pagesForDedup, {
      jaccardLinkThreshold: ctx.settings.lintJaccardLinkThreshold,
      jaccardBodyGate: ctx.settings.lintJaccardBodyGate,
      bigramThreshold: ctx.settings.lintBigramThreshold,
    }, {
      // v1.26.0 (#382 item 3, Batch 1): abort promptly when the user
      // cancels. generateDuplicateCandidates invokes checkCancelled at
      // every bucket boundary in the bucketed dedup path, so a long
      // bucket fan-out on a 2000-page vault can no longer block cancel
      // for the full scan duration.
      checkCancelled,
      onCrossTypeRejected: (count) => { crossTypeRejected = count; },
    }, incomingIndex);
    if (allCandidates.length === 0) {
      console.debug('lintWiki: no duplicate candidates found — wiki is clean');
      return [];
    }

    // v1.26.0 (#382 item 2): classifyTiers uses the default tier1Cutoff
    // (LINT_DEDUP_BIGRAM_TIER1_CUTOFF — not a settable field; rationale in
    // the constants.ts docblock). It controls which generated candidates
    // the LLM sees, not whether a candidate is generated.
    const { tier1, tier2 } = classifyTiers(allCandidates);
    console.debug(`lintWiki: ${allCandidates.length} candidates → Tier 1: ${tier1.length}, Tier 2: ${tier2.length}${crossTypeRejected > 0 ? ` (${crossTypeRejected} cross-type pairs rejected by #358 filter)` : ''}`);
    // v1.24.0: log candidate breakdown by signal (preserved from the
    // OLD controller.ts:runLintWiki lines 200-204 diagnostic; was
    // accidentally dropped during refactor).
    console.debug('lintWiki: candidate breakdown by signal:', {
      crossLang: allCandidates.filter(c => c.signal === 'crossLang').length,
      bigram: allCandidates.filter(c => c.signal === 'bigram').length,
      sharedLinks: allCandidates.filter(c => c.signal === 'sharedLinks').length,
      // v1.26.0 (#382 item 1, Batch 2): two new signals
      sourceFingerprint: allCandidates.filter(c => c.signal === 'sourceFingerprint').length,
      sharedIncoming: allCandidates.filter(c => c.signal === 'sharedIncoming').length,
    });

    // Layer 3: LLM verification with token-budget batching.
    // Each candidate ≈ 120 chars ≈ 30 tokens. Total input budget: 15K tokens
    // (leaves room for prompt + output in 200K window).
    const maxTotalCandidates = Math.floor(LINT_MAX_INPUT_TOKENS / LINT_CANDIDATE_TOKEN_ESTIMATE);
    const { verifyList: verifyCandidates, tier2Included: tier2ToInclude } = computeVerifyBatch(tier1, tier2, maxTotalCandidates);
    console.debug(`lintWiki: sending ${verifyCandidates.length}/${maxTotalCandidates} candidates (Tier 1: ${tier1.length}, Tier 2: ${tier2ToInclude}/${tier2.length}, budget: ${LINT_MAX_INPUT_TOKENS} tokens)`);

    if (verifyCandidates.length === 0) return [];

    // v1.24.0: compose the system prompt once for the whole dedup run and
    // reuse it across every batch worker (it is identical for all batches,
    // and re-resolving it per batch would re-parse the schema on each worker).
    // Uses the shared buildSystemPrompt composer so dedup receives the same
    // language directive + schema context + active tag vocabulary as the
    // fix-runners.
    const systemPrompt = await ctx.buildSystemPrompt('lint');

    // v1.26.0 (#382 item 1, Batch 2): dynamic batch sizing. The static
    // LINT_DEDUP_BATCH_SIZE = 50 cap is honoured, but when a candidate
    // batch's rendered prompt would exceed LINT_DEDUP_PROMPT_CHAR_BUDGET
    // (7K chars), the splitter halves the batch size until the prompt
    // fits. This insures thinking-mode LLMs (DeepSeek V3/V4) return
    // content reliably — empirically every batch with prompt < 7K
    // chars returned content on deepseek-v4-flash with max_tokens=8000,
    // while ~10-50% of batches with prompt > 8K chars returned 0.
    //
    // The split is greedy / no-backtracking: each chunk is sized to
    // fit independently, scanning forward through the candidate list.
    // Worst case a single oversized candidate (path + reason > 7K chars)
    // gets its own batch — acceptable, since such a candidate is a
    // pathological edge case that the upper bound already prevents.
    //
    // systemPrompt is now hoisted ABOVE the split loop so we can use
    // its rendered length for the projected-chars budget check.
    const systemChars = systemPrompt?.length ?? 0;
    const batches: DuplicateCandidate[][] = [];
    for (let i = 0; i < verifyCandidates.length; ) {
      // Start with the upper-bound batch size and shrink until the
      // rendered prompt would fit.
      let chunkSize = Math.min(LINT_DEDUP_BATCH_SIZE, verifyCandidates.length - i);
      // Render-time per-candidate chars: `- Candidate A: ${path}\n  Candidate B: ${path}\n  Signal: ${reason}\n`
      // plus path-overhead. We use 200 chars/candidate as a conservative
      // upper bound (actual measured: 130-150 chars in e2e log).
      const PER_CANDIDATE_OVERHEAD = 200;
      while (chunkSize > 1) {
        const projectedChars = chunkSize * PER_CANDIDATE_OVERHEAD + systemChars;
        if (projectedChars <= LINT_DEDUP_PROMPT_CHAR_BUDGET) break;
        chunkSize = Math.max(1, Math.floor(chunkSize / 2));
      }
      batches.push(verifyCandidates.slice(i, i + chunkSize));
      i += chunkSize;
    }

    // Dedup-phase concurrency follows the user's `pageGenerationConcurrency`
    // setting. We do NOT cap it here (an earlier v1.26.0 draft tried
    // `Math.min(2, userConcurrency)` to work around deepseek-v4-flash
    // soft-throttling, but that silently overrode user intent and
    // wasn't a proper fallback). The empty-response retry mechanism
    // below is the correct path: it preserves user concurrency while
    // transparently recovering from transient provider failures.
    const concurrency = ctx.settings.pageGenerationConcurrency || 1;
    console.debug(`lintWiki: ${batches.length} batches, concurrency=${concurrency}`);

    // v1.26.0 (#382 item 1, Batch 2): log dedup-phase LLM call
    // parameters ONCE before the batch loop so an operator investigating
    // empty / truncated responses can see exactly what was sent.
    // Without this, the only signal of an empty batch is the parseJson
    // error at the bottom of the loop, with no way to distinguish
    // "wrong model" from "wrong max_tokens" from "JSON schema mismatch".
    const dedupLlmModel = resolveModelForTask(ctx.settings, 'lint');
    console.debug(
      `[Dedup LLM config] model=${dedupLlmModel} ` +
      `max_tokens=${TOKENS_LINT_DEDUP_LLM} ` +
      `disableThinking=force (overrides user setting ${ctx.settings.disableThinking === true ? 'true' : 'false'}) ` +
      `response_format=json_object ` +
      `batch_size=${LINT_DEDUP_BATCH_SIZE} ` +
      `total_batches=${batches.length} ` +
      `system_prompt_length=${systemPrompt?.length ?? 0}`
    );

    // v1.26.0 (#382 item 1, Batch 2 follow-up): hard-coded force-disable
    // thinking for the dedup-phase LLM call.
    //
    // Rationale (e2e log on the 2141-page vault, Aug 2026):
    //   - With thinking-mode (deepseek-v4-flash + 4 concurrent burst):
    //     wall-time ~979s.
    //   - With user `disableThinking=true`: wall-time ~830s (still slow
    //     because user setting may not propagate to all providers, and
    //     even when it does, the burst pattern still triggers retries).
    //   - With this hard-coded force-disable: expected ~150-200s (4-way
    //     concurrency throughout).
    //
    // Why we override the user setting here (deliberate, scoped to this
    // phase only):
    //   1. The dedup task is a STRUCTURED BINARY CLASSIFICATION against
    //      explicit criteria ("same underlying concept" vs "different
    //      concepts"). Chain-of-thought reasoning adds latency and token
    //      cost without measurable recall/precision improvement (verified
    //      on e2e fixture — recall 100% with and without thinking).
    //   2. Thinking-mode providers (DeepSeek V3/V4, GPT-5 reasoning,
    //      Claude extended thinking) burn the same `max_tokens` budget on
    //      thinking tokens, leaving 0 bytes for the JSON output — the
    //      root cause of the 0-byte empty-response bursts this retry
    //      mechanism is designed to handle.
    //   3. SDK-level fallback is safe across all 4 SDKs:
    //        - Anthropic SDK (anthropic-sdk-client.ts:177-178):
    //          `thinking: {type: 'disabled'}` is silently ignored by
    //          non-thinking models (Haiku 3, instant).
    //        - OpenAI SDK (openai-sdk-client.ts:219-221):
    //          `reasoningEffort: 'low'` is silently ignored by
    //          non-reasoning models (gpt-4o, gpt-4-turbo).
    //        - OpenAI 兼容 SDK (openai-compat-sdk-client.ts:240-270):
    //          `thinking.type: 'disabled'` + `chat_template_kwargs` is
    //          honored by DeepSeek / Kimi / GLM-4.6+ AT THE WIRE if the
    //          fields reach it; in practice they do NOT, because the AI
    //          SDK's path-2 passthrough
    //          (`@ai-sdk/openai-compatible@2.0.62/dist/index.mjs:533-534`)
    //          reads `providerOptions[this.providerOptionsName]` (our
    //          provider id — `deepseek` / `kimi` / `lmstudio` / etc.),
    //          not the hardcoded `"openaiCompatible"` key that
    //          buildProviderOptions returns under. None of the 15
    //          provider ids is literally `"openai-compatible"`, so the
    //          extras are dropped before the body is built. eucher
    //          verified the same byte-identical no-op on llama.cpp via
    //          curl at the wire (Issue #382 follow-up comment,
    //          2026-08-04) — `chat_template_kwargs` honours the value
    //          there, but the no-op comes from the SDK, not the
    //          backend. OpenRouter is the documented exception (uses
    //          a different key — no-op fallback).
    //        - OpenAI Codex SDK (openai-codex-sdk-client.ts:152-154):
    //          `reasoningEffort: 'low'` is a no-op for Codex Responses.
    //      The setting only affects thinking-capable models where the
    //      user almost certainly wanted it off for this task class.
    //
    // Why we do NOT export this as a user setting:
    //   - The dedup-phase prompt is structurally constrained (JSON out,
    //     binary decision). Adding "dedup thinking override" as a
    //     per-phase toggle duplicates the existing `disableThinking`
    //     toggle and adds UI surface for a value that has only one
    //     defensible setting (off).
    //   - The user's `disableThinking` setting still applies to ALL
    //     other LLM call sites — this is a dedup-phase-internal
    //     override, not a settings change.
    //
    // v1.27.0 follow-up (recorded in CLAUDE.md tech-debt section):
    // Evaluate whether `runAnalysisPhase`, `fix-dead-link`,
    // `link-orphan`, `query-keywords`, and `path-resolution` (also
    // structured JSON-decision tasks) should adopt the same hard-coded
    // force-disable pattern. Out of scope for Batch 2.
    //
    // v1.26.0 Batch 7 follow-up (eucher, PR #411 review comment
    // 2026-08-05): the previous name `enableThinkingOverride = false`
    // read as a value (the override IS false → so spread nothing),
    // but the spread `...(value ? { enableThinking: false } : {})`
    // was treating it as a flag — `false ? … : {}` is always `{}`, so
    // `enableThinking` never entered `llmArgs`, and Layers 1-3 of the
    // 4-layer fallback were unreachable from this call. Renamed to
    // `FORCE_DISABLE_THINKING` (clear that it is a flag, not a value)
    // and made the spread unconditional. The 979s→365s e2e attribution
    // is corrected in [[feedback_force_disable_thinking_dedup_wiring]]
    // — the gain came from retry/backoff + Layer 4 (prompt-level "Do not
    // reason step by step"), not from Layers 1-3 (which were never sent
    // before this fix). After this fix Layers 1-3 will be live and the
    // expectation is real wall-time reduction, not just retry recovery.
    const FORCE_DISABLE_THINKING = true;
    //
    // The user-set `pageGenerationConcurrency` is the starting point.
    // When an empty-response soft-throttle is detected (deepseek-v4-flash
    // in thinking mode + burst load returns 200 + 0 bytes), the
    // in-scan concurrency is halved on the fly for the remaining
    // batches of THIS scan. The user's settings value is never
    // modified — the adaptation lives only in this `currentConcurrency`
    // local, which resets to the user value at the start of every
    // runDedupPhase invocation.
    let currentConcurrency = ctx.settings.pageGenerationConcurrency || 1;
    const userConcurrency = currentConcurrency;

    // v1.26.x PATCH CR-1: in-scan halving counter hoisted ABOVE the
    // chunk-iteration for-loop. Previously declared inside the loop body
    // (after Promise.allSettled resolved), which reset both `consecutive
    // ThrottleChunks` and the `HALVE_AFTER_CONSECUTIVE_CHUNKS` constant
    // to their initial values at the start of every chunk — the counter
    // could never reach 2 across chunks and the halving branch was
    // dead code in practice. Fix: hoist above the loop alongside
    // `currentConcurrency` so the counter accumulates across chunks.
    let consecutiveThrottleChunks = 0;
    const HALVE_AFTER_CONSECUTIVE_CHUNKS = 2;

    // v1.26.0 (#382 item 1, Batch 2): empty-response retry helper.
    //
    // Some providers (notably deepseek-v4-flash in thinking mode)
    // return 200 OK with a 0-byte body under burst load — a
    // soft-throttle rather than a hard 429. The retry policy is
    // tiered:
    //   attempt 1: original request.
    //   attempt 2: 500ms-delayed retry of the SAME request.
    //               (v1.26.0 Batch 2 follow-up: previously immediate;
    //                added 500ms backoff so we don't hard-collide
    //                with the provider's request queue immediately
    //                after the burst. 500ms is short enough not to
    //                slow the happy path noticeably, long enough to
    //                let one in-flight request drain.)
    //   attempt 3: 2-second delayed retry (final attempt — lets the
    //               provider's request queue drain — empirically
    //               clears the soft-throttle on deepseek-v4-flash).
    //
    // If attempt 3 is still empty, the batch is recorded as a
    // dedupFailure. The function returns the final response (empty
    // string = permanent failure), the parseJsonResponse call below
    // throws EmptyResponseError, and the batch lands in
    // `dedupFailures`. The retryEvents accumulator lets the post-loop
    // code surface a single user-facing Notice if retries were
    // triggered, rather than 1 Notice per batch.
    const RETRY_ATTEMPT_2_DELAY_MS = 500;
    const RETRY_ATTEMPT_3_DELAY_MS = 2000;
    const retryEvents: Array<{ batchNum: number; attempt: 1 | 2; delayMs: number }> = [];
    let softThrottleDetected = false;

    async function callLlmWithRetry(
      batchNum: number,
      prompt: string,
      llm: LLMClient,
    ): Promise<string> {
      const lintModel = resolveModelForTask(ctx.settings, 'lint');
      const llmArgs = {
        task: 'lint-dedup' as const,
        model: lintModel,
        max_tokens: TOKENS_LINT_DEDUP_LLM,
        messages: [{ role: 'user' as const, content: prompt }],
        ...(systemPrompt ? { system: systemPrompt } : {}),
        // v1.26.3 PATCH Issue #443 expanded scope: typed-output path.
        // DedupResultLLMSchema ({duplicates?: [{target, source, reason}]})
        // travels on the wire as Tier 0 json_schema — LMStudio accepts,
        // no parse-error fallback to empty.
        response_format: { type: 'json_object' as const, schema: DedupResultLLMSchema },
        // v1.26.0 Batch 7 follow-up (eucher): the previous
        // `enableThinkingOverride ? … : {}` ternary silently sent
        // nothing because `override = false` always picks the empty
        // branch. The flag is now `FORCE_DISABLE_THINKING = true` and
        // the spread is unconditional so `enableThinking: false`
        // actually enters llmArgs and reaches buildProviderOptions
        // (which then maps it to `reasoningEffort: 'none'` /
        // `thinking: {type: 'disabled'}` per SDK).
        ...(FORCE_DISABLE_THINKING ? { enableThinking: false } : {}),
      };

      const logResponse = (response: string, attempt: 1 | 2 | 3, delayMs: number) => {
        console.debug(
          `[Dedup LLM batch ${batchNum}] request: prompt_chars=${prompt.length} ` +
          `system_chars=${systemPrompt?.length ?? 0} ` +
          `model=${lintModel} ` +
          `max_tokens=${TOKENS_LINT_DEDUP_LLM} ` +
          `disableThinking=${FORCE_DISABLE_THINKING ? 'force' : 'inherit-user'} ` +
          `response_format=json_object attempt=${attempt} delay_ms=${delayMs} | ` +
          `response: raw_length=${response.length} ` +
          `first_100_chars="${response.substring(0, 100).replace(/\n/g, '\\n')}"`
        );
      };

      // v1.26.3 PATCH Issue #443 expanded scope: typed-output dispatch via the
      // centralized core/llm-dispatch helper. The retry tier logic is
      // unchanged — only the wire shape gains schema enforcement.
      const callOnce = () => callLlm(llm, llmArgs);

      // Attempt 1: original request.
      const first = await callOnce();
      logResponse(first, 1, 0);
      if (first.length > 0) return first;

      // Attempt 2: 500ms-delayed retry of the same request.
      softThrottleDetected = true;
      retryEvents.push({ batchNum, attempt: 1, delayMs: RETRY_ATTEMPT_2_DELAY_MS });
      console.warn(
        `[Dedup LLM batch ${batchNum}] empty response (attempt 1) — ` +
        `retrying after ${RETRY_ATTEMPT_2_DELAY_MS}ms. enableThinking_sent=${FORCE_DISABLE_THINKING ? 'false' : 'unset'} ` +
        `prompt_chars=${prompt.length} max_tokens=${TOKENS_LINT_DEDUP_LLM} model=${lintModel}`
      );
      await new Promise(resolve => window.setTimeout(resolve, RETRY_ATTEMPT_2_DELAY_MS));
      const second = await callOnce();
      logResponse(second, 2, RETRY_ATTEMPT_2_DELAY_MS);
      if (second.length > 0) return second;

      // Attempt 3: 2-second delayed retry (final attempt).
      retryEvents.push({ batchNum, attempt: 2, delayMs: RETRY_ATTEMPT_3_DELAY_MS });
      console.warn(
        `[Dedup LLM batch ${batchNum}] empty response (attempt 2) — ` +
        `retrying after ${RETRY_ATTEMPT_3_DELAY_MS}ms delay (likely provider soft-throttle).`
      );
      await new Promise(resolve => window.setTimeout(resolve, RETRY_ATTEMPT_3_DELAY_MS));
      const third = await callOnce();
      logResponse(third, 3, RETRY_ATTEMPT_3_DELAY_MS);
      return third;
    }

    // Process batches in parallel with concurrency limit
    const allDuplicates: DuplicateResult[] = [];
    // v1.26.0 Batch 7 + CR-3 fix: structured `type` discriminator on the
    // failure record, alongside the free-text `reason`. The rate-limit
    // classifier (src/core/rate-limit.ts:34) groups failures by string
    // match on `reason` today; a future wording tweak on the parse-
    // failure reason ("response was throttled mid-flight" would match
    // the rate-limit regex, e.g.) would silently misclassify the parse
    // failure as a rate-limit failure — vanishing from the truncation
    // counter AND firing a spurious [Duplicate Rate Limit] Notice.
    //
    // Setting `type: 'parse-failure'` explicitly excludes the entry
    // from the rate-limit grouping: rate-limit failures come from
    // network/429 (which arrive as rejected Promise.allSettled
    // promises with an Error-shaped reason); parse-failures are
    // mid-response and have a known discriminator.
    const dedupFailures: Array<{ name: string; reason: string; type?: string }> = [];
    for (let i = 0; i < batches.length; ) {
      checkCancelled();
      const chunk = batches.slice(i, i + currentConcurrency);
      const batchStart = i + 1;
      const batchEnd = Math.min(i + currentConcurrency, batches.length);
      const progressLabel = batchEnd > batchStart
        ? `${batchStart}-${batchEnd}/${batches.length}`
        : `${batchStart}/${batches.length}`;
      ctx.stageNotice?.setMessage(t.lintCheckingDuplicatesProgress
        .replace('{current}', progressLabel));
      const results = await Promise.allSettled(
        chunk.map(async (batch, bi) => {
          const batchNum = i + bi + 1;
          const candidateList = batch.map(c =>
            `- Candidate A: ${c.target}\n  Candidate B: ${c.source}\n  Signal: ${c.reason}`
          ).join('\n');

          const dedupPrompt = renderTemplate(PROMPTS.lintDuplicateDetection, {
            wikiFolder: ctx.settings.wikiFolder,
            candidates: candidateList,
            total: String(pagesForDedup.length),
          });

          console.debug(`lintWiki: batch ${batchNum}/${batches.length} — ${batch.length} candidates`);

          // B3 fix: capture the result of the getter so subsequent await
          // calls don't re-invoke (also narrows the non-null assertion
          // away — ctx.llmClient() returned null only at the early-return
          // guard; this loop is unreachable in that case).
          const llm = ctx.llmClient();
          if (!llm) {
            throw new Error('runDedupPhase: LLM client became null mid-run');
          }

          const dedupResponse = await callLlmWithRetry(batchNum, dedupPrompt, llm);

          // v1.26.0 (#382 item 1, Batch 2): throwOnEmpty surfaces 0-byte
          // LLM responses as batch failures instead of silently masking
          // them as `{duplicates: []}` (DocTpoint's #382 review). After
          // the 2-retry tier, if the response is still empty,
          // parseJsonResponse throws EmptyResponseError and the batch
          // is recorded as a dedupFailure.
          //
          // v1.26.0 Batch 7 (DocTpoint #382 comment 1): the null-vs-empty
          // distinction. parseJsonResponse returns null in two distinct
          // outcomes:
          //   1. Legitimate empty: LLM returned `{"duplicates": []}`
          //      correctly → no duplicates in this batch.
          //   2. Parse failure / truncated: response was non-empty but
          //      JSON was malformed OR truncated by max_tokens. The
          //      retry tier above already exhausted the empty-body case;
          //      the null here means "got body but couldn't parse it".
          //
          // Before Batch 7, both outcomes collapsed to the same `[]`
          // return. parse-failures inside the success branch NEVER
          // entered dedupFailures, so the [Duplicate Batch Failures]
          // log line was blind to mid-response truncation. As traffic
          // through this call scales up (post-Batch 2 cross-type
          // expansion), we need a real truncation count before tuning
          // max_tokens / batch size.
          //
          // Approach: keep parseJsonResponse contract stable (silent on
          // parse-fail, throws on empty — 10+ other call sites depend
          // on the silent contract). Check `=== null` here and route
          // into dedupFailures with a distinct reason tag. The
          // `throwOnEmpty: true` option above handles the empty-body
          // case; this handles the "got body but parse failed" case.
          //
          // v1.26.0 Batch 7 follow-up (DocTpoint Item 5): also route
          // shape-mismatches (`{duplicates: 'yes'}` / `{duplicates: 42}`
          // / `{duplicates: null}` — parsed successfully but the
          // `duplicates` field is not an array) into dedupFailures with
          // the same `type: 'parse-failure'` discriminator. Same root
          // cause as the `=== null` branch (LLM didn't return the shape
          // we asked for), same operator consequence (truncation /
          // prompt-format mismatch we need to count for tuning), and
          // the previous `Array.isArray(rawDumps) ? rawDups : []` line
          // silently masked it — operators lost the real signal. See
          // the regression guard test in
          // `__tests__/wiki/lint/llm-phases/dedup-phase.test.ts`.
          const dedupResult = await parseJsonResponse(dedupResponse, undefined, {
            throwOnEmpty: true,
            silentOnEmpty: false,
          }) as { duplicates?: DuplicateResult[] } | null;

          // One parse-failure branch covers BOTH outcome kinds — the
          // whole-response failure (null) and the shape-mismatch (parsed
          // but `duplicates` is not an array). Same reason tag, same
          // `type` discriminator so the rate-limit classifier excludes
          // both from the 429 grouping.
          const rawDups = dedupResult?.duplicates;
          const shapeMismatch =
            dedupResult !== null && !Array.isArray(rawDups);
          if (dedupResult === null || shapeMismatch) {
            // Parse failure / truncated / shape mismatch — NOT a
            // legitimate empty. Route into dedupFailures with a
            // distinct reason tag so the [Duplicate Batch Failures]
            // warning can distinguish this from network/429 errors.
            // The fulfilled/rejected branch downstream treats
            // dedupFailures as a record of skipped batches; the
            // post-loop summary line
            // (`[Duplicate Batch Failures] ${count} batches`) will
            // surface this. dedupFailures is captured by closure on
            // line 470; the push here is the canonical record path.
            const reason = shapeMismatch
              ? `parse-failure: response parsed but 'duplicates' is not an array (got ${rawDups === null ? 'null' : typeof rawDups})`
              : 'parse-failure: response present but JSON unparseable or truncated';
            console.warn(`lintWiki: batch ${batchNum} ${reason}`);
            // CR-3 fix: explicit `type: 'parse-failure'` discriminator
            // so the rate-limit classifier excludes this entry from the
            // rate-limit grouping. The free-text reason can change
            // without affecting the classifier.
            dedupFailures.push({ name: `batch-${batchNum}`, reason, type: 'parse-failure' });
            return [];
          }

          console.debug(`lintWiki: batch ${batchNum}/${batches.length} → ${rawDups?.length || 0} duplicates confirmed`);
          return rawDups;
        })
      );

      // v1.26.0 (#382 item 1, Batch 2 follow-up): in-scan concurrency
    // halving — ELEVATED threshold.
    //
    // Previous behavior: any single retry triggered immediate halving.
    // On the 2141-page vault (Aug 2026) this caused 4 → 2 → 1 cascade
    // after just 3 bursts, forcing the remaining 17 batches to run
    // serially and stretching wall-time to ~979s.
    //
    // New behavior: only halve when TWO CONSECUTIVE chunks have at
    // least one retry each. A single isolated retry (which attempt 2
    // or attempt 3 reliably recovers — see the e2e log) is treated as
    // a transient blip, not a sustained soft-throttle pattern. The
    // counter resets to 0 after any chunk that has zero retries, so
    // sustained throttling still gets halved — just one chunk later
    // than before.
    //
    // Why not "halve on every retry" as a simpler rule: each halving
    // step costs wall-time (chunks run serially at concurrency=1
    // instead of in parallel). On this vault, a single early
    // false-positive halve adds ~100s. Skipping halving on isolated
    // retries preserves the parallel chunking for the common case
    // where retries recover cleanly via attempt 2's 500ms backoff.
    //
    // Floor at 1. The user's settings value is unaffected
    // (currentConcurrency is a local that resets every run).
    // CR-1: `consecutiveThrottleChunks` and `HALVE_AFTER_CONSECUTIVE_CHUNKS`
    // were hoisted ABOVE this loop alongside `currentConcurrency` so the
    // counter accumulates across chunks instead of resetting every chunk.

    // v1.26.0 (#382 item 1, Batch 2): in-scan concurrency halving.
    // When this chunk produced any retry events (i.e. soft-throttle
    // detected), halve the in-scan concurrency for the rest of the
    // loop. Floor at 1. The user's settings value is unaffected
    // (currentConcurrency is a local that resets every run).
    i += currentConcurrency;
    if (softThrottleDetected) {
      consecutiveThrottleChunks += 1;
      if (consecutiveThrottleChunks >= HALVE_AFTER_CONSECUTIVE_CHUNKS && currentConcurrency > 1) {
        const newConcurrency = Math.max(1, Math.floor(currentConcurrency / 2));
        console.warn(
          `[Dedup LLM] soft-throttle detected in ${consecutiveThrottleChunks} consecutive chunks — ` +
          `temporarily reducing in-scan concurrency ${currentConcurrency} → ${newConcurrency} ` +
          `(user setting ${userConcurrency} is preserved; this adaptation is in-memory only)`
        );
        currentConcurrency = newConcurrency;
        consecutiveThrottleChunks = 0;
      }
    } else {
      consecutiveThrottleChunks = 0;
    }
    softThrottleDetected = false;

      for (let resultIdx = 0; resultIdx < results.length; resultIdx++) {
        const result = results[resultIdx];
        // v1.24.0: capture the real batch number via the closure. `batchNum`
        // for the bi'th result in this chunk is `batchStart + bi`. We
        // re-derive from `resultIdx` instead of `results.indexOf(result)`
        // to avoid relying on Promise.allSettled result identity.
        const batchNum = batchStart + resultIdx;
        if (result.status === 'fulfilled') {
          const rawDups = Array.isArray(result.value) ? result.value : [];
          const validDups = rawDups.filter(
            // v1.24.0 W5: include `typeof d.reason === 'string'` so LLMs that
            // return null/42 for `reason` are filtered out (not silently
            // passed through to DuplicateResult.reason: string).
            d => typeof d.target === 'string' && d.target.length > 0 &&
                 typeof d.source === 'string' && d.source.length > 0 &&
                 typeof d.reason === 'string'
          ).map(d => ({
            target: normalizeLLMPath(d.target, ctx.settings.wikiFolder),
            source: normalizeLLMPath(d.source, ctx.settings.wikiFolder),
            reason: d.reason,
          }))
          // Issue #826: the filter above runs BEFORE `normalizeLLMPath`, so it
          // never compares target to source — and two distinct strings that
          // resolve to one page both pass it. `wiki/entities/a.md` and
          // `entities/a.md` become the same path, and a literally repeated pair
          // needs no transformation at all. The self-pair then reaches the
          // merge path, which writes the target and deletes it. Normalise first,
          // compare second: that is what makes the filter mean what it reads as.
          .filter(d => d.target !== d.source);
          allDuplicates.push(...validDups);
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason || 'unknown');
          console.error('lintWiki: duplicate detection batch failed:', reason);
          // Real batch number (was `batch-${i + 1}` — the outer chunk-loop
          // index — which collided with sibling batches in the same chunk
          // at concurrency > 1; v1.24.0 review finding B4).
          dedupFailures.push({ name: `batch-${batchNum}`, reason });
        }
      }
    }

    // Rate-limit detection for duplicate detection
    const dedupRateInfo = detectRateLimitFailures(
      dedupFailures,
      concurrency,
      ctx.settings.batchDelayMs ?? 300,
    );
    if (dedupRateInfo) {
      console.warn(
        `[Duplicate Rate Limit] ${dedupRateInfo.count} duplicate detection batch(es) failed with 429, ` +
        `suggested concurrency=${dedupRateInfo.suggestedConcurrency}, delay=${dedupRateInfo.suggestedDelay}ms`
      );
      new Notice(formatRateLimitNotice(dedupRateInfo, ctx.settings.language), NOTICE_RATE_LIMIT);
    }
    // v1.26.0 (#382 item 1, Batch 2): log non-rate-limit failures
    // separately so DocTpoint's batch-expansion truncation hypothesis
    // is measurable across dedup runs.
    //
    // v1.26.0 Batch 7 + CR-3 fix (PR #411 simplify review 2026-08-05):
    // pass the FULL failure item, not just `f.reason`. The structured
    // `type: 'parse-failure'` discriminator on dedupFailures (added in
    // commit 6e6388a) was being dropped at every consumer — the
    // `isRateLimitFailure` structured-form branch was unreachable from
    // production. Without the fix, a future edit to the parse-failure
    // reason string that mentions "throttl" or "rate limit" would
    // silently misclassify parse-failures as 429s, vanish the
    // [Duplicate Batch Failures] truncation counter, AND fire a
    // spurious [Duplicate Rate Limit] Notice. The CR-3 regression
    // guarantee was on the test page; this wiring puts it on the
    // running plugin's call path too.
    const nonRateLimitFailures = dedupFailures.filter(f =>
      !isRateLimitFailure(f)
    );
    if (nonRateLimitFailures.length > 0) {
      console.warn(
        `[Duplicate Batch Failures] ${nonRateLimitFailures.length} duplicate detection batch(es) failed for non-rate-limit reasons (parse failure / empty response / etc.) — see preceding 'lintWiki: duplicate detection batch failed' lines for details`
      );
    }

    // v1.26.0 (#382 item 1, Batch 2): user-facing Notice when the
    // dedup-phase retry / concurrency-halving mechanism kicked in.
    // This is the only user-visible signal — the log has full detail,
    // but most users won't read it. The Notice fires only when at
    // least one batch triggered a retry (so a clean run stays quiet)
    // AND only once per scan (one Toast, not one per retry). It is
    // informational, not a failure — duplicate detection still
    // completed successfully for the batches that recovered.
    //
    // The Notice text comes from the `llmRetryRecoveredToast` i18n key
    // (10 locales). v1.27.0 follow-up: extract the retry/backoff into
    // a reusable `core/llm-retry.ts` helper that any LLM business
    // path (dedup, analysis, fix-runners) can use; this Toast key is
    // designed to be reused by those callers too.
    if (retryEvents.length > 0) {
      const delayedRetries = retryEvents.filter(e => e.delayMs > 0).length;
      const summary = delayedRetries > 0
        ? `${retryEvents.length} batch(es) recovered from empty LLM responses (${delayedRetries} with 2s backoff). Concurrency was temporarily reduced from ${userConcurrency} → ${currentConcurrency} for the rest of the scan. See console for detail.`
        : `${retryEvents.length} batch(es) recovered from empty LLM responses (immediate retry succeeded). See console for detail.`;
      console.warn(
        `[Dedup LLM] ${summary}`
      );
      new Notice(
        getText(ctx.settings.language, 'llmRetryRecoveredToast')
          .replace('{count}', String(retryEvents.length)),
        NOTICE_RATE_LIMIT,
      );
    }

    console.debug(`lintWiki: LLM confirmed ${allDuplicates.length} duplicate pairs total`);
    return allDuplicates;
  } catch (e) {
    // v1.26.0 (#382 item 3, Batch 1): AbortError is the user-cancellation
    // signal from hooks.checkCancelled (and from any other lint sub-phase
    // that propagates cancellation up the chain). The phase's contract
    // is to absorb errors and return [] rather than re-throw — see the
    // function header docstring and the v1.24.0 review comment on
    // controller.ts dedup behaviour — so we keep the early-return here.
    // We do, however, skip the "Duplicate detection failed" Notice
    // because that message is misleading when the user actually
    // cancelled (which is not a failure). The user-initiated cancel
    // path does not deserve an error Notice — the status bar / cancel
    // feedback lives in the controller layer.
    if (e instanceof DOMException && e.name === 'AbortError') {
      console.debug('lintWiki: dedup-phase aborted by user (no error Notice shown)');
      return [];
    }
    // v1.22.6 #204: errors in dedup phase should not crash the entire lint.
    // Log and return empty so subsequent phases can still report.
    console.error('Duplicate detection failed:', e);
    const errMsg = e instanceof Error ? e.message : String(e);
    // v1.24.0: Use NOTICE_ERROR (8s TTL) + auto-hide so dedup failures don't
    // sit forever (regression fix vs the v1.24.0 refactor's first pass which
    // used literal `0` and produced sticky Notices until restart).
    const errNotice = new Notice(
      t.lintDuplicateCheckFailedDetail.replace('{step}', 'Layer 3 (LLM verify)').replace('{error}', errMsg),
      NOTICE_ERROR,
    );
    window.setTimeout(() => errNotice.hide(), NOTICE_RATE_LIMIT);
    return [];
  }
}
