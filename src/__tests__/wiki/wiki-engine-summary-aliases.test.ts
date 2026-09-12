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
    // 'exekutive Funktionen' is deliberately absent from the expectation:
    // it differs from 'Exekutive Funktionen' by case only, and both readers
    // of this pool compare case-folded (fix-dead-link.ts:264
    // `a.toLowerCase()` / `slugify(a).toLowerCase()`, scanners.ts:146
    // `knownTargetsLower`). Carrying both retargets nothing extra and only
    // widens the alias line in the fix-dead-link prompt. Pinned below.
    const curatedAliases = [
      'Exekutive Funktionen',
      'Executive Function',
      'Exekutiv Funktionen',
      'Exekutiven Funktionen',
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

  it('keeps one of two aliases that differ by case only', async () => {
    const h = harnessFor();
    const writtenPath: string = await h.engine.createSummaryPage(
      sourceFile(),
      makeAnalysis(['Exekutive Funktionen', 'exekutive Funktionen']),
      [],
    );
    const fm = parseFrontmatter(h.files.get(writtenPath)!) ?? {};
    const aliases = (fm.aliases ?? []) as string[];
    expect(aliases).toContain('Exekutive Funktionen');
    expect(aliases).not.toContain('exekutive Funktionen');
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

// The floor the other two writers of `aliases:` already apply.
//
// `resolveMinAliasLength`'s own doc comment names two writers — the append
// path in page-factory/aliases.ts and `enforceFrontmatterConstraints` on the
// create path — and exists so both resolve the same floor from the same
// place. `createSummaryPage` is a third writer of the same field and applies
// no floor at all: the model's `aliases:` reach disk verbatim and the curated
// note aliases are merged on top of them unfiltered.
//
// Measured on a 131-page sources/ folder (288 aliases): 2 below a configured
// floor of 3 ("MD", "IR"), 1 that only differs from the page name by case
// ("ARNi" on ARNI.md). The same vault's 757 entity/concept pages (965
// aliases) carry none of either — that is the difference this fix removes.
describe('WikiEngine.createSummaryPage — the alias floor the create path applies', () => {
  // createSummaryPage issues exactly one model call, so this is the response
  // it consumes. The summary path expects markdown, not JSON.
  const SUMMARY_PAGE = `---
type: source
source_file: "[[${SOURCE_NOTE_PATH}]]"
tags:
  - "other"
generation_complete: true
aliases:
  - "Executive Function"
  - "EF"
  - "Exekutive-Funktionen"
---

# Exekutive Funktionen - Summary

## Zusammenfassung

Kognitive Kontrolle.
`;

  function harnessWithModelAliases() {
    return createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: SAMPLE_BODY },
      llmResponses: [SUMMARY_PAGE],
      settings: { minAliasLength: 3 },
    });
  }

  async function aliasesOnDisk(noteAliases: string[]) {
    const h = harnessWithModelAliases();
    const writtenPath: string = await h.engine.createSummaryPage(sourceFile(), makeAnalysis(noteAliases), []);
    const fm = parseFrontmatter(h.files.get(writtenPath)!) ?? {};
    return (fm.aliases ?? []) as string[];
  }

  it('drops a model-written alias shorter than the configured floor', async () => {
    const aliases = await aliasesOnDisk([]);
    expect(aliases).toContain('Executive Function');
    expect(aliases).not.toContain('EF');
  });

  it('drops a model-written alias that only differs from the page name by case', async () => {
    const aliases = await aliasesOnDisk([]);
    expect(aliases).not.toContain('Exekutive-Funktionen');
  });

  it('applies the floor to curated note aliases merged on top, not only to the model list', async () => {
    const aliases = await aliasesOnDisk(['Kognitive Kontrolle', 'KK']);
    expect(aliases).toContain('Kognitive Kontrolle');
    expect(aliases).not.toContain('KK');
  });

  // The rewrite goes through replaceFrontmatterArrayField, which rebuilds the
  // whole block. A source page carries three keys that are not in
  // FrontmatterData — they survive as passthrough lines, and this pins that.
  it('preserves the source page\'s non-canonical frontmatter across the rewrite', async () => {
    const h = harnessWithModelAliases();
    const writtenPath: string = await h.engine.createSummaryPage(sourceFile(), makeAnalysis([]), []);
    const written = h.files.get(writtenPath)!;

    expect(written).toContain('source_file:');
    expect(written).toContain('generation_complete: true');
    expect(written).toContain('contentHash:');
    expect(parseFrontmatter(written)?.type).toBe('source');
    expect(parseFrontmatter(written)?.tags).toEqual(['other']);
  });

  // The narrowing that keeps this off the 128 of 131 pages whose aliases
  // already pass: nothing is dropped, so nothing is rewritten.
  it('leaves the frontmatter byte-identical when every alias already passes', async () => {
    const clean = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: SAMPLE_BODY },
      llmResponses: [SUMMARY_PAGE.replace('  - "EF"\n', '').replace('  - "Exekutive-Funktionen"\n', '')],
      settings: { minAliasLength: 3 },
    });
    const writtenPath: string = await clean.engine.createSummaryPage(sourceFile(), makeAnalysis([]), []);
    const written = clean.files.get(writtenPath)!;

    expect(written).toContain('aliases:\n  - "Executive Function"');
  });
});
