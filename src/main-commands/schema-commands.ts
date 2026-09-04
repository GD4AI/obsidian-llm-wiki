/**
 * v1.25.1 Phase C-PR3: Schema commands.
 *
 * Extracted from main.ts. Three methods that manage schema analysis,
 * diff modal, and regeneration.
 *
 * `suggestSchemaUpdate` is called by lintWiki via a callback
 * (`onAnalyzeSchema`). `openSchemaDiffModal` and
 * `regenerateSchemaWithHint` are private helpers used by
 * `suggestSchemaUpdate`.
 *
 * The SchemaDiffModal JSDoc (the `.open()` + `setCurrentBody` pattern)
 * is preserved from the original; the modal must open before its
 * content loads so the user sees the LLM proposal immediately.
 */

import { Notice } from 'obsidian';
import type { App } from 'obsidian';
import type { LLMWikiSettings, SchemaSuggestion } from '../types';
import type { SchemaManager as SchemaManagerType } from '../schema/schema-manager';
import type { WikiEngine } from '../wiki/wiki-engine';
import { TEXTS } from '../texts';
import { runSchemaAnalyze } from '../schema/analyze';
import { SchemaDiffModal } from '../ui/schema-diff-modal';
import { applySchemaSuggestion } from '../schema/apply-suggestion';
import { NOTICE_RATE_LIMIT, NOTICE_ERROR } from '../constants';

/** Host fields these methods need from the Plugin instance. */
export interface SchemaCommandsHost {
  app: App;
  settings: LLMWikiSettings;
  llmClient: import('../types').LLMClient | null;
  wikiEngine: WikiEngine;
  schemaManager: SchemaManagerType;
  requireLLMReady(): boolean;
}

export interface SchemaCommandsMethods {
  suggestSchemaUpdate(context?: string): Promise<void>;
}

export const schemaCommands = {
  async suggestSchemaUpdate(this: SchemaCommandsHost, context?: string): Promise<void> {
    await runSchemaAnalyze({
      settings: this.settings,
      llmClient: this.llmClient,
      wikiEngine: this.wikiEngine,
      schemaManager: this.schemaManager,
      requireLLMReady: () => this.requireLLMReady(),
      /** v1.22.0 #97: inline callback — opens SchemaDiffModal with LLM suggestion. */
      openSchemaDiffModal: (suggestion: SchemaSuggestion): void => {
        const t = (TEXTS as unknown as Record<string, Record<string, string>>)[this.settings.language]
          ?? TEXTS.en as unknown as Record<string, string>;
        console.debug('[SchemaDiffModal] suggestion.suggestions =', JSON.stringify(suggestion.suggestions), 'changes_needed =', suggestion.changes_needed, 'newSchemaBody length =', suggestion.newSchemaBody?.length);

        const isEmpty = !suggestion.changes_needed;
        const modal = new SchemaDiffModal(this.app, {
          currentBody: '',
          newBody: suggestion.newSchemaBody ?? '',
          language: this.settings.language,
          isEmpty,
          rationale: suggestion.suggestions,
          onOpenFile: () => {
            const path = `${this.settings.wikiFolder}/schema/config.md`;
            void this.app.workspace.openLinkText(path, '', false);
          },
          onApply: async () => {
            const result = await applySchemaSuggestion({
              app: this.app,
              currentPath: `${this.settings.wikiFolder}/schema/config.md`,
              newBody: suggestion.newSchemaBody ?? '',
              // The exact timestamp already written to this suggestion's suggestions.md entry, not a date derived from whenever the user happens to click Apply — lets the two files be cross-referenced by an exact string match even same-day.
              suggestionTimestamp: suggestion.timestamp,
              onCacheInvalidate: () => this.schemaManager.invalidateCache(),
            });
            if (result.success) {
              const restore = t.schemaDiffRestoreHint
                ? t.schemaDiffRestoreHint.replace('{path}', result.backupPath)
                : `Backup saved to ${result.backupPath}. To restore, rename that file back to wiki/schema/config.md in your file explorer.`;
              new Notice(restore, NOTICE_RATE_LIMIT);
            } else {
              new Notice(t.schemaDiffFailed ?? 'Schema apply failed: ' + result.reason, NOTICE_ERROR);
            }
          },
          onRegenerate: async (userHint: string) => {
            const ctx = `${suggestion.suggestions || ''}\n\nUser refinement: ${userHint || '(none)'}`;
            const newSuggestion = await this.schemaManager.suggestSchemaUpdate(ctx);
            if (newSuggestion?.newSchemaBody) {
              modal.setNewBody(newSuggestion.newSchemaBody, {
                rationale: newSuggestion.suggestions,
                isEmpty: !newSuggestion.changes_needed,
              });
            } else {
              new Notice(t.schemaRegenerateNoBody ?? 'Regeneration succeeded but the LLM did not return a new body.', NOTICE_ERROR);
            }
          },
        });
        modal.open();
        void this.schemaManager.loadSchema().then((loaded) => {
          modal.setCurrentBody(loaded?.body ?? '');
        });
      },
      lintAnalysisContext: context,
    });
  },
};
