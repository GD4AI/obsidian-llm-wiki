import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../types';
import type { LLMWikiSettingTab } from '../../ui/settings';

const controls = vi.hoisted(() => new Map<string, { inputEl: { type: string }; change?: (value: string) => void }>());

vi.mock('obsidian', () => {
  let currentName = '';
  class ControlMock {
    inputEl = { type: '', min: '', max: '', classList: { add: vi.fn() } };
    addOption(): this { return this; }
    setValue(): this { return this; }
    setPlaceholder(): this { return this; }
    setButtonText(): this { return this; }
    setIcon(): this { return this; }
    setTooltip(): this { return this; }
    onClick(): this { return this; }
    onChange(callback: (value: string) => void): this {
      controls.set(currentName, { inputEl: this.inputEl, change: callback });
      return this;
    }
  }
  class SettingMock {
    settingEl = { style: { display: '' } };
    constructor(_container: HTMLElement) {}
    setName(value: string): this { currentName = value; return this; }
    setDesc(): this { return this; }
    setHeading(): this { return this; }
    addDropdown(callback: (control: ControlMock) => void): this { callback(new ControlMock()); return this; }
    addText(callback: (control: ControlMock) => void): this { callback(new ControlMock()); return this; }
    addTextArea(callback: (control: ControlMock) => void): this { callback(new ControlMock()); return this; }
    addToggle(callback: (control: ControlMock) => void): this { callback(new ControlMock()); return this; }
    addButton(callback: (control: ControlMock) => void): this { callback(new ControlMock()); return this; }
    addComponent(callback: (element: HTMLElement) => unknown): this { callback({} as HTMLElement); return this; }
  }
  return {
    Setting: SettingMock,
    Notice: class {},
    TFile: class {},
    BaseComponent: class {},
  };
});

vi.mock('../../ui/history-modal', () => ({ HistoryModal: class {} }));
vi.mock('../../ui/tag-chip-input', () => ({ TagChipInputComponent: class {} }));

import { renderWikiConfigSection } from '../../ui/settings-sections/wiki-config-section';

describe('MinerU settings', () => {
  it('reads and writes the token through a password SecretStorage control', () => {
    controls.clear();
    const getSecret = vi.fn(() => 'stored-token');
    const setSecret = vi.fn();
    const tab = {
      tempSettings: { ...DEFAULT_SETTINGS, markdownConversionBackend: 'mineru' },
      app: { secretStorage: { getSecret, setSecret } },
      getText: (key: string) => key,
    } as unknown as LLMWikiSettingTab;

    renderWikiConfigSection(tab, {} as HTMLElement);

    const token = controls.get('mineruApiTokenName');
    expect(getSecret).toHaveBeenCalledWith('karpathywiki-mineru-api-token');
    expect(token?.inputEl.type).toBe('password');
    token?.change?.(' new-token ');
    expect(setSecret).toHaveBeenCalledWith('karpathywiki-mineru-api-token', 'new-token');
    expect(tab.tempSettings).not.toHaveProperty('mineruApiToken');
  });
});
