// Pure-function tests for hub-link-distinctiveness.ts
//
// Contract (v1.23.0 P1-6, Issue #157 / #175):
//
//   scoreHubLinkDistinctiveness(graph, hubNode, relatedTargets, options?)
//     → Map<target, number>  // distinctiveness in [0, 1]
//
//   scanHubLinkDensity(pageMap, graph, options?)
//     → HubLinkDensityIssue[]
//
//   HubLinkDensityIssue = {
//     pagePath: string
//     inDegree: number
//     totalRelatedLinks: number
//     distinctivenessScore: number  // mean distinctiveness of all targets
//     recommendation: 'strip' | 'review' | 'keep'
//     lowDistinctivenessTargets: string[]
//   }
//
//   options:
//     minInDegree?: number (default 2) — hub threshold, delegates to detectHubs
//     stripThreshold?: number (default 0.3)
//     reviewThreshold?: number (default 0.5)
//     numWalks?: number (default 500)
//     maxSteps?: number (default 30)
//     rng?: () => number — for deterministic tests
//
// Algorithm (per #198 P1-6 design, 2026-06-29):
//   1. detectHubs(graph) → identify hub pages
//   2. For each hub page, parse ## Related section for [[link]] targets.
//   3. For each target, compute "redundancy" = mean PPR(target | seed=u)
//      for u in other targets. Higher redundancy = lower distinctiveness.
//   4. distinctiveness = 1 - normalized(redundancy).
//   5. recommendation: strip if mean < 0.3, review if < 0.5, else keep.

import { describe, it, expect } from 'vitest';
import {
  scoreHubLinkDistinctiveness,
  scanHubLinkDensity,
  stripLowDistinctivenessLinks,
  type HubLinkDensityIssue,
} from '../../core/hub-link-distinctiveness';
import { buildGraphFromContent } from '../../core/build-graph';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Graph } from '../../core/monte-carlo-ppr';
import { makeRng } from '../__support__/rng';

function graph(edges: Array<[string, string[]]>): Graph {
  return {
    nodes: Array.from(new Set(edges.flatMap(([from, tos]) => [from, ...tos]))),
    edges: new Map(edges),
  };
}

function pageMap(pages: Array<{ path: string; content: string }>): Map<string, { path: string; content: string; basename: string }> {
  const m = new Map<string, { path: string; content: string; basename: string }>();
  for (const p of pages) {
    m.set(p.path, { path: p.path, content: p.content, basename: p.path.split('/').pop() ?? p.path });
  }
  return m;
}

const DETERMINISTIC_PPR = { numWalks: 500, maxSteps: 30, rng: makeRng(1) } as const;

// ─── scoreHubLinkDistinctiveness — direct unit tests ──────────────────────

describe('scoreHubLinkDistinctiveness — the score is a function, not a lottery', () => {
  // Every other test in this file passes an explicit `rng`, so the production
  // default was never exercised: `personalizedPageRank` falls back to
  // `Math.random`, so the same page scored a different distinctiveness on
  // every run — and a distinctiveness below the threshold is what makes the
  // lint strip a link.
  it('gives the same score for the same graph when the caller supplies no rng', () => {
    const g = graph([
      ['Hub', ['A', 'B', 'C']],
      ['A', ['B']],
      ['B', ['C']],
      ['C', ['A']],
    ]);
    const options = { numWalks: 200, maxSteps: 30 };
    const first = scoreHubLinkDistinctiveness(g, 'Hub', ['A', 'B', 'C'], options);
    const second = scoreHubLinkDistinctiveness(g, 'Hub', ['A', 'B', 'C'], options);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });
});

describe('scoreHubLinkDistinctiveness — single target', () => {
  it('returns distinctiveness=1 for single target (no comparison set)', () => {
    const g = graph([['A', ['B']]]);
    const result = scoreHubLinkDistinctiveness(g, 'A', ['B'], DETERMINISTIC_PPR);
    expect(result.get('B')).toBe(1.0);
  });

  it('returns empty map for empty target list', () => {
    const g = graph([['A', ['B']]]);
    const result = scoreHubLinkDistinctiveness(g, 'A', [], DETERMINISTIC_PPR);
    expect(result.size).toBe(0);
  });
});

describe('scoreHubLinkDistinctiveness — unrelated targets', () => {
  it('high distinctiveness when targets have no mutual reachability', () => {
    // Hub links to 3 leaves, leaves don't link to each other.
    const g = graph([
      ['Hub', ['A', 'B', 'C']],
    ]);
    const result = scoreHubLinkDistinctiveness(g, 'Hub', ['A', 'B', 'C'], DETERMINISTIC_PPR);
    expect(result.size).toBe(3);
    for (const [, score] of result) {
      expect(score).toBeGreaterThan(0.5);
    }
  });
});

describe('scoreHubLinkDistinctiveness — clustered targets', () => {
  it('low distinctiveness when targets are densely interconnected', () => {
    // Hub links to 3 nodes that all link to each other (tight cluster).
    const g = graph([
      ['Hub', ['A', 'B', 'C']],
      ['A', ['B', 'C', 'Hub']],
      ['B', ['A', 'C', 'Hub']],
      ['C', ['A', 'B', 'Hub']],
    ]);
    const result = scoreHubLinkDistinctiveness(g, 'Hub', ['A', 'B', 'C'], DETERMINISTIC_PPR);
    expect(result.size).toBe(3);
    // A, B, C are mutually reachable → redundancy is high → distinctiveness is low.
    for (const [, score] of result) {
      expect(score).toBeLessThan(0.5);
    }
  });

  it('one isolated target in a clustered set is highly distinctive', () => {
    // Hub links to A, B, C. A and B form a cluster; C is a leaf.
    const g = graph([
      ['Hub', ['A', 'B', 'C']],
      ['A', ['B', 'Hub']],
      ['B', ['A', 'Hub']],
      // C has no other edges.
    ]);
    const result = scoreHubLinkDistinctiveness(g, 'Hub', ['A', 'B', 'C'], DETERMINISTIC_PPR);
    const cScore = result.get('C')!;
    const aScore = result.get('A')!;
    // C is more distinctive than A (which is redundant with B).
    expect(cScore).toBeGreaterThan(aScore);
  });
});

// ─── scanHubLinkDensity — page-level scanner ─────────────────────────────

describe('scanHubLinkDensity — empty / trivial inputs', () => {
  it('returns empty array for empty pageMap', () => {
    const g = graph([]);
    const result = scanHubLinkDensity(new Map(), g);
    expect(result).toEqual([]);
  });

  it('returns empty array when no hubs detected', () => {
    // All nodes have in-degree < 2 → no hubs.
    const g = graph([['A', ['B']]]);
    const pm = pageMap([
      { path: 'A', content: 'No related section.' },
      { path: 'B', content: 'No related section.' },
    ]);
    const result = scanHubLinkDensity(pm, g);
    expect(result).toEqual([]);
  });

  it('skips pages without ## Related section', () => {
    // C is a hub (in-degree 3) but has no ## Related section.
    const g = graph([
      ['A', ['C']],
      ['B', ['C']],
      ['D', ['C']],
    ]);
    const pm = pageMap([
      { path: 'A', content: '## Description\nA page' },
      { path: 'B', content: '## Description\nB page' },
      { path: 'D', content: '## Description\nD page' },
      { path: 'C', content: '## Description\nC is a hub but no Related section.' },
    ]);
    const result = scanHubLinkDensity(pm, g);
    expect(result).toEqual([]);
  });
});

describe('scanHubLinkDensity — ## Related parsing', () => {
  it('extracts [[link]] targets from ## Related section', () => {
    const g = graph([
      ['A', ['Hub', 'B', 'C']],
      ['B', ['Hub', 'A']],
      ['C', ['Hub', 'A']],
    ]);
    const pm = pageMap([
      { path: 'A', content: '## Description\nA page' },
      { path: 'B', content: '## Description\nB page' },
      { path: 'C', content: '## Description\nC page' },
      { path: 'Hub', content: '## Description\nA hub\n\n## Related\n- See [[A]]\n- See [[B]]\n- See [[C]]' },
    ]);
    const result = scanHubLinkDensity(pm, g);
    expect(result.length).toBe(1);
    expect(result[0].pagePath).toBe('Hub');
    expect(result[0].totalRelatedLinks).toBe(3);
  });

  it('ignores links outside ## Related section', () => {
    const g = graph([
      ['A', ['Hub', 'B', 'C']],
      ['B', ['Hub']],
      ['C', ['Hub']],
    ]);
    const pm = pageMap([
      { path: 'A', content: '## Description\nMentions [[Hub]] here.' },
      { path: 'B', content: '## Description\nB page' },
      { path: 'C', content: '## Description\nC page' },
      // Hub has 1 link in Related (A) and 1 link in Description (B). Only A counts.
      { path: 'Hub', content: '## Description\nA hub mentions [[B]]\n\n## Related\n- [[A]]' },
    ]);
    const result = scanHubLinkDensity(pm, g);
    expect(result.length).toBe(1);
    expect(result[0].totalRelatedLinks).toBe(1);
  });
});

describe('scanHubLinkDensity — recommendation tiers', () => {
  it('recommends keep when distinctiveness is high', () => {
    // Hub links to 3 leaves. To make Hub a hub (in-degree >= 2), other
    // pages also link back. Leaves don't link to each other → high
    // distinctiveness.
    const g = graph([
      ['Hub', ['A', 'B', 'C']],
      ['X', ['Hub', 'A']],
      ['Y', ['Hub', 'B']],
    ]);
    const pm = pageMap([
      { path: 'A', content: '## Description\nA' },
      { path: 'B', content: '## Description\nB' },
      { path: 'C', content: '## Description\nC' },
      { path: 'X', content: '## Description\nX' },
      { path: 'Y', content: '## Description\nY' },
      { path: 'Hub', content: '## Description\nhub\n\n## Related\n- [[A]]\n- [[B]]\n- [[C]]' },
    ]);
    const result = scanHubLinkDensity(pm, g, { ...DETERMINISTIC_PPR });
    expect(result.length).toBe(1);
    expect(result[0].recommendation).toBe('keep');
    expect(result[0].distinctivenessScore).toBeGreaterThan(0.5);
    expect(result[0].lowDistinctivenessTargets.length).toBe(0);
  });

  it('recommends strip when distinctiveness is low', () => {
    // Hub links to 3 tightly clustered nodes (all link to each other).
    const g = graph([
      ['Hub', ['A', 'B', 'C']],
      ['A', ['B', 'C', 'Hub']],
      ['B', ['A', 'C', 'Hub']],
      ['C', ['A', 'B', 'Hub']],
    ]);
    const pm = pageMap([
      { path: 'A', content: '## Description\nA' },
      { path: 'B', content: '## Description\nB' },
      { path: 'C', content: '## Description\nC' },
      { path: 'Hub', content: '## Description\nhub\n\n## Related\n- [[A]]\n- [[B]]\n- [[C]]' },
    ]);
    const result = scanHubLinkDensity(pm, g, { ...DETERMINISTIC_PPR });
    expect(result.length).toBe(1);
    expect(result[0].recommendation).toBe('strip');
    expect(result[0].distinctivenessScore).toBeLessThan(0.3);
    // All 3 targets are low-distinctiveness in a tight cluster.
    expect(result[0].lowDistinctivenessTargets.length).toBeGreaterThan(0);
  });

  it('respects custom stripThreshold', () => {
    // Force strip threshold very high → even moderate distinctiveness → strip.
    // Use a clustered target set so the baseline distinctiveness is < 1.
    const g = graph([
      ['Hub', ['A', 'B', 'C']],
      ['A', ['B', 'Hub']],
      ['B', ['A', 'Hub']],
      ['X', ['Hub', 'A']],
      ['Y', ['Hub', 'B']],
    ]);
    const pm = pageMap([
      { path: 'A', content: '## Description\nA' },
      { path: 'B', content: '## Description\nB' },
      { path: 'C', content: '## Description\nC' },
      { path: 'X', content: '## Description\nX' },
      { path: 'Y', content: '## Description\nY' },
      { path: 'Hub', content: '## Description\nhub\n\n## Related\n- [[A]]\n- [[B]]\n- [[C]]' },
    ]);
    // Set strip threshold to 1.0 (impossible to reach) — should force 'strip'.
    const result = scanHubLinkDensity(pm, g, { ...DETERMINISTIC_PPR, stripThreshold: 1.0 });
    expect(result[0].recommendation).toBe('strip');
  });
});

describe('scanHubLinkDensity — issue shape', () => {
  it('returns HubLinkDensityIssue with all required fields', () => {
    const g = graph([
      ['A', ['Hub', 'B', 'C']],
      ['B', ['Hub']],
      ['C', ['Hub']],
    ]);
    const pm = pageMap([
      { path: 'A', content: '## Description\nA' },
      { path: 'B', content: '## Description\nB' },
      { path: 'C', content: '## Description\nC' },
      { path: 'Hub', content: '## Description\nhub\n\n## Related\n- [[A]]\n- [[B]]\n- [[C]]' },
    ]);
    const result = scanHubLinkDensity(pm, g, { ...DETERMINISTIC_PPR });
    expect(result.length).toBe(1);
    const issue: HubLinkDensityIssue = result[0];
    expect(issue.pagePath).toBe('Hub');
    expect(issue.inDegree).toBe(3);
    expect(issue.totalRelatedLinks).toBe(3);
    expect(typeof issue.distinctivenessScore).toBe('number');
    expect(issue.distinctivenessScore).toBeGreaterThanOrEqual(0);
    expect(issue.distinctivenessScore).toBeLessThanOrEqual(1);
    expect(['strip', 'review', 'keep']).toContain(issue.recommendation);
    expect(Array.isArray(issue.lowDistinctivenessTargets)).toBe(true);
  });
});

describe('scanHubLinkDensity — only analyzes hubs', () => {
  it('skips pages that are not hubs', () => {
    // A is a hub (in-degree 3). X, Y, Z are leaves (in-degree 0). Only A is analyzed.
    const g = graph([
      ['B', ['A']],
      ['C', ['A']],
      ['D', ['A']],
    ]);
    const pm = pageMap([
      { path: 'A', content: '## Description\nA\n\n## Related\n- [[B]]\n- [[C]]\n- [[D]]' },
      { path: 'B', content: '## Description\nB\n\n## Related\n- [[A]]' },
      { path: 'C', content: '## Description\nC\n\n## Related\n- [[A]]' },
      { path: 'D', content: '## Description\nD\n\n## Related\n- [[A]]' },
    ]);
    const result = scanHubLinkDensity(pm, g, { ...DETERMINISTIC_PPR });
    expect(result.length).toBe(1);
    expect(result[0].pagePath).toBe('A');
  });
});

describe('stripLowDistinctivenessLinks (#729 Phase 8)', () => {
  const PAGE = [
    '# Hub',
    '',
    '## Body',
    '',
    'The treatment mentions [[wiki/entities/Dup|Dup]] as background.',
    '',
    '## Related',
    '',
    '- [[wiki/entities/Dup|Dup]]',
    '- [[wiki/entities/Keep|Keep]]',
    '- [[wiki/entities/Dup2|Dup2]]',
    '',
  ].join('\n');

  it('removes the named links and keeps the rest', () => {
    const r = stripLowDistinctivenessLinks(PAGE, ['entities/Dup', 'entities/Dup2'], 'wiki');
    expect(r.removed).toBe(2);
    // Checked against the Related section only. The body mentions the same
    // name and is deliberately left alone — see the next test.
    const related = r.content.split(/^##\s+/m).find(s => /^related\b/i.test(s)) ?? '';
    expect(related).toContain('[[wiki/entities/Keep|Keep]]');
    expect(related).not.toContain('[[wiki/entities/Dup|Dup]]');
    expect(related).not.toContain('[[wiki/entities/Dup2|Dup2]]');
    expect(related).not.toContain('|Dup]]');
    expect(related).not.toContain('|Dup2]]');
  });

  it('never touches prose outside the Related section', () => {
    // The body mentions the same name where it is content. Stripping it there
    // would be editing the author's argument rather than the link list.
    const r = stripLowDistinctivenessLinks(PAGE, ['entities/Dup'], 'wiki');
    expect(r.content).toContain('The treatment mentions [[wiki/entities/Dup|Dup]] as background.');
  });

  it('removes by line — a bullet naming something else survives even on a shared word', () => {
    const r = stripLowDistinctivenessLinks(PAGE, ['entities/Dup'], 'wiki');
    expect(r.removed).toBe(1);
    expect(r.content).toContain('[[wiki/entities/Dup2|Dup2]]');
  });

  it('reports zero and returns the content unchanged when nothing matches', () => {
    const r = stripLowDistinctivenessLinks(PAGE, ['entities/Nope'], 'wiki');
    expect(r.removed).toBe(0);
    expect(r.content).toBe(PAGE);
  });

  it('is a no-op with an empty target list', () => {
    expect(stripLowDistinctivenessLinks(PAGE, [], 'wiki')).toEqual({ content: PAGE, removed: 0 });
  });

  it('leaves a page with no Related section alone', () => {
    const other = '# X\n\n## Body\n\n- [[wiki/entities/Dup|Dup]]\n';
    expect(stripLowDistinctivenessLinks(other, ['entities/Dup'], 'wiki')).toEqual({ content: other, removed: 0 });
  });

  it('is deterministic', () => {
    const a = stripLowDistinctivenessLinks(PAGE, ['entities/Dup'], 'wiki');
    const b = stripLowDistinctivenessLinks(PAGE, ['entities/Dup'], 'wiki');
    expect(a).toEqual(b);
  });
});

// Issue #1034 — the scanner must read the headings this plugin writes.
//
// `parseRelatedTargets` compared the heading against `related`, `see also` and
// `related pages`. The write path emits `Related Entities` / `Related Concepts`
// (`system-prompts.ts:21`) or a localized pair, so the density section has been
// silent on every vault this plugin wrote, in all eleven locales — and silent in
// English too, because the heading carries a suffix.
describe('#1034 — the headings the write path actually emits', () => {
  const hubWith = (headings: string[]) =>
    [
      '# Hub',
      '',
      ...headings.flatMap(h => [`## ${h}`, '', '- [[entities/A|A]]', '- [[entities/B|B]]', '']),
      '## Description',
      '',
      'A hub.',
      '',
    ].join('\n');

  // 40 pages link the hub, so it clears the hub set's degree floor whatever the labels.
  const graphFor = (pageMap: Map<string, { path: string; content: string }>) =>
    buildGraphFromContent([...pageMap.values()], new Set(pageMap.keys()), 'wiki');

  const pageMapWith = (hubContent: string) => {
    const pageMap = new Map<string, { path: string; content: string }>();
    pageMap.set('entities/Hub', { path: 'entities/Hub', content: hubContent });
    pageMap.set('entities/A', { path: 'entities/A', content: '# A\n' });
    pageMap.set('entities/B', { path: 'entities/B', content: '# B\n' });
    for (let i = 0; i < 40; i++) {
      const p = `entities/P${i}`;
      pageMap.set(p, { path: p, content: `# P${i}\n\nText [[entities/Hub|Hub]].\n` });
    }
    return pageMap;
  };

  it('reads the English pair the plugin writes', () => {
    const pageMap = pageMapWith(hubWith(['Related Entities', 'Related Concepts']));
    const issues = scanHubLinkDensity(pageMap, graphFor(pageMap), { wikiFolder: 'wiki' });
    expect(issues.length, 'the English sections were not read').toBe(1);
  });

  it('reads a localized pair when the caller passes those headings', () => {
    const pageMap = pageMapWith(hubWith(['相关实体', '相关概念']));
    const issues = scanHubLinkDensity(pageMap, graphFor(pageMap), {
      wikiFolder: 'wiki',
      relatedHeadings: ['相关实体', '相关概念'],
    });
    expect(issues.length).toBe(1);
  });

  it('reads both sections as one list, so a target in either counts once', () => {
    // The writer puts entities in one section and concepts in the other, and dedupes
    // across both. A scanner that stops at the first section sees half the list.
    const twoSections = [
      '# Hub', '',
      '## Related Entities', '', '- [[entities/A|A]]', '- [[entities/B|B]]', '',
      '## Related Concepts', '', '- [[concepts/C|C]]', '- [[concepts/D|D]]', '',
    ].join('\n');
    const pageMap = pageMapWith(twoSections);
    const issues = scanHubLinkDensity(pageMap, graphFor(pageMap), { wikiFolder: 'wiki' });
    // Two per section. Reading only the first section reports two, not four.
    expect(issues[0].totalRelatedLinks, 'the two sections were not read as one list').toBe(4);
  });

  it('still reads a hand-written legacy heading', () => {
    const pageMap = pageMapWith(hubWith(['Related']));
    const issues = scanHubLinkDensity(pageMap, graphFor(pageMap), { wikiFolder: 'wiki' });
    expect(issues.length).toBe(1);
  });

  it('strips low-distinctiveness links from a localized section', () => {
    const before = hubWith(['相关实体']);
    const { content, removed } = stripLowDistinctivenessLinks(before, ['entities/A'], 'wiki', ['相关实体']);
    expect(removed, 'the localized section was not rewritten').toBe(1);
    expect(content).not.toContain('[[entities/A|A]]');
    expect(content).toContain('[[entities/B|B]]');
  });
});

// The unit tests above call the scanner directly, so none of them would notice the
// production path forgetting to pass the labels — which is the exact defect #1034
// describes. These two assertions pin the wiring itself.
describe('#1034 — the production path supplies the localized headings', () => {
  const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

  it('the lint phase passes both labels from settings', () => {
    const phase = src('../../wiki/lint/phases/programmatic.ts');
    expect(phase, 'the density scan is called without the headings this vault uses').toMatch(
      /scanHubLinkDensity\([\s\S]{0,400}relatedHeadings:/,
    );
    expect(phase).toMatch(/relatedHeadings: \[[^\]]*related_entities[^\]]*related_concepts[^\]]*\]/);
  });

  it('the fix runner rewrites the same headings the scanner read', () => {
    const runner = src('../../wiki/lint/fix-runners.ts');
    expect(runner, 'the strip call would miss a localized section').toMatch(
      /stripLowDistinctivenessLinks\([\s\S]{0,200}relatedHeadings\s*\)/,
    );
  });
});
