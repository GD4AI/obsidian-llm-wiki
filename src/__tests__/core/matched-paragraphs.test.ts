/**
 * The retrieval unit and the display unit must agree.
 *
 * The retrieval scores the full body: a page can be found because of
 * something in its third paragraph. The display shows only the
 * Description/Definition section for entity and concept pages, capped around
 * 4,266 characters. So the model gets the right page for a reason it cannot
 * see.
 *
 * The fix is not to show the whole body — that is what the cap is for. The
 * fix is to bring the paragraphs the query actually matched, so the model can
 * see why the page was retrieved.
 */
import { describe, it, expect } from 'vitest';
import { extractMatchedParagraphs } from '../../core/section-extractor';

describe('the matched paragraphs follow the page into the context', () => {
  it('returns the paragraph that contains the query term', () => {
    const body = [
      '# Target',
      '',
      '## Description',
      '',
      'The description says nothing about the topic.',
      '',
      '## Details',
      '',
      'This paragraph mentions the rare keyword.',
      '',
      'Another paragraph on something else.',
    ].join('\n');
    const out = extractMatchedParagraphs(body, ['rare keyword'], 2000);
    expect(out).toContain('rare keyword');
    expect(out).not.toContain('Another paragraph');
  });

  it('returns nothing when the query matches only the summary section', () => {
    // The summary is already in the context; repeating it wastes the budget.
    const body = [
      '## Description',
      '',
      'The description mentions the rare keyword.',
      '',
      '## Details',
      '',
      'A paragraph on something else.',
    ].join('\n');
    const out = extractMatchedParagraphs(body, ['rare keyword'], 2000, {
      summarySectionLabels: ['Description'],
    });
    expect(out).toBe('');
  });

  it('returns nothing when the query matches nothing', () => {
    const body = '## Description\n\nA paragraph on something else.';
    expect(extractMatchedParagraphs(body, ['nonexistent-xyz'], 2000)).toBe('');
  });

  it('respects the character budget', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Paragraph ${i} with the rare keyword inside it.`).join('\n\n');
    const out = extractMatchedParagraphs(paragraphs, ['rare keyword'], 100);
    expect(out.length).toBeLessThanOrEqual(100);
  });

  it('matches on any of the query terms, not just the first', () => {
    const body = 'First paragraph.\n\nSecond paragraph with alpha.\n\nThird with beta.';
    const out = extractMatchedParagraphs(body, ['alpha', 'beta'], 2000);
    expect(out).toContain('alpha');
    expect(out).toContain('beta');
  });

  it('deduplicates when a term appears in several paragraphs', () => {
    const body = 'First with alpha.\n\nSecond with alpha.\n\nThird with alpha.';
    const out = extractMatchedParagraphs(body, ['alpha'], 2000);
    expect(out.match(/alpha/g)?.length).toBe(3);
  });
});
