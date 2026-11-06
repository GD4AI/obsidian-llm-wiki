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
});
