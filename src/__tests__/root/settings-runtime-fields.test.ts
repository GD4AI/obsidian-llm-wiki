import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LLMWikiPlugin } from '../../main';
import { DEFAULT_SETTINGS, RUNTIME_ONLY_SETTINGS_FIELDS } from '../../types/settings';

/**
 * Issue #1016 — a field the plugin derives at runtime must not be written to disk.
 *
 * `#1013` fixed one instance of that class: `llmReady` was persisted by
 * `saveSettings()` and then trusted on load, so the file's stale value outranked a
 * fresh measurement. The instance is fixed; the class was not guarded. This list is
 * the guard, and these tests are what make it a guard rather than a comment.
 *
 * `queryHistory` is deliberately NOT on the list: it is runtime state that is meant
 * to survive a restart.
 */

function pluginWith(saved: Record<string, unknown> = {}): LLMWikiPlugin {
	const app = {
		secretStorage: { getSecret: () => null, setSecret: () => undefined },
		workspace: { getLeavesOfType: () => [] },
		vault: { getAbstractFileByPath: () => null },
	};
	const plugin = new LLMWikiPlugin(app as never, {} as never);
	vi.spyOn(plugin, 'loadData').mockResolvedValue(saved);
	vi.spyOn(plugin, 'saveData').mockResolvedValue();
	return plugin;
}

async function savedBlob(plugin: LLMWikiPlugin): Promise<Record<string, unknown>> {
	await plugin.saveSettings();
	const calls = vi.mocked(plugin.saveData).mock.calls;
	expect(calls.length, 'saveSettings did not write anything').toBeGreaterThan(0);
	return calls[calls.length - 1][0] as Record<string, unknown>;
}

describe('#1016 — runtime-only fields never reach data.json', () => {
	it('writes none of the listed fields', async () => {
		const plugin = pluginWith();
		await plugin.loadSettings();
		// True in memory is correct: it is measured. What matters is that the file
		// does not keep a copy that a later load could mistake for a measurement.
		plugin.settings.llmReady = true;

		const blob = await savedBlob(plugin);

		for (const field of RUNTIME_ONLY_SETTINGS_FIELDS) {
			expect(blob, `${field} was persisted`).not.toHaveProperty(field);
		}
		expect(RUNTIME_ONLY_SETTINGS_FIELDS.length, 'the list is empty, so it guards nothing').toBeGreaterThan(0);
	});

	it('still writes a field that is meant to persist', async () => {
		// The guard must strip the list and nothing else. `queryHistory` is the
		// counter-example the issue names: runtime state that is deliberately kept.
		const plugin = pluginWith();
		await plugin.loadSettings();
		const entry = { question: 'q', answer: 'a', timestamp: 1 } as unknown as NonNullable<
			typeof plugin.settings.queryHistory
		>[number];
		plugin.settings.queryHistory = [entry];

		const blob = await savedBlob(plugin);

		expect(blob).toHaveProperty('queryHistory');
		expect(blob.queryHistory).toHaveLength(1);
	});

	it('keeps the in-memory value, so the session never loses it', async () => {
		// Stripping on the way out is the whole trick. A sanitizer that deleted the
		// property from the live object would break the status row, which reads it.
		const plugin = pluginWith();
		await plugin.loadSettings();
		plugin.settings.llmReady = true;

		await savedBlob(plugin);

		expect(plugin.settings.llmReady).toBe(true);
	});

	it('lists only real settings fields, so a rename cannot leave a stale entry', async () => {
		// A typed `readonly (keyof LLMWikiSettings)[]` catches a rename at compile
		// time. This catches the case the type cannot: a key that exists in the type
		// but was never in the defaults, which would mean the guard strips nothing.
		for (const field of RUNTIME_ONLY_SETTINGS_FIELDS) {
			expect(Object.keys(DEFAULT_SETTINGS), `${field} is not a settings field`).toContain(field);
		}
	});

	it('loads a data.json that still carries the key, and ignores the stored value', async () => {
		// Old files exist. Removing the write does not rewrite them.
		const plugin = pluginWith({ llmReady: true, provider: 'openai', apiKey: '', model: '', wikiFolder: 'wiki' });

		await plugin.loadSettings();

		expect(plugin.settings.llmReady, 'a stale true outranked the measurement').toBe(false);
	});
});

// A guard on `saveSettings()` is not a guard on the class. The grep that found the
// first fix found seven more write paths — two migrations in `main.ts`, three in the
// Codex model-cache commands, the SecretStorage key migration, and the auto-maintain
// clock tick — each of which persisted the whole settings object. Any one of them puts
// `llmReady` back on disk, and then the next load has the stale value the list exists
// to prevent. So the rule is about the write, not about one function.
function tsFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (path !== join('src', '__tests__')) out.push(...tsFiles(path));
		} else if (entry.name.endsWith('.ts')) out.push(path);
	}
	return out;
}

describe('#1016 — no write path bypasses the filter', () => {
	it('passes settings through persistedSettings everywhere settings are written', () => {
		// An exception is allowed, but it has to be added here with a reason. A call
		// that writes something other than the settings object is what this list is
		// for — not a settings write that forgot the filter.
		const allowed = new Set<string>([]);
		const offenders: string[] = [];
		for (const file of tsFiles('src')) {
			const lines = readFileSync(file, 'utf8').split('\n');
			lines.forEach((line, i) => {
				const trimmed = line.trim();
				// A mention is not a call: a comment about the rule, and the method
				// signature the narrow hosts declare, both name `saveData(` and
				// neither writes anything.
				if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
				if (/saveData\(data:/.test(trimmed)) return;
				if (!/saveData\(/.test(line)) return;
				if (/persistedSettings\(/.test(line)) return;
				const where = `${file}:${i + 1}`;
				if (allowed.has(where)) return;
				offenders.push(`${where}  ${trimmed}`);
			});
		}
		expect(offenders, 'a settings write skipped the runtime-only filter').toEqual([]);
	});
});
