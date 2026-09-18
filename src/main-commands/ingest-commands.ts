/**
 * v1.25.1 Phase C-PR3: Ingest commands.
 *
 * Extracted from main.ts (lines 587-927). Covers the 5 ingest
 * entry points and the batch pipeline.
 *
 * Cross-mixin dependencies:
 *   - requireLLMReady()          → ConnectionCommandsHost
 *   - preparePdfCacheForBatchIngest()  → PdfCacheHost
 *   - showProgressFor / dismissProgress → core methods (main retains)
 *   - ingestQueue / batchProgress        → core fields (promoted to public)
 *
 * WARNING: batchProgress = { current: i+1, total: ingestCount } is
 * read by the status-bar callback (registered in command-registry).
 * The shared mutation across async boundaries is intentional.
 */

import { Notice, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type { LLMWikiSettings, LLMClient, IngestReport } from '../types';
import type { WikiEngine } from '../wiki/wiki-engine';
import type { IngestQueue } from '../core/ingest-queue';
import type { BatchProgress } from '../core/status-bar';
import { TEXTS } from '../texts';
import { getText } from '../core/i18n';
import { slugify } from '../core/slug';
import { pageBelongsToNote } from '../core/ingest-state';
import { isIngestableSource } from '../core/folder-scope';
import { COMPATIBLE_SOURCE_EXTENSIONS, NOTICE_NORMAL, NOTICE_ERROR } from '../constants';
import { FileSuggestModal, FolderSuggestModal, MultiFileSuggestModal, IngestReportModal } from '../ui/modals';
import { ProgressScope } from '../core/progress-notification';

export interface IngestHost {
  app: App;
  settings: LLMWikiSettings;
  llmClient: LLMClient | null;
  wikiEngine: WikiEngine;
  ingestQueue: IngestQueue;
  batchProgress: BatchProgress | null;
  requireLLMReady(): boolean;
  showProgressFor(scope: ProgressScope, msg: string): void;
  dismissProgress(): void;
  preparePdfCacheForBatchIngest(): Promise<void>;
  /** Self-references: co-members of this mixin. */
  runBatchIngest?(files: TFile[], jobIds: string[], sourceLabel: string): Promise<void>;
  isAlreadyIngested?(sourceFile: TFile): Promise<boolean>;
}

export interface IngestMethods {
  selectSourceToIngest(): void;
  ingestActiveFile(): void;
  selectFolderToIngest(): void;
  selectMultipleFilesToIngest(): void;
}

export const ingestCommands = {
  async isAlreadyIngested(this: IngestHost, sourceFile: TFile): Promise<boolean> {
    const slug = slugify(sourceFile.basename, this.settings.slugCase === 'preserve');
    const wikiPath = `${this.settings.wikiFolder}/sources/${slug}.md`;

    try {
      const file = this.app.vault.getAbstractFileByPath(wikiPath);
      if (!(file instanceof TFile)) return false;

      try {
        const content = await this.app.vault.read(file);
        // Ownership: the page found by slug belongs to this note only if
        // the note is one of its recorded origins. Reading `sources:`
        // alone never established that — it holds `[[sources/X]]` links
        // by contract, so the note path being searched for is the one
        // shape it cannot contain, and every multi-source page read as
        // "not ingested". `pageBelongsToNote` holds that decision; the
        // file picker (#598) displays the same answer and must not
        // reimplement it.
        return pageBelongsToNote(content, sourceFile.path);
      } catch {
        return true;
      }
    } catch {
      return false;
    }
  },

  selectSourceToIngest(this: IngestHost): void {
    if (!this.requireLLMReady()) return;
    if (!this.llmClient) {
      new Notice(TEXTS[this.settings.language].errorNoApiKey);
      return;
    }

    new FileSuggestModal(this.app, this.settings.wikiFolder, (file: TFile) => {
      // B2.5 follow-up (v1.26.3 PATCH): 'Ingesting: <file>' was hardcoded
      // English — route through getText so the Toast honors the locale.
      this.showProgressFor(ProgressScope.IngestManual,
        getText(this.settings.language, 'ingestSingleFileStart').replace('{filename}', file.basename));
      this.wikiEngine.ingestSource(file, { interactive: true }).catch(e => {
        console.error('Single ingest failed:', e);
        const errMsg = e instanceof Error ? e.message : String(e);
        new Notice(TEXTS[this.settings.language].errorIngestFailed + errMsg, NOTICE_ERROR);
        this.dismissProgress();
      });
    }).open();
  },

  ingestActiveFile(this: IngestHost): void {
    if (!this.requireLLMReady()) return;
    if (!this.llmClient) {
      new Notice(TEXTS[this.settings.language].errorNoApiKey);
      return;
    }

    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice(getText(this.settings.language, 'noActiveFile'), NOTICE_NORMAL);
      return;
    }

    this.showProgressFor(ProgressScope.IngestManual,
      getText(this.settings.language, 'ingestSingleFileStart').replace('{filename}', activeFile.basename));
    this.wikiEngine.ingestSource(activeFile, { interactive: true }).catch(e => {
      console.error('Ingest active file failed:', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      new Notice(TEXTS[this.settings.language].errorIngestFailed + errMsg, NOTICE_ERROR);
      this.dismissProgress();
    });
  },

  selectFolderToIngest(this: IngestHost): void {
    if (!this.requireLLMReady()) return;
    if (!this.llmClient) {
      new Notice(TEXTS[this.settings.language].errorNoApiKey);
      return;
    }

    new FolderSuggestModal(this.app, this.settings.wikiFolder, (folder) => {
      const allowedExts: readonly string[] = COMPATIBLE_SOURCE_EXTENSIONS;
      // v1.25.10 PATCH Issue #364 (consolidated with DocTpoint PR #370):
      // scope on the folder boundary, not on a bare string prefix. The
      // helper enforces a path-separator boundary and treats the vault
      // root as a wildcard ancestor. See core/folder-scope.ts for the
      // three cases a bare startsWith leaks (sibling-folder-with-prefix,
      // file-sitting-beside-the-folder, the folder itself).
      const files = this.app.vault.getFiles()
        .filter(f => allowedExts.includes(f.extension.toLowerCase()))
        .filter(f => isIngestableSource(
          f.path,
          folder.path,
          folder.isRoot(),
          this.settings.wikiFolder,
          this.app.vault.configDir,
        ));

      if (files.length === 0) {
        const msg = TEXTS[this.settings.language].selectFolderNoMdFiles.replace('{path}', folder.path);
        new Notice(msg);
        return;
      }

      void this.runBatchIngest!(files, [], `${files.length} files from ${folder.path}`);
    }).open();
  },

  selectMultipleFilesToIngest(this: IngestHost): void {
    if (!this.requireLLMReady()) return;
    if (!this.llmClient) {
      new Notice(TEXTS[this.settings.language].errorNoApiKey);
      return;
    }

    new MultiFileSuggestModal(
      this.app,
      this.settings,
      this.ingestQueue,
      (ids: string[], files: TFile[]) => {
        if (files.length === 0 || ids.length === 0) return;
        void this.runBatchIngest!(files, ids, `${files.length} manually-selected files`);
      },
    ).open();
  },

  async runBatchIngest(this: IngestHost, files: TFile[], jobIds: string[], sourceLabel: string): Promise<void> {
    void this.preparePdfCacheForBatchIngest();

    this.showProgressFor(ProgressScope.IngestManual,
      getText(this.settings.language, 'ingestCheckingExisting'));
    const alreadyIngestedFiles: TFile[] = [];
    const newFiles: TFile[] = [];
    const alignedJobIds: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const jobId = jobIds[i] ?? '';
      if (await this.isAlreadyIngested!(file)) {
        alreadyIngestedFiles.push(file);
      } else {
        newFiles.push(file);
        alignedJobIds.push(jobId);
      }
    }

    const totalFiles = files.length;
    const skippedCount = alreadyIngestedFiles.length;
    const ingestCount = newFiles.length;

    if (skippedCount > 0) {
      const texts = TEXTS[this.settings.language];
      new Notice(
        texts.batchIngestSkipNotice
          .replace('{skipped}', String(skippedCount))
          .replace('{total}', String(totalFiles))
          .replace('{new}', String(ingestCount)),
        6000
      );
    }

    if (ingestCount === 0) {
      const texts = TEXTS[this.settings.language];
      new Notice(texts.batchIngestAllIngested.replace('{total}', String(totalFiles)), NOTICE_NORMAL);
      return;
    }

    const reports: IngestReport[] = [];

    this.wikiEngine.setDoneCallback((report: IngestReport) => {
      reports.push(report);
    });

    const texts = TEXTS[this.settings.language];
    this.showProgressFor(ProgressScope.IngestManual, texts.batchIngestStarting
      .replace('{count}', String(ingestCount))
      .replace('{folder}', sourceLabel));

    const batchCtx = this.wikiEngine.createBatchContext();

    let resolvedJobIds: string[];
    if (jobIds.length > 0) {
      resolvedJobIds = alignedJobIds;
    } else {
      resolvedJobIds = this.ingestQueue.enqueue(newFiles);
    }

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const jobId = resolvedJobIds[i];

      try {
        if (jobId) {
          this.ingestQueue.start(jobId);
        }
        this.batchProgress = { current: i + 1, total: ingestCount };
        this.showProgressFor(ProgressScope.IngestManual, `[${i + 1}/${ingestCount}] ${file.basename}`);
        await this.wikiEngine.ingestSource(file, { batchCtx });
        if (this.wikiEngine.wasCancelled) {
          if (jobId) {
            this.ingestQueue.complete(jobId, false, 'Cancelled by user');
          }
          break;
        }
        if (jobId) {
          this.ingestQueue.complete(jobId, true);
        }
      } catch (error) {
        console.error(`(${i + 1}/${ingestCount}) ingestion failed: ${file.path}`, error);
        const errMsg = error instanceof Error ? error.message : String(error);
        new Notice(texts.errorIngestFailed + file.basename + ': ' + errMsg, NOTICE_ERROR);
        if (jobId) this.ingestQueue.complete(jobId, false, errMsg);
      }
    }

    this.batchProgress = null;
    this.dismissProgress();

    if (reports.length > 0) {
      const allCreated = [...new Set(reports.flatMap(r => r.createdPages))];
      const allUpdated = [...new Set(reports.flatMap(r => r.updatedPages))];
      const totalEntities = reports.reduce((sum, r) => sum + r.entitiesCreated, 0);
      const totalConcepts = reports.reduce((sum, r) => sum + r.conceptsCreated, 0);
      const totalContradictions = reports.reduce((sum, r) => sum + r.contradictionsFound, 0);
      const totalElapsed = reports.reduce((sum, r) => sum + (r.elapsedSeconds || 0), 0);
      const allFailedItems = reports.flatMap(r => r.failedItems);
      const allRejectedFiles = reports.flatMap(r => r.rejectedFiles || []);
      const allSuccess = reports.every(r => r.success);
      const imageReports = reports.map(r => r.embeddedImageAnalysis).filter((r): r is NonNullable<typeof r> => r !== undefined);
      const embeddedImageAnalysis = imageReports.length > 0 ? {
        discovered: imageReports.reduce((sum, r) => sum + r.discovered, 0),
        queued: imageReports.reduce((sum, r) => sum + r.queued, 0),
        sent: imageReports.reduce((sum, r) => sum + r.sent, 0),
        analyzed: imageReports.reduce((sum, r) => sum + r.analyzed, 0),
        packages: imageReports.reduce((sum, r) => sum + r.packages, 0),
        convertedGifs: imageReports.reduce((sum, r) => sum + r.convertedGifs, 0),
        failedPackages: imageReports.reduce((sum, r) => sum + r.failedPackages, 0),
        skipped: imageReports.flatMap(r => r.skipped),
        evidence: imageReports.flatMap(r => r.evidence),
        evidenceSaved: imageReports.some(r => r.evidenceSaved),
      } : undefined;

      const aggregated: IngestReport = {
        sourceFile: sourceLabel,
        createdPages: allCreated,
        updatedPages: allUpdated,
        entitiesCreated: totalEntities,
        conceptsCreated: totalConcepts,
        failedItems: allFailedItems,
        contradictionsFound: totalContradictions,
        success: allSuccess,
        elapsedSeconds: totalElapsed,
        skippedFiles: skippedCount,
        totalFilesInFolder: totalFiles,
        rejectedFiles: allRejectedFiles,
        ...(embeddedImageAnalysis ? { embeddedImageAnalysis } : {}),
      };

      new IngestReportModal(this.app, aggregated, this.settings.language).open();
    } else {
      const texts2 = TEXTS[this.settings.language];
      new Notice(texts2.batchIngestComplete
        .replace('{success}', '0')
        .replace('{total}', String(ingestCount))
        .replace('{fail}', String(ingestCount)), 10000);
    }
  },
};
