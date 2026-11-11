// core/candidate-gate.ts — Issue #514: pages from mentions.
//
// The extraction names candidates; this decides the clear cases before any
// further call is spent on them. A candidate whose name never appears in the
// source text, or appears only inside parentheses, enumerations or short list
// items, gets no page — link markup does not count against a name (neither
// its brackets as parentheses nor a parenthesis around the link: a name the
// author linked is prose wherever it stands), and neither does a parenthesis
// that is an exemplar list (profile markers) or a gloss of the name itself
// — and is removed from the other candidates' related_*
// lists so the gate never manufactures a dead link. Measured on a German
// sample (10 notes, 115 candidates): 9.6 % absent, 19.1 % aside, 71.3 % prose
// with the rules below (a first rule — plain substring, any sentence with two
// commas is an enumeration — read 7.8 / 27.8 / 64.3 and overreached on nested
// clauses and appositions while under-reading compounds).
//
// The threshold lives here, in code, not in a prompt: every constant below is
// a policy line that can move without a model noticing. Three prompt-side
// formulations of the same question were stable within a formulation (91–100 %
// self-agreement over three draws) and inconsistent between formulations
// (0.9 % to 13.9 % filtered). The model keeps the remaining two thirds: its
// `coverage` observation meets COVERAGE_BELOW_THRESHOLD below (stage 3 of the
// design, #568) — same module, same contract, after this gate.
//
// Opt-in (`settings.skipMentionOnlyCandidates`, off by default): it changes
// which pages an ingest writes, so it is the user's choice, not an upgrade's.
//
// Language-keyed on purpose. What counts as a word boundary, an inflection or
// a connective is a property of the language the page names are written in —
// `settings.wikiLanguage` — so the gate carries one profile per language and
// is a no-op (reported by the caller) for every language without one. It is
// also a no-op when the note declares a `language:` that differs from the wiki
// language: the names are translations then, and the source cannot contain
// them.
//
// Which languages carry a profile, and how: a word-script profile is an
// additive-suffix model — the name's words may carry one of the listed endings
// in running text, and chunk length is counted in words. That fits languages
// whose plural and case forms mostly append to the stem (German, English,
// French, Spanish, Portuguese, Dutch, and Korean, whose particles attach to the
// noun). A character-script profile (Chinese, Japanese) has no boundaries and
// no inflection: the name is a substring, chunk length is characters, and the
// language's dedicated list separator (、 in Chinese, ・ in Japanese) marks an
// enumeration outright. Where the stem itself changes (Italian vowel
// alternation, Swedish/Danish/Norwegian -a → -or/-er, Slavic declension) a
// suffix profile under-matches and drops candidates the source does treat —
// the wrong direction for a guess, so those languages get no profile rather
// than a bad one.
//
// Known, accepted consequence: a thing that fails here in source A and passes
// in source B gets its page with B, and A is not among its sources. The page
// set stays order-independent; the evidence set does not.

import type { SourceAnalysis, EntityInfo, ConceptInfo } from '../types';

export type GateVerdict = 'prose' | 'aside' | 'absent';

/** A sentence with at least this many commas may be an enumeration. */
const ENUM_MIN_COMMAS = 2;
/** ...and the comma-delimited chunk holding the name must be this short (words, word-script). */
const ENUM_MAX_WORDS = 4;
/** A markdown list item this short is an enumeration entry, not prose (words, word-script). */
const LIST_ITEM_MAX_WORDS = 6;
/** The same two limits for character-script languages (Chinese, Japanese), in characters. Estimated, unmeasured. */
const ENUM_MAX_CHARS = 12;
const LIST_ITEM_MAX_CHARS = 16;

/** Clause separators: the comma, its fullwidth form, and the ideographic comma. */
const SEPARATORS = /[,，、]/;
/** Sentence ends, Latin and CJK. */
const SENTENCE_END = /[.;!?。；！？]/;
/** Paired brackets that mark an aside, Latin and CJK. */
const PAREN_RE = /\([^()]*\)|\[[^[\]]*\]|（[^（）]*）|【[^【】]*】|「[^「」]*」|『[^『』]*』/g;

export interface GateLanguageProfile {
  /** Suffixes a word of the name may carry in running text (regex alternatives, no anchors). */
  inflection: readonly string[];
  /** Words that do not count when measuring how short an enumeration chunk is. */
  connectives: ReadonlySet<string>;
  /**
   * `word` (default): the name is matched at word boundaries, each word with
   * an optional inflection suffix, and chunk length is counted in words.
   * `char`: the language writes without word boundaries (Chinese, Japanese) —
   * the whole name is matched as a substring, chunk length is counted in
   * characters, and `inflection` is unused.
   */
  script?: 'word' | 'char';
  /**
   * Separators that only ever delimit list items in this language (the
   * Chinese ideographic comma 、, the Japanese nakaguro ・): a name in a chunk
   * bounded by one of them is an enumeration entry regardless of length.
   */
  enumerationMarks?: readonly string[];
  /**
   * Regex alternatives (no anchors) that mark a round parenthesis as an
   * exemplar list rather than an aside: `Antikoagulanzien (z. B. Warfarin)`
   * names members of the group it follows, with real predication —
   * `(Methylphenidat als First-Line in Deutschland)` — and the members are
   * exactly what a reader would look up. A profile without markers keeps the
   * strict reading: every parenthesis stays an aside.
   */
  exemplarMarkers?: readonly string[];
}

/**
 * One profile per wiki language. `de` is the measured one (ten notes, 115
 * candidates); every other profile is an estimate from the language's
 * inflection and has not been measured on a vault — the setting is off by
 * default, so an estimate is a starting point a user opts into, not a claim
 * shipped to everyone. Everything else → no profile → no gate (reported).
 */
export const GATE_LANGUAGE_PROFILES: Readonly<Record<string, GateLanguageProfile>> = {
  // measured
  de: {
    inflection: ['e', 's', 'n', 'en', 'es', 'er', 'em', 'ern', 'nen'],
    connectives: new Set(['und', 'oder', 'sowie', 'bzw.']),
    exemplarMarkers: ['\\bz\\.\\s?B\\.', '\\bwie\\b', '\\betwa\\b', '\\balternativ\\b', '\\bals\\b', '\\betc\\b', '\\bu\\.\\s?a\\.', '\\binkl\\b'],
  },
  // estimated — plural -s/-es, possessive; exemplar markers unmeasured
  en: {
    inflection: ['s', 'es', "'s"],
    connectives: new Set(['and', 'or']),
    exemplarMarkers: ['\\be\\.\\s?g\\.', '\\bsuch as\\b', '\\blike\\b', '\\bincluding\\b', '\\bincl\\b', '\\betc\\b'],
  },
  // estimated — plural -s/-x, feminine -e/-es; under-matches -al → -aux
  fr: {
    inflection: ['s', 'x', 'e', 'es'],
    connectives: new Set(['et', 'ou', 'ainsi', 'que']),
  },
  // estimated — plural -s/-es
  es: {
    inflection: ['s', 'es'],
    connectives: new Set(['y', 'e', 'o', 'u']),
  },
  // estimated — plural -s/-es; under-matches -ão → -ões, -l → -is
  pt: {
    inflection: ['s', 'es'],
    connectives: new Set(['e', 'ou']),
  },
  // estimated — plural -s/-en/-'s; under-matches consonant doubling and
  // vowel shortening (eiwit → eiwitten, boom → bomen)
  nl: {
    inflection: ['s', 'en', "'s", 'n'],
    connectives: new Set(['en', 'of']),
  },
  // estimated — particles attach to the noun additively (은/는, 이/가, 을/를,
  // 의, 에, 에서, 로/으로, 와/과, 도, 만, 들); spaces delimit words
  ko: {
    inflection: ['은', '는', '이', '가', '을', '를', '의', '에', '에서', '에게', '로', '으로', '와', '과', '도', '만', '들', '들은', '들이', '들을', '부터', '까지', '처럼', '보다'],
    connectives: new Set(['및', '또는', '그리고', '혹은']),
  },
  // estimated — no word boundaries, no inflection: substring match, length in
  // characters; 、 separates list items and nothing else
  zh: {
    inflection: [],
    connectives: new Set(['和', '及', '与', '或', '以及', '或者', '跟', '同']),
    script: 'char',
    enumerationMarks: ['、'],
  },
  // estimated — no word boundaries: substring match, length in characters;
  // 、 is the general comma here, ・ the list separator
  ja: {
    inflection: [],
    connectives: new Set(['や', 'と', 'および', '及び', 'または', '又は', 'か', 'も']),
    script: 'char',
    enumerationMarks: ['・'],
  },
};

/** `de-CH` → `de`; unknown or empty → null (no gate). */
export function gateProfileFor(language: string | undefined | null): GateLanguageProfile | null {
  if (!language) return null;
  const key = language.trim().toLowerCase();
  return GATE_LANGUAGE_PROFILES[key] ?? GATE_LANGUAGE_PROFILES[key.split(/[-_]/)[0]] ?? null;
}

function nfc(s: string): string {
  return s.normalize('NFC');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-name match with word boundaries on both sides, each word tolerant of
 * an inflection suffix: `Ferritins`, `Kohlenhydraten`, `oxidativen Wirkung`
 * match; `Transferrinsättigung` does not match `Transferrin` — a compound is a
 * different word, and a page named after the part was not named by the source.
 */
function needleOf(name: string, profile: GateLanguageProfile): RegExp | null {
  const parts = nfc(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (profile.script === 'char') {
    // No word boundaries to assert: a Han character next to the name is a
    // letter to \p{L}, so a boundary test would reject every real occurrence.
    return new RegExp(parts.map(escapeRe).join('\\s*'), 'giu');
  }
  const inflection = profile.inflection.length > 0 ? `(?:${profile.inflection.map(escapeRe).join('|')})?` : '';
  const body = parts.map(p => escapeRe(p) + inflection).join('\\s+');
  // The trailing assertion stays a lookahead — every engine we support has it.
  // The leading boundary is checked by `atWordStart` instead of `(?<!…)`: a
  // lookbehind throws when the pattern is constructed on iOS before 16.4, and
  // `new RegExp` builds this one from a page name, so no lint rule can see it.
  return new RegExp(`${body}(?![\\p{L}\\p{N}])`, 'giu');
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** A name is whole: `Transferrin` is not named inside `Transferrinsättigung`. */
function atWordStart(text: string, pos: number): boolean {
  return pos === 0 || !WORD_CHAR.test(text[pos - 1]);
}

/** Link markup, whose brackets are syntax: `[[wikilink]]`, `![[embed]]`, `[text](url)`. */
const LINK_RE = /!?\[\[[^\]\n]*\]\]|!?\[[^[\]\n]*\]\([^)\n]*\)/g;

/**
 * Every name the note's own link markup asserts: wikilink targets (folder
 * prefix and `#anchor` stripped), pipe aliases, and markdown link texts —
 * case-folded, NFC. Exact names, no inflection: a link is an exact claim.
 */
function linkedNames(text: string): ReadonlySet<string> {
  const names = new Set<string>();
  const add = (s: string) => { const n = nfc(s).trim().toLowerCase(); if (n) names.add(n); };
  const t = nfc(text);
  const re = new RegExp(LINK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const wiki = /^!?\[\[([^\]]*)\]\]$/.exec(m[0]);
    if (wiki) {
      const [target, alias] = wiki[1].split('|');
      add((target ?? '').split('#')[0].split('/').pop() ?? '');
      if (alias) add(alias);
      continue;
    }
    const md = /^!?\[([^\]]*)\]/.exec(m[0]);
    if (md) add(md[1]);
  }
  return names;
}

function linkSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const re = new RegExp(LINK_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

/**
 * The bracket pairs that mark an aside — link markup excluded, because a name
 * the author linked is the opposite of a passing mention.
 *
 * PAREN_RE matches the inner `[X]` of a `[[X]]` and both halves of
 * `[text](url)`, so before this every wikilinked or hyperlinked name was
 * classified `aside`: no page, and — through pruneDropped — no edge from any
 * surviving page either. In an Obsidian vault that inverts the signal the
 * gate is meant to read, since a wikilink is the most explicit statement a
 * note makes about relevance.
 *
 * Excluding the span rather than rewriting the text keeps BOTH names of a
 * piped link readable: `[[ACE-Hemmer|ACEi]]` names the thing twice, and a
 * candidate may carry either. Collapsing a link to its display text instead
 * turned 7 of 87 measured `aside` verdicts into `absent`.
 *
 * A parenthesis that merely CONTAINS a link is still an aside as a span —
 * but the linked name itself is rescued one level up: an occurrence inside
 * link markup is never an aside (see classifyCandidate). A bare bracketed
 * citation carries no `(url)` and stays an aside as well.
 *
 * Measured on a German vault, 16 notes and 321 candidates: 32 verdicts move
 * `aside` → `prose`, none the other way.
 *
 * A round parenthesis whose content carries one of the profile's exemplar
 * markers (`z. B.`, `wie`, `als`, …) is no aside either: `Antikoagulanzien
 * (z. B. Warfarin)` and `Stimulanzien (Methylphenidat als First-Line)` name
 * the members of the group they follow — dropping them cost a medical vault
 * exactly its pharmacology. Measured on 20 German notes, two independent
 * draws, 159 `aside` verdicts: the marker rule moves 32 `aside` → `prose`,
 * the link-occurrence rule 19, the gloss rule (isGlossSpan) 19 — 68 combined,
 * no verdict moves toward `aside`, and every rescued case was reviewed.
 */
function parenSpans(text: string, profile?: GateLanguageProfile): Array<[number, number]> {
  const links = linkSpans(text);
  const markers = profile?.exemplarMarkers?.length
    ? new RegExp(profile.exemplarMarkers.join('|'), 'iu')
    : null;
  const spans: Array<[number, number]> = [];
  const re = new RegExp(PAREN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index, end = start + m[0].length;
    if (links.some(([a, b]) => start >= a && end <= b)) continue;
    if (markers && (text[start] === '(' || text[start] === '（') && markers.test(m[0].slice(1, -1))) continue;
    spans.push([start, end]);
  }
  return spans;
}

/**
 * A parenthesis whose content is nothing but the name is a gloss, not an
 * aside — the text introduces the term there: a synonym (`Übersäuerung
 * (Azidose)`), a translation or botanical name (`Maca (Lepidium meyenii)`),
 * an expanded acronym (`TWI (tolerierbare wöchentliche Aufnahmemenge)`).
 * Emphasis markup around the name does not count; partial cover does not
 * qualify (`(p53-abhängig)` glosses nothing). The rule decides only whether
 * the name earns a page — it asserts no identity between the name and what
 * precedes the parenthesis: `Grüntee-Polyphenole (EGCG)` glosses a member,
 * not a synonym, and telling those apart is a typed-relation question, not
 * a bracket question. Round parentheses only — a square-bracketed citation
 * that consists of the name is still a citation.
 */
function isGlossSpan(text: string, span: [number, number], needle: RegExp): boolean {
  if (text[span[0]] !== '(' && text[span[0]] !== '（') return false;
  const inner = text.slice(span[0] + 1, span[1] - 1).replace(/[*_`]/g, ' ').trim();
  const re = new RegExp(needle.source, needle.flags);
  const m = re.exec(inner);
  return m !== null && atWordStart(inner, m.index) && m.index <= 1 && m.index + m[0].length >= inner.length - 1;
}

function lineAt(text: string, pos: number): string {
  const start = text.lastIndexOf('\n', pos - 1) + 1;
  const end = text.indexOf('\n', pos);
  return text.slice(start, end === -1 ? text.length : end);
}

/** The sentence around `pos`, read across wrapped lines: paragraph first, then a sentence end (Latin or CJK). */
function sentenceAt(text: string, pos: number): { sentence: string; rel: number } {
  let p0 = text.lastIndexOf('\n\n', pos);
  p0 = p0 === -1 ? 0 : p0 + 2;
  let p1 = text.indexOf('\n\n', pos);
  if (p1 === -1) p1 = text.length;
  const para = text.slice(p0, p1).replace(/\n/g, ' ');
  const rel = pos - p0;
  let start = rel;
  while (start > 0 && !SENTENCE_END.test(para[start - 1])) start--;
  let end = rel;
  while (end < para.length && !SENTENCE_END.test(para[end])) end++;
  return { sentence: para.slice(start, end), rel: rel - start };
}

/**
 * How long a chunk is for the enumeration test: words (minus connectives) in
 * a word-script language, characters (minus connectives, spaces and
 * punctuation) in a character-script one.
 */
function chunkLength(chunk: string, profile: GateLanguageProfile): number {
  if (profile.script === 'char') {
    let c = chunk;
    for (const w of profile.connectives) c = c.split(w).join('');
    return Array.from(c.replace(/[\s\p{P}]+/gu, '')).length;
  }
  return chunk.trim().split(/\s+/).filter(w => w && !profile.connectives.has(w.toLowerCase())).length;
}
const enumMax = (profile: GateLanguageProfile) => profile.script === 'char' ? ENUM_MAX_CHARS : ENUM_MAX_WORDS;
const listItemMax = (profile: GateLanguageProfile) => profile.script === 'char' ? LIST_ITEM_MAX_CHARS : LIST_ITEM_MAX_WORDS;

/**
 * An enumeration entry: the sentence has enough separators, the chunk holding
 * the name is short, and so is a neighbouring chunk — an apposition (`Das
 * Hepcidin, das in der Leber gebildet wird, ...`) has a short chunk with long
 * neighbours and is not a list. In a language with a dedicated list separator
 * (Chinese 、, Japanese ・) a chunk bounded by it is an entry outright.
 */
function isEnumerationChunk(sentence: string, rel: number, profile: GateLanguageProfile): boolean {
  const marks = profile.enumerationMarks ?? [];
  const seps = new RegExp(`[${SEPARATORS.source.slice(1, -1)}${marks.map(escapeRe).join('')}]`);
  if ((sentence.match(new RegExp(seps.source, 'g')) ?? []).length < ENUM_MIN_COMMAS) return false;
  let pos = 0;
  const chunks = sentence.split(seps);
  for (let i = 0; i < chunks.length; i++) {
    const end = pos + chunks[i].length;
    if (rel >= pos && rel <= end) {
      if (marks.length > 0) {
        const before = pos > 0 ? sentence[pos - 1] : '';
        const after = end < sentence.length ? sentence[end] : '';
        if (marks.includes(before) || marks.includes(after)) return true;
      }
      if (chunkLength(chunks[i], profile) > enumMax(profile)) return false;
      const neighbours = [chunks[i - 1], chunks[i + 1]].filter((c): c is string => c !== undefined);
      return neighbours.some(c => chunkLength(c, profile) <= enumMax(profile));
    }
    pos = end + 1;
  }
  return false;
}

/**
 * Where the name stands in the text: in running prose (at least once), only
 * as an aside (parentheses, enumeration, short list item), or nowhere.
 * Case-insensitive, NFC-normalized, whole name — not a core word, not an alias:
 * a page is named after what the source says, or it is not made from it.
 */
export function classifyCandidate(text: string, name: string, profile: GateLanguageProfile): GateVerdict {
  const t = nfc(text);
  const needle = needleOf(name, profile);
  if (!needle) return 'absent';
  const links = linkSpans(t);
  const spans = parenSpans(t, profile);
  let sawAside = false;
  let m: RegExpExecArray | null;
  while ((m = needle.exec(t)) !== null) {
    const pos = m.index, end = pos + m[0].length;
    if (m[0].length === 0) { needle.lastIndex++; continue; }
    // Reject a name that continues a word, then resume one character later so
    // an overlapping occurrence is not skipped.
    if (!atWordStart(t, pos)) { needle.lastIndex = pos + 1; continue; }
    // A name inside link markup was linked by the author — the most explicit
    // relevance statement a note makes, prose wherever the link stands.
    if (links.some(([a, b]) => pos >= a && end <= b)) return 'prose';
    const line = lineAt(t, pos);
    if (/^\s*#{1,6}\s/.test(line)) return 'prose';
    const covering = spans.find(([a, b]) => a <= pos && pos < b);
    if (covering) {
      if (isGlossSpan(t, covering, needle)) return 'prose';
      sawAside = true; continue;
    }
    const item = /^\s*[-*•]\s+/.exec(line);
    if (item) {
      if (chunkLength(line.slice(item[0].length), profile) <= listItemMax(profile)) { sawAside = true; continue; }
      return 'prose';
    }
    const { sentence, rel } = sentenceAt(t, pos);
    if (isEnumerationChunk(sentence, rel, profile)) { sawAside = true; continue; }
    return 'prose';
  }
  return sawAside ? 'aside' : 'absent';
}

/**
 * domain axis stage 3 (#568): the coverage values that fall below the
 * threshold — no page, no call. This is the policy line the design asked for:
 * the model reports what the text does (`defined` / `discussed` / `named`),
 * the code decides what is enough. Moving it (e.g. to `named` plus
 * `discussed` with a single mention) is a change here, not in a prompt, and
 * no model notices. A missing or unknown value keeps the candidate — absence
 * is not a signal.
 */
export const COVERAGE_BELOW_THRESHOLD: ReadonlySet<string> = new Set(['named']);

/** Why a candidate got no page: where the text put it, or what the model observed. */
export type DropReason =
  | Exclude<GateVerdict, 'prose'>
  | 'named'
  // Outcome-table drops (S135): both gates below threshold, or a dissent name
  // whose identity is ambiguous in the vault (an alias two pages claim).
  | 'aside+named'
  | 'ambiguous';

/**
 * Parameterised on the reason so each gate's result says what that gate can
 * actually emit: the position gate never reports `named`, the coverage
 * threshold reports nothing else. The default keeps the shared shape for
 * callers that handle both (the engine logs them through one line).
 */
export interface DroppedCandidate<R extends DropReason = DropReason> {
  name: string;
  kind: 'entity' | 'concept';
  verdict: R;
}

export interface GateResult<R extends DropReason = DropReason> {
  entities: EntityInfo[];
  concepts: ConceptInfo[];
  dropped: DroppedCandidate<R>[];
  /**
   * Dropped names that stayed in the survivors' related_* lists because the
   * vault already has a page for them (`isKnownPage`). No page is written
   * for them in this ingest; the edge to the existing page is kept.
   * Present on both gates so the caller can log it the same way (#620).
   */
  linkedAnyway: string[];
  /** False when no profile exists for `language` — the input came back untouched. */
  applied: boolean;
}

/**
 * Apply the gate to an analysis for pages named in `language` (the wiki
 * language). Returns the kept candidates (with references to dropped names
 * pruned from related_* lists) and what was dropped, why. Pure; the caller
 * decides what to log and writes the result back. The cross-language check
 * (note declares another language) is the caller's — it needs the vault.
 *
 * `isKnownPage` answers whether a name already resolves to a wiki page
 * (title or alias). The gate decides whether THIS note earns a page for a
 * name; it cannot decide that a link to a page another note already earned
 * is dead (#620). Without the predicate every dropped name is pruned, which
 * on a measured vault emptied the related sections of pages whose named
 * neighbours existed.
 */
export function gateCandidates(
  analysis: Pick<SourceAnalysis, 'entities' | 'concepts'>,
  sourceText: string,
  language: string | undefined | null,
  isKnownPage?: (name: string) => boolean,
): GateResult<Exclude<GateVerdict, 'prose'>> {
  const profile = gateProfileFor(language);
  if (!profile) return { entities: analysis.entities, concepts: analysis.concepts, dropped: [], linkedAnyway: [], applied: false };
  const dropped: DroppedCandidate<Exclude<GateVerdict, 'prose'>>[] = [];
  const keep = <T extends { name: string }>(items: T[], kind: DroppedCandidate['kind']): T[] =>
    items.filter(item => {
      const verdict = classifyCandidate(sourceText, item.name, profile);
      if (verdict === 'prose') return true;
      dropped.push({ name: item.name, kind, verdict });
      return false;
    });
  const entities = keep(analysis.entities, 'entity');
  const concepts = keep(analysis.concepts, 'concept');
  if (dropped.length === 0) return { entities: analysis.entities, concepts: analysis.concepts, dropped, linkedAnyway: [], applied: true };
  return { ...pruneDroppedNames(entities, concepts, dropped, isKnownPage), dropped, applied: true };
}

/**
 * Remove the dropped names from the survivors' related_* lists, so that no
 * gate ever manufactures a dead link (#514). Names the vault already has a
 * page for (`isKnownPage`) are NOT pruned: the gate decides whether THIS
 * note earns a page for a name, never that a link to a page another note
 * already earned is dead (#620). Shared by the deterministic gate and the
 * coverage threshold so both halves of the gate answer "known" the same way.
 */
function pruneDroppedNames<R extends DropReason>(
  entities: EntityInfo[],
  concepts: ConceptInfo[],
  dropped: readonly DroppedCandidate<R>[],
  isKnownPage?: (name: string) => boolean,
): { entities: EntityInfo[]; concepts: ConceptInfo[]; linkedAnyway: string[] } {
  const key = (n: string) => nfc(n).trim().toLowerCase();
  const linkedAnyway = dropped.filter(d => isKnownPage?.(d.name) === true).map(d => d.name);
  const gone = new Set(dropped.filter(d => !linkedAnyway.includes(d.name)).map(d => key(d.name)));
  const prune = (names: string[] | undefined): string[] | undefined =>
    names?.filter(n => !gone.has(key(n)));
  return {
    entities: entities.map(e => ({
      ...e,
      ...(e.related_entities ? { related_entities: prune(e.related_entities) } : {}),
      ...(e.related_concepts ? { related_concepts: prune(e.related_concepts) } : {}),
    })),
    concepts: concepts.map(c => ({
      ...c,
      related_concepts: prune(c.related_concepts) ?? [],
      ...(c.related_entities ? { related_entities: prune(c.related_entities) } : {}),
    })),
    linkedAnyway,
  };
}

/**
 * domain axis stage 3 (#568): the semantic half of the gate. The
 * extraction reports per candidate how the source treats it (`coverage`);
 * this applies COVERAGE_BELOW_THRESHOLD. Language-independent — the
 * observation is the model's, the threshold is ours — and therefore applied
 * after the deterministic gate, to its survivors. Pure, same contract as
 * gateCandidates; `applied` is always true.
 *
 * `isKnownPage` mirrors gateCandidates (#620): a dropped name the vault
 * already has a page for keeps its edge in the survivors' related_* lists.
 *
 * With `sourceText` given (the raw note body), a candidate whose exact name
 * the note's own link markup carries — wikilink target, pipe alias, or
 * markdown link text — survives a `named` verdict (#607): the author linking
 * a name is a stronger statement about relevance than the model's reading of
 * how the text treats it.
 */
export function applyCoverageThreshold(
  analysis: Pick<SourceAnalysis, 'entities' | 'concepts'>,
  sourceText?: string,
  isKnownPage?: (name: string) => boolean,
): GateResult<'named'> {
  const linked = sourceText === undefined ? null : linkedNames(sourceText);
  const dropped: DroppedCandidate<'named'>[] = [];
  const keep = <T extends { name: string; coverage?: string }>(items: T[], kind: DroppedCandidate['kind']): T[] =>
    items.filter(item => {
      const cov = typeof item.coverage === 'string' ? item.coverage.trim().toLowerCase() : '';
      if (!COVERAGE_BELOW_THRESHOLD.has(cov)) return true;
      // Author's link outranks coverage (#607): `[[Reis]]` in Arsen, `[[Blei]]`
      // in Reis were both hand-linked and both dropped as `named` without this.
      if (linked?.has(nfc(item.name).trim().toLowerCase())) return true;
      // #620 parity is in pruneDroppedNames below, NOT here: a known page
      // name still belongs in `dropped` so the caller can log it, but its
      // edge stays in the survivors' related_* lists.
      dropped.push({ name: item.name, kind, verdict: 'named' });
      return false;
    });
  const entities = keep(analysis.entities, 'entity');
  const concepts = keep(analysis.concepts, 'concept');
  if (dropped.length === 0) return { entities: analysis.entities, concepts: analysis.concepts, dropped, linkedAnyway: [], applied: true };
  return { ...pruneDroppedNames(entities, concepts, dropped, isKnownPage), dropped, applied: true };
}

// ---------------------------------------------------------------------------
// S135: the three-outcome table. The position gate (deterministic: where the
// text puts the name) and the coverage observation (the model: how the text
// treats it) measure different things, and their dissent is mixed content —
// neither may hold a veto alone. Measured over 1,153 items across three
// ingest runs: the full-page set of this table equals exactly the keep set of
// the two serial gates above, so the table is a pure extension — it converts
// about half of today's drops into stubs and demotes nothing.

/** The two dissent cells. Agreement cells need no name: full page or nothing. */
export type StubCell = 'prose+named' | 'aside+covered';

export interface StubCandidate {
  kind: 'entity' | 'concept';
  cell: StubCell;
  item: EntityInfo | ConceptInfo;
}

/**
 * What the vault already says about a dissent name. Supplied by the caller
 * (the gate is pure and has no vault): 'match' = exactly one page carries the
 * name as title or curated alias — no stub, the name stays linkable and the
 * existing page takes the edge; 'ambiguous' = two pages claim it — no stub
 * and the name is pruned (a stub born onto a contested name would buy back
 * the dedup cost this gate exists to save); 'none' = a stub is born.
 */
export type StubIdentity = 'none' | 'match' | 'ambiguous';

export interface OutcomeTableResult extends GateResult {
  /** Dissent names with no page yet: stub births, in analysis order. */
  stubs: StubCandidate[];
  /** Dissent names an existing page already answers: no page work, name kept. */
  existing: Array<{ name: string; kind: 'entity' | 'concept'; cell: StubCell }>;
}

/**
 * Route every candidate through the decision table instead of the two serial
 * gates above:
 *
 *   hand-linked name            → full page   (the author's link outranks both gates)
 *   prose  + covered            → full page
 *   prose  + named              → stub        (dissent: the model under-read the text)
 *   aside  + covered            → stub        (dissent: the position rule over-read it)
 *   aside  + named              → nothing
 *   absent                      → nothing
 *
 * A missing/unknown `coverage` value counts as covered, exactly as in
 * applyCoverageThreshold. Stub and existing-match names are NOT pruned from
 * the survivors' related_* lists — their pages exist (or will), so the links
 * resolve; only the nothing-cells are pruned. Pure, same no-profile contract
 * as gateCandidates (`applied: false`, input untouched).
 */
export function applyOutcomeTable(
  analysis: Pick<SourceAnalysis, 'entities' | 'concepts'>,
  sourceText: string,
  language: string | undefined | null,
  resolveIdentity: (name: string) => StubIdentity,
  isKnownPage?: (name: string) => boolean,
): OutcomeTableResult {
  const profile = gateProfileFor(language);
  if (!profile) {
    return { entities: analysis.entities, concepts: analysis.concepts, dropped: [], stubs: [], existing: [], linkedAnyway: [], applied: false };
  }
  const linked = linkedNames(sourceText);
  const dropped: DroppedCandidate[] = [];
  const stubs: StubCandidate[] = [];
  const existing: OutcomeTableResult['existing'] = [];
  const route = <T extends EntityInfo | ConceptInfo>(items: T[], kind: StubCandidate['kind']): T[] =>
    items.filter(item => {
      if (linked.has(nfc(item.name).trim().toLowerCase())) return true;
      const position = classifyCandidate(sourceText, item.name, profile);
      const cov = typeof item.coverage === 'string' ? item.coverage.trim().toLowerCase() : '';
      const covered = !COVERAGE_BELOW_THRESHOLD.has(cov);
      if (position === 'prose' && covered) return true;
      if (position === 'absent') {
        dropped.push({ name: item.name, kind, verdict: 'absent' });
        return false;
      }
      if (position === 'aside' && !covered) {
        dropped.push({ name: item.name, kind, verdict: 'aside+named' });
        return false;
      }
      const cell: StubCell = position === 'prose' ? 'prose+named' : 'aside+covered';
      const identity = resolveIdentity(item.name);
      if (identity === 'match') {
        existing.push({ name: item.name, kind, cell });
        return false;
      }
      if (identity === 'ambiguous') {
        dropped.push({ name: item.name, kind, verdict: 'ambiguous' });
        return false;
      }
      stubs.push({ kind, cell, item });
      return false;
    });
  const entities = route(analysis.entities, 'entity');
  const concepts = route(analysis.concepts, 'concept');
  if (dropped.length === 0) {
    return { entities, concepts, dropped, stubs, existing, linkedAnyway: [], applied: true };
  }
  return { ...pruneDroppedNames(entities, concepts, dropped, isKnownPage), dropped, stubs, existing, applied: true };
}
