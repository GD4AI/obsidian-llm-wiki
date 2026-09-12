// fix-dead-link typed-output path tests (v1.26.3 PATCH Phase B).
//
// fixDeadLink normally requires a full EngineContext with `ctx.app`
// (getExistingWikiPages). The typed-path migration (`createMessageWithOutput`
// → prefer result.output, fall back to parseJsonResponse(text)) is what we
// pin here. We mock `getExistingWikiPages` to return [] so the deterministic
// pre-check skips and the LLM path runs.
//
// The downstream replacement logic (replaceTargetLink / buildStubContent)
// is covered by the existing fix-dead-link.test.ts — not re-tested here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fixDeadLink } from '../../../wiki/lint/fix-dead-link';
import * as getExistingPages from '../../../wiki/lint/get-existing-pages';
import type { EngineContext } from '../../../types';
import type { LLMClient } from '../../../types';

function makeTypedClient(createMessageWithOutput: (p: Record<string, unknown>) => Promise<{
  text: string;
  output?: unknown;
  outputMode: string;
  finishReason: string;
}>): LLMClient {
  return {
    createMessage: vi.fn(async () => '') as unknown as LLMClient['createMessage'],
    createMessageWithOutput: createMessageWithOutput as unknown as LLMClient['createMessageWithOutput'],
  } as LLMClient;
}

function makeCtx(client: LLMClient, sourceContent: string): EngineContext {
  const ctx = {
    // the one vocabulary (vocabulary.ts) is harvested from the vault before every system prompt
    app: { vault: { getMarkdownFiles: () => [] }, metadataCache: { getFileCache: () => null } } as never,
    settings: {
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      disableThinking: false,
      slugCase: 'preserve',
    },
    getClient: () => client,
    getSchemaContext: () => ({}),
    tryReadFile: async (_path: string): Promise<string | null> => sourceContent,
    createOrUpdateFile: async (_path: string, _content: string): Promise<void> => {},
  } as unknown as EngineContext;
  return ctx;
}

const SOURCE_CONTENT = '# My Page\n\nReferences [[missing-target]] here.\n';

describe('fixDeadLink — typed-output path (createMessageWithOutput)', () => {
  beforeEach(() => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses result.output when Tier 0 succeeds (correct action, schema on wire)', async () => {
    const createMessageWithOutput = vi.fn(async (_p: Record<string, unknown>) => ({
      text: JSON.stringify({ action: 'correct', correct_link: '[[real-target]]' }),
      output: { action: 'correct', correct_link: '[[real-target]]' },
      outputMode: 'json_schema',
      finishReason: 'stop',
    }));
    const ctx = makeCtx(makeTypedClient(createMessageWithOutput), SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/MyPage.md', 'missing-target');

    expect(out).toContain('corrected');
    const firstCall = createMessageWithOutput.mock.calls[0]?.[0];
    expect((firstCall as { response_format?: { schema?: unknown } }).response_format?.schema).toBeDefined();
  });

  it('falls back to parseJsonResponse(text) when Tier 1/2 succeed (output undefined)', async () => {
    const createMessageWithOutput = vi.fn(async () => ({
      text: JSON.stringify({ action: 'correct', correct_link: '[[real-target]]' }),
      output: undefined,
      outputMode: 'json_object',
      finishReason: 'stop',
    }));
    const ctx = makeCtx(makeTypedClient(createMessageWithOutput), SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/MyPage.md', 'missing-target');

    expect(out).toContain('corrected');
  });

  it('falls to deterministic stub when result has no usable action (legacy path)', async () => {
    const createMessage = vi.fn(async () => JSON.stringify({}));
    const ctx = makeCtx({ createMessage } as unknown as LLMClient, SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/MyPage.md', 'missing-target');

    // `{}` → no 'correct'/'create_stub' action → deterministic fallback.
    // With empty existingPages, no alias match → honest placeholder stub.
    expect(out).toContain('stub');
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it('handles create_stub action via typed path', async () => {
    const createMessageWithOutput = vi.fn(async () => ({
      text: JSON.stringify({ action: 'create_stub', stub_title: 'Missing Target', stub_type: 'entity' }),
      output: { action: 'create_stub', stub_title: 'Missing Target', stub_type: 'entity' },
      outputMode: 'json_schema',
      finishReason: 'stop',
    }));
    const ctx = makeCtx(makeTypedClient(createMessageWithOutput), SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/MyPage.md', 'missing-target');

    // Honest stub created (not LLM-filled) — buildStubContent path.
    expect(out).toContain('stub');
  });
});
