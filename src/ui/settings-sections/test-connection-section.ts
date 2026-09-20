/**
 * v1.25.1 Phase C-PR2: Test Connection section renderer.
 *
 * Extracted from `LLMWikiSettingTab.display()`. Renders the Test
 * Connection button that probes the live LLM endpoint and on success
 * commits+persists immediately.
 *
 * Why extracted:
 *   - The Test Connection flow has subtle v1.24.1 PATCH Phase 5.5.0
 *     hotfix behavior (commit on success, rollback on failure,
 *     mark llmReady) that is easy to break during future edits.
 *     Isolating it makes the success/failure paths reviewable as a
 *     single unit.
 *
 * Invariants preserved:
 *   - On success: sync every field testLLMConnection may have mutated
 *     into tempSettings; commitTempSettings + saveSettings immediately
 *     so the new model takes effect without the user clicking Save.
 *   - On failure: roll back to oldSettings, do NOT save (broken
 *     config must not be persisted).
 *   - Final llmReady is set to result.success regardless of branch.
 */

import { Setting, Notice } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';
import { NOTICE_NORMAL, NOTICE_ERROR } from '../../constants';
import { preserveCodexRuntimeModelState } from '../../core/openai-codex-model-policy';

export function renderTestConnectionSection(tab: LLMWikiSettingTab, containerEl: HTMLElement): void {
  // v1.25.1 Phase C-PR2 simplify pass: applySettings triad (assign
  // plugin.settings + reinit LLM client + propagate to wikiEngine)
  // extracted to a local helper. Used by both success and rollback paths.
  const applySettings = (settings: typeof tab.plugin.settings): void => {
    tab.plugin.settings = settings;
    tab.plugin.initializeLLMClient();
    tab.plugin.wikiEngine?.updateSettings(settings);
  };

  new Setting(containerEl)
    .setName(tab.getText('testConnectionName'))
    .setDesc(tab.getText('testConnectionDesc'))
    .addButton(button => button
      .setButtonText(tab.getText('testButton'))
      .onClick(async () => {
        button.setButtonText(tab.getText('testing'));
        button.setDisabled(true);
        const testSettings = { ...tab.tempSettings };
        const oldSettings = tab.plugin.settings;
        applySettings(testSettings);
        // v1.25.7 PATCH: forward the in-memory typed key so testLLMConnection
        // honors it via the resolver's pendingKey parameter (bypassing the
        // stale SecretStorage value). See connection-commands.ts for the
        // matching signature change. Production callers (initializeLLMClient
        // etc.) pass undefined.
        const result = await tab.plugin.testLLMConnection(testSettings.apiKey);
        tab.tempSettings.llmReady = result.success;

        // Reset UI button + notice at one place (v1.25.8 simplify pass —
        // previously duplicated in flush-failure early-return).
        const resetUi = (): void => {
          button.setButtonText(tab.getText('testButton'));
          button.setDisabled(false);
          tab.display();
          new Notice(result.message, result.success ? NOTICE_NORMAL : NOTICE_ERROR);
        };

        if (!result.success) {
          // Restore live settings on test failure - do not persist broken config.
          if (testSettings.provider === 'openai-codex') {
            preserveCodexRuntimeModelState(oldSettings, tab.plugin.settings);
            preserveCodexRuntimeModelState(tab.tempSettings, tab.plugin.settings);
          }
          applySettings(oldSettings);
          await tab.plugin.saveSettings();
          resetUi();
          return;
        }

        // Success path: sync testLLMConnection's mutated fields, then commit.
        tab.tempSettings.thinkingControlCache = tab.plugin.settings.thinkingControlCache;
        if (tab.plugin.settings.provider === 'openai-codex') {
          tab.syncCodexModelsFromPlugin();
          // Issue #467: a wholesale sync, not a user edit — so it goes through
          // the tab (which owns the field and does not cascade) rather than
          // `setFieldValue`, whose cascade would clear the three per-task values
          // on the line before they are reassigned from the same source.
          tab.syncModelsFromPlugin();
        }
        // v1.25.8 HOTFIX: commitTempSettings internally flushes
        // SecretStorage. On flush failure roll back plugin.settings to
        // oldSettings so a later saveData() can't persist the typed
        // apiKey as plaintext (v1.25.3 #182 invariant). flushApiKey
        // already surfaced the apiKeyMigrationFailedNotice.
        const commitSucceeded = tab.commitTempSettings();
        if (!commitSucceeded) {
          // Roll back plugin.settings AND persist it: testLLMConnection
          // already fired a fire-and-forget `void this.saveSettings()`
          // (line 128) that captured `testSettings.apiKey` as a plaintext
          // reference. Without an explicit overwrite, the async saveData
          // could persist the typed key into data.json as plaintext,
          // violating the v1.25.3 #182 invariant. flushApiKey already
          // surfaced the apiKeyMigrationFailedNotice.
          applySettings(oldSettings);
          await tab.plugin.saveSettings();
          button.setButtonText(tab.getText('testButton'));
          button.setDisabled(false);
          tab.display();
          return;
        }
        await tab.plugin.saveSettings();
        resetUi();
      }));
}