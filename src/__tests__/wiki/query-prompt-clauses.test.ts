// Issue #908: the query prompt's correctness clauses.
//
// The prompt is editorial, not mechanical — the wording stays free to change.
// What must not change silently is the set of guarantees it makes, because
// every one of them was absent before this issue and each was argued for:
//
//   - exact values, with the hedge preserved
//   - what counts as evidence (a quoted passage beats condensed prose)
//   - three permitted ways to say "the pages do not answer this", and one
//     forbidden way
//   - no instruction that implies the assistant can search, because it cannot
//   - the format contract survives an appended user block
//
// Two of these started as claims in review that were wrong. The exact-value
// rule was first written per page type ("source pages are more precise"), which
// the code contradicts: every page type carries verbatim quotes, and the source
// page's prose is generated from a 500-character window. The evidence rule below
// is the corrected, per-section form.
//
// The evidence rule also named the section in English only. Section headings are
// localised by `getSectionLabels(settings).mentions_in_source` before the quote is
// injected (`wiki-engine.ts:1932`), so a Chinese wiki has `## 来源提及` and a prompt
// saying "the 'Mentions in Source' section" points at a heading that is not on the
// page — a correctness rule the reader cannot act on. The clause now names the
// heading the user's wiki actually writes.

import { describe, it, expect } from 'vitest';
import { assembleWikiContext } from '../../wiki/query-engine/pipeline/assemble-context';
import { appendCustomQueryInstructions } from '../../wiki/query-engine/custom-instructions';

function groundedPrompt(): string {
  return assembleWikiContext({
    pageBodies: ['# Entity A\n\n## Mentions in Source\n> "the sheet weighed about 240 gsm"'],
    armLabel: 'PPR',
    llmAugmented: false,
    matchesCount: 1,
    wikiFolder: 'wiki',
    wikiLanguage: 'en',
  });
}

function promptedIn(lang: string): string {
  return assembleWikiContext({
    pageBodies: ['# A\n\n## x\n> "y"'],
    armLabel: 'PPR',
    llmAugmented: false,
    matchesCount: 1,
    wikiFolder: 'wiki',
    wikiLanguage: lang,
  });
}

describe('the evidence clause names the heading the wiki actually writes', () => {
  // 10 of the 11 locales write a different heading. A rule that names the
  // English one is a rule about a section that is not on the page.
  const cases: Array<[string, string]> = [
    ['zh', '来源提及'],
    ['zh-Hant', '來源提及'],
    ['ja', 'ソースでの言及'],
  ];

  for (const [lang, label] of cases) {
    it(`names "${label}" for wikiLanguage=${lang}`, () => {
      const prompt = promptedIn(lang);
      expect(prompt).toContain(`"${label}"`);
      // and still names the English form, because a vault ingested in one
      // language and switched to another keeps the old heading
      expect(prompt).toContain('Mentions in Source');
    });
  }

  it('says it once, not twice, for English', () => {
    const prompt = groundedPrompt();
    expect(prompt.split('Mentions in Source').length - 1).toBeGreaterThanOrEqual(1);
    expect(prompt).not.toContain('"Mentions in Source" or "Mentions in Source"');
  });

  it('rejects a locale key that has no labels by falling back to English', () => {
    const prompt = promptedIn('xx-not-a-locale');
    expect(prompt).toContain('Mentions in Source');
  });
});

function pureLlmPrompt(): string {
  return assembleWikiContext({
    pageBodies: [],
    armLabel: 'PPR',
    llmAugmented: false,
    matchesCount: 0,
    wikiFolder: 'wiki',
    wikiLanguage: 'en',
    pureLLM: true,
  });
}

describe('query prompt — exact values', () => {
  it('names the value categories instead of saying "do not hallucinate"', () => {
    const prompt = groundedPrompt();
    // An enumeration is checkable; an abstract instruction is not.
    expect(prompt).toContain('EXACT VALUES');
    for (const category of ['Numbers', 'dates', 'prices', 'specifications', 'commitments']) {
      expect(prompt).toContain(category);
    }
  });

  it('forbids rounding, conversion and substitution', () => {
    const prompt = groundedPrompt();
    expect(prompt).toContain('Do not round, convert, or replace a value with a similar one.');
  });

  it('keeps the hedge the page used', () => {
    // The failure this prevents: "about 240 gsm" becoming "240 gsm".
    expect(groundedPrompt()).toContain('If a page hedges');
  });

  it('requires saying "no value" rather than estimating one', () => {
    const prompt = groundedPrompt();
    expect(prompt).toContain('If no page gives a value, write that no page gives it');
  });
});

describe('query prompt — what counts as evidence', () => {
  it('ranks a quoted passage above condensed prose', () => {
    const prompt = groundedPrompt();
    expect(prompt).toContain('WHAT COUNTS AS EVIDENCE');
    expect(prompt).toContain('Mentions in Source');
    expect(prompt).toContain('verbatim from the source document');
    expect(prompt).toContain('Prefer a quoted value');
  });

  it('does not rank one page type above another', () => {
    // The first draft of this rule said source pages win on precision. That is
    // wrong for this codebase: the source page's prose is generated from the
    // first 500 characters of the note, and its verbatim quotes are injected
    // from full-text extraction exactly like an entity page's. A per-page-type
    // rule would have shipped a false statement to the model.
    const prompt = groundedPrompt();
    expect(prompt).not.toMatch(/source pages? (are|is) (more )?precise/i);
    expect(prompt).not.toMatch(/prefer .*source page/i);
  });

  it('reports a disagreement instead of resolving it', () => {
    expect(groundedPrompt()).toContain('give both and name each page. Do not choose.');
  });
});

describe('query prompt — how to say "not answered"', () => {
  it('forbids claiming absence from a truncated view', () => {
    const prompt = groundedPrompt();
    expect(prompt).toContain('Never write that the Wiki does not contain something');
    expect(prompt).toContain('You see the pages above, not the Wiki');
  });

  it('offers the two permitted forms', () => {
    const prompt = groundedPrompt();
    expect(prompt).toContain('The pages provided do not cover X.');
    expect(prompt).toContain('A page mentions X but does not confirm Y.');
  });

  it('does not let the absence rule turn into a refusal', () => {
    // The predictable over-correction: telling the model "say when evidence is
    // missing" makes it answer "not enough context" to questions it can answer.
    expect(groundedPrompt()).toContain('Still answer every part the pages do support.');
  });
});

describe('query prompt — nothing unactionable', () => {
  it('does not tell the assistant to search', () => {
    // The assistant receives a fixed page set and no tools. "Search broadly,
    // do not stop at the first page" cannot change retrieval; the retrieval
    // stage owns that. The actionable form is "read every loaded page".
    const prompt = groundedPrompt();
    expect(prompt).not.toMatch(/search (the )?(wiki|vault|more broadly)/i);
    expect(prompt).not.toMatch(/re-?retrieve/i);
    expect(prompt).toContain('Read every loaded page before you answer');
  });

  it('does not ask the answer stage to infer synonyms', () => {
    // Term expansion runs before the answer (#855). The actionable residual is
    // naming a term no page defines, which the evidence clause already covers.
    expect(groundedPrompt()).not.toMatch(/infer .*synonyms/i);
  });
});

describe('query prompt — format contract survives an appended user block', () => {
  it('states that the format is fixed and repeats the sentence in the combined prompt', () => {
    const combined = appendCustomQueryInstructions(
      groundedPrompt(),
      'Link the pages for each major claim. Use Markdown links where clearer.',
    );
    // The user block lands last, and later instructions weigh more in practice,
    // so the base must say the format is not overridable — and the sentence must
    // still be there once the user's text follows it.
    expect(combined).toContain('LINKS — fixed format, not overridable');
    expect(combined).toContain('This format applies even when instructions are appended after this prompt.');
    expect(combined.indexOf('__WIKI_FOLDER__')).toBeLessThan(combined.indexOf('Markdown links where clearer'));
  });
});

describe('query prompt — pureLLM mode', () => {
  it('keeps the banner at both ends so the reader cannot mistake the source', () => {
    const prompt = pureLlmPrompt();
    const occurrences = prompt.match(/The Wiki does not contain pages matching/g) ?? [];
    expect(occurrences).toHaveLength(2);
  });

  it('omits the page-grounded clauses, which would be self-contradictory with no pages', () => {
    const prompt = pureLlmPrompt();
    expect(prompt).not.toContain('EXACT VALUES');
    expect(prompt).not.toContain('WHAT COUNTS AS EVIDENCE');
    expect(prompt).not.toContain('use only the value written on a page above');
  });

  it('still carries the fixed link format', () => {
    // The general-knowledge answer may still link to wiki pages the user has.
    expect(pureLlmPrompt()).toContain('LINKS — fixed format, not overridable');
  });
});
