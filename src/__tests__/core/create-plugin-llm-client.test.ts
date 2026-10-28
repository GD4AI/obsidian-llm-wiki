// Bedrock Stage 2 prerequisite (#425): the plugin-level factory must
// forward `settings.bedrockRegion` into the sync SDK-factory literal.
//
// Regression context: since v1.24.1 the literal built here omitted
// `bedrockRegion`, so every production sync-path Bedrock call silently
// ran against BEDROCK_DEFAULT_REGION (us-east-1) regardless of the
// user's Settings dropdown — the async factory honored the setting,
// which is why the existing bedrock-factory tests never caught it.
// Stage 2 (SSO/SigV4 signing scope) depends on the region, so the
// forwarding is pinned by contract here.
//
// Strategy: mock the sync factory (same pattern as
// test-connection-gate.test.ts so no AI-SDK dynamic imports run) and
// assert on the literal it receives — the literal IS the contract
// under test.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMClient } from '../../core/create-plugin-llm-client';
import { createLLMClientFromSettingsSync } from '../../llm-sdk/create-llm-client';
import type { BedrockAuthManager } from '../../llm-sdk/bedrock-sso/credential-manager';
import type { LLMWikiSettings } from '../../types';

vi.mock('../../llm-sdk/create-llm-client', () => ({
  createLLMClientFromSettingsSync: vi.fn(() => ({
    createMessage: vi.fn().mockResolvedValue('ok'),
    createMessageStream: vi.fn(),
  })),
  preloadLLMClientModules: vi.fn().mockResolvedValue(undefined),
}));

describe('createLLMClient — Bedrock region forwarding (#425 prerequisite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards bedrockRegion into the sync factory literal', () => {
    const settings = {
      provider: 'bedrock-anthropic',
      apiKey: 'ABSK-test',
      providerApiKeySecretId: 'karpathywiki-provider-api-key',
      language: 'en',
      bedrockRegion: 'eu-central-1',
    } as unknown as LLMWikiSettings;

    createLLMClient(settings);

    expect(createLLMClientFromSettingsSync).toHaveBeenCalledTimes(1);
    expect(createLLMClientFromSettingsSync).toHaveBeenCalledWith(
      expect.objectContaining({ bedrockRegion: 'eu-central-1' }),
      undefined,
    );
  });

  it('still forwards the other credential seams alongside the region', () => {
    const secretStorage = { getSecret: vi.fn(), setSecret: vi.fn() };
    const settings = {
      provider: 'bedrock-openai',
      apiKey: '',
      providerApiKeySecretId: 'karpathywiki-provider-api-key',
      language: 'de',
      baseUrl: 'https://example.invalid',
      bedrockRegion: 'ap-northeast-1',
    } as unknown as LLMWikiSettings;

    createLLMClient(settings, undefined, 'test-version', secretStorage, 'pending-key');

    expect(createLLMClientFromSettingsSync).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'bedrock-openai',
        baseUrl: 'https://example.invalid',
        bedrockRegion: 'ap-northeast-1',
        secretStorage,
        codexVersion: 'test-version',
      }),
      'pending-key',
    );
  });

  it('forwards the Stage-2 bedrock auth fields and manager (#425)', () => {
    const manager = {} as BedrockAuthManager;
    const settings = {
      provider: 'bedrock-anthropic',
      apiKey: '',
      providerApiKeySecretId: 'karpathywiki-provider-api-key',
      language: 'en',
      bedrockRegion: 'us-east-1',
      bedrockAuthMethod: 'sso',
      bedrockSsoAccountId: '123456789012',
      bedrockSsoRoleName: 'PowerUserAccess',
    } as unknown as LLMWikiSettings;

    createLLMClient(settings, undefined, undefined, null, undefined, manager);

    expect(createLLMClientFromSettingsSync).toHaveBeenCalledWith(
      expect.objectContaining({
        bedrockAuthMethod: 'sso',
        bedrockSsoAccountId: '123456789012',
        bedrockSsoRoleName: 'PowerUserAccess',
        bedrockAuthManager: manager,
      }),
      undefined,
    );
  });
});

// Issue #904: the wrapper resolves the thinking precedence from these two
// fields. They are optional on both sides, so a type check cannot tell a
// forwarded value from a forgotten one — the first version of this change read
// `settings.thinkingEffort` in the wrapper and never passed it in, which would
// have shipped a dropdown that changed nothing. This pins the forwarding.
describe('createLLMClient — thinking settings reach the wrapper (#904)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards thinkingEffort and disableThinking to the wrapped client', async () => {
    const settings = {
      provider: 'minimax',
      apiKey: 'sk-test',
      language: 'en',
      maxTokensPerCall: 0,
      thinkingEffort: 'high',
      disableThinking: false,
    } as unknown as LLMWikiSettings;

    const client = createLLMClient(settings);
    await client.createMessage({
      model: 'test-model',
      max_tokens: 1000,
      messages: [{ role: 'user', content: 'hi' }],
      task: 'extract',
    });

    const inner = vi.mocked(createLLMClientFromSettingsSync).mock.results[0]?.value as {
      createMessage: { mock: { calls: Array<[Record<string, unknown>]> } };
    };
    const received = inner.createMessage.mock.calls[0][0];
    expect(received.reasoningEffort).toBe('high');
    expect(received.enableThinking).toBe(true);
  });

  it('lets the off toggle win even though a level is configured', async () => {
    const settings = {
      provider: 'minimax',
      apiKey: 'sk-test',
      language: 'en',
      maxTokensPerCall: 0,
      thinkingEffort: 'high',
      disableThinking: true,
    } as unknown as LLMWikiSettings;

    const client = createLLMClient(settings);
    await client.createMessage({
      model: 'test-model',
      max_tokens: 1000,
      messages: [{ role: 'user', content: 'hi' }],
      task: 'extract',
    });

    const inner = vi.mocked(createLLMClientFromSettingsSync).mock.results[0]?.value as {
      createMessage: { mock: { calls: Array<[Record<string, unknown>]> } };
    };
    const received = inner.createMessage.mock.calls[0][0];
    expect(received.enableThinking).toBe(false);
    expect(received.reasoningEffort).toBeUndefined();
  });
});
