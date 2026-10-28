import { beforeEach, describe, expect, it, vi } from 'vitest';
import LLMWikiPlugin, { createLLMClient, initializeLLMClientAfterModules } from '../../main';
import { CodexAuthManager } from '../../llm-sdk/openai-codex/auth-manager';
import { freshCredential, memoryCredentialStore } from '../llm-sdk/openai-codex-test-helpers';
import { createLLMClientFromSettingsSync } from '../../llm-sdk/create-llm-client';
import { Notice, Platform } from 'obsidian';
import { fetchCodexModelCatalog } from '../../llm-sdk/openai-codex/model-catalog';
import { CODEX_MODELS } from '../../llm-sdk/openai-codex/constants';

vi.mock('../../llm-sdk/create-llm-client', () => ({
  createLLMClientFromSettingsSync: vi.fn(() => ({
    createMessage: vi.fn().mockResolvedValue('ok'),
    createMessageStream: vi.fn(),
  })),
  preloadLLMClientModules: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../llm-sdk/openai-codex/model-catalog', () => ({ fetchCodexModelCatalog: vi.fn() }));

function settings(provider = 'openai-codex'): import('../../types').LLMWikiSettings {
  return {
    provider,
    apiKey: provider === 'openai' ? 'api-key' : '',
    openAICodexSecretId: 'karpathywiki-openai-codex',
    baseUrl: '',
    model: provider === 'openai-codex' ? 'gpt-5.5' : 'model',
    language: 'en',
    wikiFolder: 'wiki',
    llmReady: false,
    maxTokensPerCall: 0,
    autoWatchSources: false,
  } as import('../../types').LLMWikiSettings;
}

function pluginWith(manager: CodexAuthManager, provider = 'openai-codex'): LLMWikiPlugin {
  const app = { vault: { getAbstractFileByPath: vi.fn().mockReturnValue(null) } };
  const plugin = new LLMWikiPlugin(app as never, {} as never);
  plugin.settings = settings(provider);
  plugin.codexAuthManager = manager;
  return plugin;
}

describe('OpenAI Codex plugin lifecycle', () => {
  beforeEach(() => { vi.clearAllMocks(); (Notice as unknown as { instances: unknown[] }).instances.length = 0; Platform.isDesktopApp = true; vi.mocked(fetchCodexModelCatalog).mockResolvedValue([{ slug: 'remote-model', displayName: 'Remote Model', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] }]); });
  it('waits for SDK preloading before the first client initialization', async () => {
    let release = (): void => undefined;
    const modulesLoaded = new Promise<void>((resolve) => { release = resolve; });
    const initialize = vi.fn();
    const pending = initializeLLMClientAfterModules(modulesLoaded, initialize);
    await Promise.resolve();
    expect(initialize).not.toHaveBeenCalled();
    release();
    await pending;
    expect(initialize).toHaveBeenCalledOnce();
  });
  it('continues client initialization when SDK preloading fails', async () => {
    const initialize = vi.fn();
    await expect(initializeLLMClientAfterModules(Promise.reject(new Error('preload failed')), initialize)).resolves.toBeUndefined();
    expect(initialize).toHaveBeenCalledOnce();
  });
  it('initializes the shared client from a stored credential without an API key', () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential()) });
    const plugin = pluginWith(manager);
    plugin.initializeLLMClient();
    expect(plugin.llmClient).not.toBeNull();
    expect(createLLMClientFromSettingsSync).toHaveBeenCalledWith(expect.objectContaining({ provider: 'openai-codex', codexAuth: manager, codexQuotaMessage: 'ChatGPT Codex allowance reached. Wait for the displayed reset period and try again.' }), undefined);
  });
  it('injects the selected locale quota message into the Codex client', () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential()) });
    const plugin = pluginWith(manager);
    plugin.settings.language = 'zh';
    plugin.initializeLLMClient();
    expect(createLLMClientFromSettingsSync).toHaveBeenCalledWith(expect.objectContaining({ codexQuotaMessage: 'ChatGPT Codex 额度已用尽。请等待显示的重置时间后重试。' }), undefined);
  });
  it('migrates legacy readiness from SecretStorage without an API key', async () => {
    const values = new Map<string, string>([['karpathywiki-openai-codex', JSON.stringify(freshCredential())]]);
    const secretStorage = { getSecret: (id: string) => values.get(id) ?? null, setSecret: (id: string, value: string) => { values.set(id, value); } };
    const app = { secretStorage };
    const plugin = new LLMWikiPlugin(app as never, {} as never);
    vi.spyOn(plugin, 'loadData').mockResolvedValue({ provider: 'openai-codex', apiKey: '', model: 'gpt-5.5' });
    await plugin.loadSettings();
    expect(plugin.settings.llmReady).toBe(true);
  });
  it('persists settings after removing legacy token fields', async () => {
    const app = { secretStorage: { getSecret: () => null, setSecret: vi.fn() } };
    const plugin = new LLMWikiPlugin(app as never, {} as never);
    vi.spyOn(plugin, 'loadData').mockResolvedValue({ provider: 'openai-codex', language: 'en', wikiLanguage: 'en', accessToken: 'legacy-secret' });
    const saveData = vi.spyOn(plugin, 'saveData').mockResolvedValue();
    await plugin.loadSettings();
    const saved = saveData.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(saved.accessToken).toBeUndefined();
  });
  it('moves the unpublished MinerU token from data.json to SecretStorage', async () => {
    const setSecret = vi.fn();
    const app = { secretStorage: { getSecret: () => null, setSecret } };
    const plugin = new LLMWikiPlugin(app as never, {} as never);
    vi.spyOn(plugin, 'loadData').mockResolvedValue({
      provider: 'openai',
      language: 'en',
      wikiLanguage: 'en',
      mineruApiToken: ' legacy-mineru-token ',
    });
    const saveData = vi.spyOn(plugin, 'saveData').mockResolvedValue();

    await plugin.loadSettings();

    expect(setSecret).toHaveBeenCalledWith('karpathywiki-mineru-api-token', 'legacy-mineru-token');
    const saved = saveData.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(saved.mineruApiToken).toBeUndefined();
  });
  it('does not overwrite an existing MinerU SecretStorage token during cleanup', async () => {
    const setSecret = vi.fn();
    const app = { secretStorage: { getSecret: () => 'current-token', setSecret } };
    const plugin = new LLMWikiPlugin(app as never, {} as never);
    vi.spyOn(plugin, 'loadData').mockResolvedValue({
      provider: 'openai',
      language: 'en',
      wikiLanguage: 'en',
      mineruApiToken: 'stale-token',
    });
    const saveData = vi.spyOn(plugin, 'saveData').mockResolvedValue();

    await plugin.loadSettings();

    expect(setSecret).not.toHaveBeenCalled();
    const saved = saveData.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(saved.mineruApiToken).toBeUndefined();
  });
  it('does not initialize Codex without a stored credential', () => {
    const plugin = pluginWith(new CodexAuthManager({ store: memoryCredentialStore() }));
    plugin.initializeLLMClient();
    expect(plugin.llmClient).toBeNull();
    expect(createLLMClientFromSettingsSync).not.toHaveBeenCalled();
  });
  it('preserves API-key and local-provider readiness', () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore() });
    const openai = pluginWith(manager, 'openai');
    openai.initializeLLMClient();
    expect(openai.llmClient).not.toBeNull();
    vi.mocked(createLLMClientFromSettingsSync).mockClear();
    const ollama = pluginWith(manager, 'ollama');
    ollama.initializeLLMClient();
    expect(ollama.llmClient).not.toBeNull();
  });
  it('tests the curated Codex model through the authenticated client', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential()) });
    const createMessage = vi.fn().mockResolvedValue('ok');
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({ createMessage, createMessageStream: vi.fn() });
    const plugin = pluginWith(manager);
    const result = await plugin.testLLMConnection();
    expect(result.success).toBe(true);
    expect(createMessage).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-5.5' }));
  });
  it('stops after one fallback when Codex reports repeated missing models', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential()) });
    const missing = Object.assign(new Error('The requested model does not exist'), { statusCode: 404 });
    const createMessage = vi.fn().mockRejectedValue(missing);
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({ createMessage, createMessageStream: vi.fn() });
    const plugin = pluginWith(manager);
    plugin.settings.model = 'missing-a';
    plugin.settings.openAICodexModels = [
      { slug: 'missing-a', displayName: 'Missing A', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] },
      { slug: 'missing-b', displayName: 'Missing B', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] },
      { slug: 'missing-c', displayName: 'Missing C', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] },
    ];
    plugin.settings.availableModels = ['missing-a', 'missing-b', 'missing-c'];
    const result = await plugin.testLLMConnection();
    expect(result.success).toBe(false);
    expect(createMessage).toHaveBeenCalledTimes(2);
  });
  it('removes an account model that the Codex response endpoint reports as missing', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential()) });
    const missing = Object.assign(new Error('The requested model does not exist'), { statusCode: 404 });
    const createMessage = vi.fn().mockRejectedValueOnce(missing).mockResolvedValueOnce('ok');
    vi.mocked(createLLMClientFromSettingsSync).mockReturnValue({ createMessage, createMessageStream: vi.fn() });
    const plugin = pluginWith(manager);
    plugin.settings.model = 'unavailable-model';
    plugin.settings.openAICodexModels = [{ slug: 'unavailable-model', displayName: 'Unavailable', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] }, { slug: 'working-model', displayName: 'Working', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] }];
    plugin.settings.availableModels = ['unavailable-model', 'working-model'];
    const result = await plugin.testLLMConnection();
    expect(result.success).toBe(true);
    expect(plugin.settings.openAICodexModels?.map((entry) => entry.slug)).toEqual(['working-model']);
    expect(plugin.settings.model).toBe('working-model');
    expect(createMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'unavailable-model' }));
    expect(createMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'working-model' }));
  });
  it('returns a sign-in-required preflight without a Codex credential', async () => {
    const plugin = pluginWith(new CodexAuthManager({ store: memoryCredentialStore() }));
    const result = await plugin.testLLMConnection();
    expect(result).toEqual({ success: false, message: 'Sign in to ChatGPT Plan before testing the connection.' });
  });
  it('localizes the sign-in-required preflight', async () => {
    const plugin = pluginWith(new CodexAuthManager({ store: memoryCredentialStore() }));
    plugin.settings.language = 'zh';
    const result = await plugin.testLLMConnection();
    expect(result).toEqual({ success: false, message: '测试连接前，请先登录 ChatGPT 套餐。' });
  });
  it('initializes the shared client after browser login', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(), browserLogin: async () => freshCredential() });
    const plugin = pluginWith(manager);
    await plugin.loginOpenAICodexBrowser();
    expect(plugin.llmClient).not.toBeNull();
    expect(plugin.settings.availableModels).toEqual(['remote-model']);
    expect(fetchCodexModelCatalog).toHaveBeenCalledOnce();
  });
  it('rejects browser login on mobile before invoking the auth manager', async () => {
    Platform.isDesktopApp = false;
    const manager = new CodexAuthManager({ store: memoryCredentialStore(), browserLogin: async () => freshCredential() });
    const login = vi.spyOn(manager, 'loginWithBrowser');
    const plugin = pluginWith(manager);
    await expect(plugin.loginOpenAICodexBrowser()).rejects.toThrow('desktop');
    expect(login).not.toHaveBeenCalled();
  });
  it('keeps the previous account catalog cleared in memory when persistence fails', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(), browserLogin: async () => freshCredential() });
    const login = vi.spyOn(manager, 'loginWithBrowser');
    const plugin = pluginWith(manager);
    plugin.settings.openAICodexModels = [{ slug: 'old-account-model', displayName: 'Old', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] }];
    vi.spyOn(plugin, 'saveData').mockRejectedValue(new Error('persistence failed'));
    await expect(plugin.loginOpenAICodexBrowser()).rejects.toThrow('persistence failed');
    expect(login).toHaveBeenCalledOnce();
    expect(manager.hasCredential()).toBe(true);
    expect(plugin.settings.openAICodexModels).toEqual([]);
    expect(plugin.settings.availableModels).toEqual([...CODEX_MODELS]);
  });
  it('preserves the current account catalog when browser login fails', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential('current')), browserLogin: async () => { throw new Error('login failed'); } });
    const plugin = pluginWith(manager);
    plugin.settings.openAICodexModels = [{ slug: 'current-model', displayName: 'Current', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] }];
    plugin.settings.availableModels = ['current-model'];
    await expect(plugin.loginOpenAICodexBrowser()).rejects.toThrow('login failed');
    expect(plugin.settings.openAICodexModels?.[0]?.slug).toBe('current-model');
    expect(plugin.settings.availableModels).toEqual(['current-model']);
  });
  it('initializes the shared client after device login completes', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(), requestDeviceAuthorization: async () => ({ deviceAuthId: 'device', userCode: 'CODE', intervalMs: 1000 }), completeDeviceLogin: async () => freshCredential() });
    const plugin = pluginWith(manager);
    const prompt = await plugin.beginOpenAICodexDeviceLogin();
    await prompt.complete;
    expect(plugin.llmClient).not.toBeNull();
    expect(plugin.settings.availableModels).toEqual(['remote-model']);
  });
  it('preserves a valid cached catalog when refresh fails', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential()) });
    const plugin = pluginWith(manager);
    plugin.settings.openAICodexModels = [{ slug: 'cached-model', displayName: 'Cached', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] }];
    plugin.settings.openAICodexModelsFetchedAt = 100;
    plugin.settings.availableModels = ['cached-model'];
    vi.mocked(fetchCodexModelCatalog).mockRejectedValue(new Error('offline'));
    await expect(plugin.refreshOpenAICodexModels(true)).rejects.toThrow('offline');
    expect(plugin.settings.availableModels).toEqual(['cached-model']);
    expect(plugin.settings.openAICodexModelsFetchedAt).toBe(100);
  });
  it('does not commit a fetched catalog when persistence fails', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential()) });
    const plugin = pluginWith(manager);
    plugin.settings.openAICodexModels = [{ slug: 'cached-model', displayName: 'Cached', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] }];
    plugin.settings.openAICodexModelsFetchedAt = 100;
    plugin.settings.availableModels = ['cached-model'];
    vi.spyOn(plugin, 'saveData').mockRejectedValue(new Error('persistence failed'));
    await expect(plugin.refreshOpenAICodexModels(true)).rejects.toThrow('persistence failed');
    expect(plugin.settings.availableModels).toEqual(['cached-model']);
    expect(plugin.settings.openAICodexModels?.[0]?.slug).toBe('cached-model');
    expect(plugin.settings.openAICodexModelsFetchedAt).toBe(100);
  });
  it('keeps the active API provider model while refreshing the Codex catalog', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(freshCredential()) });
    const plugin = pluginWith(manager, 'openai');
    plugin.settings.model = 'gpt-4.1';
    plugin.settings.availableModels = ['gpt-4.1'];
    await plugin.refreshOpenAICodexModels(true);
    expect(plugin.settings.model).toBe('gpt-4.1');
    expect(plugin.settings.availableModels).toEqual(['gpt-4.1']);
    expect(plugin.settings.openAICodexModels?.map((entry) => entry.slug)).toEqual(['remote-model']);
  });
  it('clears the previous account catalog and warns when post-login refresh fails', async () => {
    const manager = new CodexAuthManager({ store: memoryCredentialStore(), browserLogin: async () => freshCredential('new-account') });
    const plugin = pluginWith(manager);
    plugin.settings.openAICodexModels = [{ slug: 'old-account-model', displayName: 'Old', supportedReasoningLevels: [], additionalSpeedTiers: [], serviceTiers: [] }];
    plugin.settings.openAICodexModelsFetchedAt = 100;
    plugin.settings.availableModels = ['old-account-model'];
    vi.mocked(fetchCodexModelCatalog).mockRejectedValue(new Error('offline'));
    await expect(plugin.loginOpenAICodexBrowser()).resolves.toBeUndefined();
    expect(plugin.settings.openAICodexModels).toEqual([]);
    expect(plugin.settings.availableModels).toEqual([...CODEX_MODELS]);
    const notices = (Notice as unknown as { instances: Array<{ message: string }> }).instances;
    expect(notices.at(-1)?.message).toContain('offline');
  });
  it('signs out and resets readiness', async () => {
    const store = memoryCredentialStore(freshCredential());
    const manager = new CodexAuthManager({ store });
    const plugin = pluginWith(manager);
    plugin.settings.llmReady = true;
    plugin.llmClient = createLLMClient(plugin.settings, manager);
    await plugin.signOutOpenAICodex();
    expect(store.hasCredential()).toBe(false);
    expect(plugin.settings.llmReady).toBe(false);
    expect(plugin.llmClient).toBeNull();
    expect(plugin.settings.openAICodexModels).toEqual([]);
    expect(plugin.settings.openAICodexModelsFetchedAt).toBe(0);
  });
  it('keeps credentials and plugin readiness cleared when sign-out persistence fails', async () => {
    const store = memoryCredentialStore(freshCredential());
    const manager = new CodexAuthManager({ store });
    const plugin = pluginWith(manager);
    plugin.settings.llmReady = true;
    plugin.llmClient = createLLMClient(plugin.settings, manager);
    vi.spyOn(plugin, 'saveData').mockRejectedValue(new Error('persistence failed'));
    await expect(plugin.signOutOpenAICodex()).rejects.toThrow('persistence failed');
    expect(store.hasCredential()).toBe(false);
    expect(plugin.settings.llmReady).toBe(false);
    expect(plugin.llmClient).toBeNull();
  });
  it.each(['openai', 'ollama'])('signs out Codex without clearing active %s readiness', async (provider) => {
    const store = memoryCredentialStore(freshCredential());
    const manager = new CodexAuthManager({ store });
    const plugin = pluginWith(manager, provider);
    const activeClient = { createMessage: vi.fn(), createMessageStream: vi.fn() };
    plugin.settings.llmReady = true;
    plugin.settings.model = 'active-model';
    plugin.settings.availableModels = ['active-model'];
    plugin.llmClient = activeClient;
    await plugin.signOutOpenAICodex();
    expect(store.hasCredential()).toBe(false);
    expect(plugin.settings.llmReady).toBe(true);
    expect(plugin.llmClient).toBe(activeClient);
    expect(plugin.settings.model).toBe('active-model');
    expect(plugin.settings.availableModels).toEqual(['active-model']);
  });
  it('cancels an active device flow on unload', async () => {
    let aborted = false;
    let started = false;
    const requestDeviceAuthorization = (signal: AbortSignal): Promise<never> => new Promise((_resolve, reject) => { started = true; signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }); });
    const manager = new CodexAuthManager({ store: memoryCredentialStore(), requestDeviceAuthorization });
    const plugin = pluginWith(manager);
    const pending = plugin.beginOpenAICodexDeviceLogin();
    await vi.waitFor(() => expect(started).toBe(true));
    plugin.onunload();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(aborted).toBe(true);
  });
  it('cancels device completion polling on unload', async () => {
    let aborted = false;
    const completeDeviceLogin = (_authorization: { deviceAuthId: string; userCode: string; intervalMs: number }, signal: AbortSignal): Promise<never> => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); }, { once: true }));
    const manager = new CodexAuthManager({ store: memoryCredentialStore(), requestDeviceAuthorization: async () => ({ deviceAuthId: 'device', userCode: 'CODE', intervalMs: 1000 }), completeDeviceLogin });
    const plugin = pluginWith(manager);
    const prompt = await plugin.beginOpenAICodexDeviceLogin();
    plugin.onunload();
    await expect(prompt.complete).rejects.toMatchObject({ name: 'AbortError' });
    expect(aborted).toBe(true);
  });
});
