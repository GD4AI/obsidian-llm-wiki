// Core Wiki data structures

import { App } from 'obsidian';
import type { z } from 'zod';
import type { RejectionReason } from './core/source-requirements';
import type { TaskPolicyMap } from './core/task-policy';
import type { OutputMode } from './llm-sdk/output-mode-prober';
import type { TEXTS } from './texts';

/**
 * Issue #244 — Programmatic Mentions writes (v1.23.3 / v1.24.0).
 *
 * A `MentionWithProvenance` is a verbatim quote from a source note plus
 * the metadata needed to write a `[[source-path|basename]]` link and to
 * sort/dedup across multiple sources. The schema intent
 * (schema-manager.ts:117-128) is that Mentions is a per-quote
 * provenance-to-original link — clicking should land on the verbatim
 * source, not on a wiki-summary round-trip.
 */
export interface MentionWithProvenance {
  /** The verbatim quote text (preserves original language; never translated). */
  quote: string;
  /**
   * Optional translation of `quote` into the user's wiki output language.
   * Only emitted by the LLM when wikiLanguage ≠ source language (cross-language).
   * When present, the formatter renders: `"<verbatim>" (<translation>) — [[path|display]]`.
   * Half-width parentheses are used regardless of locale.
   */
  translation?: string;
  /** Original vault note path the quote was extracted from (e.g. "notes/foo.md"). */
  source_path: string;
  /** The sources/<slug> reference used in the page frontmatter `sources:` field. */
  source_slug: string;
  /** ISO timestamp of when this mention was extracted from the source. */
  extracted_at: string;
}

/**
 * Issue #312 — the ingest-side facts the merge path needs in order to tell a
 * source that a page is ABOUT from a source that merely mentions it.
 *
 * Optional at every call site. Callers without an ingest upstream (the lint
 * pipeline) pass nothing, which leaves both the merge routing and the rendered
 * triage prompt exactly as they were.
 */
export interface SourceContext {
  /** `SourceAnalysis.source_title` — the analyzer's title for the source. */
  sourceTitle: string;
  /**
   * `SourceAnalysis.summary` — what the SOURCE document is about. Distinct
   * from `EntityInfo.summary` / `ConceptInfo.summary`, which describe the
   * extracted item; the triage prompt already carries the latter.
   */
  summary: string;
  /** Carried for telemetry only — deliberately not rendered into any prompt. */
  sourcePath: string;
  /** Curated `aliases:` authored on the source note frontmatter (Issue #185). */
  noteAliases?: string[];
}

export interface SourceAnalysis {
  source_file: string;
  source_title: string;
  summary: string;
  entities: EntityInfo[];
  concepts: ConceptInfo[];
  contradictions: ContradictionInfo[];
  related_pages: string[];
  key_points: string[];
  created_pages: string[];
  updated_pages: string[];
  /**
   * Issue #185 — curated `aliases:` authored on the source note
   * frontmatter. Read by `SourceAnalyzer.analyzeSource` from
   * `app.metadataCache.getFileCache(file)?.frontmatter?.aliases`.
   * Always a string array (or undefined when the source has no
   * frontmatter at all). NOT normalized — values come through
   * verbatim so downstream propagation can deduplicate against the
   * generated `sources/<slug>` page's existing aliases.
   *
   * Strict scope: extracted by the analyzer; consumed by
   * `WikiEngine.createSummaryPage` to inject into the
   * `sources/<slug>` page (Step 2). NOT used for entity/concept
   * pages — those follow the existing `info.aliases` path.
   */
  source_note_aliases?: string[];

  /**
   * Issue #496 — verbatim quotes aggregated across every extracted item
   * (provenance `quote`s preferred over legacy strings; deduped by trimmed
   * text). Populated by `buildSourceAnalysis`; consumed by
   * `WikiEngine.createSummaryPage` so the generated sources/ page carries a
   * Mentions section built from full-text captures instead of the model's
   * 500-character window. Optional because hand-constructed analyses
   * (tests, callers predating #496) legitimately omit it.
   */
  mentions_in_source?: string[];
}

export interface EntityInfo {
  name: string;
  type: 'person' | 'organization' | 'project' | 'product' | 'event' | 'place' | 'other';
  aliases?: string[];  // Pre-generated aliases from extraction (seeds for page generation)
  summary: string;
  mentions_in_source: string[];
  /**
   * Issue #244 — structured Mentions with provenance. When provided,
   * the page-factory uses this instead of `mentions_in_source` to emit
   * the Mentions section programmatically. Old `mentions_in_source`
   * remains the legacy fallback for LLM extractions that haven't yet
   * been upgraded to return the structured form.
   */
  mentions_with_provenance?: MentionWithProvenance[];
  related_entities?: string[];
  related_concepts?: string[];
  /** domain axis stage 3 (#568) — see {@link CandidateCoverage}. */
  coverage?: CandidateCoverage;
  /** domain axis stage 3 (#568): the subset of the source note's domain tags this item carries. */
  domains?: string[];
}

export interface ConceptInfo {
  name: string;
  type: 'theory' | 'method' | 'field' | 'phenomenon' | 'standard' | 'term' | 'other';
  aliases?: string[];  // Pre-generated aliases from extraction (seeds for page generation)
  summary: string;
  mentions_in_source: string[];
  /** Issue #244 — see EntityInfo. */
  mentions_with_provenance?: MentionWithProvenance[];
  related_concepts: string[];
  related_entities?: string[];
  /** domain axis stage 3 (#568) — see {@link CandidateCoverage}. */
  coverage?: CandidateCoverage;
  /** domain axis stage 3 (#568): the subset of the source note's domain tags this item carries. */
  domains?: string[];
}

/**
 * domain axis stage 3 (#568): how the source treats an extracted
 * candidate — an observation the model reports per item in the extraction
 * call, not a judgement. `defined`: the source says what it is; `discussed`:
 * the source says something substantive about it (properties, effects,
 * relations); `named`: only an example, list member or passing mention. The
 * threshold that turns this into "page or no page" lives in code
 * (`core/candidate-gate.ts`), never in the prompt. A missing value is not a
 * signal: the candidate is kept.
 */
export type CandidateCoverage = 'defined' | 'discussed' | 'named';

export interface ContradictionInfo {
  claim: string;
  source_page: string;
  contradicted_by: string;
  resolution: string;
}

export interface WikiPage {
  path: string;
  title: string;
  content: string;
  frontmatter: {
    type: 'entity' | 'concept' | 'source' | 'comparison' | 'overview';
    created: string;
    sources: string[];
    tags: string[];
  };
}

// LLM Provider configuration

export interface ProviderConfig {
  id: string;
  name: string; // Deprecated: use nameEn/nameZh instead
  nameEn: string; // English provider name
  nameZh: string; // Chinese provider name
  baseUrl: string;
  apiKeyPlaceholder: string;
  apiKeyPlaceholderEn?: string; // English placeholder
  apiKeyPlaceholderZh?: string; // Chinese placeholder
  requiresBaseUrl: boolean;
  authMode: 'api-key' | 'none' | 'codex-oauth';
  /**
   * v1.26.3 PATCH (Issue #443): whether the openai-compat SDK client
   * should create the compat provider with
   * `supportsStructuredOutputs: true`. When true AND a caller supplies
   * a `schema` on `response_format`, the AI SDK encodes
   * `response_format: { type: 'json_schema', json_schema: { ... } }`
   * on the wire. Local servers (LM Studio / Ollama / self-hosted
   * `custom`) accept this form; cloud compat servers
   * (openrouter / deepseek / kimi / glm) accept `json_object` and
   * should NOT receive `json_schema` (they may 400 on it). The
   * openai / anthropic / codex paths go through their own SDK
   * clients and are unaffected by this flag.
   */
  supportsStructuredOutputs?: boolean;
}

// Plugin settings

export type ExtractionGranularity = 'fine' | 'standard' | 'coarse' | 'minimal' | 'custom';

export interface OpenAICodexModelCatalogEntry {
  slug: string;
  displayName: string;
  supportedReasoningLevels: string[];
  additionalSpeedTiers: string[];
  serviceTiers: Array<{ id: string; name: string; description: string }>;
  defaultServiceTier?: string;
}

export interface LLMWikiSettings {
  provider: string;
  apiKey: string;
  openAICodexSecretId: string;
  /**
   * v1.25.3 #182: stable ID for the provider API key in Obsidian
   * SecretStorage (OS keychain). Mirrors `openAICodexSecretId`.
   * All API-key-using providers share one slot (only the active
   * provider's key needs to persist between restarts).
   */
  providerApiKeySecretId: string;
  openAICodexModels?: OpenAICodexModelCatalogEntry[];
  openAICodexModelsFetchedAt?: number;
  openAICodexUnavailableModels?: string[];
  baseUrl: string;
  model: string;
  /** Markdown conversion backend. Native keeps the existing provider flow
   *  (PDF + images via the provider's native support); MinerU accepts PDF,
   *  images, and Office documents via its online API. Renamed from
   *  `pdfConversionBackend` in v1.27.0 MINOR to reflect the broader scope
   *  (Anthropic Vision + OpenAI Vision support images natively). */
  markdownConversionBackend?: 'native' | 'mineru';
  wikiFolder: string;
  /** UI language — the locale the settings panel and modals render in. Keyed
   *  off the TEXTS barrel (11 locales) so adding a locale updates this type. */
  language: keyof typeof TEXTS;
  wikiLanguage: string;
  /**
   * v1.24.1 PATCH Stage 1 — AWS region used by both Bedrock providers. Only
   * applied when provider is `bedrock-anthropic` or `bedrock-openai`. Falls
   * back to `us-east-1` (broadest model coverage) when unset. Always a
   * region string (e.g. "us-east-1"), not a URL component.
   */
  bedrockRegion?: string;
  /**
   * #425 Bedrock Stage 2 — auth mode for the two `bedrock-*` providers.
   * Default `'api-key'` preserves Stage-1 bearer behavior byte-for-byte;
   * `'sso'` signs with IAM Identity Center temporary credentials,
   * `'iam'` with user-entered static keys. Secrets live ONLY in
   * SecretStorage (`karpathywiki-bedrock-sso` / `-iam`) — never here.
   */
  bedrockAuthMethod?: 'api-key' | 'sso' | 'iam';
  /** #425 — organization portal URL that starts the SSO device flow. */
  bedrockSsoStartUrl?: string;
  /** #425 — target account id for GetRoleCredentials in SSO mode. */
  bedrockSsoAccountId?: string;
  /** #425 — role name to assume for GetRoleCredentials in SSO mode. */
  bedrockSsoRoleName?: string;
  useCustomWikiLanguage?: boolean;
  availableModels?: string[];
  useCustomModel?: boolean;
  maxConversationHistory: number;
  queryHistory?: QueryHistoryMessage[];

  // Schema
  enableSchema: boolean;

  // Issue #85: tag vocabulary mode (Issue #85 — user-configurable tag vocabulary)
  tagVocabularyMode: 'default' | 'custom';
  customEntityTags: string;
  customConceptTags: string;

  // Extraction
  extractionGranularity: ExtractionGranularity;
  customEntityLimit?: number;
  customConceptLimit?: number;

  // Auto-maintenance
  autoWatchSources: boolean;
  autoWatchMode: 'notify' | 'auto';
  autoWatchDebounceMs: number;
  watchedFolders: string[];
  periodicLint: 'off' | 'daily' | 'weekly' | 'monthly';
  startupCheck: boolean;
  /**
   * v1.23.0: controls whether the QuickFixes startup-check Notice is
   * shown to the user. 'visible' (default) shows the result summary;
   * 'silent' only logs to console + Operation History Panel. The
   * QuickFixes pipeline itself always runs (the `startupCheck: true`
   * semantic is now permanent).
   *
   * Old users with `startupCheck: false` on disk are auto-migrated to
   * 'silent' by `applySettingsMigrations` (v1.23.0-startup-notice).
   */
  startupCheckNoticeLevel: 'visible' | 'silent';
  autoSmartFix: boolean;
  autoIngestNotificationLevel: 'modal' | 'notice';

  /**
   * v1.26.0 (#382 item 2): whether the Advanced Settings panel (bottom of
   * the Settings tab) reveals its advanced-user parameters. Currently that
   * is the 3 lint dedup thresholds (lintJaccardLinkThreshold /
   * lintJaccardBodyGate / lintBigramThreshold) + the first-run Welcome
   * note toggle; future advanced-user settings land here too.
   *
   * Independent of `advancedSettingsMode` in the Advanced section — that
   * gates LLM sampling parameters (temperature / penalty / thinking);
   * this gates generic non-LLM advanced knobs. Closing the toggle clears
   * the threshold overrides so a hidden setting never keeps a
   * no-UI-affordance value.
   */
  showAdvancedSettings?: boolean;

  // v1.23.0: Phase 5.1.5 — first-run Welcome note. When enabled (default),
  // the plugin detects tier on every onload (no vault state change =
  // short-circuit) and creates <wikiFolder>/Welcome.md on Tier B transitions.
  // Tier A users get a Notice only; Tier C users are silent. Setting is
  // respected at all times — disabling stops both create-on-onload and the
  // "Recreate Wiki Welcome Note" command.
  createWelcomeNote: boolean;

  // Ingestion acceleration
  pageGenerationConcurrency: number;
  batchDelayMs: number;

  // Migration markers — written by `core/settings-migrations.ts` so each
  // version-keyed migration runs at most once. Keep these `boolean` and
  // underscore-prefixed so they don't show up in the settings UI.
  // (#199) The v1.18.3 startupCheck nudge was removed entirely; if a
  // future migration re-nudges a value, gate it on one of these.
  _migrated_v1_20_0_thinking?: boolean;
  // v1.23.0: pins the startupCheck=true invariant and routes
  // previously-explicit startupCheck=false users to startupCheckNoticeLevel='silent'.
  _migrated_v1_23_0_startup_notice?: boolean;
  // v1.25.3 #182: one-time migration that moves legacy plaintext
  // `apiKey` from data.json into Obsidian SecretStorage, then clears
  // the plaintext field. Idempotent — set true after the migration
  // runs so the second load is a no-op.
  _migrated_v1_25_3_secret_storage?: boolean;
  // v1.27.0 MINOR #404 follow-up: rename `pdfConversionBackend` →
  // `markdownConversionBackend`. Migration preserves the existing value so
  // users who already selected MinerU do not silently fall back to native.
  _migrated_v1_27_0_markdown_conversion_backend?: boolean;

  // Query dedup
  lastOfferedQueryHash?: string;

  // LLM readiness — must pass Test Connection before core features are available
  llmReady: boolean;

  // Thinking control probe cache (key = baseUrl). Populated at Test Connection time.
  //
  // #137: schema widened to a dialect string so we can pick the right
  // thinking-control field per provider. Old v1.19.0 boolean values are
  // migrated on read in main.ts (true → 'anthropic', false → 'none') so
  // existing data.json files continue to work.
  //
  //   'anthropic' → backend accepts thinking.type='disabled'
  //                 (OpenAI, DeepSeek, xAI Grok, OpenRouter, ...)
  //   'openai'    → backend accepts reasoning_effort='none' but not thinking
  //                 (Gemini OpenAI-compat endpoint)
  //   'none'      → backend rejects both; skip thinking control entirely
  thinkingControlCache?: Record<string, 'anthropic' | 'openai' | 'none' | boolean>;

  // v1.23.0: thinkingControlCache is now @deprecated. AI-SDK v6 handles
  // thinking-control internally per provider/model — no plugin-side
  // caching needed. The field is retained for forward-compat: existing
  // data.json files keep the field without error, and the value is
  // simply ignored. Will be removed in v1.24.0 unless a use case
  // surfaces (e.g. introspecting the cache for diagnostics).
  // See src/main.ts:1011 for the surviving comment.
  //

  // v1.20.0: when true, the plugin explicitly sends a thinking-control
  // directive to the provider (with 3-tier dialect fallback). When false
  // (default), the plugin does NOT send any thinking-control field — the
  // provider decides whether to emit reasoning, and any reasoning that
  // does leak into the response is folded into a collapsible block in the
  // Query Wiki modal so it never visually intrudes on the answer.
  //
  // Setting name kept for data.json backward compatibility with v1.18.2+
  // (where it was opt-out). The semantic is now opt-in: the user must
  // explicitly enable "Disable thinking" in Custom Advanced Settings.
  disableThinking?: boolean;

  // Issue #481: per-step output mode and thinking. Unset — the default, and
  // what every existing data.json has — resolves to the built-in baseline in
  // src/core/task-policy.ts (Issue #524: `extract` / `extract-retry` in text
  // mode, every other step as before). Exposed in the LLM Advanced section
  // since #524, because the measurement it was built for has picked out one
  // step — and a baseline nobody can move is not a baseline.
  taskPolicies?: TaskPolicyMap;

  // Advanced settings mode — 'default' hides the toggles/inputs; 'custom'
  // reveals them. In v1.20.0, 'default' no longer forces anything — the
  // plugin simply omits all custom fields, letting the provider's defaults
  // apply. 'custom' exposes the explicit opt-in controls.
  advancedSettingsMode?: 'default' | 'custom';

  /**
   * v1.25.0 PR3: opt-in escape hatch for OpenAI-compatible and
   * Anthropic-compatible providers that can accept PDF input even though
   * they are not in the native-PDF provider list. Default false.
   */
  forcePdfSupport?: boolean;

  /**
   * v1.25.0 PR3: when true, write the LLM-converted Markdown of each PDF
   * to a `<basename>.pdf.md` sidecar next to the source PDF. Default false
   * (cache-only architecture; the cache in `.obsidian/` is the only artifact).
   */
  writePdfMarkdownToVault?: boolean;

  /** Opt-in local-image analysis for Markdown source embeds. */
  analyzeEmbeddedImages?: boolean;

  // Issue #128: per-task sampling temperature. Leave undefined to use the
  // provider's default. Low values (e.g. 0.15) improve fidelity for extraction
  // and verbatim quotes; higher values (e.g. 0.7) make chat answers more fluid.
  extractionTemperature?: number;

  /**
   * Nucleus sampling for extraction. Its partner, not an independent knob: a
   * provider preset sets the two together, so overriding only the temperature
   * leaves a run on half of one preset and half of another.
   */
  extractionTopP?: number;

  /**
   * Fixed sampling seed. Unset leaves the provider free to pick one per
   * request, so ingesting the same source twice gives two different wikis —
   * normal behaviour, but it also means no comparison between two versions of
   * the extraction loop can separate a change from the sampler.
   *
   * What it buys depends on the provider. Some local servers honour it, not
   * all: on LM Studio with `google/gemma-4-12b` (MLX, 4bit) the field is
   * accepted, type-validated and then ignored — five requests with `seed: 42`
   * at `temperature: 1.0` returned five distinct outputs, and only
   * `temperature: 0` produced a single one (#423). Nothing in that exchange
   * tells the caller the run is not reproducible.
   *
   * The `openai` provider drops it: that path builds the Responses model, which
   * reports `seed` unsupported and leaves it out of the body — the best-effort
   * seed OpenAI documents belongs to Chat Completions, which this path does
   * not use. Anthropic has no such parameter at all, and the Codex adapter
   * omits it deliberately. So this reaches local servers and other
   * OpenAI-compatible endpoints, and nothing else.
   */
  samplingSeed?: number;
  chatTemperature?: number;

  // Issue #128 follow-up: repetition penalty. Leave undefined to omit the field.
  // Some local models (llama.cpp-based) benefit from a small penalty (e.g. 1.1)
  // to avoid repetition loops at low temperatures.
  repetitionPenalty?: number;

  /**
   * v1.26.0 (#382 item 2): Jaccard threshold for the shared-outgoing-
   * wiki-links signal in lint duplicate-detection (0..1). Leave undefined
   * to use the `LINT_DEDUP_JACCARD_LINK_THRESHOLD` constant in
   * src/constants.ts. Lower = more link-overlap candidates flagged;
   * raise to reduce false positives in hub-heavy vaults.
   */
  lintJaccardLinkThreshold?: number;

  /**
   * v1.26.0 (#382 item 2): body-similarity floor (0..1) below which two
   * pages with shared wiki-links are still NOT flagged as duplicates.
   * Leave undefined to use `LINT_DEDUP_JACCARD_BODY_GATE`. Raise if you
   * see false positives where two unrelated pages happen to link to the
   * same hub.
   */
  lintJaccardBodyGate?: number;

  /**
   * v1.26.0 (#382 item 2): character-bigram Jaccard threshold for
   * title/alias similarity in lint duplicate-detection (0..1). Leave
   * undefined to use `LINT_DEDUP_BIGRAM_THRESHOLD`. Lower = catch more
   * spelling variants; raise to require near-identical titles.
   */
  lintBigramThreshold?: number;

  /**
   * v1.26.0 (#382 item 1, Batch 2): include `sources/` pages in lint
   * duplicate-detection. Default `true` (sources participate in dedup
   * via the sourceFingerprint signal, which requires body-hash equality
   * to upgrade a pair to tier-1). Set to `false` to opt out if your
   * source corpus generates false positives.
   *
   * Cross-type comparison (source↔entity / source↔concept) is
   * explicitly NOT enabled by this flag — sources are episodic memory
   * per #358 complementary memory model and cross-type would produce
   * false positives.
   */
  lintDedupIncludeSources?: boolean;

  /**
   * Issue #514: when on, an extracted entity or concept whose name the note
   * does not carry in running text — absent, or present only inside
   * parentheses, enumerations or short list items — gets no page and no
   * further model call, and its name is pruned from the other candidates'
   * related_* lists. Decided by `core/candidate-gate.ts` from the text alone,
   * keyed on `wikiLanguage` (the language the page names are written in);
   * for a wiki language without a profile the gate reports once per ingest
   * that it cannot apply. Off by default: it changes which pages an ingest
   * writes, so it is the user's choice, not an upgrade's.
   */
  skipMentionOnlyCandidates?: boolean;

  /**
   * S135 outcome table: when the candidate gate is on, a candidate the two
   * gate halves disagree on (prose+named / aside+covered) becomes a stub
   * page built from the extraction's own summary — no LLM call — instead of
   * being dropped. Off by default: more pages is a behaviour change. Takes
   * effect only with `skipMentionOnlyCandidates` on, because the table needs
   * the position verdict that setting opts into; the full-page set is
   * unchanged either way (the table is a pure extension of the two serial
   * gates, measured over 1,153 items across three runs).
   */
  gateDissentStubs?: boolean;

  /**
   * Issue #485: whether Fix Dead Links writes an empty placeholder page when
   * a link resolves to nothing (both branches — the model's create_stub
   * answer and the deterministic fallback). On by default: that is the
   * outcome every existing vault already gets, and #197's gate still
   * guarantees such a stub is never LLM-expanded. When off, the link is
   * left as it is and keeps surfacing in every lint report; a later ingest
   * of a defining source creates the real page through normal channels and
   * never needed the stub to exist.
   */
  createStubsForUnresolvableLinks?: boolean;

  // Issue #75: cap max_tokens per LLM call. 0 = no cap.
  // Recommended for local models with small context windows.
  maxTokensPerCall: number;

  // Issue #111: slug casing for generated filenames.
  // 'lower' preserves backwards-compatible all-lowercase filenames.
  // 'preserve' keeps the casing the LLM produces — required for languages
  // where lowercase is grammatically wrong (e.g. German nouns).
  // Note: switching affects new files only — existing lowercase files keep their names.
  slugCase: 'lower' | 'preserve';

  /**
   * Minimum length (chars, after trim) of an alias the plugin writes to a
   * wiki page. Undefined → MIN_ALIAS_LENGTH (2), i.e. the v1.25.10 floor;
   * a vault that collects two-letter aliases differing only in case can
   * raise it. Accepted range MIN_ALIAS_LENGTH_MIN..MIN_ALIAS_LENGTH_MAX.
   */
  minAliasLength?: number;

  /**
   * v1.24.0 #251: persistent user-supplied instructions appended to the
   * Query Wiki system prompt. Empty string or undefined = feature off
   * (backward compatible). Scoped strictly to Query Wiki chat; no other
   * workflow (ingest / lint / page generation / Save to Wiki / seed
   * selection / duplicate merge) is affected. Stored in data.json
   * alongside `queryHistory`.
   */
  customQueryInstructions?: string;

  /**
   * v1.24.0 #208: per-task model overrides. Each field is the MODEL
   * string ONLY (same shape as `model`). Provider / apiKey / baseUrl /
   * thinking-control stay shared — per-provider split would 4× the
   * credentials UI and break Test Connection's contract.
   *
   * Resolution: `perTaskModel?.trim() || settings.model` — see
   * `src/core/model-resolver.ts`. Empty / whitespace / undefined all
   * fall through to `settings.model`, so pre-v1.24.0 data.json
   * (no per-task fields) produces bit-identical behavior.
   *
   * - `ingestModel`: ingest extract / summarize / create / merge
   *   (source-analyzer, page-factory Stage-1..4, conversation-ingest,
   *    schema-manager, schema/auto-maintain, localize-welcome-note).
   * - `lintModel`:   lint analysis / dedup / fix-* / link-orphan /
   *   merge-duplicates / contradictions (all `src/wiki/lint/` + `contradictions.ts`).
   * - `queryModel`:  Query Wiki chat (3 QueryView send sites) + save-to-wiki eval.
   *
   * UI invariant: `usePerTaskModels` toggles whether the settings
   * panel renders the per-task pickers. Hidden per-task values are
   * preserved when the user toggles back off (not cleared on save).
   */
  ingestModel?: string;
  lintModel?: string;
  queryModel?: string;

  /**
   * v1.24.0 #208: UI toggle for the per-task model picker.
   * `false` = unified model (all 27 LLM call sites use `settings.model`).
   * `true`  = per-task overrides active (3 dropdowns render).
   * Defaults `false`. Setting does NOT affect `resolveModelForTask` —
   * it is purely a UI rendering hint, since empty/undefined per-task
   * values fall through to `settings.model` regardless of this flag.
   */
  usePerTaskModels?: boolean;

  /**
   * v1.24.0 #208: per-field "use custom model" toggles, parallel to
   * `useCustomModel`. Only consumed by the UI when an `availableModels`
   * list has been fetched — when set, the picker renders as a free-form
   * text input instead of a dropdown, so the user can paste a model ID
   * not in the fetched list. These flags are ephemeral UI state and
   * `false` is the user-facing default ("show me the dropdown").
   */
  ingestModelUseCustom?: boolean;
  lintModelUseCustom?: boolean;
  queryModelUseCustom?: boolean;
}

export interface QueryHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /**
   * v1.24.0: Retrieval metadata persisted per assistant turn so the
   * label survives Obsidian restart. Optional — pre-v1.24.0 history
   * is loaded without it, and the retrieval label simply won't render
   * (no crash).
   */
  retrieval?: {
    arm: string;
    count: number;
    topPaths: string[];
  };
}

// Schema types

export interface WikiSchema {
  version: number;
  updated: string;
  auto_suggestion_count: number;
  body: string;
}

export interface SchemaSuggestion {
  timestamp: string;
  source: string;
  changes_needed: boolean;
  suggestions: string;
  /** v1.22.0 #97: full proposed new body (frontmatter-free, ready to
   *  splice). Undefined when the LLM only provided markdown suggestions
   *  (legacy v1.21.x format) or when changes_needed is false. */
  newSchemaBody?: string;
}

// Ingestion report passed to onDone callback

// Result of page creation/update
export interface PageCreationResult {
  path: string | null;
  /**
   * Issue #290 — whether this write created the page or merged into one that
   * already existed. Decided by the pre-write existence check the router
   * already performs to choose between the create and merge paths, so it
   * reports what actually happened rather than what the caller intended.
   * The ingest log splits "Created pages" from "Updated pages" on it; merges
   * are the half of an ingest where existing content can be lost, so they must
   * not be reported as creations.
   */
  created: boolean;
}

export interface IngestReport {
  sourceFile: string;
  createdPages: string[];
  updatedPages: string[];
  entitiesCreated: number;
  conceptsCreated: number;
  failedItems: Array<{ type: 'entity' | 'concept'; name: string; reason: string }>;
  contradictionsFound: number;
  success: boolean;
  errorMessage?: string;
  /**
   * v1.22.6 #204: Distinguishes watch-mode auto-ingest from manual ingest
   * so the completion callback can route to the right UI surface
   * (Notice for auto, Modal for manual). Optional for backward
   * compatibility — missing/legacy callers default to 'manual'.
   */
  trigger?: 'auto' | 'manual';
  elapsedSeconds?: number;
  skippedFiles?: number;
  totalFilesInFolder?: number;
  cancelled?: boolean;
  /** True when the file was skipped by the pre-ingest requirements gate (#164). */
  skipped?: boolean;
  /** Files rejected by the requirements gate, with the reason for each. */
  rejectedFiles?: Array<{ path: string; reason: RejectionReason; detail?: string }>;
}

/** Cross-file dedup state shared across a folder/batch ingest run (#164). */
export interface BatchRequirementsContext {
  /** Content hashes of files already ingested earlier in this batch. */
  seen: Set<string>;
  /** Content hashes already present in the wiki (snapshot at batch start). */
  ingested: Set<string>;
}

/** Options for WikiEngine.ingestSource (all optional, backward-compatible). */
export interface IngestOptions {
  /** Shared dedup context for folder/batch ingest. */
  batchCtx?: BatchRequirementsContext;
  /** Interactive (explicit single-file) ingest — prompt the user on a duplicate. */
  interactive?: boolean;
  /** Bypass the uniqueness check (the user confirmed re-ingest). */
  forceReingest?: boolean;
  /**
   * v1.22.6 #204: Distinguishes watch-mode auto-ingest from manual ingest.
   * Propagated into IngestReport.trigger so the completion callback can
   * route to the correct UI surface (Notice for auto, Modal for manual).
   * Optional — missing/legacy callers default to 'manual'.
   */
  trigger?: 'auto' | 'manual';
  /**
   * v1.25.0 PR2 redo: pre-converted source body (e.g. LLM-converted PDF
   * markdown). When set, skips `vault.read(file)` and feeds this string
   * into the analyzer and summary-page generator. Path-based operations
   * (slug, frontmatter inheritance) still use `file`.
   */
  contentOverride?: string;
}

// LLM Client interface

/**
 * A content part within a chat message. Extends the legacy `string` content
 * type with multi-modal support (file / image). String content is still
 * supported for backward compatibility — see `messages[].content: string | MessageContentPart[]`.
 *
 * v1.25.0 PDF Level 1: `type: 'file'` with `mediaType: 'application/pdf'`
 * is the wire format for PDF ingestion. The AI SDK v6 transparently maps
 * this to provider-native PDF blocks (Anthropic `document`, OpenAI `input_file`).
 */
export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; data: string; mediaType: 'application/pdf'; filename?: string }
  | ImageContentPart;

/** A local image encoded as base64 for the AI SDK's multimodal input. */
export type ImageContentPart = {
  type: 'image';
  image: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/bmp';
};

/** User messages may carry images; assistant messages retain text/file compatibility. */
export type LLMMessage =
  | { role: 'user'; content: string | MessageContentPart[] }
  | { role: 'assistant'; content: string | Exclude<MessageContentPart, ImageContentPart>[] };

/**
 * Why the provider stopped generating. Mirrors the AI SDK v6 `FinishReason`
 * union, which normalizes the OpenAI `finish_reason` field and the Anthropic
 * `stop_reason` field into one vocabulary.
 *
 * Issue #305: `'length'` is the only reliable truncation signal. An
 * OpenAI-compatible provider does not throw on truncation — it returns HTTP
 * 200 with a body that stops mid-token — so callers that only observe the
 * response text cannot tell a truncated answer from a complete one.
 */
export type LLMFinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other'
  | 'unknown';

/** Token usage for a single LLM call (AI-SDK v6 shape). Any field may be
 *  undefined when a provider omits usage from its response. */
export interface LLMUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  /**
   * Reasoning tokens counted inside `outputTokens`. Normalized by
   * `normalizeUsage` from the SDK's `outputTokenDetails.reasoningTokens`
   * (its deprecated top-level `reasoningTokens` is the fallback), which in
   * turn comes from `usage.completion_tokens_details.reasoning_tokens` on
   * the wire.
   *
   * Undefined means "the provider said nothing", which is not the same as
   * zero: a provider that omits the field and a model that did not think
   * are indistinguishable from the response alone, and only the second is
   * a statement about the model.
   */
  reasoningTokens?: number;
}

/** Metadata surfaced by SDK-backed clients via `onFinish` (Issue #305 +
 *  token usage). Additive: callers that ignore it are unaffected. */
export interface LLMFinishMeta {
  finishReason: LLMFinishReason;
  usage?: LLMUsage;
}

export interface LLMClient {
  createMessage(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: LLMMessage[];
    response_format?:
      | { type: 'json_object' }
      // v1.26.3 PATCH pilot (Issue #443): a schema can now travel with
      // the response_format request. When the openai-compat SDK client
      // is created with `supportsStructuredOutputs: true` (currently
      // LM Studio / Ollama / `provider: custom`) AND a schema is
      // supplied, the AI SDK's `responseFormat: { type: 'json', schema }`
      // path is used, which the compat provider encodes as
      // `response_format: { type: 'json_schema', json_schema: { ... } }`
      // on the wire. Without a schema, the SDK falls back to
      // `json_object` (unchanged behaviour for the existing 15 call sites
      // that have not yet opted in).
      | { type: 'json_object'; schema?: Record<string, unknown> };
    /**
     * Anthropic prompt-cache breakpoint offset. Anthropic SDK honors this;
     * OpenAI / openai-compat / OpenAI Codex clients ignore the field (AI SDK
     * does not expose cache hooks for those providers). See Issue #449 + Issue #468.
     */
    cacheBreakpoint?: number;
    /**
     * Which step of the pipeline is asking. Purely for accounting: an ingest is
     * ten different call sites with different shapes — some write prose and are
     * decode-bound, some answer in a dozen tokens over a long prompt — and a
     * single total cannot tell them apart, so it cannot say where the time went.
     * Clients ignore it; the CLI groups its usage report by it.
     */
    task?: string;
    /**
     * Pin the wire output mode for this one call, bypassing the
     * OutputModeProber's cached choice. Set by the client wrapper from the
     * per-task policy (`src/core/task-policy.ts`); no call site passes it.
     *
     * Why it exists: `text_prompt` is the only mode that puts no
     * `response_format` on the request, and per #481 that is the only way a
     * schema-carrying step can think at all. A 400-driven demotion cannot
     * serve here — it is a repair, and it never fires on a backend that
     * accepts the schema.
     */
    outputModeOverride?: OutputMode;
    maxTokensPerCall?: number;  // Issue #75: cap for truncation retry
    enableThinking?: boolean;   // ROADMAP P3 #12: allow thinking for thinking-capable models
    /**
     * Bound the thinking rather than only permitting it. Sent as
     * `reasoning_effort` at the named level — the same wire key the
     * force-disable path uses with `'none'`. Set by the wrapper from the
     * per-task policy; no call site passes it.
     */
    reasoningEffort?: 'low' | 'medium' | 'high';
    temperature?: number;       // Issue #128: per-request sampling temperature
    /**
     * Nucleus sampling. Travels with `temperature` because a preset is a pair:
     * sending one and leaving the other to the server compares two halves of
     * two different presets, which is not a comparison of anything.
     */
    top_p?: number;
    /**
     * Fixed sampling seed. Unset — the default — leaves the provider free to
     * pick a fresh one per request, which is normal generation behaviour but
     * means no comparison between two versions of a prompt can tell a change
     * from the sampler.
     */
    seed?: number;
    repetition_penalty?: number; // Issue #128 follow-up: llama.cpp extension
    chat_template_kwargs?: Record<string, unknown>; // Issue #99: template-based reasoning disable
    // v1.25.0 PR3 follow-up #8 (Bug D, e2e 2026-07-17): cancellation
    // signal for long-running calls. The PDF converter threads the
    // engine's AbortSignal through so a status-bar click during PDF
    // conversion actually aborts the LLM call rather than only
    // finishing the post-conversion phase. AI SDK v6 accepts this
    // natively; legacy clients ignore it.
    abortSignal?: AbortSignal;
    // Issue #305: optional out-channel for response metadata. The SDK-backed
    // clients invoke this once, immediately before returning the text. It is
    // additive on purpose — `createMessage` keeps returning `Promise<string>`,
    // so every existing caller and every mock client is unaffected. Callers
    // that need to distinguish "the model finished" from "the model ran out
    // of tokens" opt in; callers that do not, see no change.
    onFinish?: (meta: LLMFinishMeta) => void;
  }): Promise<string>;

  // v1.26.3 PATCH Phase B (Issue #443): typed-output variant. Opt-in
  // for callers that want the AI SDK's `Output.object({schema})`
  // parsed-object result (Tier 0 success) instead of the raw text.
  // Returns the same `text` for backward compatibility, plus an
  // `output` field that's populated when `Output.object` parsed
  // successfully (Tier 0 on supported backends).
  //
  // OPTIONAL — clients that don't implement it fall back to
  // `createMessage` + caller-side `parseJsonResponse`. Anthropic /
  // OpenAI / Codex clients do not implement this method yet (their
  // 3 callers — `seed-selector` etc. — currently use no schema; the
  // 6 P0 Phase B migrations only touch openai-compat callers).
  //
  // When `outputMode === 'text_prompt'` or `json_object`, `output`
  // is undefined (no SDK parse happened — the model emitted free-form
  // text) and the caller is expected to run `parseJsonResponse(text)`
  // to recover the structured object. This matches the existing
  // 16-callers contract (Tier 1 path).
  createMessageWithOutput?<T = unknown>(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: LLMMessage[];
    // v1.26.3 PATCH Phase B: `schema` accepts either a raw JSON Schema
    // (legacy callers) or a Zod schema (Phase B migrations — the Zod
    // schema is the single source of truth for both the Tier 0 wire
    // shape and the Tier 1/2 fallback parseJsonResponse validation).
    response_format?: { type: 'json_object'; schema?: Record<string, unknown> | z.ZodType };
    task?: string;
    /** See `createMessage`. Set by the wrapper from the per-task policy. */
    outputModeOverride?: OutputMode;
    enableThinking?: boolean;
    /** See `createMessage`. */
    reasoningEffort?: 'low' | 'medium' | 'high';
    temperature?: number;
    top_p?: number;
    seed?: number;
    repetition_penalty?: number;
    onFinish?: (meta: LLMFinishMeta) => void;
  }): Promise<{
    text: string;
    output?: T;
    outputMode: 'json_schema' | 'json_object' | 'text_prompt';
    finishReason: LLMFinishReason;
    usage?: LLMUsage;
  }>;

  createMessageStream?(params: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: LLMMessage[];
    onChunk: (chunk: string) => void;
    enableThinking?: boolean;
    temperature?: number;
    top_p?: number;
    seed?: number;
    repetition_penalty?: number;
    /** Step label for per-task LLM accounting (Issue #469) — same contract as createMessage. */
    task?: string;
    /** Issue: streamed answers were truncated silently — surface finish_reason. */
    onFinish?: (meta: LLMFinishMeta) => void;
  }): Promise<string>;

  listModels?(): Promise<string[]>;
}

// Wiki output language options

export const WIKI_LANGUAGES: Record<string, string> = {
  'en': 'English',
  'zh': '中文',
  'zh-Hant': '繁體中文',  // v1.22.0: Traditional Chinese
  'ja': '日本語',
  'ko': '한국어',
  'de': 'Deutsch',
  'fr': 'Français',
  'es': 'Español',
  'pt': 'Português',
  'it': 'Italiano',
  'ru': 'Русский',        // v1.26.0: Russian
};

// Valid frontmatter tag values per schema classification rules.
// `type: entity` pages use entity subtypes as tags.
// `type: concept` pages use concept subtypes as tags.
export const VALID_ENTITY_TAGS = ['person', 'organization', 'project', 'product', 'event', 'place', 'other'];
export const VALID_CONCEPT_TAGS = ['theory', 'method', 'field', 'phenomenon', 'standard', 'term', 'other'];
export const DEFAULT_ENTITY_TAG = 'other';
export const DEFAULT_CONCEPT_TAG = 'term';

// Issue #85 v7: source pages use a separate, static "form" vocabulary
// (describing the type of the source artifact — paper, document, etc.)
// rather than a topic. NOT user-configurable per Issue #85 design
// decision: source pages have a closed taxonomy that the user picks
// from, and the lint audit + retag runner validates against this list.
export const VALID_SOURCE_TAGS = [
  'paper', 'article', 'book', 'transcript', 'clippings',
  'notes', 'other',
] as const;
export const DEFAULT_SOURCE_TAG = 'other';

// EngineContext — shared dependencies injected into sub-modules.
// Functions (getClient, tryReadFile) return the latest state at call time,
// not a snapshot at construction time. This is intentional: the LLM client
// can change when the user updates settings without restarting the plugin.
//
// Core (required by all sub-modules):
//   getClient — runtime accessor for LLM client, reflects settings changes
//   getExistingWikiPages — reads frontmatter from all wiki/*.md files
//   createOrUpdateFile — single write gate with pollution defense
// Integration (consumed by auto-maintain and ingestion pipeline):
//   onFileWrite — notifies file watcher of writes for change detection
//   onProgress / onDone — ingestion progress → UI modal

export interface EngineContext {
  app: App;
  settings: LLMWikiSettings;
  getClient: () => LLMClient | null;
  createOrUpdateFile: (path: string, content: string) => Promise<void>;
  tryReadFile: (path: string) => Promise<string | null>;
  deleteFile: (path: string) => Promise<void>;
  buildSystemPrompt: (task: string) => Promise<string | undefined>;
  getSectionLabels: () => Record<string, string>;
  getExistingWikiPages: () => Promise<Array<{ path: string; title: string; wikiLink: string; aliases?: string[] }>>;
  getSchemaContext: (task: string) => Promise<string | undefined>;
  /**
   * SubtleCrypto from Obsidian's popout-window-aware `activeWindow.crypto`.
   * Used by the PDF cache to derive a content-addressed key without
   * accessing the bare `window` global (CLAUDE.md `obsidianmd/no-global-this`).
   * Undefined only in tests that don't stub SubtleCrypto.
   */
  subtle?: SubtleCrypto;
  onFileWrite?: (path: string) => void;
  /**
   * Fired for every contradiction the merge triage records against an
   * existing page (item-level `kind: 'contradictory'` and the page-level
   * `strategy: 'contradictory'`). The extraction lane's contradictions
   * live in `analysis.contradictions`; without this callback the triage
   * lane's records are invisible to the ingest log and the report count.
   */
  onContradiction?: (contradiction: ContradictionInfo) => void;
  onProgress?: (message: string) => void;
  onDone?: (report: IngestReport) => void;
}

// Predefined LLM provider configurations

export const PREDEFINED_PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    nameEn: 'OpenAI',
    nameZh: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPlaceholderEn: 'sk-...',
    apiKeyPlaceholderZh: 'sk-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  'openai-codex': {
    id: 'openai-codex',
    name: 'ChatGPT Plan (Codex OAuth)',
    nameEn: 'ChatGPT Plan (Codex OAuth)',
    nameZh: 'ChatGPT Plan (Codex OAuth)',
    baseUrl: '',
    apiKeyPlaceholder: '',
    apiKeyPlaceholderEn: '',
    apiKeyPlaceholderZh: '',
    requiresBaseUrl: false,
    authMode: 'codex-oauth'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    nameEn: 'Anthropic (Claude)',
    nameZh: 'Anthropic (Claude)',
    baseUrl: '',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyPlaceholderEn: 'sk-ant-...',
    apiKeyPlaceholderZh: 'sk-ant-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    nameEn: 'Google Gemini',
    nameZh: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKeyPlaceholder: 'AIza...',
    apiKeyPlaceholderEn: 'AIza...',
    apiKeyPlaceholderZh: 'AIza...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    nameEn: 'OpenRouter',
    nameZh: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyPlaceholder: 'sk-or-...',
    apiKeyPlaceholderEn: 'sk-or-...',
    apiKeyPlaceholderZh: 'sk-or-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    nameEn: 'DeepSeek',
    nameZh: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPlaceholderEn: 'sk-...',
    apiKeyPlaceholderZh: 'sk-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    nameEn: 'MiniMax',
    nameZh: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    apiKeyPlaceholder: 'sk-cp-...',
    apiKeyPlaceholderEn: 'sk-cp-...',
    apiKeyPlaceholderZh: 'sk-cp-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  kimi: {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    nameEn: 'Kimi (Moonshot)',
    nameZh: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiKeyPlaceholder: 'sk-...',
    apiKeyPlaceholderEn: 'sk-...',
    apiKeyPlaceholderZh: 'sk-...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  glm: {
    id: 'glm',
    name: 'GLM (Zhipu AI)',
    nameEn: 'GLM (Zhipu AI)',
    nameZh: 'GLM (智谱AI)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyPlaceholder: '...',
    apiKeyPlaceholderEn: '...',
    apiKeyPlaceholderZh: '...',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  // v1.24.1 PATCH Bedrock Stage 1 — reuses AnthropicSdkClient via the
  // bedrock-mantle endpoint (Bearer auth, no AWS SDK). baseUrl is filled
  // dynamically by createLLMClientFromSettings based on `bedrockRegion`.
  'bedrock-anthropic': {
    id: 'bedrock-anthropic',
    name: 'Amazon Bedrock (Anthropic via mantle)',
    nameEn: 'Amazon Bedrock (Anthropic via mantle)',
    nameZh: 'Amazon Bedrock（Anthropic via mantle）',
    baseUrl: '',  // Resolved at runtime from bedrockRegion (see constants.ts)
    apiKeyPlaceholder: 'ABSK... (Bedrock bearer key)',
    apiKeyPlaceholderEn: 'ABSK... (Bedrock bearer key)',
    apiKeyPlaceholderZh: 'ABSK...（Bedrock bearer key）',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  // v1.24.1 PATCH Bedrock Stage 1 — reuses OpenAICompatSdkClient via
  // bedrock-mantle /v1 chat-completions. Same bearer auth as Bedrock-
  // Anthropic; region is resolved at runtime from `bedrockRegion`.
  'bedrock-openai': {
    id: 'bedrock-openai',
    name: 'Amazon Bedrock (OpenAI via mantle)',
    nameEn: 'Amazon Bedrock (OpenAI via mantle)',
    nameZh: 'Amazon Bedrock（OpenAI via mantle）',
    baseUrl: '',  // Resolved at runtime from bedrockRegion
    apiKeyPlaceholder: 'ABSK... (Bedrock bearer key)',
    apiKeyPlaceholderEn: 'ABSK... (Bedrock bearer key)',
    apiKeyPlaceholderZh: 'ABSK...（Bedrock bearer key）',
    requiresBaseUrl: false,
    authMode: 'api-key'
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    nameEn: 'Ollama (Local)',
    nameZh: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    apiKeyPlaceholder: 'ollama (no Key required)',
    apiKeyPlaceholderEn: 'ollama (no Key required)',
    apiKeyPlaceholderZh: 'ollama (无需Key)',
    requiresBaseUrl: false,
    authMode: 'none',
    supportsStructuredOutputs: true
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    nameEn: 'LM Studio (Local)',
    nameZh: 'LM Studio（本地）',
    baseUrl: 'http://localhost:1234/v1',
    apiKeyPlaceholder: 'lmstudio',
    apiKeyPlaceholderEn: 'lmstudio (optional)',
    apiKeyPlaceholderZh: 'lmstudio（可选）',
    requiresBaseUrl: false,
    authMode: 'none',
    supportsStructuredOutputs: true
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    nameEn: 'Custom OpenAI-Compatible',
    nameZh: '自定义 OpenAI 兼容',
    baseUrl: '',
    apiKeyPlaceholder: 'API Key',
    apiKeyPlaceholderEn: 'API Key',
    apiKeyPlaceholderZh: 'API Key',
    requiresBaseUrl: true,
    authMode: 'api-key',
    supportsStructuredOutputs: true
  },
  'anthropic-compatible': {
    id: 'anthropic-compatible',
    name: 'Custom Anthropic-Compatible',
    nameEn: 'Custom Anthropic-Compatible',
    nameZh: '自定义 Anthropic 兼容',
    baseUrl: '',
    apiKeyPlaceholder: 'API Key',
    apiKeyPlaceholderEn: 'API Key',
    apiKeyPlaceholderZh: 'API Key',
    requiresBaseUrl: true,
    authMode: 'api-key'
  }
};

// Default plugin settings

export const DEFAULT_SETTINGS: LLMWikiSettings = {
  provider: 'anthropic',
  apiKey: '',
  openAICodexSecretId: 'karpathywiki-openai-codex',
  // v1.25.3 #182: stable secretId for the provider API key in
  // Obsidian SecretStorage. Plugin namespace + semantic role makes
  // the slot easy to find in the OS credential manager and avoids
  // collision with the Codex OAuth slot above.
  providerApiKeySecretId: 'karpathywiki-provider-api-key',
  openAICodexModels: [],
  openAICodexModelsFetchedAt: 0,
  baseUrl: '',
  model: '',  // No hardcoded default — user must fetch models or enter manually
  markdownConversionBackend: 'native',
  wikiFolder: 'wiki',
  language: 'en',
  wikiLanguage: 'en',
  useCustomWikiLanguage: false,
  availableModels: [],
  useCustomModel: false,
  maxConversationHistory: 30,
  queryHistory: [],

  // Schema
  enableSchema: true,

  // Issue #85: tag vocabulary
  tagVocabularyMode: 'default',
  customEntityTags: '',
  customConceptTags: '',

  // Extraction
  extractionGranularity: 'standard',

  // Auto-maintenance
  autoWatchSources: false,
  autoWatchMode: 'notify',
  autoWatchDebounceMs: 5000,
  watchedFolders: [],
  periodicLint: 'off',
  startupCheck: true,  // Issue #81: default ON for low-level format fixes
  startupCheckNoticeLevel: 'visible',  // v1.23.0: show QuickFixes results Notice by default
  autoSmartFix: false,
  autoIngestNotificationLevel: 'notice',  // v1.22.2: default to Notice (no blocking Modal) for auto-ingest
  // v1.26.0 (#382 item 2): default OFF — the Advanced Settings panel
  // (bottom of the Settings tab) hides its advanced-user parameters until
  // the showAdvancedSettings toggle is on. Independent of advancedSettingsMode
  // (LLM sampling in the Advanced section).
  showAdvancedSettings: false,
  createWelcomeNote: true,  // v1.23.0: Phase 5.1.5 — Tier-B first-run Welcome note (D8: 1 EN template + LLM dynamic translation)

  // Ingestion acceleration (default: 3 parallel for most providers)
  pageGenerationConcurrency: 3,
  batchDelayMs: 500,

  // Query dedup
  lastOfferedQueryHash: '',

  // LLM readiness
  llmReady: false,

  // Issue #75: cap max_tokens per LLM call. 0 = no cap (cloud default).
  // Local model users can set this when the provider is Ollama, LM Studio,
  // custom, or anthropic-compatible.
  maxTokensPerCall: 0,

  // v1.20.0: default false. The plugin does NOT send any thinking-control
  // field unless the user explicitly enables "Disable thinking" in Custom
  // Advanced Settings. The provider decides its own reasoning behavior; any
  // reasoning that does appear in the response is folded into a collapsible
  // <details> block in the Query Wiki UI so it never visually intrudes on
  // the answer. Setting name kept for v1.18.2 data.json backward compat.
  disableThinking: false,
  // Advanced settings mode — default hides the toggles, custom reveals them.
  advancedSettingsMode: 'default',
  // v1.25.0 PR3: PDF force-support and sidecar write are opt-in advanced
  // toggles. Default false keeps the cache-only architecture as the only
  // artifact and prevents unsupported-compatible providers from attempting
  // PDF conversion.
  forcePdfSupport: false,
  writePdfMarkdownToVault: false,
  analyzeEmbeddedImages: false,
  // v1.26.0 (#382 item 2): dedup threshold overrides — undefined = use the
  // LINT_DEDUP_* constants in src/constants.ts. The UI renders them only
  // when showAdvancedSettings is on (Advanced Settings panel, bottom of the
  // Settings tab) and clears them when that toggle flips back off; at
  // consumption the dedup-phase reads them unconditionally (like
  // extractionTemperature/chatTemperature — the codebase does not gate
  // advanced fields at use sites). JSON.stringify drops undefined keys,
  // so first-install data.json does not contain these keys.
  lintJaccardLinkThreshold: undefined,
  lintJaccardBodyGate: undefined,
  lintBigramThreshold: undefined,
  // v1.26.0 (#382 item 1, Batch 2): sources participate in dedup by
  // default. Undefined = true at use site (DEFAULT_SETTINGS does not
  // own the default; the filter reads `settings.lintDedupIncludeSources
  // !== false` so a missing key is treated as on).
  lintDedupIncludeSources: undefined,
  // Issue #514: off by default — fewer pages is a behaviour change, opt in.
  skipMentionOnlyCandidates: false,
  // S135: off by default — stubs from gate dissent are a behaviour change, opt in.
  gateDissentStubs: false,
  // Issue #485: on by default — stub creation is the existing outcome;
  // turning it off is the user's choice. The use site also treats a
  // missing key as on (`!== false`), matching lintDedupIncludeSources.
  createStubsForUnresolvableLinks: true,
  // Issue #111: default to 'lower' for backwards compatibility.
  slugCase: 'lower',
  // v1.24.0 #251: persistent user-supplied instructions appended to the
  // Query Wiki system prompt. Empty string = feature off (backward
  // compatible). Stored in data.json alongside queryHistory. Scoped
  // strictly to Query Wiki chat; no other workflow is affected.
  customQueryInstructions: '',

  // v1.24.1 PATCH Bedrock Stage 1 — default region is the broadest-coverage
  // region (us-east-1). Only consulted when provider is one of the two
  // bedrock-* provider ids. Has no effect on other providers.
  bedrockRegion: 'us-east-1',
  // #425 Bedrock Stage 2 — default auth mode preserves the Stage-1
  // bearer wire shape for every existing user.
  bedrockAuthMethod: 'api-key',
  bedrockSsoStartUrl: '',
};
