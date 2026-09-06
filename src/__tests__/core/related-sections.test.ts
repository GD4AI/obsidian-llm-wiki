// See core/related-sections.ts.
import { describe, it, expect } from 'vitest';
import { renderRelatedSections } from '../../core/related-sections';

const vault = new Map([['metformin', 'entities/Metformin'], ['oxidativer-stress', 'concepts/Oxidativer-Stress']]);
const opts = { preserveCase: true, resolve: (n: string) => vault.get(n.toLowerCase().replace(/\s+/g, '-')) };
const E = 'Verwandte Entitäten'; const C = 'Verwandte Konzepte';

const page = [
  '# Berberin', '', '## Beschreibung', '', 'Text mit [[entities/Metformin|Metformin]].', '',
  `## ${E}`, '', '- [[entities/Metformin|Metformin]]', '- [[entities/Vitamine/Vitamin C|Vitamin C]]', '',
  `## ${C}`, '', '- [[concepts/Oxidativer_Stress|Oxidativer Stress]]', '',
  '## Erwähnungen in der Quelle', '', '- "…"', '',
].join('\n');

describe('renderRelatedSections', () => {
  it('writes both sections from the lists: vault path when known, planned path otherwise, name as display', () => {
    const out = renderRelatedSections(page, ['Metformin', 'Vitamin C'], ['Oxidativer Stress', 'H₂O₂'], E, C, opts);
    expect(out).toContain(`## ${E}\n\n- [[entities/Metformin|Metformin]]\n- [[entities/Vitamin-C|Vitamin C]]\n\n## ${C}\n\n- [[concepts/Oxidativer-Stress|Oxidativer Stress]]\n- [[concepts/H₂O₂|H₂O₂]]\n\n## Erwähnungen`);
    expect(out).not.toContain('Vitamine/Vitamin C');
    expect(out).toContain('Text mit [[entities/Metformin|Metformin]].');
  });

  it('drops what the model added on its own — the list is the source of truth', () => {
    const out = renderRelatedSections(page, ['Metformin'], [], E, C, opts);
    expect(out).toContain(`## ${E}\n\n- [[entities/Metformin|Metformin]]\n\n## ${C}\n\n## Erwähnungen`);
  });

  it('keeps the entries the page had before a rewrite, in front, re-resolved, without duplicates', () => {
    const before = `# Berberin\n\n## ${E}\n\n- [[entities/Statine|Statine]]\n- [[entities/metformin|Metformin]]\n\n## ${C}\n`;
    const out = renderRelatedSections(page, ['Metformin', 'Vitamin C'], [], E, C, { ...opts, keepFrom: before });
    expect(out).toContain(`## ${E}\n\n- [[entities/Statine|Statine]]\n- [[entities/Metformin|Metformin]]\n- [[entities/Vitamin-C|Vitamin C]]\n`);
  });

  it('lists one target once across both sections — a kept entry follows its page when the folder changed', () => {
    // Bar was linked as a concept; the vault now holds it as an entity and the new list names it as one.
    const resolve = (n: string) => (n === 'Bar' ? 'entities/Bar' : opts.resolve(n));
    const before = `# X\n\n## ${E}\n\n## ${C}\n\n- [[concepts/Bar|Bar]]\n- [[concepts/Baz|Baz]]\n`;
    const out = renderRelatedSections(page, ['Bar'], ['Baz'], E, C, { ...opts, resolve, keepFrom: before });
    expect(out).toContain(`## ${E}\n\n- [[entities/Bar|Bar]]\n\n## ${C}\n\n- [[concepts/Baz|Baz]]\n`);
    expect(out.match(/\|Bar\]\]/g)).toHaveLength(1);
  });

  it('compares a kept entry and a new name under one key regardless of Unicode form', () => {
    const nfd = 'Häm-a₃'.normalize('NFD'); const nfc = 'Häm-a₃'.normalize('NFC');
    const before = `# X\n\n## ${E}\n\n- [[entities/${nfd}|${nfd}]]\n`;
    const out = renderRelatedSections(page, [nfc], [], E, C, { ...opts, keepFrom: before });
    expect((out.match(/^- \[\[/gm) ?? []).length).toBe(1);
  });

  it('finds a Related heading the canonicalizer would snap — the kept entries survive a lowercase label', () => {
    const before = `# X\n\n## Related entities\n\n- [[entities/Statine|Statine]]\n`;
    const out = renderRelatedSections(page, ['Metformin'], [], E, C, { ...opts, keepFrom: before });
    expect(out).toContain(`## ${E}\n\n- [[entities/Statine|Statine]]\n- [[entities/Metformin|Metformin]]\n`);
  });

  it('inserts a missing section next to its sibling, or at the end', () => {
    const noSections = '# Berberin\n\n## Beschreibung\n\nText.\n';
    const out = renderRelatedSections(noSections, ['Metformin'], ['Oxidativer Stress'], E, C, opts);
    expect(out).toBe(`# Berberin\n\n## Beschreibung\n\nText.\n\n## ${E}\n\n- [[entities/Metformin|Metformin]]\n\n## ${C}\n\n- [[concepts/Oxidativer-Stress|Oxidativer Stress]]\n`);
  });

  it('inserts missing sections in the order the page kind lists them — concepts first on a concept page', () => {
    const noSections = '# X\n\n## Beschreibung\n\nText.\n';
    const out = renderRelatedSections(noSections, ['Metformin'], ['Oxidativer Stress'], E, C, { ...opts, firstSection: 'concepts' });
    expect(out).toBe(`# X\n\n## Beschreibung\n\nText.\n\n## ${C}\n\n- [[concepts/Oxidativer-Stress|Oxidativer Stress]]\n\n## ${E}\n\n- [[entities/Metformin|Metformin]]\n`);
  });

  it('recognises the canonical English headers and rewrites them under the localized label', () => {
    const en = '# X\n\n## Related Entities\n\n- [[entities/Foo|Foo]]\n\n## Related Concepts\n\n- [[concepts/Bar|Bar]]\n';
    const out = renderRelatedSections(en, ['Metformin'], [], E, C, opts);
    expect(out).toBe(`# X\n\n## ${E}\n\n- [[entities/Metformin|Metformin]]\n\n## ${C}\n\n`);
  });
});
