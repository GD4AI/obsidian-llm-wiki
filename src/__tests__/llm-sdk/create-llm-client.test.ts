// v1.23.0 P1-7: Unit tests for the new createLLMClientFromSettings factory.
//
// Verifies the provider-id → client-class dispatch matches the legacy
// behavior in main.ts. Uses the async factory (which dynamically imports
// the SDK modules) — the sync factory is exercised by integration tests
// after `preloadLLMClientModules()` runs.

import { describe, it, expect } from 'vitest';
import { createLLMClientFromSettings } from '../../llm-sdk/create-llm-client';
import { OpenAISdkClient } from '../../llm-sdk/openai-sdk-client';
import { AnthropicSdkClient } from '../../llm-sdk/anthropic-sdk-client';
import { OpenAICompatSdkClient } from '../../llm-sdk/openai-compat-sdk-client';
import { OpenAICodexSdkClient } from '../../llm-sdk/openai-codex-sdk-client';
import { CodexAuthManager } from '../../llm-sdk/openai-codex/auth-manager';
import { memoryCredentialStore } from './openai-codex-test-helpers';

function fakeAuthManager(): CodexAuthManager {
  return new CodexAuthManager({ store: memoryCredentialStore(), refresh: async (credential) => credential });
}

describe('createLLMClientFromSettings (async)', () => {
  describe('official providers', () => {
    it('creates OpenAICodexSdkClient only with an auth manager', async () => {
      const codexAuth = fakeAuthManager();
      const client = await createLLMClientFromSettings({ provider: 'openai-codex', apiKey: '', providerApiKeySecretId: 'karpathywiki-provider-api-key', codexAuth });
      expect(client).toBeInstanceOf(OpenAICodexSdkClient);
    });

    it('rejects openai-codex without its auth manager', async () => {
      await expect(createLLMClientFromSettings({ provider: 'openai-codex', apiKey: '', providerApiKeySecretId: 'karpathywiki-provider-api-key' })).rejects.toThrow('Codex auth manager is required');
    });

    it('returns AnthropicSdkClient for provider="anthropic"', async () => {
      const c = await createLLMClientFromSettings({ provider: 'anthropic', apiKey: 'sk-ant', providerApiKeySecretId: '' });
      expect(c).toBeInstanceOf(AnthropicSdkClient);
    });

    it('returns OpenAISdkClient for provider="openai"', async () => {
      const c = await createLLMClientFromSettings({ provider: 'openai', apiKey: 'sk-test', providerApiKeySecretId: 'karpathywiki-provider-api-key' });
      expect(c).toBeInstanceOf(OpenAISdkClient);
    });
  });

  describe('Anthropic-compatible (Coding Plan / z.ai / GLM-Anthropic)', () => {
    it('returns AnthropicSdkClient with baseURL for provider="anthropic-compatible"', async () => {
      const c = await createLLMClientFromSettings({
        provider: 'anthropic-compatible',
        apiKey: 'sk-test',
        baseUrl: 'https://api.z.ai/v1',
        providerApiKeySecretId: 'karpathywiki-provider-api-key',
      });
      expect(c).toBeInstanceOf(AnthropicSdkClient);
    });

    it('falls back to AnthropicSdkClient (default baseURL) when anthropic-compatible has no baseUrl', async () => {
      const c = await createLLMClientFromSettings({
        provider: 'anthropic-compatible',
        apiKey: 'sk-test',
        providerApiKeySecretId: 'karpathywiki-provider-api-key',
      });
      expect(c).toBeInstanceOf(AnthropicSdkClient);
    });
  });

  describe('OpenAI-compatible backends (8 PREDEFINED_PROVIDERS + custom)', () => {
    it.each([
      ['gemini', 'https://generativelanguage.googleapis.com/v1beta/openai'],
      ['openrouter', 'https://openrouter.ai/api/v1'],
      ['deepseek', 'https://api.deepseek.com/v1'],
      ['minimax', 'https://api.minimaxi.com/v1'],
      ['moonshot', 'https://api.moonshot.cn/v1'],
      ['glm', 'https://open.bigmodel.cn/api/paas/v4'],
      ['ollama', 'http://localhost:11434/v1'],
      ['lmstudio', 'http://localhost:1234/v1'],
    ])('returns OpenAICompatSdkClient for provider=%s', async (provider, baseURL) => {
      const c = await createLLMClientFromSettings({
        provider,
        apiKey: 'test-key',
        baseUrl: baseURL,
        providerApiKeySecretId: 'karpathywiki-provider-api-key',
      });
      expect(c).toBeInstanceOf(OpenAICompatSdkClient);
    });

    it('returns OpenAICompatSdkClient for unknown provider with custom baseUrl', async () => {
      const c = await createLLMClientFromSettings({
        provider: 'custom-provider',
        apiKey: 'test-key',
        baseUrl: 'https://my-custom.example.com/v1',
        providerApiKeySecretId: 'karpathywiki-provider-api-key',
      });
      expect(c).toBeInstanceOf(OpenAICompatSdkClient);
    });

    it('returns OpenAISdkClient for the custom-responses preset (Issue #723)', async () => {
      // `apiShape: 'responses'` routes to the OpenAI client, whose
      // `provider(modelId)` call already resolves to the Responses model — so
      // `/v1/responses` against a user-supplied base URL needs no new dependency
      // and no bespoke request adapter. Asserted here because the routing is the
      // whole mechanism: if this preset silently landed on the compat client it
      // would send `/v1/chat/completions` and the user would never know why.
      const c = await createLLMClientFromSettings({
        provider: 'custom-responses',
        apiKey: 'test-key',
        baseUrl: 'https://my-gateway.example.com/v1',
        providerApiKeySecretId: 'karpathywiki-provider-api-key',
      });
      expect(c).toBeInstanceOf(OpenAISdkClient);
    });

    it('keeps the completion preset on the compat client after the rename', async () => {
      // Guard for the rename in the same change: `custom` must not have been
      // swept onto the new route by the apiShape branch.
      const c = await createLLMClientFromSettings({
        provider: 'custom',
        apiKey: 'test-key',
        baseUrl: 'https://my-gateway.example.com/v1',
        providerApiKeySecretId: 'karpathywiki-provider-api-key',
      });
      expect(c).toBeInstanceOf(OpenAICompatSdkClient);
    });
  });

  describe('useOfficialOpenAI override', () => {
    it('returns OpenAISdkClient regardless of provider id when useOfficialOpenAI=true', async () => {
      const c = await createLLMClientFromSettings({
        provider: 'deepseek',
        apiKey: 'sk-test',
        baseUrl: 'https://api.deepseek.com/v1',
        useOfficialOpenAI: true,
        providerApiKeySecretId: 'karpathywiki-provider-api-key',
      });
      expect(c).toBeInstanceOf(OpenAISdkClient);
    });
  });

  describe('input handling', () => {
    it('trims apiKey whitespace', async () => {
      const c = await createLLMClientFromSettings({ provider: 'anthropic', apiKey: '  sk-ant  ', providerApiKeySecretId: 'karpathywiki-provider-api-key' });
      expect(c).toBeInstanceOf(AnthropicSdkClient);
    });

    it('treats empty baseUrl as undefined', async () => {
      const c = await createLLMClientFromSettings({
        provider: 'openai',
        apiKey: 'sk-test',
        baseUrl: '   ',
        providerApiKeySecretId: 'karpathywiki-provider-api-key',
      });
      expect(c).toBeInstanceOf(OpenAISdkClient);
    });
  });
});

describe('createLLMClientFromSettingsSync (preloaded)', () => {
  // The sync factory requires preloadLLMClientModules() to have run.
  // Since we already invoked the async factory in the tests above, the
  // modules are already in the module cache (Node.js caches them).
  // The sync shim's internal preloadedModules variable, however, is
  // separate. We test it by explicitly calling preloadLLMClientModules.
  it('throws when modules not preloaded', async () => {
    const { createLLMClientFromSettingsSync, _resetPreloadedModulesForTests } = await import(
      '../../llm-sdk/create-llm-client'
    );
    _resetPreloadedModulesForTests();
    expect(() =>
      createLLMClientFromSettingsSync({ provider: 'openai', apiKey: 'sk-test', providerApiKeySecretId: 'karpathywiki-provider-api-key' })
    ).toThrow(/SDK modules not preloaded/);
  });

  it('creates the preloaded Codex client only with its auth manager', async () => {
    const { createLLMClientFromSettingsSync, preloadLLMClientModules } = await import('../../llm-sdk/create-llm-client');
    await preloadLLMClientModules();
    const codexAuth = fakeAuthManager();
    expect(createLLMClientFromSettingsSync({ provider: 'openai-codex', apiKey: '', codexAuth, providerApiKeySecretId: 'karpathywiki-provider-api-key' })).toBeInstanceOf(OpenAICodexSdkClient);
    expect(() => createLLMClientFromSettingsSync({ provider: 'openai-codex', apiKey: '', providerApiKeySecretId: 'karpathywiki-provider-api-key' })).toThrow('Codex auth manager is required');
  });
});
