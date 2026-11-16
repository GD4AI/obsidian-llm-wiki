// Issue #1038 — `sources:` means the opposite thing on a source page.
//
// On `entities/` and `concepts/` the key lists the source pages that support the
// page: upstream. The schema told the model that on `sources/` the same key lists
// "the pages created from this source": downstream, and duplicative of both
// `source_file:` and the body's Key Entities / Key Concepts sections.
//
// The cost was not the graph (0.9 % extra edges on the vault that carries it most).
// It was provenance: `originNoteRefs` reads `source_file` AND every `sources:` entry
// as "the notes this page came from", so a second entry made the origin ambiguous and
// `noteDriftState` answered `unknown` — drift detection off on 6 of 18 source pages
// in `test10`, one third of that vault.
import { describe, expect, it } from 'vitest';
import { enforceFrontmatterConstraints, parseFrontmatter } from '../../core/frontmatter';
import { buildDefaultSchemaBody } from '../../schema/schema-manager';

const sourcePage = (sources: string[]) => [
  '---',
  'type: source',
  'source_file: "[[Notizen/Beitrag]]"',
  'sources:',
  ...sources.map(s => `  - "${s}"`),
  'tags: [paper]',
  '---',
  '# Beitrag',
  '',
  '## Key Entities',
  '',
  '- [[entities/Obsidian|Obsidian]]',
].join('\n');

const entityPage = (sources: string[]) => [
  '---',
  'type: entity',
  'sources:',
  ...sources.map(s => `  - "${s}"`),
  'tags: [tool]',
  '---',
  '# Obsidian',
  '',
  'body',
].join('\n');

describe('#1038 — a source page does not carry `sources:`', () => {
  it('drops the field on a source page', () => {
    const out = enforceFrontmatterConstraints(sourcePage(['[[entities/Obsidian]]', '[[concepts/PKM]]']), 'source');
    expect(parseFrontmatter(out)?.sources).toBeUndefined();
  });

  it('keeps `source_file:`, because that is the page’s real origin', () => {
    const out = enforceFrontmatterConstraints(sourcePage(['[[entities/Obsidian]]']), 'source');
    expect(parseFrontmatter(out)?.source_file).toBe('[[Notizen/Beitrag]]');
  });

  it('keeps the body, because the downstream pages are the body’s job', () => {
    const out = enforceFrontmatterConstraints(sourcePage(['[[entities/Obsidian]]']), 'source');
    expect(out).toContain('- [[entities/Obsidian|Obsidian]]');
    expect(out).toContain('## Key Entities');
  });

  it('keeps `sources:` on an entity page, where it points upstream', () => {
    const out = enforceFrontmatterConstraints(entityPage(['[[sources/a_aaa]]']), 'entity');
    expect(parseFrontmatter(out)?.sources).toEqual(['[[sources/a_aaa]]']);
  });

  it('keeps `sources:` on a concept page', () => {
    const out = enforceFrontmatterConstraints(entityPage(['[[sources/a_aaa]]']).replace('type: entity', 'type: concept'), 'concept');
    expect(parseFrontmatter(out)?.sources).toEqual(['[[sources/a_aaa]]']);
  });

  it('does not offer the field in the schema the model reads', () => {
    // The instruction is why the field exists at all: the model was told to write
    // it. Removing the constraint without removing the instruction would leave the
    // model producing a value this code then silently discards.
    const schema = buildDefaultSchemaBody();
    const sourceSection = schema.slice(schema.indexOf('## Source Page Template'));
    expect(sourceSection).not.toContain('array of related wiki page links created from this source');
  });
});
