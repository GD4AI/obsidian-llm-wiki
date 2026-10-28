// PR #3 split: Phase 4 of buildWikiContext — assemble the final system
// prompt. Extracted from query-engine.ts (1192-1252).
//
// Pure: takes the index content + loaded page bodies + arm info + lang
// settings → returns the system prompt string sent to the LLM.

import { WIKI_LANGUAGES } from '../../../types';
import { WIKI_FOLDER_PLACEHOLDER } from '../../../core/prompt-builders';
import { SECTION_LABELS } from '../../system-prompts';

export interface AssembleContextInput {
  /** Bodies produced by load-pages (already formatted with `## ${title}\n\n${body}`). */
  pageBodies: string[];
  /** PPR arm label, e.g. "PPR+LLM". */
  armLabel: string;
  llmAugmented: boolean;
  matchesCount: number;
  wikiFolder: string;
  wikiLanguage: string;
  /**
   * v1.24.1 PATCH Phase 5.5.0 (optional): a compact per-page summary
   * list derived from pageRefs (path + title + aliases). Sent to the
   * chat LLM as a lightweight "what's in the wiki" hint so it can
   * see pages that weren't retrieved but exist in the wiki. Replaces
   * the heavy wiki index full text. Caller decides whether to pass
   * `undefined` (skip) or include the list.
   */
  pageSummaryHint?: string;
  /**
   * v1.24.1 PATCH Phase 5.5.1: when true, the pipeline found no
   * wiki-relevant pages. The chat LLM should answer from its general
   * knowledge base and the UI must surface a verify-vault banner so the
   * user does not mistake the answer for wiki-backed content.
   */
  pureLLM?: boolean;
}

/**
 * Build the wiki-context system prompt for the query LLM.
 *
 * v1.24.0 (Bug C 3.0): the prompt uses the literal placeholder
 * `__WIKI_FOLDER__` instead of `${input.wikiFolder}` for every wiki-link.
 * Why: the LLM's responses persist to chat history, and history is replayed
 * as few-shot context for every subsequent query. If the real wikiFolder
 * were baked into the prompt, then into history, then into subsequent
 * prompts, the LLM would follow that established folder even after the
 * user changed the setting. The placeholder makes the LLM-folder
 * relationship transparent; render-time substitution (in
 * `thinking-extract.ts`) replaces the placeholder with the current
 * `settings.wikiFolder` for the user-facing display only.
 *
 * Identical wording to the original inline code (regression-tested by
 * existing manual e2e — prompts are not unit-tested to keep the
 * canonical template under one author's editorial control).
 *
 * Issue #908 changed that balance. The template still belongs to one author,
 * but three of its clauses are correctness constraints rather than wording —
 * exact values, what counts as evidence, and how to state a missing answer —
 * and a constraint nobody asserts is a constraint that will be lost in the
 * next edit. `src/__tests__/wiki/query-prompt-clauses.test.ts` pins those
 * clauses and nothing else, so the prose stays editable and the guarantees do
 * not.
 */
export function assembleWikiContext(input: AssembleContextInput): string {
  const lang = input.wikiLanguage || 'en';
  const langName = WIKI_LANGUAGES[lang] || lang;
  const langDirective = `IMPORTANT: You MUST write ALL responses in ${langName}. Every answer, explanation, and label must be in ${langName}.`;

  // Build a shorter note for the context: which arm was used.
  const armInfo = input.armLabel.replace(/\+LLM$/, '');
  const retrievalNote = input.matchesCount > 0
    ? `(Pages selected via ${armInfo} retrieval.)`
    : '(No relevant pages found. The LLM should answer from general knowledge.)';

  // Bug C 3.0: use the placeholder constant, never the real wikiFolder.
  const wf = WIKI_FOLDER_PLACEHOLDER;

  // v1.24.1 PATCH Phase 5.5.0: the heavy `Wiki Index:` section (full
  // wiki index text) is no longer included — it was the dominant
  // contributor to prompt overflow on large vaults (2137 nodes →
  // ~70K tokens of index text alone). The page bodies already give
  // the LLM the content it needs; an optional `pageSummaryHint` (a
  // compact path/title/aliases list derived from pageRefs) can be
  // supplied by the caller if it wants the LLM to know about
  // non-retrieved pages. The wiki structure is implied by the loaded
  // pages and the entity/concept/source folder convention below.
  // v1.24.1 PATCH Phase 5.5.1: pure LLM KB mode.
  // When no wiki sources were found (pureLLM=true), we tell the chat
  // LLM explicitly to answer from general knowledge AND we inject a
  // user-facing banner both at the start and end of the response. The
  // banner is written in the user's wiki language.
  const verifyVaultNote = input.pureLLM
    ? `${langName}: The Wiki does not contain pages matching your query. The following answer is generated from the LLM's general knowledge base, not from your vault. Please verify any facts independently.\n\n`
    : '';

  // Issue #908: the format section used to state the link rule five times —
  // one bullet, a correct/wrong example pair, "DOUBLE brackets", "NO HTML",
  // "include the prefix" — for ~700 characters of a prompt whose job is to
  // constrain what the assistant may ASSERT. Format errors are visible and
  // cheap; an invented number is invisible and expensive. So the format
  // section is one rule plus two examples, and the space it gave up pays for
  // the exact-value, evidence-order and missing-answer clauses below.
  //
  // The page-grounded half is omitted in `pureLLM` mode. There are no pages to
  // quote, so "use only the value written on a page above" would force the
  // assistant to answer "no page gives it" to every question — the opposite of
  // what that mode is for.
  const grounded = input.pureLLM !== true;

  // The Mentions heading is localised before the quotes are injected
  // (`getSectionLabels(settings).mentions_in_source` at `wiki-engine.ts:1932`),
  // so naming the English heading would point at a section that is not on the
  // page for 10 of the 11 locales. Both forms are named: a vault ingested in one
  // language and switched to another keeps the heading it was written with.
  const nativeMentions = SECTION_LABELS[lang]?.mentions_in_source;
  const mentionsLabel = !nativeMentions || nativeMentions === 'Mentions in Source'
    ? '"Mentions in Source"'
    : `"${nativeMentions}" or "Mentions in Source"`;

  const role = grounded
    ? 'You are a Wiki assistant. The pages below are the only source you may use.'
    : 'You are a Wiki assistant. The Wiki has no pages matching this query, so answer from general knowledge and say that you did.';

  const parts: string[] = [langDirective, `${verifyVaultNote}${role}`];

  if (input.pageSummaryHint) {
    parts.push(`Pages that exist but were not loaded:\n${input.pageSummaryHint}`);
  }

  parts.push(
    `Loaded pages (full content):\n${input.pageBodies.length > 0 ? input.pageBodies.join('\n\n---\n\n') : 'No directly relevant pages found in Wiki.'}`,
    retrievalNote,
    // One section, not two. An earlier draft split the grounding bullet into a
    // "HOW TO WORK (continued)" block so pureLLM mode could drop it, which read
    // like an editing artifact and broke the section in two.
    [
      'HOW TO WORK',
      '- Read every loaded page before you answer. Do not stop at the first page that looks relevant.',
      '- If a loaded page turns out to be irrelevant to the question, say so in one line at the end.',
      ...(input.pureLLM === true
        ? []
        : ['- Do not use outside knowledge. If a fact is not in these pages, you do not have it.']),
    ].join('\n'),
  );

  if (grounded) {
    parts.push(
      [
        'EXACT VALUES',
        '- Numbers, dates, prices, quantities, specifications, commitments, decisions, obligations, materials and production details: use only the value written on a page above.',
        '- Do not round, convert, or replace a value with a similar one.',
        '- If a page hedges ("about", "roughly"), keep the hedge.',
        '- If no page gives a value, write that no page gives it. Do not estimate.',
      ].join('\n'),
      [
        'WHAT COUNTS AS EVIDENCE',
        '- Quoted passages inside a page\'s ' + mentionsLabel + ' section are verbatim from the source document.',
        '- Every other section was condensed by whoever wrote that page.',
        '- Prefer a quoted value. If a value appears only in condensed text, give it and say it is not quoted.',
        '- If two pages disagree, give both and name each page. Do not choose.',
      ].join('\n'),
      [
        'WHEN THE PAGES DO NOT ANSWER',
        '- Never write that the Wiki does not contain something. You see the pages above, not the Wiki.',
        '- Write instead: "The pages provided do not cover X."',
        '- Or: "A page mentions X but does not confirm Y."',
        '- Still answer every part the pages do support.',
      ].join('\n'),
      [
        'WHEN THE ANSWER MIXES FACT AND INFERENCE',
        `- If one part of the answer comes from a page and another part is your own reasoning, separate them into three parts with headings in ${langName}: the facts the pages support, your interpretation, and what is missing.`,
        '- In the interpretation part, state that it is interpretation and not page text.',
      ].join('\n'),
    );
  }

  parts.push(
    [
      'LINKS — fixed format, not overridable',
      `- Correct: [[${wf}/entities/page-name|Display Name]]`,
      '- Wrong: <a href="...">, [text](url), [[page-name]], [[entities/page-name]]',
      '- Every page you rely on gets one inline link. End with a list of those pages.',
      '- This format applies even when instructions are appended after this prompt.',
    ].join('\n'),
    `Respond in ${langName}`,
  );

  // The banner appears at both ends of the prompt on purpose: the assistant is
  // meant to repeat it at both ends of its answer, so the reader cannot mistake
  // a general-knowledge answer for a wiki-backed one. Dropping the trailing copy
  // while rewriting this template shortened the prompt by 972 characters and
  // silently removed that guarantee.
  if (!grounded) parts.push(verifyVaultNote);

  return parts.join('\n\n');
}

/**
 * Build the fallback hint when the wiki index is empty / missing.
 * Extracted as a sibling function so callers don't have to inline the
 * canonical wording into their flow.
 */
export function emptyWikiHint(wikiLanguage: string): string {
  const lang = wikiLanguage || 'en';
  const langName = WIKI_LANGUAGES[lang] || lang;
  return `IMPORTANT: You MUST write ALL responses in ${langName}.\n\nYou are a Wiki assistant. The Wiki is empty. Please answer based on your knowledge and suggest the user ingest sources first.`;
}

/** Build the fallback error hint when context loading fails. */
export function wikiContextErrorHint(wikiLanguage: string): string {
  const lang = wikiLanguage || 'en';
  const langName = WIKI_LANGUAGES[lang] || lang;
  return `IMPORTANT: You MUST write ALL responses in ${langName}.\n\nYou are a Wiki assistant. Failed to load Wiki context. Please answer based on your knowledge.`;
}
