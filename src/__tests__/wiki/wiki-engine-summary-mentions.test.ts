// Issue #496 (Cause 2): source pages get their "Mentions in Source" section
// from the data extraction already captured over the FULL source text — not
// from a model that only ever saw content.substring(0, 500). Before this,
// 0 of a measured vault's 1,045 sources/ pages carried the verbatim-quote
// section that ~96% of concept pages carry.
//
// Same programmatic route as entity pages (#244): injectMentionsSection
// replaces whatever the model wrote with the deterministic section, and —
// because an LLM-written quote built from a 500-character window is
// fabrication rather than provenance — strips the model's section when
// nothing was captured.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import type { SourceAnalysis } from '../../types';

const SOURCE_NOTE_PATH = 'sources/verbatim-note.md';

const SAMPLE_BODY = `# Verbatim Note

Full text lives here; only its first 500 characters reach the summary model.
`;

function sourceFile(): TFile {
  return Object.assign(new TFile(), {
    path: SOURCE_NOTE_PATH,
    basename: 'verbatim-note',
    extension: 'md',
  });
}

const SUMMARY_RESPONSE = JSON.stringify({
  frontmatter: { type: 'source', tags: ['concept'] },
  body: '## Zusammenfassung\n\nKognitive Kontrolle.',
});

function makeAnalysis(fields: {
  mentions_in_source?: string[];
}): SourceAnalysis {
  return {
    source_file: SOURCE_NOTE_PATH,
    source_title: 'Verbatim Note',
    summary: 'Cognitive control processes.',
    entities: [{ name: 'Prefrontal Cortex', type: 'place', summary: 'brain region', mentions_in_source: [] }],
    concepts: [],
    related_pages: [],
    key_points: [],
    created_pages: [],
    updated_pages: [],
    ...fields,
  };
}

function harnessFor(summaryBody: string) {
  return createWikiEngineHarness({
    files: { [SOURCE_NOTE_PATH]: SAMPLE_BODY },
    // Direct createSummaryPage invocation consumes exactly ONE queued LLM
    // response, and the summary response is plain markdown (the prompt asks
    // for a rendered page, not JSON). Bodies start with an intro line —
    // cleanMarkdownResponse cuts everything before the first NEWLINE-preceded
    // heading, so a response whose very first byte is '#' loses its head.
    llmResponses: ['Auto-generated source page.\n\n' + summaryBody],
  });
}

describe('WikiEngine.createSummaryPage — captured mentions routed into the source page (#496)', () => {
  it('injects the captured quotes as the Mentions section', async () => {
    const h = harnessFor('## Zusammenfassung\n\nKognitive Kontrolle.');
    const writtenPath = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis({ mentions_in_source: ['kognitive Kontrolle umfasst Planung', 'Inhibition und kognitive Flexibilität'] }),
      [],
    );

    const written = h.files.get(writtenPath);
    expect(written).toBeDefined();
    expect(written).toContain('## Mentions in Source');
    expect(written).toContain('kognitive Kontrolle umfasst Planung');
    expect(written).toContain('Inhibition und kognitive Flexibilität');
  });

  it('replaces a model-written Mentions section with the deterministic one', async () => {
    // The model saw Mentions Format in the system prompt (#491 Slice A) and
    // may attempt the section from its 500-char window. The captured data
    // wins.
    const h = harnessFor(
      '## Zusammenfassung\n\nBody.\n\n## Mentions in Source\n\n- "paraphrased guess" — [[sources/verbatim-note|Verbatim Note]]',
    );
    const writtenPath = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis({ mentions_in_source: ['the real captured sentence'] }),
      [],
    );

    const written = h.files.get(writtenPath);
    expect(written).toBeDefined();
    expect(written).toContain('"the real captured sentence"');
    expect(written).not.toContain('paraphrased guess');
  });

  it('strips a model-written Mentions section when nothing was captured (no fabrication from the 500-char window)', async () => {
    const h = harnessFor(
      '## Zusammenfassung\n\nBody.\n\n## Mentions in Source\n\n- "invented quote" — [[sources/verbatim-note|Verbatim Note]]',
    );
    const writtenPath = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis({}), // extraction returned without the field (#496 Cause 3)
      [],
    );

    const written = h.files.get(writtenPath);
    expect(written).toBeDefined();
    expect(written).not.toContain('## Mentions in Source');
    expect(written).not.toContain('invented quote');
    expect(written).toContain('## Zusammenfassung');
  });

  it('leaves a mention-less page untouched (no empty header emitted)', async () => {
    const h = harnessFor('## Zusammenfassung\n\nClean body.');
    const writtenPath = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis({}),
      [],
    );

    const written = h.files.get(writtenPath);
    expect(written).toBeDefined();
    expect(written).not.toContain('Mentions in Source');
    expect(written).toContain('Clean body.');
  });

  it('renders quote-heavy captures beyond the formatter default budget (#496 — quotes are the payload)', async () => {
    // Three quotes of ~200 chars each: the formatter's 500-char default
    // would ellipsize the third. The source-page route raises the budget,
    // so all three land verbatim.
    const q = (n: number) =>
      `Quote number ${n} is a long captured sentence repeated for length: ` +
      'wissenschaftliche Untersuchung kognitiver Kontrolle und deren Grenzen. '.repeat(3).trim();
    const quotes = [q(1), q(2), q(3)];
    const h = harnessFor('## Zusammenfassung\n\nBody.');
    const writtenPath = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis({ mentions_in_source: quotes }),
      [],
    );

    const written = h.files.get(writtenPath);
    expect(written).toBeDefined();
    for (const quote of quotes) {
      expect(written).toContain(`"${quote}`);
      expect(written).not.toContain(`${quote.slice(0, 60)}..."`);
    }
  });
});
