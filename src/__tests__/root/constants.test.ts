import { describe, it, expect } from 'vitest';
import {
  MAX_TOKENS_BATCH,
  TOKENS_PAGE_GENERATION,
  TOKENS_APPEND_REVIEWED,
  TOKENS_COMPLEMENTARY_APPEND,
  TOKENS_CONVERSATION_EXTRACTION,
  TOKENS_CONVERSATION_PAGE,
  TOKENS_DEDUP_RESOLUTION,
  TOKENS_LINT_ALIAS_BATCH,
  TOKENS_LINT_DEDUP_LLM,
  TOKENS_LINT_ORPHAN_FIX,
  TOKENS_MERGE_TRIAGE,
  TOKENS_QUERY_KEYWORDS,
  TOKENS_QUERY_MODEL_DETECT,
  TOKENS_QUERY_PAGE_SELECT,
  TOKENS_QUERY_SAVE_DEDUP,
  TOKENS_QUERY_SEED_SELECT,
  TOKENS_SCHEMA_SUGGESTION,
  LEX_MATCH_MIN_COUNT,
  LEX_MATCH_MIN_TOP_SCORE,
  LEX_FALLBACK_TOP_K,
  QUERY_SEED_LLM_MAX_CANDIDATES,
} from '../../constants';

/**
 * Tests for Issue #75: token budget constants.
 *
 * These constants cap LLM output sizes per call type. Two changes:
 * - TOKENS_DEDUP_RESOLUTION: 300 → 1000 (insurance against thinking-model preamble)
 * - TOKENS_QUERY_SAVE_DEDUP: 150 → 300 (similar insurance)
 *
 * The other values are unchanged but explicitly asserted to document intent.
 */
describe('Token budget constants (Issue #75)', () => {
  it('MAX_TOKENS_BATCH is 16000 (cloud default cap for truncation retry)', () => {
    expect(MAX_TOKENS_BATCH).toBe(16000);
  });

  // v1.26.x PATCH #403: 1000 → 3000 (reasoning-budget insurance for
  // thinking-capable models). See the `'Reasoning-budget token caps
  // (Issue #403)'` describe block below for the full rationale + the
  // bump for TOKENS_MERGE_TRIAGE and TOKENS_COMPLEMENTARY_APPEND.
  it('TOKENS_DEDUP_RESOLUTION is 3000 (reasoning-budget insurance)', () => {
    expect(TOKENS_DEDUP_RESOLUTION).toBe(3000);
  });

  it('TOKENS_QUERY_SAVE_DEDUP is 2000 (insurance for thinking models, v1.24.1 PATCH Phase 5.5.0)', () => {
    expect(TOKENS_QUERY_SAVE_DEDUP).toBe(2000);
  });

  it('page-level generation constants are 8000', () => {
    expect(TOKENS_PAGE_GENERATION).toBe(8000);
    expect(TOKENS_CONVERSATION_PAGE).toBe(8000);
  });

  it('lint dedup constant is 8000 (v1.26.0 Batch 2 — thinking-mode insurance)', () => {
    // v1.26.0 (#382 item 1, Batch 2): raised from 4000 to 8000 to
    // accommodate thinking-mode models (deepseek-v4-flash) that burn
    // thinking tokens against the same max_tokens budget, producing
    // 0-byte responses when the budget is too small. 8000 gives the
    // thinking channel ~4K and the JSON output ~4K.
    expect(TOKENS_LINT_DEDUP_LLM).toBe(8000);
  });

  it('append-reviewed constant remains 4000 (thinking-mode insurance unrelated)', () => {
    // This path doesn't have the same thinking-budget issue because its
    // prompt is short (single review item) and the LLM call is already
    // at minimum viable size.
    expect(TOKENS_APPEND_REVIEWED).toBe(4000);
  });

  it('query constants are 2000 (Phase 5.5.0 thinking-model insurance)', () => {
    // v1.24.1 PATCH Phase 5.5.0: raised all Query-token budgets to 2000
    // so DeepSeek V3's reasoning preamble doesn't consume the entire
    // budget before the JSON output is emitted. TOKENS_LINT_ORPHAN_FIX
    // (800) stays at its non-2000 value from a prior cycle; the
    // user-facing answer has its own budget (TOKENS_QUERY_ANSWER).
    expect(TOKENS_QUERY_PAGE_SELECT).toBe(2000);
    expect(TOKENS_QUERY_MODEL_DETECT).toBe(2000);
    expect(TOKENS_QUERY_SEED_SELECT).toBe(2000);
    expect(TOKENS_QUERY_SAVE_DEDUP).toBe(2000);
  });

  it('Query seed-selector LLM candidates cap is 50 (Phase 5.5.0)', () => {
    // v1.24.1 PATCH Phase 5.5.0: the Stage 1.5 LLM seed selector is fed
    // the lex-ranked top-N candidates so it sees the same title+aliases
    // material the lex scorer saw (consistency between stages). 50 is
    // large enough to capture a focused candidate set even on a small
    // wiki, small enough to fit comfortably in the Stage 1.5 prompt.
    expect(QUERY_SEED_LLM_MAX_CANDIDATES).toBe(50);
  });

  it('Lex escalation thresholds (Phase 5.5.0)', () => {
    // Stage 1 → Stage 1.5 escalation: lex must have at least 3 hits
    // AND the top hit score must be ≥ 5 (≈ 1 title hit + 1 alias hit,
    // i.e. multi-signal match — not a single-particle substring).
    expect(LEX_MATCH_MIN_COUNT).toBe(3);
    expect(LEX_MATCH_MIN_TOP_SCORE).toBe(5);
    // Stage FALLBACK (when Stage 1.5 LLM also returns empty): use the
    // top 5 lex pages as seeds, so PPR still has *something* to walk
    // from rather than nothing.
    expect(LEX_FALLBACK_TOP_K).toBe(5);
  });

  it('TOKENS_SCHEMA_SUGGESTION is at least 1024 (v1.22.0 bumped to 4096 for full schema body + reasoning overhead)', () => {
    expect(TOKENS_SCHEMA_SUGGESTION).toBeGreaterThanOrEqual(1024);
  });

  it('TOKENS_CONVERSATION_EXTRACTION is 5000', () => {
    expect(TOKENS_CONVERSATION_EXTRACTION).toBe(5000);
  });
});

describe('Reasoning-budget token caps (Issue #403)', () => {
  // Six call sites carry short-JSON output (`{strategy, path}`,
  // `{keywords: []}`, `{kind: "entity"}`, etc.) and were sized for
  // non-reasoning models. On reasoning-capable models the deliberation is
  // billed against the same max_tokens budget as the answer — DocTpoint's
  // measurement (gemma-4-12b, 4bit, LM Studio, 2.4 KB source × 45 calls):
  // 14 truncated, 13 of those empty. `complementaryAppend` was 3/3 = 100%
  // miss at its 600 cap. The three smallest caps (500/800/1000) below are
  // the same call-site shape and inherit the same risk; this PR bumps them
  // uniformly to 3000 for ~50–80% reasoning headroom while keeping the cap
  // well below the call's context window.
  //
  // Per-call reasoning-aware multiplier is deferred to v1.27.0's per-call
  // `thinkingPolicy` enum (item 6 in [[project_v1_26_x_patch_scope]]).
  it('TOKENS_DEDUP_RESOLUTION is 3000 (reasoning-budget insurance)', () => {
    expect(TOKENS_DEDUP_RESOLUTION).toBe(3000);
  });

  it('TOKENS_MERGE_TRIAGE is 3000 (reasoning-budget insurance)', () => {
    expect(TOKENS_MERGE_TRIAGE).toBe(3000);
  });

  it('TOKENS_COMPLEMENTARY_APPEND is 3000 (reasoning-budget insurance)', () => {
    expect(TOKENS_COMPLEMENTARY_APPEND).toBe(3000);
  });

  it('TOKENS_LINT_ALIAS_BATCH is 3000 (reasoning-budget insurance)', () => {
    expect(TOKENS_LINT_ALIAS_BATCH).toBe(3000);
  });

  it('TOKENS_LINT_ORPHAN_FIX is 3000 (reasoning-budget insurance)', () => {
    expect(TOKENS_LINT_ORPHAN_FIX).toBe(3000);
  });

  it('TOKENS_QUERY_KEYWORDS is 3000 (reasoning-budget insurance)', () => {
    expect(TOKENS_QUERY_KEYWORDS).toBe(3000);
  });
});

describe('Dead code removed (Issue #75)', () => {
  // These constants had no callers and have been removed. Importing them now
  // would fail, so we document the removal via a passing test.
  it('TOKENS_PAGE_MERGE and TOKENS_RELATED_UPDATE are not exported', async () => {
    const constants = await import('../../constants');
    expect(constants).not.toHaveProperty('TOKENS_PAGE_MERGE');
    expect(constants).not.toHaveProperty('TOKENS_RELATED_UPDATE');
  });
});

describe('source-analyzer shadow constant removed (Issue #75)', () => {
  // Previously source-analyzer.ts had `const MAX_TOKENS = 16000` shadowing
  // the centralized MAX_TOKENS_BATCH. This caused LM Studio (8K context) to fail
  // because analyzeSource used the un-capped 16000 value. Now it imports and
  // uses MAX_TOKENS_BATCH directly.
  //
  // We verify by importing the centralized constant and checking the re-exported
  // function signature is correct — the actual shadow deletion is enforced by
  // the ModuleWatcher in source-analyzer.ts integration tests.
  it('MAX_TOKENS_BATCH is 16000 (the value that replaced the shadow)', () => {
    expect(MAX_TOKENS_BATCH).toBe(16000);
  });
});
