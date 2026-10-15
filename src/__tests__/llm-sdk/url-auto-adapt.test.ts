// URL auto-adaptation for custom Anthropic-compatible endpoints.
//
// The defect this pins, found by hand on 2026-10-15: a user enters
// `https://api.minimaxi.com/anthropic`. `@ai-sdk/anthropic` appends
// `/messages`, so the request goes to `/anthropic/messages` and the server
// answers 404. The correct path is `/anthropic/v1/messages`. Fetch Models
// returns `[]` for Anthropic and so reports nothing; Test Connection passes
// because `createMessage` retries candidate URLs; and a wiki query then fails,
// because the streaming path did not carry the same retry. Measured on the
// plugin's own DIAG logging: `status=404 ok=false ctype=text/plain` on
// `/anthropic/messages`.
//
// Three properties close it. The streaming path must retry the URL candidates
// the way the non-streaming path does. The `/v1` candidate must be among the
// first tried, because it is the one that works for every Anthropic-compatible
// gateway. And the resolved URL must land in the cache, because that is what
// the settings panel reads back to tell the user what was actually used.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: vi.fn(), streamText: vi.fn() };
});

import { streamText, generateText } from 'ai';
import { AnthropicSdkClient } from '../../llm-sdk/anthropic-sdk-client';
import { getCachedUrl, invalidateCache, generateUrlCandidates } from '../../core/url-fallback';

const mockStreamText = vi.mocked(streamText);
const mockGenerateText = vi.mocked(generateText);

function streamResult(text: string): ReturnType<typeof streamText> {
  return {
    textStream: (async function* () { yield text; })(),
    text: Promise.resolve(text),
  } as unknown as ReturnType<typeof streamText>;
}

function http404(url: string): Error {
  const e = new Error(`404 Not Found: ${url}`);
  (e as Error & { statusCode?: number }).statusCode = 404;
  (e as Error & { responseBody?: string }).responseBody = 'Not Found';
  return e;
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCache();
});

describe('generateUrlCandidates for an Anthropic gateway', () => {
  it('offers the /v1 variant and does not bury it behind look-alikes', () => {
    const c = generateUrlCandidates('https://api.minimaxi.com/anthropic');
    expect(c).toContain('https://api.minimaxi.com/anthropic/v1');
    // The working candidate must be reachable in the first two tries. A list
    // that finds it only after three wrong ones costs the user three 404s.
    expect(c.slice(0, 2)).toContain('https://api.minimaxi.com/anthropic/v1');
  });

  it('does not add /v1 when the URL already carries it', () => {
    const c = generateUrlCandidates('https://api.minimaxi.com/anthropic/v1');
    expect(c).toEqual(['https://api.minimaxi.com/anthropic/v1']);
  });
});

describe('streaming path retries the URL candidates', () => {
  it('recovers from a 404 on the bare URL and uses the /v1 form', async () => {
    const client = new AnthropicSdkClient({
      apiKey: 'k',
      baseURL: 'https://api.minimaxi.com/anthropic',
      fetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as never,
      streamFetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as never,
    });

    // probeBaseURL drives resolution through generateText; wire it so the
    // bare URL fails and the /v1 form works, exactly as the gateway does.
    mockGenerateText.mockImplementation(((args: { model: { config?: { baseURL?: string } } }) => {
      const u = args?.model?.config?.baseURL ?? '';
      return u.includes('/anthropic/v1')
        ? Promise.resolve({ text: 'ok', finishReason: 'stop' })
        : Promise.reject(http404(`${u}/messages`));
    }) as unknown as typeof generateText);

    // First stream call: the bare URL 404s. Every later call succeeds.
    let calls = 0;
    mockStreamText.mockImplementation(((args: { model: { config?: { baseURL?: string } } }) => {
      calls += 1;
      const url = args?.model?.config?.baseURL ?? '';
      if (url.includes('/anthropic/v1')) return streamResult('answer');
      throw http404(`${url}/messages`);
    }) as unknown as typeof streamText);

    const out = await client.createMessageStream({
      model: 'm',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'q' }],
      onChunk: () => {},
    });

    expect(out).toBe('answer');
    expect(calls).toBeGreaterThan(1);
  });

  it('caches the resolved URL so the next call skips the 404', async () => {
    const client = new AnthropicSdkClient({
      apiKey: 'k',
      baseURL: 'https://api.minimaxi.com/anthropic',
      fetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as never,
      streamFetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as never,
    });

    mockGenerateText.mockImplementation(((args: { model: { config?: { baseURL?: string } } }) => {
      const u = args?.model?.config?.baseURL ?? '';
      return u.includes('/anthropic/v1')
        ? Promise.resolve({ text: 'ok', finishReason: 'stop' })
        : Promise.reject(http404(`${u}/messages`));
    }) as unknown as typeof generateText);

    let calls = 0;
    mockStreamText.mockImplementation(((args: { model: { config?: { baseURL?: string } } }) => {
      calls += 1;
      const url = args?.model?.config?.baseURL ?? '';
      if (url.includes('/anthropic/v1')) return streamResult('answer');
      throw http404(`${url}/messages`);
    }) as unknown as typeof streamText);

    await client.createMessageStream({ model: 'm', max_tokens: 100, messages: [{ role: 'user', content: 'q' }], onChunk: () => {} });
    expect(getCachedUrl('https://api.minimaxi.com/anthropic')).toBe('https://api.minimaxi.com/anthropic/v1');

    const before = calls;
    await client.createMessageStream({ model: 'm', max_tokens: 100, messages: [{ role: 'user', content: 'q' }], onChunk: () => {} });
    // The cache was read: the second call should not repeat the 404 cycle.
    expect(calls).toBe(before + 1);
  });
});

describe('non-streaming path already retried; it must stay so', () => {
  it('recovers from a 404 on the bare URL', async () => {
    const client = new AnthropicSdkClient({
      apiKey: 'k',
      baseURL: 'https://api.minimaxi.com/anthropic',
      fetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as never,
      streamFetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as never,
    });

    mockGenerateText.mockImplementation(((args: { model: { config?: { baseURL?: string } } }) => {
      const url = args?.model?.config?.baseURL ?? '';
      if (url.includes('/anthropic/v1')) return Promise.resolve({ text: 'answer', finishReason: 'stop' });
      return Promise.reject(http404(`${url}/messages`));
    }) as unknown as typeof generateText);

    const out = await client.createMessage({ model: 'm', max_tokens: 100, messages: [{ role: 'user', content: 'q' }] });
    expect(out).toBe('answer');
    expect(getCachedUrl('https://api.minimaxi.com/anthropic')).toBe('https://api.minimaxi.com/anthropic/v1');
  });
});

describe('the URL probe must not assume an Anthropic model id', () => {
  it('probes with the caller model so non-Anthropic gateways can answer', async () => {
    const client = new AnthropicSdkClient({
      apiKey: 'k',
      baseURL: 'https://api.minimaxi.com/anthropic',
      fetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as never,
      streamFetch: (() => Promise.resolve(new Response('{}', { status: 200 }))) as never,
    });

    // The gateway knows only `MiniMax-M3.1-Flash-Preview`. Every other model
    // id answers "model not found" on every path, so a probe that names
    // `claude-haiku-4-5` can never confirm a URL — the candidate list is
    // rejected wholesale and the 404 the user first saw is what surfaces.
    const seenModels: string[] = [];
    mockGenerateText.mockImplementation(((args: { model: { config?: { baseURL?: string } }; prompt?: unknown }) => {
      const u = args?.model?.config?.baseURL ?? '';
      const anyArgs = args as unknown as { model?: unknown };
      const modelObj = anyArgs?.model as { modelId?: string } | undefined;
      seenModels.push(modelObj?.modelId ?? String(modelObj ?? ''));
      const modelOk = seenModels[seenModels.length - 1] === 'MiniMax-M3.1-Flash-Preview';
      if (u.includes('/anthropic/v1') && modelOk) return Promise.resolve({ text: 'ok', finishReason: 'stop' });
      return Promise.reject(http404(`${u}/messages`));
    }) as unknown as typeof generateText);

    mockStreamText.mockImplementation(((args: { model: { config?: { baseURL?: string } } }) => {
      const u = args?.model?.config?.baseURL ?? '';
      if (u.includes('/anthropic/v1')) return streamResult('answer');
      throw http404(`${u}/messages`);
    }) as unknown as typeof streamText);

    const out = await client.createMessageStream({
      model: 'MiniMax-M3.1-Flash-Preview',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'q' }],
      onChunk: () => {},
    });
    expect(out).toBe('answer');
    expect(seenModels.some(m => m.includes('claude-haiku'))).toBe(false);
  });
});
