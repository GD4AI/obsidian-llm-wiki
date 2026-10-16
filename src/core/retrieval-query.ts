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
import { segment, type WeightedTerm } from './term-index';
import { tokenizeQuery } from './ppr-cascade';

/**
 * The terms the retrieval scores, cut the way the scorer reads them.
 *
 * `tokenizeQuery` keeps a CJK run of three or more characters as ONE token,
 * because that is right for substring matching against a title. It is wrong for
 * a scorer that looks terms up in a `PageTerms` table: the table is built by
 * `segment`, so its keys are bigrams, and an uncut run misses every page.
 *
 * Measured 2026-10-16 on a four-page fixture. `twoStageExpand` handed a single
 * Chinese token added ONE word to the query — the query echoed back — against
 * 23 to 28 added when the same query arrives segmented. The expansion was a
 * no-op on any Chinese vault, and test8 and test10 are Chinese vaults.
 *
 * `scorePagesByNeedles` has had this step since #729
 * (`needles.flatMap(n => segment(n))`). This is the same composition, named, so
 * the two cannot drift.
 */
export function retrievalQueryTerms(query: string): string[] {
  return tokenizeQuery(query).flatMap(t => segment(t));
}

/**
 * Which string feeds which stage. Exported because the values are load-bearing
 * and a reviewer should be able to assert on them rather than trust a comment.
 *
 * @DocTpoint's second review (#855, 2026-10-16) found two of the three wired to
 * the wrong string. Point 2 was the LLM; point 3 was the escalation gate.
 */
export const RETRIEVAL_QUERY_POLICY = {
  /** The LLM stages. What the user wrote, this turn, and nothing else. */
  llm: 'current-question',
  /** The escalation gate. History + question, un-expanded. */
  gate: 'retrieval-query-unexpanded',
  /** The lexical scorer and the PPR seed derivation. */
  retrieval: 'retrieval-query',
} as const;

export interface RetrievalInputs {
  /** History + question, joined. The lexical scorer and PPR read this. */
  retrievalQuery: string;
  /**
   * Segmented and WEIGHTED, for the expansion's scorers.
   *
   * The current question's words weigh 1 and the history's weigh
   * `historyWeight`. Concatenating the history at full weight lets four
   * unrelated turns outvote the question the user asked: measured on the
   * topic-switch case, self-retrieval MRR falls from 1.000 to 0.38-0.44. At
   * 0.3 the topic-switch case holds at 0.93-0.99 and a follow-up stays at
   * 1.000. #855 fix 3 — the function existed with six tests and no caller.
   */
  expansionTerms: WeightedTerm[];
  /** The words the LLM stages see. */
  llmQuery: string;
  /** The words the escalation gate reads. */
  gateQuery: string;
}

/**
 * Build the three query strings at once, so the policies that separate them
 * live in one place instead of three call sites.
 *
 * Why three and not one. Each stage answers a different question:
 *
 *   - The LLM is asked "what is the user asking for?". The honest answer is the
 *     sentence they typed. Handing it a transcript makes it extract keywords
 *     from someone else's words, which is what point 2 was.
 *   - The gate asks "did the user's own words already name a page?". That is a
 *     question about the query as written. The expansion adds words harvested
 *     from page bodies; the gate measures the NAME tier's share of the query's
 *     IDF, so body-words can only lower it, and a query that matched a title
 *     cleanly starts escalating to a paid stage. That is what point 3 was.
 *   - The scorer and the walk want every word that can reach the answer,
 *     including the expansion's.
 *
 * Why the gate keeps the history. A follow-up ("那 MoE 呢？") carries no content
 * words, so gating on the question alone escalates every follow-up to the LLM.
 * The gate therefore reads `retrievalQuery`, which is exactly what it read before
 * the expansion existed — the input it was calibrated against.
 */
export function prepareRetrievalInputs(
  current: string,
  history: ReadonlyArray<{ role: string; content: string }>,
  maxRounds: number,
): RetrievalInputs {
  const retrievalQuery = buildRetrievalQuery(current, history, maxRounds);
  return {
    retrievalQuery,
    // Weighted, not just segmented: `buildWeightedRetrievalQuery` segments on
    // the way `segment` does, which is what the scorer's tables are keyed by.
    expansionTerms: buildWeightedRetrievalQuery(current, history, maxRounds),
    llmQuery: current,
    gateQuery: retrievalQuery,
  };
}

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
