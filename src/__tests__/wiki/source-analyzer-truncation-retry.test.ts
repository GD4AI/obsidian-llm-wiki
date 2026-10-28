import { describe, it, expect, vi } from 'vitest';
import { createMockContext, createMockFile } from '../__support__/engine-context';
import { SourceAnalyzer } from '../../wiki/source-analyzer';
import { normalizeFinishReason } from '../../llm-sdk/finish-reason';
import { SOURCE_ANALYZER_RETRY_MULTIPLIER, DEFAULT_MODEL_OUTPUT_TOKENS } from '../../constants';
import type { LLMClient, LLMFinishReason } from '../../types';
import { TFile } from 'obsidian';

// Issue #305 — a truncated batch response is not an error.
//
// An OpenAI-compatible provider that hits the token limit returns HTTP 200
// with a body that stops mid-token. The call does not throw, so the halving
// retry that lived in the `catch` block never ran: `parseJsonResponse`
// returned null and the batch was dropped silently (`break`), or the whole
// ingest failed (`return null` on the first batch).
//
// These tests drive the analyzer through a client that reports
// `finishReason: 'length'`, which is what the SDK normalizes the provider's
// `finish_reason` field into.

const TEST_PATH = 'sources/truncation.md';

/** A response body cut off mid-token: valid JSON prefix, no closing braces. */
const TRUNCATED = '{"source_title": "Protein misfolding", "entities": [{"name": "Amyloid", "summary": "Aggregation occurs spontane';

const VALID = JSON.stringify({
  source_title: 'Protein misfolding',
  summary: 'A note about protein misfolding.',
  entities: [{ name: 'Amyloid', type: 'other', summary: 'An aggregate', mentions_in_source: [] }],
});

interface ScriptedReply {
  text: string;
  /** Omitted for clients/paths that report nothing — the pre-#305 situation. */
  finishReason?: LLMFinishReason;
}

/**
 * Client that replays a script of *extraction* replies and reports
 * `finishReason` through the optional `onFinish` out-channel, the way the
 * SDK-backed clients do.
 *
 * `parseJsonResponse` may issue a JSON-repair call on the same client. Those
 * are identified by their prompt and answered by echoing the broken text
 * back unchanged — a repair cannot reconstruct content that was never
 * emitted (that is the point of #305), and they carry no finish reason
 * because the repair call site does not pass `onFinish`. Keeping them out of
 * the script means the script indexes extraction attempts only.
 */
function scriptedClient(replies: ScriptedReply[], opts: { repair?: (broken: string) => string } = {}): {
  client: LLMClient;
  prompts: string[];
  repairPrompts: string[];
  maxTokens: number[];
} {
  const prompts: string[] = [];
  const repairPrompts: string[] = [];
  const maxTokens: number[] = [];
  let idx = 0;
  let lastText = '';
  const client: LLMClient = {
    createMessage: async (params) => {
      const first = params.messages[0];
      const prompt = typeof first.content === 'string' ? first.content : '';
      if (prompt.startsWith('Fix the following malformed JSON')) {
        repairPrompts.push(prompt);
        return opts.repair ? opts.repair(lastText) : lastText;
      }
      prompts.push(prompt);
      maxTokens.push(params.max_tokens as number);
      const reply = replies[idx++];
      if (!reply) throw new Error(`unscripted extraction call #${idx}`);
      if (reply.finishReason) params.onFinish?.({ finishReason: reply.finishReason });
      lastText = reply.text;
      return reply.text;
    },
  };
  return { client, prompts, repairPrompts, maxTokens };
}

function analyzerWith(client: LLMClient, settings?: Record<string, unknown>): SourceAnalyzer {
  const { ctx } = createMockContext({
    vaultFiles: { [TEST_PATH]: '# Protein misfolding\nA note with content to extract.' },
    settings,
  });
  ctx.getClient = () => client;
  return new SourceAnalyzer(ctx);
}

function run(analyzer: SourceAnalyzer) {
  // The SourceAnalyzer only reads file.path and file.basename.
  // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast
  return analyzer.analyzeSource(createMockFile(TEST_PATH) as unknown as TFile);
}

/** `Output at most N items` — how the batch size reaches the model. */
function batchSizeOf(prompt: string): number | null {
  const m = prompt.match(/at most (\d+) items/);
  return m ? Number(m[1]) : null;
}

describe('SourceAnalyzer truncation retry (#305)', () => {
  it('retries with a halved batch instead of dropping a truncated first batch', async () => {
    // 1st extraction: truncated + finish_reason=length
    // 2nd extraction: succeeds, after the batch was halved
    const { client, prompts } = scriptedClient([
      { text: TRUNCATED, finishReason: 'length' },
      { text: VALID, finishReason: 'stop' },
    ]);

    const result = await run(analyzerWith(client));

    // Before the fix this returned null: the parse failure hit `return null`
    // on the first batch and the halving retry was never reached.
    expect(result).not.toBeNull();
    expect(result!.entities.map(e => e.name)).toEqual(['Amyloid']);

    const mainPrompts = prompts.filter(p => batchSizeOf(p) !== null);
    expect(mainPrompts.length).toBeGreaterThanOrEqual(2);
    expect(batchSizeOf(mainPrompts[1])!).toBeLessThan(batchSizeOf(mainPrompts[0])!);
  });

  it('raises max_tokens to the retry cap on the truncation retry', async () => {
    // S143: a reasoning model can spend the entire budget thinking, so the
    // retry must offer more room — halving only lowers the item ceiling in
    // the prompt, which cannot shorten a think-phase that never reached the
    // items.
    //
    // Issue #904 changes what "more room" can mean. While reasoning is
    // possible the first attempt already declares the model's own ceiling, so
    // there is nothing left to grow into: escalation is clamped at the
    // ceiling, and the halving path inside the same retry is what shortens
    // the batch. Declaring more than the ceiling is a 400, which is the
    // failure this whole change removes.
    const { client, maxTokens } = scriptedClient([
      { text: TRUNCATED, finishReason: 'length' },
      { text: VALID, finishReason: 'stop' },
    ]);

    const result = await run(analyzerWith(client));

    expect(result).not.toBeNull();
    expect(maxTokens.length).toBeGreaterThanOrEqual(2);
    // Escalation adds room, never removes it: the first attempt already
    // declared the ceiling, so the retry cannot go higher and stays put.
    expect(maxTokens[1]).toBeGreaterThanOrEqual(maxTokens[0]);
    expect(maxTokens[1]).toBeLessThanOrEqual(DEFAULT_MODEL_OUTPUT_TOKENS);
  });

  it('still triples a narrow budget when thinking is off', async () => {
    // The pre-#904 invariant survives where it still has room: a request that
    // declares only the answer need can grow on retry.
    const { client, maxTokens } = scriptedClient([
      { text: TRUNCATED, finishReason: 'length' },
      { text: VALID, finishReason: 'stop' },
    ]);

    const result = await run(analyzerWith(client, { disableThinking: true }));

    expect(result).not.toBeNull();
    expect(maxTokens.length).toBeGreaterThanOrEqual(2);
    expect(maxTokens[1]).toBe(maxTokens[0] * SOURCE_ANALYZER_RETRY_MULTIPLIER);
  });

  // Issue #904: the ceiling is a starting assumption. A provider whose real
  // limit is lower answers with a 400 that names max_tokens, and a 400 is not
  // an answer. The loop halves and retries instead of failing the ingest.
  it('halves a rejected output ceiling and retries', async () => {
    const { client, maxTokens } = scriptedClient([{ text: VALID, finishReason: 'stop' }]);
    let rejected = false;
    const wrapped = Object.create(client) as LLMClient;
    wrapped.createMessage = async (params) => {
      if (!rejected) {
        rejected = true;
        throw new Error('Invalid value for max_tokens: must be less than or equal to 65536');
      }
      return client.createMessage(params);
    };

    const result = await run(analyzerWith(wrapped));

    expect(rejected).toBe(true);
    expect(result).not.toBeNull();
    expect(maxTokens[0]).toBe(DEFAULT_MODEL_OUTPUT_TOKENS / 2);
  });

  it('does not halve the ceiling for a failure that does not name it', async () => {
    // A context-length complaint means the INPUT is too long. Halving the
    // output budget would burn two calls and still fail, so the first-batch
    // error must reach the classifier instead.
    const { client, maxTokens } = scriptedClient([{ text: VALID, finishReason: 'stop' }]);
    let attempts = 0;
    const wrapped = Object.create(client) as LLMClient;
    wrapped.createMessage = async (params) => {
      attempts++;
      if (attempts === 1) {
        throw new Error('This model\'s maximum context length is 8192 tokens');
      }
      return client.createMessage(params);
    };

    await expect(run(analyzerWith(wrapped))).rejects.toThrow(/context window/);

    expect(attempts).toBe(1);
    expect(maxTokens).toHaveLength(0);
  });

  it('does not retry when the parse failed for a reason other than truncation', async () => {
    // Malformed but complete: halving the batch would not help, so the
    // pre-#305 behavior (give up on this batch) must be preserved.
    const { client, prompts } = scriptedClient([
      { text: '{"entities": [oops]}', finishReason: 'stop' },
    ]);

    const result = await run(analyzerWith(client));

    expect(result).toBeNull();
    expect(prompts.filter(p => batchSizeOf(p) !== null)).toHaveLength(1);
  });

  it('does not retry when the client reports no finish reason (pre-#305 clients)', async () => {
    // A client that never calls `onFinish` must behave exactly as before:
    // no signal, no retry.
    const { client, prompts } = scriptedClient([
      { text: TRUNCATED },
    ]);

    const result = await run(analyzerWith(client));

    expect(result).toBeNull();
    expect(prompts.filter(p => batchSizeOf(p) !== null)).toHaveLength(1);
  });

  it('halves only once — a second truncation is not retried again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client, prompts } = scriptedClient([
      { text: TRUNCATED, finishReason: 'length' },
      { text: TRUNCATED, finishReason: 'length' },
    ]);

    const result = await run(analyzerWith(client));

    expect(result).toBeNull();
    expect(prompts.filter(p => batchSizeOf(p) !== null)).toHaveLength(2);
    expect(warn.mock.calls.filter(c => String(c[0]).includes('halving batch size'))).toHaveLength(1);
    warn.mockRestore();
  });
});

/**
 * A truncated batch that still reaches the repair path.
 *
 * `TRUNCATED` above stops before any closing brace, so neither the
 * brace-count nor the greedy-regex recovery finds a candidate and `repairFn`
 * is never consulted. A real truncated batch cuts off after several complete
 * items, leaving closing braces behind — the greedy regex then matches up to
 * the last one, fails to parse, and the repair call fires. That is the call
 * this change avoids.
 */
const TRUNCATED_MID_ARRAY = '{"source_title": "Protein misfolding", "entities": ['
  + '{"name": "Amyloid", "type": "other", "summary": "An aggregate", "mentions_in_source": []}, '
  + '{"name": "Tau", "type": "other", "summary": "Aggregation occurs spontane';

describe('SourceAnalyzer truncation — no futile repair call (#305 follow-up)', () => {
  it('skips the JSON-repair call when the response was truncated', async () => {
    // A truncated response is incomplete, not malformed: repair cannot restore
    // content the model never emitted, and the call costs another
    // retryCap-sized request that re-hits the same limit.
    const { client, repairPrompts } = scriptedClient([
      { text: TRUNCATED_MID_ARRAY, finishReason: 'length' },
      { text: VALID, finishReason: 'stop' },
    ]);

    await run(analyzerWith(client));

    expect(repairPrompts).toHaveLength(0);
  });

  it('still repairs a malformed-but-complete response', async () => {
    // finish_reason=stop means the model finished; the JSON is genuinely
    // broken, so the repair path must stay. parseJsonResponse attempts repair
    // from two recovery strategies, so the count is "more than none" rather
    // than an exact number.
    const { client, repairPrompts } = scriptedClient([
      { text: '{"entities": [oops]}', finishReason: 'stop' },
    ]);

    await run(analyzerWith(client));

    expect(repairPrompts.length).toBeGreaterThan(0);
  });

  it('still repairs when the client reports no finish reason', async () => {
    const { client, repairPrompts } = scriptedClient([
      { text: '{"entities": [oops]}' },
    ]);

    await run(analyzerWith(client));

    expect(repairPrompts.length).toBeGreaterThan(0);
  });
});

/**
 * What a repair pass actually does to a truncated batch: drop the cut-off tail
 * and close the brackets around the items that did arrive. The default stub
 * echoes the broken text back, which models repair as unable to help — fine for
 * asserting "repair was skipped", useless for asserting "repair salvaged it".
 */
function closeBrackets(broken: string): string {
  const lastComplete = broken.lastIndexOf('}');
  return lastComplete === -1 ? broken : broken.slice(0, lastComplete + 1) + ']}';
}

describe('SourceAnalyzer truncation — repair is the last salvage (#305 follow-up)', () => {
  it('repairs a truncated batch once the halving budget is spent', async () => {
    // First truncation halves. The second cannot halve again within the same
    // batch, and without repair the parse failure reaches `if (isFirstBatch)
    // return null` — dropping the whole source instead of the complete items
    // the model did emit.
    const { client, repairPrompts } = scriptedClient([
      { text: TRUNCATED_MID_ARRAY, finishReason: 'length' },
      { text: TRUNCATED_MID_ARRAY, finishReason: 'length' },
    ], { repair: closeBrackets });

    const result = await run(analyzerWith(client));

    expect(repairPrompts.length).toBeGreaterThan(0);
    expect(result).not.toBeNull();
    expect(result!.entities.map(e => e.name)).toEqual(['Amyloid']);
  });
});

describe('SourceAnalyzer truncation — retry budget resets per batch (#305 follow-up)', () => {
  it('halves again for a later truncation once a batch has succeeded', async () => {
    // The one-retry-per-batch budget used to latch for the whole source: the
    // first halve anywhere meant a later truncated batch could no longer
    // halve, and was dropped while the source finalized as "complete".
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { client } = scriptedClient([
      { text: TRUNCATED, finishReason: 'length' },  // batch 1 truncates -> halve
      { text: VALID, finishReason: 'stop' },        // retry succeeds -> budget resets
      { text: TRUNCATED, finishReason: 'length' },  // batch 2 truncates -> must halve again
      { text: VALID, finishReason: 'stop' },
    ]);

    await run(analyzerWith(client));

    const halvings = warn.mock.calls.filter(c => String(c[0]).includes('halving batch size'));
    expect(halvings.length).toBeGreaterThanOrEqual(2);
    warn.mockRestore();
  });
});

describe('normalizeFinishReason (#305)', () => {
  it.each([
    ['stop', 'stop'],
    ['length', 'length'],
    ['content-filter', 'content-filter'],
    ['tool-calls', 'tool-calls'],
    ['error', 'error'],
    ['other', 'other'],
  ] as const)('passes through the known reason %s', (raw, expected) => {
    expect(normalizeFinishReason(raw)).toBe(expected);
  });

  it.each([
    [undefined],
    [null],
    [''],
    ['LENGTH'],
    ['max_tokens'],
    [42],
    [{}],
  ])('maps unrecognized input %o to unknown', (raw) => {
    // Total on purpose: an unrecognized value must not be mistaken for
    // 'length', so the worst case is "no signal", i.e. pre-#305 behavior.
    expect(normalizeFinishReason(raw)).toBe('unknown');
  });
});
