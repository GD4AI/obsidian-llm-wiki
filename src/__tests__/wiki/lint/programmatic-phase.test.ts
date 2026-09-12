import { describe, it, expect } from 'vitest';
import { runProgrammaticPhase } from '../../../wiki/lint/phases/programmatic';
import { LintPhaseContext, ScannerPage } from '../../../wiki/lint/types';
import { LLMWikiSettings } from '../../../types';
import type { Graph } from '../../../core/monte-carlo-ppr';

function makeContext(settings?: Partial<LLMWikiSettings>): LintPhaseContext {
  return {
    // the one vocabulary (vocabulary.ts) is harvested before the tag scan
    app: { vault: { getMarkdownFiles: () => [] }, metadataCache: { getFileCache: () => null } } as unknown as LintPhaseContext['app'],
    settings: {
      wikiFolder: 'wiki',
      language: 'en',
      slugCase: 'lower',
      tagVocabularyMode: 'default',
      customEntityTags: '',
      customConceptTags: '',
      ...settings,
    } as LLMWikiSettings,
    llmClient: () => null, // programmatic phase does not consume LLM
    wikiEngine: { updateStatusBar: () => {} } as unknown as LintPhaseContext['wikiEngine'],
    checkCancelled: () => {},
    stageNotice: null,
    totalPages: 0,
    buildSystemPrompt: async () => undefined,
  };
}

function makePageMap(entries: Record<string, string>): Map<string, ScannerPage> {
  const m = new Map<string, ScannerPage>();
  for (const [path, content] of Object.entries(entries)) {
    m.set(path, { path, content, basename: path.split('/').pop() || '' });
  }
  return m;
}

function makeWikiFiles(paths: string[]): Array<{ path: string; basename: string }> {
  return paths.map(p => ({ path: p, basename: p.split('/').pop()?.replace('.md', '') || '' }));
}

function emptyGraph(): Graph {
  return { nodes: [], edges: new Map() };
}

describe('runProgrammaticPhase', () => {
  it('returns alias-deficient pages', async () => {
    const ctx = makeContext();
    const pageMap = makePageMap({
      'wiki/entities/Foo.md': '---\ntype: entity\n---\n\nBody',
    });
    const result = await runProgrammaticPhase(ctx, {
      wikiFiles: makeWikiFiles(['wiki/entities/Foo.md']),
      pageMap,
      knownTargets: new Set(),
      knownTargetsLower: new Set(),
      graph: emptyGraph(),
    });
    expect(result.aliasDeficientPages).toHaveLength(1);
  });

  it('returns orphan pages', async () => {
    const ctx = makeContext();
    const pageMap = makePageMap({
      'wiki/entities/Orphan.md': '---\ntype: entity\n---\n\nNo links.',
    });
    const result = await runProgrammaticPhase(ctx, {
      wikiFiles: makeWikiFiles(['wiki/entities/Orphan.md']),
      pageMap,
      knownTargets: new Set(),
      knownTargetsLower: new Set(),
      graph: emptyGraph(),
    });
    expect(result.orphans).toContain('wiki/entities/Orphan.md');
  });

  it('returns dead links', async () => {
    const ctx = makeContext();
    const pageMap = makePageMap({
      'wiki/concepts/Foo.md': 'See [[Missing]] for details.',
    });
    const result = await runProgrammaticPhase(ctx, {
      wikiFiles: makeWikiFiles(['wiki/concepts/Foo.md']),
      pageMap,
      knownTargets: new Set(),
      knownTargetsLower: new Set(),
      graph: emptyGraph(),
    });
    expect(result.deadLinks).toHaveLength(1);
    expect(result.deadLinks[0].target).toBe('Missing');
  });

  it('returns ungrounded quotes', async () => {
    const ctx = makeContext();
    const pageMap = makePageMap({
      'wiki/entities/Foo.md': '## Mentions in Source\n- "fabricated text" — [[sources/article]]',
      'wiki/sources/article.md': '# Article\n\nSome other text.',
    });
    const result = await runProgrammaticPhase(ctx, {
      wikiFiles: makeWikiFiles(['wiki/entities/Foo.md', 'wiki/sources/article.md']),
      pageMap,
      knownTargets: new Set(),
      knownTargetsLower: new Set(),
      graph: emptyGraph(),
    });
    expect(result.ungroundedQuotes).toHaveLength(1);
  });

  it('initializes emptyPages as empty (populated later by LLM phase)', async () => {
    const ctx = makeContext();
    const pageMap = makePageMap({});
    const result = await runProgrammaticPhase(ctx, {
      wikiFiles: makeWikiFiles([]),
      pageMap,
      knownTargets: new Set(),
      knownTargetsLower: new Set(),
      graph: emptyGraph(),
    });
    expect(result.emptyPages).toEqual([]);
  });

  it('initializes hubLinkDensityIssues as empty array (v1.23.0 P1-6)', async () => {
    const ctx = makeContext();
    const pageMap = makePageMap({});
    const result = await runProgrammaticPhase(ctx, {
      wikiFiles: makeWikiFiles([]),
      pageMap,
      knownTargets: new Set(),
      knownTargetsLower: new Set(),
      graph: emptyGraph(),
    });
    expect(result.hubLinkDensityIssues).toEqual([]);
  });

  // ==========================================================================
  // Issue #496 (unrequested finding): Mentions citations point at PRIMARY
  // source notes (#244 style), and the #496 summary-page route now cites raw
  // notes programmatically. The phase's source map used to hold only the
  // wiki's own generated sources/ pages, so every legitimately captured quote
  // cited to the underlying document was flagged ungrounded on re-lint.
  // ==========================================================================
  function makeContextWithVault(files: Record<string, string>): LintPhaseContext {
    const ctx = makeContext();
    (ctx as { app: Record<string, unknown> }).app = {
      metadataCache: { getFileCache: () => null },
      vault: {
        getMarkdownFiles: () => Object.keys(files).map((p) => ({ path: p, basename: p })),
        getAbstractFileByPath: (p: string) => (files[p] !== undefined ? { path: p } : null),
        read: async (f: { path: string }) => {
          const c = files[f.path];
          if (c === undefined) throw new Error('not found');
          return c;
        },
      },
    };
    return ctx;
  }

  it('grounds quotes cited to primary notes by reading them from the vault (#496)', async () => {
    const ctx = makeContextWithVault({
      'notes/paper.md': '# Paper\n\nContains the genuinely verbatim sentence in its body.',
    });
    const pageMap = makePageMap({
      'wiki/sources/paper.md':
        '# Paper\n\n## Mentions in Source\n- "genuinely verbatim sentence" — [[notes/paper|Paper]]',
    });
    const result = await runProgrammaticPhase(ctx, {
      wikiFiles: makeWikiFiles(['wiki/sources/paper.md']),
      pageMap,
      knownTargets: new Set(),
      knownTargetsLower: new Set(),
      graph: emptyGraph(),
    });
    expect(result.ungroundedQuotes).toEqual([]);
  });

  it('still flags a quote whose cited primary note is missing or lacks it (#496)', async () => {
    const ctx = makeContextWithVault({
      'notes/other.md': 'Unrelated content entirely.',
    });
    const pageMap = makePageMap({
      'wiki/sources/a.md': '# A\n\n## Mentions in Source\n- "missing note quote" — [[notes/nonexistent|X]]',
      'wiki/sources/b.md': '# B\n\n## Mentions in Source\n- "absent from note quote" — [[notes/other|Y]]',
    });
    const result = await runProgrammaticPhase(ctx, {
      wikiFiles: makeWikiFiles(['wiki/sources/a.md', 'wiki/sources/b.md']),
      pageMap,
      knownTargets: new Set(),
      knownTargetsLower: new Set(),
      graph: emptyGraph(),
    });
    expect(result.ungroundedQuotes).toHaveLength(2);
  });
});
