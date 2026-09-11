// output-schemas.ts
//
// v1.26.3 PATCH Phase B (Issue #443): Zod schemas for the 6 P0
// callers that opt into the typed-output path (`createMessageWithOutput`).
//
// These schemas define the canonical shape the LLM is expected to
// emit. The caller passes the schema to `response_format.schema` and
// the SDK encodes `{type: 'json_schema', json_schema: { schema, name, strict: true }}`
// on the wire (Tier 0, the strongest mode). On Tier 0 success,
// `result.output` is the parsed object; on Tier 1 / Tier 2 success,
// the caller falls back to `parseJsonResponse(result.text)`.
//
// Why Zod (vs raw JSONSchema or TypeScript-only types):
//   - Runtime validation: caller-side `result.output ?? parseJsonResponse(text)`
//     still parses the Tier 1 / Tier 2 path, where Zod gives the same
//     shape guarantee as Tier 0.
//   - Source of truth: schema lives in code, not in a prompt string.
//     Prompt drift between code and instruction text was a real
//     failure mode in v1.26.x (per dedup-phase batch lessons).
//   - Type inference: Zod's `z.infer<typeof Schema>` gives callers
//     the typed object without manual `as { ... }` casts.
//
// The 6 P0 schemas are intentionally minimal — they capture the
// post-`parseJsonResponse` shape the callers already use (after the
// `as { ... }` casts). Anything stricter would be a behavior change
// for callers that already gracefully handle `undefined` / missing
// fields. Per CLAUDE.md "no breaking changes" rule, these schemas
// MUST be permissive enough to accept what the existing prompts +
// parseJsonResponse flow already accepts.

import { z } from 'zod';

/**
 * seed-selector.ts — Selects which vault pages are the best seeds
 * for a query. Emits a flat array of vault-relative paths.
 *
 * Existing cast: `{ seeds?: string[] }`. The current code throws if
 * `seeds` is missing or not an array. The schema marks it required
 * for runtime validation; Tier 1/2 callers still get null guards.
 */
export const SeedSelectorSchema = z.object({
  seeds: z.array(z.string()),
});
export type SeedSelector = z.infer<typeof SeedSelectorSchema>;

/**
 * query-keywords.ts — Extracts query keywords for downstream search.
 * Emits a flat array of keyword strings.
 *
 * Existing cast: `{ keywords?: unknown }`. The current code
 * dedupes + filters non-strings, so the schema is permissive on
 * element type (every string survives; non-strings are silently
 * dropped by caller logic — no Zod-side coercion needed).
 */
export const QueryKeywordsSchema = z.object({
  keywords: z.array(z.string()),
});
export type QueryKeywords = z.infer<typeof QueryKeywordsSchema>;

/**
 * merge-triage.ts — Decides how two candidate pages should be
 * merged (insert / merge / reject). The current code requires
 * `strategy` to be one of MERGE_STRATEGIES (validated post-parse).
 * We mirror that contract in Zod.
 *
 * Items are optional (the merge may be a single-shot insert with no
 * items); `reason` is the LLM's free-text rationale.
 */
export const MergeTriageSchema = z.object({
  strategy: z.string(),
  items: z.array(z.object({
    kind: z.string().optional(),
    content: z.string().optional(),
    target_section: z.string().optional(),
    reason: z.string().optional(),
    // Contradiction gate 1: the page sentence a `contradictory` item
    // conflicts with, quoted verbatim; checked against the page downstream.
    existing_statement: z.string().optional(),
  })).optional(),
  reason: z.string().optional(),
});
export type MergeTriage = z.infer<typeof MergeTriageSchema>;

/**
 * contradiction-gates.ts — gate 2, the source-stance question: does the
 * source hold the claim itself (`yes`) or only report it (`no`)? `evidence`
 * is the excerpt sentence the answer rests on; the caller verifies it.
 */
export const SourceStanceSchema = z.object({
  holds: z.enum(['yes', 'no']),
  evidence: z.string().optional(),
});
export type SourceStance = z.infer<typeof SourceStanceSchema>;

/**
 * link-orphan.ts — For an orphan page (no incoming wiki-links),
 * propose related pages and their link text. Existing cast:
 * `{ related_pages?: Array<{page_path, link_text, link_target}> }`.
 * The schema marks the array as optional (the current code returns
 * `[]` if missing — `link-orphan` is a "best effort" call).
 */
export const LinkOrphanSchema = z.object({
  related_pages: z.array(z.object({
    page_path: z.string(),
    link_text: z.string(),
    link_target: z.string(),
  })).optional(),
});
export type LinkOrphan = z.infer<typeof LinkOrphanSchema>;

/**
 * fix-dead-link.ts — For a dead wiki-link, propose either a
 * replacement target or a stub to create. Existing cast:
 * `{ action?, correct_link?, stub_title?, stub_type? }`. All fields
 * are optional — the caller branches on `action` first; everything
 * else is contextual.
 */
export const FixDeadLinkSchema = z.object({
  action: z.string().optional(),
  correct_link: z.string().optional(),
  stub_title: z.string().optional(),
  stub_type: z.string().optional(),
});
export type FixDeadLink = z.infer<typeof FixDeadLinkSchema>;

/**
 * QueryView-class.ts — "Is this conversation valuable enough to
 * save?" boolean + reason. Existing cast: `{ valuable?: boolean;
 * reason?: string }`. The boolean is optional because the current
 * code defaults to "skip suggestion" if missing.
 */
export const QueryViewValueSchema = z.object({
  valuable: z.boolean().optional(),
  reason: z.string().optional(),
});
export type QueryViewValue = z.infer<typeof QueryViewValueSchema>;

// ============================================================================
// v1.26.3 PATCH expanded scope — schemas for the remaining 11 callers
// (commits 2-11). All schemas use `.passthrough()` per the user's
// "针对一些格式内容多变的属性，必须留好冗余空间" requirement: an LLM
// that emits an extra field (e.g. `confidence`, `score`) won't fail
// validation. Optional fields are marked `.optional()` so models can
// omit them when they lack the data. Type fields stay as widening
// `z.string()` (not strict enum) so a model that emits `'region'` or
// `'topic'` doesn't get rejected.
// ============================================================================

/**
 * source-analyzer.ts extract + extract-retry (the repair callback
 * reuses this schema). Output: a `SourceAnalysis`-shaped object
 * describing entities, concepts, contradictions, and source metadata.
 *
 * Existing cast: `Partial<SourceAnalysis>`. The schema is permissive:
 * every top-level field is optional except the bare structural shape
 * (entities / concepts arrays when present must be arrays). Per
 * code-review P2 (2026-08-11): `type` and the `mentions_with_provenance`
 * sub-fields are OPTIONAL, not required — downstream
 * `normalizeBatchResponse` / `coerceToArray` tolerate a missing `type`
 * (hardcoding `'other'`) and `fillMentionsWithProvenance` synthesizes
 * provenance from `mentions_in_source` when the structured form is absent.
 * Making them required on Tier 0 would turn a single entity missing one
 * field into a whole-response `NoObjectGeneratedError` → repair roundtrip.
 */
const MentionWithProvenanceItem = z.object({
  quote: z.string().optional(),
  translation: z.string().optional(),
  source_path: z.string().optional(),
  source_slug: z.string().optional(),
  extracted_at: z.string().optional(),
}).passthrough();

const EntityItem = z.object({
  name: z.string(),
  type: z.string().optional(), // widening union; downstream hardcodes 'other' when missing
  aliases: z.array(z.string()).optional(),
  summary: z.string().optional(),
  mentions_in_source: z.array(z.string()).optional(),
  mentions_with_provenance: z.array(MentionWithProvenanceItem).optional(),
  related_entities: z.array(z.string()).optional(),
  related_concepts: z.array(z.string()).optional(),
  // domain axis stage 3 (#568): observation + subset, both optional —
  // a missing value is not a signal (see CandidateCoverage in types.ts).
  coverage: z.string().optional(),
  domains: z.array(z.string()).optional(),
}).passthrough();

const ConceptItem = z.object({
  name: z.string(),
  type: z.string().optional(), // widening union; downstream hardcodes 'other' when missing
  aliases: z.array(z.string()).optional(),
  summary: z.string().optional(),
  mentions_in_source: z.array(z.string()).optional(),
  mentions_with_provenance: z.array(MentionWithProvenanceItem).optional(),
  related_concepts: z.array(z.string()).optional(),
  related_entities: z.array(z.string()).optional(),
  coverage: z.string().optional(), // domain axis stage 3 (#568), as on EntityItem
  domains: z.array(z.string()).optional(),
}).passthrough();

export const SourceAnalysisLLMSchema = z.object({
  source_title: z.string().optional(),
  summary: z.string().optional(),
  // Issue #463: `entities` and `concepts` MUST be in the wire
  // `required` array. Without this, an LLM response of `{}` (or one
  // whose top-level keys are mangled by a small local model under
  // grammar constraint, per DocTpoint's 2026-08-16 measurement) is
  // formally valid at the top level — `additionalProperties: true`
  // permits any key set, and `required` was empty — so
  // `strict: true` had nothing to enforce. `normalizeBatchResponse`
  // then reported 'unusable' on round 1 and abort.
  //
  // Fix: drop `.optional()` on these two arrays. `.passthrough()` at
  // the top level is preserved, so models that emit extras like
  // `confidence` or `score` still parse — the user requirement
  // "针对一些格式内容多变的属性，必须留好冗余空间" is honored. Only
  // the *absence* of the two structural arrays is rejected.
  // Mirrors the existing pattern in `LemmaClassifyLLMSchema` (`kind`
  // is required; extras pass through).
  //
  // `source_title`, `summary`, `key_points`, `related_pages`
  // remain `.optional()` because
  // `normalizeBatchResponse` does not consult them for batch-validity
  // (only entities + concepts do), and the runtime has explicit
  // fallbacks for missing source_title (filename) and missing summary
  // (lemma-guarantee skip). See
  // src/__tests__/llm-sdk/output-schemas.test.ts for the contract
  // these changes satisfy.
  entities: z.array(EntityItem),
  concepts: z.array(ConceptItem),
  related_pages: z.array(z.string()).optional(),
  key_points: z.array(z.string()).optional(),
}).passthrough();
export type SourceAnalysisLLM = z.infer<typeof SourceAnalysisLLMSchema>;

/**
 * source-analyzer.ts lemma-classify — "is this extracted lemma an
 * entity or a concept?" Existing cast: `{ kind?: unknown }`. The
 * caller filters to `'entity' | 'concept'` post-parse; widening
 * `z.string()` lets the model emit anything without throwing.
 */
export const LemmaClassifyLLMSchema = z.object({
  kind: z.string(),
}).passthrough();
export type LemmaClassifyLLM = z.infer<typeof LemmaClassifyLLMSchema>;

/**
 * source-analyzer.ts type-repair (Issue #527) — "which term of the active
 * vocabulary fits this extracted item?" Same widening pattern as
 * `LemmaClassifyLLMSchema`: `type` is required on the wire, the caller
 * folds the answer onto the vocabulary and keeps the extracted value when
 * the answer is not in it.
 */
export const TypeRepairLLMSchema = z.object({
  type: z.string(),
}).passthrough();
export type TypeRepairLLM = z.infer<typeof TypeRepairLLMSchema>;

/**
 * conversation-ingest.ts save-dedup — "is this conversation
 * entirely new, a partial overlap, or a full match against existing
 * wiki pages?" Existing cast: `{ status?: string }`. Status is
 * optional so the caller falls back to `'entirely_new'` if missing.
 */
export const ConversationDedupStatusLLMSchema = z.object({
  status: z.string().optional(),
}).passthrough();
export type ConversationDedupStatusLLM = z.infer<typeof ConversationDedupStatusLLMSchema>;

/**
 * dedup-phase.ts — LLM verdict on whether two candidate pages are
 * duplicates. Existing cast: `{ duplicates?: DuplicateResult[] }`.
 * The duplicates array is optional; `target` + `source` + `reason`
 * mirror the `DuplicateResult` interface in dedup-phase.ts.
 */
export const DedupResultLLMSchema = z.object({
  duplicates: z.array(z.object({
    target: z.string(),
    source: z.string(),
    reason: z.string(),
  }).passthrough()).optional(),
}).passthrough();
export type DedupResultLLM = z.infer<typeof DedupResultLLMSchema>;

/**
 * schema-manager.ts suggest-update — proposes changes to the user's
 * schema file. Existing parser: `parseSchemaSuggestion` in
 * src/schema/parse-suggestion.ts. Three optional fields, all widened
 * via passthrough.
 */
export const SchemaSuggestionLLMSchema = z.object({
  changes_needed: z.boolean().optional(),
  new_schema_body: z.string().optional(),
  suggestions: z.string().optional(),
}).passthrough();
export type SchemaSuggestionLLM = z.infer<typeof SchemaSuggestionLLMSchema>;

/**
 * path-resolution.ts resolve-dedup — does this entity/concept match an
 * existing page (update) or warrant a new page (create)? Existing cast:
 * `parsed.value as { match?: boolean; path?: string | null }` in
 * path-resolution.ts:246. `match` is the boolean verdict; `path` is the
 * existing page path when match=true. Both optional — caller branches on
 * `match` truthiness, falling back to `slugPath` when either is missing.
 */
export const PathResolutionLLMSchema = z.object({
  match: z.boolean().optional(),
  path: z.string().nullable().optional(),
  // #472 both ways: on a cross-folder match the call also re-decides the
  // entity/concept classification against the Classification Rules — the
  // matched page's folder is the first ingest's draw, not a fact about the
  // referent. Optional: only consumed when cross-folder candidates were
  // seeded and the matched page's classification is not yet confirmed.
  classification: z.enum(['entity', 'concept']).optional(),
}).passthrough();
export type PathResolutionLLM = z.infer<typeof PathResolutionLLMSchema>;

/**
 * fix-runners.ts alias-generate — propose alternative names /
 * abbreviations / translations for a page. Existing cast:
 * `{ aliases?: string[] }`. Caller dedupes + filters; schema marks
 * optional so missing aliases becomes `[]` upstream.
 */
export const AliasGenerationLLMSchema = z.object({
  aliases: z.array(z.string()).optional(),
}).passthrough();
export type AliasGenerationLLM = z.infer<typeof AliasGenerationLLMSchema>;

/**
 * fix-runners.ts tag-fix — propose valid active-vocabulary tags for a
 * page whose frontmatter carries invalid ones. Existing cast:
 * `{ tags?: string[] }`. Caller filters against the runtime tag vocab
 * before applying; schema stays permissive.
 */
export const TagFixLLMSchema = z.object({
  tags: z.array(z.string()).optional(),
}).passthrough();
export type TagFixLLM = z.infer<typeof TagFixLLMSchema>;

/**
 * localize-welcome-note.ts — translate an English Welcome note body
 * into the user's wikiLanguage. The LLM emits the full translated
 * markdown inside `translated`. Widening passthrough so future fields
 * (e.g. `notes`) don't break.
 */
export const WelcomeTranslationLLMSchema = z.object({
  translated: z.string(),
}).passthrough();
export type WelcomeTranslationLLM = z.infer<typeof WelcomeTranslationLLMSchema>;