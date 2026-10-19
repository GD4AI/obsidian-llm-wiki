/**
 * v1.25.1 Phase C-PR2: Auto Maintenance section renderer.
 *
 * Extracted from `LLMWikiSettingTab.display()`. Renders the Auto
 * Maintenance block:
 *
 *   - "Auto Maintenance" H2 heading
 *   - Startup Check Notice Level dropdown (visible / silent)
 *   - Beta + cost-warning infobox divs
 *   - Auto-Watch Sources toggle
 *   - Watched Folders list (rendered only when autoWatchSources is true)
 *   - Web Clipper Preset toggle (Clippings/)
 *   - Auto-Watch Mode dropdown (notify / auto)
 *   - Auto-Ingest Notification Level dropdown (only in auto mode)
 *   - Auto-Watch Debounce number input
 *   - Periodic Lint dropdown (off / daily / weekly / monthly)
 *   - Auto Smart Fix toggle
 *
 * v1.26.0 (#382 item 2): the Welcome Note toggle moved OUT of this
 * section into the bottom "Advanced settings" panel — it is a one-time
 * first-run choice, not a daily-driver auto-behavior knob.
 *
 * Why extracted:
 *   - 160 LOC of auto-behavior configuration. The block has the deepest
 *     conditional rendering in the file (autoWatchSources / autoWatchMode
 *     both gate sub-blocks). Isolating it makes the conditional chain
 *     inspectable.
 *
 * Invariants preserved:
 *   - startupCheckNoticeLevel (v1.23.0 replacement for the removed
 *     startupCheck toggle) controls only the Notice visibility, not
 *     whether the pipeline runs.
 *   - Watched Folders list is rendered dynamically from
 *     tempSettings.watchedFolders[] (mutated via splice on Remove).
 *   - Web Clipper Preset adds 'Clippings/' to watchedFolders.
 *   - Auto-Watch Debounce is in seconds (UI) but stored as ms.
 */

import { Setting, Notice } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';
import { NOTICE_SHORT } from '../../constants';
import { FolderSuggestModal } from '../modals';

export function renderAutoMaintainSection(tab: LLMWikiSettingTab, containerEl: HTMLElement): void {
  const { tempSettings } = tab;

  // Auto Maintenance heading
  new Setting(containerEl).setName(tab.getText('autoMaintainSection')).setHeading();

  // Startup Check Notice Level (v1.23.0 replaces removed startupCheck toggle)
  new Setting(containerEl)
    .setName(tab.getText('startupCheckNoticeLevelName'))
    .setDesc(tab.getText('startupCheckNoticeLevelDesc'))
    .addDropdown(dropdown => dropdown
      .addOption('visible', tab.getText('startupCheckNoticeVisible'))
      .addOption('silent', tab.getText('startupCheckNoticeSilent'))
      .setValue(tempSettings.startupCheckNoticeLevel)
      .onChange((value: 'visible' | 'silent') => { tempSettings.startupCheckNoticeLevel = value; }));

  // Beta + cost warning infoboxes.
  // v1.25.11 PATCH follow-up: the previous attempt used Obsidian's
  // `.notice.warning` modifier, but Obsidian does not ship such a
  // class for settings panels — it only exists inside callout markdown
  // (`> [!warning]`). The fallback to a hand-rolled CSS box is the
  // approach used by other first-party-style plugins (Tasks, Templater,
  // Dataview). We use the official `Setting` container so Obsidian
  // sizes the infobox to the panel's full text width (avoiding the
  // inline-block half-width bug that `createDiv` caused) and rely on
  // `var(--background-secondary)` for the fill — this token survives
  // the 1.13 warning-palette overhaul, unlike the previous
  // `--background-modifier-warning` which 1.13 redefined as a saturated
  // brand orange swatch.
  const betaDiv = containerEl.createDiv({ cls: 'llm-wiki-blue-infobox' });
  betaDiv.setText('🧪 ' + tab.getText('autoMaintainBetaBadge'));

  const warningDiv = containerEl.createDiv({ cls: 'llm-wiki-yellow-infobox' });
  warningDiv.setText(tab.getText('autoMaintainCostWarning'));

  // Auto-Watch Sources toggle
  new Setting(containerEl)
    .setName(tab.getText('autoWatchName'))
    .setDesc(tab.getText('autoWatchDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.autoWatchSources)
      .onChange((value) => { tempSettings.autoWatchSources = value; tab.display(); }));

  if (tempSettings.autoWatchSources) {
    if (!tempSettings.watchedFolders) tempSettings.watchedFolders = [];

    new Setting(containerEl)
      .setName(tab.getText('watchedFoldersName'))
      .setDesc(tab.getText('watchedFoldersDesc'))
      .addButton(button => button
        .setButtonText(tab.getText('addWatchedFolderButton'))
        .setCta()
        .onClick(() => {
          new FolderSuggestModal(tab.app, tempSettings.wikiFolder, (folder) => {
            const folderPath = folder.path.endsWith('/') ? folder.path : `${folder.path}/`;
            if (!tempSettings.watchedFolders.includes(folderPath)) {
              tempSettings.watchedFolders.push(folderPath);
              tab.display();
            }
          }).open();
        }));

    if (tempSettings.watchedFolders.length === 0) {
      containerEl.createEl('p', {
        text: tab.getText('noWatchedFoldersHint'),
        cls: 'llm-wiki-section-hint'
      });
    }

    for (let i = 0; i < tempSettings.watchedFolders.length; i++) {
      const idx = i;
      new Setting(containerEl)
        .setName(tempSettings.watchedFolders[i])
        .addButton(button => button
          .setButtonText(tab.getText('removeWatchedFolderButton'))
          .onClick(() => { tempSettings.watchedFolders.splice(idx, 1); tab.display(); }));
    }

    const hasClippings = tempSettings.watchedFolders.includes('Clippings/');
    new Setting(containerEl)
      .setName(tab.getText('webClipperPresetName'))
      .setDesc(tab.getText('webClipperPresetDesc'))
      .addToggle(toggle => toggle
        .setValue(hasClippings)
        .onChange((value) => {
          if (value && !tempSettings.watchedFolders.includes('Clippings/')) tempSettings.watchedFolders.push('Clippings/');
          else if (!value) {
            const ci = tempSettings.watchedFolders.indexOf('Clippings/');
            if (ci >= 0) tempSettings.watchedFolders.splice(ci, 1);
          }
          tab.display();
        }));

    new Setting(containerEl)
      .setName(tab.getText('autoWatchModeName'))
      .setDesc(tab.getText('autoWatchModeDesc'))
      .addDropdown(dropdown => {
        dropdown.addOption('notify', tab.getText('watchModeNotify'));
        dropdown.addOption('auto', tab.getText('watchModeAuto'));
        dropdown.setValue(tempSettings.autoWatchMode);
        dropdown.onChange((value: 'notify' | 'auto') => { tempSettings.autoWatchMode = value; tab.display(); });
      });

    if (tempSettings.autoWatchMode === 'auto') {
      new Setting(containerEl)
        .setName(tab.getText('autoIngestLevelName'))
        .setDesc(tab.getText('autoIngestLevelDesc'))
        .addDropdown(dropdown => {
          dropdown.addOption('notice', tab.getText('autoIngestLevelNotice'));
          dropdown.addOption('modal', tab.getText('autoIngestLevelModal'));
          dropdown.setValue(tempSettings.autoIngestNotificationLevel);
          dropdown.onChange((value: 'notice' | 'modal') => { tempSettings.autoIngestNotificationLevel = value; });
        });
    }

    new Setting(containerEl)
      .setName(tab.getText('autoWatchDebounceName'))
      .setDesc(tab.getText('autoWatchDebounceDesc'))
      .addText(text => {
        text
          .setValue(String(Math.round(tempSettings.autoWatchDebounceMs / 1000)))
          .onChange((value) => {
            const parsed = parseInt(value);
            if (parsed > 60) {
              tempSettings.autoWatchDebounceMs = 60000;
              text.setValue('60');
              new Notice(tab.getText('autoWatchDebounceClamped').replace('{}', '60'), NOTICE_SHORT);
            } else if (parsed < 1) {
              tempSettings.autoWatchDebounceMs = 1000;
              text.setValue('1');
              new Notice(tab.getText('autoWatchDebounceClamped').replace('{}', '1'), NOTICE_SHORT);
            } else if (!isNaN(parsed)) {
              tempSettings.autoWatchDebounceMs = parsed * 1000;
            }
          });
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.inputEl.max = '60';
        text.inputEl.classList.add('llm-wiki-number-input');
      });
  }

  // Periodic Lint
  new Setting(containerEl)
    .setName(tab.getText('periodicLintName'))
    .setDesc(tab.getText('periodicLintDesc'))
    .addDropdown(dropdown => {
      dropdown.addOption('off', tab.getText('periodicLintOff'));
      dropdown.addOption('daily', tab.getText('periodicLintDaily'));
      dropdown.addOption('weekly', tab.getText('periodicLintWeekly'));
      dropdown.addOption('monthly', tab.getText('periodicLintMonthly'));
      dropdown.setValue(tempSettings.periodicLint);
      dropdown.onChange((value: 'off' | 'daily' | 'weekly' | 'monthly') => { tempSettings.periodicLint = value; });
    });

  // Auto Smart Fix
  new Setting(containerEl)
    .setName(tab.getText('autoSmartFixName'))
    .setDesc(tab.getText('autoSmartFixDesc'))
    .addToggle(toggle => toggle
      .setValue(tempSettings.autoSmartFix)
      .onChange((value) => { tempSettings.autoSmartFix = value; }));
}
