/**
 * v1.25.1 Phase C-PR2: Provider section renderer.
 *
 * Extracted from `LLMWikiSettingTab.display()`. Renders the LLM
 * Provider configuration block:
 *
 *   - Provider dropdown
 *   - API key input (hidden for ollama/lmstudio; lmstudio shows hint)
 *   - Base URL input (always shown for custom/anthropic-compatible;
 *     otherwise only when override differs from default)
 *   - Bedrock region dropdown (only when provider is bedrock-*)
 *   - Page Generation Concurrency slider
 *   - Batch Delay slider
 *
 * Why extracted:
 *   - 130 LOC of provider-config side effects. Splitting into its own
 *     module makes the provider-specific rendering path inspectable
 *     without scrolling through unrelated Model / Advanced / Wiki code.
 *
 * Invariants preserved:
 *   - Switching provider resets llmReady + availableModels + model +
 *     useCustomModel (clears stale-client state).
 *   - Switching to a native-PDF provider (anthropic / openai /
 *     bedrock-*) auto-resets forcePdfSupport to false (v1.25.0 PR3
 *     universal escape hatch UX invariant).
 *   - baseUrl is set to PREDEFINED_PROVIDERS.baseUrl when switching to
 *     a known provider; user can override afterwards.
 *   - API key input is hidden for ollama / lmstudio (no key needed).
 *   - Concurrency description swaps between singular/plural based on
 *     the live value (UX nicety preserved).
 */

import { Platform, Setting } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';
import type { LLMWikiSettings } from '../../types';
import { PREDEFINED_PROVIDERS } from '../../types';
import { BEDROCK_REGIONS, BEDROCK_DEFAULT_REGION, NATIVE_PDF_PROVIDER_IDS, MAX_BATCH_DELAY_MS } from '../../constants';
import { renderRangeSlider } from '../settings-helpers';
import { getCodexAuthUiState } from '../openai-codex-auth-controls';
import { getBedrockAuthUiState } from '../bedrock-auth-controls';
import { resolveInitialApiKey } from '../../llm-sdk/provider-api-key-resolver';
import { parseCustomHeaders } from '../../llm-sdk/compat-headers';

export function renderProviderSection(tab: LLMWikiSettingTab, containerEl: HTMLElement): void {
  const { tempSettings } = tab;
  const providerConfig = PREDEFINED_PROVIDERS[tempSettings.provider];
  const isOllama = tempSettings.provider === 'ollama';
  const isLmStudio = tempSettings.provider === 'lmstudio';
  const isCodex = tempSettings.provider === 'openai-codex';
  const isBedrock = tempSettings.provider === 'bedrock-anthropic'
    || tempSettings.provider === 'bedrock-openai';
  // #425: in sso/iam modes the bearer API-key field is inert (AWS
  // credentials sign instead) — hiding it prevents "which one do I
  // fill?" confusion.
  const bedrockAwsCredMode = isBedrock && (tempSettings.bedrockAuthMethod ?? 'api-key') !== 'api-key';

  // LLM Provider (highest priority - must configure first).
  // v1.25.1 Phase C-PR2 fix: this heading was previously emitted from
  // LLMWikiSettingTab.display() and lost when the section was extracted.
  // Restoring it preserves the pre-PR2 Settings tab layout users have
  // muscle memory for.
  new Setting(containerEl).setName(tab.getText('providerSection')).setHeading();

  // Provider dropdown
  new Setting(containerEl)
    .setName(tab.getText('providerName'))
    .setDesc(tab.getText('providerDesc'))
    .addDropdown(dropdown => {
      Object.values(PREDEFINED_PROVIDERS).forEach(config => {
        const lang = tempSettings.language;
        const displayName = lang === 'zh' ? config.nameZh : config.nameEn;
        dropdown.addOption(config.id, displayName);
      });
      dropdown.setValue(tempSettings.provider);
      dropdown.onChange((value) => {
        tempSettings.provider = value;
        tempSettings.llmReady = false;
        tempSettings.availableModels = [];
        tempSettings.useCustomModel = false;
        tempSettings.model = '';
        const config = PREDEFINED_PROVIDERS[value];
        if (config && value !== 'custom') tempSettings.baseUrl = config.baseUrl;
        // v1.25.0 PR3: if the user just switched to a native-PDF provider
        // (anthropic / openai / bedrock-*), reset forcePdfSupport so they
        // don't carry a stale escape-hatch value that no longer applies.
        if ((NATIVE_PDF_PROVIDER_IDS as readonly string[]).includes(value)) {
          tempSettings.forcePdfSupport = false;
        }
        tab.display();
      });
    });

  // API Key (or hint for ollama/lmstudio)
  if (isCodex) {
    const isSignedIn = tab.plugin.codexAuthManager?.hasCredential() === true;
    const authState = getCodexAuthUiState({ isDesktop: !Platform.isMobile, isSignedIn, isBusy: tab.codexAuthBusy });
    const status = tab.codexAuthBusy ? tab.getText('codexAuthBusy') : authState.showSignOut ? tab.getText('codexAuthSignedIn') : tab.getText('codexAuthSignedOut');
    const authSetting = new Setting(containerEl).setName(tab.getText('codexAuthName')).setDesc(`${tab.getText('codexAuthDesc')} ${tab.getText('codexAuthExperimental')} ${status}`);
    if (authState.showBrowser) authSetting.addButton(button => button.setButtonText(tab.getText('codexAuthBrowserButton')).onClick(() => { void tab.loginOpenAICodexBrowser(); }));
    if (authState.showDevice) authSetting.addButton(button => button.setButtonText(tab.getText('codexAuthDeviceButton')).onClick(() => { void tab.loginOpenAICodexDevice(); }));
    if (authState.showSignOut) authSetting.addButton(button => button.setButtonText(tab.getText('codexAuthSignOutButton')).setWarning().onClick(() => { void tab.signOutOpenAICodex(); }));
    if (isSignedIn) new Setting(containerEl).setName(tab.getText('codexModelsRefreshName')).setDesc(tab.getText('codexModelsRefreshDesc')).addButton(button => button.setButtonText(tab.codexAuthBusy ? tab.getText('codexModelsRefreshing') : tab.getText('codexModelsRefreshButton')).setDisabled(tab.codexAuthBusy).onClick(() => { void tab.refreshOpenAICodexModels(true, true); }));
    if (tab.codexDevicePrompt) {
      const prompt = tab.codexDevicePrompt;
      new Setting(containerEl).setName(tab.getText('codexAuthDeviceInstructions').replace('{}', prompt.userCode)).setDesc(prompt.verificationUrl).addButton(button => button.setButtonText(tab.getText('codexAuthCopyCode')).onClick(() => { void tab.copyOpenAICodexDeviceCode(); })).addButton(button => button.setButtonText(tab.getText('cancelButton')).setWarning().onClick(() => { prompt.cancel(); }));
    }
    if (isSignedIn) tab.queueStaleCodexModelRefresh();
  } else if (!isOllama && !isLmStudio && !bedrockAwsCredMode) {
    // v1.25.3 #182: read the key through the tested ProviderSecretStore
    // helper (matches Codex's codexAuthManager UX). The text component
    // is an in-memory buffer; the actual SecretStorage write happens
    // once on settings-tab close (in LLMWikiSettingTab.hide → flushApiKey),
    // so a user typing 30 characters does NOT trigger 30 OS keychain
    // writes — only the final value is persisted. This preserves the
    // pre-PR2 in-memory-edit-then-flush-on-save UX.
    //
    // v1.25.7 PATCH: respect the in-memory buffer (tempSettings.apiKey)
    // as the FIRST source of truth. Without this precedence swap, the
    // pending edit typed after a provider switch gets silently overwritten
    // by the OLD SecretStorage value on every tab.display() re-render
    // (e.g. when switching providers via the dropdown above, or after
    // Fetch Models / Test Connection triggers display()). The previous
    // behavior used `?? tempSettings.apiKey` as a fallback, but `??`
    // only triggers when load() returns null — SecretStorage always has
    // the last-flushed key, so the fallback never ran and the user's
    // pending edit was clobbered.
    new Setting(containerEl)
      .setName(tab.getText('apiKeyName'))
      .setDesc(tab.getText('apiKeyDesc'))
      .addText(text => {
        // v1.25.7 PATCH: delegate to resolveInitialApiKey so the input
        // honors the in-memory tempSettings.apiKey buffer across re-renders
        // instead of clobbering the user's pending edit with the stale
        // SecretStorage value left over from the previously-active provider.
        const initial = resolveInitialApiKey(tempSettings, tab.plugin.app.secretStorage);
        text.setPlaceholder(tab.getText('apiKeyPlaceholder'))
          .setValue(initial)
          .onChange((value) => {
            // In-memory only — the actual setSecret happens on tab close.
            // tempSettings.apiKey carries the pending value until the
            // tab's hide() runs flushApiKey() against ProviderSecretStore.
            tempSettings.apiKey = value;
            tempSettings.llmReady = false;
          });
        text.inputEl.type = 'password';
      });
  } else if (isLmStudio) {
    containerEl.createEl('p', {
      text: tab.getText('lmstudioHint'),
      cls: 'llm-wiki-ollama-hint'
    });
  } else {
    containerEl.createEl('p', {
      text: tab.getText('ollamaHint'),
      cls: 'llm-wiki-ollama-hint'
    });
  }

  // Base URL
  const isCustomUrlProvider = tempSettings.provider === 'custom'
    || tempSettings.provider === 'custom-responses'
    || tempSettings.provider === 'anthropic-compatible';
  if (isCustomUrlProvider || (providerConfig && tempSettings.baseUrl !== providerConfig.baseUrl)) {
    new Setting(containerEl)
      .setName(tab.getText('baseUrlName'))
      .setDesc(isCustomUrlProvider
        ? tab.getText('baseUrlDescCustom') : tab.getText('baseUrlDescOverride'))
      .addText(text => text
        .setPlaceholder(providerConfig?.baseUrl || 'https://api.example.com/v1')
        .setValue(tempSettings.baseUrl)
        .onChange((value) => { tempSettings.baseUrl = value; tempSettings.llmReady = false; }));

    // Issue #723: custom request headers, placed directly below the base URL
    // rather than in the bottom Advanced panel — the two are configured
    // together, and a gateway that needs extra headers is usually the reason the
    // user is editing this section at all.
    //
    // Skipped for the Anthropic-compatible provider, which routes to
    // `AnthropicSdkClient` and would ignore the field entirely: a setting that
    // silently does nothing is worse than one that is absent.
    if (tempSettings.provider !== 'anthropic-compatible') {
      // Issue #723: a malformed line is dropped by `parseCustomHeaders` rather
      // than becoming a header named after whatever preceded the colon. That is
      // the right behaviour but an invisible one, so the count is surfaced here
      // — on open as well as on edit, so a saved-but-malformed value is visible
      // before the user touches the field again.
      const describeHeaders = (raw: string): string => {
        const base = tab.getText('customHeadersDesc');
        const { invalid } = parseCustomHeaders(raw);
        return invalid > 0
          ? `${base} ${tab.getText('customHeadersInvalid').replace('{}', String(invalid))}`
          : base;
      };
      const headersSetting = new Setting(containerEl)
        .setName(tab.getText('customHeadersName'))
        .setDesc(describeHeaders(tempSettings.customHeaders ?? ''))
        .addTextArea(text => text
          .setPlaceholder('X-My-Header: value')
          .setValue(tempSettings.customHeaders ?? '')
          .onChange((value) => {
            tempSettings.customHeaders = value;
            tempSettings.llmReady = false;
            headersSetting.setDesc(describeHeaders(value));
          }));
    }
  }

  // v1.24.1 PATCH Bedrock Stage 1 - region selector (only when provider
  // is one of the two bedrock-* ids). Region drives the baseURL the
  // factory resolves; the user does NOT edit baseURL for Bedrock.
  if (isBedrock) {
    const currentRegion = tempSettings.bedrockRegion || BEDROCK_DEFAULT_REGION;
    new Setting(containerEl)
      .setName(tab.getText('bedrockRegionName'))
      .setDesc(`${tab.getText('bedrockRegionDesc')} ${tab.getText('bedrockRegionHint')}`)
      .addDropdown(dropdown => {
        BEDROCK_REGIONS.forEach(region => {
          dropdown.addOption(region, region);
        });
        dropdown.setValue(currentRegion);
        dropdown.onChange((value) => {
          tempSettings.bedrockRegion = value;
          tempSettings.llmReady = false;
          tempSettings.availableModels = [];
          tempSettings.useCustomModel = false;
          tempSettings.model = '';
        });
      });

    // #425 Bedrock Stage 2 — auth method + credential surfaces. Secrets
    // never live in settings: SSO runs a device login, IAM keys buffer
    // in-memory and flush to SecretStorage on tab close.
    const currentAuthMethod = tempSettings.bedrockAuthMethod ?? 'api-key';
    new Setting(containerEl)
      .setName(tab.getText('bedrockAuthMethodName'))
      .setDesc(tab.getText('bedrockAuthMethodDesc'))
      .addDropdown(dropdown => {
        dropdown.addOption('api-key', tab.getText('bedrockAuthOptionApiKey'));
        dropdown.addOption('sso', tab.getText('bedrockAuthOptionSso'));
        dropdown.addOption('iam', tab.getText('bedrockAuthOptionIam'));
        dropdown.setValue(currentAuthMethod);
        dropdown.onChange((value) => {
          const previous = tempSettings.bedrockAuthMethod ?? 'api-key';
          tempSettings.bedrockAuthMethod = value as LLMWikiSettings['bedrockAuthMethod'];
          // Leaving iam mode abandons any half-typed key buffers — wipe
          // them so a later tab close cannot persist abandoned secrets.
          if (previous === 'iam' && value !== 'iam') {
            tab.bedrockIamKeyBuffer = '';
            tab.bedrockIamSecretBuffer = '';
            tab.bedrockIamSessionTokenBuffer = '';
          }
          tempSettings.llmReady = false;
          tab.display();
        });
      });

    const bedrockAuthMethod = currentAuthMethod;
    if (bedrockAuthMethod === 'sso') {
      new Setting(containerEl)
        .setName(tab.getText('bedrockSsoStartUrlName'))
        .setDesc(tab.getText('bedrockSsoStartUrlDesc'))
        .addText(text => text
          .setValue(tempSettings.bedrockSsoStartUrl ?? '')
          .onChange((value) => { tempSettings.bedrockSsoStartUrl = value; }));
      new Setting(containerEl)
        .setName(tab.getText('bedrockSsoAccountIdName'))
        .setDesc(tab.getText('bedrockSsoAccountIdDesc'))
        .addText(text => text
          .setValue(tempSettings.bedrockSsoAccountId ?? '')
          .onChange((value) => { tempSettings.bedrockSsoAccountId = value; tempSettings.llmReady = false; }));
      new Setting(containerEl)
        .setName(tab.getText('bedrockSsoRoleNameName'))
        .setDesc(tab.getText('bedrockSsoRoleNameDesc'))
        .addText(text => text
          .setValue(tempSettings.bedrockSsoRoleName ?? '')
          .onChange((value) => { tempSettings.bedrockSsoRoleName = value; tempSettings.llmReady = false; }));

      const ssoSignedIn = tab.plugin.bedrockAuthManager?.hasSsoToken() === true;
      const ssoState = getBedrockAuthUiState({ isBusy: tab.bedrockAuthBusy, isSignedIn: ssoSignedIn });
      const expiryMs = tab.plugin.bedrockAuthManager?.ssoTokenExpiry() ?? null;
      const status = tab.bedrockAuthBusy
        ? tab.getText('bedrockSsoBusy')
        : ssoSignedIn && expiryMs !== null
          ? tab.getText('bedrockSsoStatusSignedIn').replace('{}', new Date(expiryMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
          : tab.getText('bedrockSsoStatusSignedOut');
      const authSetting = new Setting(containerEl)
        .setName(tab.getText('bedrockAuthOptionSso'))
        .setDesc(status);
      if (ssoState.showLogin) authSetting.addButton(button => button.setButtonText(tab.getText('bedrockSsoLoginButton')).onClick(() => { void tab.loginBedrockSso(); }));
      if (ssoState.showSignOut) authSetting.addButton(button => button.setButtonText(tab.getText('bedrockSsoSignOutButton')).setWarning().onClick(() => { void tab.signOutBedrock(); }));
      if (tab.bedrockDevicePrompt) {
        const prompt = tab.bedrockDevicePrompt;
        new Setting(containerEl)
          .setName(tab.getText('bedrockSsoUserCodeInstructions').replace('{}', prompt.userCode))
          .setDesc(prompt.verificationUriComplete ?? prompt.verificationUri)
          .addButton(button => button.setButtonText(tab.getText('bedrockSsoCopyCode')).onClick(() => { void tab.copyBedrockUserCode(); }))
          .addButton(button => button.setButtonText(tab.getText('cancelButton')).setWarning().onClick(() => { prompt.cancel(); }));
      }
    } else if (bedrockAuthMethod === 'iam') {
      new Setting(containerEl)
        .setName(tab.getText('bedrockIamKeyName'))
        .setDesc(tab.getText('bedrockIamKeyDesc'))
        .addText(text => text
          .setValue(tab.bedrockIamKeyBuffer)
          .onChange((value) => { tab.bedrockIamKeyBuffer = value; tempSettings.llmReady = false; }));
      new Setting(containerEl)
        .setName(tab.getText('bedrockIamSecretName'))
        .setDesc(tab.getText('bedrockIamSecretDesc'))
        .addText(text => {
          text.inputEl.type = 'password';
          text.setValue(tab.bedrockIamSecretBuffer).onChange((value) => { tab.bedrockIamSecretBuffer = value; tempSettings.llmReady = false; });
        });
      new Setting(containerEl)
        .setName(tab.getText('bedrockIamSessionTokenName'))
        .setDesc(tab.getText('bedrockIamSessionTokenDesc'))
        .addText(text => text
          .setValue(tab.bedrockIamSessionTokenBuffer)
          .onChange((value) => { tab.bedrockIamSessionTokenBuffer = value; tempSettings.llmReady = false; }));
      // Destructive-credential control for iam mode: without this there
      // is no UI path to remove saved keys (sign-out lives in sso mode).
      if (tab.plugin.bedrockAuthManager?.hasIamKeys() === true) {
        new Setting(containerEl)
          .setName(tab.getText('bedrockIamClearButton'))
          .addButton(button => button.setButtonText(tab.getText('bedrockIamClearButton')).setWarning().onClick(() => {
            tab.plugin.bedrockAuthManager?.clearIamKeys();
            tempSettings.llmReady = false;
            tab.display();
          }));
      }
    }
  }

  // Page Generation Concurrency + Batch Delay — both rendered via the
  // shared renderRangeSlider helper (v1.25.1 Phase C-PR2 simplify pass).
  renderRangeSlider(containerEl, {
    name: tab.getText('pageGenerationConcurrencyName'),
    desc: tab.getText('pageGenerationConcurrencyDesc'),
    initialValue: tempSettings.pageGenerationConcurrency ?? 3,
    min: 1,
    max: 5,
    step: 1,
    formatDesc: (v) => tab.getText(v === 1 ? 'concurrencyValueSingular' : 'concurrencyValuePlural').replace('{}', String(v)),
    onChange: (v) => { tempSettings.pageGenerationConcurrency = v; },
  });

  renderRangeSlider(containerEl, {
    name: tab.getText('batchDelayName'),
    desc: tab.getText('batchDelayDesc'),
    initialValue: tempSettings.batchDelayMs ?? 300,
    min: 100,
    max: MAX_BATCH_DELAY_MS,
    step: 50,
    formatDesc: (v) => tab.getText('batchDelayDesc').replace('{}', String(v)),
    onChange: (v) => { tempSettings.batchDelayMs = v; },
  });
}
