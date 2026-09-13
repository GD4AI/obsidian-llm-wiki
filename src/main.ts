import { Plugin, Notice, TFolder, TFile, normalizePath } from 'obsidian';

import {
  LLMWikiSettings,
  LLMClient,
  IngestReport,
} from './types';
import { NOTICE_NORMAL, NOTICE_ABORT, MINERU_API_TOKEN_SECRET_ID } from './constants';
import { preloadLLMClientModules } from './llm-sdk/create-llm-client';
import { isProviderConfigured } from './core/provider-auth';
import { resolveProviderApiKey } from './llm-sdk/provider-api-key-resolver';
import { createLLMClient } from './core/create-plugin-llm-client';
import { CodexAuthManager } from './llm-sdk/openai-codex/auth-manager';
import { BedrockAuthManager } from './llm-sdk/bedrock-sso/credential-manager';
import { BEDROCK_SSO_SECRET_ID, BEDROCK_IAM_SECRET_ID } from './llm-sdk/bedrock-sso/constants';
import { CodexCredentialStore } from './llm-sdk/openai-codex/credential-store';
import { obsidianFetchBridge } from './core/obsidian-fetch-bridge';
import type { FetchLike } from './llm-sdk/openai-codex/types';

// v1.23.0 P1-7: AI-SDK migration. Eagerly preload SDK modules on plugin
// load so sync `createLLMClient` works without blocking. Failure is
// non-fatal: falls back to legacy llm-client at createLLMClient time.
const aiSdkModulesLoaded: Promise<void> = preloadLLMClientModules().catch((err) => {
  console.warn('[v1.23.0 LLM migration] Failed to preload AI-SDK modules:', err);
});

export async function initializeLLMClientAfterModules(modulesLoaded: Promise<void>, initialize: () => void): Promise<void> {
  try {
    await modulesLoaded;
  } catch (error) {
    console.warn('[v1.23.0 LLM migration] Failed to preload AI-SDK modules:', error);
  }
  initialize();
}

export { createLLMClient };
import { TEXTS } from './texts';
import { getText } from './core/i18n';
import { applySettingsMigrations, commitSettingsMigrationV1_25_3 } from './core/settings-migrations';
import { normalizeVocabularyCsv } from './core/tag-vocab';
import { detectStaleWikiFolders } from './core/query-history-migration-check';
import { BatchProgress } from './core/status-bar';
import { IngestQueue } from './core/ingest-queue';
import { decideProgressDisplay, ProgressScope } from './core/progress-notification';
import { WikiEngine } from './wiki/wiki-engine';
import { QueryView, VIEW_TYPE_QUERY } from './wiki/query-engine';
import { IngestReportModal, ConfirmModal } from './ui/modals';
import { SchemaManager } from './schema/schema-manager';
import { AutoMaintainManager } from './schema/auto-maintain';

// v1.25.1 Phase C-PR3: Mixin method implementations.
import { pdfCacheCommands } from './main-commands/pdf-cache-commands';
import type { PdfCacheMethods } from './main-commands/pdf-cache-commands';
import { connectionCommands } from './main-commands/connection-commands';
import type { ConnectionCommandsMethods } from './main-commands/connection-commands';
import { schemaCommands } from './main-commands/schema-commands';
import type { SchemaCommandsMethods } from './main-commands/schema-commands';
import { queryLintCommands } from './main-commands/query-lint-commands';
import type { QueryLintMethods } from './main-commands/query-lint-commands';
import { ingestCommands } from './main-commands/ingest-commands';
import type { IngestMethods } from './main-commands/ingest-commands';
import { registerWikiCommands } from './main-commands/command-registry';
import { codexAuthCommands } from './main-commands/codex-auth-commands';
import type { CodexAuthCommandsMethods } from './main-commands/codex-auth-commands';
import { secretStorageCommands } from './main-commands/secret-storage-commands';
import type { SecretStorageCommandsMethods } from './main-commands/secret-storage-commands';

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- C-PR3: intentional interface+class merge for mixin pattern
export class LLMWikiPlugin extends Plugin {
  settings: LLMWikiSettings;
  llmClient: LLMClient | null = null;
  wikiEngine: WikiEngine;
  schemaManager: SchemaManager;
  autoMaintainManager: AutoMaintainManager;
  codexAuthManager: CodexAuthManager | null = null;
  codexCredentialStore: CodexCredentialStore | null = null;
  /** #425 Bedrock Stage 2 — SSO/IAM credential orchestrator. */
  bedrockAuthManager: BedrockAuthManager | null = null;
  ingestQueue: IngestQueue = new IngestQueue();
  progressNotice: Notice | null = null;
  ingestStatusBar: HTMLElement | null = null;
  batchProgress: BatchProgress | null = null;
  async onload() {
    await this.loadSettings();
    this.codexCredentialStore = new CodexCredentialStore(this.app.secretStorage, this.settings.openAICodexSecretId);
    this.codexAuthManager = new CodexAuthManager({
      store: this.codexCredentialStore,
      fetchFn: obsidianFetchBridge as unknown as FetchLike,
      openExternal: (url) => this.openExternal(url),
    });
    await this.clearUnboundOpenAICodexModelCache();
    // #425 Bedrock Stage 2 — SSO/IAM credential orchestrator over
    // SecretStorage; fetchFn is the same bridge the SDK clients use.
    this.bedrockAuthManager = new BedrockAuthManager({
      ssoSecretId: BEDROCK_SSO_SECRET_ID,
      iamSecretId: BEDROCK_IAM_SECRET_ID,
      secretStorage: this.app.secretStorage,
      fetchFn: obsidianFetchBridge as unknown as (url: string, init?: RequestInit) => Promise<Response>,
    });
    this.cleanupVocabularyTags();
    await initializeLLMClientAfterModules(aiSdkModulesLoaded, () => this.initializeLLMClient());

    this.schemaManager = new SchemaManager(
      this.app,
      this.settings,
      () => this.llmClient
    );

    this.wikiEngine = new WikiEngine(
      this.app,
      this.settings,
      () => this.llmClient,
      this.schemaManager,
      // Delayed evaluation: this closure captures autoMaintainManager by reference,
      // but the variable is assigned below. By the time wikiEngine calls
      // this callback (during file writes), autoMaintainManager is guaranteed
      // to exist. This is intentional — reordering the assignments would break it.
      (path: string) => this.autoMaintainManager.watchWrite(path),
      (msg: string) => {
        if (this.ingestStatusBar) {
          this.ingestStatusBar.setText(msg);
          this.ingestStatusBar.removeClass('llm-wiki-status-bar-hidden');
        }
        this.showProgressFor(ProgressScope.IngestAutoWatch, msg);
      },
      (report: IngestReport) => this.onIngestDoneDispatch(report),
      (typeof activeWindow !== 'undefined' ? activeWindow.crypto : undefined)?.subtle
    );

    // #164: when an interactive ingest hits a duplicate, ask the user whether to
    // re-ingest. Folder/watcher ingests leave this unused and auto-skip.
    this.wikiEngine.onConfirmReingest = (file) => new Promise<boolean>((resolve) => {
      const lang = this.settings.language;
      new ConfirmModal(this.app, {
        title: getText(lang, 'reingestConfirmTitle'),
        body: getText(lang, 'reingestConfirmBody').replace('{filename}', file.basename),
        confirmText: getText(lang, 'reingestConfirmYes'),
        cancelText: getText(lang, 'reingestConfirmNo'),
        onChoice: resolve,
      }).open();
    });

    this.autoMaintainManager = new AutoMaintainManager(
      this.app,
      this.settings,
      this.wikiEngine,
      this,
      () => this.lintWiki('auto')
    );

    void this.performPdfCacheHousekeeping();

    if (this.settings.autoWatchSources) {
      this.autoMaintainManager.startWatching();
    }
    this.autoMaintainManager.schedulePeriodicLint();
    void this.autoMaintainManager.runStartupCheck();

    this.registerView(
      VIEW_TYPE_QUERY,
      (leaf) => new QueryView(leaf, this)
    );

    // v1.25.1 Phase C-PR3: command registration, ribbon icons, status
    // bar, and wiki-engine callbacks extracted to command-registry.ts.
    registerWikiCommands(this);

    this.checkQueryHistoryForStaleFolders();

    // Startup self-heal: sources under wiki/sources record which note they
    // came from; a source missing its wiki-ingested marker means a past run
    // succeeded but the stamp was lost (older version, crash between page
    // write and marker write). Re-stamp so skipWikiIngested sees the truth.
    this.app.workspace.onLayoutReady(() => {
      void this.repairMissingWikiMarkers();
    });

    console.debug('LLM Wiki Plugin loaded - Karpathy implementation');
  }

  private async repairMissingWikiMarkers(): Promise<void> {
    const sourcesFolder = this.app.vault.getAbstractFileByPath(
      normalizePath(`${this.settings.wikiFolder}/sources`)
    );
    if (!(sourcesFolder instanceof TFolder)) return;

    const repaired: string[] = [];
    for (const child of sourcesFolder.children) {
      if (!(child instanceof TFile) || child.extension !== 'md') continue;
      try {
        const page = await this.app.vault.read(child);
        // source_file frontmatter references the originating note (wikilink
        // or bare path — Obsidian has written both shapes historically).
        const fmEnd = page.startsWith('---') ? page.indexOf('\n---', 3) : -1;
        if (fmEnd === -1) continue;
        const fmText = page.substring(3, fmEnd);
        const sourceMatch =
          fmText.match(/^source_file:[ \t]*"\[\[(.+?)\]\]"/m) ??
          fmText.match(/^source_file:[ \t]*\[\[(.+?)\]\]/m) ??
          fmText.match(/^source_file:[ \t]*"?([^"\n]+?)"?[ \t]*$/m);
        if (!sourceMatch) continue;

        const sourcePath = sourceMatch[1].trim();
        const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath) ??
          this.app.vault.getAbstractFileByPath(`${sourcePath}.md`);
        if (!(sourceFile instanceof TFile) || sourceFile.extension !== 'md') continue;

        const sourceContent = await this.app.vault.read(sourceFile);
        if (!sourceContent.startsWith('---')) continue;
        if (/^wiki-ingested:/m.test(sourceContent.substring(3, sourceContent.indexOf('\n---', 3)))) continue;

        await this.app.fileManager.processFrontMatter(sourceFile, fm => {
          (fm as Record<string, unknown>)['wiki-ingested'] = new Date().toISOString().slice(0, 10);
        });
        repaired.push(sourceFile.path);
      } catch (error) {
        // One unreadable page must not block the rest of the sweep.
        console.warn('[wiki-marker-repair] failed on', child.path, error);
      }
    }
    if (repaired.length > 0) {
      console.debug(`[wiki-marker-repair] re-stamped ${repaired.length} source marker(s):`, repaired);
      new Notice(
        getText(this.settings.language, 'wikiIngestedMarkerRepaired').replace('{count}', String(repaired.length)),
        NOTICE_NORMAL
      );
    }
  }

  private checkQueryHistoryForStaleFolders(): void {
    const history = this.settings.queryHistory;
    if (!Array.isArray(history) || history.length === 0) return;
    const detection = detectStaleWikiFolders(history, this.settings.wikiFolder);
    if (!detection || !detection.hasStale) return;
    new Notice(getText(this.settings.language, 'queryHistoryMigrationNotice'), NOTICE_NORMAL);
  }

  onunload() {
    this.codexAuthManager?.dispose();
    // #425: drop in-memory temp credentials ONLY — the persisted SSO
    // token survives so the user stays signed in across restarts.
    this.bedrockAuthManager?.dispose();
    this.autoMaintainManager?.stop();
    console.debug('LLM Wiki Plugin unloaded');
  }

  /**
   * #425 Bedrock Stage 2 — AWS-credential presence for the active
   * bedrock provider mode. Returns undefined when the active provider/
   * mode doesn't use AWS credentials (non-bedrock or api-key mode), so
   * isProviderConfigured keeps legacy semantics there.
   */
  private bedrockCredentialPresence(): boolean | undefined {
    // Manager not constructed yet (early loadSettings path): report
    // unknown so legacy semantics apply rather than a false negative.
    if (!this.bedrockAuthManager) return undefined;
    if (!this.settings.provider.startsWith('bedrock-')) return undefined;
    const method = this.settings.bedrockAuthMethod ?? 'api-key';
    if (method === 'sso') return this.bedrockAuthManager.hasSsoToken() === true;
    if (method === 'iam') return this.bedrockAuthManager.hasIamKeys() === true;
    return undefined;
  }

  async loadSettings() {
    const savedData = await this.loadData() as Partial<LLMWikiSettings> | null;
    const { settings, applied } = applySettingsMigrations(savedData);

    // v1.25.3 #182: forward the legacy plaintext API key (if any) into
    // Obsidian SecretStorage. applySettingsMigrations is pure and cannot
    // touch IO, so it stashes the legacy value on a transient field;
    // main.ts owns the actual SecretStorage write and the cleanup.
    //
    // v1.25.4 #339: two-phase migration. Phase 1 (in applySettingsMigrations)
    // only stashes the legacy key but NO LONGER wipes settings.apiKey.
    // Phase 2 (commitSettingsMigrationV1_25_3) runs here ONLY after the
    // IO write succeeds. On failure, plaintext survives in memory and
    // on disk — no data loss.
    let migrationWriteFailed = false;
    if (applied.includes('v1.25.3-secret-storage')) {
      const legacy = (settings as unknown as { _legacyApiKeyForSecretStorage?: string })._legacyApiKeyForSecretStorage;
      if (typeof legacy === 'string' && legacy.length > 0) {
        try {
          this.app.secretStorage.setSecret(settings.providerApiKeySecretId, legacy);
          // Phase 2: IO succeeded → wipe plaintext (now safely in OS keychain)
          commitSettingsMigrationV1_25_3(settings);
          console.debug('[main.loadSettings] Legacy apiKey migrated to SecretStorage');
        } catch (error) {
          // Phase 1 ran but IO failed. Phase 2 NOT called — settings.apiKey
          // still has the plaintext, so the resolver falls through to it.
          // Marker stays set (phase 1 idempotent), and on next load the
          // migration re-detects the plaintext from disk and re-retries.
          console.error('[main.loadSettings] Failed to migrate apiKey into SecretStorage; plaintext retained:', error);
          migrationWriteFailed = true;
        }
      }
      // Delete the transient field regardless; it must never persist to data.json.
      delete (settings as unknown as { _legacyApiKeyForSecretStorage?: string })._legacyApiKeyForSecretStorage;
      // On write failure the marker is still set (phase 1 ran), so the
      // migration does NOT re-run on the next load (idempotent). The
      // plaintext lives on in settings.apiKey and data.json — no data loss.
    }

    this.settings = settings;

    const legacyMineru = this.settings as LLMWikiSettings & {
      mineruApiToken?: string;
      mineruTaskTimeoutMinutes?: number;
    };
    if ('mineruApiToken' in legacyMineru || 'mineruTaskTimeoutMinutes' in legacyMineru) {
      try {
        const token = legacyMineru.mineruApiToken?.trim();
        if (token && !this.app.secretStorage.getSecret(MINERU_API_TOKEN_SECRET_ID)) {
          this.app.secretStorage.setSecret(MINERU_API_TOKEN_SECRET_ID, token);
        }
        delete legacyMineru.mineruApiToken;
        delete legacyMineru.mineruTaskTimeoutMinutes;
        // No saveData() here: the line below (`applied.length > 0 && !migrationWriteFailed`)
        // handles persistence for the whole loadSettings pass. Adding a second write would
        // serialize data.json twice on every upgrade that triggers the MinerU migration.
      } catch (error) {
        console.error('[main.loadSettings] Failed to migrate MinerU token to SecretStorage:', error);
      }
    }

    if (savedData && !savedData.wikiLanguage) {
      this.settings.wikiLanguage = this.settings.language;
      await this.saveData(this.settings);
    }

    if (!Array.isArray(this.settings.watchedFolders)) {
      this.settings.watchedFolders = [];
      console.debug('loadSettings: watchedFolders was not an array, reset to []');
    }

    if (applied.length > 0 && !migrationWriteFailed) {
      console.debug(`loadSettings: applied migrations: ${applied.join(', ')}`);
      await this.saveData(this.settings);
    }

    console.debug(
      '[main.loadSettings] settings.queryHistory =',
      Array.isArray(this.settings.queryHistory) ? `${this.settings.queryHistory.length} messages` : 'NOT an array'
    );

    if (savedData && !('llmReady' in savedData)) {
      const hasCodexCredential = new CodexCredentialStore(this.app.secretStorage, this.settings.openAICodexSecretId).hasCredential();
      // v1.25.3 #182: resolve the live key from SecretStorage so the
      // gate correctly considers a key that lives in OS keychain rather
      // than the (now-empty) settings.apiKey.
      const resolvedKey = resolveProviderApiKey(
        { apiKey: this.settings.apiKey, providerApiKeySecretId: this.settings.providerApiKeySecretId },
        this.app.secretStorage,
      );
      const bedrockPresence = this.bedrockCredentialPresence();
      const hasConfig = isProviderConfigured({
        provider: this.settings.provider,
        apiKey: resolvedKey,
        model: this.settings.model,
        hasCodexCredential,
        ...(bedrockPresence !== undefined && {
          bedrockAuthMethod: this.settings.bedrockAuthMethod,
          hasBedrockCredential: bedrockPresence,
        }),
      });
      this.settings.llmReady = hasConfig;
      if (hasConfig) {
        console.debug('loadSettings: existing user with config detected, llmReady = true');
      }
    }
  }

  private cleanupVocabularyTags(): void {
    const fields: ('customEntityTags' | 'customConceptTags')[] = [
      'customEntityTags',
      'customConceptTags',
    ];
    let changed = false;
    for (const field of fields) {
      const current = this.settings[field];
      if (!current) continue;
      const cleaned = normalizeVocabularyCsv(current);
      if (cleaned !== current) {
        this.settings[field] = cleaned;
        changed = true;
      }
    }
    if (changed) void this.saveSettings();
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.initializeLLMClient();
    this.schemaManager?.updateSettings(this.settings);
    if (this.wikiEngine) {
      const wikiFolderChanged = this.wikiEngine.updateSettings(this.settings);
      console.debug('[saveSettings] wikiEngine provider updated to:', this.settings.provider);
      if (wikiFolderChanged) {
        this.invalidateAllQueryGraphs();
        this.checkQueryHistoryForStaleFolders();
      }
    }
    if (this.autoMaintainManager) {
      this.autoMaintainManager.settings = this.settings;
      this.autoMaintainManager.stop();
      if (this.settings.autoWatchSources) {
        this.autoMaintainManager.startWatching();
      }
      this.autoMaintainManager.schedulePeriodicLint();
    }
  }

  initializeLLMClient(): void {
    const hasCodexCredential = this.codexAuthManager?.hasCredential() === true;
    // v1.25.3 #182: resolve from SecretStorage so the gate sees the
    // live key (post-migration `settings.apiKey` is normally '').
    const resolvedKey = resolveProviderApiKey(
      { apiKey: this.settings.apiKey, providerApiKeySecretId: this.settings.providerApiKeySecretId },
      this.app.secretStorage,
    );
    const bedrockPresence = this.bedrockCredentialPresence();
    if (!isProviderConfigured({
      provider: this.settings.provider,
      apiKey: resolvedKey,
      model: this.settings.model,
      hasCodexCredential,
      ...(bedrockPresence !== undefined && {
        bedrockAuthMethod: this.settings.bedrockAuthMethod,
        hasBedrockCredential: bedrockPresence,
      }),
    })) {
      this.llmClient = null;
      return;
    }
    try {
      // v1.25.3 #182: pass `app.secretStorage` so the SDK factory reads
      // the live key from OS keychain rather than the empty
      // settings.apiKey (post-migration).
      this.llmClient = createLLMClient(this.settings, this.codexAuthManager ?? undefined, this.manifest.version, this.app.secretStorage, undefined, this.bedrockAuthManager ?? undefined);
      console.debug('LLM Client initialized:', this.settings.provider);
    } catch (error) {
      console.error('LLM Client initialization failed:', error);
      this.llmClient = null;
    }
  }

  // ==================== Progress helpers ====================

  private showProgress(msg: string): void {
    this.showProgressFor(ProgressScope.IngestManual, msg);
  }

  private showProgressFor(scope: ProgressScope, msg: string): void {
    const decision = decideProgressDisplay(scope, false, true);
    if (decision.display === 'notice+status-bar') {
      if (this.progressNotice) {
        this.progressNotice.setMessage(msg);
      } else {
        this.progressNotice = new Notice(msg, 0);
      }
    }
    this.ingestStatusBar?.removeClass('llm-wiki-status-bar-hidden');
  }

  private dismissProgress(): void {
    if (this.progressNotice) {
      this.progressNotice.hide();
      this.progressNotice = null;
    }
  }

  // ==================== Ingest dispatch ====================

  private onIngestDoneDispatch(report: IngestReport): void {
    this.invalidateAllQueryGraphs();
    if (report.trigger === 'auto') {
      this.onAutoIngestDone(report);
    } else {
      this.dismissProgress();
      new IngestReportModal(this.app, report, this.settings.language).open();
    }
  }

  private onAutoIngestDone(report: IngestReport): void {
    this.dismissProgress();
    const level = this.settings.autoIngestNotificationLevel;
    if (level === 'modal') {
      new IngestReportModal(this.app, report, this.settings.language).open();
      return;
    }
    const texts = TEXTS[this.settings.language];
    const summary = report.createdPages?.length > 0
      ? texts.ingestionCreatedPages.replace('{count}', String(report.createdPages.length))
      : texts.ingestionUpdatedPages.replace('{count}', String(report.updatedPages.length));
    const hint = getText(this.settings.language, 'ingestionNoticeHistoryHint');
    new Notice(`✅ ${report.sourceFile}: ${summary}. ${hint}`, NOTICE_ABORT);
  }
}

// v1.25.1 Phase C-PR3: Interface merge — makes tsc see mixed-in
// method signatures on the LLMWikiPlugin instance type.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- C-PR3 mixin pattern
export interface LLMWikiPlugin extends PdfCacheMethods, ConnectionCommandsMethods,
  SchemaCommandsMethods, QueryLintMethods, IngestMethods, CodexAuthCommandsMethods, SecretStorageCommandsMethods {}

// v1.25.1 Phase C-PR3: prototype injection — copies runtime
// implementations from each mixin module onto the class prototype.
Object.assign(LLMWikiPlugin.prototype, pdfCacheCommands, connectionCommands,
  schemaCommands, queryLintCommands, ingestCommands, codexAuthCommands, secretStorageCommands);

export default LLMWikiPlugin;
