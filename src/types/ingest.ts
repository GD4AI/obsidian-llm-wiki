/**
 * Source analysis, the pre-ingest rejection reason, and the ingest report.
 *
 * Split out of `types.ts` by #929. Imports nothing from the barrel.
 */
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
  /** Runtime-only diagnostics for opt-in embedded image analysis. */
  embedded_image_analysis?: EmbeddedImageAnalysisReport;
}

export interface EmbeddedImageAnalysisReport {
  discovered: number;
  queued: number;
  sent: number;
  analyzed: number;
  packages: number;
  convertedGifs: number;
  failedPackages: number;
  skipped: Array<{ path: string; reason: string }>;
  evidence: EmbeddedImageEvidence[];
  evidenceSaved: boolean;
}

export interface EmbeddedImageEvidence {
  index: number;
  path: string;
  contextBefore: string;
  contextAfter: string;
  visibleText?: string;
  description?: string;
  beforeRelevance?: string;
  afterRelevance?: string;
  contextInterpretation?: string;
  status: 'analyzed' | 'no-evidence' | 'skipped' | 'failed';
  reason?: string;
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


/**
 * Why the pre-ingest gate (#164) rejected a file.
 *
 * Declared here, not in `core/source-requirements.ts`, because `IngestReport`
 * carries the reason and `core/` imports `types.ts` — the other direction was
 * the second of the two back-edges that closed the seven-file cycle (#929).
 * The gate module imports it back the normal way.
 */
export type RejectionReason = 'empty' | 'incompatible-type' | 'duplicate' | 'injection' | 'unsupported-pdf' | 'mineru-page-limit' | 'mineru-size-limit';

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
  embeddedImageAnalysis?: EmbeddedImageAnalysisReport;
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
