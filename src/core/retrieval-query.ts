// retrieval-query.ts — put the conversation into the retrieval query.
//
// A follow-up question carries no content words. "为什么？" or "再深入解释"
// retrieves nothing on its own, and the answer generator then receives the
// right context with the wrong pages: `maxConversationHistory` already wires
// the conversation into the LLM, and the retrieval never saw it.
//
// Measured 2026-10-15 on both vaults, 1,000 follow-up cases built from the
// layered-eval questions. Scoring the follow-up alone lands at 0.015-0.047
// r@10; scoring it with the recent turns lands at 0.49-0.67. Sixteen to
// thirty-three times, for the cost of a string.
//
// The follow-up itself contributes nothing — "history only" scores the same as
// "history + follow-up" on every cell measured. It is kept because a follow-up
// that DOES carry content ("那 MoE 呢？") must reach the scorer.

/**
 * Build the string the retrieval scores, with the conversation in it.
 *
 * Only USER turns go in. The assistant's answers are fluent prose that would
 * swamp the query's own words; the questions are what the user was actually
 * looking for, and they are short.
 *
 * `maxRounds` is the same number the answer generator uses for its context
 * window, so retrieval and answer see one conversation. Providers with prefix
 * caching keep that window stable across turns.
 *
 * The current question goes LAST. A scorer that weights the head of the string
 * reads the conversation first and the ask now second, which is the order the
 * user thinks in.
 */
import { segment } from './term-index';

export function buildRetrievalQuery(
  current: string,
  history: ReadonlyArray<{ role: string; content: string }>,
  maxRounds: number,
): string {
  if (maxRounds <= 0 || history.length === 0) return current;
  const turns: string[] = [];
  for (const m of history) {
    if (m.role !== 'user') continue;
    const t = (m.content ?? '').trim();
    if (t) turns.push(t);
  }
  const recent = turns.slice(-Math.max(0, maxRounds));
  return [...recent, current].join(' ');
}

/**
 * The weighted form. The current question's words weigh 1 and the history's
 * weigh `historyWeight`.
 *
 * Why not just concatenate. Measured on the topic-switch case — the current
 * question plus four UNRELATED history turns — concatenation drops
 * self-retrieval MRR from 1.000 to 0.38-0.44, because four turns of history
 * outvote the question the user actually asked. Weighting the history at 0.3
 * holds the topic-switch case at 0.93-0.99 while the follow-up case stays at
 * 1.000: the history still carries a follow-up's missing words, it just stops
 * outvoting the present.
 *
 * The segmentation happens here rather than in the scorer so the two parts
 * stay distinguishable. The scorer sees one weighted list and does not know
 * which words came from where.
 */
export function buildWeightedRetrievalQuery(
  current: string,
  history: ReadonlyArray<{ role: string; content: string }>,
  maxRounds: number,
  historyWeight = 0.3,
): Array<{ term: string; weight: number }> {
  const currentTerms = segment(current).map(term => ({ term, weight: 1 }));
  if (maxRounds <= 0 || history.length === 0) return currentTerms;
  const turns: string[] = [];
  for (const m of history) {
    if (m.role !== 'user') continue;
    const t = (m.content ?? '').trim();
    if (t) turns.push(t);
  }
  const recent = turns.slice(-Math.max(0, maxRounds));
  const historyTerms = segment(recent.join(' ')).map(term => ({ term, weight: historyWeight }));
  return [...currentTerms, ...historyTerms];
}
