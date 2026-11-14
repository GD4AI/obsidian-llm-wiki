import { Notice, Platform } from 'obsidian';
import type { LLMClient, LLMWikiSettings } from '../types';
import type { CodexAuthManager, DeviceLoginPrompt } from '../llm-sdk/openai-codex/auth-manager';
import type { CodexCredentialStore } from '../llm-sdk/openai-codex/credential-store';
import type { FetchLike } from '../llm-sdk/openai-codex/types';
import { obsidianFetchBridge } from '../core/obsidian-fetch-bridge';
import { applyCodexModelPolicy } from '../llm-sdk/openai-codex/model-policy';
import { fetchCodexModelCatalog } from '../llm-sdk/openai-codex/model-catalog';
import { getText } from '../core/i18n';
import { openCodexExternalUrl } from '../ui/openai-codex-auth-controls';
import { NOTICE_ERROR } from '../constants';
import { persistedSettings } from '../types/settings';

const CODEX_MODEL_CACHE_TTL_MS = 5 * 60 * 1000;

export interface CodexAuthCommandsHost {
  settings: LLMWikiSettings;
  llmClient: LLMClient | null;
  codexAuthManager: CodexAuthManager | null;
  codexCredentialStore: CodexCredentialStore | null;
  manifest: { version: string };
  saveData(data: unknown): Promise<void>;
  initializeLLMClient(): void;
  refreshOpenAICodexModels(force?: boolean): Promise<string[]>;
  clearOpenAICodexModelCache(): Promise<void>;
  resetOpenAICodexModelState(): void;
  showOpenAICodexModelRefreshFailure(error: unknown): void;
}

export interface CodexAuthCommandsMethods {
  openExternal(url: string): void;
  loginOpenAICodexBrowser(): Promise<void>;
  beginOpenAICodexDeviceLogin(): Promise<DeviceLoginPrompt>;
  refreshOpenAICodexModels(force?: boolean): Promise<string[]>;
  clearUnboundOpenAICodexModelCache(): Promise<void>;
  signOutOpenAICodex(): Promise<void>;
}

export const codexAuthCommands = {
  openExternal(this: CodexAuthCommandsHost, url: string): void {
    const target = typeof activeWindow !== 'undefined' ? activeWindow : window;
    openCodexExternalUrl(target, url);
  },
  async loginOpenAICodexBrowser(this: CodexAuthCommandsHost): Promise<void> {
    if (!Platform.isDesktopApp) throw new Error('Codex browser login is available only on desktop');
    if (!this.codexAuthManager) throw new Error('Codex auth manager is not initialized');
    const previousAccountId = this.codexAuthManager.currentAccountId();
    const credential = await this.codexAuthManager.loginWithBrowser();
    if (previousAccountId !== credential.accountId) await this.clearOpenAICodexModelCache();
    try {
      await this.refreshOpenAICodexModels(true);
    } catch (error) {
      this.showOpenAICodexModelRefreshFailure(error);
    }
    this.initializeLLMClient();
  },
  async beginOpenAICodexDeviceLogin(this: CodexAuthCommandsHost): Promise<DeviceLoginPrompt> {
    if (!this.codexAuthManager) throw new Error('Codex auth manager is not initialized');
    const previousAccountId = this.codexAuthManager.currentAccountId();
    const prompt = await this.codexAuthManager.loginWithDeviceCode();
    return { ...prompt, complete: prompt.complete.then(async (credential) => {
      if (previousAccountId !== credential.accountId) await this.clearOpenAICodexModelCache();
      try {
        await this.refreshOpenAICodexModels(true);
      } catch (error) {
        this.showOpenAICodexModelRefreshFailure(error);
      }
      this.initializeLLMClient();
      return credential;
    }) };
  },
  async refreshOpenAICodexModels(this: CodexAuthCommandsHost, force = false): Promise<string[]> {
    if (!this.codexAuthManager?.hasCredential()) throw new Error('ChatGPT sign-in required');
    const accountId = this.codexAuthManager.currentAccountId();
    if ((this.settings.openAICodexModels?.length ?? 0) > 0 && accountId && this.codexCredentialStore && !this.codexCredentialStore.isModelCatalogBound(accountId)) await this.clearOpenAICodexModelCache();
    const cached = this.settings.openAICodexModels ?? [];
    const fetchedAt = this.settings.openAICodexModelsFetchedAt ?? 0;
    if (!force && cached.length > 0 && Date.now() - fetchedAt < CODEX_MODEL_CACHE_TTL_MS) return cached.map((entry) => entry.slug);
    const models = await fetchCodexModelCatalog({ auth: this.codexAuthManager, fetchFn: obsidianFetchBridge as unknown as FetchLike, version: this.manifest.version });
    const candidate = { ...this.settings, openAICodexModels: models, openAICodexModelsFetchedAt: Date.now(), openAICodexUnavailableModels: [] };
    if (candidate.provider === 'openai-codex') applyCodexModelPolicy(candidate);
    this.codexCredentialStore?.bindModelCatalog((await this.codexAuthManager.getAccess()).accountId);
    await this.saveData(persistedSettings(candidate));
    this.settings = candidate;
    this.initializeLLMClient();
    return models.map((entry) => entry.slug);
  },
  resetOpenAICodexModelState(this: CodexAuthCommandsHost): void {
    this.settings.openAICodexModels = [];
    this.settings.openAICodexModelsFetchedAt = 0;
    this.settings.openAICodexUnavailableModels = [];
    if (this.settings.provider === 'openai-codex') applyCodexModelPolicy(this.settings);
  },
  async clearOpenAICodexModelCache(this: CodexAuthCommandsHost): Promise<void> {
    const candidate = { ...this.settings };
    this.settings = candidate;
    this.resetOpenAICodexModelState();
    await this.saveData(persistedSettings(candidate));
  },
  async clearUnboundOpenAICodexModelCache(this: CodexAuthCommandsHost): Promise<void> {
    const accountId = this.codexAuthManager?.currentAccountId();
    if ((this.settings.openAICodexModels?.length ?? 0) === 0 || accountId && this.codexCredentialStore?.isModelCatalogBound(accountId)) return;
    await this.clearOpenAICodexModelCache();
  },
  showOpenAICodexModelRefreshFailure(this: CodexAuthCommandsHost, error: unknown): void {
    const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
    new Notice(getText(this.settings.language, 'codexModelsRefreshFailed').replace('{}', detail), NOTICE_ERROR);
  },
  async signOutOpenAICodex(this: CodexAuthCommandsHost): Promise<void> {
    if (!this.codexAuthManager) throw new Error('Codex auth manager is not initialized');
    this.codexAuthManager.signOut();
    this.resetOpenAICodexModelState();
    if (this.settings.provider === 'openai-codex') {
      this.settings.llmReady = false;
      this.llmClient = null;
    }
    await this.saveData(persistedSettings(this.settings));
  },
};
