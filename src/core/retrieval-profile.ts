// retrieval-profile.ts — how a query matches a page.
//
// One place decides what a page offers the seed stage and how a needle scores
// against it. It lives apart from the ranking so that Stage 1 (the tokenized
// query) and Stage 1.5b (LLM keywords) cannot drift into two scoring rules.
//
// Why the summary tier exists. #729's measured loss is at the lexical seed
// stage: the query says "how has knowledge evolved" and the page is titled
// "Consolidation kernel". Title and aliases share no word with the question, so
// the page scores zero and is never selected. The page's summary says what it
// is about in prose, which is the register the question is written in. That
// summary was already in the candidate's hands — `read-index.ts` maps it out of
// the index — and the scoring ignored it.
//
// The page prose carries the same signal one register lower. `prompts/
// ingestion.ts:30` requires 2-4 verbatim sentences from the note, and
// `create-page.ts:246-256` writes them as the Mentions section. Those are the
// user's own words on the page, and nothing in the seed stage read them.
//
// Both tiers are low weight on purpose. A low-weight tier can only add
// candidates — a page with no overlap still scores zero and is still left out —
// so it cannot drop the page the user just searched for. That is the objection
// `ppr-cascade.ts` raised against using the summary, and it does not survive
// the arithmetic.

/**
 * What a page offers the seed stage. `summary` and `text` are optional because
 * a page may have neither, and a page without them must rank exactly as it did
 * before this tier existed.
 */
export interface PageProfile {
  title: string;
  aliases: readonly string[];
  /** The index's one-line summary: the semantic bridge between phrasings. */
  summary?: string;
  /** The page's prose when the caller has it. The Mentions quotes are in here. */
  text?: string;
}

/**
 * One table for the four fields. The stages read the weights from here rather
 * than hardcoding 3/2/1, so a future change lands in one place.
 */
export const PROFILE_WEIGHTS = { title: 3, alias: 2, summary: 1, text: 1 } as const;

export interface ProfileScore {
  score: number;
  /** Needles found in any field. */
  tokensFound: number;
  /** Needles found in the title or an alias — the name-only view, kept for callers that apply a name bonus. */
  nameTokensFound: number;
}

/**
 * What a "word" is made of: letters, digits and combining marks (so a
 * decomposed umlaut — NFD, as macOS and iCloud hand files over — stays
 * inside its word). Shared by the tokenizer and the needle matcher so
 * both agree. Built with the RegExp constructor because a `\p{…}`
 * literal is what the ES6 tsconfig target rejects, not the runtime —
 * the same form candidate-gate.ts uses.
 */
export const WORD_CHAR_CLASS = '\\p{L}\\p{N}\\p{M}';
/**
 * Scripts written without word spaces. A needle in one of them cannot
 * be asked to start a word — there is no boundary to find — so it keeps
 * substring semantics; a run of them is not a "word run" either, the
 * CJK block below cuts those. Matches the tokenizer's CJK/kana/Hangul
 * handling, plus Thai for the same reason.
 */
export const NO_BOUNDARY_SCRIPT = '\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}\\p{sc=Hangul}\\p{sc=Thai}';
export const BOUNDED_WORD_CHAR = `(?:(?![${NO_BOUNDARY_SCRIPT}])[${WORD_CHAR_CLASS}])`;
export const WORD_CHAR = new RegExp(`[${WORD_CHAR_CLASS}]`, 'u');
export const BOUNDED_WORD_ONLY = new RegExp(`^${BOUNDED_WORD_CHAR}+$`, 'u');
/** One continuous run of CJK characters, and nothing else. */
const CJK_CLAUSE_ONLY = new RegExp(
  '^[\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}\\p{sc=Hangul}]+$',
  'u',
);

/**
 * Does `kw` occur in `textLower`? A needle from a space-delimited script
 * must start a word; a needle from a script without word spaces (CJK,
 * Thai …) matches as a substring.
 *
 * Substring matching was dominated by accidents of spelling: in a
 * 3,000-page German vault "man" hit Kahneman and Karpman, "bei" hit
 * Salbei, "kann" hit Pekannüsse, and "creatin" hit Phosphocreatin — a
 * different substance that shares seven letters. A word start keeps
 * prefix compounds ("nierenfunktion" → Nierenfunktionsstörung) and
 * hyphenated ones ("kinase" → Creatin-Kinase); a tail compound
 * ("insuffizienz" in Niereninsuffizienz) is left to aliases, the LLM
 * keyword stage and the graph walk. Pure function.
 */
export function needleHits(textLower: string, kw: string): boolean {
  if (!BOUNDED_WORD_ONLY.test(kw)) {
    return textLower.includes(kw);
  }
  let i = textLower.indexOf(kw);
  while (i !== -1) {
    if (i === 0 || !WORD_CHAR.test(textLower[i - 1])) return true;
    i = textLower.indexOf(kw, i + 1);
  }
  return false;
}

/**
 * A needle that is one continuous run of CJK characters, long enough to carry
 * more than one bigram. Short needles and Latin needles keep exact matching:
 * a two-character needle has one bigram, so no floor could ever open, and
 * letting it match partially would hit half the vault.
 */
export function isCjkClause(kw: string): boolean {
  return kw.length >= 4 && CJK_CLAUSE_ONLY.test(kw);
}

/**
 * How many of the needle's character bigrams appear in the text.
 *
 * `tokenizeQuery` takes the longest continuous CJK run as one token, so a
 * Chinese question arrives as whole clauses. Exact matching then degenerates
 * into all-or-nothing: "知识如何演化" scores zero against "知识演化" and the page
 * is invisible rather than merely low-ranked. Counting shared two-character
 * fragments turns that cliff into a step. Chinese is where this bites hardest.
 *
 * The count is returned rather than folded into a boolean so a later ranking
 * can weigh a near match below a full one. It is NOT a semantic measure: it is
 * orthography. The meaning is carried by the summary tier and the LLM keyword
 * stage, which is where it belongs.
 */
export function cjkBigramOverlap(textLower: string, kw: string): number {
  if (!isCjkClause(kw)) return 0;
  let shared = 0;
  for (let i = 0; i + 1 < kw.length; i++) {
    if (textLower.includes(kw.slice(i, i + 2))) shared++;
  }
  return shared;
}

/**
 * The floor. Two shared bigrams: one is spelling, two is a fragment that means
 * something. Without it "深" and friends would light up half a Chinese vault,
 * which is the noise single-character matching was already rejected for.
 */
export const CJK_BIGRAM_FLOOR = 2;

function fieldHit(textLower: string, kw: string): boolean {
  return needleHits(textLower, kw) || cjkBigramOverlap(textLower, kw) >= CJK_BIGRAM_FLOOR;
}

/**
 * Score one page against the needles. Each needle pays the weight of the first
 * field that carries it — title, then alias, then summary, then prose — so a
 * name hit is not paid twice and a long body cannot drown a name hit.
 *
 * Pure function. No IO, no allocation beyond the alias lowercases.
 */
export function scoreProfile(profile: PageProfile, needles: readonly string[]): ProfileScore {
  const titleLower = profile.title.toLowerCase();
  const aliasLowers = profile.aliases.map(a => a.toLowerCase());
  const summaryLower = (profile.summary ?? '').toLowerCase();
  const textLower = (profile.text ?? '').toLowerCase();

  let score = 0;
  let tokensFound = 0;
  let nameTokensFound = 0;
  for (const raw of needles) {
    const kw = raw.toLowerCase();
    if (kw.length === 0) continue;
    if (fieldHit(titleLower, kw)) {
      score += PROFILE_WEIGHTS.title;
      tokensFound++;
      nameTokensFound++;
      continue;
    }
    if (aliasLowers.some(a => fieldHit(a, kw))) {
      score += PROFILE_WEIGHTS.alias;
      tokensFound++;
      nameTokensFound++;
      continue;
    }
    if (summaryLower.length > 0 && fieldHit(summaryLower, kw)) {
      score += PROFILE_WEIGHTS.summary;
      tokensFound++;
      continue;
    }
    if (textLower.length > 0 && fieldHit(textLower, kw)) {
      score += PROFILE_WEIGHTS.text;
      tokensFound++;
    }
  }
  return { score, tokensFound, nameTokensFound };
}
