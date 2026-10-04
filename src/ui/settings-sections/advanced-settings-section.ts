/**
 * v1.26.0 (#382 item 2): Advanced Settings panel renderer.
 *
 * The bottom-most section of the Settings tab. A generic home for ALL
 * advanced-user settings that are NOT LLM sampling parameters (those live
 * in the Advanced section under advancedSettingsMode). Currently:
 *
 *   - "Advanced settings" H2 heading
 *   - Show advanced settings toggle (default off)
 *   - When on:
 *       - 3 lint dedup threshold inputs (no sub-heading — the parent
 *         "Advanced settings" heading already groups these power-user knobs)
 *       - Max Conversation History dropdown (moved from Wiki Configuration)
 *       - Write PDF Markdown to Vault toggle (moved from Wiki Configuration)
 *       - Slug Case dropdown (moved from Wiki Configuration)
 *       - First-run Welcome note toggle (moved from Auto Maintenance)
 *
 * Why separate from Auto Maintenance / Wiki Configuration:
 *   - Auto Maintenance is daily-driver config (watch, periodic lint, smart
 *     fix). Wiki Configuration is daily storage/format config (folder,
 *     granularity, tags). Lint thresholds, sidecar writes, slug casing, and
 *     the Welcome note are power-user / one-time choices — they clutter the
 *     everyday surface.
 *   - This section is the designated home for FUTURE advanced-user
 *     settings, so a power user has one place to look instead of hunting
 *     across sections.
 *
 * Invariant: closing the showAdvancedSettings toggle resets every gated
 * field to its default (lint thresholds → undefined, writePdfMarkdownToVault
 * → undefined, slugCase → 'lower') so a hidden setting never keeps a
 * no-UI-affordance value. Welcome note (createWelcomeNote) is NOT reset on
 * close — it is a permanent first-run behavior, only its UI home moved.
 */

import { Notice, Setting } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';
import { MIN_ALIAS_LENGTH, MIN_ALIAS_LENGTH_MIN, MIN_ALIAS_LENGTH_MAX, NOTICE_SHORT } from '../../constants';
import { renderNumberInput } from './shared-inputs';

export function renderAdvancedSettingsSection(tab: LLMWikiSettingTab, containerEl: HTMLElement): void {
  const { tempSettings } = tab;

  // Advanced settings heading
  new Setting(containerEl).setName(tab.getText('advancedSettingsSection')).setHeading();

  // Show advanced settings toggle
  new Setting(containerEl)
    .setName(tab.getText('showAdvancedSettingsName'))
    .setDesc(tab.getText('showAdvancedSettingsDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.showAdvancedSettings === true)
      .onChange((value) => {
        tempSettings.showAdvancedSettings = value;
        if (!value) {
          // Closing the panel resets every gated field to its default so a
          // hidden setting never keeps a no-UI-affordance value.
          tempSettings.lintJaccardLinkThreshold = undefined;
          tempSettings.lintJaccardBodyGate = undefined;
          tempSettings.lintBigramThreshold = undefined;
          tempSettings.writePdfMarkdownToVault = undefined;
          tempSettings.analyzeEmbeddedImages = false;
          tempSettings.saveEmbeddedImageEvidence = false;
          tempSettings.slugCase = 'lower';
          // v1.26.0 (#382 item 1, Batch 2): sources participate in dedup
          // by default; reset to default-on when this panel closes so a
          // hidden setting never keeps a no-UI-affordance value.
          tempSettings.lintDedupIncludeSources = undefined;
          // Issue #514: the gate is opt-in; a closed panel means off.
          tempSettings.skipMentionOnlyCandidates = false;
        }
        tab.display();
      }));

  if (!tempSettings.showAdvancedSettings) return;

  // v1.26.0 (#382 item 1, Batch 2): ordering of items in this panel
  // is semantic, not chronological. Layout (top to bottom):
  //   1. Max Conversation History (Query Wiki daily-driver tweak)
  //   2. Write PDF Markdown to Vault (storage policy)
  //   3. Slug Case (filename naming policy)
  //   4. First-run Welcome note (one-time UX)
  //   5. ─── Duplicate detection (Batch 2 group, sub-heading) ───
  //      3 dedup threshold inputs + 1 dedup scope toggle
  //
  // The 3 lint dedup threshold inputs and the lintDedupIncludeSources
  // toggle were moved to the END of this panel so all dedup-related
  // controls are visually grouped (and the Batch 2 sub-heading makes
  // the group explicit). The 3 thresholds are no longer the first
  // items in the panel because their semantic home is "dedup
  // configuration", not "general advanced settings".

  // Max Conversation History (moved from Wiki Configuration in v1.26.0 —
  // the presets dropdown is a one-time tuning choice most users don't
  // revisit).
  new Setting(containerEl)
    .setName(tab.getText('maxConversationHistoryName'))
    .setDesc(tab.getText('maxConversationHistoryDesc'))
    .addDropdown(dropdown => {
      const presets = [1, 10, 30, 50, 100, 500];
      for (const n of presets) {
        dropdown.addOption(n.toString(), n.toString());
      }
      const current = tempSettings.maxConversationHistory;
      const currentStr = presets.includes(current) ? current.toString() : '50';
      dropdown.setValue(currentStr);
      dropdown.onChange((value) => {
        const parsed = parseInt(value);
        if (!isNaN(parsed) && parsed >= 1) {
          tempSettings.maxConversationHistory = parsed;
        }
      });
    });

  // v1.25.0 PR3: opt-in sidecar write (PDF → Markdown). Moved here from
  // Wiki Configuration in v1.26.0 — a power-user storage policy choice.
  new Setting(containerEl)
    .setName(tab.getText('writePdfMarkdownToVaultName'))
    .setDesc(tab.getText('writePdfMarkdownToVaultDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.writePdfMarkdownToVault === true)
      .onChange((value) => { tempSettings.writePdfMarkdownToVault = value; }));

  new Setting(containerEl)
    .setName(tab.getText('analyzeEmbeddedImagesName'))
    .setDesc(tab.getText('analyzeEmbeddedImagesDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.analyzeEmbeddedImages === true)
      .onChange((value) => { tempSettings.analyzeEmbeddedImages = value; }));

  new Setting(containerEl)
    .setName(tab.getText('saveEmbeddedImageEvidenceName'))
    .setDesc(tab.getText('saveEmbeddedImageEvidenceDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.saveEmbeddedImageEvidence === true)
      .onChange((value) => { tempSettings.saveEmbeddedImageEvidence = value; }));

  // Slug Case (filename casing for generated wiki pages). Moved here from
  // Wiki Configuration in v1.26.0 — a one-time naming-policy choice.
  new Setting(containerEl)
    .setName(tab.getText('slugCaseName'))
    .setDesc(tab.getText('slugCaseDesc'))
    .addDropdown(dropdown => {
      dropdown.addOption('lower', tab.getText('slugCaseLower'));
      dropdown.addOption('preserve', tab.getText('slugCasePreserve'));
      dropdown.setValue(tempSettings.slugCase || 'lower');
      dropdown.onChange((value: string) => {
        tempSettings.slugCase = value as 'lower' | 'preserve';
      });
    });

  // Minimum alias length. The v1.25.10 floor (MIN_ALIAS_LENGTH = 2) stays the
  // default; this lets a vault that surfaces two-letter clutter raise it
  // without a code edit. A naming-policy choice, so it sits next to slug case.
  new Setting(containerEl)
    .setName(tab.getText('minAliasLengthName'))
    .setDesc(tab.getText('minAliasLengthDesc'))
    .addText(text => {
      text
        .setPlaceholder(String(MIN_ALIAS_LENGTH))
        .setValue(String(tempSettings.minAliasLength ?? MIN_ALIAS_LENGTH))
        .onChange((value) => {
          const parsed = parseInt(value, 10);
          if (isNaN(parsed)) {
            tempSettings.minAliasLength = undefined;
            return;
          }
          const clamped = Math.min(MIN_ALIAS_LENGTH_MAX, Math.max(MIN_ALIAS_LENGTH_MIN, parsed));
          if (clamped !== parsed) {
            text.setValue(String(clamped));
            new Notice(tab.getText('minAliasLengthClamped').replace('{}', String(clamped)), NOTICE_SHORT);
          }
          tempSettings.minAliasLength = clamped === MIN_ALIAS_LENGTH ? undefined : clamped;
        });
    });

  // First-run Welcome note toggle (moved from Auto Maintenance in v1.26.0)
  new Setting(containerEl)
    .setName(tab.getText('welcomeNoteSettingsToggle'))
    .setDesc(tab.getText('welcomeNoteSettingsToggleDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.createWelcomeNote)
      .onChange((value) => { tempSettings.createWelcomeNote = value; }));

  // Issue #514: skip candidates the source only mentions. An ingest policy
  // (which pages get written), not an LLM sampling parameter — so it sits in
  // this panel, not in the LLM Advanced section. Off by default.
  new Setting(containerEl)
    .setName(tab.getText('skipMentionOnlyCandidatesName'))
    .setDesc(tab.getText('skipMentionOnlyCandidatesDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.skipMentionOnlyCandidates === true)
      .onChange((value) => { tempSettings.skipMentionOnlyCandidates = value; }));

  // Issue #485: whether Fix Dead Links writes an empty placeholder page for
  // an unresolvable link. A maintenance-write policy (which pages get
  // created at all), not an LLM sampling parameter — same panel as its
  // sibling #514 gate above. On by default (the existing outcome).
  new Setting(containerEl)
    .setName(tab.getText('createStubsForUnresolvableLinksName'))
    .setDesc(tab.getText('createStubsForUnresolvableLinksDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.createStubsForUnresolvableLinks !== false)
      .onChange((value) => { tempSettings.createStubsForUnresolvableLinks = value; }));

  // ─── v1.26.0 (#382 item 1, Batch 2): Duplicate detection sub-group ───
  // Sub-heading separates the 3 dedup threshold inputs + 1 dedup scope
  // toggle from the storage / naming / UX items above. Visual grouping
  // makes the semantic scope of the controls (all affect lint dedup
  // behavior) explicit to the user.
  new Setting(containerEl)
    .setName(tab.getText('lintDedupSectionHeading'))
    .setHeading();

  // Lint duplicate-detection thresholds — 0..1 numeric inputs.
  renderNumberInput(tab, containerEl, 'lintDedupJaccardLinkThresholdName', 'lintDedupJaccardLinkThresholdDesc', 'lintJaccardLinkThreshold', '1');
  renderNumberInput(tab, containerEl, 'lintDedupJaccardBodyGateName', 'lintDedupJaccardBodyGateDesc', 'lintJaccardBodyGate', '1');
  renderNumberInput(tab, containerEl, 'lintDedupBigramThresholdName', 'lintDedupBigramThresholdDesc', 'lintBigramThreshold', '1');

  // v1.26.0 (#382 item 1, Batch 2): include sources/ pages in lint
  // duplicate-detection. Default on; toggle off to opt out. Rendered
  // in the dedup sub-group (not in the LLM-Advanced section) because
  // dedup scope is a per-source-file filter, not an LLM sampling
  // parameter.
  new Setting(containerEl)
    .setName(tab.getText('lintDedupIncludeSourcesName'))
    .setDesc(tab.getText('lintDedupIncludeSourcesDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.lintDedupIncludeSources !== false)
      .onChange((value) => { tempSettings.lintDedupIncludeSources = value; }));
}
