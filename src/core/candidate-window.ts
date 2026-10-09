// core/candidate-window.ts — the one ranked window every prompt draws from
// when it shows the model a list of "existing pages".
//
// Until now each call site built that list on its own, and two of them bounded
// it blindly. The semantic dedup fell back to the FULL same-type list whenever
// the candidate's name shared no token with any title (61 % of entity trials
// on a 2,800-page vault), and Fix Dead Links took every page in vault
// iteration order and cut the rendered text at 3,000 characters. Measured at a
// local 26B model: the full list contained the target by construction and the
// model found it 0 of 18 times; a 30-entry window that contained the target,
// 9 of 9. So the question is not "cap or no cap" but WHICH RANKING puts the
// target into K slots without a model call.
//
// The answer measured over 1,585 hidden-alias trials (every curated alias of
// every page hidden in turn, the item described by the note it came from):
// ranking on the page's own prose, not only on title and aliases, moves the
// target into the window in 42 % of trials against 25 % for the shipped name
// gate; on ten hand-picked synonym cases 2 of 10 became 7 of 10.
//
// Score per page = lexical (title 3 / alias 2 per query token, the existing
// `localKeywordMatch`) + 1 per context keyword found in the page's prose.
// Keywords that occur in more than CANDIDATE_WINDOW_DF_CAP of the pool's pages
// are dropped before scoring: on any vault those are the function words of its
// language, so the cap replaces a language-specific stop list. Ties keep pool
// order, so a caller's ordering (ctime, for the KV-prefix cache) survives
// among equals. The window is always K pages, or the whole pool when it is
// smaller: pages without any signal fill the tail in pool order instead of
// triggering a list the model cannot use.
//
// What this does not reach: a target whose title, aliases and prose share
// nothing with the item — a page written in another script, an initialism
// whose expansion the page never spells out. The full list did not reach it
// either (0 of 18 above); it only looked as if it did.

import { localKeywordMatch } from './index-search';
import { CANDIDATE_WINDOW_TOP_K, CANDIDATE_WINDOW_DF_CAP } from '../constants';

/** Page shape the window ranks. `text` is the page's prose, lower-cased. */
export interface WindowPage {
  path: string;
  title: string;
  aliases?: string[];
  text?: string;
}

/** What the caller knows about the item it is looking for. */
export interface WindowQuery {
  /** The item's name (a candidate entity, a dead link's target). */
  name: string;
  /**
   * Text around the item — the extraction summary, the sentence that carries
   * the link. Only the first 300 characters are used, for both signals.
   */
  context: string;
}

const CONTEXT_CHARS = 300;
const MIN_KEYWORD_CHARS = 5;

/**
 * The context words worth looking for in a page's prose: lower-cased, split on
 * anything that is not a letter, digit or hyphen, at least MIN_KEYWORD_CHARS
 * long, each once. Short tokens are left to the lexical matcher, which scores
 * them against titles and aliases only.
 */
export function contextKeywords(context: string): string[] {
  const seen = new Set<string>();
  for (const token of context.substring(0, CONTEXT_CHARS).toLowerCase().split(/[^\p{L}\p{N}-]+/u)) {
    if (token.length >= MIN_KEYWORD_CHARS) seen.add(token);
  }
  return [...seen];
}

/**
 * Rank `pool` against `query` and return the top `topK` pages, pool order
 * among equals. The returned objects are the caller's own (not copies), so a
 * caller may hand in a richer page type and get it back. `options.dfCap`
 * overrides CANDIDATE_WINDOW_DF_CAP — a measurement knob, no call site sets it.
 */
export function selectCandidateWindow<T extends WindowPage>(
  query: WindowQuery,
  pool: T[],
  topK: number = CANDIDATE_WINDOW_TOP_K,
  options: { dfCap?: number } = {},
): T[] {
  if (pool.length === 0 || topK <= 0) return [];

  // Lexical signal — the matcher already shipped for this purpose. The name is
  // additionally matched with hyphens/underscores split so compound candidates
  // share tokens with reordered variants ("Diabetes-mellitus-Typ-2" ↔
  // "Typ-2-Diabetes").
  const nameQuery = `${query.name} ${query.name.split(/[-_]+/).join(' ')}`;
  const context = query.context.substring(0, CONTEXT_CHARS);
  const lexical = new Map(
    localKeywordMatch(
      `${nameQuery} ${context}`,
      pool.map(p => ({ path: p.path, title: p.title, aliases: p.aliases ?? [] })),
    ).map(r => [r.path, r.score]),
  );

  // Prose signal — one point per context keyword found in the page's text.
  // Document frequency is counted over this pool and this call; a keyword on
  // more than the cap's share of pages says nothing about any one of them.
  const textScore = new Array<number>(pool.length).fill(0);
  const withText = pool.filter(p => p.text !== undefined).length;
  if (withText > 0) {
    const maxPages = Math.floor(withText * (options.dfCap ?? CANDIDATE_WINDOW_DF_CAP));
    for (const keyword of contextKeywords(context)) {
      const hits: number[] = [];
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].text !== undefined && pool[i].text!.includes(keyword)) hits.push(i);
      }
      if (hits.length === 0 || hits.length > maxPages) continue;
      for (const i of hits) textScore[i] += 1;
    }
  }

  return pool
    .map((page, i) => ({ page, i, score: (lexical.get(page.path) ?? 0) + textScore[i] }))
    // Ties keep the CALLER'S pool order, and that is a contract, not an
    // accident: callers pass the pool ctime-ascending and the dedup prompt's
    // KV-prefix cache depends on that order holding across calls (see
    // `src/__tests__/wiki/page-factory/dedup-prompt-order.test.ts`). A change
    // to path-ascending here was tried and reverted on 2026-10-07 — it broke
    // three tests and a load-bearing property. The tie lottery #729 measured is
    // in the seed ranking (`retrieval-profile` / `scorePagesByNeedles`), not
    // here.
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, topK)
    .map(r => r.page);
}

/**
 * The stretch of `text` around the first occurrence of `needle` (or of the
 * first of several needles), `radius` characters to each side. Falls back to
 * the start of the text when nothing is found — the caller wanted a context
 * and gets the best one available.
 */
export function contextAround(text: string, needles: string[], radius: number): string {
  for (const needle of needles) {
    if (!needle) continue;
    const at = text.indexOf(needle);
    if (at === -1) continue;
    return text.substring(Math.max(0, at - radius), at + needle.length + radius);
  }
  return text.substring(0, radius * 2);
}
