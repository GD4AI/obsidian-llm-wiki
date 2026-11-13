/**
 * v1.25.1 Phase C-PR2: Status section renderer.
 *
 * Extracted from `LLMWikiSettingTab.display()`. Renders the inline
 * "LLM-Wiki Status" indicator row (Section 2.5 in the original file),
 * showing ready/client/wikiInit status to the user without any
 * interactive controls.
 *
 * Why extracted:
 *   - It's a single Setting row with a composite desc string. Trivially
 *     small but conceptually distinct from the configuration sections
 *     (it READS plugin state, doesn't WRITE it). Putting it in its own
 *     module makes the read-only nature obvious.
 *   - Reads `tab.isWikiInitialized()` (helper on the tab) to compute
 *     the wikiInitStatus string.
 */

import { Setting } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';

export function buildStatusDescription(tab: LLMWikiSettingTab): string {
  const { tempSettings } = tab;
  const readyStatus = tempSettings.llmReady
    ? '✅ ' + (tab.getText('statusReady') || 'Ready')
    : '⚠️ ' + (tab.getText('statusNotReady') || 'Not configured - please complete setup below');
  const clientStatus = tab.plugin.llmClient ? tab.getText('statusInitialized') : tab.getText('statusNotInitialized');
  const wikiInitCheck = tab.isWikiInitialized();
  const wikiInitStatus = wikiInitCheck
    ? '✅ ' + (tab.getText('wikiInitStatusReady') || 'Wiki initialized')
    : '⚠️ ' + (tab.getText('wikiInitStatusNotReady') || 'Wiki not initialized - will auto-create on first ingestion');

  return `${readyStatus} | ${clientStatus}  •  ${wikiInitStatus}`;
}

export function renderStatusSection(tab: LLMWikiSettingTab, containerEl: HTMLElement): void {
  const setting = new Setting(containerEl)
    .setName(tab.getText('llmWikiStatusSection'))
    .setDesc(buildStatusDescription(tab));

  // A model or provider edit invalidates readiness while the panel stays on screen.
  // Re-rendering the whole tab to refresh one line would rebuild every input, so the
  // field being typed in loses focus and caret. This row updates its own description.
  tab.registerStatusRefresh(() => {
    setting.setDesc(buildStatusDescription(tab));
  });
}
