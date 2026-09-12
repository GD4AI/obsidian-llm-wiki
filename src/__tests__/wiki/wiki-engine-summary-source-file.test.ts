// Issue #679: `source_file:` on a sources/ page is the canonical owner
// (`originNoteRefs` → `pageBelongsToNote` → `isAlreadyIngested`, and
// `scanSourceDrift`). The template hands the model `file.path` and the model
// writes the whole page, frontmatter included — so the field was whatever the
// model copied. Measured on a rebuilt vault: `Notizen/Zytokine.md` came back
// as `Notizen/Zytokines.md`, and the note then read as "not ingested".
// The code knows the path exactly; it sets the field, like `contentHash`.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import type { SourceAnalysis } from '../../types';

const SOURCE_NOTE_PATH = 'Notizen/Zytokine.md';

function sourceFile(): TFile {
  return Object.assign(new TFile(), {
    path: SOURCE_NOTE_PATH,
    basename: 'Zytokine',
    extension: 'md',
  });
}

function makeAnalysis(): SourceAnalysis {
  return {
    source_file: SOURCE_NOTE_PATH,
    source_title: 'Zytokine',
    summary: 'Signal proteins.',
    entities: [],
    concepts: [],
    related_pages: [],
    key_points: [],
    created_pages: [],
    updated_pages: [],
  };
}

function harnessFor(summaryPage: string) {
  return createWikiEngineHarness({
    files: { [SOURCE_NOTE_PATH]: '# Zytokine\n\nSignalproteine des Immunsystems.\n' },
    llmResponses: [summaryPage],
  });
}

describe('WikiEngine.createSummaryPage — source_file comes from the code, not the model (#679)', () => {
  it('overwrites a source_file the model miscopied', async () => {
    const h = harnessFor(
      '---\ntype: source\nsource_file: "[[Notizen/Zytokines.md]]"\ntags: [other]\n---\n\n# Zytokine - Summary\n\nSignal proteins.\n',
    );
    const writtenPath = await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);

    const written = h.files.get(writtenPath)!;
    expect(written).toContain('source_file: "[[Notizen/Zytokine.md]]"');
    expect(written).not.toContain('Zytokines');
  });

  it('adds source_file when the model left it out', async () => {
    const h = harnessFor('---\ntype: source\ntags: [other]\n---\n\n# Zytokine - Summary\n\nSignal proteins.\n');
    const writtenPath = await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);

    const written = h.files.get(writtenPath)!;
    expect(written).toContain('source_file: "[[Notizen/Zytokine.md]]"');
    expect(written.match(/^source_file:/gm)).toHaveLength(1);
  });
});
