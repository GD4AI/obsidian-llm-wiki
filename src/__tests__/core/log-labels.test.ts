// One table for the ingest log's section labels, read by the writer and the
// parser alike (#667). Before: the writer read an eight-language table out
// of `TEXTS.en`, so it/ru/zh-Hant vaults got English headings; the parser
// carried its own hand-typed alternation, which had lost Spanish.

import { describe, it, expect, vi } from 'vitest';
import { LOG_LABELS, getLogLabels, logLabelLineRe } from '../../core/log-labels';
import { WIKI_LANGUAGES } from '../../types';
import { LogWriter } from '../../wiki/engine-internals/log-writer';
import { TEXTS } from '../../texts';
import { parseLogEntries } from '../../core/log-parser';
import type { SourceAnalysis } from '../../types';

describe('LOG_LABELS', () => {
  it('gives every selectable wiki language the same label keys as English', () => {
    // The reference is `en`, not each row's own key list. Iterating a row's
    // `Object.values` cannot see a key the row does not have, which is exactly
    // how `movedPages` reached eleven rows while nl/pl/th shipped without it
    // (#1051 rebased onto #1048). Nothing throws on the gap: `getLogLabels`
    // hands the row back as it is, and the writer then puts `**undefined**` in
    // the user's log. So the key set is the thing under test.
    const reference = Object.keys(LOG_LABELS.en).sort();
    expect(reference.length, 'en is the reference and cannot be empty').toBeGreaterThan(0);
    for (const lang of Object.keys(WIKI_LANGUAGES)) {
      const labels = LOG_LABELS[lang];
      expect(labels, lang).toBeDefined();
      const entries = Object.entries(labels);
      expect(entries.map(([key]) => key).sort(), `${lang} has a different label set than en`).toEqual(reference);
      for (const [key, value] of entries) {
        expect(value.trim().length, `${lang}.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to English for an unknown or missing language', () => {
    expect(getLogLabels('xx')).toBe(LOG_LABELS.en);
    expect(getLogLabels(undefined)).toBe(LOG_LABELS.en);
    expect(getLogLabels('constructor')).toBe(LOG_LABELS.en);
    expect(getLogLabels('ru')).toBe(LOG_LABELS.ru);
  });

  it('logLabelLineRe matches every language and captures the rest of the line', () => {
    const re = logLabelLineRe('createdPages');
    for (const [lang, labels] of Object.entries(LOG_LABELS)) {
      const m = re.exec(`**${labels.createdPages}**：[[entities/A]]`);
      expect(m, lang).not.toBeNull();
      expect(m![1]).toBe('[[entities/A]]');
    }
    expect(re.test('**Updated pages**: [[entities/A]]')).toBe(false);
  });
});

describe('writer and parser share the table', () => {
  const analysis: SourceAnalysis = {
    source_file: 'sources/t.md',
    source_title: 'T',
    summary: '',
    entities: [],
    concepts: [],
    related_pages: [],
    key_points: [],
    created_pages: ['wiki/entities/Foo'],
    updated_pages: ['entities/Bar'],
    source_note_aliases: [],
  };

  // es was unparseable before (the parser knew `Páginas criadas` twice and
  // `Páginas creadas` not at all); it, ru and zh-Hant were written in English.
  it.each(['es', 'it', 'ru', 'zh-Hant'])('%s: what the writer writes, the parser reads', async (lang) => {
    let written = '';
    const writer = new LogWriter({
      wikiFolder: 'wiki',
      wikiLanguage: lang,
      commandName: TEXTS[lang as keyof typeof TEXTS].cmdViewHistory,
      readFile: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn(async (_p: string, c: string) => { written = c; }),
    });
    await writer.appendIngest('ingest', analysis, []);

    expect(written).toContain(`**${LOG_LABELS[lang].createdPages}**`);
    expect(written).not.toContain('**Created pages**');

    const entries = parseLogEntries(written);
    expect(entries).toHaveLength(1);
    expect(entries[0].createdPages).toEqual(['entities/Foo']);
    expect(entries[0].updatedPages).toEqual(['entities/Bar']);
  });
});
