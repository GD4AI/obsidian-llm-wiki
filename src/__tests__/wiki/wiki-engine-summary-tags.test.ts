// Issue #90 follow-up: the source-page `tags:` fallback must stay inside the
// closed VALID_SOURCE_TAGS vocabulary.
//
// createSummaryPage feeds `{{tags}}` into the summary prompt, so these tests
// assert on the prompt the engine builds rather than on the stubbed response.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import { DEFAULT_SOURCE_TAG } from '../../types';
import { parseFrontmatter } from '../../core/frontmatter';
import type { SourceAnalysis } from '../../types';

const SOURCE_NOTE_PATH = 'sources/lecture-transcript.md';

const PLAIN_TRANSCRIPT = `# Lecture transcript

An unstructured transcript with no frontmatter at all — the normal case for
speech-to-text output, and the case that used to leak concept names into tags.
`;

function sourceFile(): TFile {
  return Object.assign(new TFile(), {
    path: SOURCE_NOTE_PATH,
    basename: 'lecture-transcript',
    extension: 'md',
  });
}

const SUMMARY_RESPONSE = JSON.stringify({
  frontmatter: { type: 'source', sources: ['[[sources/self-stub]]'] },
  body: '## Summary\n\nA lecture.',
});

function makeAnalysis(): SourceAnalysis {
  return {
    source_file: SOURCE_NOTE_PATH,
    source_title: 'Lecture transcript',
    summary: 'A lecture.',
    entities: [],
    concepts: [
      { name: 'Jnana Yoga', type: 'philosophy', summary: 'path of knowledge', mentions_in_source: [] },
      { name: 'Karma Yoga', type: 'philosophy', summary: 'path of action', mentions_in_source: [] },
    ],
    contradictions: [],
    related_pages: [],
    key_points: [],
    created_pages: [],
    updated_pages: [],
  } as unknown as SourceAnalysis;
}

/**
 * The `{{tags}}` value the engine substituted into the summary prompt.
 *
 * Anchored to the `source_file:` line of the source-page frontmatter template:
 * the prompt also embeds the source note's own body (`{{content}}`), whose
 * frontmatter can carry an unrelated `tags:` line that appears first.
 */
function tagsInPrompt(h: ReturnType<typeof createWikiEngineHarness>): string {
  const request = h.llmRequests.at(-1);
  const content = request?.messages?.[0]?.content ?? '';
  const match = /source_file: "\[\[[^\]]*\]\]"\ntags:\s*\[(.*)\]/.exec(
    typeof content === 'string' ? content : ''
  );
  expect(match, 'expected the source-page tags: line in the summary prompt').not.toBeNull();
  return match![1].trim();
}

function harnessFor(sourceBody: string, extraFiles: Record<string, string> = {}) {
  return createWikiEngineHarness({
    files: { [SOURCE_NOTE_PATH]: sourceBody, ...extraFiles },
    llmResponses: [SUMMARY_RESPONSE],
  });
}

describe('WikiEngine.createSummaryPage — source-page tag vocabulary', () => {
  it('falls back to the default tag instead of extracted concept names', async () => {
    const h = harnessFor(PLAIN_TRANSCRIPT);

    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);

    const tags = tagsInPrompt(h);
    expect(tags).toBe(DEFAULT_SOURCE_TAG);
    expect(tags).not.toContain('Jnana Yoga');
    expect(tags).not.toContain('Karma Yoga');
  });

  it('keeps a source-note tag that is part of the vocabulary', async () => {
    const h = harnessFor(`---
tags: [transcript]
---

${PLAIN_TRANSCRIPT}`);

    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);

    expect(tagsInPrompt(h)).toBe('transcript');
  });

  it('drops source-note tags outside the vocabulary', async () => {
    const h = harnessFor(`---
tags: [Jnana Yoga, philosophy, book]
---

${PLAIN_TRANSCRIPT}`);

    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);

    expect(tagsInPrompt(h)).toBe('book');
  });

  it('still preserves manually-set tags on an existing source page (Issue #114)', async () => {
    const h = harnessFor(PLAIN_TRANSCRIPT, {
      ['wiki/sources/lecture-transcript.md']: `---
type: source
tags: [paper]
---

Existing summary.
`,
    });

    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);

    expect(tagsInPrompt(h)).toBe('paper');
  });
});

// One vocabulary (vocabulary.ts): the source page carries the note's domain
// axis, seeded from the note and checked at the gate like every other page.
describe('WikiEngine.createSummaryPage — domain axis on the source page', () => {
  const customSettings = {
    tagVocabularyMode: 'custom' as const,
    customEntityTags: 'Thema/Schlaf',
    customConceptTags: 'Thema/Schlaf',
  };

  it('seeds the tags line with the form value and the note tags the vocabulary carries', async () => {
    const h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: `---\ntags: [transcript, Thema/Schlaf, Thema/Erfunden]\n---\n\n${PLAIN_TRANSCRIPT}` },
      llmResponses: [SUMMARY_RESPONSE],
      settings: customSettings,
    });
    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    expect(tagsInPrompt(h)).toBe('transcript, Thema/Schlaf');
  });

  it('shows the model the note body, not its frontmatter — the copied-back tag case', async () => {
    const h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: `---\ntags: [Thema/Erfunden]\n---\n\n${PLAIN_TRANSCRIPT}` },
      llmResponses: [SUMMARY_RESPONSE],
      settings: customSettings,
    });
    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    const content = h.llmRequests.at(-1)?.messages?.[0]?.content;
    expect(typeof content === 'string' ? content : '').not.toContain('Thema/Erfunden');
    expect(typeof content === 'string' ? content : '').toContain('# Lecture transcript');
  });

  it('drops what the model wrote outside form list and vocabulary before the page lands', async () => {
    // The page as the model returns it — frontmatter written by the model,
    // `theory` where `other` was asked for (the case measured on one vault).
    const response = [
      '---',
      'type: source',
      'created: 2026-09-10',
      'updated: 2026-09-10',
      `source_file: "[[${SOURCE_NOTE_PATH}]]"`,
      'tags: [other, theory, Thema/Schlaf, Thema/Erfunden]',
      'aliases: ["Lecture"]',
      '---',
      '',
      '# Lecture transcript - Summary',
      '',
      '## Summary',
      '',
      'A lecture.',
    ].join('\n');
    const h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: PLAIN_TRANSCRIPT },
      llmResponses: [response],
      settings: customSettings,
    });
    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    const written = h.files.get('wiki/sources/lecture-transcript.md') ?? '';
    const fm = parseFrontmatter(written) ?? {};
    expect(fm.tags).toEqual(['other', 'Thema/Schlaf']);
    expect(fm.type).toBe('source');
    expect(fm.source_file).toBe(`[[${SOURCE_NOTE_PATH}]]`);
  });
});

describe('WikiEngine.createSummaryPage — a hand-set nested tag survives the gate (Issue #114)', () => {
  it('the harvest reads sources/ pages, so a tag the user typed there is vocabulary', async () => {
    const existing = [
      '---', 'type: source', 'tags: [paper, Thema/Handarbeit]', '---', '', 'Existing summary.', '',
    ].join('\n');
    const response = [
      '---', 'type: source', `source_file: "[[${SOURCE_NOTE_PATH}]]"`,
      'tags: [paper, Thema/Handarbeit]', 'aliases: ["Lecture"]', '---', '', '# Lecture transcript - Summary', '', 'A lecture.',
    ].join('\n');
    const h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: PLAIN_TRANSCRIPT, 'wiki/sources/lecture-transcript.md': existing },
      llmResponses: [response],
    });
    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    expect(parseFrontmatter(h.files.get('wiki/sources/lecture-transcript.md') ?? '')?.tags).toEqual(['paper', 'Thema/Handarbeit']);
  });
});

describe('WikiEngine.createSummaryPage — identity types are not source-page tags', () => {
  it('drops `theory` in default vocabulary mode too — the built-in concept type is legal on a concept page only', async () => {
    const response = [
      '---', 'type: source', `source_file: "[[${SOURCE_NOTE_PATH}]]"`,
      'tags: [other, theory]', 'aliases: ["Lecture"]', '---', '', '# Lecture transcript - Summary', '', 'A lecture.',
    ].join('\n');
    const h = createWikiEngineHarness({ files: { [SOURCE_NOTE_PATH]: PLAIN_TRANSCRIPT }, llmResponses: [response] });
    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    expect(parseFrontmatter(h.files.get('wiki/sources/lecture-transcript.md') ?? '')?.tags).toEqual(['other']);
  });

  it('keeps every form value the note names, not only the first', async () => {
    const h = createWikiEngineHarness({
      files: { [SOURCE_NOTE_PATH]: `---\ntags: [book, transcript]\n---\n\n${PLAIN_TRANSCRIPT}` },
      llmResponses: [SUMMARY_RESPONSE],
    });
    await h.engine.createSummaryPage(sourceFile(), makeAnalysis(), []);
    expect(tagsInPrompt(h)).toBe('book, transcript');
  });
});
