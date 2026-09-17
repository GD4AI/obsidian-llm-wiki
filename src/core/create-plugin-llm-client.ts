/**
 * v1.25.1 Phase C-PR3: Plugin-level LLM client factory.
 *
 * Extracted from main.ts to break the circular dependency between
 * main.ts and main-commands/connection-commands.ts: the connection
 * test commands need to call createLLMClient without main.ts
 * importing from them in return.
 *
 * Pure function — no class or plugin state. Exists solely to inject
 * user-configured advanced settings (temperature, repetitionPenalty)
 * into the AI-SDK-backed client.
 */

import { wrapWithAdvancedSettings } from '../llm-client-wrapper';
import { createLLMClientFromSettingsSync } from '../llm-sdk/create-llm-client';
import { getText } from './i18n';
import type { CodexAuthManager } from '../llm-sdk/openai-codex/auth-manager';
import type { BedrockAuthManager } from '../llm-sdk/bedrock-sso/credential-manager';
import type { ProviderSecretStorage } from '../llm-sdk/provider-secret-store';
import type { LLMWikiSettings, LLMClient } from '../types';

export function createLLMClient(
  settings: LLMWikiSettings,
  codexAuth?: CodexAuthManager,
  codexVersion?: string,
  // v1.25.3 #182: when provided, the SDK factory prefers the live key
  // from Obsidian SecretStorage over the (now-empty) settings.apiKey.
  // Pass `plugin.app.secretStorage` from production code; tests that
  // don't have one can omit it (resolver falls back to settings.apiKey).
  secretStorage?: ProviderSecretStorage | null,
  // v1.25.7 PATCH: forward the in-memory typed key (tab.tempSettings.apiKey
  // in the Test Connection flow) so the freshly-typed key wins over the
  // stale SecretStorage value. Production callers pass undefined.
  pendingApiKey?: string,
  // #425 Stage 2: plugin-owned Bedrock credential orchestrator, required
  // when a bedrock-* provider runs in sso/iam auth mode.
  bedrockAuth?: BedrockAuthManager,
): LLMClient {
  const client: LLMClient = createLLMClientFromSettingsSync({
    provider: settings.provider,
    apiKey: settings.apiKey,
    providerApiKeySecretId: settings.providerApiKeySecretId,
    secretStorage: secretStorage ?? null,
    baseUrl: settings.baseUrl,
    // #425 prerequisite fix: forward the region so sync-path Bedrock
    // calls honor the user's dropdown instead of silently landing on
    // BEDROCK_DEFAULT_REGION. Stage 2 (SSO/SigV4 scope) depends on it.
    bedrockRegion: settings.bedrockRegion,
    bedrockAuthMethod: settings.bedrockAuthMethod,
    bedrockSsoAccountId: settings.bedrockSsoAccountId?.trim() || undefined,
    bedrockSsoRoleName: settings.bedrockSsoRoleName?.trim() || undefined,
    bedrockAuthManager: bedrockAuth,
    codexAuth,
    codexVersion,
    codexQuotaMessage: getText(settings.language, 'codexAuthQuota'),
    // Issue #723: the user's custom headers reach the compat client through the
    // same path as the rest of the provider settings.
    customHeaders: settings.customHeaders,
  }, pendingApiKey);

  return wrapWithAdvancedSettings(client, {
    maxTokensPerCall: settings.maxTokensPerCall,
    extractionTemperature: settings.extractionTemperature,
    extractionTopP: settings.extractionTopP,
    samplingSeed: settings.samplingSeed,
    chatTemperature: settings.chatTemperature,
    repetitionPenalty: settings.repetitionPenalty,
    taskPolicies: settings.taskPolicies,
  });
}
