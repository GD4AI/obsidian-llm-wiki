// Two-stage Rocchio query expansion — Issue #729 read-side.
//
// The strict layer is pairs that share under a third of their terms and come
// from different sources. Measured on both vaults 2026-10-15, the vocabulary
// gap is where that layer fails: the query words and the answer page's words
// are disjoint by construction, so no amount of scoring on the query as written
// can find the page.
//
// Relevance feedback (Rocchio, 1971) closes part of the gap from inside the
// corpus. Take the neighbourhood the current ranking already found, read its
// distinctive words, and put them in the query. The words come from the user's
// own notes, so nothing external enters the answer.
//
// ONE shot is worth +0.019 r@10 on average and is NEGATIVE on test8's strict
// layer (−0.040): the first neighbourhood is still on the topic's rim, and its
// words are noise where the vocabulary is disjoint. TWO stages are worth
// +0.048 and positive in all four cells. The re-rank between them pulls the
// query onto the topic, and the second neighbourhood is the topic's interior —
// those are the words that bridge.
//
// Measured (r@10, against `lex+PPR`, cross-source strict layer):
//
//   vault   baseline   one-shot   two-stage
//   test8     0.760      0.720      0.800
//   test10    0.641      0.667      0.692
//
// And with the asker removed from the seeds, so link-following cannot carry the
// number: 0.400 -> 0.440 and 0.385 -> 0.436. The gain survives the artifact.

import { describe, it, expect } from 'vitest';
import { segment, buildPageTerms, buildCorpusTerms, bm25fScore, DEFAULT_FIELD_WEIGHTS } from '../../core/term-index';
import { twoStageExpand, type ExpansionPage } from '../../core/query-expansion';

function page(title: string, text: string): ExpansionPage {
  return { key: title.toLowerCase().replace(/\s+/g, '-'), title, summary: '', text };
}

// A small corpus where two vocabularies describe the same thing. The asker
// says "retention"; the target page says "consolidation". They share no words,
// and a third page uses both — exactly the bridge a generated wiki has.
const pages: ExpansionPage[] = [
  page('Memory retention', 'memory retention recall decay curve forgetting'),
  page('Consolidation kernel', 'consolidation kernel synaptic replay systems'),
  page('Retention model', 'retention model consolidation kernel replay'),
  page('Unrelated page', 'cooking pasta water boil salt'),
];

const pts = pages.map(p => buildPageTerms({ title: p.title, aliases: [], summary: p.summary, text: p.text }));
const corpus = buildCorpusTerms(pts);

function rank(terms: string[]): Array<{ j: number; score: number }> {
  return pts
    .map((pt, j) => ({ j, score: bm25fScore(terms, pt, corpus, DEFAULT_FIELD_WEIGHTS) }))
    .sort((a, b) => (b.score - a.score) || (a.j < b.j ? -1 : 1));
}

describe('twoStageExpand', () => {
  it('adds words the neighbourhood uses that the query does not', () => {
    const q = ['memory', 'retention'];
    const out = twoStageExpand(q, pages, corpus, { k1: 5, m1: 10, k2: 5, m2: 10 });
    // The top hit is "Memory retention" and "Retention model"; between them
    // they carry "consolidation" and "replay", which the query never said.
    expect(out.some(t => t === 'consolidation' || t === 'replay')).toBe(true);
  });

  it('keeps the original query words intact and in front', () => {
    const q = ['memory', 'retention'];
    const out = twoStageExpand(q, pages, corpus, { k1: 5, m1: 10, k2: 5, m2: 10 });
    expect(out.slice(0, q.length)).toEqual(q);
  });

  it('returns the query unchanged when there is no neighbourhood to read', () => {
    const q = ['zzzz', 'qqqqq'];
    const out = twoStageExpand(q, pages, corpus, { k1: 5, m1: 10, k2: 5, m2: 10 });
    expect(out).toEqual(q);
  });

  it('reaches further than one stage on a vocabulary gap', () => {
    // The query names the asker's side of the gap. One stage reads the rim;
    // two stages read the interior and pull in the target's own word.
    const q = ['memory', 'retention'];
    const one = twoStageExpand(q, pages, corpus, { k1: 5, m1: 10, k2: 0, m2: 0 });
    const two = twoStageExpand(q, pages, corpus, { k1: 5, m1: 10, k2: 5, m2: 10 });
    expect(two.length).toBeGreaterThan(one.length);
  });

  it('lifts the target page from unranked to scored', () => {
    const q = ['memory', 'retention'];
    const target = 1; // Consolidation kernel — disjoint vocabulary.
    const before = rank(q);
    const after = rank(twoStageExpand(q, pages, corpus, { k1: 5, m1: 10, k2: 5, m2: 10 }));
    // The target shares NO word with the query, so before expansion its score
    // is zero and it is indistinguishable from an unrelated page. Expansion
    // gives it a real score. That is the vocabulary gap closing, and it is a
    // sharper assertion than rank order — on a corpus this size two pages can
    // swap places for reasons that have nothing to do with the gap.
    const beforeScore = before.find(e => e.j === target)?.score ?? 0;
    const afterScore = after.find(e => e.j === target)?.score ?? 0;
    expect(beforeScore).toBe(0);
    expect(afterScore).toBeGreaterThan(0);
  });
});
