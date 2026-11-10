// `generateBuffered` — one call shape, two transports. Issue #980.
//
// The module's job is narrow and worth pinning precisely: a caller passes the
// same argument object it would pass to `generateText`, and gets back the same
// four fields it reads, whether the request went out streamed or buffered.
//
// What would go wrong without these tests, in the order it would go wrong:
//
//   1. The streamed branch could lose `usage` or `finishReason`, and truncation
//      detection (#912, #970) would silently stop working. That is worse than the
//      60 s failure this module exists to remove, because it fails quietly.
//   2. `output` could be read unconditionally. The SDK throws when the field is
//      read without a specification, so the buffered path would start failing on
//      calls that work today.
//   3. The policy could drift. Streaming is only worth its ~60× byte cost where
//      the platform cuts an idle connection, and desktop has no such limit.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Platform } from 'obsidian';

vi.mock('ai', async () => {
	const actual = await vi.importActual<typeof import('ai')>('ai');
	return { ...actual, generateText: vi.fn(), streamText: vi.fn() };
});

import { generateText, streamText, NoOutputGeneratedError } from 'ai';
import { generateBuffered, shouldStreamForSilence } from '../../llm-sdk/buffered-generation';
import { extractResultReasoning } from '../../llm-sdk/finish-reason';

const mockGenerateText = vi.mocked(generateText);
const mockStreamText = vi.mocked(streamText);

const USAGE = { inputTokens: 11, outputTokens: 22, totalTokens: 33 };

interface FakeResult {
	text: string;
	finishReason: string;
	usage: typeof USAGE;
	finalStep: { reasoningText?: string };
	output: unknown;
}

/**
 * A result whose `output` getter throws, the way the SDK's does when no
 * specification was passed. Reading it is the failure mode test 3 rules out.
 */
function bufferedResult(overrides: Partial<FakeResult> = {}): FakeResult {
	return {
		text: 'the answer',
		finishReason: 'stop',
		usage: USAGE,
		finalStep: {},
		get output(): unknown {
			throw new Error('output was read without a specification');
		},
		...overrides,
	} as FakeResult;
}

/** The streamed shape: every field a promise, as `StreamTextResult` provides. */
function streamedResult(overrides: Partial<FakeResult> = {}): Record<string, Promise<unknown>> {
	const base = {
		text: 'the answer',
		finishReason: 'stop',
		usage: USAGE,
		finalStep: {},
		output: undefined,
		...overrides,
	} as FakeResult;
	return {
		text: Promise.resolve(base.text),
		finishReason: Promise.resolve(base.finishReason),
		usage: Promise.resolve(base.usage),
		finalStep: Promise.resolve(base.finalStep),
		get output(): Promise<unknown> {
			if (!('output' in overrides)) {
				return Promise.reject(new Error('output was read without a specification'));
			}
			return Promise.resolve(base.output);
		},
	};
}

const ARGS = { model: 'model' as never, messages: [] as never, maxOutputTokens: 64 };

beforeEach(() => {
	vi.clearAllMocks();
	Platform.isMobile = false;
});

afterEach(() => {
	Platform.isMobile = false;
});

describe('generateBuffered — the buffered transport', () => {
	it('uses generateText and returns the four fields the callers read', async () => {
		mockGenerateText.mockResolvedValue(bufferedResult() as never);

		const result = await generateBuffered(ARGS, { stream: false });

		expect(mockGenerateText).toHaveBeenCalledTimes(1);
		expect(mockStreamText).not.toHaveBeenCalled();
		expect(result.text).toBe('the answer');
		expect(result.finishReason).toBe('stop');
		expect(result.usage).toEqual(USAGE);
	});

	it('keeps generateText\'s output contract: reading it without a specification throws', async () => {
		// The callers that matter rely on this. Two sites catch the throw and
		// recover the answer from the reasoning channel (#443), so returning
		// `undefined` here would move the throw out of their `try`/`catch` and
		// lose the recovery. The fake's getter throws, exactly like the SDK's.
		mockGenerateText.mockResolvedValue(bufferedResult() as never);

		const result = await generateBuffered(ARGS, { stream: false });

		expect(() => result.output).toThrow('output was read without a specification');
	});

	it('returns output when a specification was passed', async () => {
		const parsed = { title: 'Mutex' };
		mockGenerateText.mockResolvedValue(
			bufferedResult({ output: parsed } as Partial<FakeResult>) as never
		);

		const result = await generateBuffered(
			{ ...ARGS, output: { spec: true } } as never,
			{ stream: false }
		);

		expect(result.output).toEqual(parsed);
	});
});

describe('generateBuffered — the streamed transport', () => {
	it('uses streamText and resolves the same fields from promises', async () => {
		mockStreamText.mockReturnValue(streamedResult() as never);

		const result = await generateBuffered(ARGS, { stream: true });

		expect(mockStreamText).toHaveBeenCalledTimes(1);
		expect(mockGenerateText).not.toHaveBeenCalled();
		expect(result.text).toBe('the answer');
		expect(result.finishReason).toBe('stop');
		expect(result.usage).toEqual(USAGE);
	});

	it('does not parse output when the caller passed no specification, and says so on read', async () => {
		// Two properties at once. The stream is not rejected, so `output` was not
		// awaited; and reading the field still throws, so a caller expecting
		// structured output cannot mistake `undefined` for a parsed result.
		mockStreamText.mockReturnValue(streamedResult() as never);

		const result = await generateBuffered(ARGS, { stream: true });

		expect(result.text).toBe('the answer');
		expect(() => result.output).toThrow(NoOutputGeneratedError);
	});

	it('awaits output when a specification was passed', async () => {
		const parsed = { title: 'Mutex' };
		mockStreamText.mockReturnValue(streamedResult({ output: parsed }) as never);

		const result = await generateBuffered(
			{ ...ARGS, output: { spec: true } } as never,
			{ stream: true }
		);

		expect(result.output).toEqual(parsed);
	});

	it('passes the argument object through unchanged', async () => {
		// The point of one module instead of four: no translation, so no caller can
		// pass options only one of the two functions understands.
		mockStreamText.mockReturnValue(streamedResult() as never);
		const args = { ...ARGS, system: 'be terse', maxOutputTokens: 7 } as never;

		await generateBuffered(args, { stream: true });

		expect(mockStreamText.mock.calls[0][0]).toBe(args);
	});
});

describe('generateBuffered — the silence policy', () => {
	it('streams by default on mobile, and not on desktop', async () => {
		mockStreamText.mockReturnValue(streamedResult() as never);
		mockGenerateText.mockResolvedValue(bufferedResult() as never);

		Platform.isMobile = true;
		await generateBuffered(ARGS);
		expect(mockStreamText).toHaveBeenCalledTimes(1);

		vi.clearAllMocks();
		Platform.isMobile = false;
		await generateBuffered(ARGS);
		expect(mockGenerateText).toHaveBeenCalledTimes(1);
		expect(mockStreamText).not.toHaveBeenCalled();
	});

	it('reads the platform, and nothing else', () => {
		expect(shouldStreamForSilence(true)).toBe(true);
		expect(shouldStreamForSilence(false)).toBe(false);
	});
});

describe('generateBuffered — the reasoning channel survives', () => {
	it('carries finalStep so extractResultReasoning still finds the rescue text', async () => {
		// #443: several backends put the answer in `reasoning_content` and leave
		// `content` empty. That rescue reads `finalStep`, so losing the field would
		// disable it silently — and only on the streamed path.
		mockStreamText.mockReturnValue(
			streamedResult({ finalStep: { reasoningText: 'the reasoning answer' } }) as never
		);

		const result = await generateBuffered(ARGS, { stream: true });

		expect(await extractResultReasoning(result)).toBe('the reasoning answer');
	});
});

// A helper nobody calls is not a fix. This reads the production tree, so the next
// call site added to any SDK client cannot bypass the platform decision — the
// defect in #980 was exactly that: eleven call sites that buffered on every
// platform because nothing said they could not.
describe('no SDK client bypasses the platform decision (#980)', () => {
	const SDK_DIR = join(__dirname, '..', '..', 'llm-sdk');
	const EXEMPT = new Set(['buffered-generation.ts']);

	const isCode = (line: string): boolean => {
		const trimmed = line.trimStart();
		return !trimmed.startsWith('//') && !trimmed.startsWith('*');
	};

	it('calls generateBuffered rather than generateText anywhere in src/llm-sdk', () => {
		// Lines only. Two files carry a `generateText` example in a doc comment, and
		// a net that cannot tell prose from code reports a defect that is not there.
		const callers = readdirSync(SDK_DIR)
			.filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts') && !EXEMPT.has(name))
			.filter(name =>
				readFileSync(join(SDK_DIR, name), 'utf8')
					.split('\n')
					.some(line => isCode(line) && /\bawait generateText\(/.test(line)),
			);

		expect(callers).toEqual([]);
	});

	it('keeps streamText direct, because a stream is already not silent', () => {
		// The rule above is about buffered calls only. Exempting the streaming
		// paths too would flag the one transport that needs no help.
		const streaming = readFileSync(join(SDK_DIR, 'openai-sdk-client.ts'), 'utf8');
		expect(streaming).toMatch(/\.textStream\b/);
	});
});
