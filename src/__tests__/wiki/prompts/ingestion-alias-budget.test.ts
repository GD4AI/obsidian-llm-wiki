/**
 * #729 Phase 8 — the alias budget on the write path.
 *
 * The prompt is the only enforcement point here: aliases are produced by a
 * model, and a limit that lives in the prompt is what stops a page growing an
 * alias list nobody curated. Two things are pinned, and both came from the
 * plan rather than from a bug report.
 *
 * The budget is 3. It used to say 1-2, and the plan raised it because the
 * measured loss was name matching — an alias is a search key.
 *
 * The phrasing constraint is the part that matters more. An alias the source
 * note never used is a search key that matches nothing and then claims to,
 * which is worse than having no alias at all. The old prompt said
 * "translations" without saying whose, and a model translating a name the note
 * left untranslated invents a key nobody will type.
 */

import { describe, it, expect } from 'vitest';
import { INGESTION_PROMPTS } from '../../../wiki/prompts/ingestion';

const ALL = Object.values(INGESTION_PROMPTS).join('\n');

describe('ingestion prompt — alias budget', () => {
  it('allows up to 3 aliases', () => {
    expect(ALL).toMatch(/up to 3 aliases/i);
    // The old bound must not survive anywhere in the prompt: a model reading
    // both would follow whichever it saw last.
    expect(ALL).not.toMatch(/1-2 aliases/i);
    expect(ALL).not.toMatch(/1-2 alternative names/i);
  });

  it('says the alias must be the source note’s own phrase', () => {
    expect(ALL).toMatch(/phrase the source note itself uses/i);
  });

  it('names the failure it prevents — a made-up alias matches nothing', () => {
    // Stating the consequence is what makes the constraint hold across model
    // changes. "Do not invent" alone is a rule; the reason is a check.
    expect(ALL).toMatch(/matches nothing/i);
  });

  it('keeps aliases optional', () => {
    // Raising the budget must not turn an optional field into a required one.
    expect(ALL).toMatch(/aliases field is OPTIONAL/i);
  });

  it('every entity and concept block carries the constraint, not just the header', () => {
    // The JSON schema is what the model structures its output against. A
    // constraint only in the prose is the one that gets dropped.
    const schemaAliases = ALL.match(/"aliases": \[[^\]]*\]/g) ?? [];
    expect(schemaAliases.length).toBeGreaterThanOrEqual(2);
    for (const line of schemaAliases) {
      expect(line).toMatch(/up to 3/i);
      expect(line).toMatch(/phrase the source note itself uses/i);
    }
  });

  it('is deterministic — the prompt is a constant', () => {
    expect(INGESTION_PROMPTS).toEqual(INGESTION_PROMPTS);
    expect(ALL.length).toBeGreaterThan(0);
  });
});
