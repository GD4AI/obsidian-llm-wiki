// compat-headers-wire.test.ts — Issue #723
//
// The helper test proves the map is composed correctly; this proves the map is
// actually attached to the outgoing request. Without it, a future refactor could
// stop threading `headers` into `createOpenAICompatible` and every unit test
// would still pass.

import { describe, it, expect, vi } from 'vitest';
import { OpenAICompatSdkClient } from '../../llm-sdk/openai-compat-sdk-client';

interface Captured {
  url: string;
  headers: Record<string, string>;
}

/** Flatten a `Headers` without `entries()`, which the test polyfill omits. */
function flatten(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  // The SDK passes a `Headers` instance; normalise so assertions read the same
  // whichever form a future SDK version chooses.
  new Headers(headers).forEach((value, key) => { out[key] = value; });
  return out;
}

/** Stub fetch that records the request headers and answers with valid usage. */
function capturingFetch(sink: Captured[]): unknown {
  return vi.fn(async (url: string, init?: { headers?: unknown; body?: unknown }) => {
    sink.push({
      url,
      headers: flatten(init?.headers as HeadersInit),
    });
    return new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'm',
      choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
}

describe('OpenAICompatSdkClient — custom headers reach the wire', () => {
  it('sends every composed header on the request', async () => {
    const sink: Captured[] = [];
    const client = new OpenAICompatSdkClient({
      apiKey: 'k',
      baseURL: 'http://localhost/v1/',
      provider: 'custom',
      fetch: capturingFetch(sink) as never,
      headers: { 'User-Agent': 'karpathywiki/9.9.9', 'x-opencode-session': 'sess-1' },
    });

    await client.createMessage({
      model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }],
    });

    expect(sink).toHaveLength(1);
    // `Headers` normalises names to lowercase, so read them that way — an
    // assertion on `User-Agent` would silently pass against `undefined`.
    expect(sink[0].headers['user-agent']).toBe('karpathywiki/9.9.9');
    expect(sink[0].headers['x-opencode-session']).toBe('sess-1');
  });

  it('leaves the request untouched when no headers are supplied', async () => {
    // The regression guard for every provider that never asked for extra
    // headers: adding the feature must not change their request shape.
    const sink: Captured[] = [];
    const client = new OpenAICompatSdkClient({
      apiKey: 'k',
      baseURL: 'http://localhost/v1/',
      provider: 'deepseek',
      fetch: capturingFetch(sink) as never,
    });

    await client.createMessage({
      model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }],
    });

    expect(sink).toHaveLength(1);
    // The SDK's own generic name is what a header-less request carries; the
    // plugin's identity header must NOT appear, or this feature changed
    // behaviour for providers that did not opt in.
    expect(sink[0].headers['x-opencode-session']).toBeUndefined();
    expect(sink[0].headers['user-agent'] ?? '').not.toContain('karpathywiki');
  });

  it('still sends Authorization from the apiKey alongside the custom headers', async () => {
    // `createOpenAICompatible` adds `Authorization` before applying the custom
    // map; if that ordering ever inverted, a user could silently break auth.
    const sink: Captured[] = [];
    const client = new OpenAICompatSdkClient({
      apiKey: 'secret-key',
      baseURL: 'http://localhost/v1/',
      provider: 'custom',
      fetch: capturingFetch(sink) as never,
      headers: { 'X-Extra': 'v' },
    });

    await client.createMessage({
      model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }],
    });

    expect(sink[0].headers.authorization).toBe('Bearer secret-key');
    expect(sink[0].headers['x-extra']).toBe('v');
  });
});
