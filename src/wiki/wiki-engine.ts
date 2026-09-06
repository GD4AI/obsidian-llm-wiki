// Wiki Engine — Core Wiki ingestion and management logic.
// Orchestrates sub-modules: SourceAnalyzer, PageFactory, ConversationIngestor,
// LintFixer, ContradictionManager, and system-prompts.

import { App, TFile, TFolder, Notice, normalizePath } from 'obsidian';
import {
  LLMWikiSettings,
  LLMClient,
  SourceAnalysis,
  ContradictionInfo,
  IngestReport,
  IngestOptions,
  BatchRequirementsContext,
  EngineContext,
  VALID_SOURCE_TAGS,
  DEFAULT_SOURCE_TAG,
} from '../types';
import { PROMPTS } from '../prompts';
import { normalizeHeadingSpacing } from '../core/markdown-spacing';
import { getText } from '../core/i18n';
import { buildRepetitionPenaltyHint } from '../core/repetition-penalty-hint';
import { formatTaskUsage, snapshotTaskUsage, taskUsageSince } from '../core/llm-task-usage';
import { TEXTS } from '../texts';
import { renderTemplate } from '../core/template-renderer';
import { slugify } from '../core/slug';
import { shapeRelatedLists, kindOf } from '../core/related-shaping';
import { isIngestableSource } from '../core/folder-scope';
import { resolveSourceSlug } from '../core/source-slug';
import { parseFrontmatter, upsertFrontmatterField, mergeFrontmatterArrayField, extractBody } from '../core/frontmatter';
import { setGenerationComplete } from '../core/incomplete-page-cleaner';
import { convertPdfToMarkdown, UnsupportedProviderError, EncryptedPdfError } from '../core/pdf-converter';
import { MineruPdfError, MINERU_PHASE_KEY } from '../core/mineru-converter';
import { hashBody, checkContentRequirements } from '../core/source-requirements';
import { resolveModelForTask } from '../core/model-resolver';
import type { SourceRejection } from '../core/source-requirements';
// v1.25.1 Phase C-PR1: detectRateLimitFailures is invoked exclusively by runBatchedWithRetry (engine-internals/page-batch-runner.ts).
import { formatRateLimitNotice } from '../core/rate-limit';
import { extractSourceTags } from '../core/arrays';
import { buildVaultResolver } from '../core/related-link-corrector';
import { gateCandidates, applyCoverageThreshold, applyOutcomeTable, type StubCandidate } from '../core/candidate-gate';
import { buildStubIdentityResolver, createDissentStubs, stubPath } from './page-factory/stub-page';
import { selectDomains, collectActiveVocabulary } from '../core/domain-axis'; // domain axis stages 3-5 (#568)
import { getSourceLanguage, isCrossLanguage } from '../core/source-language';
import { cleanMarkdownResponse } from '../core/markdown';
import { injectMentionsSection } from '../core/mentions-injector';
import { SchemaManager, SchemaTask } from '../schema/schema-manager';
import {
  buildSystemPrompt,
  getSectionLabels,
  applySectionLabels,
} from './system-prompts';
import { getExistingWikiPages } from './lint/get-existing-pages';
import { correctRelatedLinkPrefixes, repointFolderTypedLinks } from '../core/related-link-corrector';
import { fixDeadLink } from './lint/fix-dead-link';
import { fillEmptyPage } from './lint/fill-empty-page';
import { deleteEmptyStubs } from './lint/delete-empty-stubs';
import { linkOrphanPage } from './lint/link-orphan';
import { mergeDuplicatePages } from './lint/merge-duplicates';
import { fixPollutedPage } from './lint/fix-polluted-page';
import { ContradictionManager } from './contradictions';
import { fixPollutedSources } from '../core/sources-normalizer';
// v1.25.1 Phase C-PR1: buildLogHeader moved into LogWriter.
import { UNIVERSAL_LINK_CONSTRAINTS } from './prompts/constraints';
import { SourceAnalyzer } from './source-analyzer';
import { TOKENS_PAGE_GENERATION, NOTICE_ABORT, NOTICE_RATE_LIMIT, NOTICE_NORMAL, NOTICE_SHORT, PAGES_CACHE_TTL_MS, COMPATIBLE_SOURCE_EXTENSIONS, MINERU_API_TOKEN_SECRET_ID, MINERU_CONVERSION_EXTENSIONS, MINERU_MAX_PDF_MB, MINERU_MAX_PDF_PAGES } from '../constants';
import { PageFactory } from './page-factory';
import { ConversationIngestor, ConversationOrchestration, formatConversation, ConversationHistory } from './conversation-ingest';
import type { Graph } from '../core/build-graph';
import { runBatchedWithRetry } from './engine-internals/page-batch-runner';
import { GraphCache, type GraphPageLoader } from './engine-internals/graph-cache';
import { IndexGenerator } from './engine-internals/index-generator';
import { LogWriter } from './engine-internals/log-writer';
import { dedupPages } from './engine-internals/dedup-pages';
import { localDateStamp } from '../core/format';

/**
 * Issue #173 Symptom B: drop exact-string duplicates from a page-path list
 * while preserving first-occurrence order. Used to dedup `analysis.created_pages`
 * before assembling the IngestReport so a duplicate surface-form (e.g. two
 * "intelligent-xtraction-and-processing" entries from one batch) does not
 * inflate the report count or the "Created" listing.
 *
 * v1.25.1 Phase C-PR1: re-exported from engine-internals/dedup-pages.ts.
 * WikiEngine callers see no API change.
 */
export { dedupPages } from './engine-internals/dedup-pages';

/**
 * Walk the `error.cause` chain to find the deepest meaningful message.
 *
 * v1.25.0 PR3 follow-up #6 (Bug B, e2e 2026-07-17): Vercel AI SDK v6 wraps
 * provider rejections in `AI_APICallError`, whose top-level message reads
 * `"AI_APICallError: Failed to deserialize the JSON body into the target
 * type: messages[1]: unknown variant \`file\`, expected \`text\`"`. The
 * actual provider-level rejection phrase (in this case `unknown variant
 * \`file\`, expected \`text\``) lives in `error.cause.message`. Flattening
 * to top-level loses it; inspecting only `error.message` causes the
 * classifier to miss obvious PDF-shape errors and surface a raw
 * `errorIngestFailed` toast instead of the localized PDF guidance.
 *
 * Returns the deepest provider-level message we can find, falling back to
 * the top-level message when the chain is empty or generic. Hard cap on
 * depth (4) prevents cycle-induced hangs.
 */
export function inspectCauseChain(error: unknown): string {
  const seen = new Set<unknown>();
  let current: unknown = error;
  let deepest = errorToString(current);
  for (let i = 0; i < 4; i++) {
    if (!(current instanceof Error)) break;
    const next = (current as { cause?: unknown }).cause;
    if (next === undefined || next === null || seen.has(next)) break;
    seen.add(next);
    const nextMessage = errorToString(next);
    if (nextMessage) {
      deepest = nextMessage;
    }
    current = next;
  }
  return deepest;
}

function errorToString(value: unknown): string {
  if (value instanceof Error) return value.message;
  // Use the value's own primitive stringification (boolean / number),
  // but avoid the default Object.toString "useful only for debugging" path
  // for plain objects — ES2023 doesn't expose a clean gate here, so we
  // gate on typeof and return an empty string otherwise (callers
  // tolerate empty strings and will fall back to top-level message).
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

// v1.25.1 Phase C-PR1: setsEqual moved to engine-internals/graph-cache.ts
// (private to GraphCache). Removed from wiki-engine.ts to avoid duplicate export;
// no external callers — see git grep before this change.

// Issue #496: on a source page the Mentions section IS the payload, so its
// total budget is raised above the formatter's 500-char default — the same
// default that would otherwise ellipsize exactly what this route preserves.
const SOURCE_PAGE_MENTIONS_MAX_CHARS = 2000;

export class WikiEngine {
  private app: App;
  settings: LLMWikiSettings;
  private llmClient: LLMClient | null;
  private getLLMClient: () => LLMClient | null;
  private schemaManager: SchemaManager;
  private onFileWrite: ((path: string) => void) | null;
  /** Sink for the merge triage's contradictions during one ingestSource run; null outside of one. */
  private triageContradictions: ContradictionInfo[] | null = null;
  private onProgress: ((message: string) => void) | null;
  private onDone: ((report: IngestReport) => void) | null;
  /**
   * #164: invoked when an interactive ingest hits a duplicate. Returns true to
   * re-ingest anyway, false to skip. Wired by main.ts to a confirmation modal;
   * left null for non-interactive (folder/watcher) ingest, which auto-skips.
   */
  onConfirmReingest: ((file: TFile, rejection: SourceRejection) => Promise<boolean>) | null = null;

  private contradictionManager: ContradictionManager;
  private sourceAnalyzer: SourceAnalyzer;
  private pageFactory: PageFactory;
  private conversationIngestor: ConversationIngestor;
  private abortController: AbortController | null = null;
  private lintAbortController: AbortController | null = null;
  wasCancelled = false;
  private onIngestionStart: ((filename?: string) => void) | null = null;
  private onIngestionEnd: (() => void) | null = null;
  private onLintStart: (() => void) | null = null;
  private onLintEnd: (() => void) | null = null;
  private onStatusBarUpdate: ((text: string) => void) | null = null;
  private pagesCache: Array<{path: string; title: string; wikiLink: string; aliases?: string[]}> | null = null;
  private pagesCacheTime = 0;
  private readonly PAGES_CACHE_TTL_MS = PAGES_CACHE_TTL_MS;
  // #164: ingested content-hash snapshot, cached on the same TTL/lifecycle as
  // pagesCache so back-to-back single-file ingests don't re-walk the vault.
  private ingestedHashesCache: Set<string> | null = null;
  private ingestedHashesCacheTime = 0;
  // v1.24.0 Bug A: shared graph cache for PPR — built lazily from loaded page
  // content, invalidated on every vault write via invalidatePageCaches.
  // v1.25.1 Phase C-PR1: extracted to engine-internals/graph-cache.ts;
  // WikiEngine keeps a private holder + facade methods for backward compat.
  private graphCache!: GraphCache;
  // v1.25.1 Phase C-PR1: extracted to engine-internals/index-generator.ts.
  private indexGenerator!: IndexGenerator;
  // v1.25.1 Phase C-PR1: extracted to engine-internals/log-writer.ts.
  private logWriter!: LogWriter;
  private ctx: EngineContext;
  /** SubtleCrypto from `activeWindow.crypto.subtle`. Used by PDF cache. */
  private subtle: SubtleCrypto | undefined;

  constructor(
    app: App,
    settings: LLMWikiSettings,
    getLLMClient: () => LLMClient | null,
    schemaManager: SchemaManager,
    onFileWrite?: (path: string) => void,
    onProgress?: (message: string) => void,
    onDone?: (report: IngestReport) => void,
    subtle?: SubtleCrypto
  ) {
    this.app = app;
    this.settings = settings;
    this.llmClient = null;
    this.getLLMClient = getLLMClient;
    this.schemaManager = schemaManager;
    this.onFileWrite = onFileWrite || null;
    this.onProgress = onProgress || null;
    this.onDone = onDone || null;
    this.subtle = subtle;

    const ctx: EngineContext = {
      app: this.app,
      settings: this.settings,
      getClient: () => this.getLLMClient(),
      createOrUpdateFile: (p, c) => this.createOrUpdateFile(p, c),
      deleteFile: p => this.deleteFile(p),
      tryReadFile: p => this.tryReadFile(p),
      buildSystemPrompt: task =>
        buildSystemPrompt(this.settings, t => this.schemaManager.getSchemaContext(t as SchemaTask), task),
      getSectionLabels: () => getSectionLabels(this.settings),
      getExistingWikiPages: () =>
        getExistingWikiPages(this.app, this.settings.wikiFolder),
      getSchemaContext: t => this.schemaManager.getSchemaContext(t as SchemaTask),
      ...(this.subtle ? { subtle: this.subtle } : {}),
      onFileWrite: path => this.onFileWrite?.(path),
      onContradiction: c => this.triageContradictions?.push(c),
      onProgress: msg => this.notifyProgress(msg),
      onDone: report => this.onDone?.(report),
    };

    this.ctx = ctx;

    this.contradictionManager = new ContradictionManager(ctx);
    this.sourceAnalyzer = new SourceAnalyzer(ctx);
    this.pageFactory = new PageFactory(ctx);

    const orch: ConversationOrchestration = {
      ensureWikiStructure: () => this.ensureWikiStructure(),
      apiDelay: ms => this.apiDelay(ms),
      generateIndex: () => this.generateIndexFromEngine(),
      updateLog: (op, analysis) => this.updateLog(op, analysis),
    };
    this.conversationIngestor = new ConversationIngestor(ctx, this.pageFactory, orch);

    // v1.25.1 Phase C-PR1: PPR graph cache (extracted from inline state in
    // WikiEngine). Loader resolves path-keyed reads with vault normalization.
    const graphLoader: GraphPageLoader = async (allPaths) => {
      // v1.24.1 PATCH Phase 5.5.0 hotfix fix: `allPaths` is in wiki-index format
      // (`entities/Foo`, `concepts/Bar`) — relative to the wiki folder, with NO
      // `wiki/` prefix and NO `.md` suffix. `tryReadFile` expects full vault paths
      // (`wiki/entities/Foo.md`), so normalize before reading.
      const wikiPrefix = this.settings.wikiFolder + '/';
      const readTasks = [...allPaths].map(async (path) => {
        const vaultPath = path.startsWith(wikiPrefix)
          ? path
          : `${wikiPrefix}${path}`;
        const fullPath = vaultPath.endsWith('.md') ? vaultPath : `${vaultPath}.md`;
        const content = await this.tryReadFile(fullPath);
        return { path, content: content ?? '' };
      });
      return Promise.all(readTasks);
    };
    this.graphCache = new GraphCache({ wikiFolder: this.settings.wikiFolder, loadPages: graphLoader });

    // v1.25.1 Phase C-PR1: index generator (extracted from inline state in
    // WikiEngine). Reads from app.vault via injected closures; never holds App.
    this.indexGenerator = new IndexGenerator({
      wikiFolder: this.settings.wikiFolder,
      wikiLanguage: this.settings.wikiLanguage ?? '',
      readFile: (file: TFile) => this.app.vault.read(file),
      writeFile: (path: string, content: string) => this.createOrUpdateFile(path, content),
    });

    // v1.25.1 Phase C-PR1: log writer (extracted from inline state in WikiEngine).
    // Reads/writes the wiki log.md via injected closures (tryReadFile/createOrUpdateFile).
    this.logWriter = new LogWriter({
      wikiFolder: this.settings.wikiFolder,
      wikiLanguage: this.settings.wikiLanguage ?? '',
      readFile: (path: string) => this.tryReadFile(path),
      writeFile: (path: string, content: string) => this.createOrUpdateFile(path, content),
    });
  }

  setFileWriteCallback(cb: (path: string) => void): void {
    this.onFileWrite = cb;
  }

  setProgressCallback(cb: ((message: string) => void) | null): void {
    this.onProgress = cb;
  }

  getProgressCallback(): ((message: string) => void) | null {
    return this.onProgress;
  }

  setStatusBarUpdateCallback(cb: ((text: string) => void) | null): void {
    this.onStatusBarUpdate = cb;
  }

  updateStatusBar(text: string): void {
    this.onStatusBarUpdate?.(text);
  }

  private notifyProgress(msg: string): void {
    this.onProgress?.(msg);
    this.updateStatusBar(msg);
  }

  /**
   * True iff the path falls inside the wiki's content folders (entities/concepts/sources).
   * Other files inside `wiki/` (log.md, schema/, index.md) are NOT content pages
   * and must not be stamped with `generation_complete` — that frontmatter marker
   * only applies to actual wiki entity/concept/source pages (Issue #170).
   */
  private isInWikiContentFolder(path: string, wikiFolder: string): boolean {
    return path.startsWith(`${wikiFolder}/entities/`) ||
           path.startsWith(`${wikiFolder}/concepts/`) ||
           path.startsWith(`${wikiFolder}/sources/`);
  }

  /**
   * Issue #170: stamp `generation_complete: true` on a wiki page after a
   * successful write. The pre-ingest requirement that pages carry this flag
   * is implicit — if it's missing, the page is treated as legacy (preserved).
   * This is best-effort: if re-read fails we just leave the file as-is; the
   * startup self-scan will catch any incomplete pages.
   */
  private markPageComplete(path: string): void {
    void (async () => {
      try {
        const current = await this.tryReadFile(path);
        if (!current) return;
        const flipped = setGenerationComplete(current, true);
        if (flipped === current) return;
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          await this.app.vault.process(file, () => flipped);
        }
      } catch (e) {
        console.warn(`[wiki-engine] markPageComplete failed for ${path}:`, e);
      }
    })();
  }

  setDoneCallback(cb: ((report: IngestReport) => void) | null): void {
    this.onDone = cb;
  }

  setIngestionCallbacks(onStart: ((filename?: string) => void) | null, onEnd: (() => void) | null): void {
    this.onIngestionStart = onStart;
    this.onIngestionEnd = onEnd;
  }

  setLintCallbacks(onStart: (() => void) | null, onEnd: (() => void) | null): void {
    this.onLintStart = onStart;
    this.onLintEnd = onEnd;
  }

  cancelIngestion(): void {
    if (this.abortController) {
      this.abortController.abort();
      const msg = getText(this.settings.language, 'ingestionCancelling');
      new Notice(msg, NOTICE_ABORT);
      this.onProgress?.(msg);
      console.debug('Ingestion cancellation requested');
    }
  }

  isIngesting(): boolean {
    return this.abortController !== null;
  }

  startLintOperation(): AbortSignal {
    this.lintAbortController = new AbortController();
    this.onLintStart?.();
    return this.lintAbortController.signal;
  }

  cancelLint(): void {
    if (this.lintAbortController) {
      this.lintAbortController.abort();
      const msg = getText(this.settings.language, 'ingestionCancelling');
      new Notice(msg, NOTICE_ABORT);
      console.debug('[lint] cancellation requested');
    }
  }

  isLintRunning(): boolean {
    return this.lintAbortController !== null;
  }

  endLintOperation(): void {
    if (this.lintAbortController === null) return;
    this.lintAbortController = null;
    this.onLintEnd?.();
  }

  private checkCancelled(): void {
    if (this.abortController?.signal.aborted) {
      throw new DOMException('Ingestion cancelled by user', 'AbortError');
    }
  }

  // Proxy for lint-controller to access LintFixer methods without exposing the class
  async fixPollutedPage(oldPath: string, newBasename: string): Promise<string> {
    return fixPollutedPage(this.ctx, oldPath, newBasename);
  }

  /** Issue #137: get the current LLM client. All consumers (page-factory,
   * source-analyzer, conversation-ingestor, contradictions) get their client
   * via this getter, which forwards through the shared closure `() => this.llmClient`
   * that main.ts updates via `initializeLLMClient()`. */
  private get client(): LLMClient {
    const c = this.getLLMClient();
    if (!c) throw new Error('LLM Client not initialized');
    return c;
  }

  private applySectionLabels(prompt: string): string {
    return applySectionLabels(prompt, this.settings);
  }

  /**
   * Apply new settings. Returns `true` iff `wikiFolder` changed (and the
   * path-keyed caches were therefore dropped). The return value lets
   * `main.saveSettings()` act on the same condition in one pass without
   * exposing the cache-invalidation knob.
   */
  updateSettings(settings: LLMWikiSettings): boolean {
    // Compare BEFORE assigning so a same-folder update doesn't drop the cache.
    const wikiFolderChanged = settings.wikiFolder !== this.settings.wikiFolder;
    this.settings = settings;
    this.ctx.settings = settings;
    if (wikiFolderChanged) {
      this.invalidatePageCaches();
    }
    return wikiFolderChanged;
  }

  /**
   * Build a shared dedup context for a folder/batch ingest run (#164). The
   * `ingested` snapshot reads content hashes from source-page frontmatter via the
   * (cached) metadata cache — no disk reads. Pass the same context to every
   * ingestSource call in the batch so within-batch duplicates are caught too.
   */
  createBatchContext(): BatchRequirementsContext {
    return { seen: new Set<string>(), ingested: this.buildIngestedHashes() };
  }

  /**
   * Content hashes already present in the wiki, read from source-page
   * frontmatter. Cached on the same TTL as pagesCache and invalidated on every
   * file write (via invalidatePageCaches), so a fresh ingest is always seen on
   * the next call while back-to-back rejected/skip checks reuse one snapshot.
   * The returned set is read-only to callers (only `seen` is mutated per batch).
   */
  private buildIngestedHashes(): Set<string> {
    const now = Date.now();
    if (this.ingestedHashesCache && (now - this.ingestedHashesCacheTime) < this.PAGES_CACHE_TTL_MS) {
      return this.ingestedHashesCache;
    }
    const hashes = new Set<string>();
    const prefix = normalizePath(`${this.settings.wikiFolder}/sources`) + '/';
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!f.path.startsWith(prefix)) continue;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter as { contentHash?: unknown } | undefined;
      if (typeof fm?.contentHash === 'string' && fm.contentHash) hashes.add(fm.contentHash);
    }
    this.ingestedHashesCache = hashes;
    this.ingestedHashesCacheTime = Date.now();
    return hashes;
  }

  /** Invalidate both write-dependent caches. Called after every vault write/delete. */
  private invalidatePageCaches(): void {
    this.pagesCache = null;
    this.ingestedHashesCache = null;
    this.graphCache.invalidate();
  }

  /**
   * v1.24.0 Bug A: public graph invalidation. Idempotent; drops the engine-level
   * PPR graph cache so the next query rebuilds it from current vault content.
   * Called by main.ts onIngestDoneDispatch across every open QueryView leaf.
   *
   * v1.25.1 Phase C-PR1: facade over GraphCache.invalidate().
   */
  invalidateGraph(): void {
    this.graphCache.invalidate();
  }

  /**
   * Run the source analyzer against a single source file and return the result.
   *
   * Exposed publicly for the headless ingest CLI (`tools/llm-wiki-cli/`)
   * so it can run the same extraction path as a real ingest without having to
   * reach into the engine's private `sourceAnalyzer` field via cast. The CLI
   * is the only caller; plugin code reaches the analyzer through
   * `ingestSource` as before.
   */
  async runExtractionOnly(file: TFile): Promise<SourceAnalysis | null> {
    return this.sourceAnalyzer.analyzeSource(file);
  }

  /**
   * v1.24.0: expose buildSystemPrompt so lint phases can compose their
   * `system` prompt through the shared composer (language directive + schema
   * context + active tag vocabulary) — exactly like EngineContext and the
   * fix-runners. Lint phases call this instead of raw getSchemaContext.
   */
  async buildSystemPrompt(task: SchemaTask): Promise<string | undefined> {
    return buildSystemPrompt(this.settings, t => this.schemaManager.getSchemaContext(t as SchemaTask), task);
  }

  /**
   * v1.24.0 Bug A: shared graph builder for PPR. Returns a cached Graph when
   * the requested path set is unchanged, otherwise rebuilds by reading every
   * path in `allPaths` from the vault.
   *
   * v1.25.1 Phase C-PR1: facade over GraphCache.getOrBuild().
   */
  async getOrBuildGraph(allPaths: Set<string>): Promise<Graph> {
    return this.graphCache.getOrBuild(allPaths);
  }

  /**
   * Pre-ingest requirements gate (#164). Hard rejects: empty/whitespace/
   * frontmatter-only body, and incompatible file type. Uniqueness: content-hash
   * duplicates (within the batch and already in the wiki). Returns the first
   * failing reason, or null to proceed. On proceed, records the hash in the batch
   * so a later identical file in the same run is caught.
   */
  async checkRequirements(file: TFile, content: string, batch?: BatchRequirementsContext): Promise<SourceRejection | null> {
    const contentRejection = checkContentRequirements({
      extension: file.extension,
      content,
      allowedExtensions: COMPATIBLE_SOURCE_EXTENSIONS,
    });
    if (contentRejection) return contentRejection;

    const hash = hashBody(extractBody(content));
    if (batch?.seen.has(hash)) return { reason: 'duplicate', detail: 'duplicate of another file in this batch' };
    const ingested = batch?.ingested ?? this.buildIngestedHashes();
    if (ingested.has(hash)) return { reason: 'duplicate', detail: 'content already ingested' };

    batch?.seen.add(hash);
    return null;
  }

  /**
   * Map a rejection reason to its localized Notice key.
   *
   * v1.25.0 PR2 redo: PDF provider-unsupported rejections route through
   * `sourceRejectedPdfUnsupported` (restored in 10 locales). Without this
   * mapping, users would see the generic "empty content" Notice for a PDF
   * their provider can't handle — the dedicated i18n key would be orphaned.
   */
  private rejectionNoticeKey(reason: SourceRejection['reason']): 'sourceRejectedEmpty' | 'sourceRejectedType' | 'sourceRejectedDuplicate' | 'sourceRejectedPdfUnsupported' | 'mineruPageLimitRejected' | 'mineruSizeLimitRejected' {
    if (reason === 'incompatible-type') return 'sourceRejectedType';
    if (reason === 'duplicate') return 'sourceRejectedDuplicate';
    if (reason === 'unsupported-pdf') return 'sourceRejectedPdfUnsupported';
    if (reason === 'mineru-page-limit') return 'mineruPageLimitRejected';
    if (reason === 'mineru-size-limit') return 'mineruSizeLimitRejected';
    return 'sourceRejectedEmpty';
  }

  /** Log + (interactive only) notify + report a gate skip without creating any pages. */
  private reportSkip(file: TFile, rejection: SourceRejection, opts?: IngestOptions): void {
    console.warn(`[Ingest skipped] ${file.path}: ${rejection.reason}${rejection.detail ? ` — ${rejection.detail}` : ''}`);
    // Interactive (single-file) ingest shows a Notice; folder/watcher stay quiet
    // (the batch summary / console covers them) to avoid Notice spam.
    if (opts?.interactive) {
      // {filename} is always available; rejection.params supplies extras
      // (e.g. the MinerU limit behind `{limit}`) so new rejections don't
      // need per-key plumbing here.
      const params: Record<string, string> = { filename: file.basename, ...rejection.params };
      const msg = getText(this.settings.language, this.rejectionNoticeKey(rejection.reason))
        .replace(/\{(\w+)\}/g, (match, key: string) => params[key] ?? match);
      new Notice(msg, NOTICE_NORMAL);
    }
    this.onDone?.({
      sourceFile: file.path,
      createdPages: [],
      updatedPages: [],
      entitiesCreated: 0,
      conceptsCreated: 0,
      failedItems: [],
      contradictionsFound: 0,
      success: true,
      skipped: true,
      rejectedFiles: [{ path: file.path, reason: rejection.reason, detail: rejection.detail }],
      elapsedSeconds: 0,
      // v1.22.6 #204: Propagate trigger so completion can route UI.
      trigger: opts?.trigger,
    });
  }

  /**
   * v1.25.0 PR3 follow-up #2 (P1 #3): best-effort classifier for LLM
   * errors that look like "this endpoint rejected the PDF binary".
   *
   * We don't try to be exhaustive (providers use different phrasings for
   * "I don't support PDFs": 400, 415, "file part", "mediaType", etc.).
   * The intent is to route the obvious cases — "rejected PDF", file part
   * media-type errors, or "PDF input not supported" — to the localized
   * `sourceRejectedPdfUnsupported` Notice, while transient network errors
   * and generic 5xx still bubble up to the outer ingest error path.
   */
  private isPdfRelatedLlmError(message: string): boolean {
    const lower = message.toLowerCase();
    // v1.25.0 PR3 follow-up #3 (P2): tightened — require BOTH a rejection verb
    // AND a PDF/media marker. Pre-fix version substring-matched on 'pdf' alone,
    // which misclassified 413 size-limit errors, internal 'pdf_data'
    // null-derefs, and other PDF-adjacent strings as "provider doesn't
    // support PDF", misleading users into disabling `forcePdfSupport` for
    // non-PDF issues.
    //
    // v1.25.0 PR3 follow-up #6 (Bug B, e2e 2026-07-17): added `unknown` and
    // `expected` to catch Rust-serde-style schema-reject messages from
    // OpenAI-compatible runtimes ("unknown variant `file`, expected `text`"),
    // which is the dominant shape when the LLM endpoint does not implement
    // the multipart file content schema (Ollama, vLLM, GLM, etc.).
    const hasRejectionVerb =
      lower.includes('reject') ||
      lower.includes('not support') ||
      lower.includes('unsupported') ||
      lower.includes('invalid') ||
      lower.includes('not allowed') ||
      lower.includes('unknown') ||
      lower.includes('expected');
    // v1.25.0 PR3 follow-up #6 (Bug B, e2e 2026-07-17): `file_part`,
    // `mediatype`, and the multi-word content-part phrases are still
    // preferred when present, but a single-word `file` marker is also
    // accepted as long as the rejection verb set fires. This covers the
    // dominant OpenAI-compat-Rust serde schema reject:
    //   "messages[1]: unknown variant `file`, expected `text`"
    // which has neither "pdf" nor "mediatype" — it's pure schema-tier.
    // The verb set (rejection token) is the primary gate; the marker just
    // narrows the search.
    const hasPdfMarker =
      lower.includes('pdf') ||
      lower.includes('application/pdf') ||
      lower.includes('file part') ||
      lower.includes('file_part') ||
      lower.includes('media type') ||
      lower.includes('mediatype') ||
      lower.includes('variant') ||
      lower.includes('schema') ||
      /\bfile\b/.test(lower);
    return hasRejectionVerb && hasPdfMarker;
  }

  /**
   * v1.25.0 PR2 redo + PR3: PDF ingest branch.
   *
   * Converts the PDF binary to Markdown via the configured LLM provider's
   * native PDF support (or `forcePdfSupport` for compatible providers), then
   * re-enters `ingestSource` with the converted markdown threaded via
   * `IngestOptions.contentOverride`.
   *
   * Artifact policy: the cache (`.obsidian/plugins/karpathywiki/pdf-cache/`) is
   * always the source of truth. When the user opts in via `writePdfMarkdownToVault`,
   * the converted markdown is also written to `<dir>/<basename>.pdf.md` next to
   * the source PDF. Otherwise (default, cache-only) no sidecar is written — the
   * vault contains no implementation artifacts from PDF ingestion.
   *
   * Errors are caught and surfaced via the standard `reportSkip` path so
   * the user sees a localized Notice rather than an unhandled exception.
   */
  private async ingestConversionSource(file: TFile, opts?: IngestOptions): Promise<void> {
    // Surface progress so the user knows the PDF is being read + converted.
    // A single Notice is shown, and the progress callback is updated so batch
    // ingest can reflect it in its progress bar. The main progress bar is
    // reserved for stage updates from the inner ingestSource run.
    //
    // v1.25.11 PATCH #169: the status bar carries a fine-grained stage label
    // ("Reading PDF") sandwiched between the filename and the always-visible
    // cancel affordance. ADD-only emission — the Notice still fires, the
    // onProgress callback still updates, just the status bar is now
    // informative instead of generic.
    const lang = this.settings.language;
    const pdfMsg = getText(lang, 'pdfReadingInProgress').replace('{filename}', file.basename);
    new Notice(pdfMsg, NOTICE_NORMAL);
    this.onProgress?.(pdfMsg);
    // v1.25.11 PATCH #169: the 3 PDF stages (reading / converting /
    // sidecar) all share the same status-bar composition — filename +
    // localized stage + base cancel-affordance label. Capturing the
    // invariant parts in a closure keeps the call sites one-liners.
    // The `keyof typeof TEXTS.en` constraint ensures callers can only pass
    // real i18n keys; if a future stage is added to STAGE_KEYS it is
    // automatically picked up here.
    const setPdfStage = (stageKey: keyof typeof TEXTS.en) =>
      // B2 (v1.26.3 PATCH, DocT CR): emit RAW segments (filename · stage),
      // NOT a buildIngestStatusBarText result. command-registry routes the
      // update through composeStatusBarUpdate, which appends the always-
      // visible base label ("Ingesting... click to cancel") — pre-fix this
      // emitter already embedded that label, so every PDF stage showed the
      // cancel affordance twice ("… · Ingesting… · Ingesting…"). Composition
      // now happens in exactly one place.
      this.updateStatusBar([file.basename, getText(lang, stageKey)].join(' · '));
    setPdfStage('pdfStageReading');

    let conversionResult;
    // Altitude #3: completion-signal driven by wall-clock duration, not by
    // backend identity. Below the threshold (cached hit, fast native read)
    // the path is silent; above it (MinerU's upload+wait, or a long native
    // PDF through Anthropic Vision), the user gets a Toast. Captured here
    // so the elapsed time survives the catch — a thrown conversion still
    // tells the user how long the failed attempt ran.
    const conversionStartedAt = Date.now();
    try {
      conversionResult = await convertPdfToMarkdown({
        app: this.app,
        // Narrow to the converter's settings shape so the provider gate
        // sees `forcePdfSupport` (typed, not `as never`).
        settings: {
          provider: this.settings.provider,
          apiKey: this.settings.apiKey,
          baseUrl: this.settings.baseUrl,
          model: this.settings.model,
          forcePdfSupport: this.settings.forcePdfSupport,
          markdownConversionBackend: this.settings.markdownConversionBackend,
        },
        ...(this.settings.markdownConversionBackend === 'mineru'
          ? { mineruApiToken: this.app.secretStorage.getSecret(MINERU_API_TOKEN_SECRET_ID) ?? '' }
          : {}),
        onMineruPhase: phase => {
          const key = MINERU_PHASE_KEY[phase];
          this.notifyProgress(getText(lang, key).replace('{filename}', file.basename));
        },
        pdfFile: file,
        llmClient: this.getLLMClient() as never,
        resolveModelForTask: (settings, task) =>
          resolveModelForTask(this.settings, task as 'ingest' | 'lint' | 'query'),
        ...(this.subtle ? { subtle: this.subtle } : {}),
        // v1.25.0 PR3 follow-up #8 (Bug D): thread the engine's
        // AbortSignal through to the LLM call. When the user clicks
        // the status bar during PDF conversion, cancelIngestion()
        // flips this signal aborted; AI SDK v6 propagates it to the
        // underlying HTTP request and returns early. Pre-fix the
        // signal was ignored and the LLM call ran to completion even
        // after the user clicked cancel.
        ...(this.abortController ? { abortSignal: this.abortController.signal } : {}),
      });
    } catch (error) {
      if (error instanceof UnsupportedProviderError) {
        this.reportSkip(file, { reason: 'unsupported-pdf', detail: error.message }, opts);
        return;
      }
      if (error instanceof EncryptedPdfError) {
        this.reportSkip(file, { reason: 'unsupported-pdf', detail: error.message }, opts);
        return;
      }
      if (error instanceof MineruPdfError && error.code !== undefined) {
        // Coded MinerU limit rejections (server-side page cap, client-side
        // size cap) are expected source rejections, not runtime failures —
        // route them through the standard skip pipeline: localized Notice
        // (interactive), console.warn with the raw server message, onDone
        // report so folder batches count them and continue. Uncoded
        // MineruPdfErrors (HTTP failures, timeouts, invalid URLs) keep the
        // throw semantics below.
        const isPageLimit = error.code === 'page-limit';
        this.reportSkip(file, {
          reason: isPageLimit ? 'mineru-page-limit' : 'mineru-size-limit',
          detail: error.message,
          params: { limit: String(isPageLimit ? MINERU_MAX_PDF_PAGES : MINERU_MAX_PDF_MB) },
        }, opts);
        return;
      }
      if (error instanceof MineruPdfError) {
        throw error;
      }
      // v1.25.0 PR3 follow-up #2 (P1 #3): LLM errors during PDF conversion
      // surface via the localized `sourceRejectedPdfUnsupported` Notice so the
      // user sees actionable guidance ("toggle Force PDF Support or switch
      // provider") rather than a generic ingest-error toast. The user opted
      // into a PDF-capable flow; an LLM-side rejection of the PDF binary is
      // a rejection of the source, not an unexpected runtime error.
      //
      // We still re-throw non-PDF-shaped errors (e.g. vault adapter IO
      // failures, abort signals) so the outer ingestSource can apply its
      // standard retry / log semantics.
      //
      // v1.25.0 PR3 follow-up #6 (Bug B, e2e 2026-07-17): Vercel AI SDK v6
      // wraps provider rejections in `AI_APICallError` whose top-level
      // message is `"AI_APICallError: Failed to deserialize the JSON body
      // into the target type: messages[1]: unknown variant \`file\`,
      // expected \`text\`"`. The actual provider-level rejection phrase is
      // in `error.cause.message`. inspectCauseChain() walks the chain to
      // find the deepest provider-level message; classifier then runs on
      // that. The verb set is also extended with `unknown` to capture
      // Rust-serde-style schema reject messages ("unknown variant X,
      // expected Y") which are the dominant shape from OpenAI-compatible
      // runtimes (Ollama, vLLM, etc.).
      const message = inspectCauseChain(error);
      if (this.isPdfRelatedLlmError(message)) {
        this.reportSkip(file, { reason: 'unsupported-pdf', detail: message }, opts);
        return;
      }
      throw error;
    }

    // v1.25.11 PATCH #169: status-bar mirror for the conversion stage.
    // The LLM call inside convertPdfToMarkdown doesn't have direct hooks;
    // this is fired as soon as it returns. Sidecar write below fires the
    // next stage. ADD-only emission — every prior onProgress / Notice
    // call is preserved.
    setPdfStage('pdfStageConverting');

    // v1.25.0 PR3: optional sidecar write. When the user opts in via
    // `writePdfMarkdownToVault`, persist the converted markdown next to the
    // source PDF (`<dir>/<basename>.pdf.md`). Default off → cache-only; the
    // `.obsidian` cache remains the only artifact. The write happens before
    // re-entering the standard ingest path so the sidecar reflects the exact
    // markdown fed to the analysis pipeline.
    //
    // We deliberately write via the vault adapter directly rather than
    // `createOrUpdateFile` because: (a) the sidecar is a plain copy of
    // LLM-converted markdown — no pollution detection needed; (b) writing
    // through createOrUpdateFile would fire onFileWrite + invalidatePageCaches,
    // which could trigger auto-ingest cascades if the source folder is watched.
    //
    // Efficiency #4: `sidecarPath` is computed ONLY inside the gated block.
    // The previous follow-up hoisted it out so the MinerU Notice could
    // reference it unconditionally — but the Notice only had a path to
    // print when writePdfMarkdownToVault was on, so the unconditional
    // compute was pure waste. Native short reads (cache hit, fast
    // provider) never paid the normalizePath cost.
    let sidecarPath = '';
    if (this.settings.writePdfMarkdownToVault === true) {
      const dir = file.parent?.path ?? '';
      const rawPath = dir ? `${dir}/${file.basename}.pdf.md` : `${file.basename}.pdf.md`;
      sidecarPath = normalizePath(rawPath);
      const existing = this.app.vault.getAbstractFileByPath(sidecarPath);
      // v1.25.11 PATCH #169: sidecar-write stage mirror. Fires only when
      // the user has opted in via writePdfMarkdownToVault. ADD-only
      // emission — the vault write itself is unchanged.
      setPdfStage('pdfStageSidecar');
      if (existing instanceof TFile) {
        await this.app.vault.modify(existing, conversionResult.markdown);
      } else {
        await this.app.vault.create(sidecarPath, conversionResult.markdown);
      }
    }

    // Altitude #3: duration-driven completion Notice. Below NOTICE_SHORT
    // (cached hit, fast native read) the path is silent; above it
    // (MinerU's upload+wait, or a long native PDF through Anthropic Vision)
    // the user gets a Toast that names the saved sidecar when
    // writePdfMarkdownToVault is on. Backend-agnostic — no longer gated
    // on `markdownConversionBackend === 'mineru'`. Reuses NOTICE_SHORT
    // (3s) as the trigger threshold: it matches the display duration by
    // convention (long-running conversions get a short-duration notice
    // so the user sees the result and moves on).
    const conversionElapsedMs = Date.now() - conversionStartedAt;
    if (conversionElapsedMs > NOTICE_SHORT) {
      const msgKey = sidecarPath !== ''
        ? 'markdownConversionCompleteSaved'
        : 'markdownConversionComplete';
      const tmpl = getText(this.settings.language, msgKey);
      const msg = tmpl
        .replace('{path}', sidecarPath)
        .replace('{filename}', file.basename);
      new Notice(msg, NOTICE_NORMAL);
    }

    // Re-enter the standard ingest path with the converted markdown as a
    // virtual source body. The pipeline (analyzeSource → summary → entities
    // → concepts → related → index) runs unchanged — contentOverride flows
    // through IngestOptions into analyzeSource/createSummaryPage.
    return this.ingestSource(file, { ...opts, contentOverride: conversionResult.markdown });
  }

  async ingestSource(file: TFile, opts?: IngestOptions) {
    console.debug('=== Ingestion started ===');
    console.debug('Source file:', file.path);
    if (opts?.contentOverride !== undefined) {
      console.debug('Content override length:', opts.contentOverride.length);
    }

    // v1.25.0 PR3 follow-up #7 + #8 (Bug C + D, e2e 2026-07-17): cancellation
    // setup + status bar entry MUST happen BEFORE the PDF early-return at
    // :745 — the PDF branch (ingestPdfSource) is an early return that
    // would skip every line below, including the AbortController +
    // onIngestionStart that users need to (a) see which file is currently
    // being converted and (b) cancel a long LLM call without killing
    // Obsidian. Pre-fix, the status bar stayed on the initial "LLM wiki"
    // placeholder forever and the click-to-cancel button was a no-op.
    //
    // v1.25.0 PR3 follow-up #8 (Bug D, e2e 2026-07-17): once `convertPdfToMarkdown`
    // finishes, `ingestPdfSource` re-enters `ingestSource` with `contentOverride`
    // set (line 727) — so this setup block runs TWICE per PDF ingest. Without
    // the guard below, the second invocation would overwrite `this.abortController`
    // with a fresh controller whose `signal` is NOT aborted, even if the user
    // clicked the status bar to cancel during PDF conversion. The fresh
    // controller also overwrites any in-flight cancellation signal.
    //
    // Guard: only initialize the controller if none exists yet. This keeps
    // the *original* abort signal live for both PDF and re-entered text
    // flows, so a single cancel-click propagates through both stages.
    // `onIngestionStart` is idempotent at the main.ts callback level (it
    // simply sets status bar text), so we still re-emit it for visual
    // refresh — that doesn't grow any state.
    if (this.abortController === null) {
      this.wasCancelled = false;
      this.abortController = new AbortController();
      this.onIngestionStart?.(file.basename);
    }

    // v1.25.0 PR2 redo + Altitude #1/#2 (v1.27.0 MINOR #404 follow-up):
    // markdown-conversion ingest path. The configured backend (provider's
    // native PDF handling or MinerU's online API) transcribes the source
    // file to markdown, the result is cached by content hash, then the
    // standard ingest path re-runs with the markdown as a virtual body
    // (contentOverride). No sidecar file is written by this branch — the
    // `.obsidian` cache is the sole persistent artifact unless the user
    // has explicitly opted in via `writePdfMarkdownToVault`.
    //
    // Routing:
    // - Native backend: PDF only (Anthropic Vision / OpenAI Vision's
    //   PDF handling is the established scope; their image / Office
    //   input surfaces are not exercised by this branch).
    // - MinerU backend: PDF + images (png/jpg/jpeg/jp2/webp/gif/bmp) +
    //   Office docs (doc/docx/ppt/pptx/xls/xlsx). Per the MinerU API
    //   docs, the Precise parser accepts the full set; the routing
    //   check below uses MINERU_CONVERSION_EXTENSIONS.
    //
    // Guard: only dispatch to the conversion branch when the caller has
    // NOT already provided a converted body — otherwise this would recurse
    // forever (the conversion result is fed back as contentOverride and
    // `ingestConversionSource` re-enters this method).
    if (!opts?.contentOverride) {
      const ext = file.extension.toLowerCase();
      const needsMineruConversion = this.settings.markdownConversionBackend === 'mineru'
        && (MINERU_CONVERSION_EXTENSIONS as readonly string[]).includes(ext);
      const isPdf = ext === 'pdf';
      if (needsMineruConversion || isPdf) {
        try {
          return await this.ingestConversionSource(file, opts);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          this.wasCancelled = true;
          new Notice(getText(this.settings.language, 'ingestionCancelled'), NOTICE_NORMAL);
          return;
        }
        throw error;
      } finally {
        // Successful conversion re-enters this method and clears the shared
        // controller in the main finally block. Pre-conversion exits do not.
        if (this.abortController !== null) {
          this.abortController = null;
          this.onIngestionEnd?.();
        }
      }
      }
    }

    // #164 pre-ingest requirements gate — runs BEFORE any cancellation/UI setup so
    // a rejected file returns cleanly with nothing to tear down. Empty/type are
    // hard skips; a duplicate auto-skips, except interactive ingest prompts first.
    const fileContent = opts?.contentOverride ?? await this.app.vault.read(file);
    const rejection = opts?.forceReingest ? null : await this.checkRequirements(file, fileContent, opts?.batchCtx);
    if (rejection) {
      const confirmed = rejection.reason === 'duplicate' && opts?.interactive && this.onConfirmReingest
        ? await this.onConfirmReingest(file, rejection)
        : false;
      if (!confirmed) {
        this.reportSkip(file, rejection, opts);
        return;
      }
    }

    const totalStartTime = Date.now();
    const llmUsageAtStart = snapshotTaskUsage();

    // Setup cancellation support
    // v1.25.0 PR3 follow-up #7 (Bug C): AbortController / onIngestionStart
    // already initialized above (line ~700, before PDF dispatch) so the
    // status bar is correct and cancellation is wired for both PDF and
    // text flows. We intentionally do NOT re-create the AbortController
    // here — it would create a race window where cancelIngestion() could
    // abort the *previous* instance instead of the current one.

    // Long-source warning: large files trigger iterative batch extraction
    // (multiple LLM passes), which takes significantly longer than small files.
    const LONG_SOURCE_LINE_THRESHOLD = 1000;
    const lineCount = fileContent.split('\n').length;
    if (lineCount > LONG_SOURCE_LINE_THRESHOLD) {
      const sizeKB = Math.round(fileContent.length / 1024);
      new Notice(
        getText(this.settings.language, 'longSourceNotice')
          .replace('{filename}', file.basename)
          .replace('{lines}', String(lineCount))
          .replace('{size}', sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`),
        NOTICE_NORMAL
      );
      console.debug(`[Long Source] ${file.basename}: ${lineCount} lines, ${sizeKB}KB — long ingestion expected`);
    }

    this.onProgress?.(
      getText(this.settings.language, 'ingestAnalyzing').replace('{filename}', file.basename)
    );

    const failedItems: Array<{ type: 'entity' | 'concept'; name: string; reason: string }> = [];
    let analysis: SourceAnalysis | null = null;
    // The merge triage records contradictions of its own (item-level and
    // page-level) that never appear in `analysis.contradictions` — the
    // extraction lane's list. Collect them here so the log entry and the
    // report count what was actually recorded, not only what extraction saw.
    const triageContradictions: ContradictionInfo[] = [];
    this.triageContradictions = triageContradictions;
    // Path of the summary page written in Stage 2, tracked outside the try so
    // the cancellation path can remove it — see the AbortError branch below.
    let summaryPagePath: string | null = null;

    try {
      await this.ensureWikiStructure();

      // Stage 1: Source Analysis (contentOverride flows via opts)
      const analysisStart = Date.now();
      analysis = await this.sourceAnalyzer.analyzeSource(file, {
        ...(opts?.contentOverride !== undefined ? { contentOverride: opts.contentOverride } : {}),
      });
      if (!analysis) {
        // When the user opted into a custom repetitionPenalty, append the
        // localized hint so the failure names the likely cause (see
        // repetition-penalty-hint.ts for the E2E rationale).
        throw new Error(
          `Source analysis failed for "${file.basename}". Check the developer console (Ctrl+Shift+I) for network or API errors. If you see SSL/network errors, verify your provider URL and network connection.` +
          buildRepetitionPenaltyHint(
            this.settings.language,
            this.settings.repetitionPenalty,
            this.settings.provider,
          ),
        );
      }
      const analysisTime = Date.now() - analysisStart;
      console.debug(`[Time] Source analysis phase: ${analysisTime}ms`);
      console.debug('Analysis result:', JSON.stringify(analysis, null, 2));

      this.checkCancelled();

      // Issue #514: a candidate the source only mentions gets no page. Decided
      // from the text before any page is planned — a name the note never says,
      // or says only in parentheses / enumerations / short list items, gets no
      // page and no further call; its mentions in the other candidates'
      // related_* lists go with it so the gate never manufactures a dead link.
      // Thresholds in code (candidate-gate.ts). Opt-in: it changes which pages
      // an ingest writes. Keyed on the wiki language (the names' language); a
      // note that declares a different `language:` carries translated names
      // and is not gated; a wiki language without a profile is reported, not
      // silently skipped — the user turned this on.
      const rawSource = opts?.contentOverride ?? await this.app.vault.read(file);
      const wikiLang = this.settings.wikiLanguage || 'en';
      const sourceLang = getSourceLanguage(file, this.app);
      const translated = sourceLang !== null && isCrossLanguage(sourceLang, wikiLang);

      // S135 outcome table: with `gateDissentStubs` on, the two gate halves
      // stop running in series (each with a veto) and become one decision
      // table — agreement keeps or drops as before, dissent births a stub
      // from the extraction's own summary (no LLM call). Requires the #514
      // opt-in, because the table needs the position verdict that setting
      // opts into; cross-language notes are not gated, same as below. The
      // full-page set is identical to the serial path's keep set (measured
      // over 1,153 items, three runs) — the table only converts drops.
      let stubPlan: StubCandidate[] = [];
      let tableApplied = false;
      if (
        this.settings.gateDissentStubs === true &&
        this.settings.skipMentionOnlyCandidates === true &&
        !translated
      ) {
        const pages = await getExistingWikiPages(this.app, this.settings.wikiFolder);
        const table = applyOutcomeTable(
          analysis,
          extractBody(rawSource),
          wikiLang,
          buildStubIdentityResolver(pages, this.settings.wikiFolder),
        );
        // `!table.applied` (no language profile) falls through to the serial
        // path, which reports the missing profile itself.
        if (table.applied) {
          tableApplied = true;
          const total = analysis.entities.length + analysis.concepts.length;
          if (table.dropped.length > 0) {
            const list = table.dropped.map(d => `${d.name} (${d.kind}, ${d.verdict})`).join('; ');
            console.warn(`[candidate-gate] ${file.path}: dropped ${table.dropped.length} of ${total} candidates — ${list}`);
            this.onProgress?.(`Candidate gate: ${table.dropped.length} dropped — ${list}`);
          }
          if (table.existing.length > 0) {
            const list = table.existing.map(d => `${d.name} (${d.kind}, ${d.cell})`).join('; ');
            console.debug(`[candidate-gate] ${file.path}: ${table.existing.length} dissent name(s) an existing page answers — ${list}`);
          }
          if (table.stubs.length > 0) {
            const list = table.stubs.map(s => `${s.item.name} (${s.kind}, ${s.cell})`).join('; ');
            console.warn(`[candidate-gate] ${file.path}: ${table.stubs.length} dissent stub(s) planned — ${list}`);
            this.onProgress?.(`Candidate gate: ${table.stubs.length} stub(s) from dissent — ${list}`);
          }
          analysis.entities = table.entities;
          analysis.concepts = table.concepts;
          stubPlan = table.stubs;
        }
      }

      if (!tableApplied && this.settings.skipMentionOnlyCandidates === true) {
        if (!translated) {
          // A dropped name the vault already has a page for keeps its edge:
          // the gate judges whether this note earns the page, not whether a
          // page another note earned may be linked. Same resolver as the
          // related-link corrector, so "known" means the same thing at both
          // ends of the pipeline.
          const resolve = buildVaultResolver({ wikiFolder: this.settings.wikiFolder, pages: await this.getExistingWikiPages() });
          const gated = gateCandidates(
            analysis,
            extractBody(rawSource),
            wikiLang,
            name => resolve(name) !== undefined,
          );
          if (!gated.applied) {
            console.debug(`[candidate-gate] ${file.path}: no language profile for "${wikiLang}" — gate not applied`);
            this.onProgress?.(`Candidate gate: no language profile for "${wikiLang}" — not applied`);
          } else if (gated.dropped.length > 0) {
            const list = gated.dropped.map(d => `${d.name} (${d.kind}, ${d.verdict})`).join('; ');
            const kept = gated.linkedAnyway.length > 0 ? ` — linked anyway (existing page): ${gated.linkedAnyway.join('; ')}` : '';
            console.warn(`[candidate-gate] ${file.path}: dropped ${gated.dropped.length} of ${analysis.entities.length + analysis.concepts.length} candidates — ${list}${kept}`);
            this.onProgress?.(`Candidate gate: ${gated.dropped.length} dropped — ${list}${kept}`);
            analysis.entities = gated.entities;
            analysis.concepts = gated.concepts;
          }
        }
      }

      // domain axis stage 3 (#568): the semantic half follows on the
      // survivors — the extraction reported per candidate how the source treats
      // it (`coverage`), the threshold in candidate-gate.ts says what is enough;
      // a missing value keeps the candidate. Then the per-item domain subset
      // is validated against the vault's tag vocabulary: a value no note
      // carries is dropped (logged), not written. Runs regardless of the #521
      // opt-in — the deterministic gate is upstream's setting, this half is
      // the local domain-axis design. Under the outcome table the threshold
      // has already been folded into the routing, so only the domain
      // validation runs — over the survivors AND the planned stubs, whose
      // frontmatter carries the same validated subset.
      let domainVocabulary: string[] = [];
      {
        if (!tableApplied) {
          // #620 parity: a dropped name the vault already has a page for keeps
          // its edge in the survivors' related_* lists. Without the predicate
          // behaviour is unchanged. (The author's own link markup is folded
          // into applyCoverageThreshold's own sourceText path — see candidate-gate.ts.)
          const coverageResolve = buildVaultResolver({ wikiFolder: this.settings.wikiFolder, pages: await this.getExistingWikiPages() });
          const covered = applyCoverageThreshold(
            analysis,
            extractBody(rawSource),
            name => coverageResolve(name) !== undefined,
          );
          if (covered.dropped.length > 0) {
            const list = covered.dropped.map(d => `${d.name} (${d.kind}, ${d.verdict})`).join('; ');
            const kept = covered.linkedAnyway.length > 0 ? ` — linked anyway (existing page): ${covered.linkedAnyway.join('; ')}` : '';
            console.warn(`[candidate-gate] ${file.path}: dropped ${covered.dropped.length} of ${analysis.entities.length + analysis.concepts.length} candidates — ${list}${kept}`);
            this.onProgress?.(`Candidate gate: ${covered.dropped.length} dropped — ${list}${kept}`);
            analysis.entities = covered.entities;
            analysis.concepts = covered.concepts;
          }
        }
        // Stage 5 (#568): validation accepts exactly what the declared source
        // folders and the wiki's own pages carry — new values are born by
        // tagging a note or a page, not by editing a settings list.
        domainVocabulary = collectActiveVocabulary(this.app, this.settings);
        for (const item of [...analysis.entities, ...analysis.concepts, ...stubPlan.map(s => s.item)]) {
          const selection = selectDomains(item.domains, domainVocabulary);
          if (selection.rejected.length > 0) {
            console.debug(`[domain-axis] ${file.path}: "${item.name}" — dropped ${selection.rejected.length} value(s) the vocabulary does not carry: ${selection.rejected.join(', ')}`);
          }
          if (selection.kept.length > 0) item.domains = selection.kept;
          else delete item.domains;
        }
      }

      // Every page born from this note links its siblings, a related name
      // the vault answers is written under the page's own title and kind,
      // and a name nothing answers stays as written and is counted.
      // Deterministic, no model call; see core/related-shaping.ts.
      {
        const pages = await this.getExistingWikiPages();
        const resolvePath = buildVaultResolver({ wikiFolder: this.settings.wikiFolder, pages });
        const prefix = this.settings.wikiFolder + '/';
        const titleByRel = new Map(pages.map(p => [p.path.slice(prefix.length).replace(/\.md$/, ''), p.title]));
        const folders = (this.settings.watchedFolders ?? []).map(w => w.trim()).filter(Boolean);
        const configDir = this.app.vault.configDir;
        const noteTitles = folders.length === 0 ? [] : this.app.vault.getMarkdownFiles()
          .filter(f => folders.some(w => isIngestableSource(f.path, w, false, this.settings.wikiFolder, configDir)))
          .map(f => f.basename);
        const shaped = shapeRelatedLists(analysis, {
          resolve: name => {
            const rel = resolvePath(name);
            if (!rel) return undefined;
            return { title: titleByRel.get(rel) ?? name, kind: kindOf(rel) };
          },
          willExist: [...noteTitles, ...stubPlan.map(s => s.item.name)],
          vocabulary: domainVocabulary,
        });
        analysis.entities = shaped.entities;
        analysis.concepts = shaped.concepts;
        if (shaped.unanswered.length > 0 || shaped.siblings > 0 || shaped.tags.length > 0) {
          const list = shaped.unanswered.map(d => `${d.name} (on ${d.on})`).join('; ');
          const tagList = shaped.tags.map(d => `${d.name} (on ${d.on})`).join('; ');
          console.debug(`[related-shape] ${file.path}: ${shaped.siblings} sibling edge(s) added; ${shaped.unanswered.length} related name(s) nothing answers yet${list ? ` — ${list}` : ''}; ${shaped.tags.length} tag value(s) dropped${tagList ? ` — ${tagList}` : ''}`);
          this.onProgress?.(`Related lists: ${shaped.siblings} sibling edges, ${shaped.unanswered.length} unanswered names, ${shaped.tags.length} tag values dropped`);
        }
      }

      const totalSteps = 1 + analysis.entities.length + analysis.concepts.length + analysis.related_pages.length + 2;
      let step = 1;

      const plannedPaths: string[] = [];
      const preserveCase = this.settings.slugCase === 'preserve';
      for (const entity of analysis.entities) {
        plannedPaths.push(normalizePath(`${this.settings.wikiFolder}/entities/${slugify(entity.name, preserveCase)}.md`));
      }
      for (const concept of analysis.concepts) {
        plannedPaths.push(normalizePath(`${this.settings.wikiFolder}/concepts/${slugify(concept.name, preserveCase)}.md`));
      }
      // S135: stub pages will exist too — planned like any page, so links
      // the summary makes to their names land on the canonical path.
      for (const stub of stubPlan) {
        plannedPaths.push(stubPath({ wikiFolder: this.settings.wikiFolder, preserveCase, normalizePath }, stub));
      }

      this.onProgress?.(
        getText(this.settings.language, 'ingestCreatingSummary')
          .replace('{step}', String(step))
          .replace('{totalSteps}', String(totalSteps))
      );
      await this.apiDelay();

      // Issue #155: derive the source slug (<basename>-<path fingerprint>) ONCE,
      // before any page is written, so the summary page, entity/concept backlinks,
      // and related pages all reference the same canonical [[sources/<slug>]].
      const sourceSlug = resolveSourceSlug(file.path, { preserveCase });

      // S135: birth the dissent stubs — deterministic writes, no LLM call,
      // before any generation so every page produced this run can already
      // link to them. A path that exists is a slug collision and is skipped,
      // never overwritten (identity was resolved against titles + aliases).
      if (stubPlan.length > 0) {
        const stubResult = await createDissentStubs(
          {
            wikiFolder: this.settings.wikiFolder,
            preserveCase,
            normalizePath,
            fileExists: (p) => this.app.vault.getAbstractFileByPath(p) !== null,
            createOrUpdateFile: (p, c) => this.createOrUpdateFile(p, c),
            // S142: the stub's identity tag faces the harvest like every
            // other writer's tags (the domains were validated above).
            vocabulary: collectActiveVocabulary(this.app, this.settings),
          },
          stubPlan,
          sourceSlug,
        );
        analysis.created_pages.push(...stubResult.created);
        if (stubResult.skipped.length > 0) {
          console.warn(`[candidate-gate] ${file.path}: ${stubResult.skipped.length} stub(s) skipped (slug already occupied) — ${stubResult.skipped.join('; ')}`);
        }
        if (stubResult.created.length > 0) {
          console.debug(`[candidate-gate] ${file.path}: ${stubResult.created.length} dissent stub(s) written — ${stubResult.created.join('; ')}`);
        }
      }

      // Stage 2: Summary Page Generation (contentOverride flows through opts)
      const summaryStart = Date.now();
      const summaryPage = await this.createSummaryPage(file, analysis, plannedPaths, sourceSlug, opts?.contentOverride);
      const summaryTime = Date.now() - summaryStart;
      console.debug(`[Time] Summary page generation: ${summaryTime}ms`);
      analysis.created_pages.push(summaryPage);
      summaryPagePath = summaryPage;

      // Stage 3: Entity/Concept Page Generation
      // v1.25.1 Phase C-PR1: retry + rate-limit template extracted to
      // engine-internals/page-batch-runner.ts (eliminates ~60% duplication
      // with Stage 4 and makes the retry path unit-testable).
      const pageGenStart = Date.now();
      let pageGenCount = 0;

      const concurrency = this.settings.pageGenerationConcurrency ?? 1;
      const batchDelay = this.settings.batchDelayMs ?? 300;

      if (concurrency > 1) {
        console.debug(`[Parallel] concurrency: ${concurrency}, batch delay: ${batchDelay}ms, total tasks: ${analysis.entities.length + analysis.concepts.length}`);
      } else {
        console.debug(`[Serial] generating pages sequentially, total tasks: ${analysis.entities.length + analysis.concepts.length}`);
      }

      const pageGenTasks = [
        ...analysis.entities.map((e, i) => ({
          id: `entity:${e.name}`,
          payload: { type: 'entity' as const, name: e.name, index: i },
        })),
        ...analysis.concepts.map((c, i) => ({
          id: `concept:${c.name}`,
          payload: { type: 'concept' as const, name: c.name, index: i },
        })),
      ];

      const pageGenResult = await runBatchedWithRetry<typeof pageGenTasks[number]['payload']>({
        tasks: pageGenTasks,
        concurrency,
        batchDelayMs: batchDelay,
        checkCancelled: () => this.checkCancelled(),
        apiDelay: (ms: number) => this.apiDelay(ms),
        onProgress: (_id) => {
          step++;
          const task = pageGenTasks[step - 1]?.payload;
          if (task) {
            this.onProgress?.(
              getText(this.settings.language, 'ingestCreatingItem')
                .replace('{step}', String(step))
                .replace('{totalSteps}', String(totalSteps))
                .replace('{type}', getText(
                  this.settings.language,
                  task.type === 'entity' ? 'ingestItemTypeEntity' : 'ingestItemTypeConcept'
                ))
                .replace('{name}', task.name)
            );
          }
        },
        execute: async (task) => {
          if (task.type === 'entity') {
            const entity = analysis!.entities[task.index];
            try {
              const entityResult = await this.pageFactory.createOrUpdateEntityPage(entity, analysis!, file, [], sourceSlug);
              if (entityResult.path) {
                (entityResult.created ? analysis!.created_pages : analysis!.updated_pages)
                  .push(entityResult.path);
              }
              return { success: true as const };
            } catch (error) {
              const reason = error instanceof Error ? error.message : String(error);
              console.error(`Entity "${entity.name}" failed:`, reason);
              return { success: false as const, failureReason: reason };
            }
          }
          const concept = analysis!.concepts[task.index];
          try {
            const conceptResult = await this.pageFactory.createOrUpdateConceptPage(concept, analysis!, file, [], sourceSlug);
            if (conceptResult.path) {
              (conceptResult.created ? analysis!.created_pages : analysis!.updated_pages)
                .push(conceptResult.path);
            }
            return { success: true as const };
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.error(`Concept "${concept.name}" failed:`, reason);
            return { success: false as const, failureReason: reason };
          }
        },
      });

      // Sync state out of the runner result (runner doesn't own our analysis state).
      pageGenCount = pageGenResult.succeeded + pageGenResult.failed.length;
      for (const f of pageGenResult.failed) {
        const isEntity = f.id.startsWith('entity:');
        failedItems.push({
          type: isEntity ? 'entity' : 'concept',
          name: f.id.split(':')[1] ?? f.id,
          reason: f.reason,
        });
      }
      if (pageGenResult.rateLimitInfo) {
        console.warn(
          `[Rate Limit] Page generation: ${pageGenResult.rateLimitInfo.count} item(s) failed with 429, ` +
          `suggested concurrency=${pageGenResult.rateLimitInfo.suggestedConcurrency}, ` +
          `delay=${pageGenResult.rateLimitInfo.suggestedDelay}ms`
        );
        new Notice(
          formatRateLimitNotice(pageGenResult.rateLimitInfo, this.settings.language),
          NOTICE_RATE_LIMIT
        );
      }
      const pageGenTime = Date.now() - pageGenStart;
      console.debug(`[Time] Page generation phase complete: ${pageGenTime}ms (avg ${pageGenCount > 0 ? Math.round(pageGenTime / pageGenCount) : 0}ms/page)`);

      // Stage 4: Related Pages Update (same runner, different execute fn)
      const relatedStart = Date.now();
      const relatedConcurrency = this.settings.pageGenerationConcurrency ?? 1;
      const relatedDelay = this.settings.batchDelayMs ?? 300;

      const relatedTasks = analysis.related_pages.map((name, idx) => ({
        id: `related:${name}`,
        payload: { name, index: idx, stepNum: step + idx + 1 },
      }));

      const relatedResult = await runBatchedWithRetry<typeof relatedTasks[number]['payload']>({
        tasks: relatedTasks,
        concurrency: relatedConcurrency,
        batchDelayMs: relatedDelay,
        checkCancelled: () => this.checkCancelled(),
        apiDelay: (ms: number) => this.apiDelay(ms),
        onProgress: (id) => {
          const task = relatedTasks.find(t => t.id === id);
          if (task) {
            this.onProgress?.(
              getText(this.settings.language, 'ingestUpdating')
                .replace('{step}', String(task.payload.stepNum))
                .replace('{totalSteps}', String(totalSteps))
                .replace('{name}', task.payload.name)
            );
          }
        },
        execute: async (task) => {
          try {
            const updated = await this.pageFactory.updateRelatedPage(task.name, analysis!, file, sourceSlug);
            if (updated) {
              analysis!.updated_pages.push(task.name);
            }
            return { success: true as const };
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.error(`Related page "${task.name}" update failed:`, reason);
            return { success: false as const, failureReason: reason };
          }
        },
      });

      const relatedCount = relatedResult.succeeded;
      const relatedTotal = relatedTasks.length;
      const relatedTime = Date.now() - relatedStart;
      const relatedModeLabel = relatedConcurrency > 1 ? `parallel(concurrency:${relatedConcurrency})` : 'serial';
      console.debug(
        `[Time] Related page update phase complete: ${relatedTime}ms ` +
        `(${relatedModeLabel}, ${relatedCount}/${relatedTotal} pages succeeded)`
      );
      step += relatedTotal;

      if (relatedResult.rateLimitInfo) {
        console.warn(
          `[Rate Limit] Related pages update: ${relatedResult.rateLimitInfo.count} item(s) failed with 429, ` +
          `suggested concurrency=${relatedResult.rateLimitInfo.suggestedConcurrency}, ` +
          `delay=${relatedResult.rateLimitInfo.suggestedDelay}ms`
        );
        new Notice(
          formatRateLimitNotice(relatedResult.rateLimitInfo, this.settings.language),
          NOTICE_RATE_LIMIT
        );
      }

      // Stage 5: Contradiction Recording
      // Stage 4.5: re-point folder-typed links on every page this run wrote.
      // A page written early in the run links to a sibling that does not
      // exist yet; the write-time corrector then trusts the extraction's
      // folder, and the sibling may land in the other one (the folder is
      // decided at dedup, #589). Only now does the vault know. Measured:
      // 35 of 314 folder-wrong links sat in Related sections of pages
      // whose target was born in the same run.
      const repointStart = Date.now();
      await this.repointLinksAfterRun([...analysis.created_pages, ...analysis.updated_pages]);
      console.debug(`[Time] Link re-point pass: ${Date.now() - repointStart}ms`);

      const contradictionStart = Date.now();
      for (const contradiction of analysis.contradictions) {
        try {
          await this.noteContradiction(contradiction, file.path);
        } catch {
          // non-critical
        }
      }
      const contradictionTime = Date.now() - contradictionStart;
      console.debug(`[Time] Contradiction recording phase: ${contradictionTime}ms (${analysis.contradictions.length} items)`);

      // Stage 6: Index & Log Update
      const indexStart = Date.now();
      step++;
      this.onProgress?.(
        getText(this.settings.language, 'ingestGeneratingIndex')
          .replace('{step}', String(step))
          .replace('{totalSteps}', String(totalSteps))
      );
      await this.generateIndexFromEngine();
      // Compute total elapsed wall time + source bytes BEFORE updateLog so the
      // log entry can record both (issue #122 v3.1: ingest history needs timing).
      const totalTime = Date.now() - totalStartTime;
      const sourceSize = fileContent?.length ?? 0;
      // Both lanes, one count: extraction (Stage 5 above) and merge triage.
      const contradictionsRecorded = [...analysis.contradictions, ...triageContradictions];
      await this.updateLog('ingest', { ...analysis, contradictions: contradictionsRecorded }, {
        durationSec: Math.round(totalTime / 1000),
        model: this.settings.model,
        sourceBytes: sourceSize,
      });
      const indexTime = Date.now() - indexStart;
      console.debug(`[Time] Index Index & log update: ${indexTime}ms`);

      const updated = analysis.updated_pages.length;
      // Issue #173 Symptom B: dedup before counting/listing — a duplicated
      // surface-form (e.g. the LLM emitting the same path twice) must not
      // inflate the report count or the "Created" listing.
      const dedupedCreatedPages = dedupPages(analysis.created_pages);
      const entitiesCreated = dedupedCreatedPages.filter(p => p.includes('/entities/')).length;
      const conceptsCreated = dedupedCreatedPages.filter(p => p.includes('/concepts/')).length;
      const modeLabel = (this.settings.pageGenerationConcurrency ?? 1) > 1 ? `parallel(concurrency:${this.settings.pageGenerationConcurrency})` : 'serial';
      // totalTime was computed above; do not redeclare here.

      console.debug('=== Ingestion complete ===');
      console.debug(`Ingestion complete [${modeLabel}]: Created ${dedupedCreatedPages.length} pages (${entitiesCreated} entities + ${conceptsCreated} concepts), Updated ${updated} pages`);
      console.debug(`[Total time] ${totalTime}ms (${Math.round(totalTime/1000)}s)`);
      console.debug('[Phase breakdown]:');
      console.debug(`  - Source analysis: ${analysisTime}ms`);
      console.debug(`  - Summary page generation: ${summaryTime}ms`);
      console.debug(`  - Page gen (${concurrency}concurrency): ${pageGenTime}ms`);
      console.debug(`  - Related page update: ${relatedTime}ms`);
      console.debug(`  - Contradiction recording: ${contradictionTime}ms`);
      console.debug(`  - Index & log: ${indexTime}ms`);
      // Inside the phases, per step. Page generation is the phase this exists
      // for: one interval above, four steps below it — path resolution's dedup
      // call, the page write, the merge triage and the body merge.
      const llmByTask = formatTaskUsage(taskUsageSince(llmUsageAtStart));
      if (llmByTask.length > 0) {
        console.debug('[LLM time by step] (summed per call; concurrent steps overlap)');
        for (const line of llmByTask) console.debug(line);
      }

      this.onDone?.({
        sourceFile: file.path,
        createdPages: dedupedCreatedPages,
        updatedPages: analysis.updated_pages,
        entitiesCreated,
        conceptsCreated,
        failedItems,
        contradictionsFound: contradictionsRecorded.length,
        success: true,
        elapsedSeconds: Math.round(totalTime / 1000),
        // v1.22.6 #204: Propagate trigger so completion can route UI.
        trigger: opts?.trigger,
      });

    } catch (error) {
      const createdPages = dedupPages(analysis?.created_pages || []);

      if (error instanceof DOMException && error.name === 'AbortError') {
        this.wasCancelled = true;
        console.debug('=== Ingestion cancelled by user ===');

        // A cancelled ingest must not read as a completed one: the summary
        // page doubles as the completion marker (isAlreadyIngested checks its
        // existence), so leaving it behind freezes the half-finished ingest as
        // done and every later trigger skips the source. Trash it — the next
        // trigger then re-ingests cleanly. Content pages stay: a re-ingest
        // merges them additively.
        if (summaryPagePath) {
          try {
            await this.deleteFile(summaryPagePath);
            console.debug('Cancelled ingest: removed summary page so the source re-ingests:', summaryPagePath);
          } catch (cleanupError) {
            console.warn('Cancelled ingest: could not remove summary page:', summaryPagePath, cleanupError);
          }
        }
        const reportedCreated = createdPages.filter(p => p !== summaryPagePath);

        new Notice(getText(this.settings.language, 'ingestionCancelled'), NOTICE_NORMAL);
        this.onDone?.({
          sourceFile: file.path,
          createdPages: reportedCreated,
          updatedPages: analysis?.updated_pages || [],
          entitiesCreated: reportedCreated.filter(p => p.includes('/entities/')).length,
          conceptsCreated: reportedCreated.filter(p => p.includes('/concepts/')).length,
          failedItems,
          contradictionsFound: (analysis?.contradictions?.length || 0) + triageContradictions.length,
          success: false,
          cancelled: true,
          errorMessage: 'Cancelled by user',
          elapsedSeconds: Math.round((Date.now() - totalStartTime) / 1000),
          // v1.22.6 #204: Propagate trigger so completion can route UI.
          trigger: opts?.trigger,
        });
        return;
      }

      console.error('=== Ingestion failed ===');
      console.error('Error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.onDone?.({
        sourceFile: file.path,
        createdPages,
        updatedPages: analysis?.updated_pages || [],
        entitiesCreated: createdPages.filter(p => p.includes('/entities/')).length,
        conceptsCreated: createdPages.filter(p => p.includes('/concepts/')).length,
        failedItems,
        contradictionsFound: (analysis?.contradictions?.length || 0) + triageContradictions.length,
        success: false,
        errorMessage: errorMsg,
        elapsedSeconds: Math.round((Date.now() - totalStartTime) / 1000),
        // v1.22.6 #204: Propagate trigger so completion can route UI.
        trigger: opts?.trigger,
      });
      throw error;
    } finally {
      this.triageContradictions = null;
      this.abortController = null;
      this.onIngestionEnd?.();
    }
  }

  private async apiDelay(ms?: number): Promise<void> {
    await new Promise(resolve => window.setTimeout(resolve, ms || 300));
  }

  async ensureWikiStructure() {
    const folders = [
      normalizePath(this.settings.wikiFolder),
      normalizePath(`${this.settings.wikiFolder}/entities`),
      normalizePath(`${this.settings.wikiFolder}/concepts`),
      normalizePath(`${this.settings.wikiFolder}/sources`)
    ];
    for (const folder of folders) {
      try {
        await this.app.vault.createFolder(folder);
        console.debug('Creating folder:', folder);
      } catch {
        // Folder already exists
      }
    }

    await this.schemaManager.ensureSchemaExists();
  }

  /**
   * End-of-run link pass. Deterministic, no model: every folder-typed link on
   * the pages this run wrote is resolved against the pages this run wrote —
   * that is the whole class. A target that existed before the run was
   * resolvable at write time already; only a sibling born later in the same
   * run was not, so the index is built from the run's own pages (title from
   * the file name, aliases from the frontmatter), one read per page, and
   * never from a vault-wide scan. Pages that come out byte-identical are not
   * rewritten, and a `reviewed: true` page is not touched at all — its body
   * is locked for every writer (K: reviewed = hands off), this pass included;
   * it still lends its title and aliases to the index. A failure on one page
   * is logged and never fails the ingest or the pass for the other pages —
   * the pages are already on disk.
   */
  async repointLinksAfterRun(pagePaths: string[]): Promise<{ pages: number; links: number }> {
    const paths = [...new Set(pagePaths)].filter(p => p.endsWith('.md'));
    const result = { pages: 0, links: 0 };
    if (paths.length === 0) return result;
    const contents = new Map<string, string>();
    for (const path of paths) {
      try {
        const content = await this.tryReadFile(path);
        if (content) contents.set(path, content);
      } catch (error) {
        console.warn(`[link-repoint] could not read ${path}, left as written:`, error);
      }
    }
    const runIndex = {
      wikiFolder: this.settings.wikiFolder,
      pages: [...contents].map(([path, content]) => {
        const fm = parseFrontmatter(content);
        return {
          path,
          title: (path.split('/').pop() ?? path).replace(/\.md$/, ''),
          aliases: Array.isArray(fm?.aliases) ? fm.aliases : undefined,
        };
      }),
    };
    for (const [path, content] of contents) {
      if (parseFrontmatter(content)?.reviewed === true) continue;
      const { content: repointed, moved } = repointFolderTypedLinks(content, runIndex);
      if (moved === 0 || repointed === content) continue;
      try {
        await this.createOrUpdateFile(path, repointed);
        result.pages++;
        result.links += moved;
      } catch (error) {
        console.warn(`[link-repoint] could not write ${path}, left as written:`, error);
      }
    }
    if (result.links > 0) {
      console.debug(`[link-repoint] ${result.links} link(s) on ${result.pages} page(s) re-pointed to where the target landed`);
    }
    return result;
  }

  async createSummaryPage(file: TFile, analysis: SourceAnalysis, plannedPaths: string[] = [], sourceSlug?: string, contentOverride?: string): Promise<string> {
    const preserveCase = this.settings.slugCase === 'preserve';
    const slug = sourceSlug ?? slugify(file.basename, preserveCase);
    const path = normalizePath(`${this.settings.wikiFolder}/sources/${slug}.md`);
    // PDF branch: use the LLM-converted markdown instead of reading raw PDF
    // bytes (which would be garbage text). Text branch: unchanged.
    const content = contentOverride ?? await this.app.vault.read(file);

    // Issue #114: if the source page already exists with manually-set tags,
    // preserve them — re-ingesting a note must not overwrite corrections.
    // Priority: existing source-page tags > source-note tags > LLM concept names.
    const existingSource = await this.tryReadFile(path);
    const existingFm = existingSource ? parseFrontmatter(existingSource) : null;
    const existingTags = Array.isArray(existingFm?.tags) && existingFm.tags.length > 0
      ? existingFm.tags
      : null;

    // Issue #90: inherit tags from source note frontmatter when available,
    // so the generated summary page doesn't pollute the tag vocabulary with
    // LLM-derived concept names. Source pages use the closed VALID_SOURCE_TAGS
    // taxonomy, so inherited tags are filtered to it and the documented default
    // is the last resort — concept names are not a legal value here.
    const sourceTags = extractSourceTags(content).filter(t =>
      (VALID_SOURCE_TAGS as readonly string[]).includes(t)
    );
    const tagsValue = existingTags
      ? existingTags.join(', ')
      : sourceTags.length > 0
        ? sourceTags.join(', ')
        : DEFAULT_SOURCE_TAG;

    const createdPagesList = plannedPaths.length > 0
      ? plannedPaths.map(p => {
          const relPath = p.replace(this.settings.wikiFolder + '/', '').replace('.md', '');
          const name = relPath.split('/').pop() || relPath;
          return `- [[${relPath}|${name}]]`;
        }).join('\n')
      : analysis.entities.map(e => `- [[entities/${slugify(e.name, preserveCase)}|${e.name}]]`).join('\n') +
        '\n' +
        analysis.concepts.map(c => `- [[concepts/${slugify(c.name, preserveCase)}|${c.name}]]`).join('\n');

    const prompt = renderTemplate(PROMPTS.generateSummaryPage, {
      source_title: analysis.source_title,
      content: content.substring(0, 500),
      analysis: JSON.stringify(analysis),
      created_pages_list: createdPagesList || '(none)',
      source_file: file.path,
      date: localDateStamp(),
      tags: tagsValue,
      constraints: UNIVERSAL_LINK_CONSTRAINTS,
    });

    const finalPrompt = this.applySectionLabels(prompt);

    const pageContent = await this.client.createMessage({
      task: 'source-page',
      model: resolveModelForTask(this.settings, 'ingest'),
      max_tokens: TOKENS_PAGE_GENERATION,
      system: await this.buildSystemPrompt('summary'),
      messages: [{ role: 'user', content: finalPrompt }],
      ...(this.settings.disableThinking ? { enableThinking: false } : {}),
    });

    const cleanedContent = cleanMarkdownResponse(pageContent);
    // #164: stamp a content fingerprint so future ingests can detect duplicates.
    // Injected programmatically — the LLM can't be trusted to emit it.
    let finalContent = upsertFrontmatterField(cleanedContent, 'contentHash', hashBody(extractBody(content)));

    // Issue #185: append the source note's curated frontmatter `aliases:`
    // to the generated `sources/<slug>` page. Merged inline (BEFORE the
    // write) so the page lands complete on disk in one `createOrUpdateFile`
    // call — no partial-write window. Downstream `fix-dead-link`
    // (slugify-normalized cross-page alias match at lint/scanners.ts:150 +
    // fix-dead-link.ts:237) consumes this pool to retarget dead links
    // written with inflection variants — a German "Exekutiven Funktionen"
    // link in body text resolves to the canonical page via this alias.
    //
    // `mergeFrontmatterArrayField` short-circuits when the additions are
    // already present (frontmatter.ts:211), so the `!==` check below is
    // purely an observability gate.
    if (analysis.source_note_aliases?.length) {
      const withAliases = mergeFrontmatterArrayField(finalContent, 'aliases', analysis.source_note_aliases);
      if (withAliases !== finalContent) {
        console.debug(
          `[Issue #185] Propagated ${analysis.source_note_aliases.length} alias(es) to ${path}`
        );
        finalContent = withAliases;
      }
    }

    // Issue #496 (Cause 2): the source page's Mentions section comes from
    // what extraction already captured over the FULL source text — not from
    // a model that only ever saw content.substring(0, 500). Same programmatic
    // route as entity pages (#244); with nothing captured the injector also
    // strips any section the model wrote itself, because a quote built from
    // a 500-character window is fabrication, not provenance. The budget is
    // raised: on a source page the quotes ARE the payload, and the default
    // 500-char section cap would ellipsize exactly what this route exists
    // to preserve.
    finalContent = injectMentionsSection(
      finalContent,
      analysis.mentions_in_source ?? [],
      file.path,
      {
        sectionLabel: getSectionLabels(this.settings).mentions_in_source,
        maxChars: SOURCE_PAGE_MENTIONS_MAX_CHARS,
      },
    );

    // Stage 4 (#568): the source page no longer mirrors the note's tags into
    // a `domains:` field — one field, and the note itself carries the tags
    // one click away; the mirror only duplicated every tag-pane hit.
    // `tags:` stays the plugin's format axis (#90/#114).

    // The source page was the one writer without the link corrector: 212 of
    // 314 folder-wrong links measured on a 3,025-page vault stood in its Key
    // Entities / Key Concepts / Core Content sections. Same pass as the
    // entity and concept pages — the typed lists come from the analysis, the
    // two Key sections play the role of the Related sections, and every
    // folder-typed link elsewhere on the page is checked against the vault.
    {
      const labels = getSectionLabels(this.settings);
      finalContent = correctRelatedLinkPrefixes(
        finalContent,
        analysis.entities.map(e => e.name),
        analysis.concepts.map(c => c.name),
        labels.key_entities,
        labels.key_concepts,
        { wikiFolder: this.settings.wikiFolder, pages: await this.getExistingWikiPages() },
      );
    }

    await this.createOrUpdateFile(path, finalContent);
    return path;
  }

  async createOrUpdateFile(path: string, content: string): Promise<void> {
    console.debug('createOrUpdateFile:', path);

    // Central pollution detection: strip folder-prefix duplication from wiki-links
    // before writing. This catches pollution from ALL sources (page generation,
    // stub expansion, dead link fixes, merges, etc.).
    //
    // Pattern A: display-name pollution — [[entities/X|entities/Y]]
    //   e.g. [[entities/Qwen|entities/Qwen]] → [[entities/Qwen|Qwen]]
    const DISPLAY_POLLUTION_REGEX = /\[\[(entities|concepts|sources)\/([^|\]]+)\|(entities|concepts|sources)\/([^|\]]+)\]\]/g;
    if (DISPLAY_POLLUTION_REGEX.test(content)) {
      console.warn(
        `createOrUpdateFile: detected display-name pollution in ${path}, auto-correcting`
      );
      content = content.replace(
        DISPLAY_POLLUTION_REGEX,
        (_match: string, _folder: string, _path: string, _dupFolder: string, display: string) => {
          return `[[${_folder}/${_path}|${display}]]`;
        }
      );
    }

    // Pattern B: path-prefix duplication — [[X/Xname|name]]
    //   e.g. [[concepts/concepts布局优化|布局优化]] → [[concepts/布局优化|布局优化]]
    //   The folder prefix is duplicated in the path portion, directly before
    //   the page name with no separator (CJK char, letter, etc.).
    //   Safe: [[concepts/concepts-of-ML|...]] — '-' separator indicates legitimate slug.
    const PATH_DUP_REGEX = /\[\[(entities|concepts|sources)\/\1([^\s\-_|\]]+)(\|[^\]]+)?\]\]/g;
    if (PATH_DUP_REGEX.test(content)) {
      console.warn(
        `createOrUpdateFile: detected path-prefix pollution in ${path}, auto-correcting`
      );
      content = content.replace(
        PATH_DUP_REGEX,
        (_match: string, folder: string, rest: string, display: string | undefined) => {
          const displayPart = display || '';
          return `[[${folder}/${rest}${displayPart}]]`;
        }
      );
    }

    // Issue #125: normalize the `sources:` frontmatter field on every write.
    // The LLM emits raw note paths ("[[Notizen/Autonome Dysregulation.md]]"),
    // `.md` extensions, `|alias` pipes, and space/paren-containing titles. Left
    // unfixed these become dead links that previously required a post-ingest
    // cleanup script. normalizeSourcesField (Issue #81) already exists and is
    // unit-tested but was only wired into the lint/auto-maintain paths — not the
    // generation/merge write path that produces this pollution in the first place.
    const preserveCase = this.settings.slugCase === 'preserve';
    const sourcesFix = fixPollutedSources(content, this.settings.wikiFolder, preserveCase);
    if (sourcesFix.fixed > 0) {
      console.warn(`createOrUpdateFile: normalized polluted sources field in ${path}`);
      content = sourcesFix.content;
    }

    // Cosmetic spacing: one blank line after each heading, blank-line runs
    // collapsed (see core/markdown-spacing.ts). Wiki content pages only —
    // log/schema writes pass through untouched.
    if (this.isInWikiContentFolder(path, this.settings.wikiFolder)) {
      content = normalizeHeadingSpacing(content);
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          console.debug(`Attempt ${attempt + 1}: File exists, updating:`, path);
          await this.app.vault.process(file, () => content);
          console.debug('Update success:', path);
          if (this.isInWikiContentFolder(path, this.settings.wikiFolder)) {
            this.markPageComplete(path);
          }
          this.onFileWrite?.(path);
          this.invalidatePageCaches();
          return;
        }

        // getAbstractFileByPath returned null — could be an NFC/NFD normalization
        // mismatch on macOS where the file exists but with a different Unicode form.
        // Try resolveFileInVault (walks parent directory, no full vault scan) first,
        // rather than guessing vault.create() will succeed.
        if (attempt === 0) {
          const resolved = this.resolveFileInVault(path);
          if (resolved instanceof TFile) {
            console.debug('createOrUpdateFile: resolved via directory scan:', path);
            await this.app.vault.process(resolved, () => content);
            console.debug('Update success (resolved path):', path);
            if (this.isInWikiContentFolder(path, this.settings.wikiFolder)) {
              this.markPageComplete(path);
            }
            this.onFileWrite?.(path);
            this.invalidatePageCaches();
            return;
          }
        }

        // File genuinely does not appear to exist — attempt to create it.
        console.debug(`Attempt ${attempt + 1}: File not found, creating:`, path);
        await this.app.vault.create(path, content);
        console.debug('Create success:', path);
        if (this.isInWikiContentFolder(path, this.settings.wikiFolder)) {
          this.markPageComplete(path);
        }
        this.onFileWrite?.(path);
        this.invalidatePageCaches();
        return;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Attempt ${attempt + 1} failed:`, errorMsg);

        if (errorMsg.includes('File already exists') || errorMsg.includes('already exists')) {
          // macOS Unicode normalization: getAbstractFileByPath returned null
          // but vault.create detected the file (NFC vs NFD mismatch).
          // Fall back to parent-directory listing to resolve the actual TFile.
          let resolved = this.resolveFileInVault(path);
          if (!resolved) {
            const normalized = path.normalize();
            const allFiles = this.app.vault.getMarkdownFiles();
            resolved = allFiles.find(f => f.path.normalize() === normalized) || null;
            if (resolved) console.debug('Retry found file via full scan:', path);
          }
          if (resolved instanceof TFile) {
            await this.app.vault.process(resolved, () => content);
            console.debug('Update succeeded after file resolution:', path);
            this.onFileWrite?.(path);
            this.invalidatePageCaches();
            return;
          }
          console.debug('File exists anomaly, retrying after 100ms:', path);
          await new Promise(resolve => window.setTimeout(resolve, 100));
          continue;
        } else {
          console.error('Unhandled error:', path, error);
          throw error;
        }
      }
    }

    // Final fallback: try directory listing + full markdown scan
    console.debug('3attempts exhausted, searching directory listing:', path);
    let file = this.resolveFileInVault(path);
    if (!file) {
      // Belt-and-suspenders: scan getMarkdownFiles() (same source of truth as lint)
      const normalized = path.normalize();
      const allFiles = this.app.vault.getMarkdownFiles();
      file = allFiles.find(f => f.path.normalize() === normalized) || null;
      if (file) console.debug('createOrUpdateFile: resolved via full scan:', path);
    }
    if (file) {
      await this.app.vault.process(file, () => content);
      console.debug('Final update succeeded:', path);
      this.onFileWrite?.(path);
      this.invalidatePageCaches();
    } else {
      // Issue #172: localize via getText, never hardcode CJK in source.
      throw new Error(
        getText(this.settings.language, 'fileWriteFailed').replace('{path}', path)
      );
    }
  }

  async deleteFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.fileManager.trashFile(file);
      this.invalidatePageCaches();
      console.debug('deleteFile:', path);
    }
  }

  /** Resolve a vault path to TFile by listing parent directory children.
   *  macOS APFS stores filenames in NFD; JavaScript strings are NFC.
   *  When getAbstractFileByPath can't find a file that vault.create
   *  detected as existing, this fallback resolves the mismatch.
   *  Uses Unicode normalization so Chinese filenames compare correctly. */
  private resolveFileInVault(path: string): TFile | null {
    const lastSep = path.lastIndexOf('/');
    if (lastSep === -1) return null;
    const dirPath = path.substring(0, lastSep);
    const baseName = path.substring(lastSep + 1).normalize();

    const dir = this.app.vault.getAbstractFileByPath(dirPath);
    if (dir && dir instanceof TFolder) {
      for (const child of dir.children) {
        if (child instanceof TFile && child.name.normalize() === baseName) {
          return child;
        }
      }
    }
    return null;
  }

  async tryReadFile(path: string): Promise<string | null> {
    // Resolve the file using all available strategies.
    // On macOS APFS, filenames are stored in NFD while JavaScript uses NFC,
    // so getAbstractFileByPath may miss files with non-ASCII names.
    let file: TFile | null = null;

    try {
      const direct = this.app.vault.getAbstractFileByPath(path);
      if (direct instanceof TFile) file = direct;
    } catch {
      // getAbstractFileByPath can throw on malformed paths; ignore and try fallbacks
    }

    if (!file) {
      file = this.resolveFileInVault(path);
    }

    if (!file) {
      const normalized = path.normalize();
      const allFiles = this.app.vault.getMarkdownFiles();
      const matched = allFiles.find(f => f.path.normalize() === normalized);
      if (matched) {
        console.debug('tryReadFile: resolved via full scan:', path);
        file = matched;
      }
    }

    if (!file) {
      console.debug('tryReadFile: all lookups failed for:', path);
      return null;
    }

    // vault.read() exceptions are NOT caught — a file that exists but can't
    // be read is a real error, not a "file not found" condition.
    return await this.app.vault.read(file);
  }

  async regenerateDefaultSchema(): Promise<void> {
    await this.schemaManager.regenerateDefaultSchema();
  }

  // ---- Lint-fix delegation ----

  getExistingWikiPages(): Promise<Array<{path: string; title: string; wikiLink: string; aliases?: string[]}>> {
    const now = Date.now();
    if (this.pagesCache && (now - this.pagesCacheTime) < this.PAGES_CACHE_TTL_MS) {
      return Promise.resolve(this.pagesCache);
    }
    return getExistingWikiPages(this.app, this.settings.wikiFolder).then(data => {
      this.pagesCache = data;
      this.pagesCacheTime = Date.now();
      return data;
    });
  }

  async fixDeadLink(sourcePath: string, targetName: string): Promise<string> {
    return fixDeadLink(this.ctx, sourcePath, targetName);
  }

  async fillEmptyPage(pagePath: string, existingContent?: string): Promise<string> {
    return fillEmptyPage(this.ctx, pagePath, existingContent);
  }

  // Issue #103: delete empty stubs without running full lint pipeline
  async deleteEmptyStubs(wikiFolder: string): Promise<{ deleted: number; failed: number; errors: string[] }> {
    return deleteEmptyStubs(this.ctx, wikiFolder);
  }

  async linkOrphanPage(orphanPath: string): Promise<string[]> {
    return linkOrphanPage(this.ctx, orphanPath);
  }

  // ---- Contradiction delegation ----

  async noteContradiction(contradiction: ContradictionInfo, sourceNotePath: string) {
    return this.contradictionManager.noteContradiction(contradiction, sourceNotePath);
  }

  async getOpenContradictions(): Promise<Array<{ path: string; status: string; claim: string; sourcePage: string }>> {
    return this.contradictionManager.getOpenContradictions();
  }

  async updateContradictionStatus(filePath: string, newStatus: string): Promise<void> {
    return this.contradictionManager.updateContradictionStatus(filePath, newStatus);
  }

  async resolveContradiction(contradictionPath: string): Promise<void> {
    return this.contradictionManager.resolveContradiction(contradictionPath);
  }

  // ---- Conversation ingestion delegation ----

  async ingestConversation(history: ConversationHistory): Promise<IngestReport> {
    return this.conversationIngestor.ingestConversation(history);
  }

  formatConversation(history: ConversationHistory): string {
    return formatConversation(history);
  }

  // ---- Index generation ----
  // v1.25.1 Phase C-PR1: extracted to engine-internals/index-generator.ts.
  // WikiEngine keeps facade methods so existing callers (lint phases,
  // conversation-ingest orchestrator, main.ts command) see no change.

  async generateIndexFromEngine() {
    await this.ensureWikiStructure();

    // v1.25.1 Phase C-PR1.8 (Efficiency #2): one getMarkdownFiles() call
    // + 3 prefix filters (was 3 separate calls — each rebuilds the vault
    // file index). On a 5K-page vault this saves ~30-150ms per regen.
    const prefix = `${this.settings.wikiFolder}/`;
    const allWikiPages = this.app.vault.getMarkdownFiles().filter(f => f.path.startsWith(prefix));
    const entities = allWikiPages.filter(f => f.path.startsWith(`${prefix}entities/`));
    const concepts = allWikiPages.filter(f => f.path.startsWith(`${prefix}concepts/`));
    const sources = allWikiPages.filter(f => f.path.startsWith(`${prefix}sources/`));

    const totalPages = entities.length + concepts.length + sources.length;
    if (totalPages === 0) {
      await this.indexGenerator.generateEmptyIndex();
      return;
    }
    await this.indexGenerator.generateFlatIndex(entities, concepts, sources);
  }

  async getPageSummary(file: TFile): Promise<string> {
    return this.indexGenerator.getPageSummary(file);
  }

  async getPageAliases(file: TFile): Promise<string[]> {
    return this.indexGenerator.getPageAliases(file);
  }

  async updateLog(
    operation: string,
    analysis: SourceAnalysis,
    metrics?: { durationSec?: number; model?: string; sourceBytes?: number },
  ) {
    return this.logWriter.appendIngest(operation, analysis, metrics);
  }

  /** Append a lint-fix entry to the operation log. */
  async logLintFix(operation: string, details: string): Promise<void> {
    return this.logWriter.appendLintFix(operation, details);
  }

  /** Merge a duplicate source page into a target page. */
  async mergeDuplicatePages(targetPath: string, sourcePath: string): Promise<string> {
    return mergeDuplicatePages(this.ctx, targetPath, sourcePath);
  }
}
