// v1.25.4 #339: "Migrate Secret Storage" repair command.
// Mirrors the codex-auth-commands.ts mixin pattern.
//
// When the v1.25.3 SecretStorage migration fails on Windows 10 (locked
// Credential Manager, service unavailable), the user's API key can end
// up in SecretStorage but not in settings.apiKey, or vice versa. This
// command restores the key from SecretStorage into settings so the
// plugin's resolver finds it.

import { Notice } from 'obsidian';
import type { App } from 'obsidian';
import type { LLMWikiSettings } from '../types';
import { ProviderSecretStore } from '../llm-sdk/provider-secret-store';
import { getText } from '../core/i18n';
import { NOTICE_NORMAL, NOTICE_ERROR } from '../constants';
import { persistedSettings } from '../types/settings';

export interface SecretStorageCommandsHost {
  settings: LLMWikiSettings;
  manifest: { version: string };
  app: App;
  saveData(data: unknown): Promise<void>;
}

export interface SecretStorageCommandsMethods {
  migrateApiKeyToSettings(): Promise<void>;
}

export const secretStorageCommands = {
  async migrateApiKeyToSettings(this: SecretStorageCommandsHost): Promise<void> {
    // Read the live key from Obsidian SecretStorage (OS keychain).
    let stored: string | null;
    try {
      stored = new ProviderSecretStore(this.app.secretStorage, this.settings.providerApiKeySecretId).load();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      new Notice(getText(this.settings.language, 'apiKeyMigrationFailedNotice').replace('{}', detail), NOTICE_ERROR);
      return;
    }
    if (!stored || !stored.trim()) {
      new Notice(getText(this.settings.language, 'errorNoApiKey'), NOTICE_ERROR);
      return;
    }
    // Write it back to settings.apiKey so the resolver can find it.
    this.settings.apiKey = stored.trim();
    await this.saveData(persistedSettings(this.settings));
    new Notice(getText(this.settings.language, 'apiKeyMigratedToSecretStorageSuccess'), NOTICE_NORMAL);
  },
};
