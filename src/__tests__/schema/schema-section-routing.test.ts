// The two free-text hints are Schema sections, and the Schema routes them.
//
// v1.27.3 shipped them as settings. `schema/config.md` already owned both texts
// — `## Content Rules` carries the plugin's own rules — and `TASK_SECTIONS`
// already delivered it to the extraction, generation and merge prompts. A
// settings copy was therefore a second store for one instruction, with no
// precedence rule between the two blocks the model receives.
//
// What that cost, concretely: `KvikullSigurdur` reported that a merge did not
// carry the requirement, and the cause was the second store — five merge
// templates, four of them missed. Under the Schema that defect cannot exist,
// because `TASK_SECTIONS.merge` already lists `Content Rules`. That is why this
// file replaces the two placeholder tests rather than adding to them: the
// placeholder (`{{content_requirements}}`) and the settings injection are gone,
// and what remains to verify is the routing and the file editing.
import { describe, expect, it } from 'vitest';
import {
  buildDefaultSchemaBody,
  extractSectionBody,
  replaceSectionBody,
} from '../../schema/schema-manager';
import { readFileSync } from 'node:fs';

const SCHEMA_MANAGER = readFileSync('src/schema/schema-manager.ts', 'utf8');

/** The `TASK_SECTIONS` table, read as data from the source that owns it. */
function taskSections(): Record<string, string[]> {
  const start = SCHEMA_MANAGER.indexOf('const TASK_SECTIONS');
  const end = SCHEMA_MANAGER.indexOf('};', start);
  const block = SCHEMA_MANAGER.slice(start, end);
  const out: Record<string, string[]> = {};
  for (const line of block.split('\n')) {
    const m = /^\s*(\w+):\s*\[([^\]]*)\]/.exec(line);
    if (!m) continue;
    out[m[1]] = m[2].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  }
  return out;
}

describe('the Schema is the only home for the two hints', () => {
  it('ships both sections in the default body', () => {
    const body = buildDefaultSchemaBody();
    expect(body).toContain('## Content Rules');
    expect(body).toContain('## Extraction Focus');
  });

  it('does not mention them in the settings type any more', () => {
    // The regression this guards: a future change re-adds a settings field for
    // text the Schema owns, and the two stores start to drift again.
    const types = readFileSync('src/types.ts', 'utf8');
    expect(types).not.toContain('extractionFocus');
    expect(types).not.toContain('contentRequirements');
  });

  it('routes Content Rules to every task that writes or reads a page body', () => {
    const routes = taskSections();
    for (const task of ['analyze', 'entity', 'concept', 'merge']) {
      expect(routes[task], `${task} must receive Content Rules`).toContain('Content Rules');
    }
  });

  it('routes Extraction Focus to extraction only', () => {
    // It is about what to look for while reading a source. A page-generation
    // prompt has nothing to look for, so sending it there is noise.
    const routes = taskSections();
    expect(routes.analyze).toContain('Extraction Focus');
    for (const task of ['entity', 'concept', 'merge', 'lint', 'related']) {
      expect(routes[task] ?? [], `${task} must not receive Extraction Focus`)
        .not.toContain('Extraction Focus');
    }
  });
});

describe('extractSectionBody / replaceSectionBody', () => {
  const BODY = `# Wiki Schema

Intro line.

## Content Rules
- first rule
- second rule

## Extraction Focus
Focus on people.

## Classification Rules
- type field
`;

  it('reads one section without its heading or the next section', () => {
    expect(extractSectionBody(BODY, 'Content Rules')).toBe('- first rule\n- second rule');
  });

  it('reads a section that sits at the end of the file', () => {
    expect(extractSectionBody(BODY, 'Classification Rules')).toBe('- type field');
  });

  it('returns empty for a heading the file does not have', () => {
    expect(extractSectionBody(BODY, 'Nonexistent')).toBe('');
  });

  it('replaces one section and leaves every other byte alone', () => {
    const next = replaceSectionBody(BODY, 'Extraction Focus', 'Focus on organisations.');

    expect(extractSectionBody(next, 'Extraction Focus')).toBe('Focus on organisations.');
    // The neighbours and the preamble are untouched — the user's schema is their
    // document, not our template.
    expect(next).toContain('Intro line.');
    expect(extractSectionBody(next, 'Content Rules')).toBe('- first rule\n- second rule');
    expect(extractSectionBody(next, 'Classification Rules')).toBe('- type field');
  });

  it('is a no-op round trip when the content is unchanged', () => {
    const same = extractSectionBody(BODY, 'Content Rules');
    expect(extractSectionBody(replaceSectionBody(BODY, 'Content Rules', same), 'Content Rules'))
      .toBe(same);
  });

  it('empties a section without eating the one after it', () => {
    const next = replaceSectionBody(BODY, 'Content Rules', '');
    expect(extractSectionBody(next, 'Content Rules')).toBe('');
    expect(extractSectionBody(next, 'Extraction Focus')).toBe('Focus on people.');
  });

  it('appends a section the file does not have yet', () => {
    // This is what lets an older vault gain `## Extraction Focus` without a
    // migration: the editor writes, the section appears, the routing picks it up.
    const next = replaceSectionBody('# Wiki Schema\n\n## Content Rules\n- a\n', 'Extraction Focus', 'People.');
    expect(extractSectionBody(next, 'Extraction Focus')).toBe('People.');
    expect(extractSectionBody(next, 'Content Rules')).toBe('- a');
  });
});
