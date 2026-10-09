/**
 * v1.24.1 PATCH Phase 5.5.0: lexMatchByTitleAndAliases.
 *
 * Pure function — scores pages by query-token substring overlap
 * against page TITLE + ALIASES ONLY (not summary). Used by the
 * Stage 1 lex scorer in the 4-stage seed-selection pipeline.
 *
 * Why no summary: user vault pages frequently lack summary frontmatter
 * (e.g. entities/Janus.md has no `summary:` field but rich aliases).
 * Using summary would silently drop many pages from consideration. The
 * aliases carry the curated "what is this page" signal — stable across
 * the codebase and intentionally short.
 *
 * Scoring (per token, first matching location wins):
 *   - title hit:  3
 *   - alias hit:  2
 *
 * Page-level bonus: when ALL tokens are found somewhere in the page's
 * title+aliases (i.e. full multi-token match), +2 (strong relevance).
 *
 * Returns pages sorted by score descending. Pages with zero overlap
 * are NOT included.
 */
import { describe, it, expect } from 'vitest';
import { lexMatchByTitleAndAliases as lexMatchBm25 } from '../../core/ppr-cascade';
import type { PageRef } from '../../core/ppr-cascade';
import { buildPageTerms, buildCorpusTerms } from '../../core/term-index';

// #729 Phase 4. Every test in this file documents the LEGACY absolute-scale
// contract — title 3 / alias 2, "score = 3 per token", the +2 all-tokens
// bonus. That contract is real and still reachable behind `scorer: 'legacy'`;
// it is just no longer what the default path runs. The default is BM25F, whose
// scores have no absolute scale, so "score = 3" would be meaningless there.
// Routing the whole file through the switch keeps the contract pinned without
// rewriting seven assertions into ones that no longer say anything.
const lexMatchByTitleAndAliases = (query: string, pages: PageRef[]) =>
  lexMatchBm25(query, pages, { scorer: 'legacy' });

function makePage(path: string, title: string, aliases: string[] = [], summary = ''): PageRef {
  return { path, title, aliases, summary };
}

describe('lexMatchByTitleAndAliases (Phase 5.5.0)', () => {
  it('returns empty array for empty page list', () => {
    expect(lexMatchByTitleAndAliases('DeepSeek', [])).toEqual([]);
  });

  it('returns empty array when no token matches anything', () => {
    const pages = [
      makePage('a/foo', 'Foo'),
      makePage('a/bar', 'Bar'),
    ];
    expect(lexMatchByTitleAndAliases('zzz nothing here', pages)).toEqual([]);
  });

  it('matches title (score 3 per token)', () => {
    const pages = [
      makePage('a/DeepSeek', 'DeepSeek'),
      makePage('a/Other', 'Other'),
    ];
    const matched = lexMatchByTitleAndAliases('DeepSeek', pages);
    expect(matched).toHaveLength(1);
    expect(matched[0].page.path).toBe('a/DeepSeek');
    // score = 3 (title hit)
    expect(matched[0].score).toBeGreaterThanOrEqual(3);
  });

  it('matches alias (score 2 per token)', () => {
    const pages = [
      makePage('a/Janus', 'Janus', ['DeepSeek Janus', 'Janus framework']),
      makePage('a/Other', 'Other', ['irrelevant']),
    ];
    const matched = lexMatchByTitleAndAliases('DeepSeek', pages);
    expect(matched[0].page.path).toBe('a/Janus');
    // score = 2 (alias hit, no title hit)
    expect(matched[0].score).toBe(2);
  });

  it('matches both title and alias — title wins (first location)', () => {
    // Per spec: "first matching location wins". So a token that hits
    // both title AND alias counts as ONE title hit (score 3), not
    // title+alias (score 5).
    const pages = [
      makePage('a/x', 'DeepSeek', ['DeepSeek alias']),
    ];
    const matched = lexMatchByTitleAndAliases('DeepSeek', pages);
    expect(matched[0].score).toBe(3);
  });

  it('multi-token query with all-tokens-found bonus (+2)', () => {
    const pages = [
      // Page A: only one of two tokens in title.
      makePage('a/DeepSeek-Model', 'DeepSeek-Model'),
      // Page B: BOTH tokens in aliases.
      makePage('a/x', 'Generic', ['DeepSeek', 'Janus']),
    ];
    const matched = lexMatchByTitleAndAliases('DeepSeek Janus', pages);
    // Page B should rank above Page A because all-tokens-found bonus.
    expect(matched[0].page.path).toBe('a/x');
    expect(matched[1].page.path).toBe('a/DeepSeek-Model');
  });

  it('scores a summary-only match at the low tier (revised 2026-10-07)', () => {
    // This test used to assert the opposite, under the title "does NOT match
    // against summary (the bug fix)". Its stated reason was that pages without
    // a summary would be "silently dropped". That reason is arithmetically
    // false: a positive low-weight tier adds candidates and cannot remove one,
    // because a page with no overlap still scores zero and is still left out.
    // The incident is kept because the rule it guarded is now measured:
    // #729's arm C lost 3 of 5 questions at this stage, and the page that
    // scored zero was "Consolidation kernel" against "how has knowledge evolved".
    // The summary is the one field written in the register a question uses.
    const pages = [
      makePage('a/Janus', 'Janus', [], 'This page is about DeepSeek multimodal model.'),
    ];
    const matched = lexMatchByTitleAndAliases('DeepSeek', pages);
    expect(matched).toHaveLength(1);
    expect(matched[0].score).toBe(1); // summary tier, below an alias hit (2)
  });

  it('a name hit still outranks a summary-only hit', () => {
    // The tier is low on purpose. Without this the summary would let a
    // passing mention beat the page named for the thing.
    const pages = [
      makePage('a/named', 'DeepSeek', []),
      makePage('a/mention', 'Janus', [], 'mentions DeepSeek in passing'),
    ];
    const matched = lexMatchByTitleAndAliases('DeepSeek', pages);
    expect(matched[0].page.path).toBe('a/named');
    expect(matched[0].score).toBe(3);
    expect(matched[1].score).toBe(1);
  });

  it('CJK query: matches CJK characters in title (tokenizeQuery supports CJK)', () => {
    // Per user direction 2026-07-13: tokenizeQuery extracts ASCII runs
    // AND single CJK characters. lexMatchByTitleAndAliases inherits
    // this via the shared tokenizeQuery helper.
    const pages = [
      makePage('a/x', '深度学习', []),
    ];
    const matched = lexMatchByTitleAndAliases('深度', pages);
    expect(matched).toHaveLength(1);
  });

  it('CJK query: matches CJK characters in alias', () => {
    const pages = [
      makePage('a/x', 'DeepSeek', ['深度学习']),
    ];
    const matched = lexMatchByTitleAndAliases('深度', pages);
    expect(matched).toHaveLength(1);
    expect(matched[0].score).toBe(2); // alias hit
  });

  it('handles InterVL/Janus e2e case — matches via aliases', () => {
    // The exact user e2e scenario: query mentions InternVL and Janus,
    // pages have rich aliases ("DeepSeek Janus", "Janus Pro" etc)
    // but no summary.
    //
    // Note: query uses "InternVL" (with the second `n`), matching the
    // canonical product name. Pages are similarly InternVL3 (the page
    // is the InternVL 3 series). TokenizeQuery extracts the run
    // "internvl" (8 chars, both n's) which substring-matches
    // "internvl3" (lowercased title).
    const pages = [
      makePage('entities/Janus', 'Janus', ['DeepSeek Janus', 'Janus model']),
      makePage('entities/Janus-Pro', 'Janus-Pro', ['Janus Pro', 'Janus-Pro-7B']),
      makePage('entities/InternVL3', 'InternVL3', ['InternVL 3', 'OpenGVLab']),
      makePage('entities/DeepSeek', 'DeepSeek', []),
      makePage('entities/RandomTopic', 'Random', []),
    ];
    const matched = lexMatchByTitleAndAliases('InternVL和Janus', pages);
    // Janus, Janus-Pro, InternVL3 should all match (title or alias).
    const matchedPaths = matched.map(m => m.page.path).sort();
    expect(matchedPaths).toContain('entities/Janus');
    expect(matchedPaths).toContain('entities/Janus-Pro');
    expect(matchedPaths).toContain('entities/InternVL3');
    // RandomTopic should NOT match.
    expect(matchedPaths).not.toContain('entities/RandomTopic');
  });

  it('ranks results by score descending', () => {
    const pages = [
      makePage('a/x', 'Random', []),
      makePage('a/y', 'Janus-Pro', ['Janus Pro']), // title hit (3) + alias hit on second token
      makePage('a/z', 'Janus', ['Janus framework']), // alias hit (2)
    ];
    const matched = lexMatchByTitleAndAliases('Janus', pages);
    // y ranks above z (3 > 2).
    expect(matched[0].page.path).toBe('a/y');
    expect(matched[1].page.path).toBe('a/z');
  });

  it('case-insensitive', () => {
    const pages = [
      makePage('a/x', 'DEEPSEEK', []),
    ];
    const matched = lexMatchByTitleAndAliases('deepseek', pages);
    expect(matched).toHaveLength(1);
  });

  it('is a pure function (no IO, deterministic)', () => {
    const pages = [
      makePage('a/x', 'Foo'),
      makePage('a/y', 'Bar'),
    ];
    const r1 = lexMatchByTitleAndAliases('Foo', pages);
    const r2 = lexMatchByTitleAndAliases('Foo', pages);
    expect(r1).toEqual(r2);
  });
});
describe('lexMatchByTitleAndAliases — the BM25F default (Phase 4)', () => {
  // The default path is BM25F now. These assert what that gives, and one thing
  // it must not: an additive breadth bonus, which would be a constant sized for
  // a different scorer sitting on top of one with no absolute scale.
  it('is the default and returns a positive score for a title hit', () => {
    const pages: PageRef[] = [{ path: 'a/x', title: 'DeepSeek', aliases: [] }];
    const matched = lexMatchBm25('DeepSeek', pages);
    expect(matched).toHaveLength(1);
    expect(matched[0].score).toBeGreaterThan(0);
  });

  it('has no absolute scale — the same page does not score 3', () => {
    // The legacy contract says a title hit is 3. BM25F scores come from the IDF
    // table and the length normalisation, so the number is whatever the corpus
    // makes it. This is the assertion that stops the two contracts blurring.
    const pages: PageRef[] = [{ path: 'a/x', title: 'DeepSeek', aliases: [] }];
    const [m] = lexMatchBm25('DeepSeek', pages);
    expect(m.score).not.toBe(3);
  });

  it('a title hit outranks a summary-only hit — relative order survives', () => {
    const pages: PageRef[] = [
      { path: 'a/sum', title: 'Other', aliases: [], summary: 'DeepSeek appears here' },
      { path: 'a/name', title: 'DeepSeek', aliases: [], summary: 'nothing relevant' },
    ];
    const matched = lexMatchBm25('DeepSeek', pages);
    expect(matched.map(x => x.page.path)).toEqual(['a/name', 'a/sum']);
  });

  it('rejects a non-match entirely rather than scoring it low', () => {
    const pages: PageRef[] = [
      { path: 'a/x', title: 'DeepSeek', aliases: [] },
      { path: 'a/y', title: 'Unrelated', aliases: [] },
    ];
    expect(lexMatchBm25('DeepSeek', pages).map(x => x.page.path)).toEqual(['a/x']);
  });

  it('accepts a prebuilt corpus so the caller pays for it once', () => {
    const pages: PageRef[] = [{ path: 'a/x', title: 'DeepSeek', aliases: [] }];
    const withCorpus = lexMatchBm25('DeepSeek', pages, {
      corpus: buildCorpusTerms([buildPageTerms({ title: 'DeepSeek', aliases: [], summary: '', text: '' })]),
    });
    expect(withCorpus).toHaveLength(1);
    expect(withCorpus[0].score).toBeGreaterThan(0);
  });
});
