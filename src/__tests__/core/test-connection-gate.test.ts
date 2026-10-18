// test-connection-gate.test.ts
//
// v1.23.0 LM Studio hotfix (#214): verify that local providers (ollama,
// lmstudio) with empty apiKey bypass the gate in testLLMConnection,
// while cloud providers (openai, anthropic) still require a key.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import LLMWikiPlugin from '../../main';
import { TEXTS } from '../../texts';

// Mock the create-llm-client module so testLLMConnection doesn't
// try to dynamically import AI-SDK packages (which would fail in
// the test environment).
vi.mock('../../llm-sdk/create-llm-client', () => ({
  createLLMClientFromSettingsSync: vi.fn(() => ({
    createMessage: vi.fn().mockResolvedValue('ok'),
    createMessageStream: vi.fn(),
  })),
  preloadLLMClientModules: vi.fn().mockResolvedValue(undefined),
  _resetPreloadedModulesForTests: vi.fn(),
}));

describe('testLLMConnection — local provider API key gate', () => {
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
    // Provide minimal settings required by testLLMConnection
    (plugin as unknown as Record<string, unknown>).settings = {
      provider: 'ollama',
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5-7b',
      language: 'en',
      wikiFolder: 'wiki',
      llmReady: false,
      maxTokensPerCall: 0,
      autoIngestNotificationLevel: 'notice',
      autoWatchSources: false,
      startupCheck: false,
      slugCase: 'preserve',
    };
  });

  it('allows lmstudio provider with empty apiKey to bypass the gate (the fix)', async () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'lmstudio',
      apiKey: '',
    };

    const result = await plugin.testLLMConnection();

    // Should NOT return the apiKey error — if it bypasses the gate,
    // it reaches the mocked createLLMClient which returns success.
    expect(result.success).toBe(true);
  });

  it('allows ollama provider with empty apiKey to bypass the gate (existing behavior)', async () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'ollama',
      apiKey: '',
    };

    const result = await plugin.testLLMConnection();

    expect(result.success).toBe(true);
  });

  it('rejects openai provider with empty apiKey', async () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'openai',
      apiKey: '',
    };

    const result = await plugin.testLLMConnection();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/API Key/i);
  });

  it('rejects anthropic provider with empty apiKey', async () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'anthropic',
      apiKey: '',
    };

    const result = await plugin.testLLMConnection();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/API Key/i);
  });

  it('rejects gemini (openai-compatible) provider with empty apiKey', async () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'gemini',
      apiKey: '',
    };

    const result = await plugin.testLLMConnection();

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/API Key/i);
  });

  it('allows lmstudio with a non-empty apiKey (normal config)', async () => {
    (plugin as unknown as Record<string, unknown>).settings = {
      ...(plugin as unknown as Record<string, unknown>).settings as Record<string, unknown>,
      provider: 'lmstudio',
      apiKey: 'some-key',
    };

    const result = await plugin.testLLMConnection();

    expect(result.success).toBe(true);
  });
});

// v1.24.0 #208: per-task Test Connection. When usePerTaskModels is on,
// every task's model must probe successfully; ANY failure aborts the
// whole test (returns failure with the actual error message from the
// failing task).
describe('testLLMConnection — per-task model probes (#208)', () => {
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

  /**
   * Build a plugin whose settings mirror a real per-task config.
   * The mock createMessage is per-instance — we capture the (model,
   * callIndex) pair so each test can assert the sequence of probed
   * models.
   */
  function makePlugin(perTaskSettings: Record<string, unknown>) {
    const plugin = new LLMWikiPlugin(mockApp as never, mockManifest as never);
    (plugin as unknown as Record<string, unknown>).settings = {
      provider: 'openai',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1',
      language: 'en',
      wikiFolder: 'wiki',
      llmReady: false,
      maxTokensPerCall: 0,
      autoIngestNotificationLevel: 'notice',
      autoWatchSources: false,
      startupCheck: false,
      slugCase: 'preserve',
      ...perTaskSettings,
    };
    return plugin;
  }

  it('unified mode: probes only settings.model (single call)', async () => {
    const { createLLMClientFromSettingsSync } = await import('../../llm-sdk/create-llm-client');
    const createMessage = vi.fn().mockResolvedValue('ok');
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({
      createMessage,
      createMessageStream: vi.fn(),
    });
    const plugin = makePlugin({});
    const result = await plugin.testLLMConnection();
    expect(result.success).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect((createMessage.mock.calls[0][0] as { model: string }).model).toBe('gpt-4.1');
  });

  it('per-task mode: probes all three tasks in order ingest → lint → query', async () => {
    const { createLLMClientFromSettingsSync } = await import('../../llm-sdk/create-llm-client');
    const createMessage = vi.fn().mockResolvedValue('ok');
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({
      createMessage,
      createMessageStream: vi.fn(),
    });
    const plugin = makePlugin({
      usePerTaskModels: true,
      ingestModel: 'gpt-4.1-mini',
      lintModel: 'gpt-4o-mini',
      queryModel: 'gpt-5',
    });
    const result = await plugin.testLLMConnection();
    expect(result.success).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(3);
    expect((createMessage.mock.calls[0][0] as { model: string }).model).toBe('gpt-4.1-mini'); // ingest
    expect((createMessage.mock.calls[1][0] as { model: string }).model).toBe('gpt-4o-mini'); // lint
    expect((createMessage.mock.calls[2][0] as { model: string }).model).toBe('gpt-5');      // query
  });

  it('per-task mode: empty per-task values fall back to settings.model', async () => {
    const { createLLMClientFromSettingsSync } = await import('../../llm-sdk/create-llm-client');
    const createMessage = vi.fn().mockResolvedValue('ok');
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({
      createMessage,
      createMessageStream: vi.fn(),
    });
    const plugin = makePlugin({ usePerTaskModels: true });
    // All three per-task fields undefined → all probe settings.model.
    const result = await plugin.testLLMConnection();
    expect(result.success).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(3);
    expect((createMessage.mock.calls[0][0] as { model: string }).model).toBe('gpt-4.1');
    expect((createMessage.mock.calls[1][0] as { model: string }).model).toBe('gpt-4.1');
    expect((createMessage.mock.calls[2][0] as { model: string }).model).toBe('gpt-4.1');
  });

  it('per-task mode: failure on lint task aborts before query probe', async () => {
    const { createLLMClientFromSettingsSync } = await import('../../llm-sdk/create-llm-client');
    // First call (ingest) succeeds, second call (lint) throws, third
    // (query) should never run.
    const createMessage = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(new Error('lint model 400: model not found'))
      .mockResolvedValue('ok'); // would resolve if called
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({
      createMessage,
      createMessageStream: vi.fn(),
    });
    const plugin = makePlugin({
      usePerTaskModels: true,
      ingestModel: 'gpt-4.1-mini',
      lintModel: 'gpt-4o-mini', // ← fails
      queryModel: 'gpt-5',       // ← never reached
    });
    const result = await plugin.testLLMConnection();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/lint model 400/);
    // Critical: query probe must NOT have been issued (sequential,
    // fail-fast). If we ran all 3 in parallel, this would be 3 — pin 2.
    expect(createMessage).toHaveBeenCalledTimes(2);
    expect((createMessage.mock.calls[0][0] as { model: string }).model).toBe('gpt-4.1-mini'); // ingest succeeded
    expect((createMessage.mock.calls[1][0] as { model: string }).model).toBe('gpt-4o-mini'); // lint failed
  });
});

// Issue #517: a model that was never selected must fail locally with the
// "pick a model" message. Before the guard, `settings.model === ''` went on
// the wire as `"model": ""`; OpenRouter answers HTTP 502 `Invalid URL:`,
// the AI SDK retries it 3x, and testLLMConnection reported that verbatim —
// so a missing model read as a broken Base URL.
describe('testLLMConnection — blank model gate (#517)', () => {
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

  /** Fresh-install OpenRouter config: provider + key set, model not chosen. */
  function makePlugin(overrides: Record<string, unknown>) {
    const plugin = new LLMWikiPlugin(mockApp as never, mockManifest as never);
    (plugin as unknown as Record<string, unknown>).settings = {
      provider: 'openrouter',
      apiKey: 'sk-or-test',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: '',
      language: 'en',
      wikiFolder: 'wiki',
      llmReady: false,
      maxTokensPerCall: 0,
      autoIngestNotificationLevel: 'notice',
      autoWatchSources: false,
      startupCheck: false,
      slugCase: 'preserve',
      ...overrides,
    };
    return plugin;
  }

  async function mockClient() {
    const { createLLMClientFromSettingsSync } = await import('../../llm-sdk/create-llm-client');
    const createMessage = vi.fn().mockResolvedValue('ok');
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({
      createMessage,
      createMessageStream: vi.fn(),
    });
    return createMessage;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unified mode: an empty model fails without touching the network', async () => {
    const createMessage = await mockClient();
    const result = await makePlugin({}).testLLMConnection();
    expect(result.success).toBe(false);
    expect(result.message).toBe(TEXTS.en.errorNoModel);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('unified mode: a whitespace-only model is also blank', async () => {
    const createMessage = await mockClient();
    const result = await makePlugin({ model: '   ' }).testLLMConnection();
    expect(result.success).toBe(false);
    expect(result.message).toBe(TEXTS.en.errorNoModel);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('per-task mode: one unresolvable task aborts before any probe runs', async () => {
    const createMessage = await mockClient();
    // ingest + lint resolve; query falls back to settings.model, which is
    // blank. The guard runs before the loop, so even the two valid probes
    // must not be issued.
    const result = await makePlugin({
      usePerTaskModels: true,
      ingestModel: 'openai/gpt-4o-mini',
      lintModel: 'openai/gpt-4o-mini',
      queryModel: '',
    }).testLLMConnection();
    expect(result.success).toBe(false);
    expect(result.message).toBe(TEXTS.en.errorNoModel);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('a selected model still probes normally', async () => {
    const createMessage = await mockClient();
    const result = await makePlugin({ model: 'openai/gpt-4o-mini' }).testLLMConnection();
    expect(result.success).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect((createMessage.mock.calls[0][0] as { model: string }).model).toBe('openai/gpt-4o-mini');
  });

  it('the API key gate still wins over the model gate', async () => {
    const createMessage = await mockClient();
    const result = await makePlugin({ apiKey: '', model: '' }).testLLMConnection();
    expect(result.success).toBe(false);
    expect(result.message).toBe(TEXTS.en.errorNoApiKey);
    expect(createMessage).not.toHaveBeenCalled();
  });
});

// #425 Bedrock Stage 2 — the auth-mode gate replaces the API-key gate
// when a bedrock-* provider runs in sso/iam mode.
describe('testLLMConnection — Bedrock SSO/IAM gate (#425)', () => {
  const mockApp2 = {
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

  async function mockClient() {
    const { createLLMClientFromSettingsSync } = await import('../../llm-sdk/create-llm-client');
    const createMessage = vi.fn().mockResolvedValue('ok');
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({
      createMessage,
      createMessageStream: vi.fn(),
    });
    return createMessage;
  }

  function bedrockPlugin(authMethod: 'sso' | 'iam', extra: Record<string, unknown> = {}): LLMWikiPlugin {
    const plugin = new LLMWikiPlugin(mockApp2 as never, mockManifest as never);
    (plugin as unknown as Record<string, unknown>).settings = {
      provider: 'bedrock-anthropic',
      apiKey: '',
      model: 'anthropic.claude-3-5-sonnet',
      language: 'en',
      wikiFolder: 'wiki',
      llmReady: false,
      maxTokensPerCall: 0,
      autoIngestNotificationLevel: 'notice',
      autoWatchSources: false,
      startupCheck: false,
      slugCase: 'preserve',
      bedrockRegion: 'us-east-1',
      bedrockAuthMethod: authMethod,
    };
    (plugin as unknown as Record<string, unknown>).bedrockAuthManager = {
      hasSsoToken: () => extra.hasSsoToken === true,
      hasIamKeys: () => extra.hasIamKeys === true,
    };
    return plugin;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sso mode without a token stops with a run-SSO-login message, not an API-key error', async () => {
    const result = await bedrockPlugin('sso').testLLMConnection();
    expect(result.success).toBe(false);
    expect(result.message).toBe(TEXTS.en.bedrockSsoRequired);
  });

  it('sso mode WITH a signed-in token proceeds past every key gate', async () => {
    const createMessage = await mockClient();
    const result = await bedrockPlugin('sso', { hasSsoToken: true }).testLLMConnection();
    expect(result.success).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it('iam mode without keys stops with an enter-keys message', async () => {
    const result = await bedrockPlugin('iam').testLLMConnection();
    expect(result.success).toBe(false);
    expect(result.message).toBe(TEXTS.en.bedrockIamRequired);
  });

  it('iam mode with keys saved proceeds normally', async () => {
    const createMessage = await mockClient();
    const result = await bedrockPlugin('iam', { hasIamKeys: true }).testLLMConnection();
    expect(result.success).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(1);
  });
});
