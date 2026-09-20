// Settings panel UI for LLM Wiki Plugin

import { App, PluginSettingTab, Setting, Notice, Platform } from 'obsidian';
import LLMWikiPlugin from '../main';
import { LLMWikiSettings } from '../types';
import { ConfirmModal } from './modals/ConfirmModal-class';
import { TEXTS } from '../texts';
import {
  resolveDisplayedModelForTask,
  shouldRenderModelDropdown,
  type ModelFieldKey,
} from './settings-per-task-helpers';
import { renderLanguageSection } from './settings-sections/language-section';
import { renderStatusSection } from './settings-sections/status-section';
import { renderProviderSection } from './settings-sections/provider-section';
import { renderModelSection } from './settings-sections/model-section';
import { renderAdvancedSection } from './settings-sections/advanced-section';
import { renderTestConnectionSection } from './settings-sections/test-connection-section';
import { renderWikiConfigSection } from './settings-sections/wiki-config-section';
import { renderAutoMaintainSection } from './settings-sections/auto-maintain-section';
import { renderAdvancedSettingsSection } from './settings-sections/advanced-settings-section';
import { copyCodexDeviceCode, runCodexDeviceAuth, runCodexModelRefresh, runCodexSignOut } from './openai-codex-auth-controls';
import { copyBedrockUserCode, runBedrockDeviceAuth, runBedrockSignOut, type BedrockDevicePrompt } from './bedrock-auth-controls';
import { applyCodexModelPolicy } from '../core/openai-codex-model-policy';
import type { CodexDevicePrompt } from './openai-codex-auth-controls';
import { BEDROCK_DEFAULT_REGION, NOTICE_NORMAL, NOTICE_ERROR } from '../constants';
import { ProviderSecretStore } from '../llm-sdk/provider-secret-store';

// v1.25.5: getSettingDefinitions() implemented as a no-op stub for
// Obsidian 1.13+ declarative settings API compatibility. The real
// declarative schema migration is tracked for when minAppVersion >= 1.13.0.
// See Issue #328 (Schema Phase 2/3) for the full declarative-settings plan.
export class LLMWikiSettingTab extends PluginSettingTab {
  plugin: LLMWikiPlugin;
  tempSettings: LLMWikiSettings;
  public codexAuthBusy = false;
  public codexDevicePrompt: CodexDevicePrompt | null = null;
  private codexModelRefreshAttemptedAt = 0;
  // #425 Bedrock Stage 2 — SSO login state + in-memory IAM key buffers
  // (flushed to SecretStorage once on tab close, mirroring flushApiKey).
  public bedrockAuthBusy = false;
  public bedrockDevicePrompt: BedrockDevicePrompt | null = null;
  public bedrockIamKeyBuffer = '';
  public bedrockIamSecretBuffer = '';
  public bedrockIamSessionTokenBuffer = '';

  constructor(app: App, plugin: LLMWikiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.tempSettings = {
      ...plugin.settings,
      watchedFolders: [...(plugin.settings.watchedFolders || [])]
    };
  }

  // v1.25.5: getSettingDefinitions() no-op stub for Obsidian 1.13+ settings
  // search compatibility. Full declarative migration tracked for minAppVersion >= 1.13.0.
  getSettingDefinitions(): unknown[] {
    return [];
  }

  // Issue #137: merge tempSettings → plugin.settings, preserving any
  // fields the form does not track but Test Connection mutates.
  // v1.23.0: thinkingControlCache is @deprecated (AI-SDK v6 handles
  // internally) but still preserved here for data.json forward-compat.
  // Called by hide() (auto-save) and the explicit Save button. Adding
  // a new probe-mutated field only requires extending this one helper,
  // not every save site.
  /**
   * Flush the typed apiKey into SecretStorage, then merge
   * `tempSettings` → `plugin.settings`. Returns false if the flush
   * failed (caller must skip saveSettings so the typed key survives
   * for retry — see flushApiKey for failure semantics).
   *
   * Contract: this is a pure write-through. It MUST NOT cascade,
   * auto-correct, or otherwise mutate `tempSettings` beyond the
   * post-flush `apiKey` wipe. Per-task model ownership lives in
   * `setFieldValue` (which fires `cascadeUnifiedModelChange`).
   */
  public commitTempSettings(): boolean {
    // Flush before wipe — see flushApiKey for failure semantics.
    const flushSucceeded = this.flushApiKey();
    if (!flushSucceeded) return false;
    // Defensive: flushApiKey already clears tempSettings.apiKey on
    // success. Belt-and-suspenders so a future caller bypassing
    // flushApiKey can't reintroduce the v1.25.3 #182 plaintext leak.
    this.tempSettings.apiKey = '';
    // Pure write-through: commit MUST NOT cascade. Per-task model
    // ownership lives in setFieldValue → cascadeUnifiedModelChange.
    this.plugin.settings = {
      ...this.tempSettings,
      watchedFolders: [...(this.tempSettings.watchedFolders || [])],
      thinkingControlCache: this.plugin.settings.thinkingControlCache,
    };
    return true;
  }

  // Auto-save when user navigates away from settings tab
  hide(): void {
    // #425: IAM key buffers flush BEFORE the change check — they never
    // touch tempSettings, so without this they would be dropped on a
    // no-op close even though the user typed keys. Gated to iam mode so
    // keys typed then ABANDONED (mode switched away) are not persisted.
    if ((this.tempSettings.bedrockAuthMethod ?? 'api-key') === 'iam') {
      this.flushBedrockIamKeys();
    }
    const hasChanges = JSON.stringify(this.tempSettings) !== JSON.stringify(this.plugin.settings);
    if (hasChanges) {
      // commitTempSettings owns the flush; skip saveSettings on failure
      // so the typed apiKey survives for retry (v1.25.4 #339 invariant).
      const commitSucceeded = this.commitTempSettings();
      if (!commitSucceeded) return;
      void this.plugin.saveSettings();
      console.debug('Settings auto-saved on tab close');
    }
  }

  /**
   * #425 Bedrock Stage 2: flush typed static IAM keys into SecretStorage
   * once per edit session (mirrors flushApiKey discipline). Only writes
   * when the user actually entered both required fields; partial input
   * is kept in memory for retry. Returns void because the buffers are
   * wiped ONLY after setSecret returns — there is no commit step whose
   * skipping this return value would need to gate (the #339 hazard of
   * wipe-before-IO-success cannot occur by construction; a test pins it).
   */
  public flushBedrockIamKeys(): void {
    const accessKeyId = this.bedrockIamKeyBuffer.trim();
    const secretAccessKey = this.bedrockIamSecretBuffer.trim();
    if (accessKeyId.length === 0 && secretAccessKey.length === 0) return;
    if (accessKeyId.length === 0 || secretAccessKey.length === 0) {
      // Partial entry — keep buffers so the user can complete them.
      new Notice(this.getText('bedrockIamRequired'), NOTICE_ERROR);
      return;
    }
    try {
      const sessionToken = this.bedrockIamSessionTokenBuffer.trim();
      this.plugin.bedrockAuthManager?.saveIamKeys(
        sessionToken.length > 0 ? { accessKeyId, secretAccessKey, sessionToken } : { accessKeyId, secretAccessKey },
      );
      this.bedrockIamKeyBuffer = '';
      this.bedrockIamSecretBuffer = '';
      this.bedrockIamSessionTokenBuffer = '';
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      new Notice(this.getText('bedrockIamSaveFailed').replace('{}', detail), NOTICE_ERROR);
    }
  }

  /**
   * v1.25.3 #182: flush the pending apiKey textbox value into Obsidian
   * SecretStorage and clear the in-memory pending value. ONLY writes
   * when the user actually typed a new value — never overwrites an
   * existing SecretStorage entry with an empty string on a no-op close
   * (would silently destroy the user's key).
   *
   * v1.25.4 #339: wraps save() in try/catch. On Windows 10 Credential
   * Manager failure, the previous version threw silently and the tab
   * hide aborted before commitTempSettings — but `hide()` would then
   * have aborted the user-visible save flow (no Notice, no progress),
   * which was worse UX. Now we surface a recoverable Notice AND return
   * `false` so `hide()` skips commitTempSettings entirely; otherwise the
   * unconditional `tempSettings.apiKey = ''` in commitTempSettings
   * would wipe the freshly-typed plaintext and persist `''` to
   * data.json — re-creating the original #339 failure mode.
   *
   * Returns true when the SecretStorage write succeeded (or there was
   * nothing to write). Returns false when SecretStorage IO failed and
   * the caller must NOT commit.
   */
  public flushApiKey(): boolean {
    const pending = this.tempSettings.apiKey;
    if (pending.trim().length === 0) return true;  // nothing to flush
    const store = new ProviderSecretStore(this.app.secretStorage, this.tempSettings.providerApiKeySecretId);
    try {
      store.save(pending);
      this.tempSettings.apiKey = '';
      return true;
    } catch (error: unknown) {
      // Keep tempSettings.apiKey populated so the user can retry on next save.
      // Surface a recoverable Notice (error.message only — no PII).
      const detail = error instanceof Error ? error.message : 'Unknown error';
      new Notice(this.getText('apiKeyMigrationFailedNotice').replace('{}', detail), NOTICE_ERROR);
      return false;
    }
  }

  getText(key: keyof typeof TEXTS.en): string {
    // v1.25.1 Phase C-PR2: signature restored to `keyof typeof TEXTS.en`.
    // The earlier widening to `string` removed compile-time protection
    // from ~173 literal call sites for the sake of 1 dynamic site
    // (model-section: `fetchError${category}`). Dynamic keys now route
    // through `getTextDynamic` instead.
    const texts = TEXTS[this.tempSettings.language];
    return (texts[key] as string) ?? TEXTS.en[key] ?? key;
  }

  /**
   * v1.25.1 Phase C-PR2: dynamic-key variant of getText. Use only when
   * the key is constructed at runtime (e.g. `fetchError${category}`).
   * Literal keys must go through `getText` so tsc can catch typos.
   */
  getTextDynamic(key: string): string {
    const texts = TEXTS[this.tempSettings.language];
    return (texts[key as keyof typeof texts] as string) ?? TEXTS.en[key as keyof typeof TEXTS.en] ?? key;
  }

  /**
   * v1.24.0 #208: shared model-picker renderer for all 4 model fields
   * (unified `model` + per-task `ingestModel` / `lintModel` / `queryModel`).
   *
   * Renders either a dropdown (when a fetched list is available AND the
   * field's `*UseCustom` flag is false) or a free-form text input (in
   * all other cases). The dropdown carries a sentinel option that, when
   * picked, either switches to text input mode (unified: `__custom__` →
   * `useCustomModel=true`) or clears the per-task value to fall back to
   * `settings.model` (per-task: `__unified__` → `field = ''`).
   *
   * Why a shared helper: the existing unified picker and the new
   * per-task pickers share identical dropdown↔input switching logic.
   * Implementing it inline 4 times would diverge over time (every
   * pre-existing bug in the unified picker would reappear in the new
   * pickers). One helper, four call sites — see settings-per-task-helpers.ts
   * for the pure rendering policy (`shouldRenderModelDropdown`).
   */
  // v1.25.1 Phase C-PR2: made public so section renderers (model-section,
  // wiki-config-section, advanced-section) can invoke it. The helper is
  // logically a section-level concern but is also used as a dispatch
  // hook from the class. Public exposure keeps the section modules from
  // needing to subclass or duplicate the renderer.
  renderModelField(
    containerEl: HTMLElement,
    field: ModelFieldKey,
    options: {
      name: string;
      desc: string;
      dropdownSentinel: string;
      dropdownSentinelLabel: string;
      allowCustom?: boolean;
    },
  ): void {
    const setting = new Setting(containerEl)
      .setName(options.name)
      .setDesc(options.desc);
    const useDropdown = shouldRenderModelDropdown(this.tempSettings, field);
    if (useDropdown) {
      setting.addDropdown(dropdown => {
        (this.tempSettings.availableModels || []).forEach(model => {
          dropdown.addOption(model, model);
        });
        if (options.allowCustom !== false) dropdown.addOption(options.dropdownSentinel, options.dropdownSentinelLabel);
        const currentVal = this.getCurrentModelValue(field);
        // If the current value is empty OR not in the fetched list, default
        // the dropdown to the sentinel option. This covers two cases:
        //   1. User hasn't picked a per-task value yet (field === '') →
        //      shows sentinel so user can choose "Custom input..." or
        //      pick from the list.
        //   2. User previously typed a custom model ID that isn't in the
        //      fetched list → showing the sentinel matches the actual
        //      state (the value is preserved in the field, just not in
        //      the dropdown's visible options).
        const displayVal = currentVal.trim() && (this.tempSettings.availableModels || []).includes(currentVal.trim())
          ? currentVal.trim()
          : options.allowCustom === false ? this.tempSettings.availableModels?.[0] ?? '' : options.dropdownSentinel;
        dropdown.setValue(displayVal);
        dropdown.onChange((value) => {
          if (options.allowCustom !== false && value === options.dropdownSentinel) {
            // Unified picker: switch to text input (preserves field value).
            // Per-task picker: also switch to text input — same UX. The
            // "use unified model" semantic is expressed by *leaving the
            // text input blank*, not by a separate sentinel option.
            // (v1.24.0 #208 UX fix: previously per-task pickers cleared
            // the field on sentinel pick, which made "use unified model"
            // accidental — user couldn't tell the two states apart.)
            if (field === 'model') {
              this.tempSettings.useCustomModel = true;
            } else {
              this.setUseCustomFlag(field, true);
            }
            this.display();
          } else {
            // Pick a real model from the fetched list.
            if (field === 'model') {
              this.tempSettings.useCustomModel = false;
            } else {
              this.setUseCustomFlag(field, false);
            }
            this.setFieldValue(field, value);
          }
        });
      });
    } else {
      // Free-form text input. Show "use dropdown" button only when a
      // fetched list exists — otherwise there is no dropdown to switch to.
      const hasFetched = (this.tempSettings.availableModels?.length ?? 0) > 0;
      setting.addText(text => text
        .setPlaceholder(this.getText('modelInputPlaceholder'))
        .setValue(this.getCurrentModelValue(field))
        .onChange((value) => { this.setFieldValue(field, value); }));
      if (hasFetched && options.allowCustom !== false) {
        setting.addExtraButton(button => button
          .setIcon('list')
          .setTooltip(this.getText('useDropdownButton'))
          .onClick(() => {
            if (field === 'model') {
              this.tempSettings.useCustomModel = false;
            } else {
              this.setUseCustomFlag(field, false);
            }
            this.display();
          }));
      }
    }
  }

  private codexAuthError(error: unknown): string { return this.getText('codexAuthFailed').replace('{}', error instanceof Error ? error.message : String(error)); }

  public syncCodexModelsFromPlugin(): void {
    this.tempSettings.openAICodexModels = (this.plugin.settings.openAICodexModels ?? []).map((entry) => ({ ...entry, supportedReasoningLevels: [...entry.supportedReasoningLevels], additionalSpeedTiers: [...entry.additionalSpeedTiers], serviceTiers: entry.serviceTiers.map((tier) => ({ ...tier })) }));
    this.tempSettings.openAICodexModelsFetchedAt = this.plugin.settings.openAICodexModelsFetchedAt ?? 0;
    this.tempSettings.openAICodexUnavailableModels = [...(this.plugin.settings.openAICodexUnavailableModels ?? [])];
    applyCodexModelPolicy(this.tempSettings);
  }

  /**
   * Adopt the committed model selection wholesale, deliberately without
   * cascading (Issue #467).
   *
   * The distinction the write guard exists to make explicit: a **user edit** to
   * the unified model must clear the per-task overrides, because `setFieldValue`
   * expands one field the user changed into a coherent selection and the
   * overrides would otherwise stay pinned to a model the picker no longer shows.
   * A **sync** from `plugin.settings` is not an edit — all four fields arrive
   * together from the source of truth, and clearing three of them only to
   * reassign them on the next line would flip their `*UseCustom` flags as a side
   * effect of nothing.
   *
   * Lives on the tab because `tempSettings.model` is only assignable here; every
   * other module goes through `setFieldValue` or this, and
   * `unified-model-write-guard.test.ts` fails if one starts assigning directly.
   */
  public syncModelsFromPlugin(): void {
    this.tempSettings.model = this.plugin.settings.model;
    this.tempSettings.ingestModel = this.plugin.settings.ingestModel;
    this.tempSettings.lintModel = this.plugin.settings.lintModel;
    this.tempSettings.queryModel = this.plugin.settings.queryModel;
  }

  public async refreshOpenAICodexModels(force: boolean, showSuccess: boolean): Promise<void> { await runCodexModelRefresh({ refresh: () => this.plugin.refreshOpenAICodexModels(force), sync: () => { this.syncCodexModelsFromPlugin(); }, showSuccess: (count) => { if (showSuccess) new Notice(this.getText('codexModelsRefreshSuccess').replace('{}', String(count)), NOTICE_NORMAL); }, showError: (error) => { new Notice(this.getText('codexModelsRefreshFailed').replace('{}', error instanceof Error ? error.message : String(error)), NOTICE_ERROR); }, setBusy: (value) => { this.codexAuthBusy = value; }, render: () => { this.display(); } }); }

  public queueStaleCodexModelRefresh(): void {
    const now = Date.now();
    const lastSuccessful = this.plugin.settings.openAICodexModelsFetchedAt ?? 0;
    if (this.codexAuthBusy || now - Math.max(lastSuccessful, this.codexModelRefreshAttemptedAt) < 5 * 60 * 1000) return;
    this.codexModelRefreshAttemptedAt = now;
    void this.refreshOpenAICodexModels(false, false);
  }

  public async loginOpenAICodexBrowser(): Promise<void> {
    if (!Platform.isDesktopApp) return;
    this.codexAuthBusy = true;
    this.display();
    try { await this.plugin.loginOpenAICodexBrowser(); this.syncCodexModelsFromPlugin(); this.tempSettings.llmReady = false; } catch (error) { new Notice(this.codexAuthError(error), NOTICE_ERROR); } finally { this.codexAuthBusy = false; this.display(); }
  }

  public async loginOpenAICodexDevice(): Promise<void> {
    await runCodexDeviceAuth({ beginLogin: () => this.plugin.beginOpenAICodexDeviceLogin(), openExternal: (url) => this.plugin.openExternal(url), setPrompt: (prompt) => { this.codexDevicePrompt = prompt; }, showError: (error) => { new Notice(this.codexAuthError(error), NOTICE_ERROR); }, setBusy: (value) => { this.codexAuthBusy = value; }, setReady: (value) => { this.tempSettings.llmReady = value; }, render: () => { this.display(); } });
    this.syncCodexModelsFromPlugin();
  }

  public async copyOpenAICodexDeviceCode(): Promise<void> {
    if (!this.codexDevicePrompt) return;
    try { await copyCodexDeviceCode(this.codexDevicePrompt.userCode, navigator.clipboard); } catch (error) { new Notice(this.codexAuthError(error), NOTICE_ERROR); }
  }

  private confirmOpenAICodexSignOut(): Promise<boolean> {
    // v1.25.2 PATCH: replaced `window.confirm` with Obsidian `ConfirmModal`
    // so we don't trip the 0.4.1 `no-alert` rule. Returns a Promise that
    // resolves to the user's choice (true on confirm, false on cancel/Escape).
    return new Promise<boolean>((resolve) => {
      new ConfirmModal(this.app, {
        title: this.getText('codexAuthSignOutButton'),
        body: `${this.getText('codexAuthSignOutButton')}?`,
        confirmText: this.getText('codexAuthSignOutButton'),
        cancelText: this.getText('cancelButton'),
        onChoice: (confirmed) => resolve(confirmed),
      }).open();
    });
  }

  public async signOutOpenAICodex(): Promise<void> {
    await runCodexSignOut({ isBusy: () => this.codexAuthBusy, isSignedIn: () => this.plugin.codexAuthManager?.hasCredential() === true, confirm: () => this.confirmOpenAICodexSignOut(), signOut: () => this.plugin.signOutOpenAICodex(), showError: (error) => { new Notice(this.codexAuthError(error), NOTICE_ERROR); }, setBusy: (value) => { this.codexAuthBusy = value; }, setReady: (value) => { this.tempSettings.llmReady = value; }, render: () => { this.display(); } });
    this.syncCodexModelsFromPlugin();
  }

  // ===== #425 Bedrock Stage 2 — SSO auth controls =====

  private bedrockAuthError(error: unknown): string {
    const detail = error instanceof Error ? error.message : String(error);
    return this.getText('bedrockSsoFailed').replace('{}', detail);
  }

  public async loginBedrockSso(): Promise<void> {
    const manager = this.plugin.bedrockAuthManager;
    if (!manager || this.bedrockAuthBusy) return;
    const startUrl = (this.tempSettings.bedrockSsoStartUrl ?? '').trim();
    if (startUrl.length === 0) {
      new Notice(this.getText('bedrockSsoStartUrlName'), NOTICE_ERROR);
      return;
    }
    const signedInBefore = manager.hasSsoToken();
    // DeviceLoginSession is structurally a BedrockDevicePrompt — pass
    // the session through directly.
    await runBedrockDeviceAuth({
      beginLogin: () => manager.beginDeviceLogin(startUrl, this.tempSettings.bedrockRegion || BEDROCK_DEFAULT_REGION),
      openExternal: (url) => this.plugin.openExternal(url),
      setPrompt: (prompt) => { this.bedrockDevicePrompt = prompt; },
      showError: (error) => { new Notice(this.bedrockAuthError(error), NOTICE_ERROR); },
      setBusy: (value) => { this.bedrockAuthBusy = value; },
      setReady: (value) => { this.tempSettings.llmReady = value; },
      render: () => { this.display(); },
    });
    // Post-login prefill (#425): when the token is fresh AND both
    // fields are empty, ask the portal for the single visible account/
    // role and fill them in. Ambiguous or failed discovery silently
    // keeps manual entry authoritative.
    if (!signedInBefore && manager.hasSsoToken()) {
      const accountEmpty = (this.tempSettings.bedrockSsoAccountId ?? '').trim().length === 0;
      const roleEmpty = (this.tempSettings.bedrockSsoRoleName ?? '').trim().length === 0;
      if (accountEmpty && roleEmpty) {
        const found = await manager.discoverAccountRole().catch(() => null);
        if (found) {
          this.tempSettings.bedrockSsoAccountId = found.accountId;
          this.tempSettings.bedrockSsoRoleName = found.roleName;
          new Notice(this.getText('bedrockSsoDetectedPrefill').replace('{}', `${found.accountId} / ${found.roleName}`), NOTICE_NORMAL);
          this.display();
        }
      }
    }
  }

  public async copyBedrockUserCode(): Promise<void> {
    if (!this.bedrockDevicePrompt) return;
    try { await copyBedrockUserCode(this.bedrockDevicePrompt.userCode, navigator.clipboard); } catch (error) { new Notice(this.bedrockAuthError(error), NOTICE_ERROR); }
  }

  private confirmBedrockSignOut(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      new ConfirmModal(this.app, {
        title: this.getText('bedrockSsoSignOutButton'),
        body: `${this.getText('bedrockSsoSignOutButton')}?`,
        confirmText: this.getText('bedrockSsoSignOutButton'),
        cancelText: this.getText('cancelButton'),
        onChoice: (confirmed) => resolve(confirmed),
      }).open();
    });
  }

  public async signOutBedrock(): Promise<void> {
    await runBedrockSignOut({
      isBusy: () => this.bedrockAuthBusy,
      isSignedIn: () => this.plugin.bedrockAuthManager?.hasSsoToken() === true,
      confirm: () => this.confirmBedrockSignOut(),
      signOut: async () => { this.plugin.bedrockAuthManager?.signOut(); },
      showError: (error) => { new Notice(this.bedrockAuthError(error), NOTICE_ERROR); },
      setBusy: (value) => { this.bedrockAuthBusy = value; },
      setReady: (value) => { this.tempSettings.llmReady = value; },
      render: () => { this.display(); },
    });
  }

  /** Read the current model string for any of the 4 model fields. */
  public getCurrentModelValue(field: ModelFieldKey): string {
    if (field === 'model') return this.tempSettings.model;
    const task = field === 'ingestModel' ? 'ingest' : field === 'lintModel' ? 'lint' : 'query';
    return resolveDisplayedModelForTask(this.tempSettings, task);
  }

  /**
   * Write a model string into any of the 4 model fields.
   *
   * v1.24.1 PATCH Phase 5.5.0 hotfix: when the user changes the
   * unified `model` field, cascade-clear the per-task override fields
   * (`ingestModel` / `lintModel` / `queryModel`) so all tasks
   * immediately use the new unified model. Prior behavior left the
   * per-task values untouched, so a unified-model edit could change
   * the displayed picker while leaving live task routing still pinned
   * to the old per-task model. UX bug reported 2026-07-13.
   *
   * Cascade only fires when:
   *  - `field === 'model'`, AND
   *  - the new value is non-empty (don't cascade-clear on blank-edit).
   *
   * Edge case: if a user explicitly opts into per-task mode later, they
   * can re-populate the per-task fields via the per-task pickers. The
   * cascade ensures UNIFIED → UNIFIED is atomic. PER_TASK editing is
   * not affected (those calls go through this same setter but bypass
   * the cascade block via the `field === 'model'` guard).
   */
  public setFieldValue(field: ModelFieldKey, value: string): void {
    if (field === 'model') {
      this.tempSettings.model = value;
      if (value.trim()) {
        this.cascadeUnifiedModelChange();
      }
    } else {
      (this.tempSettings as unknown as Record<string, string | undefined>)[field] = value;
    }
    // v1.24.1 PATCH Phase 5.5.0 hotfix: ANY model-field edit marks the
    // LLM config stale so the user must re-run Test Connection before
    // the next LLM call. Without this, the user could change model
    // in the UI but the existing llmClient would still use the old
    // model (no rebuild until saveSettings → initializeLLMClient).
    this.markLLMConfigStale();
  }

  /**
   * v1.24.1 PATCH Phase 5.5.0 hotfix: reset all per-task model override
   * fields so unified-model edits propagate to every task. Fires one
   * Notice to inform the user about the reset. Idempotent — calling
   * repeatedly with the overrides already empty is a no-op for both
   * the field writes and the Notice guard.
   */
  public cascadeUnifiedModelChange(): void {
    const fields: Array<'ingestModel' | 'lintModel' | 'queryModel'> = [
      'ingestModel',
      'lintModel',
      'queryModel',
    ];
    for (const f of fields) {
      const current = (this.tempSettings as unknown as Record<string, string | undefined>)[f];
      if (current !== undefined && current !== '') {
        (this.tempSettings as unknown as Record<string, string | undefined>)[f] = '';
        // Per-task *UseCustom flag also cleared so the per-task dropdown
        // re-anchors on the unified model instead of stale free-form text.
        this.setUseCustomFlag(f, false);
      }
    }
    // v1.24.1 PATCH Phase 5.5.0 hotfix: silent cascade. The fact that
    // per-task values were cleared is already visible in the Settings UI
    // (the per-task fields become empty), so a toast would add noise.
  }

  /**
   * v1.24.1 PATCH Phase 5.5.0 hotfix: prefill the 3 per-task model
   * fields with the current unified model. Triggered when the user
   * switches UI mode from unified → per-task so the per-task pickers
   * open with consistent starting state. The user can then edit
   * individual tasks without first having to type or pick each one.
   *
   * Behavior:
   *  - All 3 per-task fields are set to the unified model string
   *    (NOT cleared) so fallback indirection is unnecessary.
   *  - All 3 `*UseCustom` flags are reset to false so the dropdown
   *    re-anchors on the unified value (instead of stale free-form
   *    text from a previous session).
   *  - Idempotent — re-running is a no-op when the per-task fields
   *    already match the unified value.
   */
  public prefillPerTaskFromUnified(): void {
    const unified = this.tempSettings.model.trim();
    const fields: Array<'ingestModel' | 'lintModel' | 'queryModel'> = [
      'ingestModel',
      'lintModel',
      'queryModel',
    ];
    for (const f of fields) {
      (this.tempSettings as unknown as Record<string, string | undefined>)[f] = unified;
      this.setUseCustomFlag(f, false);
    }
  }

  /**
   * v1.24.1 PATCH Phase 5.5.0 hotfix: mark the LLM config as
   * unverified whenever the user changes the provider, the unified
   * model, or any per-task model. This forces the user to re-run
   * Test Connection so the underlying `llmClient` is rebuilt with
   * the new settings — preventing stale-client bugs where a model
   * edit silently went out with the previous model.
   *
   * Also clears `availableModels` since the fetched list is per-
   * provider; the next Test Connection will re-fetch.
   */
  public markLLMConfigStale(): void {
    this.tempSettings.llmReady = false;
  }

  /** Toggle the <field>UseCustom flag for per-task fields; no-op for unified. */
  public setUseCustomFlag(field: ModelFieldKey, value: boolean): void {
    if (field === 'model') return; // useCustomModel is owned by the unified picker
    const flagKey = `${field}UseCustom`;
    (this.tempSettings as unknown as Record<string, boolean | undefined>)[flagKey] = value;
  }

  /**
   * Check if wiki folder structure exists (entities, concepts, sources, schema).
   * Uses IO inspection — no persistent flag.
   */
  public isWikiInitialized(): boolean {
    const wikiFolder = this.tempSettings.wikiFolder || 'wiki';
    return !!(
      this.app.vault.getAbstractFileByPath(`${wikiFolder}/entities`) &&
      this.app.vault.getAbstractFileByPath(`${wikiFolder}/concepts`) &&
      this.app.vault.getAbstractFileByPath(`${wikiFolder}/sources`) &&
      this.app.vault.getAbstractFileByPath(`${wikiFolder}/schema`)
    );
  }

  display() {
    // v1.25.1 Phase C-PR2: split the monolithic display() into 8 focused
    // section renderers under src/ui/settings-sections/. Each section
    // owns a self-contained slice of the Settings tab UI. The orchestrator
    // here only:
    //   - clears containerEl
    //   - invokes each section in user-visible order
    //   - delegates to the shared helpers on this class (renderModelField,
    //     cascadeUnifiedModelChange, etc.) which the section modules need.
    //
    // Why orchestrator ordering matters:
    //   - Status section (Section 2.5) must come BEFORE LLM Provider
    //     (Section 3) so the user sees the ready indicator when reading
    //     about provider config.
    //   - Test Connection sits inside Section 3 right after the Advanced
    //     block, NOT at the end of the tab - matching pre-PR2 layout
    //     users have muscle memory for.
    const { containerEl } = this;
    containerEl.empty();
    if (this.tempSettings.provider === 'openai-codex') applyCodexModelPolicy(this.tempSettings);

    renderLanguageSection(this, containerEl);
    renderStatusSection(this, containerEl);
    renderProviderSection(this, containerEl);
    renderModelSection(this, containerEl);
    renderAdvancedSection(this, containerEl);
    renderTestConnectionSection(this, containerEl);
    // The "Wiki Configuration" H2 heading is rendered INSIDE
    // renderWikiConfigSection (matches pre-PR2 layout - the heading
    // lived in the same Settings row block as the wiki folder input).
    // Avoid double-rendering the heading here.
    renderWikiConfigSection(this, containerEl);
    renderAutoMaintainSection(this, containerEl);
    // v1.26.0 (#382 item 2): bottom-most section — generic advanced-user
    // settings (lint thresholds, Welcome note) with a section-level toggle.
    renderAdvancedSettingsSection(this, containerEl);
  }
}
