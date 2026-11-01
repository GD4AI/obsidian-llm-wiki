// Issue #916 end-to-end: the three fixes, exercised through the real client.
//
// The unit tests cover the three helpers. This file covers the wiring: a
// request that leaves the client must carry `stream: false`, a body the SDK
// cannot parse must produce a readable message, and an empty stream must
// raise instead of returning an empty string.
//
// The scenario is the one from #916 — a gateway that answers a non-streaming
// request with an event stream — reproduced byte for byte from the report.

import { describe, it, expect } from 'vitest';
import { OpenAICompatSdkClient } from '../../llm-sdk/openai-compat-sdk-client';

const HYBRID_BODY = '{"id":"chatcmpl-a54ebcca-1d57-4ab4-bccf-298c5531e146","choices":[{"index":0,"message":{"content":"Connection successful.","role":"assistant","reasoning_content":"The user has sent a very simple test message."},"finish_reason":"stop","logprobs":null}],"created":1793239401,"model":"z-ai/glm-5.3-flash","service_tier":null,"system_fingerprint":null,"object":"chat.completion","usage":{"prompt_tokens":21,"completion_tokens":166,"total_tokens":187,"prompt_tokens_details":{"audio_tokens":null,"cached_tokens":0},"completion_tokens_details":{"accepted_prediction_tokens":null,"audio_tokens":null,"reasoning_tokens":162,"rejected_prediction_tokens":null}}}data: [DONE]';

const PURE_BODY = '{"id":"chatcmpl-x","choices":[{"index":0,"message":{"content":"Connection successful.","role":"assistant"},"finish_reason":"stop"}],"created":1793239401,"model":"z-ai/glm-5.3-flash","object":"chat.completion","usage":{"prompt_tokens":21,"completion_tokens":166,"total_tokens":187}}';

/** A fetch stub that records the request bodies it was handed. */
function stubFetch(reply: () => Response): { fetchImpl: unknown; bodies: string[] } {
  const bodies: string[] = [];
  const fetchImpl = async (_url: unknown, init?: { body?: unknown }) => {
    bodies.push(String(init?.body ?? ''));
    return reply();
  };
  return { fetchImpl, bodies };
}

function client(fetchImpl: unknown): OpenAICompatSdkClient {
  return new OpenAICompatSdkClient({
    apiKey: 'test-key',
    baseURL: 'http://localhost:20128/v1',
    provider: 'custom',
    fetch: fetchImpl as never,
  });
}

describe('#916 end-to-end through the client', () => {
  it('a non-streaming request carries stream:false on the wire', async () => {
    const { fetchImpl, bodies } = stubFetch(() => new Response(PURE_BODY, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const text = await client(fetchImpl).createMessage({
      model: 'z-ai/glm-5.3-flash',
      max_tokens: 2000,
      messages: [{ role: 'user', content: 'Test connection. Please reply "Connection successful".' }],
    });

    expect(text).toBe('Connection successful.');
    const sent = JSON.parse(bodies[0]) as Record<string, unknown>;
    expect(sent.stream).toBe(false);
  });

  it('a body the SDK cannot parse produces a readable message, not "status 200"', async () => {
    const { fetchImpl } = stubFetch(() => new Response(HYBRID_BODY, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    let message = '';
    try {
      await client(fetchImpl).createMessage({
        model: 'z-ai/glm-5.3-flash',
        max_tokens: 2000,
        messages: [{ role: 'user', content: 'Test connection.' }],
      });
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).not.toBe('');
    expect(message).not.toContain('status 200');
    expect(message.toLowerCase()).toContain('body');
    // the whole 725-character body must not be pasted into the UI
    expect(message.length).toBeLessThan(600);
  });

  it('the status code survives the rewrite — the URL fallback reads it', async () => {
    const { fetchImpl } = stubFetch(() => new Response(HYBRID_BODY, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    let statusCode: number | undefined;
    try {
      await client(fetchImpl).createMessage({
        model: 'z-ai/glm-5.3-flash',
        max_tokens: 2000,
        messages: [{ role: 'user', content: 'Test connection.' }],
      });
    } catch (err) {
      statusCode = (err as { statusCode?: number }).statusCode;
    }

    expect(statusCode).toBe(200);
  });
});

describe('#916 — the empty-answer guard and its one exemption', () => {
  it('raises on an empty answer by default', async () => {
    const { fetchImpl } = stubFetch(() => new Response(
      '{"id":"x","choices":[{"index":0,"message":{"content":"","role":"assistant"},"finish_reason":"stop"}],"created":1,"model":"m","object":"chat.completion","usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}',
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));

    await expect(client(fetchImpl).createMessage({
      model: 'm',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toThrow(/empty/i);
  });

  it('returns the empty string when the caller asks for it', async () => {
    const { fetchImpl } = stubFetch(() => new Response(
      '{"id":"x","choices":[{"index":0,"message":{"content":"","role":"assistant"},"finish_reason":"stop"}],"created":1,"model":"m","object":"chat.completion","usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}',
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));

    const text = await client(fetchImpl).createMessage({
      model: 'm',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
      allowEmptyResponse: true,
    });

    expect(text).toBe('');
  });
});
