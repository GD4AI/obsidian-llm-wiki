// Issue #824: `linkOrphanPage` appends `- {linkText} {linkTarget}` to the
// suggested page as-is. `validateOrphanLinkTarget` only checked that the string
// was not already present; it never checked that `link_target` resolves. The
// target the model supplies is a display-derived guess, so a real vault ends up
// with `[[sources/paste-rules]]` when the page is `sources/paste-rules_f7bbee`:
//
//   1. the orphan gains no inbound link and is re-reported on every lint, and
//   2. each run adds fresh dead links elsewhere.
//
// The issue also records duplicated text on one line —
// `[[entities/x|X]]. [[entities/x|X]]` — because `link_text` is a sentence the
// model writes and it sometimes already ends with the link.
//
// Two decisions, both from the report rather than from a guess: an unresolvable
// target is skipped before the write, and a `link_text` that already carries the
// link is not given a second copy.

import { describe, it, expect, vi } from 'vitest';
import { linkOrphanPage } from '../../../wiki/lint/link-orphan';
import type { EngineContext } from '../../../types';
import type { LLMClient } from '../../../types';

const ORPHAN = 'wiki/sources/paste-rules_f7bbee.md';
const ORPHAN_CONTENT = '# Paste rules\n\nNo inbound links.';
const RELATED = 'wiki/entities/paste-rules-summary.md';
const RELATED_CONTENT = '# Paste rules summary\n\nBody with no links yet.';

/** A plain `createMessage` client — the legacy path, which is all this needs. */
function makeClient(payload: unknown): LLMClient {
  return {
    createMessage: vi.fn(async () => JSON.stringify(payload)) as unknown as LLMClient['createMessage'],
  } as unknown as LLMClient;
}

function makeCtx(
  client: LLMClient,
  files: Record<string, string>,
  pageList: Array<{ path: string; basename: string }>,
  writes: Array<{ path: string; content: string }> = [],
): EngineContext {
  return {
    settings: { wikiFolder: 'wiki', wikiLanguage: 'en', disableThinking: false },
    app: {
      vault: { getMarkdownFiles: () => pageList },
      metadataCache: { getFileCache: () => null },
    },
    getClient: () => client,
    getSchemaContext: () => ({}),
    tryReadFile: async (path: string): Promise<string | null> => files[path] ?? null,
    createOrUpdateFile: async (path: string, content: string): Promise<void> => {
      writes.push({ path, content });
      files[path] = content;
    },
  } as unknown as EngineContext;
}

/** The vault as the report describes it: the real page carries a suffix. */
function realVault(): Array<{ path: string; basename: string }> {
  return [
    { path: ORPHAN, basename: 'paste-rules_f7bbee.md' },
    { path: RELATED, basename: 'paste-rules-summary.md' },
  ];
}

describe('linkOrphanPage — an unresolvable link_target must not be written (#824)', () => {
  it('skips the append and does not report the page as linking the orphan', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    // The guess the report measured: display-derived, and not the real page.
    const ctx = makeCtx(
      makeClient({ related_pages: [{ page_path: RELATED, link_text: 'See also', link_target: '[[sources/paste-rules]]' }] }),
      { [ORPHAN]: ORPHAN_CONTENT, [RELATED]: RELATED_CONTENT },
      realVault(),
      writes,
    );

    const linked = await linkOrphanPage(ctx, ORPHAN);

    expect(writes).toEqual([]);
    expect(linked).toEqual([]);
  });

  it('still appends a target that does resolve, so the check is not a blanket refusal', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const ctx = makeCtx(
      makeClient({ related_pages: [{ page_path: RELATED, link_text: 'See also', link_target: '[[sources/paste-rules_f7bbee]]' }] }),
      { [ORPHAN]: ORPHAN_CONTENT, [RELATED]: RELATED_CONTENT },
      realVault(),
      writes,
    );

    const linked = await linkOrphanPage(ctx, ORPHAN);

    expect(writes).toHaveLength(1);
    expect(writes[0].content).toContain('[[sources/paste-rules_f7bbee]]');
    expect(linked).toEqual([RELATED]);
  });

  it('writes the link once when link_text already ends with it', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const ctx = makeCtx(
      makeClient({
        related_pages: [{
          page_path: RELATED,
          link_text: 'See [[sources/paste-rules_f7bbee|Paste Rules]]',
          link_target: '[[sources/paste-rules_f7bbee|Paste Rules]]',
        }],
      }),
      { [ORPHAN]: ORPHAN_CONTENT, [RELATED]: RELATED_CONTENT },
      realVault(),
      writes,
    );

    await linkOrphanPage(ctx, ORPHAN);

    const occurrences = writes[0].content.split('[[sources/paste-rules_f7bbee|Paste Rules]]').length - 1;
    expect(occurrences).toBe(1);
  });
});
