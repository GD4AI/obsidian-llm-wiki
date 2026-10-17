// PR #3 split: SuggestSaveModal extracted from query-engine.ts (69-114).
//
// Used as the post-query "save to wiki?" modal. Only QueryView.evaluateWithLLM
// opens one — no other caller in the codebase. Modal close-coupled with
// `plugin.wikiEngine` + `plugin.settings`, so extracting as a pure function
// is impractical. Kept as a thin class in its own file.

import { App, Modal, Notice } from 'obsidian';
import { TEXTS } from '../../texts';
import { NOTICE_NORMAL, NOTICE_ERROR } from '../../constants';
import type LLMWikiPlugin from '../../main';
import { hashConversation } from '../../core/conversation-hash';

export type QueryHistory = {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
};

export class SuggestSaveModal extends Modal {
  private plugin: LLMWikiPlugin;
  private history: QueryHistory;
  private reason: string;

  constructor(
    app: App,
    plugin: LLMWikiPlugin,
    history: QueryHistory,
    reason?: string,
  ) {
    super(app);
    this.plugin = plugin;
    this.history = history;
    this.reason = reason || '';
  }

  onOpen() {
    const { contentEl } = this;
    const texts = TEXTS[this.plugin.settings.language];

    contentEl.addClass('llm-wiki-suggest-save-modal');

    contentEl.createEl('h3', { text: texts.querySuggestSaveTitle });
    contentEl.createEl('p', { text: texts.querySuggestSaveDesc });

    if (this.reason) {
      const reasonBox = contentEl.createDiv({ cls: 'llm-wiki-suggest-save-reason' });
      reasonBox.createEl('strong', { text: 'Reason: ' });
      reasonBox.createSpan({ text: this.reason });
    }

    const buttonRow = contentEl.createDiv({ cls: 'llm-wiki-suggest-save-buttons' });

    buttonRow.createEl('button', { text: texts.querySuggestSaveYes, cls: 'mod-cta' })
      .addEventListener('click', () => {
        this.close();
        void this.doSave();
      });

    buttonRow.createEl('button', { text: texts.querySuggestSaveNo })
      .addEventListener('click', () => {
        this.close();
      });
  }

  private async doSave(): Promise<void> {
    const texts = TEXTS[this.plugin.settings.language];
    const progressNotice = new Notice(texts.savingToWiki, 0);

    const origProgress = this.plugin.wikiEngine.getProgressCallback();
    this.plugin.wikiEngine.setProgressCallback((msg: string) => {
      progressNotice.setMessage(msg);
    });

    try {
      const report = await this.plugin.wikiEngine.ingestConversation(this.history);
      // #756: a hash, not the transcript.
      this.plugin.settings.lastOfferedQueryHash = hashConversation(this.history.messages);
      void this.plugin.saveSettings();
      const summary = texts.saveSummary
        .replace('{entities}', String(report.entitiesCreated))
        .replace('{concepts}', String(report.conceptsCreated))
        .replace('{pages}', String(report.createdPages.length));
      new Notice(`${texts.saveToWikiSuccess}\n${summary}`, NOTICE_NORMAL);
    } catch (error) {
      console.error('Save failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      new Notice(texts.queryModalErrorPrefix + errorMsg, NOTICE_ERROR);
    } finally {
      progressNotice.hide();
      this.plugin.wikiEngine.setProgressCallback(origProgress);
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
