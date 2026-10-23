// retrieval-plan.ts — the one composition that turns a user message into the
// query the retrieval scores.
//
// WHY THIS FILE EXISTS
//
// Six times in one cycle a measurement described code the product does not run.
// `summary` was mapped two ways. The conversation-history evaluation built a
// different question. #843's cost model counted the scorer and not the build.
// The expansion A/B fed the expansion segmented terms while production fed it
// an uncut Chinese run, so the expansion returned its input verbatim and every
// number on it was void. A lexical A/B passed a third argument to a
// two-parameter function and compared two identical call paths. A fusion A/B
// compared against a score the tool invented.
//
// Five of those six were the same defect: the TOOL reimplemented a composition
// the PRODUCT owns, and nothing detected the drift. A test that calls the
// pieces cannot see it, because the pieces are fine — the wiring between them
// is what differs.
//
// The fix is structural. The composition lives here once. `QueryView` calls it.
// Every tool calls it. There is no second copy to drift, so the failure mode has
// nothing left to attach to.
//
// What this deliberately does NOT own: the gate's threshold, the fusion, the
// assembly budget, the seeds. Those belong to `selectPprSeeds`, and a tool that
// wants to measure one of them passes `expandedQuery: false` and gets the
// un-expanded query through the same pipeline rather than a private copy.

import { prepareRetrievalInputs, retrievalQueryTerms } from '../../../core/retrieval-query';
import {
  twoStageExpand,
  ExpansionTermsCache,
  DEFAULT_EXPANSION,
  type ExpansionOptions,
} from '../../../core/query-expansion';
import type { PageRef } from '../../../core/ppr-cascade';

/** The slice of a page the expansion's page model scores. */
export interface ExpansionPageView {
  key: string;
  title: string;
  /**
   * The first 200 characters of the BODY, not the first alias.
   *
   * This exact mapping was the disagreement once: the tool measured with
   * `body.slice(0, 200)` while production used `r.aliases[0] ?? ''`, which is
   * empty on most pages. Same function, two inputs, opposite conclusions. It is
   * a named function now so it has one definition.
   */
  summary: string;
  text: string;
}

/** How the pages look to the expansion's scorer. Pure, so it is testable. */
export function toExpansionPages(refs: readonly PageRef[]): ExpansionPageView[] {
  return refs.map(r => ({
    key: r.path,
    title: r.title,
    summary: (r.text ?? '').slice(0, 200),
    text: r.text ?? '',
  }));
}

export interface RetrievalPlanInput {
  /** What the user typed this turn. */
  current: string;
  history: ReadonlyArray<{ role: string; content: string }>;
  historyRounds: number;
  /** Page refs WITH bodies — `withBodies` output, the same array `selectPprSeeds` gets. */
  retrievalRefs: readonly PageRef[];
  /** The wiki index file's content. Part of the expansion cache's key. */
  indexContent: string;
  expansionCache: ExpansionTermsCache;
  /**
   * Skip the Rocchio expansion. A tool measuring the expansion itself sets this
   * and gets the un-expanded query through the SAME pipeline, so the baseline
   * arm is the product minus one step rather than a parallel implementation.
   */
  expand?: boolean;
  opts?: ExpansionOptions;
  /**
   * The weight the history's words carry against the question's. Defaults to
   * the production value (0.3). It is an argument rather than a constant
   * because the weight is a measurement question — 0.3 was chosen from a
   * corpus measurement, and a corpus measurement cannot say whether 0.3 is
   * the right value for a given vault. A weight that cannot be varied cannot
   * be checked.
   */
  historyWeight?: number;
}

export interface RetrievalPlan {
  /** History + question. What the scorer and the walk read before expansion. */
  retrievalQuery: string;
  /** History + question + the expansion's words. What `selectPprSeeds` scores. */
  expandedQuery: string;
  /** The question as typed. What the LLM stages read. */
  llmQuery: string;
  /** History + question, un-expanded. What the escalation gate reads. */
  gateQuery: string;
  /** Segmented terms of `expandedQuery` — what the matched-paragraph matcher uses. */
  matchTerms: string[];
  /** How many words the expansion added. Zero means it is a no-op on this query. */
  addedTerms: number;
}

export function planRetrieval(input: RetrievalPlanInput): RetrievalPlan {
  const { retrievalQuery, expansionTerms, llmQuery, gateQuery } = prepareRetrievalInputs(
    input.current,
    input.history,
    input.historyRounds,
    input.historyWeight,
  );

  if (input.expand === false) {
    const matchTerms = retrievalQueryTerms(retrievalQuery);
    return {
      retrievalQuery,
      expandedQuery: retrievalQuery,
      llmQuery,
      gateQuery,
      matchTerms,
      addedTerms: 0,
    };
  }

  const pages = toExpansionPages(input.retrievalRefs);
  const { terms, corpus, index } = input.expansionCache.get(input.indexContent, pages);
  const expanded = twoStageExpand(
    // Segmented and weighted. `tokenizeQuery` keeps a Chinese run as one token
    // and `bm25fScore` looks terms up in a table built by `segment`, so an
    // uncut run matches nothing — the expansion returned its input verbatim on
    // exactly the Chinese vaults it was measured on.
    expansionTerms,
    pages,
    corpus,
    input.opts ?? DEFAULT_EXPANSION,
    terms,
    index,
  );
  const expandedQuery = expanded.join(' ');

  return {
    retrievalQuery,
    expandedQuery,
    llmQuery,
    gateQuery,
    matchTerms: retrievalQueryTerms(expandedQuery),
    addedTerms: expanded.length - expansionTerms.length,
  };
}
