// Both `new_schema_body`'s description and the `suggestions` field must consistently read as a proposal that hasn't been applied yet — nothing is applied until the user clicks Apply.

import { describe, it, expect } from 'vitest';
import { GENERATION_PROMPTS } from '../../../wiki/prompts/generation';

describe('suggestSchemaUpdate prompt — proposal voice (#594)', () => {
  const tpl = GENERATION_PROMPTS.suggestSchemaUpdate;

  it('does not phrase new_schema_body or the CRITICAL restatement as already-applied', () => {
    expect(tpl).not.toContain('after the update');
    expect(tpl).not.toContain('schema after your changes');
  });

  it('new_schema_body description signals a not-yet-applied proposal', () => {
    expect(tpl).toContain('as it would read IF this proposal were accepted');
    expect(tpl).toContain('Nothing has been applied yet');
  });

  it('the CRITICAL restatement uses the same not-yet-applied framing as the field description', () => {
    expect(tpl).toContain('as it would read IF this proposal were accepted — not a diff, not a patch, and not yet applied');
  });

  it('suggestions field carries an explicit proposal-voice instruction', () => {
    expect(tpl).toContain('Phrase this as a proposal that has not been applied yet');
    expect(tpl).toContain('never past tense');
  });
});
