// The answer context's token budget (#880).
//
// `RETRIEVAL_BUDGET = 20` is a PAGE count. Each page carries its own character
// cap — `MAX_PAGE_CONTENT_CHARS` on the full-text path, a third of it on the
// summary path — and `assembleWikiContext` joins the bodies with no total. The
// product of the two is 256,000 characters, and nothing holds it down.
//
// Measured on the production vault through the production path, 27 of 30
// answers exceed an 8k window; LM Studio and Ollama default to 4k-8k.
//
// WHY AN ESTIMATOR AND NOT A TOKENIZER
//
// A tokenizer is a dependency this plugin cannot ship: `o200k` is ~2 MB of
// merged byte tables, and bundling it into `main.js` for a non-user-facing
// number is not a trade worth making. So this file converts characters to
// tokens with a per-script table.
//
// The table is deliberately biased. Under-estimating characters per token
// OVER-estimates tokens, which drops a page that would have fitted — a slightly
// shorter answer. Over-estimating characters per token UNDER-estimates tokens,
// which sends a context larger than the window — a provider error at request
// time. The first failure is recoverable and invisible; the second is neither.
//
// The two ratios were chosen from the ASSEMBLED CONTEXT of real vaults, not
// from UI strings — an earlier version used this repo's locale strings and was
// wrong in the dangerous direction. Measured with `o200k_base`:
//
//   assembled Chinese wiki context, 2,141-page vault  min 2.04  p50 2.19
//   assembled Chinese wiki context, 354-page vault    min 2.37  p50 2.64
//   English markdown prose (README, AGENTS, NOTICE)   min 3.54  p50 3.90
//
// The locale strings the first version measured said 2.70-4.47, which was
// optimistic: real pages carry wikilinks, paths and English terms, and those
// tokenize denser than prose. Using 2.5 as the CJK floor left 14 of 30 answers
// over the very budget that had just been applied — the estimate said the
// context was 7168 tokens when it was 8109.
//
// So the shipped floors sit below the observed minima in both scripts: 1.25
// against a CJK minimum of 2.04, and 2.6 against a non-CJK minimum of 3.54. The
// gap is wider than "just below the minimum" on purpose — the next block explains
// why the two-parameter fit (1.52 / 3.20) is not what ships.

/** Script classes the estimator distinguishes. */
export type ScriptClass = 'cjk' | 'other';
/**
 * Characters per token, CJK.
 *
 * Both constants come from a two-parameter least-squares fit over 60 assembled
 * contexts from two real vaults, with `o200k_base` counting the truth. The fit
 * alone gives 1.52 and 3.20, and at those values the estimate is OPTIMISTIC on
 * 17 % of cases (estimate/actual down to 0.826) — which is the direction that
 * overflows a window.
 *
 * So both are divided by about 1.22x, chosen to make the worst case break-even:
 * at 1.25 and 2.6 the ratio estimate/actual never drops below 1.010, so the
 * estimate never promises more room than there is. The cost is a shorter answer:
 * at these ratios the estimator admits about 82 % of the characters the fit
 * would admit. (1.25/1.52 = 0.82, 2.6/3.20 = 0.81.)
 */
export const CHARS_PER_TOKEN_CJK = 1.25;

/**
 * Characters per token, non-CJK. See `CHARS_PER_TOKEN_CJK` for where both
 * numbers come from.
 *
 * This is the weaker of the two: the vaults available for measurement are
 * Chinese, so Latin-script *vault* prose was not measured on its own — the
 * non-CJK characters it contains are wikilinks, paths, frontmatter keys and
 * some English terms, and that is the population the fit saw. A vault written
 * in English is the measurement that would confirm it.
 */
export const CHARS_PER_TOKEN_OTHER = 2.6;

/**
 * The default budget, in tokens.
 *
 * 8192 because it is the common floor a local runtime will serve, and because a
 * single default needs one sentence in eleven locales rather than a rule the
 * user has to understand. A user on a large cloud model can raise it; a user on
 * a 4k model can lower it. `0` disables the budget entirely.
 */
export const DEFAULT_CONTEXT_BUDGET_TOKENS = 8192;

/** One CJK code point: Han, kana, Hangul, and the punctuation shipped with them. */
function isCjk(cp: number): boolean {
  return (
    (cp >= 0x3000 && cp <= 0x303f) || // CJK punctuation
    (cp >= 0x3040 && cp <= 0x30ff) || // Hiragana, Katakana
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0xac00 && cp <= 0xd7af) || // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
    (cp >= 0xff00 && cp <= 0xffef) // Fullwidth forms
  );
}

/**
 * Estimated tokens for a stretch of text.
 *
 * Counts CJK code points at one ratio and everything else at the other, so a
 * context that mixes prose with vault paths is estimated part by part. There is
 * deliberately no script argument: the first version took one from the wiki
 * language and applied it to the whole string, which over-counted the page
 * summary hint — fifty lines of ASCII paths — by roughly a factor of two, and
 * wasted a third of the budget on the production vault.
 *
 * Conservative by construction: both ratios sit below their measured minima,
 * and under-estimating characters per token over-estimates tokens.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    if (isCjk(ch.codePointAt(0) ?? 0)) cjk += ch.length;
    else other += ch.length;
  }
  return Math.ceil(cjk / CHARS_PER_TOKEN_CJK + other / CHARS_PER_TOKEN_OTHER);
}

export interface FitResult {
  /** The bodies to send, in the order they arrived. */
  kept: string[];
  /**
   * Indexes of the kept bodies in the array that was passed in.
   *
   * Same length and same order as `kept`. The caller needs them to report
   * WHICH pages were sent: a retrieval label built from the pre-cut list names
   * pages the model never received (issue #880 review, DocTpoint 2026-10-27).
   * Deriving that from the bodies is not possible — a body carries no path.
   */
  keptIndexes: number[];
  keptCount: number;
  totalCount: number;
  dropped: number;
  /** Estimated tokens of `kept`. */
  estimatedTokens: number;
  /** False when the budget was `0` or non-positive, so nothing was judged. */
  budgetApplied: boolean;
  /**
   * True when the one-page floor had to override the budget: the first body
   * alone exceeds it. The caller may surface this, because the answer will
   * still overflow the model's window.
   */
  overBudgetSinglePage: boolean;
}

/**
 * Take as many bodies as the budget allows, from the head, in the given order.
 *
 * ORDER IS THE CONTRACT. The bodies arrive in rank order, and this function
 * never reorders them — the cut is from the tail. `assembleWithCoverage`
 * already decides *which* pages (diversity, `lambda`); this decides *how many*
 * are sent. A function that reordered here would silently replace the coverage
 * policy with a length policy.
 *
 * THE BUDGET IS THE WHOLE WIKI CONTEXT, NOT THE BODIES. The assembled string
 * is the bodies plus the page-summary hint plus the instruction block, so a
 * caller that spends the entire budget on bodies still exceeds it. The first
 * implementation did exactly that and left 20 of 30 answers over an 8192
 * window while reporting a budget of 8192 — the number was right and the thing
 * it counted was not.
 *
 * `reserveTokens` is the caller's measured cost of everything that is not a
 * page. The query view measures it by assembling once with an empty body list,
 * which keeps it correct when the prompt grows: a hard-coded reserve would go
 * stale the first time somebody adds a line to the instructions.
 *
 * THE ONE-PAGE FLOOR. If the first body alone exceeds the budget, it is kept
 * anyway. An empty context is a worse failure than an over-budget one: the
 * model would answer from general knowledge with no `pureLLM` banner, because
 * `pureLLM` is decided upstream by whether any page was found. So the smallest
 * non-empty context wins over an empty one, and `overBudgetSinglePage` reports
 * that the floor was used.
 */
export function fitPagesToBudget(
  bodies: readonly string[],
  budgetTokens: number,
  reserveTokens = 0,
): FitResult {
  // What is left for bodies once everything that is not a page has been paid
  // for. A reserve that swallows the whole budget leaves nothing, and the
  // one-page floor then keeps exactly one page rather than none.
  const bodyBudget = budgetTokens > 0 ? Math.max(0, budgetTokens - Math.max(0, reserveTokens)) : budgetTokens;
  const total = bodies.length;
  if (total === 0) {
    return {
      kept: [],
      keptIndexes: [],
      keptCount: 0,
      totalCount: 0,
      dropped: 0,
      estimatedTokens: 0,
      budgetApplied: false,
      overBudgetSinglePage: false,
    };
  }

  if (!(budgetTokens > 0)) {
    const estimated = bodies.reduce((sum, b) => sum + estimateTokens(b), 0);
    return {
      kept: [...bodies],
      keptIndexes: bodies.map((_, i) => i),
      keptCount: total,
      totalCount: total,
      dropped: 0,
      estimatedTokens: estimated,
      budgetApplied: false,
      overBudgetSinglePage: false,
    };
  }

  const kept: string[] = [];
  const keptIndexes: number[] = [];
  let used = 0;
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    const cost = estimateTokens(body);
    if (kept.length > 0 && used + cost > bodyBudget) break;
    kept.push(body);
    keptIndexes.push(i);
    used += cost;
  }

  const overBudgetSinglePage = kept.length === 1 && used > bodyBudget;
  return {
    kept,
    keptIndexes,
    keptCount: kept.length,
    totalCount: total,
    dropped: total - kept.length,
    estimatedTokens: used + Math.max(0, reserveTokens),
    budgetApplied: true,
    overBudgetSinglePage,
  };
}
