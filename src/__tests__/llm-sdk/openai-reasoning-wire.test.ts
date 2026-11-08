// #912 (item 1 of #904's remainder): the OpenAI native client hand-wrote its
// reasoning field.
//
// Anthropic stopped doing that in v1.29.0. It passes the unified `reasoning`
// call option and lets `@ai-sdk/anthropic` translate it — the SDK knows the
// effort table, and knows that a model which cannot stop thinking needs `'none'`
// downgraded. `OpenAISdkClient` kept building `providerOptions.openai.
// reasoningEffort` by hand, which also routed the value through a zod schema
// that drops unknown keys.
//
// Measured against `@ai-sdk/openai@4.0.91` on the Responses path, which is the
// path this client takes (`createOpenAI()(modelId)`): the unified option
// produces `reasoning: { effort: 'high' }`, `'none'` produces
// `reasoning: { effort: 'none' }`, and `'provider-default'` sends no field at
// all. So the SDK already does the translation, and the hand-written field was
// the only reason a named level never reached the wire.

import { describe, it, expect, vi } from 'vitest';

import { OpenAISdkClient } from '../../llm-sdk/openai-sdk-client';

/** Response-shaped body, because this client speaks `/v1/responses`. */
const RESPONSES_BODY = {
  id: 'r',
  object: 'response',
  created_at: 0,
  model: 'm',
  status: 'completed',
  output: [
    {
      type: 'message',
      id: 'msg',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'ok', annotations: [] }],
    },
  ],
  usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
};

interface CapturedBody {
  reasoning?: { effort?: string; summary?: string };
  reasoning_effort?: string;
}

function capturingFetch(sink: CapturedBody[]): unknown {
  return vi.fn(async (_url: string, init?: { body?: unknown }) => {
    const raw = typeof init?.body === 'string' ? init.body : '{}';
    sink.push(JSON.parse(raw) as CapturedBody);
    return new Response(JSON.stringify(RESPONSES_BODY), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

function clientWith(sink: CapturedBody[]): OpenAISdkClient {
  return new OpenAISdkClient({
    apiKey: 'k',
    baseURL: 'http://localhost/v1',
    fetch: capturingFetch(sink) as never,
  });
}

const BASE = { model: 'gpt-5', max_tokens: 10, messages: [{ role: 'user' as const, content: 'hi' }] };

describe('OpenAISdkClient — the reasoning level reaches the wire (#912)', () => {
  it('sends a named level as the SDK’s own reasoning option', async () => {
    const sink: CapturedBody[] = [];
    await clientWith(sink).createMessage({ ...BASE, reasoningEffort: 'high' });

    expect(sink).toHaveLength(1);
    expect(sink[0].reasoning?.effort, 'the level a user chose is no longer dropped').toBe('high');
    expect(sink[0].reasoning_effort, 'and it is not written by hand either').toBeUndefined();
  });

  it('still asks for silence when thinking is switched off', async () => {
    const sink: CapturedBody[] = [];
    await clientWith(sink).createMessage({ ...BASE, enableThinking: false });
    expect(sink[0].reasoning?.effort).toBe('none');
  });

  it('sends no reasoning field when the user expressed no preference', async () => {
    // The default has to stay byte-identical: `thinkingEffort: 'default'` with
    // no level, and `enableThinking: true`, both mean "let the model decide".
    const plain: CapturedBody[] = [];
    await clientWith(plain).createMessage({ ...BASE });
    expect(plain[0].reasoning, 'no preference, no field').toBeUndefined();

    const providerDefault: CapturedBody[] = [];
    await clientWith(providerDefault).createMessage({ ...BASE, enableThinking: true });
    expect(providerDefault[0].reasoning).toBeUndefined();
  });

  it('lets a named level win over the on/off switch, as the resolver orders it', async () => {
    const sink: CapturedBody[] = [];
    await clientWith(sink).createMessage({
      ...BASE,
      enableThinking: false,
      reasoningEffort: 'medium',
    });
    expect(sink[0].reasoning?.effort, 'an explicit level outranks the toggle').toBe('medium');
  });

  it('does not throw when the model does not support the level', async () => {
    // `@ai-sdk/openai` drops an effort the model's capability table excludes
    // and emits a warning. A warning is not an ingest failure, so the call must
    // still return a reply.
    const sink: CapturedBody[] = [];
    const reply = await clientWith(sink).createMessage({
      ...BASE,
      model: 'gpt-4o-mini',
      reasoningEffort: 'high',
    });
    expect(reply).toBe('ok');
    expect(sink).toHaveLength(1);
  });
});

describe('OpenAISdkClient — a gateway that rejects the reasoning field (#912)', () => {
  it('retries without any reasoning option, and remembers the decision', async () => {
    // The strip retry used to be expressed as `enableThinking: true` fed into
    // the hand-built providerOptions. Now the retry simply passes no reasoning
    // option, which the SDK renders as no field — so this pins the behaviour
    // that matters: the second attempt carries no reasoning at all.
    const sink: CapturedBody[] = [];
    let call = 0;
    const fetchStub = vi.fn(async (_url: string, init?: { body?: unknown }) => {
      const raw = typeof init?.body === 'string' ? init.body : '{}';
      sink.push(JSON.parse(raw) as CapturedBody);
      call++;
      if (call === 1) {
        return new Response(
          JSON.stringify({ error: { message: 'Unsupported parameter: reasoning_effort', type: 'invalid_request_error' } }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(RESPONSES_BODY), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const client = new OpenAISdkClient({
      apiKey: 'k',
      baseURL: 'http://localhost/v1',
      fetch: fetchStub as never,
    });
    const reply = await client.createMessage({ ...BASE, enableThinking: false, reasoningEffort: 'high' });

    expect(reply, 'the retry answered').toBe('ok');
    expect(sink.length, 'two attempts were made').toBeGreaterThanOrEqual(2);
    expect(sink[0].reasoning?.effort, 'the first attempt carried the level').toBe('high');
    expect(sink[1].reasoning, 'and the retry sent no reasoning field at all').toBeUndefined();
  });
});
