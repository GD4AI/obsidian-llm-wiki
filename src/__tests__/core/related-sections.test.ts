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

  it('drops a name that resolves to the page being written (#676)', () => {
    // The shaper excludes the page's own NAME KEY before this stage, but an
    // alias or a differently-spelled title gets past that check and only the
    // resolver knows where the name points. Without this guard the renderer
    // wrote a self-link one stage later, which turns a known gap into a false
    // "resolved" state.
    const selfResolve = (n: string) => (n === 'Templater' ? 'entities/tp-obsidian-templater' : opts.resolve(n));
    const out = renderRelatedSections(page, ['Templater', 'Metformin'], [], E, C, {
      ...opts,
      resolve: selfResolve,
      selfPath: 'wiki/entities/tp-obsidian-templater.md',
    });
    expect(out).not.toContain('tp-obsidian-templater');
    expect(out).toContain('[[entities/Metformin|Metformin]]');
  });

  it('writes the same name when selfPath is not given', () => {
    // The guard is opt-in. Callers that do not know the page path keep their
    // behaviour; nothing silently changes shape.
    const selfResolve = (n: string) => (n === 'Templater' ? 'entities/tp-obsidian-templater' : opts.resolve(n));
    const out = renderRelatedSections(page, ['Templater'], [], E, C, { ...opts, resolve: selfResolve });
    expect(out).toContain('[[entities/tp-obsidian-templater|Templater]]');
  });
});

// Issue #664, first half — the list stops accepting NEW names at the budget ceiling.
//
// The thread settles the shape, and two of its three constraints are about what this
// change must NOT do: it does not prune, and it does not rank. A cut ranked by shared
// sources keeps the dead name and drops the cross-source page, so the ordering is
// #729 Phase 2's. What lands here bounds additions only, which turns unbounded growth
// into bounded growth without deciding which five survive.
describe('#664 — additions are bounded, entries are never dropped', () => {
  // A page that already carries three entries, rewritten with five names of which
  // three are new.
  const overCeiling = `# X\n\n## ${E}\n\n- [[entities/A|A]]\n- [[entities/B|B]]\n\n## ${C}\n\n- [[concepts/C|C]]\n`;

  it('keeps every entry the page already had, even when the ceiling is already passed', () => {
    // Lists over the ceiling stay over it until the truncation step runs. Dropping a
    // kept entry here would be the ranking decision this change is not allowed to make.
    const out = renderRelatedSections(overCeiling, ['D', 'E'], ['F'], E, C, { ...opts, keepFrom: overCeiling, ceiling: 3 });
    expect(out).toContain('- [[entities/A|A]]');
    expect(out).toContain('- [[entities/B|B]]');
    expect(out).toContain('- [[concepts/C|C]]');
  });

  it('accepts no new name once the ceiling is reached', () => {
    const out = renderRelatedSections(overCeiling, ['D', 'E'], ['F'], E, C, { ...opts, keepFrom: overCeiling, ceiling: 3 });
    expect(out, 'a new name was added past the ceiling').not.toContain('- [[entities/D|D]]');
    expect(out).not.toContain('- [[concepts/F|F]]');
  });

  it('still accepts new names while there is room, so a page under the ceiling is unaffected', () => {
    const one = `# X\n\n## ${E}\n\n- [[entities/A|A]]\n\n## ${C}\n`;
    const out = renderRelatedSections(one, ['B', 'C'], [], E, C, { ...opts, keepFrom: one, ceiling: 3 });
    expect(out).toContain('- [[entities/A|A]]');
    expect(out).toContain('- [[entities/B|B]]');
    expect(out).toContain('- [[entities/C|C]]');
  });

  it('counts the ceiling across both sections, because a page has one Related list', () => {
    const one = `# X\n\n## ${E}\n\n- [[entities/A|A]]\n\n## ${C}\n`;
    const out = renderRelatedSections(one, ['B'], ['C'], E, C, { ...opts, keepFrom: one, ceiling: 2 });
    expect(out).toContain('- [[entities/A|A]]');
    expect(out).toContain('- [[entities/B|B]]');
    expect(out, 'the ceiling was applied per section instead of per page').not.toContain('- [[concepts/C|C]]');
  });

  it('is opt-in: without a ceiling the union path behaves exactly as before', () => {
    const out = renderRelatedSections(overCeiling, ['D', 'E'], ['F'], E, C, { ...opts, keepFrom: overCeiling });
    expect(out).toContain('- [[entities/D|D]]');
    expect(out).toContain('- [[concepts/F|F]]');
  });
});

describe('#664 — a name refused by the ceiling is reportable', () => {
  it('hands the refused names to the caller instead of dropping them silently', () => {
    // The ceiling is silent by construction: nothing is written, so nothing shows on
    // the page. Without this the only way to learn why a name never appeared is to
    // read the code. The callback keeps `renderRelatedSections` pure — the caller
    // decides whether the fact is worth a line.
    const one = `# X\n\n## ${E}\n\n- [[entities/A|A]]\n\n## ${C}\n`;
    const dropped: string[] = [];
    renderRelatedSections(one, ['B', 'C'], ['D'], E, C, {
      ...opts,
      keepFrom: one,
      ceiling: 2,
      onRefused: (_section, names) => dropped.push(...names),
    });
    expect(dropped).toEqual(['C', 'D']);
  });

  it('reports nothing when the ceiling is not reached', () => {
    const one = `# X\n\n## ${E}\n\n- [[entities/A|A]]\n\n## ${C}\n`;
    const dropped: string[] = [];
    renderRelatedSections(one, ['B'], [], E, C, { ...opts, keepFrom: one, ceiling: 8, onRefused: (_s, n) => dropped.push(...n) });
    expect(dropped).toEqual([]);
  });
});

// Issue #664, second half — the projection has its own allowance.
//
// #1032 bounded additions, and @DocTpoint's replay found the side effect within a
// day: a projection is shaped LAST, so the ceiling refuses it FIRST. On a page whose
// kept entries already fill the budget, #729 Phase 1 added nothing — on that ingest
// and every later one. The signal that carries information from OTHER notes was the
// one the bound discarded.
//
// The projection therefore gets `projectedBudget` entries **above** the note ceiling
// rather than a share of it: a note-grounded name never loses a slot to a projection,
// and the page total (`ceiling + projection size`) stays the bound that keeps #664's
// growth from returning. Measured on the 2,141-page vault: 904 pages carry six or
// more entries, so a share-based split would have cost 43 % of them a new note name.
describe('#664 — a projection adds to the page instead of taking a note slot', () => {
  // Eight kept entries: the note side is full, so every note-grounded name arriving
  // now is refused — and this is the page the projection must still reach.
  const eight = `# X\n\n## ${E}\n\n- [[entities/A|A]]\n- [[entities/B|B]]\n- [[entities/C|C]]\n- [[entities/D|D]]\n\n## ${C}\n\n- [[concepts/E|E]]\n- [[concepts/F|F]]\n- [[concepts/G|G]]\n- [[concepts/H|H]]\n`;
  const seven = `# X\n\n## ${E}\n\n- [[entities/A|A]]\n- [[entities/B|B]]\n- [[entities/C|C]]\n- [[entities/D|D]]\n\n## ${C}\n\n- [[concepts/E|E]]\n- [[concepts/F|F]]\n- [[concepts/G|G]]\n`;
  const entries = (out: string) => (out.match(/^- \[\[/gm) ?? []).length;

  it('adds the projection above the note ceiling, so a note-grounded name keeps its slot', () => {
    const out = renderRelatedSections(seven, ['Fresh', 'P1'], [], E, C, {
      ...opts, keepFrom: seven, ceiling: 8, projected: { entities: ['P1'] }, projectedBudget: 3,
    });
    expect(out, 'a note-grounded name was refused for the projection').toContain('- [[entities/Fresh|Fresh]]');
    expect(out, 'the projection was refused').toContain('- [[entities/P1|P1]]');
    expect(entries(out)).toBe(9);
  });

  it('reaches a page whose note side is already full', () => {
    const out = renderRelatedSections(eight, ['Fresh', 'P1'], [], E, C, {
      ...opts, keepFrom: eight, ceiling: 8, projected: { entities: ['P1'] }, projectedBudget: 3,
    });
    expect(out, 'the projection was refused — #729 Phase 1 is starved again').toContain('- [[entities/P1|P1]]');
    expect(out).not.toContain('- [[entities/Fresh|Fresh]]');
    expect(entries(out)).toBe(9);
  });

  it('caps the addition at the tier budget when the projection is wider than it', () => {
    const out = renderRelatedSections(eight, ['P1', 'P2', 'P3', 'P4', 'P5'], [], E, C, {
      ...opts, keepFrom: eight, ceiling: 8, projected: { entities: ['P1', 'P2', 'P3', 'P4', 'P5'] }, projectedBudget: 3,
    });
    expect(out).toContain('- [[entities/P3|P3]]');
    expect(out, 'the projection added more than the tier allows').not.toContain('- [[entities/P4|P4]]');
    expect(entries(out)).toBe(11);
  });

  it('adds only what the projection produced, not the whole budget', () => {
    const one = renderRelatedSections(eight, ['P1', 'P2'], [], E, C, {
      ...opts, keepFrom: eight, ceiling: 8, projected: { entities: ['P1'] }, projectedBudget: 3,
    });
    expect(one).toContain('- [[entities/P1|P1]]');
    expect(one, 'the page grew by the tier budget instead of by the projection').not.toContain('- [[entities/P2|P2]]');
    expect(entries(one)).toBe(9);
  });

  it('stops growing once the note ceiling and the projection allowance are both spent', () => {
    const full = `# X\n\n## ${E}\n\n- [[entities/A|A]]\n- [[entities/B|B]]\n- [[entities/C|C]]\n- [[entities/D|D]]\n\n## ${C}\n\n- [[concepts/E|E]]\n- [[concepts/F|F]]\n- [[concepts/G|G]]\n- [[concepts/H|H]]\n- [[entities/P0|P0]]\n- [[entities/P1|P1]]\n- [[entities/P2|P2]]\n`;
    const out = renderRelatedSections(full, ['Fresh', 'P3'], [], E, C, {
      ...opts, keepFrom: full, ceiling: 8, projected: { entities: ['P3'] }, projectedBudget: 3,
    });
    expect(out).not.toContain('- [[entities/P3|P3]]');
    expect(out).not.toContain('- [[entities/Fresh|Fresh]]');
    expect(entries(out)).toBe(11);
  });

  it('counts a projected name once, when the page already carries it', () => {
    const out = renderRelatedSections(seven, ['A', 'P1'], [], E, C, {
      ...opts, keepFrom: seven, ceiling: 8, projected: { entities: ['P1'] }, projectedBudget: 3,
    });
    expect((out.match(/\|A\]\]/g) ?? []).length).toBe(1);
    expect(out).toContain('- [[entities/P1|P1]]');
  });

  it('is opt-in: without a projection the note-grounded side fills its ceiling as before', () => {
    const out = renderRelatedSections(seven, ['Fresh'], [], E, C, { ...opts, keepFrom: seven, ceiling: 8 });
    expect(out).toContain('- [[entities/Fresh|Fresh]]');
    expect(entries(out)).toBe(8);
  });

  it('reports the refused note-grounded names, so the trace still says what was cut', () => {
    const refused: string[] = [];
    renderRelatedSections(eight, ['Fresh'], [], E, C, {
      ...opts, keepFrom: eight, ceiling: 8, projected: { entities: ['P1'] }, projectedBudget: 3,
      onRefused: (_s, names) => refused.push(...names),
    });
    expect(refused).toEqual(['Fresh']);
  });
});
