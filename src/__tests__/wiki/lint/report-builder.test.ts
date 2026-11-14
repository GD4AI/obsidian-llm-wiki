import { describe, it, expect } from 'vitest';
import { buildLintReport } from '../../../wiki/lint/report-builder';
import { LLMWikiSettings } from '../../../types';
import { ProgrammaticFindings } from '../../../wiki/lint/types';

function makeSettings(): LLMWikiSettings {
  return {
    wikiFolder: 'wiki',
    language: 'en',
    slugCase: 'lower',
    tagVocabularyMode: 'default',
  } as LLMWikiSettings;
}

function makeFindings(overrides: Partial<ProgrammaticFindings> = {}): ProgrammaticFindings {
  return {
    aliasDeficientPages: [],
    emptyPages: [],
    orphans: [],
    tagViolations: [],
    pollutedPages: [],
    deadLinks: [],
    ungroundedQuotes: [],
    hubLinkDensityIssues: [],
  crystallizedHubs: [],
    sourceDriftIssues: [],
    contradictionMarkerIssues: [],
    sourcesNormalizedFiles: 0,
    sourcesNormalizedEntries: 0,
    doubleNestFixes: 0,
    ...overrides,
  };
}

describe('buildLintReport', () => {
  it('renders no-issues message when all findings are empty', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings(),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 5,
      totalPages: 10,
    });
    expect(report).toContain('10 pages total');
    expect(report).toContain('No duplicates');
    expect(report).toContain('Lint elapsed');
  });

  it('renders duplicates section when duplicates present', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings(),
      duplicates: [{ target: 'wiki/entities/A.md', source: 'wiki/entities/B.md', reason: 'same name' }],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 5,
    });
    expect(report).toContain('Duplicate pages');
    expect(report).toContain('[[entities/A]]');
    expect(report).toContain('[[entities/B]]');
  });

  it('renders dead links section', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({ deadLinks: [{ source: 'entities/X', target: 'entities/Missing' }] }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 5,
    });
    expect(report).toContain('Dead links');
    expect(report).toContain('**entities/Missing**');
  });

  it('renders orphans section', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({ orphans: ['wiki/entities/Orphan.md'] }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 5,
    });
    expect(report).toContain('Orphan pages');
    expect(report).toContain('[[entities/Orphan]]');
  });

  it('renders ungrounded quotes section', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({
        ungroundedQuotes: [
          { pagePath: 'wiki/entities/Foo.md', quote: 'fabricated', hasSourceLink: false },
        ],
      }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 5,
    });
    expect(report).toContain('Ungrounded quotes');
    expect(report).toContain('fabricated');
  });

  it('renders tag violations section', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({
        tagViolations: [
          { path: 'wiki/entities/X.md', pageType: 'entity', title: 'X', currentTags: ['bogus'], invalidTags: ['bogus'] },
        ],
      }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 5,
    });
    expect(report).toContain('out-of-vocabulary tags');
    expect(report).toContain('bogus');
  });

  it('marks dead links as duplicate-affected when target or source is a duplicate path', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({ deadLinks: [{ source: 'entities/X', target: 'entities/Y' }] }),
      duplicates: [{ target: 'wiki/entities/Y.md', source: 'wiki/entities/X.md', reason: 'same' }],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 5,
    });
    expect(report).toContain('duplicate');
  });

  it('prepends aliases deficiency note when aliases missing', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({
        aliasDeficientPages: [{ path: 'wiki/entities/X.md', content: '', basename: 'X.md' }],
      }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 5,
    });
    expect(report).toContain('Aliases missing');
  });
});


describe('source drift section (Issue #220 Tier 0)', () => {
  it('renders drifted pages and keeps the no-issues message suppressed', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({
        sourceDriftIssues: [{
          sourcePage: 'wiki/sources/butyrat.md',
          note: 'Notizen/Butyrat.md',
          storedHash: '22-aaaaaaaa',
          currentHash: '25-bbbbbbbb',
        }],
      }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 10,
    });
    expect(report).toContain('Source notes changed since ingest [1]');
    expect(report).toContain('[[sources/butyrat]]');
    expect(report).toContain('[[Notizen/Butyrat]]');
    expect(report).not.toContain('No issues found');
  });

  it('omits the section when nothing drifted', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings(),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 10,
    });
    expect(report).not.toContain('Source notes changed since ingest');
  });
});

describe('contradiction marker section (#575 read half)', () => {
  it('renders marked pages with their conflicting sources', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({
        contradictionMarkerIssues: [
          { path: 'wiki/entities/butyrat.md', sources: ['Notizen/Neue-Studie.md'] },
        ],
      }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 10,
    });
    expect(report).toContain('Pages flagged with contradictions (merge triage) [1]');
    expect(report).toContain('[[entities/butyrat]]');
    expect(report).toContain('[[Notizen/Neue-Studie]]');
    expect(report).not.toContain('No issues found');
  });

  it('omits the section when no page carries the marker', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings(),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 10,
    });
    expect(report).not.toContain('Pages flagged with contradictions');
  });

  // #954: the intro used to tell the user to remove the hub tag. A hub tag is a
  // curatorial marker the plugin never reads, so for the majority who never set
  // one the instruction pointed at nothing, and for the rest it implied that
  // removing it changes plugin behaviour. It does not.
  it('says the plugin ignores a hub tag instead of telling the user to remove it', () => {
    const report = buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({
        crystallizedHubs: [
          { path: 'wiki/entities/Hub.md', degree: 12, clustering: 0.04, clusteringPercentile: 0.98 },
        ],
      }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 10,
    });

    expect(report).toContain('entities/Hub — degree 12');
    // The instruction that pointed at nothing.
    expect(report).not.toContain('remove the hub tag yourself');
    // What actually happens.
    expect(report).toContain('The plugin ignores that marker and changes nothing');
    // The assessed set is named with its real size, not a placeholder.
    expect(report).toContain('Assessed the top 50 hubs by degree');
    expect(report).not.toContain('{topN}');
  });
});

// #1034 — a `keep` verdict is not a finding.
//
// Until the heading reader was fixed, this branch never ran on any vault, so nobody saw
// that it printed every hub it had looked at: six healthy pages per run on a 2,141-page
// vault. The section now lists what needs action, and disappears when nothing does.
describe('hub link density section (#1034)', () => {
  const hubIssue = (recommendation: 'strip' | 'review' | 'keep') => ({
    pagePath: 'wiki/entities/Hub.md',
    inDegree: 12,
    totalRelatedLinks: 4,
    distinctivenessScore: 0.2,
    recommendation,
    lowDistinctivenessTargets: ['entities/Redundant'],
  });
  const reportFor = (recommendation: 'strip' | 'review' | 'keep') =>
    buildLintReport({
      settings: makeSettings(),
      findings: makeFindings({ hubLinkDensityIssues: [hubIssue(recommendation)] as ProgrammaticFindings['hubLinkDensityIssues'] }),
      duplicates: [],
      contradictionsReport: '',
      elapsedSeconds: 1,
      totalPages: 5,
    });

  it('omits the section when every hub is healthy', () => {
    expect(reportFor('keep')).not.toMatch(/hub link density/i);
  });

  it('lists a hub that needs action', () => {
    expect(reportFor('review')).toMatch(/hub link density/i);
    expect(reportFor('strip')).toMatch(/hub link density/i);
  });

  it('says how this list differs from the crystallized list (#1025)', () => {
    // Measured: 13 crystallized pages and 3 density pages on a 2,141-page vault, with
    // no page in both. A reader who sees one list and not the other needs the reason.
    const report = reportFor('review');
    expect(report).toMatch(/out-links/i);
    expect(report).toMatch(/Crystallized hub candidates/);
    expect(report, 'the reader must be told neither list implies the other').toMatch(/neither implies the other/i);
  });
});
