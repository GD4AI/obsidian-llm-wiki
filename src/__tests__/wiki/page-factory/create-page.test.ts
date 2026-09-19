// Module-level unit tests for page-factory/create-page.ts
//
// v1.24.1 Phase 2 refactor: createOrUpdatePage / createNewPage /
// createOrUpdateEntityPage / createOrUpdateConceptPage were lifted out of
// the PageFactory class. The tests pin the createOrUpdatePage routing
// logic (collision / new-file / reviewed / normal merge) and the new-page
// generation contract (LLM body + programmatic Mentions injection #244).

import { describe, it, expect } from 'vitest';
import {
  createOrUpdateEntityPage,
  createOrUpdateConceptPage,
  createNewPage,
  type CreatePageContext,
} from '../../../wiki/page-factory/create-page';
import { createMockEntity, createMockConcept } from '../../__support__/factories';
import type { LLMWikiSettings, LLMClient } from '../../../types';
import { localDateStamp } from '../../../core/format';
import { mockExistingWikiPages } from '../../__support__/engine-context';
import type { WikiPageRef } from '../../../types';

const EXISTING_FM = `---\ncreated: 2026-07-10\nupdated: 2026-07-10\nsources:\n  - "[[existing]]"\ntags: []\n---\n\n## Description\nOld body.\n`;

function makeCtx(opts: {
  files?: Record<string, string>;
  llmResponse?: string | null;
  mockVault?: { getMarkdownFiles: () => Array<{ path: string; basename: string }> };
} = {}): CreatePageContext & { written: Map<string, string> } {
  const files = new Map<string, string>(Object.entries(opts.files ?? {}));
  return {
    written: files,
    app: {
      vault: {
        getMarkdownFiles: opts.mockVault?.getMarkdownFiles ?? (() => []),
        read: async (f: { path: string }): Promise<string> => files.get(f.path) ?? '',
      },
    },
    settings: {
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      slugCase: 'preserve',
      disableThinking: false,
    } as LLMWikiSettings,
    async tryReadFile(p: string): Promise<string | null> {
      return files.get(p) ?? null;
    },
    async createOrUpdateFile(p: string, c: string): Promise<void> {
      files.set(p, c);
    },
    getClient: () => opts.llmResponse === null
      ? null
      : { createMessage: async () => opts.llmResponse ?? '## Description\nLLM body.' },
    buildSystemPrompt: async () => 'system',
    getExistingWikiPages(): Promise<WikiPageRef[]> {
      return mockExistingWikiPages(this)();
    },
  };
}

// #312: the third parameter used to be `unknown` and was dropped on the floor;
// it now carries the source analysis. These cases exercise the no-analysis
// path (lint-side callers), which is exactly what `{} as unknown` meant here.
const EMPTY_ANALYSIS = undefined;

describe('createOrUpdatePage — empty name guard', () => {
  it('returns path=null when name is empty', async () => {
    const ctx = makeCtx();
    const result = await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: '   ' }),
      EMPTY_ANALYSIS,
      { path: 'p.md', basename: 'p.md' },
    );
    expect(result.path).toBeNull();
  });
});

describe('createOrUpdatePage — new-page path', () => {
  it('creates a new page when the resolved path does not exist', async () => {
    const ctx = makeCtx({ llmResponse: '## Description\nNew entity.' });
    const result = await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: 'NewEntity' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
    );
    expect(result.path).toBe('wiki/entities/NewEntity.md');
    const written = ctx.written.get('wiki/entities/NewEntity.md')!;
    expect(written).toContain('New entity.');
  });
});

describe('createOrUpdatePage — existing reviewed page routes to appendToReviewedPage', () => {
  it('routes to appendToReviewedPage when the existing page has reviewed: true', async () => {
    const reviewedContent = `---\ncreated: 2026-07-10\nupdated: 2026-07-10\nsources:\n  - "[[existing]]"\ntags: []\nreviewed: true\n---\n\n## Curated\nLocked.\n`;
    const ctx = makeCtx({
      files: { 'wiki/entities/X.md': reviewedContent },
      llmResponse: '## New\nLLM body.',
    });
    const result = await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: 'X' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
    );
    expect(result.path).toBe('wiki/entities/X.md');
    const written = ctx.written.get('wiki/entities/X.md')!;
    // The `reviewed: true` marker survived the routing.
    expect(written).toMatch(/reviewed:\s*true/);
    expect(written).toContain('LLM body.');
  });
});

describe('createOrUpdatePage — existing non-reviewed page routes to mergePage', () => {
  it('routes to mergePage when the existing page is not reviewed', async () => {
    const ctx = makeCtx({
      files: { 'wiki/entities/X.md': EXISTING_FM },
      llmResponse: '## Description\nMerged body.',
    });
    const result = await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: 'X' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
    );
    expect(result.path).toBe('wiki/entities/X.md');
    const written = ctx.written.get('wiki/entities/X.md')!;
    expect(written).toContain('Merged body.');
  });
});

describe('createOrUpdateConceptPage', () => {
  it('delegates to the router with pageType=concept', async () => {
    const ctx = makeCtx({ llmResponse: '## Description\nConcept body.' });
    const result = await createOrUpdateConceptPage(
      ctx,
      createMockConcept({ name: 'Caching' }),
      EMPTY_ANALYSIS,
      { path: 'p.md', basename: 'p.md' },
    );
    expect(result.path).toBe('wiki/concepts/Caching.md');
  });
});

describe('createNewPage — client precondition', () => {
  it('throws when no LLM client is configured', async () => {
    const ctx = makeCtx({ llmResponse: null });
    await expect(
      createNewPage(
        ctx,
        createMockEntity({ name: 'X' }),
        'entity',
        { path: 'p.md', basename: 'p.md' },
        [],
        'wiki/entities/X.md',
      ),
    ).rejects.toThrow(/LLM client not initialized/);
  });
});

describe('createNewPage — programmatic Mentions injection (Issue #244)', () => {
  it('injects the Mentions section with the new entity\'s mentions', async () => {
    const ctx = makeCtx({ llmResponse: '## Description\nBody without mentions.' });
    await createNewPage(
      ctx,
      createMockEntity({ name: 'X', mentions_in_source: ['quote-A', 'quote-B'] }),
      'entity',
      { path: 'notes/article.md', basename: 'article.md' },
      [],
      'wiki/entities/X.md',
    );
    const written = ctx.written.get('wiki/entities/X.md')!;
    // The Mentions section was appended programmatically.
    expect(written).toContain('Mentions in Source');
    expect(written).toContain('quote-A');
    expect(written).toContain('quote-B');
  });
});

describe('createNewPage — conversation source uses single synthetic citation', () => {
  it('emits a Conversation: citation (not the multi-quote list) for conversation sources', async () => {
    const ctx = makeCtx({ llmResponse: '## Description\nBody.' });
    await createNewPage(
      ctx,
      createMockEntity({ name: 'X', mentions_in_source: ['should-not-appear'] }),
      'entity',
      { path: 'wiki/sources/conv.md', basename: 'conv' },
      [],
      'wiki/entities/X.md',
    );
    const written = ctx.written.get('wiki/entities/X.md')!;
    expect(written).toContain('Conversation: conv');
    expect(written).not.toContain('should-not-appear');
  });
});

describe('createNewPage — wraps errors with entity context', () => {
  it('throws a contextualized error when the LLM client fails', async () => {
    const failingClient: LLMClient = {
      createMessage: async () => { throw new Error('rate limit'); },
    };
    const ctx: CreatePageContext & { written: Map<string, string> } = {
      written: new Map(),
      app: { vault: { getMarkdownFiles: () => [], read: async () => '' } },
      settings: { wikiFolder: 'wiki', wikiLanguage: 'en', slugCase: 'preserve', disableThinking: false } as LLMWikiSettings,
      async tryReadFile() { return null; },
      async createOrUpdateFile() {},
      getClient: () => failingClient,
      buildSystemPrompt: async () => 'system',
      getExistingWikiPages(): Promise<WikiPageRef[]> {
        return mockExistingWikiPages(this)();
      },
    };
    await expect(
      createNewPage(
        ctx,
        createMockEntity({ name: 'Karpathy' }),
        'entity',
        { path: 'p.md', basename: 'p.md' },
        [],
        'wiki/entities/Karpathy.md',
      ),
    ).rejects.toThrow(/Failed to create entity page "Karpathy"/);
  });
});
// ─── #290: the result reports create-vs-update ───────────────────────────
//
// The ingest log listed every written page under "Created pages", including
// pages that already existed and were merged into. That hid the risky half of
// an ingest: merges are where existing content can be lost, creations have
// nothing to lose. The router already performs the pre-write existence check
// that decides create-vs-merge, so it reports what actually happened rather
// than what the caller intended.

describe('#290 — PageCreationResult.created reflects the pre-write existence check', () => {
  it('reports created:true when the page did not exist', async () => {
    const ctx = makeCtx({ llmResponse: '## Description\nNew entity.' });
    const result = await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: 'NewEntity' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
    );
    expect(result.created).toBe(true);
  });

  it('reports created:false when merging into a page that already existed', async () => {
    const ctx = makeCtx({
      files: { 'wiki/entities/X.md': EXISTING_FM },
      llmResponse: '## Description\nMerged body.',
    });
    const result = await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: 'X' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
    );
    expect(result.path).toBe('wiki/entities/X.md');
    expect(result.created).toBe(false);
  });

  it('reports created:false when appending to an existing reviewed page', async () => {
    const reviewedContent = `---\ncreated: 2026-07-10\nupdated: 2026-07-10\nsources:\n  - "[[existing]]"\ntags: []\nreviewed: true\n---\n\n## Curated\nLocked.\n`;
    const ctx = makeCtx({
      files: { 'wiki/entities/X.md': reviewedContent },
      llmResponse: '## New\nLLM body.',
    });
    const result = await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: 'X' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
    );
    expect(result.created).toBe(false);
  });

  it('reports created:false for the empty-name guard, which writes nothing', async () => {
    const ctx = makeCtx({});
    const result = await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: '   ' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
    );
    expect(result.path).toBeNull();
    expect(result.created).toBe(false);
  });

  it('reports created:false for a concept merged into an existing page', async () => {
    const ctx = makeCtx({
      files: { 'wiki/concepts/Y.md': EXISTING_FM },
      llmResponse: '## Description\nMerged concept.',
    });
    const result = await createOrUpdateConceptPage(
      ctx,
      createMockConcept({ name: 'Y' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
    );
    expect(result.created).toBe(false);
  });
});

// ─── #365 v1.25.11 PATCH: stamp `sources:` provenance on new pages ────────
//
// Root cause: `enforceFrontmatterConstraints` rewrites the frontmatter
// block from scratch using only the canonical keys `type/created/updated/
// tags/aliases/reviewed`. The `sources:` key is canonical but the
// constructor does not surface it, so it is dropped from the new-page
// output. `merge-page.ts:93` has the right behavior via `mergeFrontmatter`;
// `create-page.ts` has to acquire it via the same shape.
//
// How the test surface maps to the bug:
//   - calling `createNewPage` with `sourceSlug='source-slug-foo'` and then
//     reading back the written file MUST contain `sources: [[[sources/
//     source-slug-foo]]]`. (Currently fails: `enforceFrontmatterConstraints`
//     strips it.)
//   - calling `createOrUpdateEntityPage` without `sourceSlug` (the
//     conversation-ingest.ts:251 call site does this) MUST NOT synthesize
//     a garbage sources: entry. (Currently passes by accident — but
//     pinning prevents regressions after the GREEN edit lands.)
//   - calling `createNewPage` twice with the same `sourceSlug` and writing
//     to the same path dedups (Plan A's chosen helper does dedup; this
//     pins that contract).

describe('#365 — sources: stamp on createNewPage', () => {
  // Mock LLM output that mimics a real ingest response: `enforceFrontmatterConstraints`
  // would rewrite the frontmatter block (preserving type/created/updated/tags) but
  // historically dropped `sources:` because the rewriter only enumerates a fixed
  // allowlist of canonical keys. Body shape: `type:` + `tags:` set + raw body.
  const REAL_LLM_BODY_WITH_FRONTMATTER = `---
type: entity
created: 2026-07-30
updated: 2026-07-30
tags:
  - other
aliases: []
---

## Description
Body.`;

  it('stamps sources: [[[sources/<slug>]]] when sourceSlug is provided', async () => {
    const ctx = makeCtx({ llmResponse: REAL_LLM_BODY_WITH_FRONTMATTER });
    await createNewPage(
      ctx,
      createMockEntity({ name: 'Foo' }),
      'entity',
      { path: 'notes/article.md', basename: 'article.md' },
      [],
      'wiki/entities/Foo.md',
      'source-slug-foo',
    );
    const written = ctx.written.get('wiki/entities/Foo.md')!;
    // Body survived AND the frontmatter carries the canonical
    // `[[sources/<slug>]]` wikilink form, byte-identical to what
    // `merge-page.ts:93` writes. `core/frontmatter.ts:490` rewraps every
    // entry in `[[ ]]` regardless of input shape, and `merge-page.ts:95`
    // goes through the same helper.
    expect(written).toContain('## Description\nBody.');
    expect(written).toMatch(/sources:\s*\n\s*-\s*"?\[\[sources\/source-slug-foo\]\]"?/);

    // Structural frontmatter guard: the file must open with EXACTLY ONE
    // `---` fence (not two). `mergeFrontmatter`'s `frontmatter` field
    // already includes the delimiters (it goes through
    // `serializeFrontmatter` at frontmatter.ts:428+458). Re-wrapping it
    // in another `---\n...\n---` would corrupt the frontmatter block —
    // the first fence would close on the second `---`, demoting the real
    // metadata to body text. This is the v1.25.11 PATCH simplify-fix
    // regression guard; the test would have caught the original Phase 1
    // double-`---` bug if it had been written first.
    const fenceMatches = written.match(/^---\s*$/gm) ?? [];
    expect(fenceMatches.length, 'expected exactly 2 `---` fences (one open, one close) — not 4').toBe(2);
  });

  it('does NOT stamp a synthetic sources: entry when sourceSlug is undefined', async () => {
    // Mirrors the conversation-ingest.ts call site (4-arg
    // createOrUpdateEntityPage), which never has a sourceSlug.
    const ctx = makeCtx({ llmResponse: REAL_LLM_BODY_WITH_FRONTMATTER });
    await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: 'NoSource' }),
      EMPTY_ANALYSIS,
      { path: 'notes/no-source.md', basename: 'no-source.md' },
    );
    const written = ctx.written.get('wiki/entities/NoSource.md')!;
    // No garbage `sources: ["<random path>"]` from a path we did not intend.
    // The bare boolean asserts: the frontmatter either omits sources: or
    // carries a deliberately empty value, NOT a phantom source path.
    const sourcesMatch = written.match(/^sources:\s*(\[?\s*([^\]]*?)\s*\]?|.+?)(?=\n[a-zA-Z_-]+:|\n---)/m);
    const sourcesValue = sourcesMatch?.[2]?.trim() ?? '';
    expect(sourcesValue).not.toContain('notes/');
    expect(sourcesValue).not.toMatch(/^\[\[sources\//);
  });
});

describe('#365 — idempotency on repeated source-slug stamp', () => {
  it('does not duplicate sources: entries across repeated createNewPage calls with the same slug', async () => {
    const REAL_LLM_BODY_WITH_FRONTMATTER = `---
type: entity
created: 2026-07-30
updated: 2026-07-30
tags:
  - other
aliases: []
---

## Description
Body.`;
    const ctx = makeCtx({ llmResponse: REAL_LLM_BODY_WITH_FRONTMATTER });
    // First call writes the page. Because `ctx.createOrUpdateFile` is a
    // mock that just stores into a Map, the second call reads it back via
    // `tryReadFile`, which short-circuits the createNewPage branch
    // (existingContent present) and routes to mergePage — so the
    // observable signal here is the merged-file sources: list carrying
    // exactly one entry, not two.
    await createNewPage(
      ctx,
      createMockEntity({ name: 'Twice' }),
      'entity',
      { path: 'notes/article.md', basename: 'article.md' },
      [],
      'wiki/entities/Twice.md',
      'same-slug',
    );
    await createOrUpdateEntityPage(
      ctx,
      createMockEntity({ name: 'Twice' }),
      EMPTY_ANALYSIS,
      { path: 'notes/article.md', basename: 'article.md' },
      [],
      'same-slug',
    );
    const written = ctx.written.get('wiki/entities/Twice.md')!;
    const sourcesLines = written.split('\n').filter((line) => line.includes('sources/same-slug'));
    // Expect exactly one occurrence in the file body (not "same-slug same-slug")
    expect(sourcesLines.length).toBe(1);
  });
});

describe('createNewPage — created: provenance (Issue #388)', () => {
  it('stamps today even when the model writes a date of its own', async () => {
    // The rule the prompt states ("created: … NEVER LLM-generated") is only as
    // good as the code behind it: on this path no prior file exists, so a date
    // in the model's reply cannot be anything but invented.
    const ctx = makeCtx({
      llmResponse: '---\ntype: entity\ncreated: 2024-11-03\nupdated: 2024-11-03\ntags: [other]\n---\n\n## Description\nBody.',
    });
    await createNewPage(
      ctx,
      createMockEntity({ name: 'X' }),
      'entity',
      { path: 'notes/article.md', basename: 'article.md' },
      [],
      'wiki/entities/X.md',
    );
    const written = ctx.written.get('wiki/entities/X.md')!;
    const today = localDateStamp();
    expect(written).toContain(`created: ${today}`);
    expect(written).not.toContain('2024-11-03');
  });
});

describe('createNewPage — an alias that repeats the page filename is not persisted', () => {
  // Same rule as `appendAliases` (`filterRedundantAliases`): the page's own
  // name is a self-pointing alias. The model lists it routinely on the create
  // path; the generated frontmatter goes through `enforceFrontmatterConstraints`,
  // which now receives the page path and applies the rule there.
  const LLM_PAGE_WITH_SELF_ALIAS = `---
type: entity
tags:
  - other
aliases:
  - "Foo"
  - "Foo bar"
  - "FB"
---

## Description
Body.`;

  it('writes the other aliases and drops the one equal to the basename', async () => {
    const ctx = makeCtx({ llmResponse: LLM_PAGE_WITH_SELF_ALIAS });
    await createNewPage(
      ctx,
      createMockEntity({ name: 'Foo' }),
      'entity',
      { path: 'notes/article.md', basename: 'article.md' },
      [],
      'wiki/entities/Foo.md',
    );
    const written = ctx.written.get('wiki/entities/Foo.md')!;
    expect(written).toMatch(/aliases:\n  - "Foo bar"\n  - "FB"\n/);
    expect(written).not.toMatch(/- "Foo"\n/);
  });
});
