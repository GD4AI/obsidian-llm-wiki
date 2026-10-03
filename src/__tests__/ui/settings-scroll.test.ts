import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { DEFAULT_SETTINGS } from '../../types';
import { LLMWikiSettingTab } from '../../ui/settings';

vi.mock('../../ui/settings-sections/language-section', () => ({ renderLanguageSection: vi.fn() }));
vi.mock('../../ui/settings-sections/status-section', () => ({ renderStatusSection: vi.fn() }));
vi.mock('../../ui/settings-sections/provider-section', () => ({ renderProviderSection: vi.fn() }));
vi.mock('../../ui/settings-sections/model-section', () => ({ renderModelSection: vi.fn() }));
vi.mock('../../ui/settings-sections/advanced-section', () => ({ renderAdvancedSection: vi.fn() }));
vi.mock('../../ui/settings-sections/test-connection-section', () => ({ renderTestConnectionSection: vi.fn() }));
vi.mock('../../ui/settings-sections/wiki-config-section', () => ({ renderWikiConfigSection: vi.fn() }));
vi.mock('../../ui/settings-sections/auto-maintain-section', () => ({ renderAutoMaintainSection: vi.fn() }));
vi.mock('../../ui/settings-sections/advanced-settings-section', () => ({
  renderAdvancedSettingsSection: (tab: LLMWikiSettingTab, container: HTMLElement) => {
    const content = container.ownerDocument.createElement('div');
    content.textContent = tab.tempSettings.showAdvancedSettings ? 'Expanded settings' : 'Settings';
    container.appendChild(content);
  },
}));

function createTab(): LLMWikiSettingTab {
  const tab = Object.create(LLMWikiSettingTab.prototype) as LLMWikiSettingTab;
  tab.tempSettings = { ...DEFAULT_SETTINGS };
  tab.containerEl = new JSDOM('<!DOCTYPE html><div></div>').window.document.querySelector('div')!;
  // jsdom has no layout: model the browser clamping an emptied scroller.
  tab.containerEl.empty = () => {
    tab.containerEl.replaceChildren();
    tab.containerEl.scrollTop = 0;
  };
  return tab;
}

describe('settings scroll position', () => {
  it('keeps the first render at the top', () => {
    const tab = createTab();

    tab.display();

    expect(tab.containerEl.scrollTop).toBe(0);
    expect(tab.containerEl.textContent).toBe('Settings');
  });

  it('preserves the current offset through repeated settings rebuilds', () => {
    const tab = createTab();
    tab.display();
    const originalContent = tab.containerEl.firstChild;
    tab.containerEl.scrollTop = 640;
    tab.tempSettings.showAdvancedSettings = true;

    tab.display();

    expect(tab.containerEl.textContent).toBe('Expanded settings');
    expect(originalContent?.parentNode).toBeNull();
    expect(tab.containerEl.scrollTop).toBe(640);

    tab.containerEl.scrollTop = 320;
    tab.display();
    expect(tab.containerEl.scrollTop).toBe(320);
  });

  it('restores only after content exists and respects a shorter scroll range', () => {
    const tab = createTab();
    let offset = 0;
    Object.defineProperty(tab.containerEl, 'scrollTop', {
      get: () => offset,
      set: (value: number) => {
        const maximum = tab.containerEl.childElementCount === 0
          ? 0
          : tab.tempSettings.showAdvancedSettings ? 1000 : 200;
        offset = Math.max(0, Math.min(value, maximum));
      },
    });
    tab.tempSettings.showAdvancedSettings = true;
    tab.display();
    tab.containerEl.scrollTop = 800;

    tab.tempSettings.showAdvancedSettings = false;
    tab.display();

    expect(tab.containerEl.textContent).toBe('Settings');
    expect(tab.containerEl.scrollTop).toBe(200);
  });
});
