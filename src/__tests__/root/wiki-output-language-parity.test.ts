// Every selectable language must reach every surface it can appear on (#1048).
//
// `WIKI_LANGUAGES` is the only list either dropdown reads, so one entry there is
// enough to make a language selectable. What it does NOT do is fill the three
// tables the wiki output is written from: `SECTION_LABELS` (page headings),
// `SOURCE_PAGE_HEAD_LABELS` (source page head), and `TEXTS.en.indexLabels`
// (index.md). Each of those falls back to English on a missing key — silently.
// That is the #1034 defect shape: the feature looks present because the English
// text is present, and nothing reports that the translation never ran.
//
// `LOG_LABELS` is in the same list and already has its own guard
// (`log-labels.test.ts` iterates the table it finds); this one states the rule
// for every surface at once, so the next language cannot ship half-wired.

import { describe, expect, it } from 'vitest';
import { WIKI_LANGUAGES } from '../../types';
import { SECTION_LABELS, SOURCE_PAGE_HEAD_LABELS } from '../../wiki/system-prompts';
import { LOG_LABELS } from '../../core/log-labels';
import { TEXTS } from '../../texts';

const LANGUAGES = Object.keys(WIKI_LANGUAGES);

describe('#1048 — a selectable language is wired into the wiki output', () => {
  it('offers more than the eleven it started with', () => {
    for (const code of ['nl', 'pl', 'th']) expect(LANGUAGES, code).toContain(code);
  });

  it.each(LANGUAGES)('%s has page section labels', (lang) => {
    const labels = SECTION_LABELS[lang] as Record<string, string> | undefined;
    expect(labels, `${lang} is selectable but has no SECTION_LABELS row`).toBeDefined();
    expect(Object.keys(labels!).sort()).toEqual(Object.keys(SECTION_LABELS.en).sort());
    for (const [key, value] of Object.entries(labels!)) {
      expect(value.trim(), `${lang}.${key} is empty`).not.toBe('');
    }
  });

  it.each(LANGUAGES)('%s has source page head labels', (lang) => {
    const labels = SOURCE_PAGE_HEAD_LABELS[lang as keyof typeof SOURCE_PAGE_HEAD_LABELS];
    expect(labels, `${lang} is selectable but has no SOURCE_PAGE_HEAD_LABELS row`).toBeDefined();
    for (const [key, value] of Object.entries(labels!)) {
      expect(value.trim(), `${lang}.${key} is empty`).not.toBe('');
    }
  });

  it.each(LANGUAGES)('%s has index labels', (lang) => {
    const table = TEXTS.en.indexLabels as Record<string, Record<string, string>>;
    const labels = table[lang];
    expect(labels, `${lang} is selectable but has no indexLabels row`).toBeDefined();
    for (const [key, value] of Object.entries(labels)) {
      expect(value.trim(), `${lang}.${key} is empty`).not.toBe('');
    }
  });

  it.each(LANGUAGES)('%s has ingest-log labels', (lang) => {
    expect(LOG_LABELS[lang], `${lang} is selectable but has no LOG_LABELS row`).toBeDefined();
  });
});
