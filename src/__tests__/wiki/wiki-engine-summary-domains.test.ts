// domain axis stage 2 (#568): the source page is a 1:1 projection of its
// note, so it carries every note tag in `domains:` — all of them, including
// values outside the plugin's tag vocabulary and nested `Gruppe/Wert` forms.
// `tags:` stays the plugin's own axis (#90/#114) and is not touched here.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import { parseFrontmatter } from '../../core/frontmatter';
import type { SourceAnalysis } from '../../types';

const SOURCE_NOTE_PATH = 'Notizen/Ferritin.md';

function sourceFile(): TFile {
  return Object.assign(new TFile(), {
    path: SOURCE_NOTE_PATH,
    basename: 'Ferritin',
    extension: 'md',
  });
}

const SUMMARY_RESPONSE = JSON.stringify({
  frontmatter: { type: 'source', sources: ['[[sources/self-stub]]'] },
  body: '## Summary\n\nIron store.',
});

function makeAnalysis(): SourceAnalysis {
  return {
    source_file: SOURCE_NOTE_PATH,
    source_title: 'Ferritin',
    summary: 'Iron store.',
    entities: [],
    concepts: [],
    related_pages: [],
    key_points: [],
    created_pages: [],
    updated_pages: [],
  } as unknown as SourceAnalysis;
}

function harnessFor(noteBody: string, extraFiles: Record<string, string> = {}) {
  return createWikiEngineHarness({
    files: { [SOURCE_NOTE_PATH]: noteBody, ...extraFiles },
    llmResponses: [SUMMARY_RESPONSE],
  });
}

const NOTE_WITH_TAGS = `---
tags:
  - Sorte/Protein
  - Fachgebiet/Hämatologie
  - Thema/Eisen
---

# Ferritin

Iron store.
`;

describe('WikiEngine.createSummaryPage — no domains mirror (Tag-Achse Stufe 4, S137)', () => {
  it('writes no domains field — the note itself carries the tags, the mirror only doubled tag-pane hits', async () => {
    const h = harnessFor(NOTE_WITH_TAGS);
    const path = await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    const fm = parseFrontmatter(h.files.get(path) ?? '') ?? {};
    expect(fm.domains).toBeUndefined();
  });

  it('leaves no domains field when the note has no tags', async () => {
    const h = harnessFor('# Ferritin\n\nIron store.\n');
    const path = await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    expect(h.files.get(path) ?? '').not.toContain('domains');
  });

  it('does not resurrect a stale legacy domains field on re-ingest', async () => {
    const h = harnessFor(NOTE_WITH_TAGS, {
      'wiki/sources/Ferritin.md': '---\ntype: source\ntags: [note]\ndomains:\n  - "Thema/Veraltet"\n---\n\n# Ferritin\n',
    });
    const path = await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    const fm = parseFrontmatter(h.files.get(path) ?? '') ?? {};
    expect(fm.domains).toBeUndefined();
  });
});
