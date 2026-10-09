// core/recall-fixtures.ts — #729 Phase 3: the fixture sets.
//
// Two layers, and the split is a fact about the world rather than a design
// preference. A real vault has no ground truth: nobody has labelled which of
// 2143 pages answer a given question. So recall@K and MRR can only come from a
// corpus whose truth is known by construction. What a real vault CAN tell you
// is structural — how many sources the candidate window held, how many loaded,
// how often the top score ties — and none of that needs a label.
//
// Pretending otherwise is how a harness starts reporting precision nobody can
// check. The synthetic layer answers "does the scorer rank correctly"; the real
// layer answers "does the pool and the selection carry what the issue says it
// should". Both are in the plan. Only one of them can report recall.

import type { Fixture, SourcedPage } from './recall-harness';
import { segment } from './term-index';

/** A page plus the query that is known to retrieve it. */
export interface SyntheticPair {
  readonly page: SourcedPage;
  readonly query: string;
  readonly relevantPaths: readonly string[];
  readonly regime: Fixture['regime'];
  readonly sourceLanguage: string;
  readonly queryLanguage: string;
}

/**
 * Build a synthetic corpus with known truth.
 *
 * Each entry is one target page plus the distractors it must beat. The target's
 * title carries the distinguishing term; the distractors carry shared
 * vocabulary so the ranking has something to get wrong. Ground truth is the
 * target's path, which is what makes recall computable at all.
 *
 * The regimes are the four the plan names plus cross-lingual. The module does
 * not branch on them — it only labels them — because the point of the corpus is
 * to exercise `segment()`'s Unicode-script split, not to encode a language
 * table. That table is what this whole line of work removed.
 */
export interface SyntheticEntry {
  readonly id: string;
  readonly regime: Fixture['regime'];
  readonly sourceLanguage: string;
  readonly queryLanguage: string;
  /** The query the target must answer. */
  readonly query: string;
  /** The page that answers it. */
  readonly target: SourcedPage;
  /** Pages that share vocabulary but do not answer it. */
  readonly distractors: readonly SourcedPage[];
}

export function buildSyntheticCorpus(entries: readonly SyntheticEntry[]): {
  pages: SourcedPage[];
  fixtures: Fixture[];
  queryTerms: Map<string, string[]>;
  /** Separates one arm from another so a harness can report both. */
  byId: Map<string, SyntheticEntry>;
} {
  const pages: SourcedPage[] = [];
  const fixtures: Fixture[] = [];
  const queryTerms = new Map<string, string[]>();
  const byId = new Map<string, SyntheticEntry>();
  for (const entry of entries) {
    pages.push(entry.target, ...entry.distractors);
    fixtures.push({
      id: entry.id,
      query: entry.query,
      relevant: [entry.target.path],
      regime: entry.regime,
      sourceLanguage: entry.sourceLanguage,
      queryLanguage: entry.queryLanguage,
    });
    // The harness segments the query the same way production does —
    // `scorePagesByNeedles` runs `needles.flatMap(n => segment(n))`. Splitting
    // on whitespace here would hand the scorer whole clauses and a Chinese
    // query would retrieve nothing, because the index stores character bigrams
    // and `强化学习` is never a term. Measured before this was fixed: the
    // Chinese fixture returned zero pages and MRR over the set was 0.583.
    queryTerms.set(entry.id, segment(entry.query));
    byId.set(entry.id, entry);
  }
  return { pages, fixtures, queryTerms, byId };
}

function distractor(
  path: string,
  title: string,
  summary: string,
  sourceSlug: string,
  aliases: string[] = [],
): SourcedPage {
  return { path, title, aliases, summary, sourceSlug };
}

/**
 * The built-in fixture set. Five regimes, one target each, distractors that
 * share vocabulary with the target so a scorer that ignores IDF or field
 * weights will rank them wrongly.
 *
 * Kept small and hand-written on purpose. A generated fixture set that shares
 * its generator with the scorer proves the generator correct, not the scorer.
 */
export const SYNTHETIC_ENTRIES: readonly SyntheticEntry[] = [
  {
    id: 'latin-en-title',
    regime: 'latin',
    sourceLanguage: 'en',
    queryLanguage: 'en',
    query: 'annealed importance sampling',
    target: {
      path: 'synthetic/annealed', title: 'Annealed Importance Sampling',
      aliases: ['AIS'], summary: 'A method for estimating a normalizing constant.',
      sourceSlug: 'paper-ais',
    },
    distractors: [
      distractor('synthetic/import-model', 'Importance Weighted Autoencoders',
        'Sampling and importance weights in generative models.', 'paper-iwae'),
      distractor('synthetic/normalizing', 'Normalizing Constant Estimation',
        'Estimating the normalizing constant of an unnormalized distribution.', 'paper-nc'),
      distractor('synthetic/anneal-schedule', 'Annealing Schedules',
        'Annealing schedules for optimization, not for sampling.', 'paper-sched'),
    ],
  },
  {
    id: 'latin-de-compound',
    regime: 'latin',
    sourceLanguage: 'de',
    queryLanguage: 'de',
    query: 'wahrscheinlichkeitsverteilung',
    target: {
      path: 'synthetic/wahrscheinlichkeit', title: 'Wahrscheinlichkeitsverteilung',
      aliases: [], summary: 'Verteilung über Ereignisse in einem Wahrscheinlichkeitsraum.',
      sourceSlug: 'paper-de',
    },
    distractors: [
      distractor('synthetic/wahrscheinlichkeit-erklaerung', 'Wahrscheinlichkeitstheorie',
        'Grundbegriffe der Wahrscheinlichkeit. Sie beschreibt nicht die Wahrscheinlichkeitsverteilung.', 'paper-de2'),
      distractor('synthetic/verteilung-funktion', 'Verteilungsfunktion',
        'Die kumulative Verteilungsfunktion, nicht die Wahrscheinlichkeitsverteilung selbst.', 'paper-de3'),
    ],
  },
  {
    id: 'han-zh-bigrams',
    regime: 'han',
    sourceLanguage: 'zh',
    queryLanguage: 'zh',
    query: '强化学习 推理能力',
    target: {
      path: 'synthetic/rl-reasoning', title: '强化学习与推理能力',
      aliases: [], summary: '强化学习如何提升模型的推理能力。',
      sourceSlug: 'paper-zh',
    },
    distractors: [
      distractor('synthetic/rl-baseline', '强化学习基线方法',
        '强化学习的基线算法比较。', 'paper-zh2'),
      distractor('synthetic/reasoning-survey', '推理能力综述',
        '大模型推理能力的评测方法。', 'paper-zh3'),
      distractor('synthetic/rl-training', '强化学习训练流程',
        '强化学习的训练流程与超参数。', 'paper-zh4'),
    ],
  },
  {
    id: 'kana-ja',
    regime: 'kana',
    sourceLanguage: 'ja',
    queryLanguage: 'ja',
    query: 'がくしゅう ほうほう',
    target: {
      path: 'synthetic/gakushuu', title: 'がくしゅうほうほう',
      aliases: [], summary: 'がくしゅうのほうほうについて。',
      sourceSlug: 'paper-ja',
    },
    distractors: [
      distractor('synthetic/gakushuu-hyouka', 'がくしゅうひょうか',
        'がくしゅうのひょうかほうほう。', 'paper-ja2'),
    ],
  },
  {
    id: 'hangul-ko',
    regime: 'hangul',
    sourceLanguage: 'ko',
    queryLanguage: 'ko',
    query: '심층학습 모델',
    target: {
      path: 'synthetic/simcheung', title: '심층학습 모델',
      aliases: [], summary: '심층학습 모델의 구조.',
      sourceSlug: 'paper-ko',
    },
    distractors: [
      distractor('synthetic/simcheung-hunlyeong', '심층학습 훈련',
        '심층학습 훈련 방법.', 'paper-ko2'),
    ],
  },
  {
    id: 'cross-lingual-en-to-zh',
    regime: 'cross-lingual',
    sourceLanguage: 'en',
    queryLanguage: 'zh',
    // The maintainer's own configuration: English sources, Chinese wiki. The
    // Latin term survives into the Chinese page and must be findable from a
    // Chinese query, which is what `segment()`'s script-boundary split buys.
    query: 'LSTM 架构',
    target: {
      path: 'synthetic/lstm-zh', title: 'LSTM 模型架构',
      aliases: [], summary: 'LSTM 模型的架构与训练方法。',
      sourceSlug: 'paper-en-zh',
    },
    distractors: [
      distractor('synthetic/transformer-zh', 'Transformer 模型架构',
        'Transformer 的架构与注意力机制。', 'paper-en-zh2'),
      distractor('synthetic/lstm-zh-history', '循环神经网络历史',
        '循环神经网络的发展历史。', 'paper-en-zh3'),
    ],
  },
];

/** Convenience: the whole built-in set, ready for `runHarness`. */
export function builtInFixtures(): {
  pages: SourcedPage[];
  fixtures: Fixture[];
  queryTerms: Map<string, string[]>;
} {
  const { pages, fixtures, queryTerms } = buildSyntheticCorpus(SYNTHETIC_ENTRIES);
  return { pages, fixtures, queryTerms };
}
