// Which transport does the production client actually use? Issue #980.
//
// The unit test beside the bridge proves `streamWithFallback` routes a local URL
// to `window.fetch`. That is not the same claim as "the plugin does", and #981 is
// the reason to say so out loud: a lint snapshot was cited as the guard for about
// 430 moved lines, three mutations passed the full suite, and the guard was
// guarding nothing. A function behaving correctly says nothing about whether
// production calls it.
//
// So this file goes through the real client, takes the `fetch` it hands to the SDK
// factory, and calls it. It asserts nothing about parsing, prompts or models — only
// about which of the two transports a request lands on.
//
// Two facts are pinned, and the second one is the uncomfortable half:
//
//   1. `createMessageStream` on a LAN base URL reaches `window.fetch`, and does not
//      touch `requestUrl`. Before #986 this failed, because `streamWithFallback`
//      returned `requestUrl` for any local URL before trying the browser path.
//   2. `createMessage` — the ingest path — still reaches `requestUrl`. That is not
//      an oversight left unrecorded: it sends `stream: false`, so no bytes cross
//      the connection while the model generates, and no transport choice can fix
//      that. #980 stays open until ingest asks for a stream and consumes one.
//      Asserting it here means the day someone changes it, this test says so
//      instead of the change arriving unannounced.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestUrl } from 'obsidian';

vi.mock('ai', async () => {
	const actual = await vi.importActual<typeof import('ai')>('ai');
	return { ...actual, generateText: vi.fn(), streamText: vi.fn() };
});

vi.mock('@ai-sdk/openai-compatible', async () => {
	const actual = await vi.importActual<typeof import('@ai-sdk/openai-compatible')>(
		'@ai-sdk/openai-compatible'
	);
	return { ...actual, createOpenAICompatible: vi.fn(actual.createOpenAICompatible) };
});

import { generateText, streamText } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { OpenAICompatSdkClient } from '../../llm-sdk/openai-compat-sdk-client';

const mockGenerateText = vi.mocked(generateText);
const mockStreamText = vi.mocked(streamText);
const mockCreateOpenAICompatible = vi.mocked(createOpenAICompatible);
const mockRequestUrl = vi.mocked(requestUrl);

/** A private address of the shape #980 reports: RFC 1918, cleartext, non-default port. */
const LAN = 'http://192.168.1.50:8080/v1';

function client(): OpenAICompatSdkClient {
	// No `fetch` or `streamFetch` override: this file is about the defaults.
	return new OpenAICompatSdkClient({ apiKey: 'test-key', baseURL: LAN, provider: 'custom' });
}

interface ProviderOpts {
	fetch: (url: string, init?: RequestInit) => Promise<Response>;
}

/** The `fetch` the client last handed to the SDK factory. */
function lastFetch(): ProviderOpts['fetch'] {
	const opts = mockCreateOpenAICompatible.mock.calls.at(-1)?.[0] as unknown as ProviderOpts;
	expect(opts?.fetch).toBeTypeOf('function');
	return opts.fetch;
}

beforeEach(() => {
	vi.clearAllMocks();
	// The factory and the SDK calls only have to run far enough for the client to
	// build its provider; the request itself is driven by hand below.
	mockStreamText.mockImplementation(() => {
		throw new Error('the stream is not under test here');
	});
	mockGenerateText.mockRejectedValue(new Error('the generation is not under test here'));
});

describe('the transport the production client reaches (#980)', () => {
	it('sends a streamed call on a LAN base URL through window.fetch', async () => {
		const browserFetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response('ok'));

		await expect(
			client().createMessageStream({
				model: 'local-model',
				max_tokens: 64,
				messages: [{ role: 'user', content: 'hi' }],
				onChunk: () => {},
			})
		).rejects.toThrow();

		// The client built its provider against the LAN address, then the send is
		// performed through the same `fetch` production would use.
		await lastFetch()(`${LAN}/chat/completions`, { method: 'POST', body: '{}' });

		expect(browserFetch).toHaveBeenCalled();
		expect(mockRequestUrl).not.toHaveBeenCalled();
	});

	it('still sends a non-streamed call through requestUrl, which is why #980 is open', async () => {
		// Not a defect this file can fix: `createMessage` asks for `stream: false`,
		// so the server sends nothing until the last token and iOS aborts the idle
		// connection at 60 s. Recorded so a change here is a deliberate act.
		vi.spyOn(window, 'fetch').mockResolvedValue(new Response('ok'));
		mockRequestUrl.mockResolvedValue({
			status: 200,
			text: '{}',
			json: {},
			arrayBuffer: new ArrayBuffer(0),
			headers: {},
		} as never);

		await expect(
			client().createMessage({
				model: 'local-model',
				max_tokens: 64,
				messages: [{ role: 'user', content: 'hi' }],
			})
		).rejects.toThrow();

		await lastFetch()(`${LAN}/chat/completions`, { method: 'POST', body: '{}' });

		expect(mockRequestUrl).toHaveBeenCalled();
	});
});
