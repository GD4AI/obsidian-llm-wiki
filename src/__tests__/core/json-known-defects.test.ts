// One-token defects a small model leaves in otherwise sound pretty-printed
// JSON, fixed before the parser spends a model call on them. Each case is the
// shape measured in real extraction responses (gemma-4-26b on LM Studio); the
// model repair regenerated the whole response for each of them, and one call
// in five ran to the token cap.

import { describe, it, expect, vi } from 'vitest';
import { parseJsonResult } from '../../core/json';

/** Parse with a repair callback that records whether it was reached. */
async function parse(text: string) {
  const repair = vi.fn(async () => { throw new Error('model repair reached'); });
  const result = await parseJsonResult(text, repair);
  return { result, repaired: repair.mock.calls.length > 0 };
}

const item = (lines: string) => `{
  "entities": [
    {
      "name": "Bradykinin",
      "summary": "Ein Peptid."
    },
    {
${lines}
    }
  ],
  "concepts": []
}`;

describe('parseJsonResult — known one-token defects, no model call', () => {
  it('a key that lost its closing quote: "name: "X"', async () => {
    const { result, repaired } = await parse(item(`      "name: "Ramipril",
      "summary": "Ein ACE-Hemmer."`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { name: 'Ramipril' }] } });
  });

  it('a key and a one-word value merged into one string: "coverage: named"', async () => {
    const { result, repaired } = await parse(item(`      "name": "Ramipril",
      "coverage: named",
      "summary": "Ein ACE-Hemmer."`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { coverage: 'named' }] } });
  });

  it('a key that lost its opening quote, bare or behind a stray = or |', async () => {
    const { result, repaired } = await parse(item(`      "name": "Ramipril",
      summary: "Ein ACE-Hemmer.",
      ="aliases": [],
|      "coverage": "named"`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({
      ok: true,
      value: { entities: [{}, { summary: 'Ein ACE-Hemmer.', aliases: [], coverage: 'named' }] },
    });
  });

  it('a value that lost its opening quote', async () => {
    const { result, repaired } = await parse(item(`      "name": "Ramipril",
      "summary": Ein ACE-Hemmer gegen Bluthochdruck.",
      "coverage": "named"`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { summary: 'Ein ACE-Hemmer gegen Bluthochdruck.' }] } });
  });

  it('a string that lost its closing quote at the end of its line', async () => {
    const { result, repaired } = await parse(item(`      "name": "Leitlinien",
      "mentions_in_source": [
        "Viele Autoren haben Pharma-Kontakte (Honorare, Beratung),
        "Der Nutzen überwiegt meist."
      ]`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({
      ok: true,
      value: { entities: [{}, { mentions_in_source: ['Viele Autoren haben Pharma-Kontakte (Honorare, Beratung)', 'Der Nutzen überwiegt meist.'] }] },
    });
  });

  it('a backslash JSON cannot escape: $\\alpha$ and a table pipe', async () => {
    const { result, repaired } = await parse(item(String.raw`      "name": "$\alpha$-Synuclein",
      "summary": "Siehe [[Vitamin K2\|K2]]."`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { name: String.raw`$\alpha$-Synuclein`, summary: String.raw`Siehe [[Vitamin K2\|K2]].` }] } });
  });

  it('an array closed with } instead of ]', async () => {
    const { result, repaired } = await parse(item(`      "name": "Pektin",
      "domains": [
        "Thema/Metabolismus"
      }`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { domains: ['Thema/Metabolismus'] }] } });
  });

  it('a stray full stop after a closing quote', async () => {
    const { result, repaired } = await parse(item(`      "name": "Darmbarriere",
      "mentions_in_source": [
        "Die Schleimhautbarriere wird durchlässig (Leaky Gut)".
      ]`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { mentions_in_source: ['Die Schleimhautbarriere wird durchlässig (Leaky Gut)'] }] } });
  });

  // On its own `escapeContentQuotes` already copes; next to a second defect
  // (as measured) it did not, and the model repair was called.
  it('a German quote closed with the ASCII quote, next to a second defect', async () => {
    const { result, repaired } = await parse(item(`      "name: "Cast-Nephropathie",
      "summary": "Die „Myelomniere" ist das häufigste Muster."`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { summary: 'Die „Myelomniere“ ist das häufigste Muster.' }] } });
  });

  // `fixCommonJsonIssues` ran `escapeContentQuotes` before its comma rule,
  // which escaped the very quote the rule needs.
  it('two properties on consecutive lines without the comma', async () => {
    const { result, repaired } = await parse(item(`      "name": "Eisenmangel",
      "summary": "Ein Zeichen für chronischen Eisenmangel."
      "mentions_in_source": ["Koilonychie."]`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { mentions_in_source: ['Koilonychie.'] }] } });
  });
});

describe('parseJsonResult — what the known-defect pass leaves alone', () => {
  it('reads $\\beta$ in valid JSON as a LaTeX command, not backspace + "eta"', async () => {
    // `\\alpha` and `\\kappa` are escaped correctly; `\beta` and `\rightarrow` are not.
    const { result } = await parse(String.raw`{"summary": "IKK$\\alpha/\beta$ und $\rightarrow$ NF-$\\kappa$B"}`);
    expect(result).toMatchObject({ ok: true, value: { summary: String.raw`IKK$\alpha/\beta$ und $\rightarrow$ NF-$\kappa$B` } });
  });

  it('keeps a real escape outside a $…$ span', async () => {
    const { result } = await parse('{"summary": "Zeile eins\\nbeta ist hier kein Befehl"}');
    expect(result).toMatchObject({ ok: true, value: { summary: 'Zeile eins\nbeta ist hier kein Befehl' } });
  });

  it('does not split a quote that begins with "Label: text" into a key and a value', async () => {
    const { result, repaired } = await parse(item(`      "name: "Psoriasis",
      "mentions_in_source": [
        "Therapie: Anti-TNF (Infliximab, Adalimumab)."
      ]`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { mentions_in_source: ['Therapie: Anti-TNF (Infliximab, Adalimumab).'] }] } });
  });

  it('does not read a quote that begins with "word: [[Link]]" as a key', async () => {
    const { result, repaired } = await parse(item(`      "name: "Vitamin D",
      "mentions_in_source": [
        "siehe: [[Vitamin D]] senkt das Risiko."
      ]`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { mentions_in_source: ['siehe: [[Vitamin D]] senkt das Risiko.'] }] } });
  });

  it('keeps an already escaped quote after „', async () => {
    const { result, repaired } = await parse(item(`      "name: "Alzheimer",
      "summary": "Oft als „Typ-3-Diabetes\\" bezeichnet."`));
    expect(repaired).toBe(false);
    expect(result).toMatchObject({ ok: true, value: { entities: [{}, { summary: 'Oft als „Typ-3-Diabetes" bezeichnet.' }] } });
  });

  it('still hands a truncated response to the model repair', async () => {
    const { result, repaired } = await parse('{\n  "entities": [\n    {\n      "name": "Bradykinin"\n    },\n    {\n      "name": "Ramipril",\n      "summary": "Ein ACE');
    expect(repaired).toBe(true);
    expect(result).toMatchObject({ ok: false });
  });
});
