/**
 * The lexical channel scores with BM25F.
 *
 * `lexMatch` used a hand-tuned weight table — title 3, alias 2, summary 1,
 * text 1 — over substring hits. That scorer cannot say a generic term is
 * worth less than a specific one, and every anomaly became another patch.
 * BM25F already exists in the project, is the scorer `select-seeds` uses, and
 * measured better on every vault tested:
 *
 *   vault    lexMatch  BM25F   delta
 *   test8    0.155     0.245   +0.090
 *   test10   0.100     0.205   +0.105
 *   testdata 0.000     0.087   +0.087
 *   sample50 0.125     0.190   +0.065
 *
 * The contract: `lexMatch` keeps its signature and its return shape. What
 * changes is how it decides. A caller that passes no terms falls back to the
 * legacy scorer — the wiki index does not carry bodies and cannot build the
 * tables.
 */
import { describe, it, expect } from 'vitest';
import { lexMatch, type PageRef } from '../../core/ppr-cascade';
import { buildPageTerms, buildCorpusTerms, type PageTerms } from '../../core/term-index';

const ref = (title: string, text = '', aliases: string[] = []): PageRef => ({
  path: `${title}.md`, title, aliases, text,
});

const toTerms = (refs: readonly PageRef[]): PageTerms[] =>
  refs.map(r => buildPageTerms({ title: r.title, aliases: r.aliases, summary: r.summary ?? '', text: r.text ?? '' }));

const pages: PageRef[] = [
  ref('Alpha', 'alpha one two three four five six seven eight nine ten'),
  ref('Beta', 'beta one two three four five six seven eight nine ten'),
  ref('Gamma', 'gamma one two three four five six seven eight nine ten'),
];
const terms = toTerms(pages);
const corpus = buildCorpusTerms(terms);

describe('lexMatch scores with BM25F when the caller supplies the tables', () => {
  it('ranks a page whose title matches above one whose body matches', () => {
    const out = lexMatch('alpha', pages, { terms, corpus });
    expect(out[0].title).toBe('Alpha');
  });

  it('returns every page that matches at least one term', () => {
    const out = lexMatch('alpha beta', pages, { terms, corpus });
    expect(out.length).toBeGreaterThanOrEqual(2);
  });

  it('returns an empty list for an empty query', () => {
    expect(lexMatch('', pages, { terms, corpus })).toEqual([]);
    expect(lexMatch('   ', pages, { terms, corpus })).toEqual([]);
  });

  it('is deterministic', () => {
    const a = lexMatch('one', pages, { terms, corpus });
    const b = lexMatch('one', pages, { terms, corpus });
    expect(a.map(p => p.path)).toEqual(b.map(p => p.path));
  });

  it('falls back to the legacy scorer when no tables are given', () => {
    const out = lexMatch('alpha', pages);
    expect(out[0].title).toBe('Alpha');
    expect(out.length).toBeGreaterThan(0);
  });

  it('prefers a rare term over a common one (IDF is what BM25F adds)', () => {
    // The discriminator. `common` appears on two pages, `rare` on one. A
    // scorer with no IDF ranks them by count and the two pages tie; BM25F
    // weights the rare term higher and the rare page wins. This is the test
    // that fails on the legacy scorer.
    const refs: PageRef[] = [
      ref('Common One', 'common'),
      ref('Common Two', 'common'),
      ref('Rare Page', 'rare'),
    ];
    const t = toTerms(refs);
    const c = buildCorpusTerms(t);
    const out = lexMatch('common rare', refs, { terms: t, corpus: c });
    expect(out[0].title).toBe('Rare Page');
  });

  it('a title match still outranks a body match (the field weights survive)', () => {
    // BM25F keeps the project's calibrated field ratio. A body hit must not
    // beat a title hit on equal IDF.
    const refs: PageRef[] = [
      ref('Target', 'nothing here at all'),
      ref('Other', 'body mentions target somewhere in the prose'),
    ];
    const t = toTerms(refs);
    const c = buildCorpusTerms(t);
    const out = lexMatch('target', refs, { terms: t, corpus: c });
    expect(out[0].title).toBe('Target');
  });
});
