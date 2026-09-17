// openai-headers-wire.test.ts — Issue #723
//
// The compat client has an equivalent file; this one covers the *other* path
// that applies custom headers — `OpenAISdkClient`, which `custom-responses`
// routes to. Both clients had to apply headers in a fetch wrapper rather than
// through the provider option, because the SDKs replace a caller-supplied
// `User-Agent` with their own generic name. That makes this file the guard for
// the half of the feature the compat tests cannot see.

import { describe, it, expect, vi } from 'vitest';
import { OpenAISdkClient } from '../../llm-sdk/openai-sdk-client';

interface Captured {
  url: string;
  headers: Record<string, string>;
}

function flatten(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => { out[key] = value; });
  return out;
}

/** Response-shaped body, because this client speaks `/v1/responses`. */
const RESPONSES_BODY = {
  id: 'r', object: 'response', created_at: 0, model: 'm', status: 'completed',
  output: [{
    type: 'message', id: 'msg', role: 'assistant', status: 'completed',
    content: [{ type: 'output_text', text: 'ok', annotations: [] }],
  }],
  usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
};

function capturingFetch(sink: Captured[]): unknown {
  return vi.fn(async (url: string, init?: { headers?: unknown }) => {
    sink.push({ url, headers: flatten(init?.headers as HeadersInit) });
    return new Response(JSON.stringify(RESPONSES_BODY), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  });
}

describe('OpenAISdkClient — custom headers reach the wire', () => {
  it('sends the plugin identity and the user headers on the Responses request', async () => {
    const sink: Captured[] = [];
    const client = new OpenAISdkClient({
      apiKey: 'k',
      baseURL: 'http://localhost/v1/',
      fetch: capturingFetch(sink) as never,
      headers: { 'User-Agent': 'karpathywiki/9.9.9', 'X-Extra': 'v' },
    });

    await client.createMessage({
      model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }],
    });

    expect(sink).toHaveLength(1);
    // The whole point: the SDK would otherwise have replaced this with
    // `ai/<v> ai-sdk/provider-utils/<v> runtime/...`.
    expect(sink[0].headers['user-agent']).toBe('karpathywiki/9.9.9');
    expect(sink[0].headers['x-extra']).toBe('v');
    expect(sink[0].url).toContain('/responses');
  });

  it('still sends Authorization from the apiKey alongside the custom headers', async () => {
    const sink: Captured[] = [];
    const client = new OpenAISdkClient({
      apiKey: 'secret-key',
      baseURL: 'http://localhost/v1/',
      fetch: capturingFetch(sink) as never,
      headers: { 'X-Extra': 'v' },
    });

    await client.createMessage({
      model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }],
    });

    expect(sink[0].headers.authorization).toBe('Bearer secret-key');
  });

  it('leaves the request untouched when no headers are supplied', async () => {
    // The regression guard for the native OpenAI path, which never opted in.
    const sink: Captured[] = [];
    const client = new OpenAISdkClient({
      apiKey: 'k',
      baseURL: 'http://localhost/v1/',
      fetch: capturingFetch(sink) as never,
    });

    await client.createMessage({
      model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }],
    });

    expect(sink).toHaveLength(1);
    expect(sink[0].headers['user-agent'] ?? '').not.toContain('karpathywiki');
  });
});
