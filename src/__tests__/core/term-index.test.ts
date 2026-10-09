/**
 * #729 Phase 2 — the representation and ranking layer.
 *
 * Replaces `retrieval-profile.ts`'s hand-tuned linear weights with BM25F.
 * The tests below pin the properties the hand-tuned scorer did **not** have,
 * and the ones it must not regress on.
 *
 * Segmentation is by Unicode script property, not by language. That is the
 * corpus-statistics principle from the plan: no `if (lang === …)` anywhere, and
 * the four regimes the fixtures cover (English/German, Chinese,
 * Japanese/Korean, Russian) all work through the same code path.
 */

import { describe, it, expect } from 'vitest';
import {
  segment,
  buildPageTerms,
  buildCorpusTerms,
  bm25fScore,
  DEFAULT_FIELD_WEIGHTS,
} from '../../core/term-index';

describe('segment — bounded-word scripts split on word characters', () => {
  it('splits English and lowercases', () => {
    expect(segment('Annealed Importance Sampling')).toEqual([
      'annealed', 'importance', 'sampling',
    ]);
  });

  it('splits Russian the same way — spaces, not language', () => {
    expect(segment('Глубокое обучение модели')).toEqual([
      'глубокое', 'обучение', 'модели',
    ]);
  });

  it('keeps German compounds as one term', () => {
    expect(segment('Wahrscheinlichkeitsverteilung')).toEqual(['wahrscheinlichkeitsverteilung']);
  });
});

describe('segment — boundary-less scripts contribute bigrams', () => {
  it('splits Chinese into character bigrams', () => {
    expect(segment('深度学习')).toEqual(['深度', '度学', '学习']);
  });

  it('a single boundary-less character stands alone — a bigram needs two', () => {
    expect(segment('的')).toEqual(['的']);
  });

  it('Japanese kana runs become bigrams too', () => {
    expect(segment('がくしゅう')).toEqual(['がく', 'くし', 'しゅ', 'ゅう']);
  });

  it('Korean Hangul runs become bigrams', () => {
    expect(segment('심층학습')).toEqual(['심층', '층학', '학습']);
  });

  it('splits a mixed run at the script change', () => {
    // `LSTM模型` must not produce `stm模`. The boundary is the script, and
    // that is what lets an English keyword find a Chinese page.
    expect(segment('LSTM模型')).toEqual(['lstm', '模型']);
  });

  it('drops punctuation and separators', () => {
    expect(segment('a, b; c — d')).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('buildPageTerms / buildCorpusTerms', () => {
  const mk = (title: string, summary: string, text: string, aliases: string[] = []) =>
    buildPageTerms({ title, aliases, summary, text });

  it('counts term frequency per field and reports field length', () => {
    const p = mk('Deep Learning', 'Deep learning uses neural nets.', 'learning learning learning');
    expect(p.fields.title.tf.get('deep')).toBe(1);
    expect(p.fields.summary.tf.get('learning')).toBe(1);
    expect(p.fields.text.tf.get('learning')).toBe(3);
    expect(p.fields.text.length).toBe(3);
  });

  it('builds the document-frequency table across pages', () => {
    const corpus = buildCorpusTerms([
      mk('Deep learning', 'neural nets', 'x'),
      mk('Reinforcement learning', 'reward models', 'y'),
      mk('Amino acids', 'proteins', 'z'),
    ]);
    expect(corpus.docCount).toBe(3);
    expect(corpus.docFreq.get('learning')).toBe(2);
    expect(corpus.docFreq.get('amino')).toBe(1);
    expect(corpus.docFreq.get('missing')).toBeUndefined();
  });

  it('averages field lengths for normalisation', () => {
    const corpus = buildCorpusTerms([
      mk('one two', 'a b c d', ''),
      mk('three', 'e', ''),
    ]);
    expect(corpus.avgFieldLength.title).toBeCloseTo(1.5);
    expect(corpus.avgFieldLength.summary).toBeCloseTo(2.5);
  });
});

describe('bm25fScore — the properties the hand-tuned scorer lacked', () => {
  const mk = (title: string, summary: string, text: string, aliases: string[] = []) =>
    buildPageTerms({ title, aliases, summary, text });

  it('a stop word shared by every page carries little weight', () => {
    // This is the anomaly the linear scorer could not express: `the` scored
    // like any other word because there was no IDF.
    const pages = [
      mk('The model', 'the the the', 'the model runs'),
      mk('The system', 'the the', 'the system runs'),
      mk('The method', 'the the the the', 'the method runs'),
      mk('The approach', 'the', 'the approach runs'),
    ];
    const corpus = buildCorpusTerms(pages);
    const stopWord = bm25fScore(['the'], pages[0], corpus);
    const rareWord = bm25fScore(['model'], pages[0], corpus);
    expect(rareWord).toBeGreaterThan(stopWord);
  });

  it('length normalisation keeps a long document from winning on volume alone', () => {
    const short = mk('Graph', 'graph', 'graph');
    const long = mk('Graph', 'graph', Array(40).fill('graph').join(' '));
    const corpus = buildCorpusTerms([short, long]);
    const s = bm25fScore(['graph'], short, corpus);
    const l = bm25fScore(['graph'], long, corpus);
    // The long page may not lose, but it must not win by 40x.
    expect(l).toBeLessThan(s * 3);
    expect(l).toBeGreaterThan(0);
  });

  it('a title match outranks a body match at equal length', () => {
    const inTitle = mk('AMPK', 'unrelated words here', 'different text entirely');
    const inBody = mk('Something else', 'unrelated words here', 'AMPK appears in the body');
    const corpus = buildCorpusTerms([inTitle, inBody]);
    expect(bm25fScore(['ampk'], inTitle, corpus))
      .toBeGreaterThan(bm25fScore(['ampk'], inBody, corpus));
  });

  it('repeating a term helps, with diminishing returns', () => {
    const one = mk('X', 'alpha', 'alpha');
    const three = mk('X', 'alpha', 'alpha alpha alpha');
    const corpus = buildCorpusTerms([one, three]);
    const a = bm25fScore(['alpha'], one, corpus);
    const b = bm25fScore(['alpha'], three, corpus);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(a * 3);
  });

  it('a term absent from the page contributes nothing', () => {
    const p = mk('Deep learning', 'neural nets', 'gradient descent');
    const corpus = buildCorpusTerms([p]);
    expect(bm25fScore(['transformer'], p, corpus)).toBe(0);
  });

  it('a query term in no document contributes nothing', () => {
    const p = mk('Deep learning', 'neural nets', 'x');
    const corpus = buildCorpusTerms([p]);
    expect(bm25fScore(['zzznotpresent'], p, corpus)).toBe(0);
  });

  it('is deterministic — the same input always gives the same score', () => {
    const p = mk('Deep learning', 'neural nets', 'gradient descent');
    const corpus = buildCorpusTerms([p]);
    const a = bm25fScore(['deep', 'learning'], p, corpus);
    const b = bm25fScore(['deep', 'learning'], p, corpus);
    expect(a).toBe(b);
  });

  it('is symmetric in query order', () => {
    const p = mk('Deep learning', 'neural nets', 'gradient descent');
    const corpus = buildCorpusTerms([p]);
    expect(bm25fScore(['deep', 'learning'], p, corpus))
      .toBe(bm25fScore(['learning', 'deep'], p, corpus));
  });

  it('a repeated query term is counted once — the query is a set of terms', () => {
    const p = mk('Deep learning', 'neural nets', 'x');
    const corpus = buildCorpusTerms([p]);
    expect(bm25fScore(['deep', 'deep'], p, corpus)).toBe(bm25fScore(['deep'], p, corpus));
  });
});

describe('cross-lingual — the fixture the plan requires', () => {
  const mk = (title: string, summary: string, text: string, aliases: string[] = []) =>
    buildPageTerms({ title, aliases, summary, text });

  it('an English keyword finds a Chinese page that carries the Latin term', () => {
    // The real configuration this project runs: English sources, Chinese wiki.
    const page = mk('LSTM模型', 'LSTM 模型的训练方法', '我们提出 LSTM 模型架构');
    const corpus = buildCorpusTerms([page]);
    expect(bm25fScore(['lstm'], page, corpus)).toBeGreaterThan(0);
  });

  it('a Chinese query finds a Chinese page — segmentation, not whole clauses', () => {
    const page = mk('深度学习', '深度学习的训练方法', '深度学习模型');
    const corpus = buildCorpusTerms([page]);
    const wholeClause = bm25fScore(['深度学习的训练方法'], page, corpus);
    const segmented = bm25fScore(segment('深度学习'), page, corpus);
    // Segmenting the query is what makes Chinese retrieval work at all.
    expect(segmented).toBeGreaterThan(wholeClause);
    expect(segmented).toBeGreaterThan(0);
  });
});

describe('the rejected options stay rejected', () => {
  const mk = (title: string, summary: string, text: string, aliases: string[] = []) =>
    buildPageTerms({ title, aliases, summary, text });

  it('a single-keyword query is not starved — no "≥ 2 needles" floor exists', () => {
    // Rejected: a two-needle floor starves `AMPK`. BM25F has no such rule.
    const page = mk('AMPK', 'AMPK 的作用', 'AMPK 信号通路');
    const corpus = buildCorpusTerms([page]);
    expect(bm25fScore(['ampk'], page, corpus)).toBeGreaterThan(0);
  });

  it('a mid-frequency term can still fill in — no absolute evidence threshold', () => {
    // Rejected: `sum(w) >= 1` is equivalent to `df <= 1`, which would exclude
    // `deepseek` at w=0.56 on the real vault. BM25F has no absolute floor.
    const pages = [
      mk('A', 'deepseek', 'deepseek'),
      mk('B', 'deepseek', 'deepseek'),
      mk('C', 'deepseek', 'deepseek'),
    ];
    const corpus = buildCorpusTerms(pages);
    expect(bm25fScore(['deepseek'], pages[0], corpus)).toBeGreaterThan(0);
  });

  it('the default field weights are the old ratio, so behaviour is comparable', () => {
    // The harness moves these. What must not happen is losing the ratio
    // silently on the way to BM25F.
    expect(DEFAULT_FIELD_WEIGHTS).toEqual({ title: 3, alias: 2, summary: 1, text: 1 });
    const inTitle = mk('AMPK', 'x', 'y');
    const inSummary = mk('Z', 'AMPK', 'y');
    const corpus = buildCorpusTerms([inTitle, inSummary]);
    expect(bm25fScore(['ampk'], inTitle, corpus))
      .toBeGreaterThan(bm25fScore(['ampk'], inSummary, corpus));
  });
});

describe('document frequency counts a document once, not once per field', () => {
  // Regression. Counting per field let one page push `df` past `docCount`,
  // which made `N - df + 0.5` negative and every score negative with it. The
  // bug read as "BM25F is broken"; it was the IDF table, not the ranker.
  it('a term in title AND text of one page has df 1, not 2', () => {
    const page = buildPageTerms({ title: 'alpha', aliases: [], summary: 'alpha', text: 'alpha' });
    const corpus = buildCorpusTerms([page]);
    expect(corpus.docCount).toBe(1);
    expect(corpus.docFreq.get('alpha')).toBe(1);
  });

  it('a term in every document keeps df at most docCount, so scores stay positive', () => {
    const pages = ['a', 'b', 'c'].map(x => buildPageTerms({
      title: x, aliases: [], summary: x, text: x,
    }));
    const corpus = buildCorpusTerms(pages);
    for (const [, df] of corpus.docFreq) {
      expect(df).toBeLessThanOrEqual(corpus.docCount);
    }
    expect(bm25fScore(['a'], pages[0], corpus)).toBeGreaterThan(0);
  });
});
