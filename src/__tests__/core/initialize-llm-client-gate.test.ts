// initializeLLMClient must allow lmstudio (and ollama) with an empty
// apiKey — same gate as testLLMConnection (#223). Without this, ingest
// commands see llmClient === null and show errorNoApiKey.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import LLMWikiPlugin from '../../main';

vi.mock('../../llm-sdk/create-llm-client', () => ({
  createLLMClientFromSettingsSync: vi.fn(() => ({
    createMessage: vi.fn().mockResolvedValue('ok'),
    createMessageStream: vi.fn(),
  })),
  preloadLLMClientModules: vi.fn().mockResolvedValue(undefined),
  _resetPreloadedModulesForTests: vi.fn(),
}));

describe('initializeLLMClient — local provider API key gate', () => {
  const mockApp = {
    vault: {
      getAbstractFileByPath: vi.fn().mockReturnValue(null),
      getMarkdownFiles: vi.fn().mockReturnValue([]),
      read: vi.fn().mockResolvedValue(''),
    },
  };
  const mockManifest = {
    id: 'test-plugin',
    name: 'Test',
    version: '1.0.0',
    minAppVersion: '0.15.0',
  };
  let plugin: LLMWikiPlugin;

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = new LLMWikiPlugin(mockApp as never, mockManifest as never);
    (plugin as unknown as Record<string, unknown>).settings = {
      provider: 'openai',
      apiKey: '',
      baseUrl: 'http://localhost:1234/v1',
      model: 'qwen2.5-7b',
      language: 'en',
      wikiFolder: 'wiki',
      llmReady: true,
      maxTokensPerCall: 0,
      autoIngestNotificationLevel: 'notice',
      autoWatchSources: false,
      startupCheck: false,
      slugCase: 'preserve',
    };
  });

  it('initializes llmClient for lmstudio with empty apiKey (ingest gate)', () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'lmstudio',
      apiKey: '',
    };

    plugin.initializeLLMClient();

    expect(plugin.llmClient).not.toBeNull();
  });

  it('initializes llmClient for ollama with empty apiKey (existing behavior)', () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'ollama',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
    };

    plugin.initializeLLMClient();

    expect(plugin.llmClient).not.toBeNull();
  });

  it('leaves llmClient null for openai with empty apiKey', () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'openai',
      apiKey: '',
    };

    plugin.initializeLLMClient();

    expect(plugin.llmClient).toBeNull();
  });

  it('initializes llmClient for lmstudio when apiKey is whitespace-only', () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'lmstudio',
      apiKey: '   ',
    };

    plugin.initializeLLMClient();

    expect(plugin.llmClient).not.toBeNull();
  });
});
