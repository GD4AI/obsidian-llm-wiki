import { describe, it, expect } from 'vitest';
import { buildKnownTargets, detectAliasDeficiency, scanDeadLinks, scanOrphans, scanTagViolations, scanSourceDrift, scanContradictionMarkers, ScannerPage } from '../../../wiki/lint/scanners';
import { hashBody } from '../../../core/source-requirements';
import { LLMWikiSettings } from '../../../types';

// ── buildKnownTargets ─────────────────────────────────────────

describe('buildKnownTargets', () => {
  it('adds basename with and without .md extension', () => {
    const files = [{ basename: 'Test.md', path: 'wiki/entities/Test.md' }];
    const { known } = buildKnownTargets(files);
    expect(known.has('Test.md')).toBe(true);
    expect(known.has('Test')).toBe(true);
  });

  it('adds full path and relative path forms', () => {
    const files = [{ basename: 'Foo.md', path: 'wiki/entities/Foo.md' }];
    const { known } = buildKnownTargets(files);
    expect(known.has('wiki/entities/Foo')).toBe(true);
    expect(known.has('wiki/entities/Foo.md')).toBe(true);
  });

  it('adds sub-path variants', () => {
    const files = [{ basename: 'Deep.md', path: 'wiki/concepts/ML/Deep.md' }];
    const { known } = buildKnownTargets(files);
    expect(known.has('ML/Deep')).toBe(true);
    expect(known.has('ML/Deep.md')).toBe(true);
  });

  it('lowercases all entries for knownLower', () => {
    const files = [{ basename: 'Foo.md', path: 'wiki/Foo.md' }];
    const { knownLower } = buildKnownTargets(files);
    expect(knownLower.has('foo.md')).toBe(true);
    expect(knownLower.has('foo')).toBe(true);
  });

  it('handles empty input', () => {
    const { known, knownLower } = buildKnownTargets([]);
    expect(known.size).toBe(0);
    expect(knownLower.size).toBe(0);
  });
});

// ── detectAliasDeficiency ──────────────────────────────────────

describe('detectAliasDeficiency', () => {
  function makePage(path: string, hasAlias: boolean): ScannerPage {
    const fm = hasAlias ? 'type: entity\naliases: [Alias]\n' : 'type: entity\n';
    return { path, content: `---\n${fm}---\n\nBody`, basename: path.split('/').pop() || '' };
  }

  it('detects pages without aliases in entity/concept dirs', () => {
    const files = [
      { path: 'wiki/entities/Foo.md' },
      { path: 'wiki/concepts/Bar.md' },
    ];
    const pageMap = new Map<string, ScannerPage>();
    for (const f of files) pageMap.set(f.path, makePage(f.path, false));

    const result = detectAliasDeficiency(files, pageMap);
    expect(result).toHaveLength(2);
  });

  it('skips pages that already have aliases', () => {
    const files = [{ path: 'wiki/entities/HasAlias.md' }];
    const pageMap = new Map<string, ScannerPage>();
    pageMap.set(files[0].path, makePage(files[0].path, true));

    expect(detectAliasDeficiency(files, pageMap)).toHaveLength(0);
  });

  it('skips non-entity/concept directories', () => {
    const files = [{ path: 'wiki/sources/SomeSource.md' }];
    const pageMap = new Map<string, ScannerPage>();
    pageMap.set(files[0].path, makePage(files[0].path, false));

    expect(detectAliasDeficiency(files, pageMap)).toHaveLength(0);
  });

  // v1.24.0 bug-hunt test: the original detection logic only
  // checked `fmMatch[1].includes('aliases:')` — which falsely passes
  // for `aliases: []` (empty array). A user who deletes every alias
  // entry but leaves the `aliases:` key gets reported as "has aliases"
  // and lint misses the deficiency.
  //
  // Fix: detect alias deficiency as "no aliases line OR aliases array
  // is empty". A page with `aliases: []` is still deficient — the
  // whole point of lint is to surface pages that need more aliases.
  describe('aliases:[] must count as deficient (v1.24.0 fix)', () => {
    it('detects entity page with aliases:[] (user deleted all entries)', () => {
      const content = `---\ntype: entity\naliases: []\n---\n\n# Body`;
      const pageMap = new Map<string, ScannerPage>();
      pageMap.set('wiki/entities/Empty.md', {
        path: 'wiki/entities/Empty.md',
        content,
        basename: 'Empty',
      });
      const result = detectAliasDeficiency(
        [{ path: 'wiki/entities/Empty.md' }],
        pageMap
      );
      // FAILING before fix: includes('aliases:') matches, returns 0.
      // EXPECTED after fix: detects as deficient, returns 1.
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('wiki/entities/Empty.md');
    });

    it('detects concept page with aliases:[] ', () => {
      const content = `---\ntype: concept\naliases: []\n---\n\n# Body`;
      const pageMap = new Map<string, ScannerPage>();
      pageMap.set('wiki/concepts/Empty.md', {
        path: 'wiki/concepts/Empty.md',
        content,
        basename: 'Empty',
      });
      const result = detectAliasDeficiency(
        [{ path: 'wiki/concepts/Empty.md' }],
        pageMap
      );
      expect(result).toHaveLength(1);
    });

    it('still skips page with real aliases: [Real Alias]', () => {
      const content = `---\ntype: entity\naliases: [Real Alias]\n---\n\n# Body`;
      const pageMap = new Map<string, ScannerPage>();
      pageMap.set('wiki/entities/Real.md', {
        path: 'wiki/entities/Real.md',
        content,
        basename: 'Real',
      });
      const result = detectAliasDeficiency(
        [{ path: 'wiki/entities/Real.md' }],
        pageMap
      );
      expect(result).toHaveLength(0);
    });

    it('detects page with multi-line aliases: \n  - "" (empty string entries)', () => {
      // User deletes all entries but leaves placeholder dashes.
      const content = `---\ntype: entity\naliases:\n  - ""\n  - ""\n---\n\n# Body`;
      const pageMap = new Map<string, ScannerPage>();
      pageMap.set('wiki/entities/Placeholder.md', {
        path: 'wiki/entities/Placeholder.md',
        content,
        basename: 'Placeholder',
      });
      const result = detectAliasDeficiency(
        [{ path: 'wiki/entities/Placeholder.md' }],
        pageMap
      );
      // Empty-string aliases provide no alias value → still deficient.
      expect(result).toHaveLength(1);
    });

    it('skips page with multi-line aliases: \n  - Real\n  - Alias', () => {
      const content = `---\ntype: entity\naliases:\n  - Real\n  - Alias\n---\n\n# Body`;
      const pageMap = new Map<string, ScannerPage>();
      pageMap.set('wiki/entities/Has.md', {
        path: 'wiki/entities/Has.md',
        content,
        basename: 'Has',
      });
      const result = detectAliasDeficiency(
        [{ path: 'wiki/entities/Has.md' }],
        pageMap
      );
      expect(result).toHaveLength(0);
    });

    it('skips page with aliases: ["foo"]', () => {
      const content = `---\ntype: entity\naliases: ["foo"]\n---\n\n# Body`;
      const pageMap = new Map<string, ScannerPage>();
      pageMap.set('wiki/entities/Quoted.md', {
        path: 'wiki/entities/Quoted.md',
        content,
        basename: 'Quoted',
      });
      const result = detectAliasDeficiency(
        [{ path: 'wiki/entities/Quoted.md' }],
        pageMap
      );
      expect(result).toHaveLength(0);
    });

    it('skips page with single quoted alias', () => {
      const content = `---\ntype: entity\naliases:\n  - "Real Alias"\n---\n\n# Body`;
      const pageMap = new Map<string, ScannerPage>();
      pageMap.set('wiki/entities/Single.md', {
        path: 'wiki/entities/Single.md',
        content,
        basename: 'Single',
      });
      const result = detectAliasDeficiency(
        [{ path: 'wiki/entities/Single.md' }],
        pageMap
      );
      expect(result).toHaveLength(0);
    });
  });
});

// ── scanDeadLinks ──────────────────────────────────────────────

describe('scanDeadLinks', () => {
  function makePageMap(path: string, content: string): Map<string, ScannerPage> {
    const m = new Map<string, ScannerPage>();
    m.set(path, { path, content, basename: path.split('/').pop() || '' });
    return m;
  }

  it('detects links to non-existent targets', () => {
    const pm = makePageMap('wiki/concepts/Test.md', 'See [[MissingPage]] for details.');
    const known = new Set<string>(['Test']);

    const result = scanDeadLinks(pm, known, new Set(), 'wiki');
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('MissingPage');
  });

  it('does not flag links to known targets', () => {
    const pm = makePageMap('wiki/concepts/Test.md', 'See [[KnownPage]] for details.');
    const known = new Set<string>(['KnownPage']);

    expect(scanDeadLinks(pm, known, new Set(), 'wiki')).toHaveLength(0);
  });

  it('matches case-insensitively via knownLower', () => {
    const pm = makePageMap('wiki/concepts/Test.md', 'See [[KNOWNPAGE]]');
    const knownLower = new Set<string>(['knownpage']);

    expect(scanDeadLinks(pm, new Set(), knownLower, 'wiki')).toHaveLength(0);
  });

  it('strips wiki folder from source path in output', () => {
    const pm = makePageMap('wiki/concepts/Nested/Test.md', '[[Missing]]');
    const result = scanDeadLinks(pm, new Set(), new Set(), 'wiki');
    expect(result[0].source).toBe('concepts/Nested/Test');
  });

  it('does not flag space-to-hyphen slug variants as dead links', () => {
    // Regression: [[entities/Claude Code]] was reported dead even though
    // the file entities/Claude-Code.md exists (space vs hyphen mismatch).
    const pm = makePageMap('wiki/entities/OpenCode-Pi.md', '[[entities/Claude Code|Claude Code]]');
    const { known, knownLower } = buildKnownTargets([
      { basename: 'Claude-Code.md', path: 'wiki/entities/Claude-Code.md' },
    ]);
    const result = scanDeadLinks(pm, known, knownLower, 'wiki');
    expect(result).toHaveLength(0);
  });

  it('still reports truly unknown targets even after slug normalization', () => {
    const pm = makePageMap('wiki/entities/Page.md', '[[entities/Truly Unknown Page]]');
    const { known, knownLower } = buildKnownTargets([
      { basename: 'Claude-Code.md', path: 'wiki/entities/Claude-Code.md' },
    ]);
    const result = scanDeadLinks(pm, known, knownLower, 'wiki');
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('entities/Truly Unknown Page');
  });
});

// ── scanOrphans ────────────────────────────────────────────────

describe('scanOrphans', () => {
  function makePageMap(path: string, content: string, aliases?: string[]): Map<string, ScannerPage> {
    const aliasLine = aliases?.length ? `aliases: [${aliases.join(', ')}]\n` : '';
    const fm = `---\ntype: entity\n${aliasLine}---\n\n${content}`;
    const m = new Map<string, ScannerPage>();
    m.set(path, { path, content: fm, basename: path.split('/').pop() || '' });
    return m;
  }

  it('flags pages with no incoming links as orphans', () => {
    const pm = makePageMap('wiki/entities/Orphan.md', 'No links here.');
    const result = scanOrphans(pm, 'wiki');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('wiki/entities/Orphan.md');
  });

  it('does not flag page linked by another page', () => {
    const pm = new Map<string, ScannerPage>();
    const p = makePageMap('wiki/entities/Target.md', 'Target content.');
    const src = makePageMap('wiki/entities/Source.md', 'See [[Target]] for info.');
    for (const [k, v] of p) pm.set(k, v);
    for (const [k, v] of src) pm.set(k, v);

    const result = scanOrphans(pm, 'wiki');
    expect(result).not.toContain('wiki/entities/Target.md');
  });

  it('matches incoming links via aliases', () => {
    const pm = new Map<string, ScannerPage>();
    const p = makePageMap('wiki/entities/ML.md', 'ML page content.', ['Machine Learning']);
    const src = makePageMap('wiki/concepts/Source.md', 'See [[Machine Learning]] for info.');
    for (const [k, v] of p) pm.set(k, v);
    for (const [k, v] of src) pm.set(k, v);

    const result = scanOrphans(pm, 'wiki');
    expect(result).not.toContain('wiki/entities/ML.md');
  });
});

// ── scanTagViolations (Issue #85 v7) ────────────────────────────

describe('scanTagViolations', () => {
  const baseSettings: LLMWikiSettings = {
    provider: 'anthropic', apiKey: '', openAICodexSecretId: '', providerApiKeySecretId: 'karpathywiki-provider-api-key', baseUrl: '', model: 'claude-sonnet-4-6',
    wikiFolder: 'wiki', language: 'en', wikiLanguage: 'en',
    maxConversationHistory: 30, extractionGranularity: 'standard',
    enableSchema: true, autoWatchSources: false, autoWatchMode: 'notify',
    autoWatchDebounceMs: 5000, watchedFolders: [], periodicLint: 'off',
    startupCheck: false, pageGenerationConcurrency: 3, batchDelayMs: 500,
    llmReady: false,
    maxTokensPerCall: 0,
    tagVocabularyMode: 'default',
    customEntityTags: '',
    customConceptTags: '',
    autoSmartFix: false,
    autoIngestNotificationLevel: 'notice',
    slugCase: 'lower' as const,
    createWelcomeNote: true,
    startupCheckNoticeLevel: 'visible' as const,
  };

  function makeEntityPage(path: string, tags: string[] | string, withTitle = false): ScannerPage {
    const titleLine = withTitle ? `title: Test\n` : '';
    return {
      path,
      content: `---\ntype: entity\n${titleLine}tags: ${Array.isArray(tags) ? `[${tags.join(', ')}]` : tags}\n---\n\nBody`,
      basename: path.split('/').pop() || '',
    };
  }

  function makeConceptPage(path: string, tags: string[]): ScannerPage {
    return {
      path,
      content: `---\ntype: concept\ntags: [${tags.join(', ')}]\n---\n\nBody`,
      basename: path.split('/').pop() || '',
    };
  }

  function makeSourcePage(path: string, tags: string[]): ScannerPage {
    return {
      path,
      content: `---\ntype: source\ntags: [${tags.join(', ')}]\n---\n\nBody`,
      basename: path.split('/').pop() || '',
    };
  }

  it('returns empty when pageMap is empty', () => {
    expect(scanTagViolations(new Map(), baseSettings)).toEqual([]);
  });

  it('returns empty when all entity tags are within default vocab', () => {
    const pm = new Map<string, ScannerPage>([
      ['wiki/entities/Alice.md', makeEntityPage('Alice.md', ['person'])],
      ['wiki/entities/Acme.md', makeEntityPage('Acme.md', ['organization'])],
    ]);
    expect(scanTagViolations(pm, baseSettings)).toEqual([]);
  });

  it('flags an entity page with an out-of-vocab tag', () => {
    const pm = new Map<string, ScannerPage>([
      ['wiki/entities/Alice.md', makeEntityPage('Alice.md', ['person', 'bogus', 'Medical_Arzneimittel'])],
    ]);
    const result = scanTagViolations(pm, baseSettings);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      path: 'wiki/entities/Alice.md',
      pageType: 'entity',
      currentTags: ['person', 'bogus', 'Medical_Arzneimittel'],
      invalidTags: ['bogus', 'Medical_Arzneimittel'],
    });
  });

  it('honors custom entity vocabulary in custom mode', () => {
    const customSettings: LLMWikiSettings = { ...baseSettings,
      tagVocabularyMode: 'custom',
      customEntityTags: 'person, organization, Medical_Arzneimittel',
    };
    const pm = new Map<string, ScannerPage>([
      // "project" is in DEFAULT but NOT in the user's custom vocab →
      // should be flagged.
      ['wiki/entities/Alice.md', makeEntityPage('Alice.md', ['person', 'project'])],
    ]);
    const result = scanTagViolations(pm, customSettings);
    expect(result).toHaveLength(1);
    expect(result[0].invalidTags).toEqual(['project']);
  });

  it('flags a concept page with a default-vocab-but-not-concept tag', () => {
    // "person" is in VALID_ENTITY_TAGS but NOT VALID_CONCEPT_TAGS.
    const pm = new Map<string, ScannerPage>([
      ['wiki/concepts/ML.md', makeConceptPage('ML.md', ['theory', 'person'])],
    ]);
    const result = scanTagViolations(pm, baseSettings);
    expect(result).toHaveLength(1);
    expect(result[0].invalidTags).toEqual(['person']);
  });

  it('flags a source page with non-VALID_SOURCE_TAGS tag', () => {
    // "Medical_Arzneimittel" is a custom entity tag, NOT a source
    // "form" tag → must be flagged.
    const pm = new Map<string, ScannerPage>([
      ['wiki/sources/Smith2024.md', makeSourcePage('Smith2024.md', ['Medical_Arzneimittel', 'paper'])],
    ]);
    const result = scanTagViolations(pm, baseSettings);
    expect(result).toHaveLength(1);
    expect(result[0].invalidTags).toEqual(['Medical_Arzneimittel']);
  });

  it('passes a source page with valid form tags', () => {
    const pm = new Map<string, ScannerPage>([
      ['wiki/sources/Clippings.md', makeSourcePage('Clippings.md', ['clippings', 'article'])],
    ]);
    expect(scanTagViolations(pm, baseSettings)).toEqual([]);
  });

  // An empty list is what the write gate leaves behind when it stripped every
  // tag the model wrote; skipping it made the gate's output invisible and left
  // the retag runner — the only repair without a re-ingest — nothing to do.
  it('flags pages with an empty tags array', () => {
    const pm = new Map<string, ScannerPage>([
      ['wiki/entities/Empty.md', makeEntityPage('Empty.md', [])],
    ]);
    const v = scanTagViolations(pm, baseSettings);
    expect(v).toHaveLength(1);
    expect(v[0].currentTags).toEqual([]);
    expect(v[0].invalidTags).toEqual([]);
  });

  it('skips pages whose type is not entity / concept / source', () => {
    const pm = new Map<string, ScannerPage>([
      ['wiki/overviews/Index.md', {
        path: 'wiki/overviews/Index.md',
        content: '---\ntype: overview\ntags: [bogus, invalid]\n---\n\nBody',
        basename: 'Index.md',
      }],
    ]);
    expect(scanTagViolations(pm, baseSettings)).toEqual([]);
  });

  it('returns results sorted by path', () => {
    const pm = new Map<string, ScannerPage>([
      ['wiki/entities/Z.md', makeEntityPage('Z.md', ['bogus'])],
      ['wiki/entities/A.md', makeEntityPage('A.md', ['bogus'])],
      ['wiki/entities/M.md', makeEntityPage('M.md', ['bogus'])],
    ]);
    const result = scanTagViolations(pm, baseSettings);
    expect(result.map(v => v.path)).toEqual([
      'wiki/entities/A.md',
      'wiki/entities/M.md',
      'wiki/entities/Z.md',
    ]);
  });

  it('captures page title from frontmatter (used in Lint report)', () => {
    const pm = new Map<string, ScannerPage>([
      ['wiki/entities/Alice.md', makeEntityPage('Alice.md', ['bogus'], true)],
    ]);
    const result = scanTagViolations(pm, baseSettings);
    expect(result[0].title).toBe('Test');
  });
});

// ── scanSourceDrift (Issue #220 Tier 0, read half) ─────────────

describe('scanSourceDrift', () => {
  const folder = 'wiki';
  const noteBody = 'Original note body about butyrate.';
  const page = (path: string, fmLines: string[]): [string, ScannerPage] => [
    path,
    { path, basename: path.split('/').pop()!, content: `---\n${fmLines.join('\n')}\n---\n\nSummary.` },
  ];

  const hashOf = (body: string) => hashBody(body);

  it('flags a source page whose origin note changed since ingest', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/sources/butyrat.md', [
        'type: source',
        `contentHash: ${hashOf(noteBody)}`,
        'sources:',
        '  - "[[Notizen/Butyrat.md]]"',
      ]),
    ]);
    const notes = new Map([['Notizen/Butyrat.md', 'Revised note body — the claim changed.']]);
    const issues = scanSourceDrift(pageMap, notes, folder);
    expect(issues).toHaveLength(1);
    expect(issues[0].sourcePage).toBe('wiki/sources/butyrat.md');
    expect(issues[0].note).toBe('Notizen/Butyrat.md');
    expect(issues[0].storedHash).toBe(hashOf(noteBody));
    expect(issues[0].currentHash).toBe(hashOf('Revised note body — the claim changed.'));
  });

  it('does not flag when the note body still matches (whitespace-insensitive)', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/sources/butyrat.md', [
        'type: source',
        `contentHash: ${hashOf(noteBody)}`,
        'sources:',
        '  - Notizen/Butyrat.md',
      ]),
    ]);
    const notes = new Map([['Notizen/Butyrat.md', '  Original   note body\nabout butyrate.  ']]);
    expect(scanSourceDrift(pageMap, notes, folder)).toHaveLength(0);
  });

  it('strips note frontmatter before hashing, matching the write side', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/sources/butyrat.md', [
        'type: source',
        `contentHash: ${hashOf(noteBody)}`,
        'sources:',
        '  - Notizen/Butyrat.md',
      ]),
    ]);
    const notes = new Map([['Notizen/Butyrat.md', `---\ntags:\n  - Sorte/Stoff\n---\n\n${noteBody}`]]);
    expect(scanSourceDrift(pageMap, notes, folder)).toHaveLength(0);
  });

  it('skips pages without contentHash (pre-#164) and pages outside sources/', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/sources/alt.md', ['type: source', 'sources:', '  - Notizen/Alt.md']),
      page('wiki/entities/butyrat.md', [
        'type: entity',
        `contentHash: ${hashOf(noteBody)}`,
        'sources:',
        '  - Notizen/Butyrat.md',
      ]),
    ]);
    const notes = new Map([
      ['Notizen/Alt.md', 'changed'],
      ['Notizen/Butyrat.md', 'changed'],
    ]);
    expect(scanSourceDrift(pageMap, notes, folder)).toHaveLength(0);
  });

  it('skips pages whose note is unreadable — absence of evidence is not drift', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/sources/butyrat.md', [
        'type: source',
        `contentHash: ${hashOf(noteBody)}`,
        'sources:',
        '  - Notizen/Verschwunden.md',
      ]),
    ]);
    expect(scanSourceDrift(pageMap, new Map(), folder)).toHaveLength(0);
  });

  it('multi-source page: not flagged while ANY listed note still matches the stored hash', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/sources/multi.md', [
        'type: source',
        `contentHash: ${hashOf(noteBody)}`,
        'sources:',
        '  - Notizen/Geaendert.md',
        '  - Notizen/Original.md',
      ]),
    ]);
    const notes = new Map([
      ['Notizen/Geaendert.md', 'edited elsewhere'],
      ['Notizen/Original.md', noteBody],
    ]);
    expect(scanSourceDrift(pageMap, notes, folder)).toHaveLength(0);
  });

  it('multi-source page: flagged with the first mismatching note when none match', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/sources/multi.md', [
        'type: source',
        `contentHash: ${hashOf(noteBody)}`,
        'sources:',
        '  - Notizen/A.md',
        '  - Notizen/B.md',
      ]),
    ]);
    const notes = new Map([
      ['Notizen/A.md', 'changed A'],
      ['Notizen/B.md', 'changed B'],
    ]);
    const issues = scanSourceDrift(pageMap, notes, folder);
    expect(issues).toHaveLength(1);
    expect(issues[0].note).toBe('Notizen/A.md');
  });
});

describe('scanSourceDrift — canonical source_file frontmatter', () => {
  it('reads the scalar source_file wikilink written by the generation template', () => {
    const noteBody = 'Original note body.';
    const pageMap = new Map<string, ScannerPage>([
      ['wiki/sources/geh-test.md', {
        path: 'wiki/sources/geh-test.md',
        basename: 'geh-test.md',
        content: `---\ntype: source\nsource_file: "[[Notizen/6-Minuten-Gehtest.md]]"\ncontentHash: ${hashBody(noteBody)}\n---\n\nSummary.`,
      }],
    ]);
    const changed = new Map([['Notizen/6-Minuten-Gehtest.md', 'Edited body.']]);
    const issues = scanSourceDrift(pageMap, changed, 'wiki');
    expect(issues).toHaveLength(1);
    expect(issues[0].note).toBe('Notizen/6-Minuten-Gehtest.md');

    const unchanged = new Map([['Notizen/6-Minuten-Gehtest.md', noteBody]]);
    expect(scanSourceDrift(pageMap, unchanged, 'wiki')).toHaveLength(0);
  });
});

// ── scanContradictionMarkers (#575 read half) ─────────────

describe('scanContradictionMarkers', () => {
  const page = (path: string, content: string): [string, ScannerPage] => [
    path,
    { path, basename: path.split('/').pop()!, content },
  ];

  it('surfaces pages with a non-empty contradictions: list', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/entities/butyrat.md',
        '---\ntype: entity\ncontradictions:\n  - Notizen/Neue-Studie.md\n  - Notizen/Alte-Studie.md\n---\n\nBody'),
      page('wiki/entities/clean.md', '---\ntype: entity\n---\n\nBody'),
    ]);
    const issues = scanContradictionMarkers(pageMap);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('wiki/entities/butyrat.md');
    expect(issues[0].sources).toEqual(['Notizen/Neue-Studie.md', 'Notizen/Alte-Studie.md']);
  });

  it('ignores empty lists, blank entries, and non-list values', () => {
    const pageMap = new Map<string, ScannerPage>([
      page('wiki/entities/empty.md', '---\ntype: entity\ncontradictions:\n---\n\nBody'),
      page('wiki/entities/blank.md', '---\ntype: entity\ncontradictions:\n  - ""\n---\n\nBody'),
      page('wiki/entities/nofm.md', 'Body without frontmatter'),
    ]);
    expect(scanContradictionMarkers(pageMap)).toHaveLength(0);
  });
});

describe('scanTagViolations — judges against the one vocabulary when given', () => {
  const settings: LLMWikiSettings = {
    tagVocabularyMode: 'custom',
    customEntityTags: 'Sorte/Erkrankung',
    customConceptTags: 'Sorte/Mechanismus',
  } as unknown as LLMWikiSettings;
  const harvested = { entities: ['Sorte/Erkrankung', 'Sorte/Organisation'], concepts: ['Sorte/Mechanismus'] };
  const page = (type: string, tags: string[], path: string): ScannerPage => ({
    path,
    content: `---\ntype: ${type}\ntags: [${tags.join(', ')}]\n---\n\nBody`,
    basename: path.split('/').pop() || '',
  });

  it('a harvested term the settings list lacks is valid — the same list the gate enforced', () => {
    const pm = new Map([['wiki/entities/WHO.md', page('entity', ['Sorte/Organisation'], 'wiki/entities/WHO.md')]]);
    expect(scanTagViolations(pm, settings)).toHaveLength(1);
    expect(scanTagViolations(pm, settings, harvested)).toEqual([]);
  });

  it('a source page may carry a vocabulary term next to its form value', () => {
    const pm = new Map([['wiki/sources/S.md', page('source', ['other', 'Sorte/Erkrankung'], 'wiki/sources/S.md')]]);
    expect(scanTagViolations(pm, settings, harvested)).toEqual([]);
    const bad = new Map([['wiki/sources/T.md', page('source', ['other', 'theory'], 'wiki/sources/T.md')]]);
    expect(scanTagViolations(bad, settings, harvested)[0]?.invalidTags).toEqual(['theory']);
  });
});
