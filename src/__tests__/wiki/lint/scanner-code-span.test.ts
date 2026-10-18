// Issue #827's root cause is in the scanner, not in the fixer.
//
// `scanDeadLinks` ran its link regex over the page's raw text, so a `[[link]]`
// inside inline code or a fenced block was reported as a dead link — even though
// Obsidian does not treat it as a link at all. The reporter's placeholder pages
// (`MyFile`, `Name`, `Unknown Entity`, `Untitled Concept`) mostly came from exactly
// that kind of example text, which is how a Templater manual excerpt and a line of
// writer instructions turned into wiki pages.
//
// The first attempt at this issue put a word list in the fixer and then a prompt
// rule there. Both were aimed a layer too high: masking needs only the page's text,
// no link positions, so it belongs where the text is read.
//
// The fixture in `__support__/link-vault.ts` already skipped fenced links, which is
// why this never showed up in the link-retarget tests — the test double was more
// faithful to Obsidian than the production scanner.

import { describe, it, expect } from 'vitest';
import { scanDeadLinks, scanOrphans, maskCodeRegions, type ScannerPage } from '../../../wiki/lint/scanners';

function pageMap(entries: Array<[string, string]>): Map<string, ScannerPage> {
  const m = new Map<string, ScannerPage>();
  for (const [path, content] of entries) {
    m.set(path, { path, content, basename: path.split('/').pop() ?? path });
  }
  return m;
}

const WIKI = 'wiki';

function deadLinks(files: Array<[string, string]>) {
  return scanDeadLinks(pageMap(files), new Set(), new Set(), WIKI);
}

describe('maskCodeRegions — what Obsidian does not read as a link (#827)', () => {
  it('blanks a fenced block', () => {
    const masked = maskCodeRegions('Before\n```\n[[Unknown Entity]]\n```\nAfter');
    expect(masked).not.toContain('[[');
    expect(masked).toContain('Before');
    expect(masked).toContain('After');
  });

  it('blanks inline code', () => {
    expect(maskCodeRegions('Use `[[MyFile]]` to include.')).not.toContain('[[');
  });

  it('keeps a link that is real prose', () => {
    expect(maskCodeRegions('See [[Ferritin]] for detail.')).toContain('[[Ferritin]]');
  });

  // A deliberate boundary, asserted rather than left implicit. `"[[X]]"` IS a link
  // in Obsidian, so masking quotations would delete real references. The reporter's
  // `"[[entities/name|Name]]"` example is instruction text that leaked into a page
  // — a judging problem for the model, not a markup one.
  it('does not blank a quoted link, because Obsidian reads it as a link', () => {
    expect(maskCodeRegions('Format each bullet: "[[entities/name|Name]]"')).toContain('[[entities/name');
  });

  it('preserves offsets so a caller that wants positions still can', () => {
    const src = 'a\n```\n[[X]]\n```\nb';
    expect(maskCodeRegions(src)).toHaveLength(src.length);
  });
});

describe('scanDeadLinks — code examples are not dead links (#827)', () => {
  it('reports no dead link for a fenced example', () => {
    expect(deadLinks([['wiki/concepts/doc.md', 'The syntax is:\n```\n[[Unknown Entity]]\n```\nDone.']]))
      .toEqual([]);
  });

  it('reports no dead link for an inline-code example', () => {
    expect(deadLinks([['wiki/concepts/doc.md', 'Use `[[MyFile]]` to include a file.']]))
      .toEqual([]);
  });

  it('still reports a genuinely dead prose link, so this is not a blanket skip', () => {
    expect(deadLinks([['wiki/concepts/doc.md', 'See [[Ferritin]] for detail.']]))
      .toEqual([{ source: 'concepts/doc', target: 'Ferritin' }]);
  });

  it('reports the prose link and ignores the example on the same page', () => {
    const content = 'See [[Ferritin]] for detail.\n\n```\n[[MyFile]]\n```\n';
    expect(deadLinks([['wiki/concepts/doc.md', content]]))
      .toEqual([{ source: 'concepts/doc', target: 'Ferritin' }]);
  });
});

describe('scanOrphans — a code example does not make a page non-orphan (#827)', () => {
  it('ignores an incoming link that only appears inside code', () => {
    const orphans = scanOrphans(pageMap([
      ['wiki/concepts/orphan.md', '# Orphan\n\nNo inbound links.'],
      ['wiki/concepts/doc.md', 'The syntax is `[[concepts/orphan]]`.'],
    ]), WIKI);
    // `scanOrphans` reports full vault paths, not the relative form.
    expect(orphans).toContain('wiki/concepts/orphan.md');
  });

  it('still counts a real inbound link', () => {
    const orphans = scanOrphans(pageMap([
      ['wiki/concepts/target.md', '# Target\n'],
      ['wiki/concepts/doc.md', 'See [[concepts/target]].'],
    ]), WIKI);
    expect(orphans).not.toContain('wiki/concepts/target.md');
  });
});
