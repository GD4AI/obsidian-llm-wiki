/**
 * v1.25.1 Phase C-PR2: Language section renderer.
 *
 * Extracted from `LLMWikiSettingTab.display()` in settings.ts. Renders
 * two H2 sub-sections:
 *
 *   1. "Language Settings" - UI language dropdown + Save button
 *   2. "Wiki Output Language" - wiki language dropdown + custom mode
 *      text input (rendered only when useCustomWikiLanguage is true)
 *
 * Why extracted:
 *   - The original block ran ~80 LOC of side-effecting Setting builders
 *     with no shared mutable state with WikiEngine. Extracting it makes
 *     the boundaries of each H2 sub-section visible at a glance and
 *     reduces settings.ts by ~80 LOC toward the ~190 LOC orchestrator
 *     target.
 *
 * Invariants preserved:
 *   - WIKI_LANGUAGES is the single source of truth for both dropdowns
 *     (v1.22.0 #185 forward-compat - adding a locale updates both).
 *   - Custom Wiki Language: priority is `useCustomWikiLanguage` -
 *     dropdown always shows '__custom__' when true, regardless of the
 *     underlying `wikiLanguage` value (preserves typed-name in text
 *     input below).
 *   - Switching to a standard language clears `useCustomWikiLanguage`.
 *   - Switching to __custom__ keeps the typed name in `wikiLanguage`
 *     for round-trip display, but clears it if it was a standard
 *     language (avoids showing e.g. 'en' in the custom input by accident).
 */

import { Setting, Notice } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';
import { WIKI_LANGUAGES } from '../../types';
import type { TEXTS } from '../../texts';
import { NOTICE_SHORT } from '../../constants';

/**
 * The dropdown hands back `string`. Only a key of `WIKI_LANGUAGES` is a real
 * choice, so the boundary is narrowed once here instead of trusting the callback's
 * declared type — which `strictFunctionTypes` no longer lets us narrow in the
 * callback signature itself (#816).
 */
function toUiLanguage(value: string): keyof typeof TEXTS {
  const keys = Object.keys(WIKI_LANGUAGES) as Array<keyof typeof TEXTS>;
  return keys.includes(value as keyof typeof TEXTS) ? (value as keyof typeof TEXTS) : 'en';
}

export function renderLanguageSection(tab: LLMWikiSettingTab, containerEl: HTMLElement): void {
  const { tempSettings } = tab;

  // 1. Language Settings: dropdown + Save button.
  new Setting(containerEl)
    .setName(tab.getText('languageTitle'))
    .setDesc(tab.getText('languageDesc'))
    .addDropdown(dropdown => {
      for (const [key, label] of Object.entries(WIKI_LANGUAGES)) {
        dropdown.addOption(key, label);
      }
      dropdown.setValue(tempSettings.language);
      dropdown.onChange((value: string) => {
        tempSettings.language = toUiLanguage(value);
        tab.display();
      });
    })
    .addButton(button => button
      .setButtonText(tab.getText('saveButton'))
      .setCta()
      .onClick(async () => {
        // v1.25.8: skip saveSettings on flush failure so a typed key
        // survives in tempSettings for retry (matches hide()).
        if (!tab.commitTempSettings()) return;
        await tab.plugin.saveSettings();
        new Notice(tab.getText('savedNotice'), NOTICE_SHORT);
      }));

  // 2. Wiki Output Language: heading + dropdown + optional custom input.
  new Setting(containerEl).setName(tab.getText('wikiLanguageName')).setHeading();

  new Setting(containerEl)
    .setName(tab.getText('wikiLanguageName'))
    .setDesc(tab.getText('wikiLanguageDesc'))
    .addDropdown(dropdown => {
      for (const [key, label] of Object.entries(WIKI_LANGUAGES)) dropdown.addOption(key, label);
      dropdown.addOption('__custom__', tab.getText('customWikiLanguageOption'));
      if (tempSettings.useCustomWikiLanguage) {
        dropdown.setValue('__custom__');
      } else {
        const currentLang = tempSettings.wikiLanguage;
        if (currentLang && WIKI_LANGUAGES[currentLang]) dropdown.setValue(currentLang);
        else if (currentLang) dropdown.setValue('__custom__');
        else dropdown.setValue('en');
      }
      dropdown.onChange((value: string) => {
        if (value === '__custom__') {
          tempSettings.useCustomWikiLanguage = true;
          if (WIKI_LANGUAGES[tempSettings.wikiLanguage || '']) {
            tempSettings.wikiLanguage = '';
          }
        } else {
          tempSettings.wikiLanguage = value;
          tempSettings.useCustomWikiLanguage = false;
        }
        tab.display();
      });
    });

  if (tempSettings.useCustomWikiLanguage) {
    new Setting(containerEl)
      .setName(tab.getText('wikiLanguageName') + ' (Custom)')
      .setDesc(tab.getText('customWikiLanguageHint'))
      .addText(text => text
        .setPlaceholder(tab.getText('customWikiLanguagePlaceholder'))
        .setValue(tempSettings.wikiLanguage && !WIKI_LANGUAGES[tempSettings.wikiLanguage] ? tempSettings.wikiLanguage : '')
        .onChange((value) => { tempSettings.wikiLanguage = value.trim(); }));
  }
}
