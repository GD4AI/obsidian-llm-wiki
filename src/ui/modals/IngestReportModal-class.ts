// IngestReportModal — displays a structured ingest report after a source
// file or batch ingest operation.
//
// Sections rendered in order:
//   1. Title with success/warning status emoji
//   2. Source file path
//   3. Skipped files (batch ingest only)
//   4. Elapsed time
//   5. Stats (created / updated / contradictions)
//   6. Created / updated / failed page lists
//   7. Rejected / skipped files (requirements gate, #164)
//   8. Error message (if any)
//   9. Close button
//
// Extracted from the original `src/ui/modals.ts` god file (PR split).
// No behavior change — pure code movement.

import { App, Modal } from 'obsidian';
import type { IngestReport } from '../../types';
import { TEXTS } from '../../texts';
import { getText } from '../../core/i18n';
import type { RejectionReason } from '../../core/source-requirements';

export class IngestReportModal extends Modal {
  private report: IngestReport;
  private language: string;

  constructor(app: App, report: IngestReport, language: string = 'en') {
    super(app);
    this.report = report;
    this.language = language;
  }

  private t(key: string): string {
    return getText(this.language, key as keyof typeof TEXTS.en) || key;
  }

  /** Map a gate rejection reason to its short localized label key. Mirrors WikiEngine.rejectionNoticeKey. */
  private reasonLabelKey(reason: RejectionReason): string {
    if (reason === 'incompatible-type') return 'rejectionReasonType';
    if (reason === 'duplicate') return 'rejectionReasonDuplicate';
    if (reason === 'unsupported-pdf') return 'rejectionReasonPdfUnsupported';
    if (reason === 'mineru-page-limit') return 'rejectionReasonMineruPageLimit';
    if (reason === 'mineru-size-limit') return 'rejectionReasonMineruSizeLimit';
    return 'rejectionReasonEmpty';
  }

  onOpen() {
    const { sourceFile, createdPages, updatedPages, entitiesCreated, conceptsCreated, failedItems, contradictionsFound, success, errorMessage, elapsedSeconds, skippedFiles, totalFilesInFolder, rejectedFiles, embeddedImageAnalysis } = this.report;

    const statusEmoji = success ? '✅' : '⚠️';
    this.contentEl.createEl('h2', { text: `${statusEmoji} ${this.t('ingestReportTitle')}` });

    // Source file
    this.contentEl.createEl('p', { text: `${this.t('ingestReportSourceFile')}：${sourceFile}` });

    // Skipped files (batch ingest only)
    if (skippedFiles !== undefined && skippedFiles > 0) {
      this.contentEl.createEl('p', {
        text: `${this.t('ingestReportSkippedFiles')}: ${skippedFiles}/${totalFilesInFolder || skippedFiles}`,
        attr: { style: 'color: var(--text-muted); font-size: 13px;' }
      });
    }

    // Elapsed time
    if (elapsedSeconds !== undefined) {
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      const timeStr = minutes > 0
        ? `${minutes} ${this.t('timeMinutes')} ${seconds} ${this.t('timeSeconds')}`
        : `${seconds} ${this.t('timeSeconds')}`;
      this.contentEl.createEl('p', { text: `${this.t('ingestReportElapsedTime')}：${timeStr}` });
    }

    // Stats
    const statsEl = this.contentEl.createDiv({ attr: { style: 'margin: 12px 0;' } });
    const createdText = this.t('ingestReportCreatedPages').replace('{count}', String(createdPages.length));
    const breakdown = entitiesCreated > 0 || conceptsCreated > 0
      ? ` (${this.t('ingestReportEntitiesCount').replace('{count}', String(entitiesCreated))} + ${this.t('ingestReportConceptsCount').replace('{count}', String(conceptsCreated))})`
      : '';
    statsEl.createEl('p', { text: createdText + breakdown });
    statsEl.createEl('p', { text: this.t('ingestReportUpdatedPages').replace('{count}', String(updatedPages.length)) });
    if (embeddedImageAnalysis) {
      statsEl.createEl('p', { text: this.t('ingestReportEmbeddedImages')
        .replace('{sent}', String(embeddedImageAnalysis.sent))
        .replace('{discovered}', String(embeddedImageAnalysis.discovered))
        .replace('{queued}', String(embeddedImageAnalysis.queued))
        .replace('{analyzed}', String(embeddedImageAnalysis.analyzed))
        .replace('{packages}', String(embeddedImageAnalysis.packages))
        .replace('{gifs}', String(embeddedImageAnalysis.convertedGifs))
        .replace('{failed}', String(embeddedImageAnalysis.failedPackages)) });
      if (embeddedImageAnalysis.evidenceSaved) {
        statsEl.createEl('p', { text: this.t('ingestReportEmbeddedEvidenceSaved') });
      }
    }
    if (contradictionsFound > 0) {
      statsEl.createEl('p', { text: this.t('ingestReportContradictionsFound').replace('{count}', String(contradictionsFound)) });
    }

    // Created pages
    if (createdPages.length > 0) {
      this.contentEl.createEl('h3', { text: this.t('ingestReportCreated') });
      const list = this.contentEl.createEl('ul');
      for (const page of createdPages) {
        list.createEl('li', { text: page });
      }
    }

    // Updated pages
    if (updatedPages.length > 0) {
      this.contentEl.createEl('h3', { text: this.t('ingestReportUpdated') });
      const list = this.contentEl.createEl('ul');
      for (const page of updatedPages) {
        list.createEl('li', { text: page });
      }
    }

    // Failed items
    if (failedItems.length > 0) {
      this.contentEl.createEl('h3', { text: '⚠️ ' + this.t('ingestReportFailedTitle') });
      const list = this.contentEl.createEl('ul');
      for (const item of failedItems) {
        const typeLabel = item.type === 'entity' ? this.t('ingestReportEntityType') : this.t('ingestReportConceptType');
        list.createEl('li', { text: `[${typeLabel}] ${item.name} — ${item.reason}` });
      }
      this.contentEl.createEl('p', {
        text: this.t('ingestReportFailedGuidance'),
        attr: { style: 'color: var(--text-muted); margin-top: 8px; font-size: 13px;' }
      });
    }

    // Rejected / skipped files (requirements gate, #164)
    if (rejectedFiles && rejectedFiles.length > 0) {
      this.contentEl.createEl('h3', { text: '⏭️ ' + this.t('ingestReportRejectedFiles') + ` (${rejectedFiles.length})` });
      const list = this.contentEl.createEl('ul');
      for (const r of rejectedFiles) {
        const name = r.path.split('/').pop() || r.path;
        list.createEl('li', { text: `${name} — ${this.t(this.reasonLabelKey(r.reason))}` });
      }
    }

    if (embeddedImageAnalysis && embeddedImageAnalysis.skipped.length > 0) {
      this.contentEl.createEl('h3', { text: this.t('ingestReportEmbeddedImageSkipped') });
      const list = this.contentEl.createEl('ul');
      for (const skipped of embeddedImageAnalysis.skipped) {
        const name = skipped.path.split('/').pop() || skipped.path;
        list.createEl('li', { text: `${name} — ${skipped.reason}` });
      }
    }

    // Error
    if (errorMessage) {
      this.contentEl.createEl('p', {
        text: `${this.t('ingestReportErrorDetail')}：${errorMessage}`,
        attr: { style: 'color: var(--text-error); margin-top: 12px;' }
      });
    }

    // Close button
    const btnRow = this.contentEl.createDiv({ attr: { style: 'margin-top: 16px; text-align: right;' } });
    btnRow.createEl('button', { text: this.t('ingestReportClose') }).addEventListener('click', () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}
