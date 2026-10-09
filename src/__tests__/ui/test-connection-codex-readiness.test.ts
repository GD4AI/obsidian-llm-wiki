/**
 * PR #775 follow-up — the readiness rule, checked at the caller.
 *
 * `syncModelsFromPlugin` must not mark the config stale: a *successful* Codex
 * connection test would otherwise commit `llmReady = false`, and
 * `requireLLMReady` would reject every later ingest and query. #775 pinned that
 * inside the method — its body calls neither `setFieldValue` nor
 * `markLLMConfigStale`. Two changes pass that check and still ship the bug:
 * the sync assigning `llmReady = false` itself, and the success path calling
 * `setFieldValue('model', …)` next to the sync.
 *
 * `settings-codex-sections.test.ts` asserts the outcome, but on a tab whose
 * `setFieldValue`, `syncModelsFromPlugin` and `markLLMConfigStale` are
 * `vi.fn()`, so neither change reaches it. This file clicks the same button on
 * a tab that runs the real methods.
 *
 * The obsidian mock is spelled out because both halves are needed at once: the
 * section needs a `Setting` whose button can be clicked, which the global mock
 * does not have, and importing the real tab needs every Obsidian class its
 * import graph extends, which a `Setting`-only mock would drop.
 */

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types';
import { CODEX_MODELS } from '../../llm-sdk/openai-codex/constants';
import { LLMWikiSettingTab } from '../../ui/settings';
import { renderTestConnectionSection } from '../../ui/settings-sections/test-connection-section';

const { buttonClicks } = vi.hoisted(() => ({ buttonClicks: [] as Array<() => unknown> }));

vi.mock('obsidian', () => {
  class Base {}
  class ButtonMock {
    setButtonText(): this { return this; }
    setDisabled(): this { return this; }
    onClick(callback: () => unknown): this { buttonClicks.push(callback); return this; }
  }
  class SettingMock {
    setName(): this { return this; }
    setDesc(): this { return this; }
    addButton(callback: (button: ButtonMock) => void): this { callback(new ButtonMock()); return this; }
  }
  return {
    Setting: SettingMock,
    Notice: class {},
    Platform: { isMobile: false },
    normalizePath: (path: string) => path,
    requestUrl: vi.fn(),
    // Extended somewhere in the tab's import graph, so they must exist at load.
    Plugin: Base,
    PluginSettingTab: Base,
    Modal: Base,
    FuzzySuggestModal: Base,
    ItemView: Base,
    Component: Base,
    TFile: Base,
    TFolder: Base,
    WorkspaceLeaf: Base,
    MarkdownRenderer: { renderMarkdown: async () => {} },
  };
});

describe('#775 — a successful Codex connection test leaves the plugin ready', () => {
  it('holds with the real sync and the real setFieldValue behind the button', async () => {
    const persisted: boolean[] = [];
    const [before, after] = CODEX_MODELS;
    const settings = { ...DEFAULT_SETTINGS, provider: 'openai-codex', model: before, llmReady: false };

    const tab = Object.create(LLMWikiSettingTab.prototype) as LLMWikiSettingTab;
    tab.tempSettings = { ...settings };
    tab.plugin = {
      settings: { ...settings },
      initializeLLMClient: vi.fn(),
      wikiEngine: { updateSettings: vi.fn() },
      testLLMConnection: vi.fn(async () => {
        tab.plugin.settings.llmReady = true;
        // The connection test may move the model; the sync is what carries it back.
        tab.plugin.settings.model = after;
        return { success: true, message: 'ok' };
      }),
      saveSettings: vi.fn(async () => { persisted.push(tab.plugin.settings.llmReady); }),
    } as unknown as LLMWikiSettingTab['plugin'];
    tab.getText = ((key: string) => key) as LLMWikiSettingTab['getText'];
    tab.display = vi.fn();
    // The commit is the one step replaced: the real one flushes the API key to
    // SecretStorage, which is not what this test is about.
    tab.commitTempSettings = vi.fn((): boolean => {
      tab.plugin.settings = { ...tab.tempSettings };
      return true;
    });

    renderTestConnectionSection(tab, {} as HTMLElement);
    await buttonClicks[0]();

    // The sync ran — without this the readiness below would hold on a path that
    // never reached it.
    expect(tab.tempSettings.model).toBe(after);
    expect(tab.tempSettings.llmReady).toBe(true);
    expect(tab.plugin.settings.llmReady).toBe(true);
    expect(persisted).toEqual([true]);
  });
});
