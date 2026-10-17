/**
 * IndexGenerator unit tests — wiki index page rendering + summary/alias extraction.
 *
 * Extracted from WikiEngine (2026-07-19). Verifies:
 *   - generateFlatIndex renders 3 sections (entities / concepts / sources)
 *   - generateEmptyIndex writes the empty-state markdown
 *   - getPageSummary reads first non-heading body line (100 char cap)
 *   - getPageAliases reads frontmatter aliases array, filters non-strings
 */

import { describe, it, expect, vi } from 'vitest';
import { TFile } from 'obsidian';
import { IndexGenerator } from '../../../wiki/engine-internals/index-generator';
import { buildDissentStubContent } from '../../../wiki/page-factory/stub-page';
import type { EntityInfo } from '../../../types';

// Cast helper kept OUTSIDE IndexGenerator test scope so obsidianmd/no-tfile-tfolder-cast
// sees the cast at a call site, not inside a helper. Matches the pattern used by
// src/__tests__/wiki/source-analyzer.test.ts (callsite cast for the same reason).
function makeFileStub(basename: string): { path: string; basename: string } {
  return { path: basename, basename: basename.replace(/\.md$/, '') };
}

describe('IndexGenerator', () => {
  it('renders entities / concepts / sources sections with localized labels', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const gen = new IndexGenerator({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile: vi.fn().mockResolvedValue(''),
      writeFile,
    });

    await gen.generateFlatIndex(
      // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub: object structurally matches TFile, see makeFileStub above
      [makeFileStub('Einstein') as unknown as TFile, makeFileStub('Curie') as unknown as TFile],
      // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub: object structurally matches TFile, see makeFileStub above
      [makeFileStub('Relativity') as unknown as TFile, makeFileStub('Radioactivity') as unknown as TFile],
      // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub: object structurally matches TFile, see makeFileStub above
      [makeFileStub('paper1') as unknown as TFile, makeFileStub('paper2') as unknown as TFile],
    );

    expect(writeFile).toHaveBeenCalledTimes(1);
    const callArgs = writeFile.mock.calls[0] as [string, string];
    const path = callArgs[0];
    const content = callArgs[1];
    expect(path).toBe('wiki/index.md');
    // English labels from TEXTS.en.indexLabels
    expect(content).toContain('## Entities');
    expect(content).toContain('## Concepts');
    expect(content).toContain('## Sources');
    expect(content).toContain('[[entities/Einstein|Einstein]]');
    expect(content).toContain('[[concepts/Relativity|Relativity]]');
    expect(content).toContain('[[sources/paper1|paper1]]');
  });

  it('writes empty-state markdown when generateEmptyIndex() called', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const gen = new IndexGenerator({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile: vi.fn(),
      writeFile,
    });

    await gen.generateEmptyIndex();
    const emptyCallArgs = writeFile.mock.calls[0] as [string, string];
    expect(emptyCallArgs[0]).toBe('wiki/index.md');
    expect(emptyCallArgs[1]).toContain('No pages yet');
  });

  it('falls back to English labels for unknown language', async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const gen = new IndexGenerator({
      wikiFolder: 'wiki',
      wikiLanguage: 'xx-unknown', // not in TEXTS indexLabels
      readFile: vi.fn().mockResolvedValue(''),
      writeFile,
    });
    await gen.generateFlatIndex([], [], []);
    const langFallbackArgs = writeFile.mock.calls[0] as [string, string];
    expect(langFallbackArgs[1]).toContain('## Entities'); // English fallback
  });

  it('getPageSummary returns first body line (100 chars max)', async () => {
    // IndexGenerator.getPageSummary filters lines starting with `---` or `#`
    // OR being empty. A frontmatter property line like `title: T` is NOT
    // filtered (matches production behavior in WikiEngine — same code path).
    // So we test with a clean body without frontmatter to keep the test
    // intent clear.
    const readFile = vi.fn().mockResolvedValue('# Heading\n\nFirst content line here.\nMore.');
    const gen = new IndexGenerator({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile: vi.fn(),
    });
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub: object structurally matches TFile, see makeFileStub above
    const summary = await gen.getPageSummary(makeFileStub('p') as unknown as TFile);
    expect(summary).toBe('First content line here.');
  });

  it('getPageSummary returns "No summary" for empty body', async () => {
    const readFile = vi.fn().mockResolvedValue('# Only a heading');
    const gen = new IndexGenerator({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile: vi.fn(),
    });
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub: object structurally matches TFile, see makeFileStub above
    expect(await gen.getPageSummary(makeFileStub('p') as unknown as TFile)).toBe('No summary');
  });

  it('getPageAliases reads frontmatter aliases, trims and drops empties', async () => {
    // parseFrontmatter only handles `key: value` and `- item` array syntax;
    // inline arrays like `[Einstein, 42]` aren't parsed, so we use the list form.
    // The numeric `42` is a YAML literal — but in our list-form frontmatter all
    // items are parsed as strings (parseFrontmatter doesn't coerce). So
    // '42-string' stays; we test trimming and empties.
    const readFile = vi.fn().mockResolvedValue('---\naliases:\n  - Einstein\n  - " Albert "\n  - "42"\n  - "  "\n---\n\nBody.');
    const gen = new IndexGenerator({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile: vi.fn(),
    });
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub: object structurally matches TFile, see makeFileStub above
    const aliases = await gen.getPageAliases(makeFileStub('e') as unknown as TFile);
    // " Albert " is trimmed to "Albert"; "  " is dropped (length 0 after trim); "42" stays.
    expect(aliases).toEqual(['Einstein', 'Albert', '42']);
  });

  it('getPageAliases returns [] when no aliases field', async () => {
    const readFile = vi.fn().mockResolvedValue('# Just a heading\n\nNo frontmatter.');
    const gen = new IndexGenerator({
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      readFile,
      writeFile: vi.fn(),
    });
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub: object structurally matches TFile, see makeFileStub above
    expect(await gen.getPageAliases(makeFileStub('p') as unknown as TFile)).toEqual([]);
  });
});
// Phase 1 of the #729 reader-recall work. A dissent stub's body is
// `# name`, then a provenance blockquote, then the extraction summary, then a
// quoted mention. firstBodyLine returned the blockquote, so every stub page's
// index entry read "Stub created by the ingest candidate gate…" — the same
// sentence, on every stub, in place of the summary the extraction already paid
// for. The gate is the `stub: true` frontmatter flag, not the text: a page may
// legitimately open with a blockquote and must keep it.
describe('IndexGenerator — stub pages (Phase 1)', () => {
  it('returns the extraction summary, not the stub provenance line', async () => {
    const content = buildDissentStubContent({
      item: {
        name: 'Annealed Importance Sampling',
        summary: 'A method for estimating the normalizing constant of an unnormalized distribution.',
        mentions_in_source: ['AIS estimates the normalizing constant Z.'],
      } as EntityInfo,
      stubType: 'entity',
      sourceSlug: 'paper-1',
      cell: 'E-A',
    });
    const gen = new IndexGenerator({
      wikiFolder: 'wiki', wikiLanguage: 'en',
      readFile: vi.fn().mockResolvedValue(content), writeFile: vi.fn(),
    });
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub, see makeFileStub
    expect(await gen.getPageSummary(makeFileStub('p') as unknown as TFile))
      .toBe('A method for estimating the normalizing constant of an unnormalized distribution.');
  });

  it('skips the quoted mention too — a quote is provenance, not a summary', async () => {
    const content = buildDissentStubContent({
      item: {
        name: 'X',
        summary: '',
        mentions_in_source: ['The quoted mention text goes here and is provenance.'],
      } as EntityInfo,
      stubType: 'entity',
      sourceSlug: 's', cell: 'E-A',
    });
    const gen = new IndexGenerator({
      wikiFolder: 'wiki', wikiLanguage: 'en',
      readFile: vi.fn().mockResolvedValue(content), writeFile: vi.fn(),
    });
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub, see makeFileStub
    expect(await gen.getPageSummary(makeFileStub('p') as unknown as TFile)).toBe('No summary');
  });

  it('keeps a leading blockquote on a page that is NOT a stub', async () => {
    const content = '---\ntype: concept\n---\n# Term\n\n> A definition opening the note.\n\nMore.';
    const gen = new IndexGenerator({
      wikiFolder: 'wiki', wikiLanguage: 'en',
      readFile: vi.fn().mockResolvedValue(content), writeFile: vi.fn(),
    });
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub, see makeFileStub
    expect(await gen.getPageSummary(makeFileStub('p') as unknown as TFile))
      .toBe('> A definition opening the note.');
  });

  it('a stub with no summary and no quote reports "No summary", never the boilerplate', async () => {
    const content = '---\nstub: true\n---\n# N\n\n> Stub created by the ingest candidate gate (E-A) — [[sources/s]] names this without treating it. Will be filled by the next ingest of a source that does.\n';
    const gen = new IndexGenerator({
      wikiFolder: 'wiki', wikiLanguage: 'en',
      readFile: vi.fn().mockResolvedValue(content), writeFile: vi.fn(),
    });
    // eslint-disable-next-line obsidianmd/no-tfile-tfolder-cast -- test stub, see makeFileStub
    expect(await gen.getPageSummary(makeFileStub('p') as unknown as TFile)).toBe('No summary');
  });
});

describe('IndexGenerator — source slug in the index line (#819 wiring)', () => {
  const mkFile = (name: string) => ({ basename: name }) as unknown as TFile;

  const render = async (content: string) => {
    const gen = new IndexGenerator({} as never);
    return (gen as unknown as {
      renderSection(l: string, f: TFile[], folder: string, w: boolean, r: () => Promise<string>): Promise<string>;
    }).renderSection('Entities', [mkFile('Alpha')], 'wiki/entities', false, async () => content);
  };

  it('writes a source marker from an inline sources value', async () => {
    const out = await render('---\nsources: "[[sources/paper-ais]]"\n---\n# Alpha\n');
    expect(out).toContain('`source: paper-ais`');
  });

  it('writes a source marker from a block sources value', async () => {
    const out = await render('---\nsources:\n  - "[[sources/paper-zh]]"\n---\n# Alpha\n');
    expect(out).toContain('`source: paper-zh`');
  });

  it('writes no marker when the sources key is empty — unknown is not invented', async () => {
    const out = await render('---\nsources:\ntags: [x]\n---\n# Alpha\n');
    expect(out).not.toContain('`source:');
  });

  it('writes no marker when there is no sources key at all', async () => {
    const out = await render('---\ntags: [x]\n---\n# Alpha\n');
    expect(out).not.toContain('`source:');
  });
});
