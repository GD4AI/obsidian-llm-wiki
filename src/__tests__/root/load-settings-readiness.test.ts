import { describe, expect, it, vi } from 'vitest';
import { LLMWikiPlugin } from '../../main';

/**
 * `llmReady` is derived from the current configuration, not a setting the user
 * keeps. Persisting it would be harmless if it were recomputed on load — but the
 * load path only recomputed it when the key was **absent** from `data.json`, and
 * `saveSettings()` writes the whole settings object. So from the second launch
 * onward the file's value was trusted instead of measured.
 *
 * `loadData` is the plugin's own method (Obsidian's `Plugin`), not `app.loadData`,
 * so it is mocked on the instance — the same shape `openai-codex-lifecycle.test.ts`
 * uses.
 */

function pluginWith(saved: Record<string, unknown>, secret: string | null = null): LLMWikiPlugin {
	const app = {
		secretStorage: { getSecret: () => secret, setSecret: () => undefined },
		workspace: { getLeavesOfType: () => [] },
		vault: { getAbstractFileByPath: () => null },
	};
	const plugin = new LLMWikiPlugin(app as never, {} as never);
	vi.spyOn(plugin, 'loadData').mockResolvedValue(saved);
	vi.spyOn(plugin, 'saveData').mockResolvedValue();
	return plugin;
}

describe('loadSettings — a persisted readiness flag is not trusted', () => {
	it('recomputes readiness when data.json already carries the key', async () => {
		// A vault that lost its credential outside the plugin still has llmReady: true
		// on disk from the last save. Nothing is configured here, so the honest answer
		// is false; the stale file must not win.
		const plugin = pluginWith({
			llmReady: true,
			provider: 'openai',
			apiKey: '',
			model: '',
			wikiFolder: 'wiki',
			language: 'en',
		});

		await plugin.loadSettings();

		expect(plugin.settings.llmReady, 'a stale true was trusted from disk').toBe(false);
	});

	it('reaches true when a provider is configured and the file said false', async () => {
		// The reverse direction, so the fix cannot be "always false". The key lives in
		// SecretStorage, not in the blob: a plaintext `apiKey` is migrated out by
		// v1.25.3 on load, so a fixture that puts it in `data.json` tests the migration
		// rather than the readiness measurement.
		const plugin = pluginWith(
			{
				llmReady: false,
				provider: 'openai',
				apiKey: '',
				providerApiKeySecretId: 'karpathywiki-openai',
				model: 'gpt-4o-mini',
				wikiFolder: 'wiki',
				language: 'en',
			},
			'sk-test',
		);

		await plugin.loadSettings();

		expect(plugin.settings.llmReady, 'a stale false was never corrected').toBe(true);
	});
});
