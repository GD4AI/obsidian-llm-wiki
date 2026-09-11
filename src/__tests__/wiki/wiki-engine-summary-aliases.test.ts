// Issue #185: propagate source-note aliases to wiki/sources/<slug>. Step 2 — inject.
//
// Goal: when `WikiEngine.createSummaryPage` writes a fresh sources/<slug>
// page, the source note's curated frontmatter `aliases:` (already extracted
// in Step 1 by SourceAnalyzer.analyzeSource) must be appended to the
// generated page's frontmatter. Downstream fix-dead-link uses this alias
// pool (slugify-normalized) to retarget dead links written with inflection
// variants.
//
// Implementation choice: a minimal private helper on WikiEngine that does
// read-frontmatter → merge-dedup → replace-or-inject. Reuses the same
// pattern as PageFactory.appendAliases (no cross-module dependency).

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import { parseFrontmatter } from '../../core/frontmatter';

const SOURCE_NOTE_PATH = 'sources/exekutive-funktionen.md';

const SAMPLE_BODY = `# Exekutive Funktionen

Ein Konzept der kognitiven Kontrolle, das Planung, Inhibition und kognitive Flexibilität umfasst. Im Kontext der LLM-Provider-Routen sind diese Funktionen relevant für Anbieter wie OpenRouter, die konfigurierbare Reasoning-Stufen unterstützen.
`;

function sourceFile(): TFile {
  return Object.assign(new TFile(), {
    path: SOURCE_NOTE_PATH,
    basename: 'exekutive-funktionen',
    extension: 'md',
  });
}

// Shared LLM stubs — the engine consumes two responses per ingest:
// (1) SourceAnalyzer extraction, (2) createSummaryPage summary generation.
// Centralized so each `it()` test only specifies what differs.
const EXTRACTION_RESPONSE = JSON.stringify({
  source_title: 'Exekutive Funktionen',
  summary: 'Cognitive control processes.',
  entities: [{ name: 'Prefrontal Cortex', type: 'place', summary: 'brain region', mentions_in_source: [] }],
  concepts: [],
});
const SUMMARY_RESPONSE = JSON.stringify({
  frontmatter: { type: 'source', sources: ['[[sources/self-stub]]'], tags: ['concept'] },
  body: '## Zusammenfassung\n\nKognitive Kontrolle.',
});

/**
 * Build a minimal SourceAnalysis as it would arrive from SourceAnalyzer
 * after a successful extraction. We only care about source_note_aliases
 * here — the rest is a stub sufficient to run createSummaryPage through
 * to its write step.
 */
function makeAnalysis(aliases: string[] | undefined): import('../../types').SourceAnalysis {
  return {
    source_file: SOURCE_NOTE_PATH,
    source_title: 'Exekutive Funktionen',
    summary: 'Cognitive control processes.',
    entities: [{ name: 'Prefrontal Cortex', type: 'place', summary: 'brain region', mentions_in_source: [] }],
    concepts: [],
    related_pages: [],
    key_points: [],
    created_pages: [],
    updated_pages: [],
    source_note_aliases: aliases,
  };
}

function harnessFor(extraFiles: Record<string, string> = {}) {
  return createWikiEngineHarness({
    files: { [SOURCE_NOTE_PATH]: SAMPLE_BODY, ...extraFiles },
    llmResponses: [EXTRACTION_RESPONSE, SUMMARY_RESPONSE],
  });
}

describe('WikiEngine.createSummaryPage — Issue #185 aliases propagation', () => {
  it('appends source-note aliases to the generated sources/<slug> page frontmatter', async () => {
    const curatedAliases = [
      'Exekutive Funktionen',
      'Executive Function',
      'Exekutiv Funktionen',
      'Exekutiven Funktionen',
      'exekutive Funktionen',
    ];
    const h = harnessFor();

    // Run only createSummaryPage so the test does not depend on the full
    // ingest pipeline (entity extraction / matchExtractedToExisting / etc.).
    // SourceAnalyzer is bypassed here — we pass the analysis directly,
    // simulating the post-Step-1 contract.
    const writtenPath: string = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis(curatedAliases),
      [],
    );

    // Read the written page back from the harness's in-memory vault.
    const written = h.files.get(writtenPath);
    expect(written, `expected ${writtenPath} to be written by createSummaryPage`).toBeDefined();

    const fm = parseFrontmatter(written!) ?? {};
    expect(Array.isArray(fm.aliases), 'expected aliases to be an array on the source page').toBe(true);
    for (const a of curatedAliases) {
      expect((fm.aliases as string[])).toContain(a);
    }
  });

  it('skips injection when the source note has no frontmatter aliases (no regression)', async () => {
    const h = harnessFor();

    const writtenPath: string = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis(undefined),
      [],
    );

    const written = h.files.get(writtenPath);
    expect(written).toBeDefined();
    const fm = parseFrontmatter(written!) ?? {};
    // No injection — existing aliases (if any LLM-emitted) remain untouched.
    // The LLM stub doesn't emit aliases, so the array is either absent or empty.
    expect(fm.aliases ?? []).toEqual([]);
  });

  it('does not duplicate aliases when an existing sources/<slug> page already carries them (re-ingest dedup)', async () => {
    const h = harnessFor({
      // Pre-existing source page (re-ingest scenario). It already carries
      // 2 of the 5 curated aliases — the injection must NOT duplicate.
      ['wiki/sources/exekutive-funktionen.md']: `---
type: source
tags: [concept]
aliases:
  - "Executive Function"
  - "Exekutiv Funktionen"
---

Existing summary.
`,
    });

    const writtenPath: string = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis([
        'Executive Function',           // already present
        'Exekutiv Funktionen',          // already present
        'Exekutive Funktionen',         // NEW
        'Exekutiven Funktionen',        // NEW
      ]),
      [],
    );

    const written = h.files.get(writtenPath)!;
    const fm = parseFrontmatter(written) ?? {};
    const aliases = fm.aliases as string[];
    expect(aliases).toEqual([
      'Executive Function',
      'Exekutiv Funktionen',
      'Exekutive Funktionen',
      'Exekutiven Funktionen',
    ]);
    // No duplicates
    expect(new Set(aliases).size).toBe(aliases.length);
  });
});
