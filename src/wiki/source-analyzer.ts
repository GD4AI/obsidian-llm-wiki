// Source Analyzer — iterative batch extraction of entities/concepts from source files.
// Extracted from WikiEngine.

import { TFile } from 'obsidian';
import {
  EngineContext,
  SourceAnalysis,
  EntityInfo,
  ConceptInfo,
  ContradictionInfo,
  MentionWithProvenance,
  LLMFinishReason,
  LLMUsage,
  EmbeddedImageAnalysisReport,
  LLMClient,
} from '../types';
import { PROMPTS } from '../prompts';
import { parseJsonResponse, parseJsonResult } from '../core/json';
import { isCrossLanguage, normalizeSourceLanguage, getWikiLanguageName } from '../core/source-language';
import { renderTemplate } from '../core/template-renderer';
import { matchExtractedToExisting } from '../core/index-search';
import { coerceToArray } from '../core/arrays';
import { buildDomainContext, collectActiveVocabulary } from '../core/domain-axis'; // domain axis stages 3-5 (#568)
import { isBlankSource } from '../core/frontmatter';
import { MAX_TOKENS_BATCH, TOKENS_PER_ITEM_BUDGET, TOKENS_LEMMA_CLASSIFY, TOKENS_TYPE_REPAIR, SOURCE_ANALYZER_RETRY_MULTIPLIER } from '../constants';
import { getExistingWikiPages } from './lint/get-existing-pages';
import { getGranularityInstruction } from './system-prompts';
import { resolveModelForTask } from '../core/model-resolver';
import { getText } from '../core/i18n';
import { calculateBatchLimits, adjustBatchSizeForResponse, getCustomTypeCaps } from '../core/batch-limits';
import { detectConvergence, checkCumulativeLimits, checkEmptyBatch, formatConvergenceStatus } from '../core/convergence-detector';
import { createEmptyAccumulation, mergeBatchResults, buildSourceAnalysis, calculateBatchStats } from '../core/batch-merger';
import { decideSourceLemma } from '../core/source-lemma';
import { getActiveEntityTags, getActiveConceptTags, foldToVocabulary } from '../core/tag-vocab';
import { EmbeddedImageEvidenceSchema, SourceAnalysisLLMSchema, LemmaClassifyLLMSchema, TypeRepairLLMSchema } from '../llm-sdk/output-schemas';
import { callLlm } from '../core/llm-dispatch';
import { findRepetitionLoop, isSourceBorneLoop, REPETITION_LOOP_MIN_REPEATS } from '../core/repetition-loop';
import { discoverEmbeddedImages, gifFirstFrameToPng, packageEmbeddedImages, readEmbeddedImagePart } from '../core/embedded-image-resolver';

// ── Batch response normalization ─────────────────────────────────
// LLMs often return irregular JSON: omitted empty arrays, non-array truthy
// values (entities: true), or missing keys entirely. This module centralizes
// all input validation so the main extraction loop doesn't need scattered
// `|| []` fallbacks. Pure functions (no IO) — fully unit-testable.

export type BatchValidity = 'valid' | 'empty' | 'unusable';

/**
 * Issue #244 — auto-fill mentions_with_provenance from legacy
 * mentions_in_source when the LLM did not return the structured form.
 * This enables the page-factory to always use mentions_with_provenance
 * for programmatic Mentions writes, even when ingesting from older models
 * that only output the legacy string[] format.
 *
 * Manual-test fix: when we synthesize provenance from legacy, ALSO clear the
 * legacy `mentions_in_source` field so the LLM doesn't see both arrays in
 * the analysis log (and so downstream code that prefers the structured form
 * never accidentally falls back to a stale legacy array).
 */
function fillMentionsWithProvenance<T extends EntityInfo | ConceptInfo>(item: T): T {
  // If the LLM already returned structured provenance, keep it as-is
  // but clear the legacy field when both are present (avoids duplicate output).
  if (item.mentions_with_provenance?.length) {
    if (item.mentions_in_source?.length) {
      return { ...item, mentions_in_source: undefined };
    }
    return item;
  }
  // Otherwise, synthesize provenance from the legacy string[].
  const quotes = item.mentions_in_source?.filter(q => q?.trim()) ?? [];
  if (quotes.length === 0) return item;
  const now = new Date().toISOString();
  const provenance: MentionWithProvenance[] = quotes.map(quote => ({
    quote,
    source_path: '',      // filled by page-factory at write time
    source_slug: '',      // filled by page-factory at write time
    extracted_at: now,
  }));
  return { ...item, mentions_with_provenance: provenance, mentions_in_source: undefined };
}

export interface NormalizedBatch {
  entities: EntityInfo[];
  concepts: ConceptInfo[];
  sourceTitle: string | null;
  summary: string | null;
  contradictions: ContradictionInfo[];
  relatedPages: string[];
  keyPoints: string[];
}

function isVisionInputRejected(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:image|vision|multimodal|content[_ -]?type).{0,80}(?:unsupported|not supported|invalid|reject)/i.test(message)
    || /(?:unsupported|not supported|invalid|reject).{0,80}(?:image|vision|multimodal|content[_ -]?type)/i.test(message);
}

// Normalize a raw LLM batch response into a well-formed NormalizedBatch.
// Returns a validity flag so callers can distinguish:
//   'unusable' — both arrays absent/unfilled ⟹ abort first batch or skip
//   'empty'    — both arrays present but zero items ⟹ signal to stop iteration
//   'valid'    — at least one extractable item found ⟹ continue processing
export function normalizeBatchResponse(
  raw: Partial<SourceAnalysis> | null
): { validity: BatchValidity; data: NormalizedBatch } {
  if (!raw) {
    return { validity: 'unusable', data: emptyBatch() };
  }

  const entities = coerceToArray<EntityInfo>(raw.entities)
    .filter(e => e?.name?.trim())
    .map(e => fillMentionsWithProvenance(e));
  const concepts = coerceToArray<ConceptInfo>(raw.concepts)
    .filter(c => c?.name?.trim())
    .map(c => fillMentionsWithProvenance(c));

  // Strip wiki-link formatting if LLM outputs [[path|name]] instead of plain name
  const relatedPages = coerceToArray<string>(raw.related_pages).map(p => {
    const match = String(p).match(/^\[\[(?:[^\]|]+\|)?([^\]]+)\]\]$/);
    return match ? match[1] : p;
  });

  const data: NormalizedBatch = {
    entities,
    concepts,
    sourceTitle: typeof raw.source_title === 'string' ? raw.source_title : null,
    summary: typeof raw.summary === 'string' ? raw.summary : null,
    contradictions: coerceToArray<ContradictionInfo>(raw.contradictions),
    relatedPages,
    keyPoints: coerceToArray<string>(raw.key_points),
  };

  if (entities.length === 0 && concepts.length === 0) {
    // Both absent at key level → truly unusable; both present but empty → empty signal
    const bothKeysAbsent = raw.entities === undefined && raw.concepts === undefined;
    return { validity: bothKeysAbsent ? 'unusable' : 'empty', data };
  }

  return { validity: 'valid', data };
}

function emptyBatch(): NormalizedBatch {
  return {
    entities: [],
    concepts: [],
    sourceTitle: null,
    summary: null,
    contradictions: [],
    relatedPages: [],
    keyPoints: [],
  };
}

export class SourceAnalyzer {
  constructor(private ctx: EngineContext) {}

  /**
   * Analyze a source file and produce a `SourceAnalysis` describing its
   * entities, concepts, and related pages.
   *
   * Options:
   * - `contentOverride`: when set, skip `vault.read(file)` and use this
   *   string as the source body. Used by the PDF branch to feed LLM-converted
   *   markdown without writing a sidecar file. Path-based operations
   *   (slug resolution, frontmatter inheritance) still use `file`.
   *
   * Returns null on blank content (defense-in-depth; the pre-ingest gate
   * normally rejects blank sources first).
   */
  async analyzeSource(file: TFile, opts?: { contentOverride?: string }): Promise<SourceAnalysis | null> {
    console.debug('=== Source analysis started ===');
    console.debug('File:', file.path);
    if (opts?.contentOverride !== undefined) {
      console.debug('Using contentOverride (virtual body), length:', opts.contentOverride.length);
    }

    const content = opts?.contentOverride ?? await this.ctx.app.vault.read(file);
    console.debug('File content length:', content.length);

    // #164 defense-in-depth: a blank source (empty / whitespace / frontmatter-only)
    // makes small/local models hallucinate entities to satisfy the JSON schema.
    // Never send a blank prompt to the LLM. The ingest gate normally rejects these
    // first; this guards any other/future caller of analyzeSource.
    if (isBlankSource(content)) {
      console.debug('[Source analysis] blank body — skipping LLM call, returning null');
      return null;
    }

    // Issue #185: source note's frontmatter `aliases:` are appended to
    // the generated `sources/<slug>` page (consumed there by
    // `fix-dead-link`'s slugify-normalized cross-page alias match).
    const noteFm = this.ctx.app.metadataCache
      .getFileCache(file)?.frontmatter as { aliases?: unknown; language?: unknown; tags?: unknown } | undefined;
    const rawNoteAliases = noteFm?.aliases;
    const sourceNoteAliases: string[] = Array.isArray(rawNoteAliases)
      ? rawNoteAliases.filter((a): a is string => typeof a === 'string')
      : [];
    // domain axis stage 3 (#568): the note's own tags are the domain proposal
    // for the note's own lemma. Extracted items get their `domains` subset
    // from the model; the lemma candidate is added after extraction and never
    // passes through that prompt, so without this it is the one page class
    // born domainless. The note's tags describe the note's subject — which is
    // exactly what the lemma page is — and they are in the harvested
    // vocabulary by construction; the engine-side `selectDomains` validation
    // still runs over them like over any model answer.
    const rawNoteTags = noteFm?.tags;
    const sourceNoteTags: string[] = Array.isArray(rawNoteTags)
      ? rawNoteTags.filter((t): t is string => typeof t === 'string')
      : [];
    // Source note's frontmatter `language:` lets us skip the translation
    // instruction when the source is already in the wiki's language (e.g. a
    // Russian source in a Russian wiki -- translating verbatim quotes into the
    // same language is wasteful and bloats the JSON). Absent -> legacy behavior.
    // Reuse the frontmatter value already fetched above instead of a second
    // metadataCache call.
    const sourceLang = normalizeSourceLanguage(noteFm?.language);

    console.debug('Existing Wiki pages count: — delayed until post-extraction matching');

    // Calculate batch limits using pure functions (Phase 1)
    const limits = calculateBatchLimits(content.length, this.ctx.settings.extractionGranularity || 'standard', {
      entityCap: this.ctx.settings.customEntityLimit,
      conceptCap: this.ctx.settings.customConceptLimit
    });

    const customTypeCaps = getCustomTypeCaps(this.ctx.settings);

    // Dynamic max_tokens: scale with batch size to avoid truncation on large batches.
    // Batch 1 with 50 items needs ~20K tokens; batch 2+ with dedup context may need more.
    const baseMaxTokens = Math.max(MAX_TOKENS_BATCH, limits.initialBatchSize * TOKENS_PER_ITEM_BUDGET);
    // Allow truncation retry to grow up to N× the base cap.
    const retryCap = baseMaxTokens * SOURCE_ANALYZER_RETRY_MULTIPLIER;

    console.debug(`[Batch limits] Initial size: ${limits.initialBatchSize}, Max batches: ${limits.maxBatches}, Max total: ${limits.maxTotalItems || 'none'}, baseMaxTokens: ${baseMaxTokens}, retryCap: ${retryCap}`);

    let currentBatchSize = limits.initialBatchSize;
    let batchSizeHalved = false;
    let retryingBatch = false; // one retry on truncation: halve batch size
    // S143: halving lowers only the item ceiling inside the prompt. A
    // reasoning model that spent the whole budget thinking never reached the
    // items, so a smaller ceiling cannot shorten the retry — and
    // Math.max(baseMaxTokens, …) could only shrink the budget back to base.
    // The retry must also raise the budget to retryCap, which until now was
    // only ever passed as a ceiling nothing climbed toward.
    let escalateMaxTokens = false;
    // v1.26.x PATCH follow-up (#443 LMStudio + Qwen3.5): a reasoning-mode
    // model under grammar constraint emits `{"": ""}` (minimum valid JSON
    // object) as a placeholder when its thinking budget is tight. The
    // parseJsonResponse placeholder gate now rejects it (returns null),
    // but the model sometimes emits a complete JSON on retry (observed in
    // LMStudio + Qwen3.5 testing). Give the FIRST batch one bounded retry
    // WITHOUT halving (placeholder is not truncation — batch size is fine,
    // the model just needs another generation pass). Mirrors the
    // `retryingBatch` single-attempt philosophy from Issue #305.
    let placeholderRetried = false;

    // Issue #305: the halving retry below used to live only in the catch
    // block, so it required the provider call to *throw*. An
    // OpenAI-compatible provider does not throw on truncation — it returns
    // HTTP 200 with a body that stops mid-token — so the batch fell through
    // to the parse-failure `break` and was dropped silently. Hoisted into a
    // closure so the parse-failure path and the catch path share one
    // implementation. Returns whether the caller should re-run this batch;
    // the caller owns the loop control (`batchNum--; continue;`).
    // Whether a halve-and-retry is still available for the current batch.
    // Gates both the retry itself and the decision to skip JSON repair on a
    // truncated response — repair is the last salvage once halving is spent.
    const canHalveBatch = (): boolean => !retryingBatch && currentBatchSize > limits.minBatchSize;

    const halveBatchAndRetry = (batchLabel: string, cause: string): boolean => {
      if (!canHalveBatch()) return false;
      currentBatchSize = Math.max(limits.minBatchSize, Math.floor(currentBatchSize * 0.5));
      escalateMaxTokens = true;
      console.warn(`${batchLabel} Truncation detected (${cause}), halving batch size to ${currentBatchSize} and raising max_tokens to ${retryCap} for the retry`);
      retryingBatch = true;
      return true;
    };

    // Initialize batch accumulation using pure function (Phase 3)
    const accumulation = createEmptyAccumulation();

    let firstBatchData: NormalizedBatch | null = null;
    let finalBatchNum = 0;

    // Build granularity instruction from shared definitions
    const granularityInstruction = getGranularityInstruction(this.ctx.settings)

    // Issue #85 v6 / #328 Phase 1 follow-up: user-layer tag-vocab removed
    // (system layer append once, see comments at the injection site below).
    //
    // Issue #482 stage 1: extraction carries no vault-side payload. The slug
    // catalog that used to sit at the top of this prompt (#116) was ~91% of it
    // on a mature vault, grew without bound, and duplicated work the later
    // stages already do per item — `PageFactory.resolvePagePath` resolves
    // identity against ranked same-type candidates, and related_pages is
    // matched programmatically from the extracted names after extraction.
    // Extraction is reading, not linking: the prompt is now instructions plus
    // the note, so its prefix is identical for every note and per-note cost is
    // a function of the note instead of the vault.
    //
    // Issue #244 (manual test fix): inject the source's original vault path
    // so the LLM records it in `mentions_with_provenance[i].source_path`
    // instead of guessing `wiki/sources/<slug>`.
    // domain axis stage 3 (#568): the vault's tag vocabulary is the
    // allowed list for the per-item `domains` subset. Rendered into the static
    // prefix (before {{batch_context}}); the block is the same for every note,
    // so the prefix cache holds across notes. Empty when no note carries tags.
    const client = this.ctx.getClient();
    if (!client) throw new Error('LLM client not initialized');

    const imageAnalysis = this.ctx.settings.analyzeEmbeddedImages === true
      ? await this.analyzeEmbeddedImages(content, file.path, client)
      : undefined;
    const extractionContent = imageAnalysis?.evidence
      ? `${content}\n\n## Embedded Image Visual Evidence\n${imageAnalysis.evidence}`
      : content;

    const templateUntouched = renderTemplate(PROMPTS.analyzeSource, {
      content: extractionContent,
      source_path: file.path,
      domain_context: buildDomainContext(
        collectActiveVocabulary(this.ctx.app, this.ctx.settings),
      ),
    });
    const batchMarker = '{{batch_context}}';
    const markerIdx = templateUntouched.indexOf(batchMarker);
    const staticPrefix = templateUntouched.substring(0, markerIdx);
    const suffixTemplate = templateUntouched.substring(markerIdx + batchMarker.length);

    for (let batchNum = 0; batchNum < limits.maxBatches; batchNum++) {
      const isFirstBatch = batchNum === 0;

      let batchContext: string;
      if (isFirstBatch) {
        batchContext = 'This is the first extraction round. Extract the most important entities and concepts from the source.';
      } else {
        // Build already-extracted context with names and aliases to inform later rounds.
        // This prevents the LLM from re-extracting duplicates (especially useful for
        // small models that cannot reliably remember their own previous output).
        const ctxLines: string[] = [];
        for (const e of accumulation.entities) {
          const line = e.aliases?.length
            ? `${e.name} (aliases: ${e.aliases.join(', ')})`
            : e.name;
          ctxLines.push(line);
        }
        for (const c of accumulation.concepts) {
          const line = c.aliases?.length
            ? `${c.name} (aliases: ${c.aliases.join(', ')})`
            : c.name;
          ctxLines.push(line);
        }
        const alreadyExtracted = ctxLines.length > 0
          ? `\n\nAlready extracted from this source:\n  [${ctxLines.join('; ')}]\n  (including abbreviations, synonyms, and translations of these names)\nDo NOT extract them again. If a candidate name is equivalent to any of the above — including their aliases — skip it.`
          : '';
        batchContext = `This is round ${batchNum + 1} of extraction. Extract the next batch of most important entities and concepts from the remaining content. If no more items are worth extracting, return empty arrays [] for entities and concepts.${alreadyExtracted}`;
      }

      const prompt = renderTemplate(staticPrefix + batchContext + suffixTemplate, {
        granularity_instruction: granularityInstruction,
        batch_size: String(currentBatchSize),
      });

      const wikiLang = this.ctx.settings.wikiLanguage || 'en';
      const wikiLangName = getWikiLanguageName(wikiLang);
      const langHint = `\n\nCRITICAL LANGUAGE REQUIREMENT: Summaries, descriptions, source_title, and key_points in your JSON output MUST be written in ${wikiLangName}. HOWEVER: entity names and concept names MUST be preserved in their original source language -- NEVER translate names. mentions_in_source MUST be verbatim quotes from the source (preserve original language).`;
      // Issue #244 (manual test fix): when the user's wiki language differs
      // from English, instruct the LLM to ALSO emit a 'translation' field
      // alongside each quote in mentions_with_provenance. The downstream
      // formatter renders: "<verbatim>" (<translation>) -- [[path|display]].
      // When source and wiki languages match, skip the translation field.
      // When the source's own language matches the wiki language, translating
      // its verbatim quotes back into the same language is meaningless (and
      // bloats the JSON to the point of truncation). Prefer the explicit
      // frontmatter `language:` signal; fall back to the legacy `!== 'en'`
      // proxy only when the source is untagged, so cross-language wikis keep
      // their translation behavior unchanged.
      const crossLanguage = isCrossLanguage(sourceLang, wikiLang);
      const translationHint = crossLanguage
        ? `\n\nTRANSLATION (cross-language wikis): For each entry in mentions_with_provenance, ALSO add a 'translation' field containing a ${wikiLangName} translation of the quote text. The 'quote' field MUST stay verbatim in the source's original language; the translation goes in a separate 'translation' field. Example: {"quote": "Machine learning is fun", "translation": "机器学习很有趣", "source_path": "...", ...}`
        : '';
      // #328 Phase 1 follow-up: user-layer tag-vocab removed — system layer (buildSystemPrompt) always injects once.
      const finalPrompt = prompt + langHint + translationHint;

      console.debug(`[Batch ${batchNum + 1}/${limits.maxBatches}] LLM call started (batch_size=${currentBatchSize})...`);
      console.debug(`[Batch ${batchNum + 1}] Prompt length:`, prompt.length);
      if (isFirstBatch) {
        this.ctx.onProgress?.(
          getText(this.ctx.settings.language, 'ingestBatchInitial')
            .replace('{total}', String(limits.maxBatches))
        );
      } else {
        this.ctx.onProgress?.(
          getText(this.ctx.settings.language, 'ingestBatchProgress')
            .replace('{current}', String(batchNum + 1))
            .replace('{total}', String(limits.maxBatches))
            .replace('{entities}', String(accumulation.entities.length))
            .replace('{concepts}', String(accumulation.concepts.length))
        );
      }

      try {
        const systemPrompt = await this.ctx.buildSystemPrompt('analyze');
        // Scale max_tokens with current batch size to avoid truncation.
        const batchMaxTokens = escalateMaxTokens
          ? retryCap
          : Math.max(baseMaxTokens, currentBatchSize * TOKENS_PER_ITEM_BUDGET);
        // v1.24.0 #208: route through resolveModelForTask so the debug
        // log reflects the ACTUAL model used (per-task override), not
        // the unified setting. Without this, e2e verification of
        // per-task routing would be impossible from console alone.
        const resolvedModel = resolveModelForTask(this.ctx.settings, 'ingest');
        console.debug(`[Batch ${batchNum + 1}] Provider:`, this.ctx.settings.provider, '| Model:', resolvedModel, '| Prompt:', finalPrompt.length, 'chars', '| max_tokens:', batchMaxTokens);
        // Issue #305: record why generation stopped. Clients that do not
        // report it leave this at 'unknown', which keeps pre-#305 behavior.
        // Held in an object rather than a bare `let` so control-flow analysis
        // does not narrow it to its initializer across the callback.
        const finish: { reason: LLMFinishReason; usage?: LLMUsage } = { reason: 'unknown' };
        // v1.26.3 PATCH (Issue #443): typed-output path. The schema travels on
        // the wire as `response_format: { type: 'json_schema', json_schema: {...} }`
        // when the OutputModeProber has cached Tier 0 (json_schema) for this
        // baseURL — exactly what LMStudio accepts. On Tier 1 / Tier 2, the SDK
        // drops the schema and falls back to `Output.json()` / no-field; we then
        // parse `result.text` via the existing parseJsonResponse path.
        const extractArgs = {
          task: 'extract' as const,
          model: resolvedModel,
          max_tokens: batchMaxTokens,
          system: systemPrompt,
          messages: [{ role: 'user' as const, content: finalPrompt }],
          response_format: { type: 'json_object' as const, schema: SourceAnalysisLLMSchema },
          cacheBreakpoint: staticPrefix.length,
          maxTokensPerCall: retryCap,
          // Extraction never mentioned the thinking setting, so whatever the
          // server had been started with decided it and the setting meant
          // nothing here. Not the only such call site — the lint alias and tag
          // runners and the PDF converter still do not pass it, and the welcome
          // note and the connection probe omit it deliberately — but the one
          // this change is about. Sent in the disable direction
          // only, matching every other call site: `disableThinking` defaults to
          // false, so asking for reasoning would fire on every install that
          // never opened the setting.
          ...(this.ctx.settings.disableThinking === true ? { enableThinking: false } : {}),
          onFinish: (meta: { finishReason: LLMFinishReason; usage?: LLMUsage }) => {
            finish.reason = meta.finishReason;
            finish.usage = meta.usage;
          },
        };
        // Typed-output dispatch via the centralized helper in core/llm-dispatch:
        // prefer createMessageWithOutput on modern clients, fall back to
        // createMessage on legacy Anthropic / OpenAI / Codex. The returned
        // string is the wire text — Tier 1 / Tier 2 (output undefined) flows
        // through the existing parseJsonResponse path below.
        const response = await callLlm(client, extractArgs);

        // Surface real token usage (Issue #305 follow-up): the model reports
        // prompt/completion tokens; logging them per batch turns truncation
        // tuning (batch size vs max_tokens vs context window) into a
        // measurement instead of a char-count guess.
        const usageStr = finish.usage
          ? ` | tokens in=${finish.usage.inputTokens ?? '?'} out=${finish.usage.outputTokens ?? '?'} (max_tokens=${batchMaxTokens})`
          : '';
        console.debug(`[Batch ${batchNum + 1}] Response length:`, response.length, usageStr);
        this.ctx.onProgress?.(
          getText(this.ctx.settings.language, 'ingestBatchProcessed')
            .replace('{current}', String(batchNum + 1))
        );

        // Issue #524: a degenerate repetition loop is the one signal that
        // tells a damaged batch from a short one. Under grammar-constrained
        // decoding the loop can end in `finish_reason: stop` with schema-valid
        // JSON around it — a handful of items, the loop inside a string — and
        // every guard below (empty-batch, halving on `length`, JSON repair)
        // accepts that as a successful batch. Treat it like truncation: halve
        // and retry while the budget allows; otherwise parse what arrived and
        // say so. The debug line carries finish reason and reasoning tokens
        // so a user can read the regime off the log (#524).
        const loop = findRepetitionLoop(response);
        const reasoningStr = finish.usage?.reasoningTokens !== undefined ? ` reasoning_tokens=${finish.usage.reasoningTokens}` : '';
        console.debug(`[Batch ${batchNum + 1}] finish=${finish.reason}${reasoningStr}${loop ? ` repetition_loop=${loop.length} chars (unit "${loop.unit}")` : ''}`);
        // #525 review: a note that repeats a phrase itself — a refrain, a
        // tabulated column, a quoted chorus — produces a faithful echo that
        // looks exactly like degeneracy here. Halving changes how many items
        // are asked for, never the note, so the retry is spent on a certainty
        // and the same batch is merged afterwards anyway. Check the note
        // before spending it.
        if (loop && isSourceBorneLoop(loop, content)) {
          console.debug(`[Batch ${batchNum + 1}] Repetition loop mirrors the source note (unit "${loop.unit}" occurs there ${REPETITION_LOOP_MIN_REPEATS}+ times) — echo, not damage; no retry spent`);
        } else if (loop) {
          console.warn(`[Batch ${batchNum + 1}] Repetition loop in response (${loop.length} chars repeating "${loop.unit}") — treating the batch as damaged (Issue #524)`);
          if (halveBatchAndRetry(`[Batch ${batchNum + 1}]`, 'repetition loop')) {
            batchNum--;
            continue;
          }
          console.warn(`[Batch ${batchNum + 1}] No retry budget left for the damaged batch; parsing what arrived`);
        }

        // Issue #305 follow-up: on a truncated response (finish_reason=length)
        // the JSON is *incomplete*, not malformed, and a syntax-repair pass
        // costs another retryCap-sized call re-hitting the same limit
        // (observed: a ~48k-token repair that itself truncates). Prefer
        // halve-and-retry, which re-runs the batch smaller.
        //
        // Only skip repair while that retry is actually available. Once the
        // halving budget is spent, repair becomes the last salvage: a truncated
        // batch is a prefix of complete items followed by one cut-off item, and
        // closing the brackets around the complete ones is exactly what the
        // repair prompt asks for. Without it the parse-failure path falls to
        // `return null` on a first batch — dropping the whole source rather
        // than the items that did arrive.
        //
        // Providers that report no finish reason keep 'unknown' and the repair
        // path regardless.
        const repairFn = finish.reason === 'length' && canHalveBatch()
          ? undefined
          : async (malformedJson: string) => {
            const repairPrompt = `Fix the following malformed JSON. Only fix JSON syntax errors (unescaped quotes, trailing commas, missing brackets). Do NOT change any values or content. Output ONLY the fixed JSON, no other text.\n\n${malformedJson}`;
            const repairArgs = {
              task: 'extract-retry' as const,
              model: resolveModelForTask(this.ctx.settings, 'ingest'),
              max_tokens: retryCap, // Repair may need full output if original was truncated at retryCap
              system: await this.ctx.buildSystemPrompt('analyze'),
              messages: [{ role: 'user' as const, content: repairPrompt }],
              response_format: { type: 'json_object' as const, schema: SourceAnalysisLLMSchema },
              maxTokensPerCall: retryCap,
              // v1.26.0 Batch 7 follow-up (DocTpoint measurement, PR #411
              // review 2026-08-05 05:38 UTC): eucher's finding that the
              // repair callback did not propagate `disableThinking` is
              // true at the surface, but the fix is NOT to mirror the
              // parent call's setting. DocTpoint's controlled pair on
              // LM Studio / gemma-4-12b showed that disabling reasoning
              // on the repair call produces structurally valid JSON with
              // wrong content (concepts duplicated into entities;
              // `concepts` set to null; key fields dropped) — silent
              // data corruption. Repair needs reasoning budget to
              // understand broken-JSON semantics, not just string-level
              // bracket fixing. The opposite direction (complementary
              // append at 600-token cap) IS reasoning-burnt (Issue
              // #403) and should disable. The per-call policy is:
              //   - parent analysis call → `disableThinking` honors
              //   - repair call → always allow reasoning (default
              //     model behavior; no flag passed means SDK picks)
              //   - short-cap append call → `disableThinking` honors
              // The setting is not propagated uniformly. Tracked as a
              // v1.26.x PATCH item: introduce a per-call-type
              // `thinkingPolicy` enum so the user can express "no
              // reasoning for short-budget calls, full reasoning for
              // repair".
            };
            // Same typed-output dispatch as the parent call, via the centralized
            // core/llm-dispatch helper. parseJsonResponse only needs the
            // string back, so either branch returns the same shape.
            return callLlm(client, repairArgs);
          };
        // v1.26.x PATCH follow-up (#443 LMStudio + Qwen3.5): use
        // parseJsonResult (not parseJsonResponse) so the parse FAILURE
        // REASON is available. A grammar-constrained reasoning model
        // emits `{"": ""}` — the placeholder gate rejects it with reason
        // 'thinking-block-only'. That is the one condition we retry
        // without halving. Malformed/empty/exception keep the legacy
        // paths below unchanged.
        const parseResult = await parseJsonResult(response, repairFn);
        const analysisData = parseResult.ok
          ? parseResult.value as Partial<SourceAnalysis>
          : null;
        const parseReason = parseResult.ok ? undefined : parseResult.reason;

        if (!analysisData) {
          // Issue #305: a truncated response is not malformed JSON, it is
          // *incomplete* JSON — the repair callback above cannot restore
          // content that was never emitted, and it re-hits the same limit
          // trying. When the provider tells us it ran out of tokens, halve
          // the batch and re-run instead of dropping it. Applies to the
          // first batch too: the alternative there is `return null`, i.e.
          // the whole ingest fails, so one bounded retry is strictly
          // better. `retryingBatch` and `minBatchSize` bound it to a single
          // extra attempt.
          if (finish.reason === 'length' && halveBatchAndRetry(`[Batch ${batchNum + 1}]`, 'finish_reason=length')) {
            batchNum--;
            continue;
          }
          // v1.26.x PATCH follow-up (#443 LMStudio + Qwen3.5): the
          // placeholder gate (`{"": ""}` grammar-constrained artifact)
          // returns reason 'thinking-block-only' with finish.reason='stop'.
          // A complete JSON is sometimes emitted on a second generation
          // pass (observed on LMStudio + Qwen3.5). Give the first batch
          // ONE retry without halving before giving up — but ONLY for the
          // placeholder-gate condition, NOT for malformed/empty (those keep
          // the #305 "no retry on non-truncation" contract). Later batches
          // skip this — by then the model is clearly misbehaving and
          // retrying every batch would multiply LLM calls (Gate 4 network
          // regression).
          if (isFirstBatch && !placeholderRetried && parseReason === 'thinking-block-only') {
            placeholderRetried = true;
            console.warn(`[Batch ${batchNum + 1}] Placeholder response (placeholder gate), retrying once without halving`);
            batchNum--;
            continue;
          }
          console.error(`[Batch ${batchNum + 1}] JSON parse failed, skipping batch`);
          if (isFirstBatch) return null;
          break;
        }

        // Issue #305 follow-up: the one-retry-per-batch budget must reset once
        // a batch parses successfully. Otherwise the first halve anywhere
        // latches `retryingBatch` for the rest of the source, so a later
        // truncation can no longer halve (halveBatchAndRetry short-circuits)
        // and its batch is silently dropped — the source finalizes as
        // complete while missing that batch's items. Resetting here, on the
        // success path, gives each batch its own retry budget.
        retryingBatch = false;
        escalateMaxTokens = false;

        const { validity, data: norm } = normalizeBatchResponse(analysisData);

        if (isFirstBatch) {
          if (validity === 'unusable') {
            console.error('❌ Round 1 unusable — no entities or concepts:', {
              entities: !!analysisData?.entities,
              concepts: !!analysisData?.concepts
            });
            return null;
          }
          if (!norm.sourceTitle) {
            console.debug('Round 1 missing source_title, falling back to filename:', file.basename);
          }
          // Issue #524: the later batches log their item counts via
          // calculateBatchStats; the first one did not, and it is the batch
          // whose yield says most about the response regime.
          console.debug(`[Batch 1] items: entities=${norm.entities.length} concepts=${norm.concepts.length} (batch_size=${currentBatchSize})`);
          firstBatchData = norm;
          accumulation.contradictions = norm.contradictions;
          accumulation.relatedPages = norm.relatedPages;
          accumulation.keyPoints = norm.keyPoints;

          // First batch: immediately merge entities/concepts into accumulation
          const firstMergeResult = mergeBatchResults(accumulation, norm, customTypeCaps);
          accumulation.entities = firstMergeResult.allEntities;
          accumulation.concepts = firstMergeResult.allConcepts;
          accumulation.extractedNames = firstMergeResult.extractedNames;
        }

        if (validity === 'empty') {
          console.debug(`[Batch ${batchNum + 1}] LLM returned empty arrays, stopping iteration`);
          break;
        }

        // Later batches: merge batch results using pure function (Phase 3)
        if (!isFirstBatch) {
          const mergeResult = mergeBatchResults(accumulation, norm, customTypeCaps);
          accumulation.entities = mergeResult.allEntities;
          accumulation.concepts = mergeResult.allConcepts;
          accumulation.extractedNames = mergeResult.extractedNames;

          // Batch statistics logging for later batches
          const rawTotal = norm.entities.length + norm.concepts.length;
          const newTotal = mergeResult.newEntities.length + mergeResult.newConcepts.length;
          const statsMsg = calculateBatchStats(batchNum + 1, {
            entities: mergeResult.newEntities.length,
            concepts: mergeResult.newConcepts.length
          }, {
            entities: accumulation.entities.length,
            concepts: accumulation.concepts.length
          });
          console.debug(statsMsg);

          // Adjust batch size for long responses (Phase 1)
          currentBatchSize = adjustBatchSizeForResponse(currentBatchSize, response.length, limits.responseFullnessThreshold);

          // Check empty batch (Phase 2)
          const emptyCheck = checkEmptyBatch(rawTotal, newTotal);
          if (emptyCheck.shouldStop) {
            console.debug(`[Batch ${batchNum + 1}] ${emptyCheck.reason}, stopping`);
            break;
          }

          // Convergence detection (Phase 2)
          const convergence = detectConvergence(rawTotal, currentBatchSize, batchSizeHalved, limits.minBatchSize);
          if (convergence.shouldStop) {
            console.debug(formatConvergenceStatus(batchNum + 1, convergence));
            break;
          }
          if (convergence.newBatchSizeHalved) {
            batchSizeHalved = true;
            currentBatchSize = convergence.newBatchSize;
          }

          // Cumulative limits check (Phase 2)
          const cumulativeCheck = checkCumulativeLimits(accumulation.entities.length, accumulation.concepts.length, {
            customEntityCap: customTypeCaps.entityCap,
            customConceptCap: customTypeCaps.conceptCap,
            maxTotalItems: limits.maxTotalItems
          });
          if (cumulativeCheck.shouldStop) {
            console.debug(`[Batch ${batchNum + 1}] ${cumulativeCheck.reason}, stopping`);
            break;
          }
        }

        finalBatchNum = batchNum + 1;

      } catch (error) {
        console.error(`[Batch ${batchNum + 1}] Call failed:`, error);
        if (isFirstBatch) {
          const providerName = this.ctx.settings.provider;
          const modelName = this.ctx.settings.model;
          const errMsg = error instanceof Error ? error.message : String(error);
          const lowerErr = errMsg.toLowerCase();

          // Classify error by message content for targeted user guidance
          let userHint: string;
          if (lowerErr.includes('context') || lowerErr.includes('token') || lowerErr.includes('length') || lowerErr.includes('exceed')) {
            userHint = 'The request was rejected because the source file is too large for this model\'s context window. ' +
              'Try: (1) switch to a model with a larger context window (e.g. 1M tokens) in Settings, ' +
              '(2) reduce the file size, or (3) use a provider that supports larger contexts.';
          } else if (lowerErr.includes('max_tokens')) {
            userHint = 'The model rejected the max_tokens value. Try reducing it in Settings → LLM Configuration → Context Window.';
          } else if (lowerErr.includes('400')) {
            userHint = 'The API returned a Bad Request error. Check that the model name is correct and supported by your provider.';
          } else if (lowerErr.includes('401') || lowerErr.includes('403')) {
            userHint = 'Authentication failed. Check your API key in Settings.';
          } else if (lowerErr.includes('429')) {
            userHint = 'Rate limit exceeded. Wait a moment and try again, or switch to a provider with higher limits.';
          } else {
            userHint = 'Check your network connection, API key, and provider URL in Settings. ' +
              'If the error mentions SSL/TLS, try: (1) restart Obsidian, (2) check VPN/proxy settings, (3) verify the provider URL is correct.';
          }

          throw new Error(
            `Failed to connect to ${providerName} API (model: ${modelName}): ${errMsg}. ${userHint}`
          );
        }

        const errMsg = error instanceof Error ? error.message : String(error);
        const isTruncation = errMsg.toLowerCase().includes('truncated') || errMsg.toLowerCase().includes('max_tokens');
        if (isTruncation && halveBatchAndRetry(`[Batch ${batchNum + 1}]`, 'provider error')) {
          batchNum--;
          continue;
        }
        retryingBatch = false;
        escalateMaxTokens = false;
        console.warn(`[Batch ${batchNum + 1}] Non-first-round failure, keeping extracted items`);
        break;
      }
    }

    if (!firstBatchData && accumulation.entities.length === 0 && accumulation.concepts.length === 0) {
      return null;
    }

    // ── Programmatic related_pages matching ──────────────────────────
    // After extraction, match extracted names against existing wiki pages
    // using slug + alias matching (same logic as resolvePagePath Fast path 2).
    // Replaces the old approach of embedding ~200K chars of page list in prompt.
    const allExtractedNames = [
      ...accumulation.entities.map(e => e.name),
      ...accumulation.concepts.map(c => c.name),
    ];
    if (allExtractedNames.length > 0) {
      try {
        const existingPages = await getExistingWikiPages(this.ctx.app, this.ctx.settings.wikiFolder);
        accumulation.relatedPages = matchExtractedToExisting(allExtractedNames, existingPages);
        console.debug('[Related pages] Programmatic matching:', accumulation.relatedPages.length, 'pages matched');
      } catch (err) {
        console.warn('[Related pages] Programmatic matching failed:', err);
      }
    }

    // Hard-cap accumulation to the configured custom limits (#120).
    // The prompt instruction is a soft hint the LLM may exceed; the
    // convergence detector only stops further batches. This slice ensures
    // the user's limit is actually honoured regardless of LLM behaviour.
    if (this.ctx.settings.extractionGranularity === 'custom') {
      const eCap = this.ctx.settings.customEntityLimit ?? 5;
      const cCap = this.ctx.settings.customConceptLimit ?? 5;
      if (accumulation.entities.length > eCap) accumulation.entities = accumulation.entities.slice(0, eCap);
      if (accumulation.concepts.length > cCap) accumulation.concepts = accumulation.concepts.slice(0, cCap);
    }

    // Build final SourceAnalysis using pure function (Phase 3)
    const analysis = buildSourceAnalysis(
      file.path,
      file.basename,
      accumulation,
      firstBatchData ? {
        sourceTitle: firstBatchData.sourceTitle,
        summary: firstBatchData.summary
      } : undefined,
      // Issue #185: forward curated source-note aliases so the
      // generated sources/<slug> page can carry them.
      sourceNoteAliases
    );
    if (imageAnalysis) analysis.embedded_image_analysis = imageAnalysis.report;

    // patch 16 — lemma guarantee. The extraction prompt asks what a text
    // mentions, never what it is about, so the note's own topic is regularly
    // absent from both lists: the page a reader looks for first is the one
    // that does not get written. Runs after accumulation so it sees the final
    // lists, and fails safe — any doubt leaves the analysis untouched.
    await this.ensureSourceLemma(analysis, file.basename, sourceNoteAliases, sourceNoteTags);

    // Issue #527 — the vocabulary is a prompt hint and the schema enforces
    // nothing, so about one item in ten arrives with a type the active
    // vocabulary does not admit. Resolve that here, while the source's own
    // words are still at hand, instead of letting the page be born as a lint
    // violation that retag later decides from the page's own prose.
    await this.repairTypesAgainstVocabulary(analysis);

    console.debug('=== Iterative extraction complete ===');
    console.debug('  - Total batches:', finalBatchNum);
    console.debug('  - Entities count:', accumulation.entities.length);
    console.debug('  - Concepts count:', accumulation.concepts.length);
    console.debug('  - Deduplicated names:', accumulation.extractedNames.size);

    return analysis;
  }

  private async analyzeEmbeddedImages(markdown: string, sourcePath: string, client: LLMClient): Promise<{ evidence: string; report: EmbeddedImageAnalysisReport }> {
    const discovery = await discoverEmbeddedImages({
      markdown,
      sourcePath,
      resolveLink: (target, path) => this.ctx.app.metadataCache.getFirstLinkpathDest(target, path)?.path ?? null,
      stat: path => this.ctx.app.vault.adapter.stat(path),
    });
    const report: EmbeddedImageAnalysisReport = {
      discovered: discovery.discovered,
      queued: discovery.candidates.length,
      sent: 0,
      analyzed: 0,
      packages: 0,
      convertedGifs: 0,
      failedPackages: 0,
      skipped: [...discovery.skipped],
    };
    const evidence: Array<{ index: number; text: string }> = [];
    const packages = packageEmbeddedImages(discovery.candidates);
    const model = resolveModelForTask(this.ctx.settings, 'ingest');
    const system = await this.ctx.buildSystemPrompt('analyze');

    for (let packageIndex = 0; packageIndex < packages.length; packageIndex++) {
      const abortSignal = this.ctx.getAbortSignal?.();
      if (abortSignal?.aborted) abortSignal.throwIfAborted();
      const imagePackage = packages[packageIndex];
      const byteLength = imagePackage.reduce((total, image) => total + image.byteLength, 0);
      const parts = [];
      for (const image of imagePackage) {
        try {
          const part = await readEmbeddedImagePart(image, {
            readBinary: path => this.ctx.app.vault.adapter.readBinary(path),
            gifFirstFrame: gifFirstFrameToPng,
          });
          if (image.mediaType === 'image/gif') report.convertedGifs++;
          parts.push({ image, part });
        } catch (error) {
          report.skipped.push({ path: image.path, reason: image.mediaType === 'image/gif' ? 'gif-decode-failed' : 'missing' });
          console.warn('[embedded-images] unable to read image:', image.path, error);
        }
      }
      if (parts.length === 0) continue;
      report.packages++;
      report.sent += parts.length;
      console.debug(`[embedded-images] package ${packageIndex + 1}/${packages.length}: ${parts.length} image(s), ${byteLength} bytes`);
      const positions = parts.map(({ image }) => `Image ${image.index}: ${image.path}`).join('\n');
      try {
        const response = await client.createMessage({
          task: 'embedded-image-analysis',
          model,
          max_tokens: 3000,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: [{ type: 'text', text: `${PROMPTS.analyzeEmbeddedImages}\n\n${positions}` }, ...parts.map(({ part }) => part)] }],
          response_format: { type: 'json_object' },
          ...(abortSignal ? { abortSignal } : {}),
          ...(this.ctx.settings.disableThinking === true ? { enableThinking: false } : {}),
        });
        const parsed = EmbeddedImageEvidenceSchema.safeParse(await parseJsonResponse(response));
        if (!parsed.success) throw new Error('Embedded image analysis returned an invalid images array');
        const packageIndexes = new Set(parts.map(({ image }) => image.index));
        const analyzedIndexes = new Set<number>();
        for (const item of parsed.data.images) {
          if (!packageIndexes.has(item.index)) continue;
          const visibleText = (item.visible_text ?? '').trim();
          const description = (item.description ?? '').trim();
          if (visibleText || description) {
            evidence.push({ index: item.index, text: [visibleText && `Visible text: ${visibleText}`, description && `Description: ${description}`].filter(Boolean).join('\n') });
            analyzedIndexes.add(item.index);
          }
        }
        report.analyzed += analyzedIndexes.size;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        if (!isVisionInputRejected(error)) throw error;
        report.failedPackages++;
        console.warn('[embedded-images] provider rejected image input; text ingestion will continue:', error);
        this.ctx.onProgress?.(getText(this.ctx.settings.language, 'embeddedImagesVisionUnsupported'));
      }
    }

    const formattedEvidence = evidence.sort((a, b) => a.index - b.index).map(item => `### Image ${item.index}\n${item.text}`).join('\n\n');
    console.debug('[embedded-images] complete:', report);
    return { evidence: formattedEvidence, report };
  }

  /**
   * patch 16 — add the source note's own lemma as a candidate when the
   * extraction missed it.
   *
   * The *whether* is decided deterministically (`decideSourceLemma`). Only the
   * type choice needs the model, and it is a classification into a two-element
   * set rather than a generation. Every failure path is a no-op: a node that
   * is not created costs nothing, a wrongly created one is permanent.
   *
   * The candidate is named after the *file*, because that is what inbound
   * links in the vault point at; the analyzer's own `source_title` is folded
   * into the match keys only, so a differing model title can suppress the
   * addition but never rename the page.
   */
  private async ensureSourceLemma(
    analysis: SourceAnalysis,
    fileBasename: string,
    sourceNoteAliases: string[],
    sourceNoteTags: string[],
  ): Promise<void> {
    const decision = decideSourceLemma({
      sourceTitle: fileBasename,
      sourceAliases: sourceNoteAliases,
      entities: analysis.entities,
      concepts: analysis.concepts,
    });

    if (decision.action === 'skip') {
      console.debug(`[Lemma guarantee] no action for "${fileBasename}" (${decision.reason})`);
      return;
    }

    // The source summary is what the page would be generated from. Without it
    // there is nothing to write, so adding the candidate would only produce an
    // empty page that the stub cleaner deletes again.
    const summary = (analysis.summary || '').trim();
    if (summary.length === 0) {
      console.debug(`[Lemma guarantee] no action for "${fileBasename}" (no source summary)`);
      return;
    }

    // Honour the user's custom granularity cap (#120, #367 P0-1). The
    // extraction-phase cap slice at :602-607 already trimmed the lists;
    // re-checking here avoids both exceeding the cap and a wasted LLM call
    // on a candidate that would be immediately discarded.
    const targetIsEntity = await this.classifyLemmaType(decision.name, summary);
    if (!targetIsEntity) {
      console.debug(`[Lemma guarantee] no action for "${fileBasename}" (type undecided)`);
      return;
    }
    const capHit = this.exceedsCustomCap(analysis, targetIsEntity);
    if (capHit) {
      console.debug(`[Lemma guarantee] no action for "${fileBasename}" (custom granularity cap reached)`);
      return;
    }

    const candidate = {
      name: decision.name,
      type: this.firstActiveTag(targetIsEntity) as 'other',
      summary,
      mentions_in_source: [],
      // The note's tags are the lemma's domain proposal (see the read site);
      // engine-side validation prunes them like any model answer.
      ...(sourceNoteTags.length > 0 ? { domains: sourceNoteTags } : {}),
    };
    if (targetIsEntity === 'entity') {
      analysis.entities.push(candidate);
    } else {
      analysis.concepts.push({ ...candidate, related_concepts: [] });
    }
    console.debug(`[Lemma guarantee] added missing lemma "${decision.name}" as ${targetIsEntity}`);
  }

  /**
   * True when the lemma addition would exceed the user's configured custom
   * granularity cap for the target list. Returns false in default mode.
   */
  private exceedsCustomCap(analysis: SourceAnalysis, target: 'entity' | 'concept'): boolean {
    if (this.ctx.settings.extractionGranularity !== 'custom') return false;
    const cap = target === 'entity'
      ? (this.ctx.settings.customEntityLimit ?? 5)
      : (this.ctx.settings.customConceptLimit ?? 5);
    const list = target === 'entity' ? analysis.entities : analysis.concepts;
    return list.length >= cap;
  }

  /**
   * Pick a `type` value that survives `scanTagViolations` (`wiki/lint/scanners.ts:384`).
   * In custom tag-vocabulary mode `getActive*Tags` returns the user's CSV without
   * the built-in `'other'` literal; using `'other'` hard-coded therefore
   * manufactures a lint violation on the very page this feature just created.
   * The first active tag is always safe (and a sensible default — the page is
   * about the note's own subject, so any user-curated subtype applies).
   */
  private firstActiveTag(target: 'entity' | 'concept'): string {
    const tags = target === 'entity'
      ? getActiveEntityTags(this.ctx.settings)
      : getActiveConceptTags(this.ctx.settings);
    return tags[0] ?? 'other';
  }

  /**
   * Issue #527 — bring every extracted `type` into the active vocabulary.
   *
   * Measured on a 34-term custom vocabulary (1 555 extraction responses):
   * 88 % of items arrive with a vocabulary term, 10 % with the built-in
   * taxonomy the model knows from training (`person`, `theory`, `method` —
   * the prompt told it not to), 2 % with a near-miss spelling. Downstream the
   * value becomes `tags: [...]` on the new page, `enforceFrontmatterConstraints`
   * keeps it, `scanTagViolations` reports it, and `runRetagViolations` — hand
   * triggered — decides the final tag from 400 characters of the page's own
   * prose. The source's summary, which is what the type was extracted from,
   * never reaches that decision.
   *
   * Two steps, both fail-safe. A deterministic fold (case, diacritics) first;
   * for what the fold cannot place, one short call with the item's own summary
   * and the vocabulary — the retag question, asked at intake with the source's
   * words. Any doubt (parse failure, answer outside the vocabulary, call error)
   * leaves the item as extracted, which is exactly today's behaviour.
   */
  private async repairTypesAgainstVocabulary(analysis: SourceAnalysis): Promise<void> {
    const entityVocab = getActiveEntityTags(this.ctx.settings);
    const conceptVocab = getActiveConceptTags(this.ctx.settings);
    // The literal unions on EntityInfo/ConceptInfo predate custom
    // vocabularies; writing a vocabulary term through a string-typed view is
    // what the lemma path does too (`as 'other'` at firstActiveTag's call).
    type Typed = { name: string; type: string; summary: string };
    const work: Array<{ item: Typed; kind: 'entity' | 'concept'; vocab: string[] }> = [
      ...analysis.entities.map(e => ({ item: e, kind: 'entity' as const, vocab: entityVocab })),
      ...analysis.concepts.map(c => ({ item: c, kind: 'concept' as const, vocab: conceptVocab })),
    ];
    const pending: typeof work = [];
    for (const w of work) {
      const raw = typeof w.item.type === 'string' ? w.item.type : '';
      if (w.vocab.includes(raw)) continue;
      const folded = foldToVocabulary(raw, w.vocab);
      if (folded) {
        console.debug(`[Type repair] "${w.item.name}": ${raw} → ${folded} (fold)`);
        w.item.type = folded;
        continue;
      }
      pending.push(w);
    }
    if (pending.length === 0) return;
    await Promise.all(pending.map(async w => {
      const raw = typeof w.item.type === 'string' ? w.item.type : '';
      const repaired = await this.askTypeFromVocabulary(w.kind, w.item.name, raw, w.item.summary, w.vocab);
      if (repaired) {
        console.debug(`[Type repair] "${w.item.name}": ${raw} → ${repaired} (model)`);
        w.item.type = repaired;
      } else {
        console.debug(`[Type repair] "${w.item.name}": kept "${raw}" (no vocabulary answer)`);
      }
    }));
  }

  /**
   * One short call: which term of the active vocabulary fits this item? Null
   * on any doubt — the caller then keeps the extracted value. Mirrors
   * `classifyLemmaType` below in shape (typed-output path, same budget).
   */
  private async askTypeFromVocabulary(
    kind: 'entity' | 'concept',
    name: string,
    extractedType: string,
    summary: string,
    vocab: readonly string[],
  ): Promise<string | null> {
    const client = this.ctx.getClient();
    if (!client) return null;

    const prompt = `The extraction gave the ${kind} "${name}" the type "${extractedType}", which is not in the active tag vocabulary.

Summary of the source describing it:
${summary}

Allowed types (pick exactly one): ${vocab.join(', ')}

Respond with this JSON object and nothing else: {"type": "<one of the allowed types>"}`;

    const system = await this.ctx.buildSystemPrompt('analyze');
    try {
      const repairArgs = {
        task: 'type-repair' as const,
        model: resolveModelForTask(this.ctx.settings, 'ingest'),
        max_tokens: TOKENS_TYPE_REPAIR,
        system,
        messages: [{ role: 'user' as const, content: prompt }],
        response_format: { type: 'json_object' as const, schema: TypeRepairLLMSchema },
        ...(this.ctx.settings.disableThinking ? { enableThinking: false } : {}),
      };
      const response = await callLlm(client, repairArgs);
      const parsed = (await parseJsonResponse(response, undefined, { silentOnEmpty: true })) as { type?: unknown } | null;
      const answer = typeof parsed?.type === 'string' ? foldToVocabulary(parsed.type, vocab) : null;
      if (answer) return answer;
      console.debug(`[Type repair] unusable answer for "${name}": ${JSON.stringify(parsed)}`);
      return null;
    } catch (err) {
      console.warn('[Type repair] call failed:', err);
      return null;
    }
  }

  /**
   * Classify the missing lemma as entity or concept. Returns null on any
   * doubt — an unreadable answer, an unknown label, or a failed call — so the
   * caller skips instead of guessing a folder.
   *
   * `buildSystemPrompt('analyze')` runs outside the try: it is *our* code,
   * and a TypeError there is a programming error, not a model failure. Logging
   * the two cases distinctly keeps the skip reason truthful.
   */
  private async classifyLemmaType(name: string, summary: string): Promise<'entity' | 'concept' | null> {
    const client = this.ctx.getClient();
    if (!client) return null;

    const prompt = `A wiki page must be created for "${name}". Decide which kind it is.

entity  — a thing that exists: a substance, gene, protein, organism, product, person, organization, place.
concept — a thing that is the case: a process, mechanism, method, theory, condition, field of study.

Summary of the source describing it:
${summary}

Respond with this JSON object and nothing else: {"kind": "entity"} or {"kind": "concept"}`;

    const system = await this.ctx.buildSystemPrompt('analyze');
    try {
      // v1.26.3 PATCH Issue #443 expanded scope: typed-output path.
      // Prefer createMessageWithOutput on modern clients; falls back to
      // createMessage on legacy Anthropic / OpenAI / Codex. The schema
      // forces `{"kind": "entity|concept"}` on the wire as Tier 0
      // json_schema — LMStudio accepts, no parse-error fallback to English.
      const lemmaArgs = {
        task: 'lemma-classify' as const,
        model: resolveModelForTask(this.ctx.settings, 'ingest'),
        max_tokens: TOKENS_LEMMA_CLASSIFY,
        system,
        messages: [{ role: 'user' as const, content: prompt }],
        response_format: { type: 'json_object' as const, schema: LemmaClassifyLLMSchema },
        ...(this.ctx.settings.disableThinking ? { enableThinking: false } : {}),
      };
      const response = await callLlm(client, lemmaArgs);
      const parsed = (await parseJsonResponse(response, undefined, { silentOnEmpty: true })) as { kind?: unknown } | null;
      const kind = typeof parsed?.kind === 'string' ? parsed.kind.trim().toLowerCase() : '';
      if (kind === 'entity' || kind === 'concept') return kind;
      console.debug(`[Lemma guarantee] unusable type answer: ${JSON.stringify(parsed)}`);
      return null;
    } catch (err) {
      console.warn('[Lemma guarantee] type classification call failed:', err);
      return null;
    }
  }
}
