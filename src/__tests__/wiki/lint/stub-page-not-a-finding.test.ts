// Issue #827, "at minimum": a stub page must not become a lint finding.
//
// A stub is born from a gate dissent rather than from a source (`stub-page.ts`), so
// it has no source of its own to derive an inbound link from and nothing to curate.
// Reporting it as orphan or alias-deficient therefore asks the user to finish the
// tool's own artefact — and asks again on every lint run, which is the loop the
// report describes. `stub: true` already exists as the marker (#356 passthrough,
// stripped only when a real source fills the page), so no new signal is needed.
//
// Both scanners keep a control case: a non-stub page is still reported, so this is an
// exclusion for one marker rather than a blanket silence.

import { describe, it, expect } from 'vitest';
import { scanOrphans, detectAliasDeficiency, type ScannerPage } from '../../../wiki/lint/scanners';

const WIKI = 'wiki';

function pageMap(entries: Array<[string, string]>): Map<string, ScannerPage> {
  const m = new Map<string, ScannerPage>();
  for (const [path, content] of entries) {
    m.set(path, { path, content, basename: path.split('/').pop() ?? path });
  }
  return m;
}

/** An entity page with no aliases — alias-deficient by `hasNonEmptyAliases`. */
function entityPage(title: string, frontmatterExtra = ''): string {
  return `---\ntitle: "${title}"${frontmatterExtra}\ntags:\n  - entity\n---\n\n# ${title}\n\nBody.\n`;
}

describe('a stub page is not an alias-deficiency finding (#827)', () => {
  it('skips a stub entity page', () => {
    const path = 'wiki/entities/myfile.md';
    const pages = pageMap([[path, entityPage('MyFile', '\nstub: true')]]);

    expect(detectAliasDeficiency([{ path }], pages)).toEqual([]);
  });

  it('also skips the serialised string form, which YAML may produce', () => {
    const path = 'wiki/entities/myfile.md';
    const pages = pageMap([[path, entityPage('MyFile', '\nstub: "true"')]]);

    expect(detectAliasDeficiency([{ path }], pages)).toEqual([]);
  });

  it('still reports a non-stub entity page, so this is not a blanket silence', () => {
    const path = 'wiki/entities/osteopontin.md';
    const pages = pageMap([[path, entityPage('Osteopontin')]]);

    const deficient = detectAliasDeficiency([{ path }], pages);

    expect(deficient.map(p => p.path)).toEqual([path]);
  });

  it('still reports a stub that has since gained aliases as fine, and a plain page with aliases too', () => {
    const aliased = 'wiki/entities/ferritin.md';
    const pages = pageMap([[aliased, entityPage('Ferritin', '\naliases:\n  - "FER"')]]);

    expect(detectAliasDeficiency([{ path: aliased }], pages)).toEqual([]);
  });
});

describe('a stub page is not an orphan finding (#827)', () => {
  it('skips a stub page with no inbound links', () => {
    const stubPath = 'wiki/entities/unknown-entity.md';
    const pages = pageMap([
      [stubPath, entityPage('Unknown Entity', '\nstub: true')],
      ['wiki/concepts/other.md', '# Other\n\nNo links here.'],
    ]);

    expect(scanOrphans(pages, WIKI)).not.toContain(stubPath);
  });

  it('still reports a non-stub page with no inbound links', () => {
    const orphanPath = 'wiki/concepts/other.md';
    const pages = pageMap([
      ['wiki/entities/unknown-entity.md', entityPage('Unknown Entity', '\nstub: true')],
      [orphanPath, '# Other\n\nNo links here.'],
    ]);

    expect(scanOrphans(pages, WIKI)).toContain(orphanPath);
  });

  it('still counts a stub as a link source, because it is a real page in the graph', () => {
    // The exclusion is about the judgement, not about link extraction: a stub that
    // links somewhere really does give that page an inbound link, and suppressing
    // that would create orphans that Obsidian does not have.
    const targetPath = 'wiki/concepts/target.md';
    const pages = pageMap([
      ['wiki/entities/x.md', entityPage('X', '\nstub: true').replace('Body.', 'See [[concepts/target]].')],
      [targetPath, '# Target\n'],
    ]);

    expect(scanOrphans(pages, WIKI)).not.toContain(targetPath);
  });
});
