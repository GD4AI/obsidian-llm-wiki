import { describe, expect, it, vi } from 'vitest';
import { createCodexRequestFetch, OpenAICodexSdkClient } from '../../../llm-sdk/openai-codex-sdk-client';
import { errorResponse, fakeAuthManager, messageParams, textResponse } from '../openai-codex-test-helpers';
import { requestUrl } from 'obsidian';

function streamingResponse(chunks: string[]): Response {
  const events = [{ type: 'response.created', response: { id: 'resp-stream', created_at: 1, model: 'gpt-5.5' } }, ...chunks.map((delta) => ({ type: 'response.output_text.delta', item_id: 'item-1', delta })), { type: 'response.completed', response: { usage: { input_tokens: 1, output_tokens: chunks.length }, service_tier: null } }];
  return new Response(`${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

// The Responses wire carries the system prompt as the leading `developer`
// entry of `input`, not as a top-level field.
function developerMessage(body: Record<string, unknown>): string {
  const input = body.input as { role: string; content: unknown }[] | undefined;
  const developer = input?.find(entry => entry.role === 'developer');
  return typeof developer?.content === 'string' ? developer.content : '';
}

describe('OpenAICodexSdkClient', () => {
  it('uses the required streaming transport for non-streaming callers', async () => {
    const auth = fakeAuthManager();
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => streamingResponse(['hel', 'lo']));
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-required-stream', version: '1.25.0' });
    await expect(client.createMessage(messageParams())).resolves.toBe('hello');
    const init = fetchFn.mock.calls[0]?.[1];
    if (typeof init?.body !== 'string') throw new Error('Expected a string body');
    expect(JSON.parse(init.body) as unknown).toMatchObject({ stream: true, store: false });
  });
  it('uses one reliable Obsidian transport without attempting a second Codex POST', async () => {
    const auth = fakeAuthManager();
    const networkFetch = vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('connection lost'));
    vi.mocked(requestUrl).mockResolvedValue({ status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0), json: {}, text: 'fallback response' });
    const client = new OpenAICodexSdkClient({ auth, sessionId: () => 'session-no-replay', version: '1.25.0' });
    // Issue #916: this reply carries no text, and the empty-answer guard now
    // says so instead of resolving to `''`. What this case is actually about is
    // the transport, so the assertions below are the point.
    await expect(client.createMessage(messageParams())).rejects.toThrow(/empty/i);
    expect(networkFetch).not.toHaveBeenCalled();
    expect(requestUrl).toHaveBeenCalledOnce();
    networkFetch.mockRestore();
  });
  it('returns AI SDK text and sends normalized Codex requests', async () => {
    const auth = fakeAuthManager();
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => streamingResponse(['hello']));
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-1', version: '1.24.1' });
    await expect(client.createMessage({ ...messageParams(), temperature: 0.3 })).resolves.toBe('hello');
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    const headers = new Headers(init?.headers);
    if (typeof init?.body !== 'string') throw new Error('Expected a string body');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(url).toBe('https://chatgpt.com/backend-api/codex/responses');
    expect(headers.get('Authorization')).toBe('Bearer access');
    expect(headers.get('ChatGPT-Account-Id')).toBe('acct-1');
    expect(headers.get('session-id')).toBe('session-1');
    expect(body.model).toBe('gpt-5.5');
    expect(body.input).toBeDefined();
    expect(body.store).toBe(false);
    expect(body.max_output_tokens).toBeUndefined();
    expect(body.temperature).toBeUndefined();
  });
  it('requests JSON object output while preserving the returned JSON text', async () => {
    const auth = fakeAuthManager();
    let requestBody: Record<string, unknown> = {};
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Expected a string body');
      requestBody = JSON.parse(init.body) as Record<string, unknown>;
      return streamingResponse(['{"ok":true}']);
    });
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-json', version: '1.24.1' });
    await expect(client.createMessage({ ...messageParams(), response_format: { type: 'json_object' } })).resolves.toBe('{"ok":true}');
    expect(requestBody.text).toEqual({ format: { type: 'json_object' } });
  });
  // #525 review: the per-step policy from #524 pins `extract` to text mode,
  // but this client never read `outputModeOverride` — so the one provider
  // that routes through it kept the JSON output shape the issue was about,
  // and `Output.json()` also routes the reply around the plugin's own JSON
  // repair. Pinned text mode must drop the format and carry the instruction
  // in the system prompt instead, as the openai-compat client does.
  it('honours a text_prompt pin: no JSON format on the wire, enforcement in the system prompt', async () => {
    const auth = fakeAuthManager();
    let requestBody: Record<string, unknown> = {};
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Expected a string body');
      requestBody = JSON.parse(init.body) as Record<string, unknown>;
      return streamingResponse(['{"ok":true}']);
    });
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-pin', version: '1.24.1' });
    await expect(client.createMessage({
      ...messageParams(),
      system: 'You extract entities.',
      response_format: { type: 'json_object' },
      outputModeOverride: 'text_prompt',
    })).resolves.toBe('{"ok":true}');
    expect(requestBody.text).toBeUndefined();
    expect(developerMessage(requestBody)).toContain('single valid JSON object');
    expect(developerMessage(requestBody)).toContain('You extract entities.');
  });

  it('leaves the JSON format alone when no mode is pinned', async () => {
    const auth = fakeAuthManager();
    let requestBody: Record<string, unknown> = {};
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Expected a string body');
      requestBody = JSON.parse(init.body) as Record<string, unknown>;
      return streamingResponse(['{"ok":true}']);
    });
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-unpinned', version: '1.24.1' });
    await expect(client.createMessage({
      ...messageParams(),
      system: 'You extract entities.',
      response_format: { type: 'json_object' },
    })).resolves.toBe('{"ok":true}');
    expect(requestBody.text).toEqual({ format: { type: 'json_object' } });
    expect(developerMessage(requestBody)).not.toContain('single valid JSON object');
  });

  it('forwards only streamed text chunks and returns their concatenation', async () => {
    const auth = fakeAuthManager();
    const fetchFn = vi.fn(async () => streamingResponse(['hel', 'lo']));
    const onChunk = vi.fn();
    const client = new OpenAICodexSdkClient({ auth, fetch: vi.fn(), streamFetch: fetchFn, sessionId: () => 'session-stream', version: '1.24.1' });
    await expect(client.createMessageStream({ ...messageParams(), max_tokens: 100, onChunk })).resolves.toBe('hello');
    expect(onChunk.mock.calls).toEqual([['hel'], ['lo']]);
    expect(fetchFn).toHaveBeenCalledOnce();
  });
  it('refreshes once after a 401 and replays the request with new access', async () => {
    const auth = fakeAuthManager();
    const sessionId = vi.fn().mockReturnValueOnce('session-1').mockReturnValueOnce('session-2');
    let attempt = 0;
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => {
      attempt += 1;
      return attempt === 1 ? errorResponse(401) : streamingResponse(['ok']);
    });
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId, version: '1.24.1' });
    await expect(client.createMessage(messageParams())).resolves.toBe('ok');
    expect(auth.refreshAfterUnauthorized).toHaveBeenCalledOnce();
    expect(auth.refreshAfterUnauthorized).toHaveBeenCalledWith('access', 401);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchFn.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer access');
    expect(new Headers(fetchFn.mock.calls[1][1]?.headers).get('Authorization')).toBe('Bearer refreshed-access');
    expect(new Headers(fetchFn.mock.calls[0][1]?.headers).get('session-id')).toBe('session-1');
    expect(new Headers(fetchFn.mock.calls[1][1]?.headers).get('session-id')).toBe('session-1');
    expect(sessionId).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[1][1]?.body).toBe(fetchFn.mock.calls[0][1]?.body);
  });
  it('cancels an unread 401 body before refreshing and replaying', async () => {
    const auth = fakeAuthManager();
    const cancel = vi.fn();
    const unauthorized = new Response(new ReadableStream<Uint8Array>({ cancel }), { status: 401 });
    let attempt = 0;
    const fetchImpl = vi.fn(async () => {
      attempt += 1;
      return attempt === 1 ? unauthorized : textResponse('ok');
    });
    const fetchFn = createCodexRequestFetch({ auth, fetchImpl, sessionId: () => 'session-cancel', version: '1.24.1' });
    await expect(fetchFn('https://api.openai.com/v1/responses', { method: 'POST', body: '{}' })).resolves.toHaveProperty('status', 200);
    expect(cancel).toHaveBeenCalledOnce();
    expect(auth.refreshAfterUnauthorized).toHaveBeenCalledOnce();
  });
  it('tolerates null and already-consumed 401 bodies', async () => {
    const consumed = errorResponse(401);
    await consumed.text();
    for (const unauthorized of [new Response(null, { status: 401 }), consumed]) {
      const auth = fakeAuthManager();
      let attempt = 0;
      const fetchImpl = vi.fn(async () => {
        attempt += 1;
        return attempt === 1 ? unauthorized : textResponse('ok');
      });
      const fetchFn = createCodexRequestFetch({ auth, fetchImpl, sessionId: () => 'session-consumed', version: '1.24.1' });
      await expect(fetchFn('https://api.openai.com/v1/responses', { method: 'POST', body: '{}' })).resolves.toHaveProperty('status', 200);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });
  it('does not refresh when the request signal is already aborted', async () => {
    const auth = fakeAuthManager();
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => errorResponse(401));
    const fetchFn = createCodexRequestFetch({ auth, fetchImpl, sessionId: () => 'session-aborted', version: '1.24.1' });
    await expect(fetchFn('https://api.openai.com/v1/responses', { method: 'POST', body: '{}', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(auth.refreshAfterUnauthorized).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('does not replay when the signal aborts during refresh', async () => {
    const controller = new AbortController();
    const refreshAfterUnauthorized = vi.fn(async () => {
      controller.abort();
      return { accessToken: 'refreshed-access', accountId: 'acct-1' };
    });
    const auth = { getAccess: vi.fn(async () => ({ accessToken: 'access', accountId: 'acct-1' })), refreshAfterUnauthorized };
    const fetchImpl = vi.fn(async () => errorResponse(401));
    const fetchFn = createCodexRequestFetch({ auth, fetchImpl, sessionId: () => 'session-abort-refresh', version: '1.24.1' });
    await expect(fetchFn('https://api.openai.com/v1/responses', { method: 'POST', body: '{}', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(refreshAfterUnauthorized).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('does not refresh or retry quota responses', async () => {
    const auth = fakeAuthManager();
    const fetchFn = vi.fn(async () => errorResponse(429));
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-1', version: '1.24.1', quotaMessage: '本地化额度提示' });
    await expect(client.createMessage(messageParams())).rejects.toThrow('本地化额度提示');
    expect(auth.refreshAfterUnauthorized).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledOnce();
  });
  it('refreshes and replays once for a structured authentication 403', async () => {
    const auth = fakeAuthManager();
    const fetchFn = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'token_expired', message: 'Token expired' } }), { status: 403, headers: { 'Content-Type': 'application/json', 'CF-Ray': 'edge-request-id', Server: 'cloudflare' } })).mockResolvedValueOnce(streamingResponse(['ok']));
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-403', version: '1.25.0', quotaMessage: 'quota' });
    await expect(client.createMessage(messageParams())).resolves.toBe('ok');
    expect(auth.refreshAfterUnauthorized).toHaveBeenCalledWith('access', 403);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it.each([
    ['entitlement', new Response(JSON.stringify({ error: { code: 'model_not_allowed', message: 'Plan does not include this model' } }), { status: 403, headers: { 'Content-Type': 'application/json' } })],
    ['cloudflare', new Response('<html>Attention Required</html>', { status: 403, headers: { Server: 'cloudflare', 'CF-Ray': 'ray-id', 'Content-Type': 'text/html' } })],
    ['non-auth', new Response(JSON.stringify({ error: { code: 'policy_denied', message: 'Request denied' } }), { status: 403, headers: { 'Content-Type': 'application/json' } })],
  ])('does not refresh a %s 403', async (_kind, forbidden) => {
    const auth = fakeAuthManager();
    const fetchFn = vi.fn(async () => forbidden);
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-forbidden', version: '1.25.0', quotaMessage: 'quota' });
    await expect(client.createMessage(messageParams())).rejects.toThrow('status 403');
    expect(auth.refreshAfterUnauthorized).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledOnce();
  });
  it('does not refresh twice when an authentication 403 replay also fails', async () => {
    const auth = fakeAuthManager();
    const forbidden = (): Response => new Response(JSON.stringify({ error: { code: 'token_expired' } }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const fetchFn = vi.fn(async () => forbidden());
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-403-twice', version: '1.25.0', quotaMessage: 'quota' });
    await expect(client.createMessage(messageParams())).rejects.toThrow('status 403');
    expect(auth.refreshAfterUnauthorized).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('does not refresh twice when the replay is also unauthorized', async () => {
    const auth = fakeAuthManager();
    const fetchFn = vi.fn(async () => errorResponse(401));
    const client = new OpenAICodexSdkClient({ auth, fetch: fetchFn, streamFetch: fetchFn, sessionId: () => 'session-1', version: '1.24.1' });
    await expect(client.createMessage(messageParams())).rejects.toThrow('status 401');
    expect(auth.refreshAfterUnauthorized).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('never logs or exposes bearer tokens when a request fails', async () => {
    const auth = fakeAuthManager();
    const consoleCalls: string[] = [];
    const spies = ['debug', 'info', 'warn', 'error'].map((method) => vi.spyOn(console, method as 'debug').mockImplementation((...args: unknown[]) => { consoleCalls.push(args.map(String).join(' ')); }));
    const client = new OpenAICodexSdkClient({ auth, fetch: async () => errorResponse(500), streamFetch: async () => errorResponse(500), sessionId: () => 'session-secret', version: '1.24.1' });
    let message = '';
    try {
      await client.createMessage(messageParams());
    } catch (error) {
      message = String(error);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
    expect(message).not.toContain('access');
    expect(message).not.toContain('session-secret');
    expect(consoleCalls.join('\n')).not.toContain('access');
    expect(consoleCalls.join('\n')).not.toContain('session-secret');
  });
});
