/**
 * Issue #467 / PR #775 review — the wholesale model sync, exercised for real.
 *
 * Two holes in the review are the same hole twice. `settings-codex-sections.test.ts`
 * replaces `syncModelsFromPlugin` with `vi.fn()`, so nothing ran the real method:
 * a dropped line — say `queryModel` — committed a stale value and no test noticed.
 * And the comment justifying the sync rested on a mechanism that is a no-op on
 * this method's only caller.
 *
 * No `vi.mock('obsidian')` here on purpose. The real `LLMWikiSettingTab` is what
 * this test is about, and a partial obsidian mock shadows the module for the
 * whole file, so the import chain fails on whichever Obsidian class it did not
 * stub. `Object.create(LLMWikiSettingTab.prototype)` is the pattern the other
 * tests that exercise real production methods already use.
 */

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types';
import { LLMWikiSettingTab } from '../../ui/settings';

function makeTab(overrides: Record<string, unknown>) {
  const tab = Object.create(LLMWikiSettingTab.prototype) as LLMWikiSettingTab;
  (tab as unknown as { tempSettings: unknown }).tempSettings = {
    ...DEFAULT_SETTINGS,
    provider: 'openai-codex',
    model: 'stale',
    ingestModel: 'stale-ingest',
    lintModel: 'stale-lint',
    queryModel: 'stale-query',
    ...overrides,
  };
  (tab as unknown as { plugin: unknown }).plugin = {
    settings: {
      ...DEFAULT_SETTINGS,
      provider: 'openai-codex',
      model: 'from-plugin',
      ingestModel: 'plugin-ingest',
      lintModel: 'plugin-lint',
      queryModel: 'plugin-query',
    },
  };
  (tab as unknown as { setFieldValue: unknown }).setFieldValue = vi.fn();
  (tab as unknown as { markLLMConfigStale: unknown }).markLLMConfigStale = vi.fn();
  return tab;
}

describe('#467 — syncModelsFromPlugin is a wholesale copy, not an edit', () => {
  it('copies all four model fields from the committed settings', () => {
    // All four, not three: the failure this pins is a dropped line, and three of
    // the four would still pass if only `model` were asserted.
    const tab = makeTab({});
    tab.syncModelsFromPlugin();
    expect(tab.tempSettings).toMatchObject({
      model: 'from-plugin',
      ingestModel: 'plugin-ingest',
      lintModel: 'plugin-lint',
      queryModel: 'plugin-query',
    });
  });

  it('does not go through the cascading entry, and does not mark the config stale', () => {
    // This is the reason the sync must not be routed through `setFieldValue`, and
    // the assertion that makes it a rule rather than a paragraph in a comment.
    // `setFieldValue` always ends with `markLLMConfigStale()`, so routing the sync
    // there would commit `llmReady = false` — after a *successful* Codex
    // connection test, which `test-connection-section.ts` sets at
    // `llmReady = result.success`. `requireLLMReady` would then reject every
    // ingest and query.
    //
    // The reasons the earlier comment gave do not hold on that caller: the three
    // per-task values are reassigned from the same source on the next lines, and
    // their `*UseCustom` flags are already `false` because
    // `syncCodexModelsFromPlugin` → `applyCodexModelPolicy` ran first.
    const tab = makeTab({});
    tab.syncModelsFromPlugin();
    expect(tab.setFieldValue).not.toHaveBeenCalled();
    expect(tab.markLLMConfigStale).not.toHaveBeenCalled();
  });

  it('writes the model itself rather than delegating to the cascade', () => {
    // The mutation that matters: `syncModelsFromPlugin` exists as a second entry
    // *because* it does not cascade. If it ever delegates, the two entries have
    // collapsed into one and the distinction the guard documents is gone.
    const tab = makeTab({});
    tab.syncModelsFromPlugin();
    expect(tab.tempSettings.model).toBe('from-plugin');
    expect(tab.tempSettings.queryModel).toBe('plugin-query');
  });
});
