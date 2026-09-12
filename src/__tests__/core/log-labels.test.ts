// One table for the ingest log's section labels, read by the writer and the
// parser alike (#667). Before: the writer read an eight-language table out
// of `TEXTS.en`, so it/ru/zh-Hant vaults got English headings; the parser
// carried its own hand-typed alternation, which had lost Spanish.

import { describe, it, expect, vi } from 'vitest';
import { LOG_LABELS, getLogLabels, logLabelLineRe } from '../../core/log-labels';
import { WIKI_LANGUAGES } from '../../types';
import { LogWriter } from '../../wiki/engine-internals/log-writer';
import { parseLogEntries } from '../../core/log-parser';
import type { SourceAnalysis } from '../../types';

describe('LOG_LABELS', () => {
  it('covers every selectable wiki language with three non-empty labels', () => {
    for (const lang of Object.keys(WIKI_LANGUAGES)) {
      const labels = LOG_LABELS[lang];
      expect(labels, lang).toBeDefined();
      for (const value of Object.values(labels)) {
        expect(value.trim().length, lang).toBeGreaterThan(0);
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
