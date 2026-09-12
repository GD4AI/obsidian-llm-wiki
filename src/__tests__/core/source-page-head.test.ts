// The head of a sources/ page — H1 and Source section — carries what the code
// knows (title, note path, ingest date). The model copied all three from the
// template, and a copy could come back wrong.

import { describe, it, expect } from 'vitest';
import { stampSourcePageHead } from '../../core/source-page-head';
import { SECTION_LABELS, SOURCE_PAGE_HEAD_LABELS, getSourcePageHeadLabels } from '../../wiki/system-prompts';
import type { LLMWikiSettings } from '../../types';

const labels = (wikiLanguage: string) => getSourcePageHeadLabels({ wikiLanguage } as LLMWikiSettings);

const HEAD = { title: 'Zytokine', sourcePath: 'Notizen/Zytokine.md', date: '2026-09-11' };

const MODEL_PAGE = `---
type: source
source_file: "[[Notizen/Zytokine.md]]"
---

# Zytokines - Summary

## Quelle

- Originaldatei: [[Notizen/Zytokines.md]]
- Datum der Erfassung: 2026-09-10

## Kerninhalt

Signalproteine des Immunsystems.
`;

describe('stampSourcePageHead', () => {
  it('replaces the model-written H1 and Source section with the code-known values', () => {
    const out = stampSourcePageHead(MODEL_PAGE, HEAD, labels('de'));
    expect(out).toContain('# Zytokine - Zusammenfassung\n');
    expect(out).toContain('## Quelle\n\n- Originaldatei: [[Notizen/Zytokine.md]]\n- Importiert: 2026-09-11');
    expect(out).not.toContain('Zytokines');
    expect(out).not.toContain('Datum der Erfassung');
    expect(out.match(/^## Quelle/gm)).toHaveLength(1);
  });

  it('keeps the frontmatter and every other section as written', () => {
    const out = stampSourcePageHead(MODEL_PAGE, HEAD, labels('de'));
    expect(out.startsWith('---\ntype: source\nsource_file: "[[Notizen/Zytokine.md]]"\n---\n\n# Zytokine')).toBe(true);
    expect(out).toContain('## Kerninhalt\n\nSignalproteine des Immunsystems.');
  });

  it('adds the head when the model wrote neither H1 nor Source section', () => {
    const out = stampSourcePageHead('---\ntype: source\n---\n\n## Core Content\n\nText.\n', HEAD, labels('en'));
    expect(out).toBe(
      '---\ntype: source\n---\n\n# Zytokine - Summary\n\n## Source\n\n- Original file: [[Notizen/Zytokine.md]]\n- Ingested: 2026-09-11\n\n## Core Content\n\nText.\n',
    );
  });

  it('removes a Source section that is the last section of the page', () => {
    const page = '---\ntype: source\n---\n\n# X - Summary\n\n## Core Content\n\nText.\n\n## Source\n\n- Original file: [[wrong.md]]\n';
    const out = stampSourcePageHead(page, HEAD, labels('en'));
    expect(out).not.toContain('wrong.md');
    expect(out.match(/^## Source/gm)).toHaveLength(1);
    expect(out).toContain('## Core Content\n\nText.');
  });

  it('leaves an H1 alone that does not open the body', () => {
    const page = '---\ntype: source\n---\n\n## Core Content\n\n# Not the title\n';
    const out = stampSourcePageHead(page, HEAD, labels('en'));
    expect(out).toContain('# Not the title');
  });

  it('has head labels for every wiki language, kept out of the section headings', () => {
    for (const lang of Object.keys(SECTION_LABELS)) {
      expect(Object.values(SOURCE_PAGE_HEAD_LABELS[lang] ?? {}).filter(v => v.trim())).toHaveLength(3);
      const headings = Object.values(SECTION_LABELS[lang]);
      for (const label of Object.values(SOURCE_PAGE_HEAD_LABELS[lang])) expect(headings).not.toContain(label);
    }
  });
});
