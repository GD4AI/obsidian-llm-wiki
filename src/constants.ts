/**
 * Centralized constants for the LLM Wiki plugin.
 *
 * Every magic number or string that is shared across ≥2 files MUST live here.
 * Single-file-local values (e.g. a max_tokens: 150 in a specific query step)
 * are documented with comments at their call site, not extracted.
 *
 * Replaces scattered magic strings/numbers with named constants for
 * maintainability, discoverability, and type safety.
 */

// ============================================================================
// Wiki Folder Structure
// ============================================================================

/** Standard subfolder names within the Wiki folder. */
export const WIKI_SUBFOLDERS = {
  entities: 'entities',
  concepts: 'concepts',
  sources: 'sources',
} as const;

// ============================================================================
// Source Ingestion
// ============================================================================

/**
 * File extensions (lowercase, no dot) accepted by the ingestion gate (#164).
 * Text sources are read directly; PDF sources are transcribed through the
 * configured LLM provider's native document-input capability (v1.25.0 PR2).
 */
export const COMPATIBLE_SOURCE_EXTENSIONS = ['md', 'markdown', 'txt', 'text', 'pdf'] as const;

/**
 * File extensions (lowercase, no dot) that route through the markdown
 * conversion path when `markdownConversionBackend === 'mineru'`. Per the
 * MinerU API (https://mineru.net/apiManage/docs), the Precise parser
 * accepts PDF + images (png/jpg/jpeg/jp2/webp/gif/bmp) + Office docs
 * (doc/docx/ppt/pptx/xls/xlsx). The native backend still only accepts
 * PDF — see `wiki-engine.ts:888` for the routing decision.
 */
export const MINERU_CONVERSION_EXTENSIONS = [
  'pdf', 'png', 'jpg', 'jpeg', 'jp2', 'webp', 'gif', 'bmp',
  'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
] as const;

// ============================================================================
// Lint & Performance Thresholds
// ============================================================================

/** Minimum substantive body content for a page to be considered non-empty. */
export const MIN_SUBSTANTIVE_CHARS = 50;

/** TTL for cached existing Wiki page list (milliseconds). */
export const PAGES_CACHE_TTL_MS = 5000;

// ============================================================================
// Custom Granularity Limits
// ============================================================================

/** Maximum custom entity/concept limit per type (settings UI cap). */
export const CUSTOM_LIMIT_MAX = 500;

// ============================================================================
// Batch Processing Settings
// ============================================================================

/**
 * Maximum user-configurable inter-batch delay (ms) in the provider settings
 * slider. Caps both the settings UI input and the rate-limit detector's
 * suggested-delay growth.
 */
export const MAX_BATCH_DELAY_MS = 10000;

/**
 * Default retry backoff (ms) used by `runBatchedWithRetry` when a caller
 * does not pass an explicit `apiDelayMs`. Distinct from `MAX_BATCH_DELAY_MS`:
 * this is the one-shot sleep before the *single retry* of a transiently
 * failed batch task, not the inter-batch delay.
 *
 * Kept at 2s because most production callers (`wiki-engine.ts` page-gen +
 * related-page paths) omit `apiDelayMs` and rely on this fallback. Raising
 * it would silently delay every transiently-failing batch by 8 extra
 * seconds with no user-visible benefit on healthy providers.
 */
export const DEFAULT_API_RETRY_DELAY_MS = 2000;

// ============================================================================
// PDF Source Ingestion (v1.25.0)
// ============================================================================

/** Max output tokens the LLM may emit when converting a PDF to Markdown.
 *  Sized for typical research papers (5-30 pages) without truncation. */
export const TOKENS_PDF_CONVERSION = 8000;

/** Default TTL for cached PDF→Markdown conversion entries (30 days, ms). */
export const PDF_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cache growth hard caps (v1.25.0 PR2 redo — three-defense-layer design).
 *
 * - MAX_BYTES: total disk usage cap (100 MB ≈ 1000 typical papers).
 * - MAX_ENTRIES: entry count cap. Lower bound on Obsidian startup scan time.
 * - MAX_SINGLE_ENTRY_BYTES: rejects writes for oversized single entries so
 *   one giant PDF (e.g. 500-page textbook → ~50 MB markdown) cannot hog
 *   the cache. Cache is performance-only; caller still gets the conversion.
 */
export const PDF_CACHE_MAX_BYTES = 100 * 1024 * 1024;
export const PDF_CACHE_MAX_ENTRIES = 1000;
export const PDF_CACHE_MAX_SINGLE_ENTRY_BYTES = 10 * 1024 * 1024;

/** Provider IDs whose built-in clients support PDF natively (v1.25.0 PR1).
 *  Providers NOT in this list fall through to the `forcePdfSupport`
 *  universal escape hatch (user opt-in) — see `core/pdf-converter.ts`. */
export const NATIVE_PDF_PROVIDER_IDS = [
  'anthropic',
  'openai',
  'bedrock-anthropic',
  'bedrock-openai',
] as const;

/** MinerU online API endpoints and bounded conversion resources. */
export const MINERU_API_BASE_URL = 'https://mineru.net/api/v4';
export const MINERU_API_TOKEN_SECRET_ID = 'karpathywiki-mineru-api-token';
export const MINERU_MAX_PDF_MB = 200;
export const MINERU_MAX_PDF_BYTES = MINERU_MAX_PDF_MB * 1024 * 1024;
/** Server-enforced page cap (err_msg "number of pages exceeds limit"). No
 *  client-side pre-check possible without a PDF parser — surfaced via the
 *  coded-rejection skip pipeline in wiki-engine.ts. */
export const MINERU_MAX_PDF_PAGES = 200;
export const MINERU_MAX_ZIP_BYTES = 256 * 1024 * 1024;
export const MINERU_MAX_ARCHIVE_FILES = 10_000;
export const MINERU_POLL_INTERVAL_MS = 3000;
export const MINERU_TIMEOUT_MS = 30 * 60 * 1000;

/** Minimum custom entity/concept limit per type. */
export const CUSTOM_LIMIT_MIN = 1;

/** Maximum batch size for custom granularity (LLM quality ceiling). */
export const CUSTOM_BATCH_SIZE_MAX = 50;

/** Minimum batch size for custom granularity (below this, use default config). */
export const CUSTOM_BATCH_SIZE_MIN = 10;

/** Tokens per item budget for dynamic max_tokens scaling in source analysis.
 *  Derived from observed output: 49 items ≈ 12K tokens → ~245 tokens/item.
 *  400 provides ~60% headroom for verbose summaries + JSON overhead. */
export const TOKENS_PER_ITEM_BUDGET = 400;

/** Retry cap multiplier for truncation retry in source analysis.
 *  Actual retry: ONE double-up (20K → 40K). The multiplier sets the cap
 *  so the retry never exceeds 3× base (60K), preventing runaway token use. */
export const SOURCE_ANALYZER_RETRY_MULTIPLIER = 3;

// ============================================================================
// LLM Token Budgets — semantic groups
// ============================================================================

/**
 * Maximum total tokens per LLM batch call.
 * Used for iterative source extraction and llm-client truncation retry cap.
 */
export const MAX_TOKENS_BATCH = 16000;

/**
 * Token budget for full page generation (entity/concept/source-summary).
 * The LLM is asked to produce a complete wiki page with all sections.
 */
export const TOKENS_PAGE_GENERATION = 8000;

/**
 * Token budget for append-to-reviewed-page (incremental short addition).
 */
export const TOKENS_APPEND_REVIEWED = 4000;

/**
 * Token budget for contradiction recording output.
 */
export const TOKENS_CONTRADICTION = 4000;

/**
 * Token budget for conversation summary extraction.
 */
export const TOKENS_CONVERSATION_EXTRACTION = 5000;

/**
 * Token budget for conversation summary page generation.
 */
export const TOKENS_CONVERSATION_PAGE = 8000;

/**
 * Token budget for entity dedup resolution (lightweight matching prompt).
 * Sized for short JSON output (action + path) with headroom for thinking-model
 * preamble that may consume part of the budget.
 *
 * v1.26.x PATCH #403: raised from 1000 → 3000. On reasoning-capable models
 * the deliberation is billed against the same max_tokens budget as the
 * answer; DocTpoint measurement (gemma-4-12b / LM Studio, 2.4 KB source ×
 * 45 calls) saw successful runs deliberate 286–921 tokens under a 1000 cap,
 * while 14/45 calls truncated and 13 of those returned empty content (read
 * as a valid negative — silent data loss). 3000 gives uniform ~50–80%
 * reasoning headroom while staying well below the call's context window.
 * Per-call reasoning-aware multiplier is deferred to v1.27.0's per-call
 * `thinkingPolicy` enum (scope item 6).
 */
export const TOKENS_DEDUP_RESOLUTION = 3000;

/**
 * v1.26.0 patch 16 (PR #357) — token budget for the source-lemma type
 * classification call (`SourceAnalyzer.classifyLemmaType`). The model returns
 * `{"kind": "entity"}` or `{"kind": "concept"}` — a two-class label — but
 * thinking-model preambles regularly consume the headroom, so we sit above
 * `TOKENS_DEDUP_RESOLUTION` (1000) and match `TOKENS_QUERY_MODEL_DETECT`
 * (2000) which has the same short-JSON, no-thinking-budget pattern. 32
 * (the original value) is unreachable for any thinking-capable model.
 */
export const TOKENS_LEMMA_CLASSIFY = 2000;

/**
 * Issue #527 — token budget for the intake type repair
 * (`SourceAnalyzer.askTypeFromVocabulary`): one vocabulary term as a
 * one-field JSON object, same short-answer / thinking-preamble pattern as
 * the lemma classification above, so the same budget.
 */
export const TOKENS_TYPE_REPAIR = TOKENS_LEMMA_CLASSIFY;

/**
 * Pages a prompt shows the model when it asks "which existing page is this?"
 * — the semantic dedup and Fix Dead Links draw from the same ranked window
 * (`core/candidate-window.ts`). The full list grew with the vault (~77K
 * chars at ~1285 entities) and, measured at a local 26B, the model did not
 * find a synonym's target in it (0 of 18) while it found the same targets
 * 9 of 9 times in a 30-entry window that contained them. The window is
 * always K pages: there is no fallback to the full list, because the list
 * was never where recall came from.
 */
export const CANDIDATE_WINDOW_TOP_K = 30;

/** Kept for the dedup call sites and tests that name the window by its first use. */
export const DEDUP_CANDIDATE_TOP_K = CANDIDATE_WINDOW_TOP_K;

/**
 * How much of a page's prose the window ranks against — read once per page
 * in `getExistingWikiPages`, lower-cased, cut here. 2,000 characters is what
 * the measurement scanned; the first paragraph of a page carries most of
 * the words its aliases will be described with.
 */
export const CANDIDATE_WINDOW_TEXT_CHARS = 2000;

/**
 * A context keyword found on more than this share of the pool's pages is
 * dropped before scoring. On any vault those are the function words of its
 * language ("werden", "through"); the cap replaces a stop list that would
 * have to know the language.
 */
export const CANDIDATE_WINDOW_DF_CAP = 0.5;

/**
 * v1.24.0 #216 — max tokens for the merge triage pre-flight classification.
 *
 * v1.24.0 Tier-2 (commit ab23bc0 + amend): the triage output now includes
 * a structured `items[]` array for the complementary path, with each
 * item carrying `content` (the new fact) + `target_section` (the localized
 * section label) + `reason`. A typical Tier-2 output with 2-3 items in
 * Chinese easily runs to 500-900 tokens; e2e observed heavy truncation
 * at 200 tokens with `{"strategy":` cut off mid-JSON. 2000 gives ample
 * headroom for both Tier-1 (compact) and Tier-2 (verbose) outputs.
 *
 * v1.26.x PATCH #403: raised from 2000 → 3000. DocTpoint measurement on
 * gemma-4-12b / LM Studio showed triage calls deliberating 766–1650 tokens
 * under a 2000 cap (32–44% miss rate across runs). 3000 gives uniform
 * ~50–80% reasoning headroom. See TOKENS_DEDUP_RESOLUTION for full rationale.
 */
export const TOKENS_MERGE_TRIAGE = 3000;

/**
 * Contradiction gate 2 (source stance): one yes/no plus one quoted sentence.
 * Measured 48/48 complete under 400 with reasoning off (S151); 600 leaves
 * room for a long evidence sentence.
 */
export const TOKENS_SOURCE_STANCE = 600;

/**
 * v1.24.0 #216 Tier-2 — max tokens for a single per-section append call.
 * The complementary path appends one paragraph per target section; the
 * LLM is given (existingSectionContent + 1-N new facts) and must return
 * just the appended paragraphs. 600 tokens covers ~3 paragraphs of
 * markdown per section comfortably.
 *
 * v1.26.x PATCH #403: raised from 600 → 3000. DocTpoint measurement on
 * gemma-4-12b / LM Studio saw 3/3 = 100% miss rate at the 600 cap (every
 * call truncated and returned empty — short-cap call sites are most
 * exposed to thinking-budget burn). 3000 gives uniform ~50–80% reasoning
 * headroom. See TOKENS_DEDUP_RESOLUTION for full rationale.
 */
export const TOKENS_COMPLEMENTARY_APPEND = 3000;

/**
 * Token budget for lint alias completion batch.
 *
 * v1.26.x PATCH #403: raised from 500 → 3000. Same reasoning-budget insurance
 * pattern: short-JSON output + thinking-channel burn on reasoning models puts
 * any sub-2000 cap at high risk of empty-content truncation. DocTpoint's
 * measurement on `complementaryAppend` (600 → 3/3 = 100% miss) showed the
 * short-cap call sites are the most exposed. 3000 gives uniform reasoning
 * headroom. See TOKENS_DEDUP_RESOLUTION for full rationale.
 */
export const TOKENS_LINT_ALIAS_BATCH = 3000;

/**
 * Token budget for lint duplicate detection LLM check.
 *
 * v1.26.0 (#382 item 1, Batch 2): raised from 4000 to 8000. The
 * e2e log on the 2141-page vault (Aug 2026) showed 10/10 batches
 * returning 0-byte responses on deepseek-v4-flash with max_tokens=4000.
 * Root cause: thinking-mode models (DeepSeek V3/R1, Claude extended
 * thinking, GPT-5 reasoning) burn thinking tokens against the same
 * max_tokens budget, so 4000 produces 0 output tokens after thinking.
 * 8000 gives the thinking channel ~4K and the JSON output ~4K — the
 * JSON response for a 100-candidate batch is typically 1.5-3K output
 * tokens. The dedup-phase also forces `enableThinking: false` on
 * thinking-capable models (see dedup-phase.ts), which is the primary
 * fix; 8000 is the safety margin for any model that doesn't honor
 * the override.
 */
export const TOKENS_LINT_DEDUP_LLM = 8000;

/**
 * Token budget for lint dead link / orphan / empty page fixes.
 */
export const TOKENS_LINT_PAGE_FIX = 8000;

/**
 * Token budget for lint orphan link fix (shorter prompt).
 *
 * v1.26.x PATCH #403: raised from 800 → 3000. Same reasoning-budget insurance
 * pattern as TOKENS_LINT_ALIAS_BATCH above — short JSON `{strategy, path}`
 * output on a reasoning-capable model burns the cap before content. 3000
 * gives uniform reasoning headroom. See TOKENS_DEDUP_RESOLUTION for rationale.
 */
export const TOKENS_LINT_ORPHAN_FIX = 3000;

/**
 * Token budget for query step 0 (model detection, tiny call).
 *
 * v1.24.1 PATCH Phase 5.5.0: raised 100 → 2000. Some providers' reasoning
 * models consume the entire budget on the internal chain-of-thought and
 * leave 0 tokens for the actual response body (a known DeepSeek V3 bug
 * reported 2026-07-13). Widening the budget to 2000 lets the JSON output
 * fit even after a verbose reasoning prelude.
 */
export const TOKENS_QUERY_MODEL_DETECT = 2000;

/**
 * Token budget for query page selection via LLM.
 *
 * v1.24.1 PATCH Phase 5.5.0: raised 500 → 2000. Same rationale as
 * TOKENS_QUERY_MODEL_DETECT — DeepSeek V3 reasoning can swallow the
 * previous budget before emitting JSON output.
 */
export const TOKENS_QUERY_PAGE_SELECT = 2000;

/**
 * Output budget for the final conversational answer in the Query flow.
 *
 * The Query flow used to reuse a 3000-token budget named for the internal
 * page-selection step. On reasoning models the chain of thought is billed
 * against the same budget and routinely consumes a third to a half of it, so
 * the visible answer was cut mid-sentence.
 */
export const TOKENS_QUERY_ANSWER = 8000;

/**
 * Token budget for query suggest-save dedup check.
 *
 * v1.24.1 PATCH Phase 5.5.0: raised 300 → 2000. Same rationale.
 */
export const TOKENS_QUERY_SAVE_DEDUP = 2000;

/**
 * v1.24.1 PATCH Phase 5.5.0 (new): token budget for the seed-selection
 * step where the LLM picks up to 3 PPR seed pages from a 50-page
 * (path, summary) list. Previously hardcoded at 200 in seed-selector.ts
 * which was the root cause of the persistent empty-body bug on DeepSeek
 * V3 — the 200-token budget was consumed by reasoning and the JSON
 * body never made it out. Set equal to the other Query budgets (2000)
 * for consistency.
 */
export const TOKENS_QUERY_SEED_SELECT = 2000;

/**
 * v1.24.1 PATCH Phase 5.5.1 (new): token budget for the Stage 1.5a
 * query keyword extractor. The LLM returns 5-10 short keywords as a
 * small JSON array — no need for a large budget. 1000 is enough for
 * the JSON output + any reasoning preamble for thinking models.
 *
 * Used by `generateQueryKeywords` in query-keywords.ts.
 *
 * v1.26.x PATCH #403: raised from 1000 → 3000. Same reasoning-budget
 * insurance pattern — short JSON `{keywords: []}` output on a reasoning-
 * capable model burns the cap before content. 3000 gives uniform reasoning
 * headroom. See TOKENS_DEDUP_RESOLUTION for full rationale.
 */
export const TOKENS_QUERY_KEYWORDS = 3000;

/**
 * Token budget for schema suggestion generation.
 */
export const TOKENS_SCHEMA_SUGGESTION = 4096;

/**
 * Character limit per wiki page loaded into the query engine context.
 * Derived from MAX_TOKENS_BATCH / 5 (~3200 tokens) × 4 chars/token ≈ 12800 chars.
 * Prevents merged multi-source pages from bloating the LLM context.
 */
export const MAX_PAGE_CONTENT_CHARS = 12800;

// ============================================================================
// LLM Client Settings
// ============================================================================

/** Maximum retries on HTTP 5xx/429 errors. Exponential backoff: delay = base * 2^attempt. */
export const MAX_RETRIES = 2;

/** Base delay (ms) for retry exponential backoff. */
export const RETRY_BASE_DELAY_MS = 1000;

// ============================================================================
// Notice Durations (ms) — semantic groups
// ============================================================================

/** Brief transient feedback (2000ms) — history cleared, setting saved, trivial ops. */
export const NOTICE_BRIEF = 2000;

/** Short transient feedback (3000ms) — auto-maintain triggers, range clamps, save confirm. */
export const NOTICE_SHORT = 3000;

/** Watcher notification (4000ms) — file watcher active notice. */
export const NOTICE_WATCHER = 4000;

/** Normal operation result (5000ms) — success messages, non-critical errors. */
export const NOTICE_NORMAL = 5000;

/** Progress cancellation (5000ms re-export) — semantic alias of NORMAL. */
export const NOTICE_CANCEL = 5000;

/** Operation abort feedback (6000ms) — intermediate step between normal and error. */
export const NOTICE_ABORT = 6000;

/** Error feedback (8000ms) — critical failures, user must read. */
export const NOTICE_ERROR = 8000;

/** Rate-limit feedback (10000ms) — long reading needed. */
export const NOTICE_RATE_LIMIT = 10000;

// ============================================================================
// UI Timings
// ============================================================================

/** Timer update interval for Query progress display (elapsed time counter). */
export const TIMER_UPDATE_INTERVAL_MS = 1000;

/**
 * Event loop yield interval for async O(n²) operations.
 * Every N outer iterations, await a setTimeout(0) to prevent UI thread blocking.
 */
export const YIELD_EVERY_ITERATIONS = 200;

// ============================================================================
// Query Custom Instructions (Issue #251)
// ============================================================================

/**
 * Maximum length (chars) for the Issue #251 Custom Query Instructions
 * textarea. Defensive cap against users pasting huge blocks into the
 * system prompt area. Applied at the input layer AND at the injection
 * layer (defense in depth).
 */
export const CUSTOM_QUERY_INSTRUCTIONS_MAX_CHARS = 5000;

// ============================================================================
// Lint Performance Knobs — central tunables for lint scan O(n²) work
// ============================================================================

/**
 * Phase-1 (page parsing) yield cadence in duplicate-detection — finer than
 * the outer loop because parsing is cheap per item but the set accumulates.
 */
export const LINT_YIELD_EVERY_PHASE1 = 50;

/**
 * Comparison-phase yield cadence in duplicate-detection — coarser, since
 * O(n²) pair comparisons are CPU-bound per item.
 */
export const LINT_YIELD_EVERY_COMPARISON = 500;

/**
 * v1.26.0 (#382 item 3, Batch 1): length of the title prefix used as the
 * first dimension of the dual-key bucket. Combined with the second
 * dimension (link-hash from outgoing wiki-links), this gives recall in
 * the 97-98% range for cross-vault wikis (down from 100% for O(n²)
 * all-pairs, but eliminates the O(N²) memory peak that OOMs at ~2000
 * pages). See the Batch 1 plan in memory for the full recall analysis.
 *
 * Calibrated for Latin-script wikis. For non-Latin scripts (CJK,
 * Cyrillic), `normalizeForMatch` strips most characters (only
 * `[a-z0-9一-鿿]` survive), so titles in those scripts land in the
 * empty-string prefix bucket or get dropped — those pages depend
 * entirely on the `lh:` link-hash dimension for recall. This is a
 * known limitation; expanding the partition to script-aware prefix
 * lengths is future work (Batch 2+).
 */
export const LINT_DEDUP_BUCKET_PREFIX_LEN = 2;

/**
 * v1.26.0 (#382 item 1, Batch 2): cap on the size of an `ic:` (incoming-
 * link) bucket to bound per-page fan-out. A page with N incoming links
 * would otherwise land in N distinct `ic:` buckets; pages in the
 * most-popular 50 of those buckets still get the ic: dimension, the
 * remainder are skipped (their title-prefix and outgoing-link buckets
 * still apply). 50 matches Batch 1's `LINT_DEDUP_BATCH_SIZE = 100` /
 * 2 — fan-out above that risks O(N²) per-bucket pair loops.
 */
export const LINT_DEDUP_MAX_BUCKET_SIZE = 50;

/** Batch size for vault reads during lint preparation. */
export const LINT_PREP_BATCH_READ = 200;

/**
 * v1.26.0 (#382 item 2): Jaccard-similarity threshold for the "shared
 * outgoing wiki-links" signal in duplicate-detection. Two pages whose
 * outgoing `[[wiki-links]]` overlap by `>=` this fraction are flagged as
 * a `sharedLinks` candidate, subject to the body-similarity gate below.
 *
 * Calibrated against cross-vault wikis in `src/wiki/lint/duplicate-detection.ts`.
 * Lowering to ~0.3 surfaces more link-hub collisions; raising to ~0.5
 * narrows to true co-link clusters. Exposed in Auto Maintenance settings
 * (advanced-mode toggle) as `lintJaccardLinkThreshold`; leaving the input
 * blank = use this constant.
 */
export const LINT_DEDUP_JACCARD_LINK_THRESHOLD = 0.4;

/**
 * v1.26.0 (#382 item 2): body-similarity floor for the shared-links
 * signal. When two pages share outgoing wiki-links but their body-text
 * overlap is `<` this fraction, they are NOT flagged as duplicates —
 * even pages with identical link graphs but unrelated prose should not
 * be merged (e.g. two unrelated pages both linking only to one popular
 * hub page).
 *
 * Calibrated against cross-vault wikis. Raise this if you see false
 * positives where two unrelated pages happen to link to the same hub.
 * Exposed in Auto Maintenance settings (advanced-mode toggle) as
 * `lintJaccardBodyGate`; leaving the input blank = use this constant.
 */
export const LINT_DEDUP_JACCARD_BODY_GATE = 0.2;

/**
 * v1.26.0 (#382 item 2): character-bigram Jaccard threshold for the
 * title/alias similarity signal. Title/alias pairs whose bigram set
 * overlap by `>=` this fraction are flagged as a `bigram` candidate
 * (catches spelling variants and same-language near-matches).
 *
 * Calibrated against cross-vault wikis. Lowering catches more spelling
 * variants and minor typos; raising requires near-identical titles.
 * Exposed in Auto Maintenance settings (advanced-mode toggle) as
 * `lintBigramThreshold`; leaving the input blank = use this constant.
 */
export const LINT_DEDUP_BIGRAM_THRESHOLD = 0.4;

/**
 * v1.26.0 (#382 item 2): bigram-score cutoff that decides whether a
 * `bigram` candidate is sent to the LLM as a Tier-1 (always verify)
 * or Tier-2 (fills the remaining token budget). Score `>=` this value
 * → Tier 1; below → Tier 2.
 *
 * INTENTIONALLY NOT EXPOSED as a settings field: the cutoff shapes
 * which generated candidates the LLM sees, which directly re-shapes
 * the LLM input distribution in ways that need release-time
 * verification (the LLM contract was verified against the default).
 * Bumping it without understanding the budget model would either flood
 * the LLM (cutoff too low) or silently drop candidates (cutoff too
 * high). If a per-vault override is needed in the future, expose it
 * with a stronger justification than "tunability".
 */
export const LINT_DEDUP_BIGRAM_TIER1_CUTOFF = 0.6;

/**
 * v1.26.0 (#382 item 1, Batch 2): Jaccard-similarity threshold for the
 * sharedIncoming signal — two pages whose incoming-source sets (the
 * list of wiki pages that cite them) overlap by `>=` this fraction
 * are flagged as a `sharedIncoming` candidate. Lower than the
 * outgoing-link threshold (0.4) because incoming-link overlap is
 * intrinsically rarer: most pages are cited by only 1-3 sources, so a
 * 0.3 overlap carries stronger semantic signal than a 0.4 outgoing
 * overlap (where 50+ outgoing hubs are common).
 *
 * INTENTIONALLY NOT EXPOSED as a settings field for the same reason
 * as LINT_DEDUP_BIGRAM_TIER1_CUTOFF — controls which generated
 * candidates the LLM sees, needs release-time verification of the
 * LLM contract before any per-vault override.
 */
export const LINT_DEDUP_INCOMING_LINK_THRESHOLD = 0.3;

// ============================================================================
// Amazon Bedrock Stage 1 (v1.24.1 PATCH) — bedrock-mantle endpoint
// ============================================================================

/**
 * AWS regions where Amazon Bedrock is currently available.
 * Source: https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html
 * Stage 1 supports 18 regions via the unified bedrock-mantle endpoint (no
 * regional variant suffix needed for Messages / Chat Completions endpoints).
 */
export const BEDROCK_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-central-2',
  'eu-north-1',
  'eu-south-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-south-1',
  'ca-central-1',
  'sa-east-1',
] as const;

export type BedrockRegion = typeof BEDROCK_REGIONS[number];

/** Default region if user has not selected one. us-east-1 has the broadest model coverage. */
export const BEDROCK_DEFAULT_REGION: BedrockRegion = 'us-east-1';

/**
 * Returns the bedrock-mantle Anthropic Messages baseURL for the given region.
 * Per https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-mantle.html
 * the endpoint is region-scoped; bearer auth only; body schema is identical
 * to api.anthropic.com.
 */
export function bedrockMantleMessagesUrl(region: BedrockRegion): string {
  return `https://bedrock-mantle.${region}.api.aws`;
}

/**
 * Returns the bedrock-mantle OpenAI Chat Completions baseURL for the given
 * region. Same host as Messages, but the chat completions protocol lives
 * at the `/v1` prefix.
 */
export function bedrockMantleChatCompletionsUrl(region: BedrockRegion): string {
  return `https://bedrock-mantle.${region}.api.aws/v1`;
}

/**
 * Per-candidate token estimate for duplicate-detection prompt budget.
 * Each candidate ≈ 120 chars ≈ 30 tokens.
 */
export const LINT_CANDIDATE_TOKEN_ESTIMATE = 30;

/**
 * Input-token cap for a single lint LLM call (candidate batch prompt).
 * Leaves room for prompt + output in the model's context window.
 */
export const LINT_MAX_INPUT_TOKENS = 15000;

/**
 * Number of candidates fed per lint dedup LLM call.
 *
 * v1.26.0 (#382 item 1, Batch 2): reduced from 100 to 50. The e2e log
 * on a 2141-page vault (Aug 2026) with deepseek-v4-flash showed batches
 * with 100 candidates produced 14K-char prompts, which under the
 * provider's thinking-mode behaviour (thinking tokens consume the
 * max_tokens output budget) yielded 0-byte responses on 9/10 batches.
 * Batches with 50 candidates produce ~10K-char prompts that fit within
 * the thinking model's output budget, so all batches return content.
 * The user-paid cost is ~2x more LLM calls (20 batches vs 10), but
 * each batch completes faster because the model thinks less.
 */
export const LINT_DEDUP_BATCH_SIZE = 50;

/**
 * v1.26.0 (#382 item 1, Batch 2): empirically-derived upper bound for
 * the dedup batch's rendered prompt. When the prompt exceeds this size,
 * thinking-mode LLMs (DeepSeek V3/V4, Claude extended thinking,
 * GPT-5 reasoning) burn their max_tokens output budget on internal
 * reasoning and return 0-byte responses on most batches. The
 * 7,000-character threshold was measured on a 2141-page vault
 * (Aug 2026 e2e): every batch with prompt < 7K chars returned
 * content reliably on deepseek-v4-flash with max_tokens=8000;
 * batches with prompt > 8K chars returned 0 on ~10-50% of attempts.
 *
 * The dedup-phase batch splitter shrinks the batch size at split
 * time to keep the rendered prompt under this budget (so a batch
 * with 50 candidates that would produce a 14K-char prompt is
 * split into two batches of ~25 each, even though both are under
 * the LINT_DEDUP_BATCH_SIZE cap). This is purely a thinking-model
 * insurance; non-thinking models are unaffected (they fit 100
 * candidates in 4K tokens easily).
 */
export const LINT_DEDUP_PROMPT_CHAR_BUDGET = 7000;

// ============================================================================
// Query Wiki — PPR top-N page retrieval
// ============================================================================

/**
 * Default number of pages PPR returns for Query Wiki context assembly.
 *
 * v1.24.1 PATCH Phase 5.5.0: raised from 5 → 10 per user direction. With
 * only 5 pages the `5 pages · PPR` chip loses meaning on large vaults
 * (2137 nodes easily surface >5 relevant pages via PPR graph walk).
 * 10 strikes a balance — fuller context without blowing the typical
 * model's prompt window. Token overflow is handled by Phase 5.4's
 * graceful overflow fallback (auto-shrink + retry).
 *
 * Adaptive top-N (select-seeds.ts) computes the effective top-N as:
 *   effective = min(DEFAULT_QUERY_TOP_N_PAGES, totalPageRefs)
 * then clamped by MAX_QUERY_TOP_N_PAGES below. A small wiki (e.g.
 * 12 pages) returns all 12; a large wiki (2137 pages) returns 10.
 */
export const DEFAULT_QUERY_TOP_N_PAGES = 10;

/**
 * Hard cap on top-N regardless of wiki size. Defends against runaway
 * token cost on very large vaults even when the adaptive formula
 * would allow more. Phase 5.4 overflow fallback kicks in past this
 * point (shrinks pages instead of dropping them) so the user always
 * gets a result.
 */
export const MAX_QUERY_TOP_N_PAGES = 20;

// ============================================================================
// Query Wiki — 4-stage seed selection (Phase 5.5.0)
// ============================================================================

/**
 * Stage 1 (lex match) → Stage 1.5 (LLM seed selector) escalation threshold:
 * minimum number of lex hits required to trust the lex-only path.
 *
 * When the lex scorer finds at least this many matching pages, the
 * top-K of them become the PPR seeds directly (skipping the LLM
 * escalation). Below this count, the recall is considered too narrow
 * to be useful and we escalate to the LLM for semantic matching.
 *
 * v1.24.1 PATCH Phase 5.5.0: 3 is a sweet spot — fewer than 3 hits
 * can't reliably drive a PPR graph expansion; more than 3 hits and we
 * already have enough material to skip the LLM call (saves a network
 * round-trip).
 */
export const LEX_MATCH_MIN_COUNT = 3;

/**
 * Stage 1 (lex match) → Stage 1.5 (LLM seed selector) escalation threshold:
 * minimum top-hit score required to trust the lex-only path.
 *
 * Lex scoring (see lexMatchByTitleAndAliases in ppr-cascade.ts):
 *   - title hit:    3
 *   - alias hit:    2
 *   - summary hit:  1  (NB: not used by Stage 1, kept here for context)
 *
 * Score ≥ 5 ≈ "1 title hit + 1 alias hit" → multi-signal match, not a
 * single-particle substring. Single-signal hits (e.g. just an alias
 * match for "的") produce noisy results that PPR can't disambiguate.
 *
 * v1.24.1 PATCH Phase 5.5.0.
 */
export const LEX_MATCH_MIN_TOP_SCORE = 5;

/**
 * Stage FALLBACK seeds count: when both Stage 1 (lex) and Stage 1.5
 * (LLM seed selector) fail to produce query-relevant seeds, use the
 * top-K lex pages as seeds anyway. PPR can still extract *some*
 * recall from low-quality seeds (better than no seeds → empty walk).
 *
 * v1.24.1 PATCH Phase 5.5.0. 5 is enough to give PPR enough graph
 * anchors without polluting the chat LLM's page-bodies set with
 * obviously-irrelevant pages.
 */
export const LEX_FALLBACK_TOP_K = 5;

/**
 * Stage 1.5 (LLM seed selector) input cap: maximum number of lex-
 * ranked candidate pages sent to the LLM for semantic seed selection.
 *
 * Why cap: the LLM's Stage 1.5 prompt only carries path + title +
 * aliases (no summary, no body — see seed-selector.ts). 50 pages of
 * that material ≈ 3-5K tokens, well inside any model's prompt
 * window. Larger caps dilute the LLM's selection precision.
 *
 * v1.24.1 PATCH Phase 5.5.0.
 */
export const QUERY_SEED_LLM_MAX_CANDIDATES = 50;

// ============================================================================
// Source-Analyzer / Page-Factory Batch Sizing
// ============================================================================

/**
 * Below this content size (chars), the analyzer auto-downgrades maxTotalItems
 * to avoid "hard digging" — a 6800-char source can't yield 50 wiki-worthy items.
 */
export const SHORT_CONTENT_THRESHOLD = 20000;

/**
 * Chars-per-item estimate used to cap maxTotalItems for short content.
 * Pairs with SHORT_CONTENT_THRESHOLD above.
 */
export const BATCH_CHARS_PER_ITEM = 600;

// ============================================================================
// Alias Hardening (v1.25.10 PATCH)
// ============================================================================

/**
 * Minimum length (chars, after trim) of an alias that the plugin will
 * ever accept on a wiki page. Single-character aliases are dropped at
 * the `filterRedundantAliases` gate because they carry no dedup value
 * above the page basename and collide with shorthand tokens across
 * the entire vault (`a` is a real proposal from small LLMs).
 *
 * Tuned to 2 so common short abbreviations stay usable: ML, HD, CD,
 * AI, UI, OS, DB, ... are real-world aliases for technical vaults
 * and rejecting them at the floor would be over-aggressive. Raise to
 * 3 only if a specific vault surfaces alias clutter.
 *
 * Default of the `minAliasLength` setting (Settings → Advanced), which
 * overrides it per vault; the constant stays the fallback for callers
 * that carry no settings. Bounds below are what the setting accepts:
 * one-character aliases stay out, and above six the floor starts to
 * drop real names.
 */
export const MIN_ALIAS_LENGTH = 2;
export const MIN_ALIAS_LENGTH_MIN = 2;
export const MIN_ALIAS_LENGTH_MAX = 6;

// #661: the shortest extracted name the semantic dedup may be asked about when
// no page carries it. Two code points carry nothing a summary could confirm —
// `Cr` was merged into `Kreatinin` by two different window builders — so below
// this the resolver creates instead of inferring. Deliberately not
// `MIN_ALIAS_LENGTH`: what a vault accepts as an alias is the user's setting;
// this is about what the resolver may infer, and a short alias a user did set
// still resolves deterministically.
export const MIN_DEDUP_NAME_LENGTH = 3;
