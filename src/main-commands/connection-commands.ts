/**
 * v1.25.1 Phase C-PR3: Connection test commands.
 *
 * Extracted from main.ts. Probes the live LLM endpoint and checks
 * wiki structure readiness.
 *
 * `testLLMConnection` is directly called by tests
 * (test-connection-gate.test.ts) and settings test-connection-section
 * via `plugin.testLLMConnection()` — the mixin pattern preserves
 * this call surface with zero sites changed.
 */

import { Notice } from 'obsidian';
import type { App } from 'obsidian';
import type {
  LLMWikiSettings,
  LLMClient,
} from '../types';
import {
  PREDEFINED_PROVIDERS,
} from '../types';
import type { LLMTask } from '../core/model-resolver';
import { TEXTS } from '../texts';
import { getText } from '../core/i18n';
import { createLLMClient } from '../core/create-plugin-llm-client';
import { providerRequiresApiKey, usesBedrockAwsCredentials } from '../core/provider-auth';
import { resolveProviderApiKey } from '../llm-sdk/provider-api-key-resolver';
import type { CodexAuthManager } from '../llm-sdk/openai-codex/auth-manager';
import { applyCodexModelPolicy } from '../core/openai-codex-model-policy';
import { resolveModelForTask } from '../core/model-resolver';
import { TOKENS_QUERY_MODEL_DETECT, NOTICE_ERROR } from '../constants';
import { getCachedUrl } from '../core/url-fallback';

/**
 * Host interface: fields/methods these commands need from the Plugin
 * instance. Declares the class-side methods they call so mixin
 * `this: ConnectionCommandsHost` compiles correctly.
 */
export interface ConnectionCommandsHost {
  app: App;
  settings: LLMWikiSettings;
  llmClient: LLMClient | null;
  wikiEngine: import('../wiki/wiki-engine').WikiEngine;
  codexAuthManager: CodexAuthManager | null;
  /** #425 Bedrock Stage 2 — plugin-owned credential orchestrator. */
  bedrockAuthManager: import('../llm-sdk/bedrock-sso/credential-manager').BedrockAuthManager | null;
  manifest: { version: string };
  initializeLLMClient(): void;
  saveSettings(): Promise<void>;
  isWikiInitialized(): Promise<boolean>;
}

/** Method signatures merged into LLMWikiPlugin via interface augmentation. */
export interface ConnectionCommandsMethods {
  testLLMConnection(pendingApiKey?: string): Promise<{ success: boolean; message: string }>;
  requireLLMReady(): boolean;
  isWikiInitialized(): Promise<boolean>;
}

export const connectionCommands = {
  async testLLMConnection(
    this: ConnectionCommandsHost,
    pendingApiKey?: string,
  ): Promise<{ success: boolean; message: string }> {
    const t = TEXTS[this.settings.language] || TEXTS.en;

    if (this.settings.provider === 'openai-codex' && this.codexAuthManager?.hasCredential() !== true) {
      return { success: false, message: t.codexAuthRequired };
    }
    // #425 Bedrock Stage 2: in sso/iam modes AWS credentials replace the
    // bearer key (single predicate in core/provider-auth), so the
    // credential-presence gate runs BEFORE the API-key gate and never
    // surfaces a misleading missing-key error.
    const awsCredMode = usesBedrockAwsCredentials(this.settings.provider, this.settings.bedrockAuthMethod);
    if (awsCredMode) {
      const method = this.settings.bedrockAuthMethod!;
      if (method === 'sso' && this.bedrockAuthManager?.hasSsoToken() !== true) {
        return { success: false, message: t.bedrockSsoRequired };
      }
      if (method === 'iam' && this.bedrockAuthManager?.hasIamKeys() !== true) {
        return { success: false, message: t.bedrockIamRequired };
      }
    }
    // v1.25.7 PATCH: accept an optional pendingApiKey so the Test
    // Connection button can forward the in-memory typed key from
    // tab.tempSettings.apiKey, bypassing the stale SecretStorage value.
    // Production callers (initializeLLMClient etc.) pass undefined.
    if (!awsCredMode && providerRequiresApiKey(this.settings.provider) && !resolveProviderApiKey(
      { apiKey: this.settings.apiKey, providerApiKeySecretId: this.settings.providerApiKeySecretId },
      this.app.secretStorage,
      pendingApiKey,
    )) {
      return { success: false, message: t.errorNoApiKey || 'API Key is not configured' };
    }

    const tasksToProbe: LLMTask[] = this.settings.usePerTaskModels === true
      ? ['ingest', 'lint', 'query']
      : [];
    const probePlan: Array<{ label: string; model: string }> = tasksToProbe.length === 0
      ? [{ label: 'unified', model: this.settings.model }]
      : tasksToProbe.map(task => ({ label: task, model: resolveModelForTask(this.settings, task) }));

    console.debug('[testLLMConnection] probe plan:', probePlan.map(p => `${p.label}=${p.model}`).join(', '));

    // A blank model still goes on the wire as `"model": ""`, and the
    // provider answers with its own routing error: OpenRouter returns
    // HTTP 502 `Invalid URL:`, which the AI SDK retries three times and
    // the catch below then reports verbatim — so a model that was never
    // selected reads as a broken Base URL. `model` has no default
    // (DEFAULT_SETTINGS.model is ''), so this is the state of every
    // fresh install: pick the provider, paste the key, press the button.
    if (probePlan.some(probe => (probe.model ?? '').trim() === '')) {
      return { success: false, message: t.errorNoModel };
    }

    try {
      const testClient = createLLMClient(this.settings, this.codexAuthManager ?? undefined, this.manifest.version, this.app.secretStorage, pendingApiKey, this.bedrockAuthManager ?? undefined);

      for (const probe of probePlan) {
        const attempted = new Set<string>();
        let fallbackAttempted = false;
        while (true) {
          try {
            await testClient.createMessage({
              model: probe.model,
              max_tokens: TOKENS_QUERY_MODEL_DETECT,
              messages: [{
                role: 'user',
                content: 'Test connection. Please reply "Connection successful".'
              }]
            });
            break;
          } catch (error) {
            const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
              ? (error as { statusCode?: unknown }).statusCode
              : null;
            if (this.settings.provider !== 'openai-codex' || statusCode !== 404) throw error;
            attempted.add(probe.model);
            this.settings.openAICodexUnavailableModels = [...new Set([...(this.settings.openAICodexUnavailableModels ?? []), probe.model])];
            this.settings.openAICodexModels = (this.settings.openAICodexModels ?? []).filter((entry) => entry.slug !== probe.model);
            applyCodexModelPolicy(this.settings);
            if (fallbackAttempted) throw error;
            fallbackAttempted = true;
            const nextModel = this.settings.availableModels?.find((model) => !attempted.has(model));
            if (!nextModel) throw error;
            if (probe.label === 'unified') this.settings.model = nextModel;
            if (probe.label === 'ingest') this.settings.ingestModel = nextModel;
            if (probe.label === 'lint') this.settings.lintModel = nextModel;
            if (probe.label === 'query') this.settings.queryModel = nextModel;
            probe.model = nextModel;
          }
        }
      }

      this.settings.llmReady = true;
      void this.saveSettings();

      // Auto-initialize wiki structure after first successful connection.
      // Preserved from original main.ts — defensive: ensures the expected
      // folder tree exists before the user attempts their first ingest.
      if (this.wikiEngine) {
        const isInit = await this.isWikiInitialized();
        if (!isInit) {
          try {
            await this.wikiEngine.ensureWikiStructure();
            console.debug('Wiki structure auto-initialized');
          } catch (initError) {
            console.warn('Auto wiki init failed:', initError);
          }
        }
      }

      const providerName = (PREDEFINED_PROVIDERS[this.settings.provider]?.nameEn || this.settings.provider);

      this.initializeLLMClient();

      const probeSummary = probePlan.length === 1
        ? `${providerName} (${probePlan[0].model})`
        : `${providerName} (ingest=${probePlan[0].model}, lint=${probePlan[1].model}, query=${probePlan[2].model})`;

      // URL auto-adapt: when the entered Base URL was not the one that worked,
      // WRITE THE WORKING FORM BACK and say so. A user who typed
      // `.../anthropic` and is told the connection is fine, then sees a query
      // fail, has been told the wrong thing — and if the resolved form is not
      // persisted, every reload pays the 404 and the fallback again. Measured
      // 2026-10-15 on a MiniMax custom-Anthropic endpoint: the session that
      // found `/anthropic/v1` worked, the next reload forgot it.
      //
      // The user can always edit the field back. What must not happen is the
      // plugin knowing a URL works and not saying so in the one place the user
      // will look next.
      const enteredUrl = this.settings.baseUrl ?? '';
      const resolvedUrl = enteredUrl ? getCachedUrl(enteredUrl) : undefined;
      const urlChanged = Boolean(resolvedUrl && resolvedUrl !== enteredUrl);
      if (urlChanged && resolvedUrl) {
        this.settings.baseUrl = resolvedUrl;
        await this.saveSettings();
      }
      const urlNote = urlChanged && resolvedUrl
        ? ` · ${(t.baseUrlUpdated ?? 'Base URL updated to {url}').replace('{url}', resolvedUrl)}`
        : '';

      return {
        success: true,
        message: `✅ ${t.testConnectionSuccessful || 'Connection successful'}: ${probeSummary}${urlNote}`
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      this.settings.llmReady = false;
      await this.saveSettings();
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `❌ ${t.testConnectionFailed || 'Connection failed'}: ${errorMsg || t.errorUnknown || 'Unknown error'}`
      };
    }
  },

  requireLLMReady(this: ConnectionCommandsHost): boolean {
    if (this.settings.llmReady) return true;
    new Notice(getText(this.settings.language, 'llmNotReady'), NOTICE_ERROR);
    return false;
  },

  async isWikiInitialized(this: ConnectionCommandsHost): Promise<boolean> {
    const wikiFolder = this.settings.wikiFolder || 'wiki';
    const requiredFolders = [
      `${wikiFolder}/entities`,
      `${wikiFolder}/concepts`,
      `${wikiFolder}/sources`,
      `${wikiFolder}/schema`
    ];
    for (const folder of requiredFolders) {
      const folderObj = this.app.vault.getAbstractFileByPath(folder);
      if (!folderObj) return false;
    }
    return true;
  },
};
