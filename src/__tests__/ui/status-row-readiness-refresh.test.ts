import { describe, expect, it, vi } from 'vitest';

/**
 * A model edit invalidates readiness — `setFieldValue` already calls
 * `markLLMConfigStale()` — but the status row is only painted by `display()`, and
 * the model field's `onChange` does not call it. So the state said "not ready"
 * while the row still said "Ready", until something else repainted the tab.
 *
 * Re-rendering the tab would fix the text and break typing: it rebuilds every
 * input, so the field being edited loses focus. The row therefore repaints itself,
 * and only when the value actually changes.
 *
 * The real methods are called on a minimal host rather than a constructed tab: they
 * touch `tempSettings` and `statusRefresh` only, so binding them exercises the
 * shipped code path without dragging in the Obsidian tab lifecycle.
 */

type StaleHost = {
	tempSettings: { llmReady?: boolean };
	statusRefresh: (() => void) | null;
};

function host(ready: boolean): StaleHost {
	return { tempSettings: { llmReady: ready }, statusRefresh: null };
}

async function tabMethods() {
	const { LLMWikiSettingTab } = await import('../../ui/settings');
	const proto = LLMWikiSettingTab.prototype as unknown as {
		markLLMConfigStale(this: StaleHost): void;
		registerStatusRefresh(this: StaleHost, refresh: () => void): void;
	};
	return proto;
}

describe('markLLMConfigStale — the status row follows the state', () => {
	it('repaints the row when readiness goes from ready to stale', async () => {
		const proto = await tabMethods();
		const tab = host(true);
		const refresh = vi.fn();
		proto.registerStatusRefresh.call(tab, refresh);

		proto.markLLMConfigStale.call(tab);

		expect(tab.tempSettings.llmReady).toBe(false);
		expect(refresh, 'the row still showed "Ready"').toHaveBeenCalledTimes(1);
	});

	it('does not repaint again on every later keystroke', async () => {
		// `setFieldValue` calls this on each character. A repaint per keystroke would
		// rewrite the row while the user types; only the transition matters.
		const proto = await tabMethods();
		const tab = host(true);
		const refresh = vi.fn();
		proto.registerStatusRefresh.call(tab, refresh);

		proto.markLLMConfigStale.call(tab);
		proto.markLLMConfigStale.call(tab);
		proto.markLLMConfigStale.call(tab);

		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('does nothing when the row was never rendered', async () => {
		// `display()` clears the handle before rebuilding; a settings write can land
		// in between, and must not throw.
		const proto = await tabMethods();
		const tab = host(true);

		expect(() => proto.markLLMConfigStale.call(tab)).not.toThrow();
		expect(tab.tempSettings.llmReady).toBe(false);
	});
});
