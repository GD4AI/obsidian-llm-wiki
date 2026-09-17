// preset-headers-factory-wire.test.ts — Issue #723, review finding 3
//
// The other header tests construct clients directly, so they verify
// `compatHeaders` and the fetch wrapper but **not** the wiring between them.
// @aisahpA measured the consequence: deleting
// `presetHeaders: PREDEFINED_PROVIDERS[provider]?.defaultHeaders` from
// `create-llm-client.ts` left all four header test files green (39/39).
//
// This file drives the real factory instead — `createLLMClientFromSettings` →
// `compatRouteOptions` → the client — so the preset lookup is on the path. It
// mocks the requestUrl bridge rather than injecting a fetch, because the factory
// has no fetch parameter; that mock is the only observation point the production
// call path offers.

import { describe, it, expect, vi } from 'vitest';

const captured = vi.hoisted(() => [] as Array<{ headers: Record<string, string> }>);

vi.mock('../../core/obsidian-fetch-bridge', () => ({
  obsidianFetchBridge: async (_url: string, init?: { headers?: unknown }) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers as HeadersInit).forEach((value, key) => { headers[key] = value; });
    captured.push({ headers });
    return new Response(JSON.stringify({
      id: 'x', object: 'chat.completion', created: 0, model: 'm',
      choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
  // The factory's clients default to this for streaming; nothing here streams.
  streamWithFallback: async () => { throw new Error('streaming not exercised'); },
}));

import { createLLMClientFromSettings } from '../../llm-sdk/create-llm-client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function wireHeaders(provider: string, baseUrl: string, extra: Record<string, unknown> = {}) {
  captured.length = 0;
  const client = await createLLMClientFromSettings({
    provider,
    apiKey: 'test-key',
    baseUrl,
    providerApiKeySecretId: 'karpathywiki-provider-api-key',
    ...extra,
  } as never);
  await client.createMessage({
    model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }],
  } as never);
  expect(captured).toHaveLength(1);
  return captured[0].headers;
}

describe('preset headers reach the wire through the factory (#723)', () => {
  it('sends the opencode preset session id and the plugin identity', async () => {
    const headers = await wireHeaders('opencode', 'https://opencode.ai/zen/go/v1');

    // The mechanism #723 depends on, observed where it is actually assembled.
    expect(headers['x-opencode-session']).toMatch(UUID_RE);
    expect(headers['user-agent']).toBe('karpathywiki/unknown');
  });

  it('gives each client its own session id', async () => {
    // OpenCode uses the id for routing and prompt caching, so two clients that
    // shared one would look like one conversation.
    const first = await wireHeaders('opencode', 'https://opencode.ai/zen/go/v1');
    const second = await wireHeaders('opencode', 'https://opencode.ai/zen/go/v1');
    expect(first['x-opencode-session']).not.toBe(second['x-opencode-session']);
  });

  it('does not send the session header for a provider whose preset omits it', async () => {
    const headers = await wireHeaders('deepseek', 'https://api.deepseek.com/v1');
    expect(headers['x-opencode-session']).toBeUndefined();
    // The identity header IS sent here — deliberately, and contrary to what this
    // suite's sibling tests imply. They construct a client directly and so never
    // see it; in production every compat request carries it.
    expect(headers['user-agent']).toBe('karpathywiki/unknown');
  });

  it('merges the user setting over the preset, through the whole chain', async () => {
    const headers = await wireHeaders('opencode', 'https://opencode.ai/zen/go/v1', {
      customHeaders: 'X-User: from-settings\nUser-Agent: user-agent-wins',
    });
    expect(headers['x-user']).toBe('from-settings');
    expect(headers['user-agent']).toBe('user-agent-wins');
    // The preset's own header survives a user setting that does not name it.
    expect(headers['x-opencode-session']).toMatch(UUID_RE);
  });
});
