// `PageRef.title` (`getExistingWikiPages`) is the filename slug, not a display name — title-casing it can't recover punctuation, spacing, or subscripts a real heading has.
// `displayTitle` (H1, or the first frontmatter alias when the body has none) must win over `title` in every branch of `fixDeadLink` that repairs a link to an already-existing page.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fixDeadLink } from '../../../wiki/lint/fix-dead-link';
import * as getExistingPages from '../../../wiki/lint/get-existing-pages';
import type { EngineContext, LLMClient } from '../../../types';

const SOURCE_CONTENT = '# My Page\n\nReferences [[haem-a3]] here.\n';

function makeCtx(client: LLMClient, sourceContent: string = SOURCE_CONTENT): { ctx: EngineContext; writes: Array<{ path: string; content: string }> } {
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

function noopClient(): LLMClient {
  return {
    createMessage: vi.fn(async () => '') as unknown as LLMClient['createMessage'],
  } as LLMClient;
}

describe('fixDeadLink — prefers displayTitle over the filename slug (#592)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pre-check: uses the H1-derived displayTitle, not the slug title', async () => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([
      {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
        displayTitle: 'Haem A₃',
        wikiLink: '[[entities/haem-a3|haem-a3]]',
      },
    ] as never);
    const { ctx, writes } = makeCtx(noopClient());

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'haem-a3');

    expect(out).toContain('pre-check corrected');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[entities/haem-a3|Haem A₃]]');
    expect(writes[0]!.content).not.toContain('|haem-a3]]');
  });

  it('pre-check: falls back to the raw title when no displayTitle is set', async () => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([
      {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
        wikiLink: '[[entities/haem-a3|haem-a3]]',
      },
    ] as never);
    const { ctx, writes } = makeCtx(noopClient());

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'haem-a3');

    expect(out).toContain('pre-check corrected');
    expect(writes[0]!.content).toContain('[[entities/haem-a3|haem-a3]]');
  });

  it('alias safety net: uses displayTitle when the LLM create_stub suggestion actually matches an existing alias', async () => {
    // Pre-check runs against the ORIGINAL link target ('totally-unrelated'), which matches nothing, so the LLM path runs. The LLM's suggested stub_title ('Cytochrome Haem A3') happens to match an existing page's alias — the safety-net re-check inside the create_stub branch, not the pre-check — is what must prefer displayTitle here.
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([
      {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
        displayTitle: 'Haem A₃',
        aliases: ['Cytochrome Haem A3'],
        wikiLink: '[[entities/haem-a3|haem-a3]]',
      },
    ] as never);
    const client = {
      createMessage: vi.fn(async () =>
        JSON.stringify({ action: 'create_stub', stub_title: 'Cytochrome Haem A3', stub_type: 'entity' })
      ) as unknown as LLMClient['createMessage'],
    } as LLMClient;
    const { ctx, writes } = makeCtx(client, '# My Page\n\nReferences [[totally-unrelated]] here.\n');

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'totally-unrelated');

    expect(out).toContain('safety-net corrected');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[entities/haem-a3|Haem A₃]]');
  });
});

// A dead link may already carry an author-written alias (`[[wrong-path|My Custom Alias]]`). That alias is a stronger signal than the target page's own displayTitle/H1 — the reader already saw this name, so repairing the path must not silently swap it out. Distinct from the displayTitle fallback above, which only applies when the link has no alias of its own.
describe('fixDeadLink — preserves an existing alias already in the dead link (#592)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pre-check: keeps the link\'s own existing alias over the target\'s displayTitle', async () => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([
      {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
        displayTitle: 'Haem A₃',
        wikiLink: '[[entities/haem-a3|haem-a3]]',
      },
    ] as never);
    const { ctx, writes } = makeCtx(noopClient(), '# My Page\n\nReferences [[wrong-path/haem-a3|My Custom Alias]] here.\n');

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'wrong-path/haem-a3');

    expect(out).toContain('pre-check corrected');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[entities/haem-a3|My Custom Alias]]');
    expect(writes[0]!.content).not.toContain('Haem A₃');
  });

  it('alias safety net: keeps the link\'s own existing alias over the target\'s displayTitle', async () => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([
      {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
        displayTitle: 'Haem A₃',
        aliases: ['Cytochrome Haem A3'],
        wikiLink: '[[entities/haem-a3|haem-a3]]',
      },
    ] as never);
    const client = {
      createMessage: vi.fn(async () =>
        JSON.stringify({ action: 'create_stub', stub_title: 'Cytochrome Haem A3', stub_type: 'entity' })
      ) as unknown as LLMClient['createMessage'],
    } as LLMClient;
    const { ctx, writes } = makeCtx(client, '# My Page\n\nReferences [[totally-unrelated|My Custom Alias]] here.\n');

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'totally-unrelated');

    expect(out).toContain('safety-net corrected');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[entities/haem-a3|My Custom Alias]]');
    expect(writes[0]!.content).not.toContain('Haem A₃');
  });

  // Issue #653 follow-up: extractDeadLinkAlias used to grab only the FIRST occurrence's
  // alias and stamp it onto every occurrence of the same target. Each occurrence must
  // keep its own alias instead.
  it('pre-check: keeps each occurrence\'s own alias, not just the first one\'s', async () => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([
      {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
        displayTitle: 'Haem A₃',
        wikiLink: '[[entities/haem-a3|haem-a3]]',
      },
    ] as never);
    const { ctx, writes } = makeCtx(
      noopClient(),
      '# My Page\n\nFirst mention [[wrong-path/haem-a3|receptors]], later [[wrong-path/haem-a3|the receptor]] again.\n'
    );

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'wrong-path/haem-a3');

    expect(out).toContain('pre-check corrected');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[entities/haem-a3|receptors]]');
    expect(writes[0]!.content).toContain('[[entities/haem-a3|the receptor]]');
  });

  it('deterministic fallback: keeps the link\'s own existing alias over the target\'s displayTitle', async () => {
    vi.spyOn(getExistingPages, 'getExistingWikiPages').mockResolvedValue([
      {
        path: 'wiki/entities/haem-a3.md',
        title: 'haem-a3',
        displayTitle: 'Haem A₃',
        wikiLink: '[[entities/haem-a3|haem-a3]]',
      },
    ] as never);
    // Empty LLM response with no retry payload drives fixDeadLink past both the pre-check (target name below doesn't match by title/alias/slug directly — the fallback's own slug/alias comparison is what should match 'haem-a3') and the LLM branches, into the deterministic fallback.
    const client = {
      createMessage: vi.fn(async () => '') as unknown as LLMClient['createMessage'],
    } as LLMClient;
    const { ctx, writes } = makeCtx(client, '# My Page\n\nReferences [[haem-a3|My Custom Alias]] here.\n');

    const out = await fixDeadLink(ctx, 'wiki/entities/MyPage.md', 'haem-a3');

    // NOTE: as of this writing the pre-check already matches 'haem-a3' by title, so this exercises the same code path as the first test above via a different entry point. Left in to pin the fallback branch's own newLink construction too, in case the pre-check's matching narrows in the future and this becomes the first test to actually reach it.
    expect(writes).toHaveLength(1);
    expect(writes[0]!.content).toContain('[[entities/haem-a3|My Custom Alias]]');
    expect(writes[0]!.content).not.toContain('Haem A₃');
  });
});
