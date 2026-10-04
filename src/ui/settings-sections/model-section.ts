/**
 * v1.25.1 Phase C-PR2: Model section renderer.
 *
 * Extracted from `LLMWikiSettingTab.display()`. Renders the Model
 * selection block:
 *
 *   - "Model" H2 heading
 *   - Fetch Models button (with fallback URL resolution)
 *   - Model Scope dropdown (unified vs per-task)
 *   - Unified model picker (rendered via tab.renderModelField)
 *   - Lint + Query model pickers (only in per-task mode)
 *   - Max Tokens Per Call dropdown (only for local-like providers)
 *
 * Why extracted:
 *   - 230 LOC of model-picker side effects with the most subtle
 *     UX invariants in the codebase (v1.24.1 PATCH Phase 5.5.0
 *     bidirectional cascade, v1.24.0 #208 sentinel-option UX).
 *     Extracting gives them their own file for focused review.
 *
 * Invariants preserved:
 *   - Switch unified -> per-task: prefill 3 per-task fields with
 *     settings.model (consistent starting state).
 *   - Switch per-task -> unified: cascade-clear 3 per-task overrides.
 *   - Any model-field / provider change: set llmReady=false to force
 *     user re-test (prevents stale-client bugs).
 *   - Fetch Models: uses fetchModelsWithFallback for all providers
 *     (Kimi Anthropic /v1 suffix case); only auto-picks the first
 *     model via setFieldValue (which triggers the cascade).
 *   - MaxTokens dropdown renders only for ollama/lmstudio/custom/
 *     anthropic-compatible (preserves native provider defaults).
 */

import { Setting, Notice, requestUrl } from 'obsidian';
import type { LLMWikiSettingTab } from '../settings';
import { PREDEFINED_PROVIDERS } from '../../types';
import { resolveModelTaskUiMode } from '../settings-per-task-helpers';
import { fetchModelsWithFallback } from '../../core/url-fallback';
import { resolveProviderApiKey } from '../../llm-sdk/provider-api-key-resolver';
import { classifyFetchError } from '../settings-helpers';
import { filterModelIds, reconcileModelSelection } from '../../core/model-id-filter';
import { NOTICE_NORMAL, NOTICE_ERROR } from '../../constants';

export function renderModelSection(tab: LLMWikiSettingTab, containerEl: HTMLElement): void {
  const { tempSettings } = tab;
  const providerConfig = PREDEFINED_PROVIDERS[tempSettings.provider];
  const isOllama = tempSettings.provider === 'ollama';
  const isCodex = tempSettings.provider === 'openai-codex';

  // Model section heading
  new Setting(containerEl).setName(tab.getText('modelSection')).setHeading();

  // Fetch Models button
  if (!isCodex) new Setting(containerEl)
    .setName(tab.getText('fetchModelsName'))
    .setDesc(tab.getText('fetchModelsDesc'))
    .addButton(button => button
      .setButtonText(tab.getText('fetchModelsButton'))
      .onClick(async () => {
        button.setButtonText(tab.getText('fetchingModels'));
        button.setDisabled(true);
        try {
          // v1.25.3 #182: resolve the effective API key from SecretStorage
          // so Fetch Models works post-migration (tempSettings.apiKey is
          // normally '' — the plaintext was moved to OS keychain).
          // v1.25.7 PATCH: Fetch Models is invoked from the Settings UI
          // where `tempSettings.apiKey` IS the in-memory typed buffer.
          // Pass it as `pendingKey` so the resolver honors a freshly-typed
          // key (e.g. just switched provider + typed new key) instead of
          // silently falling back to the stale SecretStorage value.
          const effectiveApiKey = resolveProviderApiKey(
            { apiKey: tempSettings.apiKey, providerApiKeySecretId: tempSettings.providerApiKeySecretId },
            tab.plugin.app.secretStorage,
            tempSettings.apiKey,
          );
          const apiKey = isOllama ? 'ollama' : effectiveApiKey;
          const baseUrl = tempSettings.baseUrl?.trim() || providerConfig?.baseUrl || undefined;

          // Issue #758: the id filter and the selection reconcile are pure
          // functions in `core/model-id-filter.ts` — the rule had no test while it
          // lived here, and it was wrong in a way a test would have caught.

          // v1.23.0 P1.5: use fetchModelsWithFallback for all providers.
          // Unified fallback handles missing /v1 suffix (Kimi Anthropic
          // case) - Test Connection and Fetch Models share the same
          // module-level cache.
          const providerForFallback =
            tempSettings.provider === 'openai' ? 'openai' :
            tempSettings.provider === 'anthropic' ? 'anthropic' :
            tempSettings.provider as 'openai-compatible' | 'anthropic-compatible';

          const fetchOneUrl = async (modelsUrl: string): Promise<string[]> => {
            try {
              const response = await requestUrl({
                url: modelsUrl,
                method: 'GET',
                headers: tempSettings.provider === 'anthropic' || tempSettings.provider === 'anthropic-compatible'
                  ? { 'x-api-key': apiKey, 'Anthropic-Version': '2023-06-01' }
                  : { 'Authorization': `Bearer ${apiKey}` },
                throw: false,
              });
              if (response.status >= 200 && response.status < 300) {
                const data = response.json as { data?: Array<{ id: string }> };
                // B1 (v1.26.3 PATCH, DocT CR): a 2xx is NEVER an error.
                // An absent/empty `data` array is a valid "no models"
                // answer — return [] so the orchestrator tries the next
                // candidate and the caller's `empty model list` → Empty
                // path (fetchErrorEmpty's dedicated message) stays
                // reachable. Previously this fell through to the throw
                // below, surfacing "HTTP 200: ..." which classifyFetchError
                // had no branch for → misreported as Network.
                return data.data?.map((m: { id: string }) => m.id) ?? [];
              }
              // B1 (v1.26.3 PATCH, DocT CR): non-2xx responses throw an
              // error carrying the HTTP status. Previously this path
              // silently returned [], which caused the orchestrator to
              // synthesize 'All URL candidates failed' — a status-less
              // message that `classifyFetchError` (settings-helpers.ts)
              // could not match, so every auth/endpoint/server failure
              // was misreported as `fetchErrorNetwork`. By embedding the
              // status code in the error message, classifyFetchError's
              // leading `^HTTP (\d+)` match routes it to the right category.
              // Body is truncated to 200 chars so the wrapped error does
              // not blow up the Notice; the full body is not logged.
              const bodySnippet = (response.text ?? '').slice(0, 200);
              throw new Error(`HTTP ${response.status}: ${bodySnippet}`);
            } catch (error) {
              // Preserve the status-bearing error (re-thrown above); wrap
              // genuine fetch exceptions (DNS, abort, etc.) so they also
              // carry an "unknown" marker that classifyFetchError falls
              // back to Network for.
              if (error instanceof Error && /^HTTP \d+/.test(error.message)) {
                throw error;
              }
              throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`);
            }
          };

          const effectiveBaseUrl = baseUrl ?? (
            tempSettings.provider === 'anthropic' ? 'https://api.anthropic.com/v1' :
            tempSettings.provider === 'openai' ? 'https://api.openai.com/v1' :
            ''
          );

          let models: string[];
          try {
            models = await fetchModelsWithFallback({
              baseUrl: effectiveBaseUrl,
              provider: providerForFallback,
              fetchFn: fetchOneUrl,
            });
            if (models.length === 0) throw new Error('empty model list');
          } catch (err) {
            // B1 (v1.26.3 PATCH): preserve the underlying error message so
            // classifyFetchError can match the HTTP status (or the wrapped
            // "Network error: ..."). Previously every error path was
            // rewritten to the status-less 'All URL candidates failed',
            // which the classifier could not categorize (always fell
            // through to the default 'Network' branch).
            if (err instanceof Error) {
              throw err;
            }
            throw new Error('All URL candidates failed');
          }

          tempSettings.availableModels = filterModelIds(tempSettings.provider, models).sort();
          if (tempSettings.availableModels.length > 0) {
            new Notice(tab.getText('fetchSuccess').replace('{}', tempSettings.availableModels.length.toString()), NOTICE_NORMAL);
            // Issue #758: a model the fetch did not list is left alone. The old
            // form rewrote it to the first entry and cleared `useCustomModel`,
            // which silently destroyed a hand-typed id — including one this very
            // fetch failed to list because the filter dropped it.
            const patch = reconcileModelSelection(tempSettings.model, tempSettings.availableModels);
            if (patch.model !== undefined) tab.setFieldValue('model', patch.model);
            if (patch.useCustomModel !== undefined) tempSettings.useCustomModel = patch.useCustomModel;
          } else {
            new Notice(tab.getText('fetchFailed'), NOTICE_NORMAL);
            tempSettings.useCustomModel = true;
          }
          tab.display();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const category = classifyFetchError(errorMsg);
          new Notice(tab.getTextDynamic(`fetchError${category}`), NOTICE_ERROR);
          tempSettings.useCustomModel = true;
          tempSettings.availableModels = [];
          tab.display();
        }
        button.setButtonText(tab.getText('fetchModelsButton'));
        button.setDisabled(false);
      }));

  // Model Scope dropdown (unified vs per-task)
  new Setting(containerEl)
    .setName(tab.getText('modelTaskModeName'))
    .setDesc(tab.getText('modelTaskModeDesc'))
    .addDropdown(dropdown => {
      dropdown.addOption('unified', tab.getText('modelTaskModeUnified'));
      dropdown.addOption('per-task', tab.getText('modelTaskModePerTask'));
      dropdown.setValue(resolveModelTaskUiMode(tempSettings));
      dropdown.onChange((value) => {
        const nextMode: 'unified' | 'per-task' = value === 'per-task' ? 'per-task' : 'unified';
        tempSettings.usePerTaskModels = nextMode === 'per-task';
        if (nextMode === 'unified') {
          tab.cascadeUnifiedModelChange();
        } else {
          tab.prefillPerTaskFromUnified();
        }
        tab.markLLMConfigStale();
        tab.display();
      });
    });

  // Unified model picker
  tab.renderModelField(containerEl, 'model', {
    name: resolveModelTaskUiMode(tempSettings) === 'per-task'
      ? tab.getText('perTaskIngestModelName')
      : tab.getText('selectModelName'),
    desc: resolveModelTaskUiMode(tempSettings) === 'per-task'
      ? tab.getText('perTaskIngestModelDesc')
      : tab.getText('selectModelDesc').replace('{}', String(tempSettings.availableModels?.length ?? 0)),
    dropdownSentinel: '__custom__',
    dropdownSentinelLabel: tab.getText('customInputOption'),
    allowCustom: !isCodex,
  });

  // Lint + Query pickers (per-task only)
  if (resolveModelTaskUiMode(tempSettings) === 'per-task') {
    tab.renderModelField(containerEl, 'lintModel', {
      name: tab.getText('perTaskLintModelName'),
      desc: tab.getText('perTaskLintModelDesc'),
      dropdownSentinel: '__custom__',
      dropdownSentinelLabel: tab.getText('customInputOption'),
      allowCustom: !isCodex,
    });
    tab.renderModelField(containerEl, 'queryModel', {
      name: tab.getText('perTaskQueryModelName'),
      desc: tab.getText('perTaskQueryModelDesc'),
      dropdownSentinel: '__custom__',
      dropdownSentinelLabel: tab.getText('customInputOption'),
      allowCustom: !isCodex,
    });
  }

  // Max Tokens Per Call (local-like providers only)
  const localLikeProviders = ['ollama', 'lmstudio', 'custom', 'anthropic-compatible'];
  if (localLikeProviders.includes(tempSettings.provider)) {
    const tokenOptions = [0, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576];
    const tokenLabels = ['0 (No limit)', '4K', '8K', '16K', '32K', '64K', '128K', '256K', '512K', '1M'];
    const currentVal = tempSettings.maxTokensPerCall ?? 0;
    new Setting(containerEl)
      .setName(tab.getText('maxTokensPerCallName'))
      .setDesc(tab.getText('maxTokensPerCallDesc'))
      .addDropdown(dropdown => {
        tokenOptions.forEach((val, idx) => {
          dropdown.addOption(String(val), tokenLabels[idx]);
        });
        dropdown.setValue(String(currentVal));
        dropdown.onChange((value) => {
          tempSettings.maxTokensPerCall = parseInt(value);
        });
      });
  }
}
