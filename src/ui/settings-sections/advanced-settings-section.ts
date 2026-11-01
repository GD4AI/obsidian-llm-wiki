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
 *       - Prompt customization (extraction focus + additional content rules),
 *         moved here from Wiki Configuration on 2026-11-01 — content policy,
 *         not LLM sampling, so it is the bottom panel's business
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

import { Notice, Setting, MarkdownView, TFile } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';
import { MIN_ALIAS_LENGTH, MIN_ALIAS_LENGTH_MIN, MIN_ALIAS_LENGTH_MAX, NOTICE_SHORT } from '../../constants';
import { renderNumberInput } from './shared-inputs';
import { clampPromptFocusText } from '../../core/prompt-focus';
import { findHeadingLine } from '../../schema/schema-manager';
import { setSettingsVisible } from '../settings-helpers';

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

  // Query scorer policy. Bottom panel because it is a retrieval-behaviour
  // choice, not an LLM sampling parameter. #819 step 7.
  new Setting(containerEl)
    .setName(tab.getText('legacyScorerName'))
    .setDesc(tab.getText('legacyScorerDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.legacyScorer === true)
      .onChange((value) => { tempSettings.legacyScorer = value; }));

  // Issue #880: the answer context's token ceiling. Bottom panel for the same
  // reason as the scorer toggle above — it bounds a query-surface cost, not a
  // sampling parameter, and AGENTS' settings-panel rule keeps the LLM Advanced
  // section for sampling and provider overrides only.
  //
  // A dropdown rather than free text: the numbers are the windows runtimes
  // actually serve, and a typo'd budget would either truncate every answer or
  // never apply. `0` keeps the pre-#880 behaviour reachable.
  {
    const budgetOptions = [0, 4096, 8192, 16384, 32768, 65536];
    const budgetLabels = ['0 (off)', '4K', '8K', '16K', '32K', '64K'];
    const current = tempSettings.queryContextBudgetTokens ?? 8192;
    new Setting(containerEl)
      .setName(tab.getText('queryContextBudgetName'))
      .setDesc(tab.getText('queryContextBudgetDesc'))
      .addDropdown(dropdown => {
        budgetOptions.forEach((val, idx) => {
          dropdown.addOption(String(val), budgetLabels[idx]);
        });
        dropdown.setValue(String(current));
        dropdown.onChange((value) => { tempSettings.queryContextBudgetTokens = parseInt(value); });
      });
  }

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

  // v1.27.3: the two free-text hints live in the SCHEMA, and this edits them.
  //
  // **It sits in this panel, not in Wiki Configuration.** The panel-scope rule
  // in AGENTS.md puts LLM sampling in the LLM Advanced section and every other
  // power-user setting here; prompt content is policy, not sampling. Off by
  // default, like everything else behind `showAdvancedSettings`.
  //
  // They were settings until 2026-10-30. `schema/config.md` already owns both
  // texts — `## Content Rules` carries the plugin's own rules and `TASK_SECTIONS`
  // routes it to analyze / entity / concept / merge — so a settings copy was a
  // second store for one instruction, with no precedence rule between the two
  // blocks the model receives. See the decision comment on PR #895 and
  // `core/prompt-focus.ts` for the test that decides which layer a value
  // belongs to.
  //
  // The textarea is a VIEW of a schema section, not a field in `data.json`.
  // Reads go through `readSection`, which returns the raw file rather than the
  // LLM-sanitized body, so saving cannot silently drop a legacy baked tag enum.
  //
  // **A view that edits must cover only what the user owns.** The first version
  // pointed one box at `## Content Rules`, which holds the plugin's own
  // guarantees (verbatim quotes, output language, name language, bidirectional
  // links). A user could not tell whose text it was, and deleting a line
  // silently removed a guarantee. So `## Content Rules` left the panel and the
  // user's own text lives in `## Additional Content Rules`, empty by default —
  // empty means "no additional rules", which is safe to leave alone.
  //
  // The per-topic override layer is still absent; it becomes natural under this
  // shape (one section per topic, selected by folder) and is recorded as #896.
  {
    new Setting(containerEl)
      .setName(tab.getText('promptFocusSectionName'))
      .setHeading();

    const schemaSections: Array<{ heading: string; name: string; desc: string; placeholder: string }> = [
      {
        heading: 'Extraction Focus',
        name: tab.getText('extractionFocusName'),
        desc: tab.getText('extractionFocusDesc'),
        placeholder: tab.getText('extractionFocusPlaceholder'),
      },
      {
        heading: 'Additional Content Rules',
        name: tab.getText('contentRequirementsName'),
        desc: tab.getText('contentRequirementsDesc'),
        placeholder: tab.getText('contentRequirementsPlaceholder'),
      },
    ];

    const schemaFilePath = tab.plugin.schemaManager.getSchemaFilePath();
    const schemaRelPath = schemaFilePath.split('/').slice(-2).join('/');

    const rows = schemaSections.map(({ heading, name, desc, placeholder }) => {
      let seeded = false;
      let pending: number | null = null;
      const flush = (value: string): void => {
        if (pending !== null) { window.clearTimeout(pending); pending = null; }
        void tab.plugin.schemaManager.writeSection(heading, clampPromptFocusText(value));
      };

      const setting = new Setting(containerEl).setName(name).setDesc(desc);
      // A `width: 100%` textarea inside a `setting-item-control` stays narrow,
      // because the control is a flex box sized to its content. The row has to
      // stack before the box can use the panel width.
      // `classList.add` rather than Obsidian's `addClass` sugar: the element is a
      // real `HTMLDivElement`, and the standard API is what a test double can provide.
      setting.settingEl.classList.add('llm-wiki-prompt-focus-setting');
      // A path as a button label reads as a value, not an action. The label is a
      // verb now, and the tooltip carries the path so the target is still named.
      // Opening at line 0 would make the reader search for the section they just
      // clicked, so the caret lands on the heading.
      setting.addButton(button => button
        .setButtonText(tab.getText('promptFocusOpenSchema'))
        .setTooltip(schemaRelPath)
        .onClick(() => {
          void openSchemaAt(tab, schemaFilePath, heading);
        }));
      setting.addTextArea(text => {
        text.setPlaceholder(placeholder);
        text.inputEl.rows = 6;
        text.inputEl.classList.add('llm-wiki-prompt-focus-input');
        // Seed asynchronously: the schema is a file, and `display()` is synchronous.
        void tab.plugin.schemaManager.readSection(heading).then((current) => {
          text.setValue(current);
          seeded = true;
        });
        text.onChange((value) => {
          // `setValue` does not fire onChange in Obsidian, but a stale seed
          // arriving after the user has typed would otherwise overwrite the
          // file with the seed's own text.
          if (!seeded) return;
          if (pending !== null) window.clearTimeout(pending);
          pending = window.setTimeout(() => { pending = null; flush(value); }, WRITE_DEBOUNCE_MS);
        });
        // A field the user leaves is written at once, so closing the settings
        // tab inside the debounce window cannot lose the edit.
        text.inputEl.addEventListener('blur', () => {
          if (pending !== null) flush(text.inputEl.value);
        });
      });
      return setting;
    });

    setSettingsVisible(rows, true);
  }
}

/** How long to wait after a keystroke before rewriting the schema file. */
const WRITE_DEBOUNCE_MS = 800;

/**
 * Open the schema file and put the caret on the section this row edits.
 *
 * Both halves can fail without being errors: the file may not exist yet on a
 * fresh vault, and the leaf may open a view that is not a Markdown editor. In
 * either case the plain open still happens, so the button never does nothing.
 */
async function openSchemaAt(
tab: LLMWikiSettingTab,
path: string,
heading: string,
): Promise<void> {
  const file = tab.app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    void tab.app.workspace.openLinkText(path, '', false);
    return;
  }
  const leaf = tab.app.workspace.getLeaf(false);
  await leaf.openFile(file);
  const view = leaf.view;
  if (!(view instanceof MarkdownView)) return;
  const line = findHeadingLine(view.editor.getValue(), heading);
  if (line < 0) return;
  view.editor.setCursor({ line, ch: 0 });
  view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
}
