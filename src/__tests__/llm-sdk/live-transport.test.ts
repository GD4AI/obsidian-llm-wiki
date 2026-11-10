// Live transport check against a real llama.cpp server (#980).
//
// Every other test of the streaming decision mocks `ai`, so all of them prove the
// shape of our call and none of them proves what goes on the wire. This one sends
// the same request twice, once as each platform, and reads the bytes.
//
// Run it:
//   llama-server -m /tmp/stories260K.gguf --host 127.0.0.1 --port 8000 -c 2048 --no-webui
//   LLAMA_LIVE=1 npx vitest run src/__tests__/llm-sdk/live-transport.test.ts
//
// Skipped by default because it needs a server. A skipped test is not evidence, so
// the numbers it prints belong in the pull request that cites them.

import { describe, it, expect, beforeAll } from 'vitest';
import { Platform } from 'obsidian';
import { OpenAICompatSdkClient } from '../../llm-sdk/openai-compat-sdk-client';

const LIVE = process.env.LLAMA_LIVE === '1';
const BASE_URL = process.env.LLAMA_BASE_URL ?? 'http://127.0.0.1:8000/v1';

interface Exchange {
  url: string;
  method: string;
  body: string;
  contentType: string | null;
  /** Milliseconds until the first body byte arrived. */
  firstByteMs: number;
  totalMs: number;
  bytes: number;
  sseFrames: number;
}

/**
 * Records what crossed the wire while the client reads the same bytes.
 *
 * The response is `tee()`d rather than rebuilt from the text, so the SDK consumes
 * a genuinely incremental stream. Rebuilding it from `await res.text()` would test
 * a single-chunk body and prove nothing about streaming.
 */
function createRecorder() {
  const exchanges: Exchange[] = [];
  const pending: Array<Promise<void>> = [];

  const record = async (
    url: string,
    method: string,
    body: string,
    started: number,
    res: Response,
  ): Promise<[Response, Promise<void>]> => {
    if (!res.body) {
      exchanges.push({ url, method, body, contentType: res.headers.get('content-type'), firstByteMs: -1, totalMs: Date.now() - started, bytes: 0, sseFrames: 0 });
      return [res, Promise.resolve()];
    }
    const [observed, forClient] = res.body.tee();
    const work = (async () => {
      const reader = observed.getReader();
      const decoder = new TextDecoder();
      let firstByteMs = -1;
      let bytes = 0;
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstByteMs < 0) firstByteMs = Date.now() - started;
        bytes += value.byteLength;
        text += decoder.decode(value, { stream: true });
      }
      exchanges.push({
        url,
        method,
        body,
        contentType: res.headers.get('content-type'),
        firstByteMs,
        totalMs: Date.now() - started,
        bytes,
        sseFrames: (text.match(/^data: /gm) ?? []).length,
      });
    })();
    pending.push(work);
    return [new Response(forClient, { status: res.status, statusText: res.statusText, headers: res.headers }), work];
  };

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = Date.now();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const body = typeof init?.body === 'string' ? init.body : '';
    const res = await fetch(url, init as RequestInit);
    const [wrapped] = await record(url, init?.method ?? 'GET', body, started, res);
    return wrapped;
  }) as unknown as typeof import('../../core/obsidian-fetch-bridge').obsidianFetchBridge;

  return {
    fetchImpl,
    async drain() { await Promise.all(pending); },
    chatCalls: () => exchanges.filter(e => e.url.includes('/chat/completions')),
    all: exchanges,
  };
}

function makeClient(recorder: ReturnType<typeof createRecorder>) {
  return new OpenAICompatSdkClient({
    apiKey: 'no-key-needed-for-local',
    baseURL: BASE_URL,
    provider: 'custom',
    fetch: recorder.fetchImpl,
    streamFetch: recorder.fetchImpl,
  });
}

describe.runIf(LIVE)('live transport against llama.cpp (#980)', () => {
  beforeAll(async () => {
    const health = await fetch(BASE_URL.replace(/\/v1$/, '') + '/health');
    expect(health.ok).toBe(true);
  });

  it('streams when the platform is mobile, and the server sends frames', async () => {
    const recorder = createRecorder();
    const client = makeClient(recorder);
    const before = Platform.isMobile;
    Platform.isMobile = true;
    try {
      const reply = await client.createMessage({
        model: 'stories260K',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Once upon a time' }],
      });
      await recorder.drain();

      const calls = recorder.chatCalls();
      expect(calls.length).toBeGreaterThan(0);
      const call = calls[calls.length - 1];

      // What we asked for.
      expect(JSON.parse(call.body).stream).toBe(true);
      // What came back: framing, not one blob.
      expect(call.contentType).toContain('event-stream');
      expect(call.sseFrames).toBeGreaterThan(1);
      expect(call.firstByteMs).toBeLessThan(call.totalMs);
      // And the answer still assembled.
      expect(reply.length).toBeGreaterThan(0);

      console.log(
        `[mobile] stream=${JSON.parse(call.body).stream} frames=${call.sseFrames} `
        + `ttfb=${call.firstByteMs}ms total=${call.totalMs}ms bytes=${call.bytes} `
        + `bytes/frame=${(call.bytes / call.sseFrames).toFixed(0)} reply=${reply.length} chars`,
      );
    } finally {
      Platform.isMobile = before;
    }
  });

  it('buffers when the platform is desktop, and no frames appear', async () => {
    const recorder = createRecorder();
    const client = makeClient(recorder);
    const before = Platform.isMobile;
    Platform.isMobile = false;
    try {
      const reply = await client.createMessage({
        model: 'stories260K',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Once upon a time' }],
      });
      await recorder.drain();

      const calls = recorder.chatCalls();
      expect(calls.length).toBeGreaterThan(0);
      const call = calls[calls.length - 1];

      // The whole point of the platform split: desktop does not pay for framing.
      expect(JSON.parse(call.body).stream).not.toBe(true);
      expect(call.sseFrames).toBe(0);
      expect(reply.length).toBeGreaterThan(0);

      console.log(
        `[desktop] stream=${JSON.parse(call.body).stream ?? '(absent)'} frames=${call.sseFrames} `
        + `ttfb=${call.firstByteMs}ms total=${call.totalMs}ms bytes=${call.bytes} `
        + `reply=${reply.length} chars`,
      );
    } finally {
      Platform.isMobile = before;
    }
  });
});
