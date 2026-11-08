// value-survival.test.ts — the instrument behind #910.
//
// The question: does an exact value in a note survive ingest, and where?
// Two claims were argued from prompt text before this existed — "source pages
// are precise" and "source pages contain no details". Both were wrong in the
// same way: nobody counted.
//
// The first attempt on the real vaults failed for a reason worth keeping. It
// narrowed to "values in the same sentence as an entity that got a page", which
// needs a name matcher, and on test8 the page titles are Chinese while the notes
// are English, so it matched nothing and reported n=0. An instrument that needs
// to recognise a name before it can count has a language-dependent blind spot.
// This one does not match names at all: pages are attributed to a source by the
// `sources:` backlink the pipeline already writes, and the note is cleaned by
// masking the regions knowledge does not live in.
//
// Every expectation below is computed by hand from the fixture string.

import { describe, it, expect } from 'vitest';
import {
  maskNonKnowledge,
  harvestValues,
  classifyPosition,
  survivalOf,
  summarize,
  sourceSlugs,
  bareSlug,
  sourceFileOf,
  type Row,
} from '../../../../tools/dev-instrument/src/value-survival';

describe('maskNonKnowledge', () => {
  it('blanks frontmatter, fenced code and table rows without moving any offset', () => {
    const note = [
      '---',
      'title: x',
      'price: $999',
      '---',
      'The pump costs $420 in 2026-04-28 terms.',
      '```',
      'const x = 5;',
      '```',
      '| model | rpm |',
      '| --- | --- |',
      '| AB-1200 | 3000 |',
      'Tail sentence says 12.5%.',
    ].join('\n');

    const masked = maskNonKnowledge(note);

    expect(masked.length, 'masking must not change the length').toBe(note.length);
    expect(masked.split('\n').length, 'line numbers must stay aligned').toBe(note.split('\n').length);

    // Word characters survive only where prose survives.
    expect(masked).toContain('The pump costs $420 in 2026-04-28 terms.');
    expect(masked).toContain('Tail sentence says 12.5%.');
    expect(masked).not.toContain('$999');
    expect(masked).not.toContain('const x = 5');
    expect(masked).not.toContain('AB-1200');
  });

  it('blanks inline LaTeX math, so a formula is not read as a currency amount', () => {
    const note = 'The rate is $20 per hour. The bound is $2.58 \\times 10^5$ here, and $\\rho \\approx 7$ there.';
    const masked = maskNonKnowledge(note);
    expect(masked).not.toContain('10^5');
    expect(masked).toContain('The rate is $20 per hour.');
    expect(harvestValues(masked).map(v => v.text), 'only the real price survives').toEqual(['$20']);
  });

  it('does not run a currency amount into the sentence’s full stop', () => {
    expect(harvestValues('It is $36,500. The answer').map(v => v.text)).toEqual(['$36,500']);
    expect(harvestValues('It is $1,200.50 now').map(v => v.text)).toEqual(['$1,200.50']);
  });

  it('blanks an HTML table, which is what PDF and Office conversions leave behind', () => {
    const note = 'Before 25% here.\n<table>\n<tr><td>2,400 mg</td></tr>\n</table>\nAfter 25% there.';
    const masked = maskNonKnowledge(note);
    expect(masked).not.toContain('2,400 mg');
    expect(masked).toContain('Before 25% here.');
    expect(masked).toContain('After 25% there.');
  });
});

describe('harvestValues', () => {
  it('finds each kind once, and a currency amount is not also a bare number', () => {
    const text = 'Cost $1,200.50 on 2026-04-28, at 12.5% load, 340 GB disk, model TX-900.';
    const found = harvestValues(text).map(v => `${v.kind}:${v.text}`);

    expect(found).toEqual([
      'money:$1,200.50',
      'date:2026-04-28',
      'percent:12.5%',
      'spec:340 GB',
      'model:TX-900',
    ]);
  });

  it('reads a masked note as having no values in its tables', () => {
    const note = 'Prose says 340 GB.\n| a | b |\n| --- | --- |\n| 999 GB | 77% |';
    const found = harvestValues(maskNonKnowledge(note)).map(v => v.text);
    expect(found).toEqual(['340 GB']);
  });

  it('reads a decimal comma, which is what German-language notes use', () => {
    const found = harvestValues('Verlust 12,5 %, Gewicht 18,4 kg, Dauer 2,5 s.').map(v => `${v.kind}:${v.text}`);
    expect(found).toEqual(['percent:12,5 %', 'spec:18,4 kg', 'spec:2,5 s']);
  });

  it('reads a currency written after the amount, and a commitment in words', () => {
    const found = harvestValues('Preis 4.280 EUR, Vertrag 36 Monate.').map(v => `${v.kind}:${v.text}`);
    expect(found).toEqual(['money:4.280 EUR', 'spec:36 Monate']);
  });

  it('keeps offsets that point at the original text', () => {
    const text = 'aaaaaaaaaa $42 tail';
    const [money] = harvestValues(text);
    expect(text.slice(money.offset, money.offset + money.text.length)).toBe('$42');
  });
});

describe('classifyPosition', () => {
  it('splits at the 500-character window the source page actually sees', () => {
    expect(classifyPosition(0, 3000)).toBe('head');
    expect(classifyPosition(499, 3000)).toBe('head');
    expect(classifyPosition(500, 3000)).toBe('middle');
    expect(classifyPosition(2499, 3000)).toBe('middle');
    expect(classifyPosition(2500, 3000)).toBe('tail');
  });

  it('does not call a whole short note head only', () => {
    expect(classifyPosition(400, 600)).toBe('head');
    expect(classifyPosition(550, 600)).toBe('tail');
  });
});

describe('survivalOf', () => {
  it('prefers the quoted passage over prose, and prose over nothing', () => {
    expect(survivalOf('340 GB', 'nada 340 GB nada', 'other 340 GB here')).toBe('quoted');
    expect(survivalOf('340 GB', 'nothing here', 'other 340 GB here')).toBe('prose');
    expect(survivalOf('340 GB', 'nothing here', 'nothing there')).toBe('absent');
  });

  it('matches through spacing and thousands separators the model may reformat', () => {
    expect(survivalOf('$1,200.50', 'costs $1,200.50 today', '')).toBe('quoted');
    expect(survivalOf('340 GB', 'disk 340GB total', '')).toBe('quoted');
    expect(survivalOf('12.5%', 'at 12.5 % load', '')).toBe('quoted');
  });
});

describe('backlink parsing', () => {
  it('reads a quoted wikilink, which is how the pipeline writes it', () => {
    const page = '---\ntype: concept\nsources:\n  - "[[sources/deepseek_v3_2_exp_2025-09_74c983]]"\ntags:\n---\n\n# body\n';
    expect(sourceSlugs(page)).toEqual(['deepseek_v3_2_exp_2025-09_74c983']);
  });

  it('reads an unquoted wikilink and an inline array', () => {
    expect(sourceSlugs('---\nsources:\n  - [[sources/a_11]]\n  - [[sources/b_22]]\n---\n')).toEqual(['a_11', 'b_22']);
    expect(sourceSlugs('---\nsources: [[sources/c_33]]\n---\n')).toEqual(['c_33']);
  });

  it('keeps the last path segment and drops an anchor or an alias', () => {
    expect(bareSlug('"[[sources/a_11#Sec|shown]]"')).toBe('a_11');
    expect(bareSlug('[[wiki/sources/a_11]]')).toBe('a_11');
  });

  it('finds the note a source page came from', () => {
    const page = '---\ntype: source\nsource_file: "[[AI资料/Chain-of-Thought.pdf.md]]"\ngeneration_complete: true\n---\n';
    expect(sourceFileOf(page)).toBe('AI资料/Chain-of-Thought.pdf.md');
  });
});

describe('summarize', () => {
  it('reports survival per position and per kind, as a share of that row', () => {
    const rows: Row[] = [
      { pageType: 'source', kind: 'money', position: 'head', outcome: 'quoted' },
      { pageType: 'source', kind: 'money', position: 'head', outcome: 'prose' },
      { pageType: 'source', kind: 'money', position: 'head', outcome: 'absent' },
      { pageType: 'source', kind: 'money', position: 'head', outcome: 'absent' },
      { pageType: 'concept', kind: 'spec', position: 'tail', outcome: 'quoted' },
    ];

    const report = summarize(rows);

    expect(report.total).toBe(5);
    expect(report.byPosition.find(r => r.position === 'head')).toMatchObject({
      n: 4, quoted: 1, prose: 1, absent: 2, absentShare: 0.5,
    });
    expect(report.byKind.find(r => r.kind === 'spec')).toMatchObject({
      n: 1, quoted: 1, absent: 0, absentShare: 0,
    });
  });

  it('separates the page types, because a value on the source page and a value on a concept page are different claims', () => {
    const rows: Row[] = [
      { pageType: 'source', kind: 'date', position: 'head', outcome: 'quoted' },
      { pageType: 'entity', kind: 'date', position: 'head', outcome: 'absent' },
    ];
    const report = summarize(rows);
    expect(report.byPageType.find(r => r.pageType === 'source')?.quoted).toBe(1);
    expect(report.byPageType.find(r => r.pageType === 'entity')?.absent).toBe(1);
  });
});
