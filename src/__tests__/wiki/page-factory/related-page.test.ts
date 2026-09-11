// Module-level unit tests for page-factory/related-page.ts
//
// v1.24.1 Phase 2 refactor: updateRelatedPage was lifted out of the
// PageFactory class. The tests pin the three-branch routing logic
// (no-new-info / reviewed: true / normal LLM rewrite).
//
// Note on naming vs behavior (pre-existing, NOT introduced by this refactor):
// `appendToReviewedPage` writes the LLM-generated body verbatim, NOT an
// append to `## New Information`. The name comes from the original
// createOrUpdatePage routing (#158, commit 5a00094) where the intent was
// "minimal append path that preserves curated content." The implementation
// drifted to LLM-rewrite without renaming. Fixing that semantic mismatch is
// OUT OF SCOPE for this pure-refactor split (it would change observable
// behavior). Tracked separately.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { updateRelatedPage, type RelatedPageContext } from '../../../wiki/page-factory/related-page';
import type { SourceAnalysis, LLMWikiSettings } from '../../../types';

const PAGE_PATH = 'wiki/entities/X.md';
const PAGE_TITLE = 'X';
const EXISTING_FM = `---\ncreated: 2026-07-10\nupdated: 2026-07-10\nsources:\n  - "[[existing]]"\ntags: []\n---\n\n## Description\nOld body.\n`;

function makeCtx(opts: {
  pages?: Array<{ path: string; basename: string }>;
  pageContent?: string;
  llmResponse?: string | null;
} = {}): RelatedPageContext & { written: Map<string, string> } {
  const written = new Map<string, string>();
  const pages = opts.pages ?? (opts.pageContent !== undefined ? [{ path: PAGE_PATH, basename: PAGE_TITLE }] : []);
  if (opts.pageContent !== undefined) {
    written.set(PAGE_PATH, opts.pageContent);
  }
  return {
    written,
    app: {
      vault: {
        getMarkdownFiles: () => pages,
        getAbstractFileByPath(p: string): unknown {
          if (p !== PAGE_PATH) return null;
          // Mirror createMockContext: assign path explicitly because the stub
          // TFile constructor does not store its arg.
          return Object.assign(new TFile(), { path: PAGE_PATH, basename: PAGE_TITLE });
        },
        async read(file: { path: string }): Promise<string> {
          return written.get(file.path) ?? '';
        },
      },
      // Empty harvest → incomingTypeTag falls back to the settings lists,
      // so the pre-S139 expectations below keep describing the same behavior.
      metadataCache: { getFileCache: () => null },
    } as RelatedPageContext['app'],
    settings: {
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      slugCase: 'preserve',
      disableThinking: false,
    } as LLMWikiSettings,
    async tryReadFile(p: string): Promise<string | null> {
      return written.get(p) ?? null;
    },
    async createOrUpdateFile(p: string, c: string): Promise<void> {
      written.set(p, c);
    },
    getClient: () => opts.llmResponse === null
      ? null
      : { createMessage: async () => opts.llmResponse ?? 'new body' },
    buildSystemPrompt: async () => 'system',
  };
}

function makeAnalysis(matchingName?: string): SourceAnalysis {
  const entities = matchingName
    ? [{
        name: matchingName,
        type: 'other' as const,
        summary: 's',
        mentions_in_source: [],
        related_entities: [],
        related_concepts: [],
      }]
    : [{
        name: 'OtherEntity',
        type: 'other' as const,
        summary: 's',
        mentions_in_source: [],
        related_entities: [],
        related_concepts: [],
      }];
  return {
    source_file: 'src.md',
    source_title: 'src',
    summary: '',
    entities,
    concepts: [],
    related_pages: [],
    key_points: [],
    created_pages: [],
    updated_pages: [],
  };
}

describe('updateRelatedPage — page not found', () => {
  it('returns false when no existing page matches the name', async () => {
    const ctx = makeCtx(); // empty pages
    const result = await updateRelatedPage(
      ctx,
      'Karpathy',
      makeAnalysis('Karpathy'),
      { path: 'p.md', basename: 'p.md' },
    );
    expect(result).toBe(false);
    expect(ctx.written.size).toBe(0);
  });
});

describe('updateRelatedPage — no matching entity (#131 fast path)', () => {
  it('re-merges frontmatter only — body is preserved verbatim, LLM is NOT called', async () => {
    const ctx = makeCtx({ pageContent: EXISTING_FM });
    const result = await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      makeAnalysis('SomeOtherName'), // no entity named 'X'
      { path: 'src.md', basename: 'src.md' },
    );
    expect(result).toBe(true);
    const written = ctx.written.get(PAGE_PATH)!;
    // Body preserved verbatim.
    expect(written).toContain('## Description');
    expect(written).toContain('Old body.');
    // The new source was added to the sources: list.
    expect(written).toContain('src.md');
  });
});

describe('updateRelatedPage — reviewed: true guards the routing (Issue #158)', () => {
  // The reviewed branch is observed via routing: when the page has
  // `reviewed: true`, the LLM body still gets written but via
  // appendToReviewedPage rather than the normal merge prompt. The
  // observable difference for this test is that the reviewed flag is
  // preserved through the frontmatter rewrite AND the LLM body lands in
  // the output. We do NOT assert curated-body preservation here because
  // the current implementation of appendToReviewedPage replaces the body
  // with LLM output (a pre-existing semantic mismatch with the function
  // name — see file header comment).
  it('preserves reviewed: true and writes via appendToReviewedPage (LLM body path)', async () => {
    const reviewedContent = `---\ncreated: 2026-07-10\nupdated: 2026-07-10\nsources:\n  - "[[existing]]"\ntags: []\nreviewed: true\n---\n\n## Curated\nLocked.\n`;
    const ctx = makeCtx({
      pageContent: reviewedContent,
      llmResponse: '## New section\nLLM body.',
    });
    const result = await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      makeAnalysis(PAGE_TITLE),
      { path: 'src.md', basename: 'src.md' },
    );
    expect(result).toBe(true);
    const written = ctx.written.get(PAGE_PATH)!;
    // The `reviewed: true` marker survived the frontmatter rewrite.
    expect(written).toMatch(/reviewed:\s*true/);
    // The LLM body made it into the output (via appendToReviewedPage).
    expect(written).toContain('LLM body.');
  });
});

describe('updateRelatedPage — normal path rewrites via LLM', () => {
  it('writes the LLM-produced body when no skip branch fires', async () => {
    const ctx = makeCtx({
      pageContent: EXISTING_FM,
      llmResponse: '## Description\nNew body.',
    });
    const result = await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      makeAnalysis(PAGE_TITLE),
      { path: 'src.md', basename: 'src.md' },
    );
    expect(result).toBe(true);
    const written = ctx.written.get(PAGE_PATH)!;
    expect(written).toContain('New body.');
  });

  it('throws when no LLM client is configured (normal path)', async () => {
    const ctx = makeCtx({
      pageContent: EXISTING_FM,
      llmResponse: null,
    });
    await expect(
      updateRelatedPage(ctx, PAGE_TITLE, makeAnalysis(PAGE_TITLE), { path: 'src.md', basename: 'src.md' }),
    ).rejects.toThrow(/LLM client not initialized/);
  });
});

// Issue #267 established a non-lossy re-ingest on the merge path. This path
// never had it: the Mentions section lives in the body handed to the LLM, and
// the reply was persisted verbatim, so a rewrite that dropped the section
// destroyed every accumulated quote. Observed in the wild with a local model:
// a 2-source hub lost 4 quotes, a 3-source hub lost 1.
describe('updateRelatedPage — Mentions are never LLM-owned (#267 parity)', () => {
  const PAGE_WITH_MENTIONS = [
    '---',
    'created: 2026-07-10',
    'updated: 2026-07-10',
    'sources:',
    '  - "[[sources/old]]"',
    'tags: []',
    '---',
    '',
    '## Description',
    'Old body.',
    '',
    '## Mentions in Source',
    '',
    '- "a curated quote from an earlier source" — [[sources/old|old]]',
  ].join('\n');

  function analysisWithMentions(): SourceAnalysis {
    return {
      ...makeAnalysis(PAGE_TITLE),
      entities: [{
        name: PAGE_TITLE,
        type: 'other' as const,
        summary: 's',
        mentions_in_source: ['a fresh quote from the new source'],
        related_entities: [],
        related_concepts: [],
      }],
    };
  }

  it('preserves accumulated quotes when the LLM rewrite omits the Mentions section', async () => {
    const ctx = makeCtx({
      pageContent: PAGE_WITH_MENTIONS,
      llmResponse: '## Description\nA rewritten body with no mentions section at all.',
    });

    const result = await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      analysisWithMentions(),
      { path: 'sources/new.md', basename: 'new' },
    );

    expect(result).toBe(true);
    const written = ctx.written.get(PAGE_PATH)!;
    expect(written).toContain('a curated quote from an earlier source');
    expect(written).toContain('[[sources/old|old]]');
    // The LLM's new prose is still adopted.
    expect(written).toContain('A rewritten body with no mentions section at all.');
  });

  it('unions the new source\'s mentions with the accumulated ones', async () => {
    const ctx = makeCtx({
      pageContent: PAGE_WITH_MENTIONS,
      llmResponse: '## Description\nRewritten.',
    });

    await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      analysisWithMentions(),
      { path: 'sources/new.md', basename: 'new' },
    );

    const written = ctx.written.get(PAGE_PATH)!;
    expect(written).toContain('a curated quote from an earlier source');
    expect(written).toContain('a fresh quote from the new source');
  });

  it('canonicalizes a garbled section label in the LLM rewrite (#241 parity)', async () => {
    const ctx = makeCtx({
      pageContent: PAGE_WITH_MENTIONS,
      // One edit away from the canonical label. Uncanonicalized, the injector
      // would not recognize it, append a second section, and leave this one
      // behind as an orphan that label-exact retrieval can no longer see.
      llmResponse: '## Description\nRewritten.\n\n## Mentions in Sourse\n\n- stale',
    });

    await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      analysisWithMentions(),
      { path: 'sources/new.md', basename: 'new' },
    );

    const written = ctx.written.get(PAGE_PATH)!;
    expect(written).not.toContain('Mentions in Sourse');
    expect(written.match(/^## Mentions in Source$/gm)).toHaveLength(1);
  });

  it('does not feed the Mentions section into the rewrite prompt', async () => {
    let seenPrompt = '';
    const ctx = makeCtx({ pageContent: PAGE_WITH_MENTIONS });
    ctx.getClient = () => ({
      createMessage: async (req: { messages: Array<{ content: string }> }) => {
        seenPrompt = req.messages[0].content;
        return '## Description\nRewritten.';
      },
    }) as ReturnType<RelatedPageContext['getClient']>;

    await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      analysisWithMentions(),
      { path: 'sources/new.md', basename: 'new' },
    );

    // The model never sees the citations, so it cannot drift their format.
    expect(seenPrompt).not.toContain('a curated quote from an earlier source');
    expect(seenPrompt).toContain('Old body.');
  });
});
// #312 part 3 — the related-page rewrite prompt had no output format block, so
// the model was free to open the page with the newest source's facts. The
// contract mirrors appendToReviewedPage: existing content keeps its position,
// new information comes after it.
describe('updateRelatedPage — output order contract (#312)', () => {
  it('renders an explicit output format placing new information AFTER existing content', async () => {
    let seenPrompt = '';
    const ctx = makeCtx({ pageContent: EXISTING_FM });
    ctx.getClient = () => ({
      createMessage: async (req: { messages: Array<{ content: string }> }) => {
        seenPrompt = req.messages[0].content;
        return '## Description\nOld body.\n\n## Extra\nNew facts.';
      },
    }) as ReturnType<RelatedPageContext['getClient']>;

    const result = await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      makeAnalysis(PAGE_TITLE),
      { path: 'src.md', basename: 'src' },
    );

    expect(result).toBe(true);
    expect(seenPrompt).toContain('**Output Format:**');
    expect(seenPrompt).toContain('NEVER place new information above the existing content.');
  });

  it('orders the two output slots existing-before-new in the rendered prompt', async () => {
    let seenPrompt = '';
    const ctx = makeCtx({ pageContent: EXISTING_FM });
    ctx.getClient = () => ({
      createMessage: async (req: { messages: Array<{ content: string }> }) => {
        seenPrompt = req.messages[0].content;
        return '## Description\nOld body.';
      },
    }) as ReturnType<RelatedPageContext['getClient']>;

    await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      makeAnalysis(PAGE_TITLE),
      { path: 'src.md', basename: 'src' },
    );

    const existingSlot = seenPrompt.indexOf('[existing sections');
    const newSlot = seenPrompt.indexOf('[new information');
    expect(existingSlot).toBeGreaterThan(-1);
    expect(newSlot).toBeGreaterThan(-1);
    // Positional contract, not merely textual presence.
    expect(existingSlot).toBeLessThan(newSlot);
  });
});

// The rendering bug the output-order work uncovered: `{{page_name}}` occurs
// twice in the template, and `String.prototype.replace` with a string pattern
// substitutes only the first occurrence. Every related-page rewrite therefore
// asked the model to add information about a literal `{{page_name}}`.
describe('updateRelatedPage — placeholder rendering', () => {
  it('substitutes every {{page_name}} occurrence, not just the first', async () => {
    let seenPrompt = '';
    const ctx = makeCtx({ pageContent: EXISTING_FM });
    ctx.getClient = () => ({
      createMessage: async (req: { messages: Array<{ content: string }> }) => {
        seenPrompt = req.messages[0].content;
        return '## Description\nOld body.';
      },
    }) as ReturnType<RelatedPageContext['getClient']>;

    await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      makeAnalysis(PAGE_TITLE),
      { path: 'src.md', basename: 'src' },
    );

    expect(seenPrompt).toContain(`provides additional information about ${PAGE_TITLE}`);
    expect(seenPrompt).not.toContain('{{page_name}}');
    // Note: `{{existing_pages}}` does survive here, but it comes from the
    // shared UNIVERSAL_LINK_CONSTRAINTS prose and is not a placeholder this
    // template renders. Out of scope for this fix — asserted narrowly so the
    // test pins the bug it is about.
  });
});

// #419 — end-to-end on this call site: the model returns a body that starts at
// the first `##`, and the written page must still carry its title.
describe('updateRelatedPage — H1 survives a rewrite that omits it', () => {
  it('writes the page\'s own title back when the reply has none', async () => {
    const withTitle = `---\ncreated: 2026-07-10\nupdated: 2026-07-10\nsources:\n  - "[[existing]]"\ntags: []\n---\n\n# X — a title the file name cannot reproduce\n\n## Description\nOld body.\n`;
    const ctx = makeCtx({ pageContent: withTitle, llmResponse: '## Description\nNew body.' });

    const result = await updateRelatedPage(
      ctx,
      PAGE_TITLE,
      makeAnalysis(PAGE_TITLE),
      { path: 'src.md', basename: 'src' },
    );

    expect(result).toBe(true);
    const written = ctx.written.get(PAGE_PATH) ?? '';
    expect(written).toContain('# X — a title the file name cannot reproduce');
    expect(written).toContain('New body.');
    // Restored, not merely retained somewhere: the title leads the body.
    const body = written.split('---').slice(2).join('---');
    expect(body.trimStart().startsWith('# X —')).toBe(true);
  });
});

describe('updateRelatedPage — only entity and concept pages are related targets', () => {
  const SOURCE_PATH = 'wiki/sources/X.md';

  // The stock mock resolves only PAGE_PATH; here both the source twin and the
  // entity page must resolve, so a wrong pick writes to the wrong file
  // instead of vanishing behind a null lookup.
  function makeTwinCtx(pages: Array<{ path: string; basename: string }>) {
    const ctx = makeCtx({ pageContent: EXISTING_FM, pages });
    ctx.written.set(SOURCE_PATH, EXISTING_FM);
    ctx.app.vault.getAbstractFileByPath = (p: string): unknown =>
      p === PAGE_PATH || p === SOURCE_PATH
        ? Object.assign(new TFile(), { path: p, basename: PAGE_TITLE })
        : null;
    return ctx;
  }

  it('rewrites the entity page when a source page shares its basename and is listed first', async () => {
    const ctx = makeTwinCtx([
      { path: SOURCE_PATH, basename: PAGE_TITLE },
      { path: PAGE_PATH, basename: PAGE_TITLE },
    ]);
    const result = await updateRelatedPage(ctx, PAGE_TITLE, makeAnalysis(PAGE_TITLE), { path: 'p.md', basename: 'p' });
    expect(result).toBe(true);
    expect(ctx.written.get(PAGE_PATH)).toContain('new body');
    expect(ctx.written.get(SOURCE_PATH)).toBe(EXISTING_FM);
  });

  it('returns false and writes nothing when only a source page carries the name', async () => {
    const ctx = makeTwinCtx([{ path: SOURCE_PATH, basename: PAGE_TITLE }]);
    const result = await updateRelatedPage(ctx, PAGE_TITLE, makeAnalysis(PAGE_TITLE), { path: 'p.md', basename: 'p' });
    expect(result).toBe(false);
    expect(ctx.written.get(SOURCE_PATH)).toBe(EXISTING_FM);
  });
});
