/**
 * BODY LENGTH NORMALISATION — why it must be off for `text`.
 *
 * Measured on two vaults, truth edge removed, strict set (pairs sharing under a
 * third of their terms): disabling length normalisation for the body moves
 * recall from 0.385 to 0.431 at k=10 on test8 and 0.268 to 0.326 on test10.
 * That is the whole gap between the production substring scorer and BM25F,
 * which had been winning for reasons nobody had isolated.
 *
 * The reason is structural. BM25F's normaliser is `1 - b + b * len / avg`, so a
 * field much longer than average is damped hard. The body is the only long
 * field — hundreds of words against a title's few — so it is the only field the
 * normaliser really acts on. And on the strict set a body hit is the RARE
 * signal: 99 % of the bridging terms appear in the body and nowhere else. The
 * normaliser was damping exactly the evidence the strict layer exists to find.
 *
 * The BM25 assumption behind length damping is "a long field matched by chance
 * more often". That is true for prose about a common word and false for a rare
 * term found in one page's body. Density is the wrong currency for a bridge.
 *
 * So: `text` is NOT length-normalised. `title`, `alias` and `summary` keep the
 * classic form — they are short and the normaliser is close to neutral there.
 * No performance cost: one comparison in an existing loop.
 */
import { describe, it, expect } from 'vitest';
import { buildPageTerms, buildCorpusTerms, bm25fScore, DEFAULT_FIELD_WEIGHTS } from '../../core/term-index';

describe('bm25fScore — the body is not damped for being long', () => {
  it('a body hit scores the same on a long page as on a short one', () => {
    // Two pages carry the term in the body exactly once. One has a body twenty
    // times longer. Under the classic normaliser the long page is damped and
    // the short one wins; with the fix the two tie, because one mention is one
    // mention either way.
    const short = buildPageTerms({ title: 'alpha', aliases: [], summary: 's', text: 'needle' });
    const long = buildPageTerms({
      title: 'beta',
      aliases: [],
      summary: 's',
      text: `needle ${'filler words here '.repeat(20)}`,
    });
    const corpus = buildCorpusTerms([short, long]);

    const sShort = bm25fScore(['needle'], short, corpus, DEFAULT_FIELD_WEIGHTS);
    const sLong = bm25fScore(['needle'], long, corpus, DEFAULT_FIELD_WEIGHTS);

    expect(sShort).toBeGreaterThan(0);
    expect(sLong).toBeCloseTo(sShort, 6);
  });

  it('the title still beats the body at equal length', () => {
    // The weight table is title 3 / body 1 and must survive the change. This is
    // what keeps the fix from turning into "long pages win".
    const inTitle = buildPageTerms({ title: 'needle', aliases: [], summary: '', text: '' });
    const inBody = buildPageTerms({ title: 'zeta', aliases: [], summary: '', text: 'needle' });
    const corpus = buildCorpusTerms([inTitle, inBody]);

    const sTitle = bm25fScore(['needle'], inTitle, corpus, DEFAULT_FIELD_WEIGHTS);
    const sBody = bm25fScore(['needle'], inBody, corpus, DEFAULT_FIELD_WEIGHTS);

    expect(sTitle).toBeGreaterThan(sBody);
  });

  it('repetition in the body still saturates', () => {
    // Removing length damping must not remove tf saturation. Saying a word ten
    // times is not ten facts — that property is what killed the keyword-stuffed
    // distractor and it stays.
    const once = buildPageTerms({ title: 'a', aliases: [], summary: '', text: 'needle' });
    const ten = buildPageTerms({ title: 'b', aliases: [], summary: '', text: 'needle '.repeat(10) });
    const corpus = buildCorpusTerms([once, ten]);

    const sOnce = bm25fScore(['needle'], once, corpus, DEFAULT_FIELD_WEIGHTS);
    const sTen = bm25fScore(['needle'], ten, corpus, DEFAULT_FIELD_WEIGHTS);

    expect(sTen).toBeGreaterThan(sOnce);
    // Diminishing returns: ten mentions are worth far less than ten times one.
    expect(sTen).toBeLessThan(sOnce * 10);
  });
});
