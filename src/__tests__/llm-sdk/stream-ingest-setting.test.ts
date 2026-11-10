// The `streamIngest` setting (#980): one policy, three values, one place.
//
// The defect this guards against is not a wrong branch, it is a setting that
// exists and never reaches the decision. That is the #974 shape: a surface that
// looks like control and changes nothing. So half of this file drives the policy
// and the other half proves the wiring — the factory sets it, the panel offers it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Platform } from 'obsidian';

vi.mock('ai', async () => {
	const actual = await vi.importActual<typeof import('ai')>('ai');
	return {
		...actual,
		generateText: vi.fn(),
		streamText: vi.fn(),
	};
});

import { generateText, streamText } from 'ai';
import {
	generateBuffered,
	shouldStreamForSilence,
	setStreamIngestMode,
} from '../../llm-sdk/buffered-generation';

const mockGenerateText = vi.mocked(generateText);
const mockStreamText = vi.mocked(streamText);

describe('shouldStreamForSilence — three values (#980)', () => {
	it('auto follows the platform', () => {
		expect(shouldStreamForSilence(true, 'auto')).toBe(true);
		expect(shouldStreamForSilence(false, 'auto')).toBe(false);
	});

	it('always streams on desktop, where the platform would not', () => {
		// The escape hatch for a slow local model behind a proxy with its own
		// idle timeout. Without it, desktop has no way to avoid that cut.
		expect(shouldStreamForSilence(false, 'always')).toBe(true);
	});

	it('never streams on mobile, and that is a real trade', () => {
		// Metered data. The cost is stated in the setting's own description: a
		// long call on mobile will fail, because nothing keeps the connection busy.
		expect(shouldStreamForSilence(true, 'never')).toBe(false);
	});

	it('falls back to auto for an unknown value', () => {
		// Settings are read from JSON a user can edit. An unreadable value must not
		// leave the plugin in a state where `always` or `never` is guessed.
		expect(shouldStreamForSilence(false, 'sometimes' as never)).toBe(false);
		expect(shouldStreamForSilence(true, undefined as never)).toBe(true);
	});
});

describe('the policy reaches generateBuffered (#980)', () => {
	beforeEach(() => {
		mockGenerateText.mockReset();
		mockStreamText.mockReset();
		mockGenerateText.mockResolvedValue({ text: 'buffered', finishReason: 'stop', usage: {}, finalStep: {} } as never);
		mockStreamText.mockReturnValue({
			text: Promise.resolve('streamed'),
			finishReason: Promise.resolve('stop'),
			usage: Promise.resolve({}),
			finalStep: Promise.resolve({}),
		} as never);
	});

	afterEach(() => {
		setStreamIngestMode(undefined);
	});

	it('honours a mode set from settings, with no per-call argument', () => {
		// This is the path production uses: the factory sets the mode once and the
		// fifteen call sites pass nothing.
		const before = Platform.isMobile;
		Platform.isMobile = false;
		try {
			setStreamIngestMode('always');
			return generateBuffered({ model: 'm' } as never).then(() => {
				expect(mockStreamText).toHaveBeenCalledTimes(1);
				expect(mockGenerateText).not.toHaveBeenCalled();
			});
		} finally {
			Platform.isMobile = before;
		}
	});

	it('buffers on desktop under auto', async () => {
		const before = Platform.isMobile;
		Platform.isMobile = false;
		try {
			setStreamIngestMode('auto');
			await generateBuffered({ model: 'm' } as never);
			expect(mockGenerateText).toHaveBeenCalledTimes(1);
			expect(mockStreamText).not.toHaveBeenCalled();
		} finally {
			Platform.isMobile = before;
		}
	});
});

describe('the setting is wired, not just stored (#980)', () => {
	const ROOT = join(__dirname, '..', '..', '..');

	it('the client factory passes the setting to the policy', () => {
		// A setting that is saved and never read is the defect this asserts against.
		const source = readFileSync(join(ROOT, 'src', 'llm-sdk', 'create-llm-client.ts'), 'utf8');
		expect(source).toContain('setStreamIngestMode(settings.streamIngest)');
	});

	it('the settings panel offers all three values', () => {
		const source = readFileSync(
			join(ROOT, 'src', 'ui', 'settings-sections', 'advanced-settings-section.ts'),
			'utf8',
		);
		expect(source).toContain("addOption('auto'");
		expect(source).toContain("addOption('always'");
		expect(source).toContain("addOption('never'");
		// Stored as `auto` when the user picks anything unrecognised, because the
		// stored value is read back by a policy that must not need a second guard.
		expect(source).toContain("value === 'always' || value === 'never' ? value : 'auto'");
	});
});
