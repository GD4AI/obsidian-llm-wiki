import { NOTICE_SHORT, NOTICE_WATCHER } from '../constants';
// Auto Maintain Manager - File watcher, periodic lint, startup quick fixes

import { App, TAbstractFile, TFile, Notice, Plugin } from 'obsidian';
import { LLMWikiSettings } from '../types';
import { WikiEngine } from '../wiki/wiki-engine';
import { TEXTS } from '../texts';
import { normalizeSourcesInFolder } from '../core/sources-normalizer';
import { findIncompletePages, cleanIncompletePages } from '../core/incomplete-page-cleaner';
import { needsLogHeaderMigration, migrateLogHeader } from '../core/log-header';
import { ensureWelcomeNote, type EnsureResult, type VaultAdapter } from '../core/ensure-welcome-note';
import { getWelcomeFileName } from '../core/i18n';
import { resolveModelForTask } from '../core/model-resolver';
import { isLocalNoKeyProvider } from '../core/local-no-key-provider';
import { resolveProviderApiKey } from '../llm-sdk/provider-api-key-resolver';
import type { LLMClient } from '../types';
import { isIngestableSource } from '../core/folder-scope';
import { localDateStamp } from '../core/format';

export class AutoMaintainManager {
  private app: App;
  settings: LLMWikiSettings;
  private wikiEngine: WikiEngine;
  private plugin: Plugin;

  // Watcher state
  private debounceTimer: number | null = null;
  private pendingFiles: Map<string, TFile> = new Map();
  private recentWrites: Set<string> = new Set();
  private firstChangeTimestamp = 0;
  private readonly MAX_DEBOUNCE_MS = 60000; // Hard cap to prevent indefinite delay

  // Periodic lint state
  private lintIntervalId: number | null = null;
  private lastLintTimestamp = 0;
  private lintCallback: (() => Promise<void>) | null = null;

  // Whether watchers are currently active
  private watching = false;
  private lintScheduled = false;

  constructor(
    app: App,
    settings: LLMWikiSettings,
    wikiEngine: WikiEngine,
    plugin: Plugin,
    lintCallback?: () => Promise<void>
  ) {
    this.app = app;
    this.settings = settings;
    this.wikiEngine = wikiEngine;
    this.plugin = plugin;
    this.lintCallback = lintCallback || null;
  }

  // === File Watcher ===

  // Listen to four event types to cover all file-creation scenarios:
  // - vault.on('create')  → new files within Obsidian (Cmd+N, right-click→New)
  // - vault.on('rename')  → files MOVED into watched folder (drag in file explorer)
  // - vault.on('modify')  → content changes in watched files
  // - metadataCache.on('resolved') → external drag-drop, copy-paste from OS
  // workspace.onLayoutReady prevents startup noise from existing files.
  startWatching(): void {
    if (this.watching) return;

    this.app.workspace.onLayoutReady(() => {
      if (this.watching) return;

      this.plugin.registerEvent(
        this.app.vault.on('create', (file: TAbstractFile) => {
          this.onFileChanged(file);
        })
      );
      this.plugin.registerEvent(
        this.app.vault.on('rename', (file: TAbstractFile, _oldPath: string) => {
          this.onFileChanged(file);
        })
      );
      this.plugin.registerEvent(
        this.app.vault.on('modify', (file: TAbstractFile) => {
          this.onFileChanged(file);
        })
      );
      this.plugin.registerEvent(
        this.app.metadataCache.on('resolved', ((file: TFile) => {
          this.onFileChanged(file);
        }) as unknown as () => void)
      );

      this.watching = true;
      console.debug('AutoMaintain: File watcher started (create+rename+modify+resolved)');
      const texts = TEXTS[this.settings.language];
      new Notice(texts.watcherActiveNotice, NOTICE_WATCHER);
    });
  }

  stopWatching(): void {
    // registerEvent handles cleanup via plugin lifecycle;
    // we just clear our own state
    this.clearDebounce();
    this.pendingFiles.clear();
    this.watching = false;
    console.debug('AutoMaintain: File watcher stopped');
  }

  // Check if a path falls within any watched folder
  // Issue #505 — the watched-folder picker is the same FolderSuggestModal
  // the ingest command uses, so the vault root is offered and stored as `/`.
  // The previous hand-rolled comparison asked `path.startsWith('/')`, which no
  // Obsidian vault path satisfies: the entry was displayed but matched nothing.
  //
  // Delegating to the shared rule fixes that and brings the picker's own
  // exclusion along, which the root case needs — otherwise a repaired root
  // would watch `wiki/` and feed the plugin its own generated pages (#502).
  private isWatched(path: string): boolean {
    if (this.settings.watchedFolders.length === 0) return false;
    return this.settings.watchedFolders.some(folder => {
      const trimmed = folder.replace(/\/+$/, '');
      return isIngestableSource(
        path,
        trimmed,
        trimmed.length === 0,
        this.settings.wikiFolder,
        this.app.vault.configDir,
      );
    });
  }

  // Avoid re-processing on repeated metadataCache events for the same file version
  private lastSeenPaths: Set<string> = new Set();

  private onFileChanged(file: TAbstractFile): void {
    // metadataCache may fire with undefined during plugin load/unload lifecycle
    if (!file) return;

    console.debug(`[AutoMaintain] event: ${file.path}, TFile: ${file instanceof TFile}`);

    if (!(file instanceof TFile)) return;
    if (!file.path.endsWith('.md')) return;

    if (!this.isWatched(file.path)) {
      console.debug(`[AutoMaintain] SKIP: ${file.path} (not watched). Watched: ${JSON.stringify(this.settings.watchedFolders)}`);
      return;
    }

    if (this.recentWrites.has(file.path)) {
      console.debug(`[AutoMaintain] SKIP: ${file.path} (recent write)`);
      return;
    }

    // metadataCache may re-fire for the same file version; dedupe by mtime
    const mtime = file.stat?.mtime || 0;
    const fileKey = `${file.path}::${mtime}`;
    if (this.lastSeenPaths.has(fileKey)) {
      console.debug(`[AutoMaintain] SKIP: ${file.path} (same mtime already seen)`);
      return;
    }
    this.lastSeenPaths.add(fileKey);
    window.setTimeout(() => { this.lastSeenPaths.delete(fileKey); }, 600000);

    console.debug(`[AutoMaintain] DETECTED: ${file.path}, pending: ${this.pendingFiles.size + 1}`);

    // Add to pending batch
    this.pendingFiles.set(file.path, file);

    // Track first change for max-debounce cap
    if (this.firstChangeTimestamp === 0) {
      this.firstChangeTimestamp = Date.now();
    }

    // Calculate delay with max-debounce hard cap
    const elapsed = Date.now() - this.firstChangeTimestamp;
    const delay = Math.max(0, Math.min(
      this.settings.autoWatchDebounceMs,
      this.MAX_DEBOUNCE_MS - elapsed
    ));

    // Reset debounce timer
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    if (delay <= 0) {
      // Max wait exceeded, process immediately
      void this.processBatch();
    } else {
      this.debounceTimer = window.setTimeout(
        () => { void this.processBatch(); },
        delay
      );
    }
  }

  markRecentWrite(path: string): void {
    this.recentWrites.add(path);
    // Auto-expire after 120 seconds (covers slow LLM responses)
    window.setTimeout(() => {
      this.recentWrites.delete(path);
    }, 120000);
  }

  // Register a write that auto-maintain should not re-trigger on.
  // Called externally (e.g. from wiki-engine callbacks) for files
  // created outside the watcher→ingest flow (like ingestConversation).
  watchWrite(path: string): void {
    if (this.isWatched(path)) {
      this.markRecentWrite(path);
    }
  }

  private async processBatch(): Promise<void> {
    this.debounceTimer = null;
    this.firstChangeTimestamp = 0;
    const files = Array.from(this.pendingFiles.values());
    this.pendingFiles.clear();

    if (files.length === 0) return;

    const sourceFiles = files.filter(f => this.isWatched(f.path));
    if (sourceFiles.length === 0) return;

    const texts = TEXTS[this.settings.language];

    if (this.settings.autoWatchMode === 'notify') {
      new Notice(
        texts.watchIngestNotice.replace('{count}', String(sourceFiles.length)),
        8000
      );
    } else {
      new Notice(texts.autoIngestRunning.replace('{count}', String(sourceFiles.length)), NOTICE_SHORT);

      let successCount = 0;
      let failCount = 0;

      // #164: shared dedup context for this watcher batch — mirrors the folder
      // ingest in main.ts. Catches identical content across files in one run and
      // builds the ingested-hash snapshot once instead of per file.
      const batchCtx = this.wikiEngine.createBatchContext();

      for (const file of sourceFiles) {
        try {
          this.markRecentWrite(file.path);
          await this.wikiEngine.ingestSource(file, { batchCtx, trigger: 'auto' });
          successCount++;
        } catch (error) {
          console.error(`Auto-ingest failed for ${file.path}:`, error);
          failCount++;
        }
      }

      new Notice(
        texts.autoIngestComplete
          .replace('{success}', String(successCount))
          .replace('{fail}', String(failCount)),
        failCount > 0 ? 8000 : 5000
      );
    }
  }

  private clearDebounce(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.firstChangeTimestamp = 0;
  }

  // === Periodic Lint ===

  schedulePeriodicLint(): void {
    if (this.lintScheduled) return;
    if (this.settings.periodicLint === 'off') return;

    const intervalMs = this.settings.periodicLint === 'daily'
      ? 24 * 60 * 60 * 1000
      : this.settings.periodicLint === 'weekly'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

    this.lintIntervalId = this.plugin.registerInterval(
      window.setInterval(() => {
        void (async () => {
          console.debug('AutoMaintain: Periodic lint tick...');
          try {
            await this.runLint();
          } catch (error) {
            console.error('Scheduled lint failed:', error);
          }
        })();
      }, intervalMs)
    );

    this.lintScheduled = true;
    console.debug(`AutoMaintain: Periodic lint scheduled (${this.settings.periodicLint})`);
  }

  clearPeriodicLint(): void {
    // registerInterval handles cleanup; we just track state
    this.lintScheduled = false;
    console.debug('AutoMaintain: Periodic lint cleared');
  }

  private async runLint(): Promise<void> {
    // Check if any source files have changed since last lint
    const hasChanges = this.hasSourceFilesChanged();
    if (!hasChanges && this.lastLintTimestamp > 0) {
      console.debug('AutoMaintain: No source changes since last lint, skipping');
      return;
    }

    const texts = TEXTS[this.settings.language];
    new Notice(texts.scheduledLintRunning, NOTICE_SHORT);
    this.lastLintTimestamp = Date.now();

    if (this.lintCallback) {
      await this.lintCallback();
    } else {
      // Fallback: lightweight page count if no callback provided
      const pages = await this.wikiEngine.getExistingWikiPages();
      const entities = pages.filter(p => p.path.includes('/entities/')).length;
      const concepts = pages.filter(p => p.path.includes('/concepts/')).length;
      const sources = pages.filter(p => p.path.includes('/sources/')).length;

      new Notice(
        texts.wikiLintStats
          .replace('{pages}', String(pages.length))
          .replace('{entities}', String(entities))
          .replace('{concepts}', String(concepts))
          .replace('{sources}', String(sources)),
        5000
      );
    }
  }

  private hasSourceFilesChanged(): boolean {
    if (this.settings.watchedFolders.length === 0) return true; // no folders configured, always run
    const allFiles = this.app.vault.getMarkdownFiles();
    const sourceFiles = allFiles.filter(f => this.isWatched(f.path));

    for (const file of sourceFiles) {
      if (file.stat.mtime > this.lastLintTimestamp) {
        return true;
      }
    }
    return false;
  }

  // === Startup Quick Fixes ===
  // Runs low-level programmatic fixes on plugin load:
  // - Sources field normalize (Issue #81)
  // - Wiki folder structure verify
  // All operations are read-only unless a file actually needs fixing.

  async runStartupCheck(): Promise<void> {
    // Wait for vault to settle after startup
    await new Promise(resolve => window.setTimeout(resolve, 3000));

    const texts = TEXTS[this.settings.language];
    console.debug('[QuickFixes] ===== Startup quick fixes START =====');
    console.debug(`[QuickFixes] Settings: wikiFolder="${this.settings.wikiFolder}", startupCheck=${this.settings.startupCheck}, language=${this.settings.language}`);

    // ---- Phase 0 (v1.23.0): First-run Welcome note ----
    // Two-stage design so the startup-check summary Notice is NOT
    // blocked by the Welcome note's LLM translation:
    //   Stage 0a (sync): decide tier + whether Welcome is needed.
    //                    Returns the decision without any I/O.
    //   Stage 0b (fire-and-forget): if a Welcome is needed, kick off
    //                    the actual creation asynchronously. The
    //                    startup-check summary Notice (Phase 5) only
    //                    reports the Stage 0a decision; a separate
    //                    Notice fires when Stage 0b completes.
    let welcomeNeeded = false;
    try {
      // assessWelcomeNeed is SYNC (no I/O beyond a markdown file listing,
      // no LLM call). It returns the tier decision; the actual Welcome
      // creation is fire-and-forget below.
      const decision = this.assessWelcomeNeed();
      welcomeNeeded = decision.shouldCreate;
      console.debug(`[QuickFixes] Phase 0a: Welcome note ${welcomeNeeded ? 'will be created' : 'skipped'} (tier=${decision.tier})`);
      if (decision.shouldCreate) {
        // Fire-and-forget. The user gets a separate Notice when
        // the async creation completes; the startup-check summary
        // below is not blocked.
        void this.createWelcomeNoteAsync(decision);
      }
    } catch (e) {
      console.warn('[QuickFixes] Phase 0 failed:', e);
    }

    // ---- Phase 1: Wiki structure check ----
    const wikiFolder = this.settings.wikiFolder;
    const requiredFolders = [
      `${wikiFolder}/entities`,
      `${wikiFolder}/concepts`,
      `${wikiFolder}/sources`,
      `${wikiFolder}/schema`,
    ];
    let structureOk = true;
    const missingFolders: string[] = [];
    for (const folder of requiredFolders) {
      const folderObj = this.app.vault.getAbstractFileByPath(folder);
      if (!folderObj) {
        structureOk = false;
        missingFolders.push(folder);
      }
    }
    // Phase 0 (onboarding) just ran ensureWelcomeNote — if it created
    // the wikiFolder + entities/ subfolder for a fresh-vault Tier B,
    // Phase 1 should now see entities/ present. Otherwise the
    // "missingFolders" report is a true signal to the user.
    console.debug(`[QuickFixes] Phase 1: Wiki structure ${structureOk ? 'OK' : 'INCOMPLETE'}` +
      (missingFolders.length > 0 ? `, missing: ${missingFolders.join(', ')}` : ''));

    // ---- Phase 2: Sources field normalize (Issue #81) ----
    // Scans only files in wikiFolder, only writes files that need fixing.
    // Module-function shape matches Phase 3 (findIncompletePages /
    // cleanIncompletePages in src/core/incomplete-page-cleaner.ts).
    const sourcesPreserveCase = this.settings.slugCase === 'preserve';
    const { filesCleaned: sourcesFilesCleaned, entriesCleaned: sourcesEntriesCleaned } =
      await normalizeSourcesInFolder(this.app, wikiFolder, sourcesPreserveCase);

    // ---- Phase 3: Incomplete-page cleanup (Issue #170) ----
    // Scan wiki/{entities,concepts,sources} for pages whose `generation_complete`
    // flag is stuck at `false` (interrupted ingest, partial write). Archive them
    // so the user can recover from .trash if needed. Pages WITHOUT the field
    // are treated as legacy (preserved) — never wipe existing wikis on upgrade.
    let incompleteFilesScanned = 0;
    let incompleteFilesArchived = 0;
    try {
      const incomplete = await findIncompletePages(this.app, wikiFolder);
      incompleteFilesScanned = incomplete.length;
      if (incomplete.length > 0) {
        incompleteFilesArchived = await cleanIncompletePages(this.app, incomplete);
        console.debug(`[QuickFixes] Phase 3: ${incompleteFilesScanned} incomplete pages found, ${incompleteFilesArchived} archived`);
      } else {
        console.debug('[QuickFixes] Phase 3: no incomplete pages found');
      }
    } catch (e) {
      console.warn('[QuickFixes] Phase 3 failed:', e);
    }

    // ---- Phase 4: Health summary (existing) ----
    const pages = await this.wikiEngine.getExistingWikiPages();
    const entities = pages.filter(p => p.path.includes('/entities/')).length;
    const concepts = pages.filter(p => p.path.includes('/concepts/')).length;
    const sources = pages.filter(p => p.path.includes('/sources/')).length;

    const indexPath = `${wikiFolder}/index.md`;
    const hasIndex = await this.wikiEngine.tryReadFile(indexPath);
    const indexStatus = hasIndex ? '' : ' — index.md missing';
    console.debug(`[QuickFixes] Phase 4: Wiki health — ${pages.length} pages (entities=${entities}, concepts=${concepts}, sources=${sources})${indexStatus}`);

    // ---- Phase 4.5: log.md old-format auto-migration (v1.22.2) ----
    // Non-destructive: replaces the legacy single-line header with the
    // new multi-line header (which now points to Operation History Panel).
    // All existing ## [date time] entries are preserved.
    try {
      const logPath = `${wikiFolder}/log.md`;
      const existingLog = await this.wikiEngine.tryReadFile(logPath);
      // Issue #793: two languages, not one. The header is written in the wiki's
      // content language, because that is the language of the file; the command
      // name comes from the interface language, because that is the language
      // the command palette is registered in. `log-writer.ts:127` already splits
      // them. A migration that did not would rewrite every engine-written header
      // back into the interface language — and with #876's freshness check it
      // would do so on every startup, not once.
      const headerLang = this.settings.wikiLanguage ?? '';
      const commandName = (TEXTS[this.settings.language] || TEXTS.en).cmdViewHistory;
      if (existingLog && needsLogHeaderMigration(existingLog, headerLang, commandName)) {
        const migrated = migrateLogHeader(existingLog, headerLang, commandName);
        if (migrated !== null && migrated !== existingLog) {
          await this.wikiEngine.createOrUpdateFile(logPath, migrated);
          console.debug(`[QuickFixes] Phase 4.5: log.md header migrated to v1.22.2 format`);
        }
      }
    } catch (e) {
      console.warn('[QuickFixes] Phase 4.5 failed:', e);
    }

    // ---- Phase 5: Build notice ----
    //
    // v1.26.4 UX: for a healthy wiki, the notice is compact — title +
    // page-count summary + disable hint. The per-check detail lines
    // (Wiki structure / Sources normalized / incomplete pages) are
    // ONLY added when that check actually needed fixing, so a routine
    // morning startup isn't 6 lines of "everything is fine".
    const structureLabel = structureOk
      ? texts.startupCheckStructureOk
      : texts.startupCheckStructureMissing;
    const sourcesLabel = sourcesFilesCleaned > 0
      ? texts.startupCheckSourcesCleaned
          .replace('{files}', String(sourcesFilesCleaned))
          .replace('{entries}', String(sourcesEntriesCleaned))
      : texts.startupCheckSourcesClean;
    const incompleteLabel = incompleteFilesArchived > 0
      ? texts.startupCheckIncompleteArchived
          .replace('{count}', String(incompleteFilesArchived))
      : texts.startupCheckIncompleteClean;

    // welcomeNeeded reflects Phase 0a's decision (sync, before any
    // LLM call). The actual file write happens asynchronously in
    // createWelcomeNoteAsync(); a separate Notice is shown when it
    // finishes. We surface the decision here so the user sees that
    // onboarding is in progress, not the path.
    const lines: string[] = [texts.startupCheckTitle];

    // Detail lines only when the check needed fixing (not "all good").
    if (!structureOk) {
      lines.push(`${texts.startupCheckStructureLabel}: ${structureLabel}`);
    }
    if (sourcesFilesCleaned > 0) {
      lines.push(`${texts.startupCheckSourcesLabel}: ${sourcesLabel}`);
    }
    if (incompleteFilesArchived > 0) {
      lines.push(incompleteLabel);
    }
    if (welcomeNeeded) {
      lines.push(texts.startupCheckWelcomePending ?? 'Welcome note: generating in background (you will get a Notice when it finishes).');
    }
    lines.push(texts.startupCheckSummary
      .replace('{pages}', String(pages.length))
      .replace('{entities}', String(entities))
      .replace('{concepts}', String(concepts))
      .replace('{sources}', String(sources)));
    lines.push(texts.startupCheckDisableHint);

    const summary = lines.join('\n');

    console.debug('[QuickFixes] Notice payload:\n' + summary.split('\n').map(l => '  ' + l).join('\n'));
    console.debug('[QuickFixes] ===== Startup quick fixes COMPLETE =====');

    // v1.23.0 follow-up: QuickFixes always runs (the old `startupCheck`
    // toggle is now permanently on). The user-facing control is now
    // `startupCheckNoticeLevel` — 'visible' shows the summary Notice
    // (existing behavior), 'silent' only logs to console + records an
    // entry for the Operation History Panel (added below when implemented).
    if (this.settings.startupCheckNoticeLevel === 'visible') {
      new Notice(summary, 10000);  // 10s — give user time to read
    } else {
      console.debug('[QuickFixes] Notice suppressed by startupCheckNoticeLevel=silent');
    }
  }

  // === Phase 0: Onboarding Welcome Note (v1.23.0) ===

  /**
   * Phase 0a of runStartupCheck. **SYNC — returns a decision without
   * any I/O or LLM call.** The caller uses this to decide whether
   * to launch the async creation path; the startup-check summary
   * Notice is built from this synchronous decision and is therefore
   * not blocked by Welcome's LLM translation.
   *
   * Pure local logic: probes the vault via listMarkdown (fast
   * filesystem walk) and looks at whether an llmClient is wired up
   * to decide the tier. The full ensure-welcome-note pipeline runs
   * in createWelcomeNoteAsync().
   */
  private assessWelcomeNeed(): { shouldCreate: boolean; tier: 'A-empty-vault' | 'B-existing-vault' | 'C-existing-wiki' } {
    const wikiFolder = this.settings.wikiFolder || 'wiki';
    const llmClient = (this.plugin as unknown as { llmClient: LLMClient | null }).llmClient;
    // Quick vault probe (no I/O beyond a markdown file listing).
    const allMd = this.app.vault.getMarkdownFiles().map(f => ({
      path: f.path, title: f.basename, size: f.stat?.size ?? 0,
    }));
    const wikiPages = allMd.filter(c => c.path.startsWith(`${wikiFolder}/`));
    const hasWikiFolder = wikiPages.length > 0;
    const wikiPageCount = wikiPages.length;
    const vaultMdCount = allMd.length;

    // Mirror tier-detection logic (the "lite" version — no LLM call
    // involved, so we can run it sync).
    let tier: 'A-empty-vault' | 'B-existing-vault' | 'C-existing-wiki';
    let shouldCreate: boolean;
    if (vaultMdCount === 0) {
      tier = 'A-empty-vault';
      shouldCreate = !!llmClient;  // Tier A creates Welcome when LLM is on (D8 + v1.23.0 follow-up)
    } else if (hasWikiFolder && wikiPageCount > 0) {
      tier = 'C-existing-wiki';
      shouldCreate = false;
    } else {
      tier = 'B-existing-vault';
      shouldCreate = true;
    }
    return { shouldCreate, tier };
  }

  /**
   * Phase 0b of runStartupCheck. **Fire-and-forget** — call sites
   * discard the returned Promise. The LLM translation can take
   * 5-15 seconds on a thinking-capable model, and the startup-check
   * summary Notice must not be blocked.
   *
   * Posts a separate Notice on completion (success OR failure) so
   * the user sees the outcome without having to wait for the
   * summary Notice.
   */
  private async createWelcomeNoteAsync(decision: { tier: string }): Promise<void> {
    console.debug(`[QuickFixes] Phase 0b: starting async Welcome creation (tier=${decision.tier})`);
    // Fire a "generating" Notice so the user knows the work is in
    // progress (vs. silently failing). Use NOTICE_NORMAL (5s) so it
    // doesn't conflict with the startup-check summary Notice.
    const generatingMsg = TEXTS[this.settings.language].welcomeNoteGenerating
      ?? 'Welcome note: generating in background...';
    new Notice(generatingMsg, 5000);

    try {
      const result = await this.runOnboardingPhase();
      console.debug(`[QuickFixes] Phase 0b: runOnboardingPhase returned. welcomeNotePath=${result.welcomeNotePath ?? 'NONE'}, tier=${result.tier}, shouldCreateWelcomeNote=${result.action.shouldCreateWelcomeNote}, localizeResult.localized=${result.localizeResult?.localized ?? 'n/a'}, localizeResult.error=${result.localizeResult?.error ?? 'n/a'}`);
      if (result.welcomeNotePath) {
        const okMsg = TEXTS[this.settings.language].welcomeNoteRecreated
          ?.replace('{path}', result.welcomeNotePath)
          ?? `Welcome note created at ${result.welcomeNotePath}`;
        new Notice(okMsg, 5000);
      } else {
        const noMsg = TEXTS[this.settings.language].welcomeNoteNotRecreated
          ?? 'Welcome note was not created. Check LLM configuration.';
        new Notice(noMsg, 5000);
      }
    } catch (e) {
      console.error('[QuickFixes] Phase 0b (async Welcome) failed:', e);
      const errMsg = TEXTS[this.settings.language].welcomeNoteGenerationFailed
        ? TEXTS[this.settings.language].welcomeNoteGenerationFailed.replace('{error}', e instanceof Error ? e.message : String(e))
        : `Welcome note generation failed: ${e instanceof Error ? e.message : String(e)}`;
      new Notice(errMsg, 5000);
    }
  }

  /**
   * Full ensure-welcome-note pipeline. Used by both createWelcomeNoteAsync
   * (background) and the recreateWelcomeNote command-palette entry
   * (user-initiated). forceRecreate=true bypasses the Tier C short-circuit (#268).
   */
  private async runOnboardingPhase(forceRecreate = false): Promise<EnsureResult> {
    const vault = this.makeVaultAdapter();
    const llmClient = (this.plugin as unknown as { llmClient: LLMClient | null }).llmClient;
    return ensureWelcomeNote({
      vault,
      settings: {
        wikiFolder: this.settings.wikiFolder || 'wiki',
        createWelcomeNote: this.settings.createWelcomeNote,
      },
      targetLanguage: this.settings.wikiLanguage || 'en',
      createdAt: localDateStamp(),
      // smokeTestProbe wraps the sync probe in a resolved Promise so
      // the ensure-welcome-note signature is satisfied.
      smokeTestProbe: async () => this.probeLlm(),
      llmClient: llmClient ?? undefined,
      model: resolveModelForTask(this.settings, 'ingest'),
      forceRecreate,
    });
  }

  /**
   * v1.23.0 Phase 5.1.5 → followup: command-palette entry to delete and
   * re-create the Welcome note with current vault state + LLM config.
   * Used when the user changes wikiFolder or wants a freshly-localized
   * copy.
   */
  async recreateWelcomeNote(): Promise<void> {
    const wikiFolder = this.settings.wikiFolder || 'wiki';
    const wikiLanguage = this.settings.wikiLanguage || 'en';
    // Delete BOTH the legacy "Welcome.md" (pre-i18n installs) and the
    // localized filename, so the Recreate command works regardless of
    // which one the user already has.
    const candidates = [
      `${wikiFolder}/${getWelcomeFileName(wikiLanguage)}.md`,
      `${wikiFolder}/Welcome.md`,  // legacy pre-i18n fallback
    ];
    for (const p of candidates) {
      const existing = this.app.vault.getAbstractFileByPath(p);
      if (existing && existing instanceof TFile) {
        try {
          await this.app.fileManager.trashFile(existing);
        } catch (e) {
          console.error(`Failed to delete existing Welcome note at ${p}:`, e);
          new Notice(
            `${TEXTS[this.settings.language].operationFailed ?? 'Operation failed: '}` +
              (e instanceof Error ? e.message : String(e)),
            0
          );
          return;
        }
      }
    }
    const result = await this.runOnboardingPhase(true);
    if (result.welcomeNotePath) {
      // Show a 5s auto-dismissing confirmation (NOT 0 — that would be
      // sticky). Use NOTICE_NORMAL for transient feedback.
      new Notice(
        `${TEXTS[this.settings.language].welcomeNoteRecreated?.replace('{path}', result.welcomeNotePath) ?? `Welcome note recreated at ${result.welcomeNotePath}`}`,
        5000
      );
    } else {
      new Notice(
        TEXTS[this.settings.language].welcomeNoteNotRecreated ??
          'Welcome note was not recreated. Check LLM configuration.',
        5000
      );
    }
  }

  /**
   * Build a VaultAdapter over the real Obsidian vault. Captures the
   * vault at call-time so vault changes during plugin lifetime are
   * reflected.
   */
  private makeVaultAdapter(): VaultAdapter {
    return {
      exists: async (path: string): Promise<boolean> => {
        return this.app.vault.getAbstractFileByPath(path) !== null;
      },
      getMarkdownFiles: async (): Promise<string[]> => {
        return this.app.vault.getMarkdownFiles().map(f => f.path);
      },
      create: async (path: string, content: string): Promise<void> => {
        const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
        if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
          await this.app.vault.createFolder(folder);
        }
        await this.app.vault.create(path, content);
      },
    };
  }

  /**
   * Local-only LLM configuration probe for the Welcome note's
   * "Configuration Test" section. PURE-LOCAL — does NOT send a real
   * LLM request. We check that the configuration fields are
   * populated; the actual LLM reachability is verified the first time
   * the user runs an ingest / query / lint (which uses the same
   * llmClient that the Welcome translation would use).
   *
   * Why no real call:
   *   1. Avoids burning tokens on every onload just to show a "✅ OK"
   *      indicator. The user's real business call (ingest) is the
   *      proof of life.
   *   2. Thinking-capable models can return empty content for tiny
   *      `max_tokens: 1` probes, which produces a misleading
   *      "⚠️ Failed" even when the user's setup is correct.
   *   3. Keeps the probe independent of LLMClient interface quirks
   *      (no need to invent a max_tokens / enableThinking value).
   *
   * Returns the provider/model name on success, or a structured
   * error message naming the missing field on failure. Never throws
   * — ensure-welcome-note wraps this with try/catch anyway, but
   * defensive-by-default is cheaper.
   */
  private probeLlm(): { ok: boolean; provider?: string; model?: string; error?: string } {
    const llmClient = (this.plugin as unknown as { llmClient: LLMClient | null }).llmClient;
    if (!llmClient) {
      return { ok: false, error: 'LLM client not configured. Open Settings → LLM Provider.' };
    }
    // ollama / lmstudio accept empty API key (same gate as initializeLLMClient)
    if (!resolveProviderApiKey(
      { apiKey: this.settings.apiKey, providerApiKeySecretId: this.settings.providerApiKeySecretId },
      this.app.secretStorage,
    ) && !isLocalNoKeyProvider(this.settings.provider)) {
      return { ok: false, error: 'API key not configured.' };
    }
    if (!this.settings.model) {
      return { ok: false, error: 'Model not selected.' };
    }
    return {
      ok: true,
      provider: this.settings.provider,
      model: resolveModelForTask(this.settings, 'ingest'),
    };
  }

  // === Full Stop ===

  stop(): void {
    this.stopWatching();
    this.clearPeriodicLint();
    this.clearDebounce();
    this.pendingFiles.clear();
  }
}
