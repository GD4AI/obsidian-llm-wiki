/**
 * v1.25.1 Phase C-PR2: Wiki Configuration section renderer.
 *
 * Extracted from `LLMWikiSettingTab.display()`. Renders the Wiki
 * Configuration block:
 *
 *   - "Wiki Configuration" H2 heading
 *   - Wiki Folder text input
 *   - Extraction Granularity dropdown + custom entity/concept limits
 *   - Tag Vocabulary mode + custom entity/concept chip inputs
 *   - Max Conversation History dropdown
 *   - Schema Management buttons (View + Regenerate)
 *   - Ingestion History button (Issue #122)
 *
 * v1.26.0 (#382 item 2): the Write PDF Markdown to Vault toggle, the
 * Slug Case dropdown, AND the Max Conversation History dropdown moved
 * OUT to the bottom "Advanced settings" panel — they are power-user
 * choices that clutter the daily configuration surface.
 *
 * Why extracted:
 *   - 280 LOC of wiki-configuration side effects. Splitting makes the
 *     storage / granularity / tagging / schema concerns navigable.
 *
 * v1.25.1 Phase C-PR2 simplify pass: visibility toggling uses the shared
 * setSettingsVisible helper. The numeric-clamp inputs (customEntityLimit,
 * customConceptLimit) keep their inline form because their
 * clamp-notice-on-overflow pattern differs from auto-maintain's
 * debounceMs (different Notice placement, different placeholder text);
 * promoting them would force the helper to grow an onSetting callback
 * that defeats the purpose of extraction.
 */

import { Setting, Notice, TFile, BaseComponent } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';
import { VALID_ENTITY_TAGS, VALID_CONCEPT_TAGS } from '../../types';
import { NOTICE_NORMAL, NOTICE_ERROR, NOTICE_SHORT, CUSTOM_LIMIT_MAX, CUSTOM_LIMIT_MIN, MINERU_API_TOKEN_SECRET_ID } from '../../constants';
import { HistoryModal } from '../history-modal';
import { TagChipInputComponent } from '../tag-chip-input';
import { setSettingsVisible } from '../settings-helpers';

export function renderWikiConfigSection(tab: LLMWikiSettingTab, containerEl: HTMLElement): void {
  const { tempSettings } = tab;

  // Wiki Configuration heading
  new Setting(containerEl).setName(tab.getText('wikiSection')).setHeading();

  // Wiki Folder
  new Setting(containerEl)
    .setName(tab.getText('wikiFolderName'))
    .setDesc(tab.getText('wikiFolderDesc'))
    .addText(text => text
      .setPlaceholder(tab.getText('wikiFolderPlaceholder'))
      .setValue(tempSettings.wikiFolder)
      .onChange((value) => { tempSettings.wikiFolder = value; }));

  let mineruTokenSetting: Setting | null = null;
  new Setting(containerEl)
    .setName(tab.getText('markdownConversionBackendName'))
    .setDesc(tab.getText('markdownConversionBackendDesc'))
    .addDropdown(dropdown => dropdown
      .addOption('native', tab.getText('markdownConversionBackendNative'))
      .addOption('mineru', tab.getText('markdownConversionBackendMineru'))
      .setValue(tempSettings.markdownConversionBackend ?? 'native')
      .onChange(value => {
        tempSettings.markdownConversionBackend = value as 'native' | 'mineru';
        setSettingsVisible([mineruTokenSetting], value === 'mineru');
      }));

  mineruTokenSetting = new Setting(containerEl)
    .setName(tab.getText('mineruApiTokenName'))
    .setDesc(tab.getText('mineruApiTokenDesc'))
    .addText(text => {
      text
        .setPlaceholder(tab.getText('mineruApiTokenPlaceholder'))
        .setValue(tab.app.secretStorage.getSecret(MINERU_API_TOKEN_SECRET_ID) ?? '')
        .onChange(value => { tab.app.secretStorage.setSecret(MINERU_API_TOKEN_SECRET_ID, value.trim()); });
      text.inputEl.type = 'password';
    });
  setSettingsVisible([mineruTokenSetting], tempSettings.markdownConversionBackend === 'mineru');
  // Granularity + custom limits
  let customEntitySetting: Setting | null = null;
  let customConceptSetting: Setting | null = null;

  new Setting(containerEl)
    .setName(tab.getText('extractionGranularityName'))
    .setDesc(tab.getText('extractionGranularityDesc'))
    .addDropdown(dropdown => {
      dropdown.addOption('fine', tab.getText('extractionGranularityFine'));
      dropdown.addOption('standard', tab.getText('extractionGranularityStandard'));
      dropdown.addOption('coarse', tab.getText('extractionGranularityCoarse'));
      dropdown.addOption('minimal', tab.getText('extractionGranularityMinimal'));
      dropdown.addOption('custom', tab.getText('extractionGranularityCustom'));
      dropdown.setValue(tempSettings.extractionGranularity || 'standard');
      dropdown.onChange((value: string) => {
        tempSettings.extractionGranularity = value as 'fine' | 'standard' | 'coarse' | 'minimal' | 'custom';
        setSettingsVisible([customEntitySetting, customConceptSetting], value === 'custom');
      });
    });

  // Custom entity limit (shown only when granularity=custom).
  // Inline clamp logic kept (not extracted to renderClampedNumberInput)
  // because the placeholder and clamping UX here differ from
  // auto-maintain's debounceMs — the helper would need an onSetting
  // callback that obscures the per-site config.
  customEntitySetting = new Setting(containerEl)
    .setName(tab.getText('customEntityLimitName'))
    .setDesc(tab.getText('customEntityLimitDesc'))
    .addText(text => {
      text
        .setPlaceholder('5')
        .setValue(String(tempSettings.customEntityLimit ?? 5))
        .onChange((value) => {
          const parsed = parseInt(value);
          if (parsed > CUSTOM_LIMIT_MAX) {
            tempSettings.customEntityLimit = CUSTOM_LIMIT_MAX;
            text.setValue(String(CUSTOM_LIMIT_MAX));
            new Notice(tab.getText('numberRangeClamped').replace('{}', String(CUSTOM_LIMIT_MAX)), NOTICE_SHORT);
          } else if (parsed < CUSTOM_LIMIT_MIN) {
            tempSettings.customEntityLimit = CUSTOM_LIMIT_MIN;
            text.setValue(String(CUSTOM_LIMIT_MIN));
            new Notice(tab.getText('numberRangeClamped').replace('{}', String(CUSTOM_LIMIT_MIN)), NOTICE_SHORT);
          } else if (!isNaN(parsed)) {
            tempSettings.customEntityLimit = parsed;
          }
        });
      text.inputEl.type = 'number';
      text.inputEl.min = String(CUSTOM_LIMIT_MIN);
      text.inputEl.max = String(CUSTOM_LIMIT_MAX);
      text.inputEl.classList.add('llm-wiki-number-input');
    });
  customEntitySetting.settingEl.style.display =
    tempSettings.extractionGranularity === 'custom' ? 'flex' : 'none';

  customConceptSetting = new Setting(containerEl)
    .setName(tab.getText('customConceptLimitName'))
    .setDesc(tab.getText('customConceptLimitDesc'))
    .addText(text => {
      text
        .setPlaceholder('5')
        .setValue(String(tempSettings.customConceptLimit ?? 5))
        .onChange((value) => {
          const parsed = parseInt(value);
          if (parsed > CUSTOM_LIMIT_MAX) {
            tempSettings.customConceptLimit = CUSTOM_LIMIT_MAX;
            text.setValue(String(CUSTOM_LIMIT_MAX));
            new Notice(tab.getText('numberRangeClamped').replace('{}', String(CUSTOM_LIMIT_MAX)), NOTICE_SHORT);
          } else if (parsed < CUSTOM_LIMIT_MIN) {
            tempSettings.customConceptLimit = CUSTOM_LIMIT_MIN;
            text.setValue(String(CUSTOM_LIMIT_MIN));
            new Notice(tab.getText('numberRangeClamped').replace('{}', String(CUSTOM_LIMIT_MIN)), NOTICE_SHORT);
          } else if (!isNaN(parsed)) {
            tempSettings.customConceptLimit = parsed;
          }
        });
      text.inputEl.type = 'number';
      text.inputEl.min = String(CUSTOM_LIMIT_MIN);
      text.inputEl.max = String(CUSTOM_LIMIT_MAX);
      text.inputEl.classList.add('llm-wiki-number-input');
    });
  customConceptSetting.settingEl.style.display =
    tempSettings.extractionGranularity === 'custom' ? 'flex' : 'none';

  // Tag Vocabulary
  let customEntityTagsSetting: Setting | null = null;
  let customConceptTagsSetting: Setting | null = null;

  const customEntities = (tempSettings.customEntityTags ?? '').trim();
  const customConcepts = (tempSettings.customConceptTags ?? '').trim();
  const hasCustomInput = customEntities.length > 0 || customConcepts.length > 0;
  const effectiveEntityTags = customEntities.length > 0
    ? customEntities.split(',').map(t => t.trim()).filter(Boolean)
    : VALID_ENTITY_TAGS;
  const effectiveConceptTags = customConcepts.length > 0
    ? customConcepts.split(',').map(t => t.trim()).filter(Boolean)
    : VALID_CONCEPT_TAGS;
  const effectiveListDesc = hasCustomInput
    ? `${effectiveEntityTags.join(', ')} (entities) / ${effectiveConceptTags.join(', ')} (concepts)${tempSettings.tagVocabularyMode === 'default' ? ' - custom values shown above (toggle to Custom to activate)' : ''}`
    : `${VALID_ENTITY_TAGS.join(', ')} (entities) / ${VALID_CONCEPT_TAGS.join(', ')} (concepts)`;
  const leadDesc = tab.getText('tagVocabularyInlineDesc');
  // v1.25.10 PATCH Issue #368: the custom vocabulary is a SCHEMA INJECTION
  // HINT for the LLM, not a write-time gate. Surface that explicitly in the
  // settings panel so users do not assume out-of-vocabulary types are
  // rejected — they are surfaced by the Lint diagnostic instead.
  const enforcementHint = `\n${tab.getText('tagVocabularyNotEnforcedHint')}`;
  const modeDesc = tempSettings.tagVocabularyMode === 'custom'
    ? `${leadDesc}\n${tab.getText('tagVocabularyModeDescCustom')}${enforcementHint}`
    : `${leadDesc}\n${tab.getText('tagVocabularyModeDescDefault').replace('{}', effectiveListDesc)}${enforcementHint}`;

  new Setting(containerEl)
    .setName(tab.getText('tagVocabularyModeName'))
    .setDesc(modeDesc)
    .addDropdown(dropdown => {
      dropdown
        .addOption('default', tab.getText('tagVocabularyModeDefault'))
        .addOption('custom', tab.getText('tagVocabularyModeCustom'))
        .setValue(tempSettings.tagVocabularyMode || 'default')
        .onChange((value: string) => {
          tempSettings.tagVocabularyMode = value as 'default' | 'custom';
          tab.display();
        });
    });

  customEntityTagsSetting = new Setting(containerEl)
    .setName(tab.getText('customEntityTagsName'))
    .setDesc(tab.getText('customEntityTagsDesc'))
    .addComponent(el => new TagChipInputComponent({
      controlEl: el,
      initialTags: tempSettings.customEntityTags || '',
      placeholder: tab.getText('customEntityTagsPlaceholder'),
      ariaLabel: tab.getText('customEntityTagsName'),
      duplicateHint: tab.getText('chipDuplicateHint'),
      defaultTags: VALID_ENTITY_TAGS,
      onChange: (csv) => { tempSettings.customEntityTags = csv; },
    }) as unknown as BaseComponent);

  customConceptTagsSetting = new Setting(containerEl)
    .setName(tab.getText('customConceptTagsName'))
    .setDesc(tab.getText('customConceptTagsDesc'))
    .addComponent(el => new TagChipInputComponent({
      controlEl: el,
      initialTags: tempSettings.customConceptTags || '',
      placeholder: tab.getText('customConceptTagsPlaceholder'),
      ariaLabel: tab.getText('customConceptTagsName'),
      duplicateHint: tab.getText('chipDuplicateHint'),
      defaultTags: VALID_CONCEPT_TAGS,
      onChange: (csv) => { tempSettings.customConceptTags = csv; },
    }) as unknown as BaseComponent);

  setSettingsVisible([customEntityTagsSetting, customConceptTagsSetting], tempSettings.tagVocabularyMode === 'custom');

  // Max Conversation History — moved to Advanced settings panel in v1.26.0
  // (see renderAdvancedSettingsSection).

  // Schema Management
  new Setting(containerEl)
    .setName(tab.getText('schemaSection'))
    .setDesc(tab.getText('enableSchemaDesc'))
    .addButton(button => button
      .setButtonText(tab.getText('viewSchemaButton'))
      .onClick(() => {
        const schemaPath = `${tempSettings.wikiFolder}/schema/config.md`;
        const file = tab.app.vault.getAbstractFileByPath(schemaPath);
        if (file instanceof TFile) void tab.app.workspace.getLeaf().openFile(file);
        else new Notice(tab.getText('schemaNotFoundNotice'), NOTICE_NORMAL);
      }))
    .addButton(button => button
      .setButtonText(tab.getText('regenerateSchemaButton'))
      .onClick(async () => {
        try {
          if (!tab.isWikiInitialized()) {
            await tab.plugin.wikiEngine.ensureWikiStructure();
          }
          await tab.plugin.wikiEngine.regenerateDefaultSchema();
          new Notice(tab.getText('schemaRegeneratedNotice'), NOTICE_SHORT);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          new Notice(`${tab.getText('schemaRegenerateFailed') || 'Schema generation failed'}: ${msg}`, NOTICE_ERROR);
        }
      }));

  // Ingestion History (#122)
  new Setting(containerEl)
    .setName(tab.getText('historyButton'))
    .setDesc(tab.getText('historyButtonDesc'))
    .addButton(button => button
      .setButtonText(tab.getText('historyButtonOpen'))
      .onClick(() => {
        new HistoryModal(tab.app, {
          language: tempSettings.language,
          wikiFolder: tempSettings.wikiFolder || 'wiki',
        }).open();
      }));
}
