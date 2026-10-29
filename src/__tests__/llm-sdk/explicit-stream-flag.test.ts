// Issue #916, fix A: a request that asks for a non-streaming answer must
// SAY so on the wire.
//
// The AI SDK omits `stream` on the non-streaming path. That is correct —
// OpenAI's default is `stream: false` — but a gateway that reads
// `body.stream !== false` treats an absent field as a request for a stream
// and answers with an event stream. The SDK then parses that body as JSON,
// the parse fails, and the failure surfaces as `status 200` with the whole
// body in the message (reported on #916 against a 9router gateway).
//
// Sending the field explicitly is spec-compliant for every OpenAI-shaped API
// and removes the ambiguity. The streaming path already sends `stream: true`,
// so a body that already carries the field must be left alone.

import { describe, it, expect } from 'vitest';
import { withExplicitStreamFalse } from '../../llm-sdk/explicit-stream-flag';

interface Captured {
  url: unknown;
  init: unknown;
}

/** A fetch stub that records what it was handed and returns a fixed reply. */
function stubFetch(reply = 'ok'): { fetchImpl: unknown; calls: Captured[] } {
  const calls: Captured[] = [];
  const fetchImpl = async (url: unknown, init?: unknown) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => reply };
  };
  return { fetchImpl, calls };
}

function bodyOf(call: Captured): unknown {
  return (call.init as { body?: unknown } | undefined)?.body;
}

describe('withExplicitStreamFalse', () => {
  it('adds stream:false to a JSON body that has no stream field', async () => {
    const { fetchImpl, calls } = stubFetch();
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;

    await wrapped('https://example.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(JSON.parse(String(bodyOf(calls[0])))).toEqual({
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    });
  });

  it('leaves a body that already says stream:true alone', async () => {
    const { fetchImpl, calls } = stubFetch();
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;

    await wrapped('https://example.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'm', stream: true }),
    });

    expect(JSON.parse(String(bodyOf(calls[0])))).toEqual({ model: 'm', stream: true });
  });

  it('leaves a body that already says stream:false alone', async () => {
    const { fetchImpl, calls } = stubFetch();
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;

    await wrapped('https://example.test/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'm', stream: false }),
    });

    expect(JSON.parse(String(bodyOf(calls[0])))).toEqual({ model: 'm', stream: false });
  });

  it('passes a body that is not JSON through untouched', async () => {
    const { fetchImpl, calls } = stubFetch();
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;
    const raw = 'not json at all';

    await wrapped('https://example.test/v1/chat/completions', { method: 'POST', body: raw });

    expect(bodyOf(calls[0])).toBe(raw);
  });

  it('passes a non-string body through untouched', async () => {
    const { fetchImpl, calls } = stubFetch();
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;
    const bytes = new Uint8Array([1, 2, 3]);

    await wrapped('https://example.test/v1/chat/completions', { method: 'POST', body: bytes });

    expect(bodyOf(calls[0])).toBe(bytes);
  });

  it('passes a JSON array body through untouched', async () => {
    const { fetchImpl, calls } = stubFetch();
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;

    await wrapped('https://example.test/v1/x', { method: 'POST', body: JSON.stringify([1, 2]) });

    expect(JSON.parse(String(bodyOf(calls[0])))).toEqual([1, 2]);
  });

  it('passes a request with no body through untouched', async () => {
    const { fetchImpl, calls } = stubFetch();
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;

    await wrapped('https://example.test/v1/models', { method: 'GET' });

    expect(bodyOf(calls[0])).toBeUndefined();
  });

  it('keeps the other init fields', async () => {
    const { fetchImpl, calls } = stubFetch();
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;

    await wrapped('https://example.test/v1/chat/completions', {
      method: 'POST',
      headers: { 'x-custom': 'v' },
      body: JSON.stringify({ model: 'm' }),
    });

    const init = calls[0].init as { method?: string; headers?: unknown };
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'x-custom': 'v' });
  });

  it('returns whatever the inner fetch returned', async () => {
    const { fetchImpl } = stubFetch('the reply');
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;

    const result = await wrapped('https://example.test/v1', { method: 'POST', body: '{}' }) as { text: () => Promise<string> };

    expect(await result.text()).toBe('the reply');
  });

  it('does not throw when the inner fetch rejects', async () => {
    const fetchImpl = async () => { throw new Error('network down'); };
    const wrapped = withExplicitStreamFalse(fetchImpl) as (u: unknown, i?: unknown) => Promise<unknown>;

    await expect(wrapped('https://example.test/v1', { method: 'POST', body: '{}' })).rejects.toThrow('network down');
  });
});
