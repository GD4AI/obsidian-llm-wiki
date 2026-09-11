// Issue #653 review: an LLM `action: 'correct'` reply with an empty/garbage `correct_link` (e.g. whitespace, or
// "]"/"|" leading) used to be trusted verbatim, and replaceDeadLink's per-match alias-preservation would throw
// trying to parse a path out of it. An unclosed one (e.g. "[[foo" — already starts with "[[" so the wrap step
// below skips it) used to be written straight into the page as broken markdown.
// A malformed correct_link now falls through to the deterministic stub fallback instead — same as if the LLM
// hadn't returned a usable action at all.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fixDeadLink } from '../../../wiki/lint/fix-dead-link';
import * as getExistingPages from '../../../wiki/lint/get-existing-pages';
import type { EngineContext, LLMClient } from '../../../types';

const SOURCE_CONTENT = '# My Page\n\nReferences [[missing-target|My Alias]] here.\n';
const BARE_SOURCE_CONTENT = '# My Page\n\nReferences [[missing-target]] here.\n';

function makeCtx(
  client: LLMClient,
  sourceContent: string = SOURCE_CONTENT,
): { ctx: EngineContext; writes: Array<{ path: string; content: string }> } {
  const written: Array<{ path: string; content: string }> = [];
  const ctx = {
    app: {},
    settings: {
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      disableThinking: false,
      slugCase: 'preserve',
    },
    getClient: () => client,
    getSchemaContext: () => ({}),
    tryReadFile: async (_path: string): Promise<string | null> => sourceContent,
    createOrUpdateFile: async (path: string, content: string): Promise<void> => {
      written.push({ path, content });
    },
  } as unknown as EngineContext;
  return { ctx, writes: written };
}

function typedClient(payload: unknown): LLMClient {
  return {
    createMessage: vi.fn(async () => '') as unknown as LLMClient['createMessage'],
    createMessageWithOutput: vi.fn(async () => ({
      text: JSON.stringify(payload),
      output: payload,
      outputMode: 'json_schema',
      finishReason: 'stop',
    })) as unknown as LLMClient['createMessageWithOutput'],
  } as LLMClient;
}

describe('fixDeadLink — malformed LLM correct_link', () => {
  beforeEach(() => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw on a whitespace-only correct_link, and falls through to the stub fallback', async () => {
    const client = typedClient({ action: 'correct', correct_link: '   ' });
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('fallback stub created');
    expect(writes).toHaveLength(2);
  });

  it('preserves the source link\'s own alias in the fallback stub link', async () => {
    const client = typedClient({ action: 'correct', correct_link: '   ' });
    const { ctx, writes } = makeCtx(client);

    await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    const referringWrite = writes.find(w => w.path === 'wiki/concepts/MyPage.md')!;
    expect(referringWrite.content).toContain('|My Alias]]');
  });

  it('does not write an unclosed link on a bare (no-alias) dead link, and falls through to the stub fallback', async () => {
    // Already starts with "[[", so the wrap-if-missing step below is skipped, leaving it unclosed. On a bare
    // dead link (no alias), replaceDeadLink would have spliced this straight in as broken markdown.
    const client = typedClient({ action: 'correct', correct_link: '[[real-target' });
    const { ctx, writes } = makeCtx(client, BARE_SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('fallback stub created');
    const referringWrite = writes.find(w => w.path === 'wiki/concepts/MyPage.md')!;
    expect(referringWrite.content).not.toContain('[[real-target');
  });

  it('still applies a well-formed correct_link as before', async () => {
    const client = typedClient({ action: 'correct', correct_link: '[[real-target|Real Target]]' });
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('corrected: [[real-target|Real Target]]');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[real-target|My Alias]]');
  });
});
