/**
 * Plugin settings and their defaults.
 *
 * Split out of `types.ts` by #929. `DEFAULT_SETTINGS` travels with
 * `LLMWikiSettings`, because a setting and its default are one fact.
 */
import type { ExtractionGranularity } from '../constants';
import type { TaskPolicyMap } from '../core/task-policy';
import type { TEXTS } from '../texts';
import type { OpenAICodexModelCatalogEntry } from './llm';
import type { QueryHistoryMessage } from './query';

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
  /**
   * Issue #723: user-supplied request headers for the OpenAI-compatible path,
   * one `Name: value` per line. Blank lines and `#` comments are ignored; the
   * first `:` splits, so a value may itself contain `:`.
   *
   * Kept as the raw string rather than a parsed map so a half-typed line
   * survives a settings round-trip instead of being silently dropped.
   */
  customHeaders?: string;
  model: string;
  /** Markdown conversion backend. Native keeps the existing provider flow
   *  (PDF + images via the provider's native support); MinerU accepts PDF,
   *  images, and Office documents via its online API. Renamed from
   *  `pdfConversionBackend` in v1.27.0 MINOR to reflect the broader scope
   *  (Anthropic Vision + OpenAI Vision support images natively). */
  markdownConversionBackend?: 'native' | 'mineru';
  wikiFolder: string;
  /**
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
  /**
   * Issue #961 — epoch ms of the last completed periodic lint, so the period
   * clock survives a settings save and a reload. Absent or 0 means "never
   * run", which starts the clock when periodic lint is armed.
   *
   * Optional so a `data.json` written before this field existed still
   * type-checks; the read site falls back to "never run".
   */
  lastPeriodicLintAt?: number;
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
  /** Opt-in audit trail for the visual evidence produced during image analysis. */
  saveEmbeddedImageEvidence?: boolean;

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
   * #819 step 7. Run the old hand-tuned linear query scorer instead of BM25F.
   * A new ranking is on by default and must be switchable off; the two rank
   * differently (top-5 overlap measured 2.4 of 5) and until the harness carries
   * accuracy evidence a user who sees worse results needs a way back.
   */
  legacyScorer?: boolean;

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

  // Issue #75: cap max_tokens per LLM call. 0 = Auto.
  // Issue #904: Auto used to mean "no cap". It now means "the model's own
  // output ceiling", with 128,000 as the assumption when nothing is known
  // (DEFAULT_MODEL_OUTPUT_TOKENS). A cap still wins over the default, so a
  // local-model user who set 8192 keeps 8192.
  maxTokensPerCall: number;

  /**
   * Issue #880 — the ceiling on the answer context, in TOKENS.
   *
   * Before this, `RETRIEVAL_BUDGET` (20) bounded the number of PAGES and each
   * page carried its own character cap, so the total had no ceiling at all:
   * 20 x 12,800 characters is the worst case, and measured on the production
   * vault 27 of 30 answers exceeded an 8k window while the budget still read
   * "20 of 20". Pages are dropped from the tail until this ceiling is met.
   *
   * `0` disables the ceiling, which is what a user on a very large window may
   * want and what keeps every pre-#880 behaviour reachable.
   *
   * Optional so a settings object written before this field existed still
   * type-checks; the read site falls back to the default.
   */
  queryContextBudgetTokens?: number;

  // Issue #904: the model's context window, when the user knows it. 0 = Auto.
  // Bounds the output ceiling — a request cannot emit more tokens than the
  // window holds — so a 4K model never receives a 128K request. Unset in every
  // existing data.json, which reads as Auto.
  contextWindow?: number;

  // Issue #904: global thinking level, the child of `disableThinking`.
  // `default` sends nothing (pre-#904 behaviour). Named levels ride the
  // existing `reasoning_effort` path. There is deliberately no `off` here:
  // the toggle owns that, and two controls for one state is how they drift.
  thinkingEffort?: 'default' | 'low' | 'medium' | 'high';

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
  lastPeriodicLintAt: 0,
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

  // Issue #75: cap max_tokens per LLM call. 0 = Auto (Issue #904: the
  // model's own output ceiling, 128,000 when unknown).
  maxTokensPerCall: 0,

  // Issue #880: the answer context's ceiling in tokens. 8192 because that is
  // the common floor a local runtime will serve, and because a single default
  // needs one sentence in eleven locales rather than a rule the user has to
  // understand. Deliberately conservative: the estimator over-counts tokens, so
  // the cost of this number being low is a slightly shorter answer.
  queryContextBudgetTokens: 8192,

  // Issue #904: 0 = Auto. Stored explicitly so the dropdown has a value; an
  // absent field in older data.json reads the same way.
  contextWindow: 0,

  // Issue #904: default = send no reasoning field at all.
  thinkingEffort: 'default',

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
  saveEmbeddedImageEvidence: false,
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

// Parts split out by #929. Imported for local use and re-exported, so no
// caller's import changes.
