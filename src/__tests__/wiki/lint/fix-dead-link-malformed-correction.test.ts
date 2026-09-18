// Issue #653 review: an LLM `action: 'correct'` reply with an empty/garbage `correct_link` (e.g. whitespace, or
// "]"/"|" leading) used to be trusted verbatim, and replaceDeadLink's per-match alias-preservation would throw
// trying to parse a path out of it.
//
// normalizeCorrectLink now splits malformed corrections into two buckets: a dropped or doubled bracket at the
// edges (unclosed, single-bracket, extra-bracket) is delimiter noise, never content, so it gets repaired into a
// clean `[[target]]`/`[[target|alias]]` and applied. A blank target/alias, two concatenated links, or an
// embedded carriage return isn't safely reconstructable, so those still leave the link dead — no stub, no file
// write of any kind — since the LLM already tried and failed to produce a usable correction.

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

  it('leaves the link dead on a whitespace-only correct_link (does not create a stub)', async () => {
    const client = typedClient({ action: 'correct', correct_link: '   ' });
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('no action taken');
    expect(writes).toHaveLength(0);
  });

  it('preserves the source link\'s own alias when the deterministic fallback creates a stub', async () => {
    // {} → no usable action → deterministic fallback → creates a stub and rewrites the
    // referring page's link; the alias already on that link must survive the rewrite.
    const client = typedClient({});
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('fallback stub created');
    const referringWrite = writes.find(w => w.path === 'wiki/concepts/MyPage.md')!;
    expect(referringWrite.content).toContain('|My Alias]]');
  });

  it('repairs a fully unclosed correct_link by adding the missing closing brackets', async () => {
    // No closing brackets at all — normalizeCorrectLink strips the (zero-length) trailing "]" run the same
    // way it would strip a non-empty one, then re-wraps, so this repairs to "[[real-target]]" and is applied.
    const client = typedClient({ action: 'correct', correct_link: '[[real-target' });
    const { ctx, writes } = makeCtx(client, BARE_SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('corrected: [[real-target]]');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[real-target]]');
  });

  it('repairs a correct_link missing its opening brackets (doubled closing)', async () => {
    const client = typedClient({ action: 'correct', correct_link: 'real-target]]' });
    const { ctx, writes } = makeCtx(client, BARE_SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('corrected: [[real-target]]');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[real-target]]');
  });

  it('repairs a correct_link with a single bracket on each side', async () => {
    const client = typedClient({ action: 'correct', correct_link: '[real-target]' });
    const { ctx, writes } = makeCtx(client, BARE_SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('corrected: [[real-target]]');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[real-target]]');
  });

  it('repairs a correct_link with an extra opening bracket', async () => {
    const client = typedClient({ action: 'correct', correct_link: '[[[real-target]]' });
    const { ctx, writes } = makeCtx(client, BARE_SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('corrected: [[real-target]]');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[real-target]]');
  });

  it('leaves the link dead on a blank-alias correct_link (does not create a stub)', async () => {
    const client = typedClient({ action: 'correct', correct_link: '[[foo|]]' });
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('no action taken');
    expect(writes).toHaveLength(0);
  });

  it('leaves the link dead on two concatenated correct_links (does not create a stub)', async () => {
    const client = typedClient({ action: 'correct', correct_link: '[[foo]] and [[bar]]' });
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('no action taken');
    expect(writes).toHaveLength(0);
  });

  it('leaves the link dead on a correct_link with an embedded carriage return (does not create a stub)', async () => {
    const client = typedClient({ action: 'correct', correct_link: '[[foo\r]]' });
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('no action taken');
    expect(writes).toHaveLength(0);
  });

  it('still applies a well-formed correct_link as before', async () => {
    const client = typedClient({ action: 'correct', correct_link: '[[real-target|Real Target]]' });
    const { ctx, writes } = makeCtx(client);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('corrected: [[real-target|Real Target]]');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[real-target|My Alias]]');
  });

  it('trims accidental padding inside the brackets before writing the link', async () => {
    // Uses BARE_SOURCE_CONTENT (no author-written alias on the dead link) so replaceDeadLink's
    // per-occurrence alias-preservation (see dead-link-detector.ts) doesn't mask the rebuilt
    // link behind an existing alias — this test is about the trim, not that preservation rule.
    const client = typedClient({ action: 'correct', correct_link: '[[ real-target | Real Target ]]' });
    const { ctx, writes } = makeCtx(client, BARE_SOURCE_CONTENT);

    const out = await fixDeadLink(ctx, 'wiki/concepts/MyPage.md', 'missing-target');

    expect(out).toContain('corrected: [[real-target|Real Target]]');
    expect(writes[0]!.content).toContain('[[real-target|Real Target]]');
    expect(writes[0]!.content).not.toContain(' real-target ');
  });
});
