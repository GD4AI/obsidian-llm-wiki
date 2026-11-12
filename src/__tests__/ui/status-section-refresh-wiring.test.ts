import { describe, expect, it, vi } from 'vitest';

/**
 * One half of the wiring: the status row must hand back a repaint that recomputes
 * its own description. The other half — `markLLMConfigStale` calling it, and only on
 * the ready → stale transition — is in `status-row-readiness-refresh.test.ts`.
 *
 * Together they cover the path a model edit takes. Neither imports the settings tab,
 * because `status-section.ts` imports it as a type only.
 */

const descriptions: string[] = [];

vi.mock('obsidian', () => ({
	Setting: class {
		setName(): this {
			return this;
		}
		setDesc(value: string): this {
			descriptions.push(value);
			return this;
		}
	},
}));

type Host = {
	tempSettings: { llmReady?: boolean };
	plugin: { llmClient: unknown };
	getText(key: string): string;
	isWikiInitialized(): boolean;
	registerStatusRefresh(refresh: () => void): void;
};

describe('renderStatusSection — the row can repaint itself', () => {
	it('registers a repaint that reflects the current readiness', async () => {
		descriptions.length = 0;
		const { renderStatusSection } = await import('../../ui/settings-sections/status-section');

		let repaint: (() => void) | null = null;
		const tab: Host = {
			tempSettings: { llmReady: true },
			plugin: { llmClient: {} },
			getText: (key) => key,
			isWikiInitialized: () => true,
			registerStatusRefresh: (refresh) => {
				repaint = refresh;
			},
		};

		renderStatusSection(tab as never, {} as never);

		expect(repaint, 'the row offered no way to refresh itself').not.toBeNull();
		expect(descriptions[0], 'the first paint says ready').toContain('✅');

		// What `markLLMConfigStale` does before calling it.
		tab.tempSettings.llmReady = false;
		(repaint as unknown as () => void)();

		expect(descriptions.length, 'the row did not repaint').toBe(2);
		expect(descriptions[1], 'the repaint still claims ready').toContain('⚠️');
	});
});
