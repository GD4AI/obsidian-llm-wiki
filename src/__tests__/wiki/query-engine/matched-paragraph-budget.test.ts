// MATCHED PARAGRAPHS — #855 fix 6, and the budget that was missing with it.
//
// The retrieval scores the full body. The display shows one section
// (Description, else Definition) for an entity or concept page. So a page can
// be retrieved because of its third paragraph while the model never sees the
// third paragraph — the right page, for a reason it cannot check.
//
// `extractMatchedParagraphs` closes that gap. It existed, and both call sites of
// `loadRelevantPagesForQuery` omitted `queryTerms`, which is optional — so the
// extractor received `[]` and returned `''`. The fix was complete and
// unreachable. @DocTpoint's second review (#855) named it.
//
// The budget is the second half. Each page's summary is capped at
// `MAX_PAGE_CONTENT_CHARS / 3` and the matched paragraphs at the same, so an
// entity page carries 8,532 characters instead of 4,266. Retrieval returns up to
// RETRIEVAL_BUDGET pages, and nothing bounded the total: 20 x 8,532 = 170,640
// characters against a `TOKENS_QUERY_ANSWER` of 16,000.
//
// The cap is on the ADDITION, not on the whole page. The summary keeps the cap
// it has always had, so nothing that ships today gets smaller. The new budget is
// shared evenly across the retrieved pages, so a page late in the list is not
// starved by the ones before it.
import { describe, it, expect } from 'vitest';
import { loadRelevantPagesForQuery } from '../../../wiki/query-engine/pipeline/load-pages';
import { MAX_PAGE_CONTENT_CHARS, MATCHED_PARAGRAPHS_TOTAL_CHARS } from '../../../constants';

const SECTION_LABELS = { description: 'Description', definition: 'Definition' };

/** A page whose summary is short and whose body carries the query far below it. */
function pageWithDeepMatch(id: string, marker: string): string {
  return [
    '# Title',
    '',
    '## Description',
    '',
    'A short summary that says nothing about the query.',
    '',
    ...Array.from({ length: 40 }, (_, i) => `## Section ${i}\n\nFiller prose for section ${i}. ${'padding '.repeat(40)}`),
    `## Deep\n\nThis paragraph alone mentions ${marker} and explains it at length. ${marker} again.`,
    '',
  ].join('\n');
}

function reader(pages: Record<string, string>) {
  return {
    tryReadFile: async (p: string) => {
      // `loadRelevantPagesForQuery` asks for `${wikiFolder}/${title}.md`; the
      // fixture is keyed on the title, so match on the suffix.
      for (const [title, body] of Object.entries(pages)) {
        if (p.endsWith(`/${title}.md`) || p.endsWith(`/${title}`)) return body;
      }
      return null;
    },
  };
}

describe('matched paragraphs — the retrieval unit and the display unit agree', () => {
  it('carries the matched paragraph into the page the model reads', async () => {
    const out = await loadRelevantPagesForQuery(
      ['entities/deep'],
      'wiki',
      reader({ 'entities/deep.md': pageWithDeepMatch('entities/deep', 'quaternion') }),
      SECTION_LABELS,
      ['quaternion'],
    );

    const body = out[0];
    // The summary is there, and so is the paragraph that earned the page.
    expect(body).toContain('A short summary that says nothing');
    expect(body).toContain('quaternion');
  });

  it('still returns the summary when the query matched nothing outside it', async () => {
    const out = await loadRelevantPagesForQuery(
      ['entities/deep'],
      'wiki',
      reader({ 'entities/deep.md': pageWithDeepMatch('entities/deep', 'quaternion') }),
      SECTION_LABELS,
      ['a-term-that-appears-nowhere'],
    );

    expect(out[0]).toContain('A short summary that says nothing');
  });

  it('keeps the total matched-paragraph budget across the whole retrieval', async () => {
    const count = 20;
    const pages: Record<string, string> = {};
    const titles: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const t = `entities/p${i}`;
      titles.push(t);
      pages[`${t}.md`] = pageWithDeepMatch(t, 'quaternion');
    }

    const withMatch = await loadRelevantPagesForQuery(titles, 'wiki', reader(pages), SECTION_LABELS, ['quaternion']);
    const withoutMatch = await loadRelevantPagesForQuery(titles, 'wiki', reader(pages), SECTION_LABELS, ['no-such-term']);

    // The addition must not scale with the page count. Before the budget each
    // page added up to MAX_PAGE_CONTENT_CHARS / 3, so 20 pages added 85,320
    // characters on top of the summaries — against a 16,000-token answer.
    const added = withMatch.reduce((n, p, i) => n + (p.length - withoutMatch[i].length), 0);
    expect(added).toBeGreaterThan(0);
    expect(added).toBeLessThanOrEqual(MATCHED_PARAGRAPHS_TOTAL_CHARS);

    // And it is SHARED, not spent by whoever came first: a page late in the
    // list carries matched paragraphs too.
    expect(withMatch[count - 1]).toContain('quaternion');
  });

  it('does not shrink the summary a page already carried', async () => {
    const long = `## Description\n\n${'summary prose '.repeat(600)}`;
    const out = await loadRelevantPagesForQuery(
      ['entities/big'],
      'wiki',
      reader({ 'entities/big.md': long }),
      SECTION_LABELS,
      ['summary'],
    );

    expect(out[0].length).toBeGreaterThan(1000);
  });
});
