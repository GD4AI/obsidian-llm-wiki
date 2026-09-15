import { describe, it, expect } from 'vitest';
import { LLMWikiSettings } from '../../types';
import { enforceFrontmatterConstraints, isBlankSource, mergeFrontmatter, mergeFrontmatterArrayField, parseFrontmatter, preserveFrontmatterReviewTag, replaceFrontmatterArrayField, serializeFrontmatter, upsertFrontmatterField } from '../../core/frontmatter';
import { localDateStamp } from '../../core/format';

describe('isBlankSource', () => {
  it('is true for empty or whitespace-only content', () => {
    expect(isBlankSource('')).toBe(true);
    expect(isBlankSource('   \n\t\n  ')).toBe(true);
  });

  it('is true for frontmatter-only content (no body)', () => {
    expect(isBlankSource('---\ntags: [x]\n---')).toBe(true);
    expect(isBlankSource('---\ntags: [x]\n---\n   \n')).toBe(true);
  });

  it('is false when a real body exists', () => {
    expect(isBlankSource('# Note\nText')).toBe(false);
    expect(isBlankSource('---\ntags: [x]\n---\nBody here.')).toBe(false);
    expect(isBlankSource('![[image.png]]')).toBe(false);
  });
});

describe('upsertFrontmatterField', () => {
  it('adds a new field to existing frontmatter, preserving the body', () => {
    const input = '---\ntype: source\ncreated: 2026-01-01\n---\n\nBody text';
    const result = upsertFrontmatterField(input, 'contentHash', '5-1a2b3c4d');
    expect(result).toContain('contentHash: 5-1a2b3c4d');
    expect(result).toContain('type: source');
    expect(result).toContain('\n\nBody text');
    // The metadata block must still close exactly once.
    expect(result.match(/^---$/gm)?.length).toBe(2);
  });

  it('replaces an existing field rather than duplicating it', () => {
    const input = '---\ntype: source\ncontentHash: old-value\n---\n\nBody';
    const result = upsertFrontmatterField(input, 'contentHash', 'new-value');
    expect(result).toContain('contentHash: new-value');
    expect(result).not.toContain('old-value');
    expect(result.match(/contentHash:/g)?.length).toBe(1);
  });

  it('prepends a frontmatter block when none exists', () => {
    const result = upsertFrontmatterField('Just a body', 'contentHash', '3-deadbeef');
    expect(result).toBe('---\ncontentHash: 3-deadbeef\n---\n\nJust a body');
  });

  it('round-trips through parseFrontmatter', () => {
    const input = '---\ntype: source\n---\n\nBody';
    const result = upsertFrontmatterField(input, 'contentHash', '5-1a2b3c4d');
    expect(parseFrontmatter(result)?.contentHash).toBe('5-1a2b3c4d');
  });
});
describe('parseFrontmatter', () => {
  it('returns null for content without frontmatter', () => {
    expect(parseFrontmatter('# Just a heading\nSome content')).toBeNull();
    expect(parseFrontmatter('')).toBeNull();
  });

  it('parses simple key-value frontmatter', () => {
    const result = parseFrontmatter('---\ntype: entity\n---\nBody content');
    expect(result).toEqual({ type: 'entity' });
  });

  it('parses inline array fields', () => {
    const result = parseFrontmatter('---\naliases: ["监督学习", "Supervised Learning"]\n---\nBody');
    expect(result?.aliases).toEqual(['监督学习', 'Supervised Learning']);
  });

  it('wraps single-value aliases in array', () => {
    const result = parseFrontmatter('---\naliases: CoT\n---\nBody');
    expect(result?.aliases).toEqual(['CoT']);
  });

  it('wraps single-value sources in array', () => {
    const result = parseFrontmatter('---\nsources: "[[machine-learning]]"\n---\nBody');
    expect(result?.sources).toEqual(['[[machine-learning]]']);
  });

  it('wraps single-value tags in array', () => {
    const result = parseFrontmatter('---\ntags: method\n---\nBody');
    expect(result?.tags).toEqual(['method']);
  });

  it('parses multi-line array values', () => {
    const content = '---\ntags:\n  - method\n  - theory\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result?.tags).toEqual(['method', 'theory']);
  });

  it('deletes non-array/non-string value for array-typed fields', () => {
    // "123" is parsed as a string from YAML, so it gets wrapped in array
    // This tests that deletion only happens for truly incompatible types
    const result = parseFrontmatter('---\naliases: 123\n---\nBody');
    expect(result?.aliases).toEqual(['123']);
  });

  it('parses boolean reviewed field', () => {
    const t = parseFrontmatter('---\nreviewed: true\n---\nBody');
    const f = parseFrontmatter('---\nreviewed: false\n---\nBody');
    expect(t?.reviewed).toBe(true);
    expect(f?.reviewed).toBe(false);
  });

  it('reads a bare tags: key as empty, not as one empty entry (S140)', () => {
    // The emitEmptyTags shape: enforceFrontmatterConstraints writes `tags:`
    // bare after stripping every value. Coercing '' to [''] handed
    // mergeFrontmatterArrayField a phantom entry it persisted as `- ""`.
    const result = parseFrontmatter('---\ntype: concept\ntags:\n---\nBody');
    expect(result?.tags).toEqual([]);
  });

  it('drops empty-string entries from array fields (S140)', () => {
    const content = '---\ntags:\n  - ""\n  - "Thema/Pathophysiologie"\n---\nBody';
    const result = parseFrontmatter(content);
    expect(result?.tags).toEqual(['Thema/Pathophysiologie']);
  });
});

describe('enforceFrontmatterConstraints', () => {
  it('returns content unchanged if no frontmatter', () => {
    const input = '# Just a heading\nContent';
    expect(enforceFrontmatterConstraints(input, 'entity')).toBe(input);
  });

  it('enforces type for entity pages', () => {
    const input = '---\ntype: concept\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toContain('type: entity');
  });

  it('enforces type for concept pages', () => {
    const input = '---\ntype: entity\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'concept');
    expect(result).toContain('type: concept');
  });

  it('preserves custom type as tag when enforcing entity/concept', () => {
    const input = '---\ntype: theory\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'concept');
    expect(result).toContain('type: concept');
    expect(result).toContain('theory');
  });

  it('collects and preserves existing tags from inline array', () => {
    // Entity valid tags: person, organization, project, product, event, place, other
    const input = '---\ntype: entity\ntags: [person, project]\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toContain('tags:');
    expect(result).toContain('person');
  });

  it('collects and preserves concept tags from inline array', () => {
    // Concept valid tags: theory, method, field, term, other
    const input = '---\ntype: concept\ntags: [method, theory]\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'concept');
    expect(result).toContain('method');
    expect(result).toContain('theory');
  });

  it('collects and preserves aliases from inline array', () => {
    const input = '---\ntype: concept\naliases: [CoT, 思维链]\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'concept');
    expect(result).toContain('aliases:');
    expect(result).toContain('CoT');
    expect(result).toContain('思维链');
  });

  it('collects aliases from YAML continuation format', () => {
    const input = '---\ntype: concept\naliases:\n  - CoT\n  - 思维链\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'concept');
    expect(result).toContain('aliases:');
    expect(result).toContain('CoT');
    expect(result).toContain('思维链');
  });

  it('preserves reviewed field', () => {
    const input = '---\ntype: entity\nreviewed: true\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toContain('reviewed: true');
  });

  // Reviewed-guard: a user has explicitly marked this page as reviewed.
  // Their tag intent (including empty tags — silence is a choice) must be
  // honored. The function should NOT auto-fill `tags: [other]` / `[term]`
  // when reviewed. Aligns with lint-fixes.ts:439 (skip reviewed) and
  // page-factory.ts:288/308 (reviewed = minimal append).
  it('reviewed-guard: does NOT auto-fill tags fallback when fm.reviewed is true', () => {
    const input = '---\ntype: entity\nreviewed: true\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).not.toContain('tags: [other]');
    expect(result).not.toContain('tags: [term]');
    // The function short-circuits before adding a tags line, so no
    // tags field is emitted at all when the page has reviewed:true.
    expect(result).not.toMatch(/^tags:/m);
  });

  it('reviewed-guard: still strips LLM-hallucinated dates on reviewed pages', () => {
    // The reviewed-guard protects user intent (tags / type / aliases) but
    // date fields are programmatic — a hallucinated "created: 2025-13-99"
    // must still be normalized to today. Safety > user intent on dates.
    const input = '---\ntype: entity\nreviewed: true\ncreated: 2025-13-99\nupdated: 2099-99-99\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    const today = localDateStamp();
    expect(result).toContain('reviewed: true');
    expect(result).toContain(`created: ${today}`);
    expect(result).not.toContain('2025-13-99');
    expect(result).not.toContain('2099-99-99');
  });

  it('reviewed-guard: preserves v6 out-of-vocab intent for reviewed pages', () => {
    // If the LLM previously emitted an out-of-vocab tag and the user
    // accepted it (reviewed: true), we must NOT silently drop the
    // tag in a future retag/merge call. This is the v6 promise for
    // reviewed pages specifically.
    const input = '---\ntype: entity\nreviewed: true\ntags: [Mikrobiologie]\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toContain('Mikrobiologie');
  });

  it('reviewed-guard: is a no-op for non-reviewed pages (control test)', () => {
    // No reviewed: true → existing behavior preserved.
    // v1.18.0 actual behavior: when LLM doesn't emit tags (no
    // `tags:` line in input), the function does NOT write a tags
    // line at all. The fallback `[other]` only fires when the LLM
    // explicitly emitted `tags: []` (a non-empty-but-empty array).
    const input = '---\ntype: entity\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    // No tags line emitted when LLM didn't speak.
    expect(result).not.toMatch(/^tags:/m);
  });

  it('reviewed-guard: stops fallback when user explicitly emptied tags', () => {
    // User sets reviewed: true AND tags: []. LLM might re-emit
    // tags: [] (which would normally trigger fallback to [other]).
    // The reviewed-guard suppresses the fallback — silence is the
    // user's choice, not a default-fill opportunity.
    const input = '---\ntype: entity\nreviewed: true\ntags: []\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).not.toContain('tags: [other]');
    expect(result).not.toContain('tags: [term]');
  });

  it('non-reviewed page with empty tags array emits empty tags field, not fallback', () => {
    // Fix #114: explicit `tags: []` emits `tags:` (empty) rather than
    // silently overwriting with DEFAULT_ENTITY_TAG. User intent must win.
    const input = '---\ntype: entity\ntags: []\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toMatch(/\ntags:\s*(\n|$)/);
    expect(result).not.toContain('tags: [other]');
  });

  it('preserves the caller-supplied created but forces updated to today', () => {
    // Issue #388: the prior value arrives as an argument. The `created:` line
    // in the content is the model's, and is not what gets written.
    const input = '---\ntype: entity\ncreated: 2024-11-03\nupdated: 2026-05-18\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity', undefined, {
      preserveCreated: '2026-01-01',
    });
    const today = localDateStamp();
    expect(result).toContain('created: 2026-01-01');
    expect(result).not.toContain('created: 2024-11-03');
    expect(result).toContain(`updated: ${today}`);
    expect(result).not.toContain('updated: 2026-05-18');
  });

  it('ensures blank line before body', () => {
    const input = '---\ntype: entity\n---\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toContain('---\n\nBody');
  });

  it('keeps out-of-vocab tags and logs a debug note (Issue #85 v6 preserves LLM intent)', () => {
    // v6 behavior change: we no longer silently drop tags that the
    // validator does not recognize. The LLM's output is preserved
    // (with a console.debug note) so the user can see exactly what
    // the model produced and decide whether to expand their custom
    // vocabulary.
    const input = '---\ntype: entity\ntags: [person, invalid_tag]\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toContain('person');
    expect(result).toContain('invalid_tag'); // preserved since v6
  });

  it('uses fallback tag only when no tags at all are collected', () => {
    // v6: if the LLM emitted a non-empty tags array (even with all
    // unrecognized values), we keep them instead of falling back to
    // DEFAULT_ENTITY_TAG. The fallback only kicks in when the tags
    // array is genuinely empty.
    const input = '---\ntype: entity\ntags: [invalid_tag]\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toContain('invalid_tag');
    expect(result).not.toContain('tags: [other]');
  });

  it('emits empty tags field rather than forcing a default when tags array is empty', () => {
    // When a page has tags: [] (genuinely empty), emit tags: (empty) rather than
    // silently overwriting with DEFAULT_ENTITY_TAG. User intent must win. (#114)
    const input = '---\ntype: entity\ntags: []\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    expect(result).toMatch(/\ntags:\s*(\n|$)/);
    expect(result).not.toContain('tags: [other]');
  });

  it('preserves the caller-supplied created on a page that already has one', () => {
    const input = '---\ntype: entity\ncreated: 2024-12-01\nupdated: 2024-12-01\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity', undefined, {
      preserveCreated: '2025-03-20',
    });
    const today = localDateStamp();
    expect(result).toContain('created: 2025-03-20');
    expect(result).toContain(`updated: ${today}`);
    expect(result).not.toContain('updated: 2024-12-01');
  });

  it('adds created/updated when missing from frontmatter', () => {
    const input = '---\ntype: entity\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    const today = localDateStamp();
    expect(result).toContain(`created: ${today}`);
    expect(result).toContain(`updated: ${today}`);
  });

  // ── Issue #388: `created:` provenance ────────────────────────────

  it('ignores a created date the caller did not supply', () => {
    // The generation paths hand this function the model's own reply. Without a
    // prior file there is nothing to preserve, and a date found in that reply
    // is invented by construction.
    const input = '---\ntype: entity\ncreated: 2024-11-03\n---\n\nBody';
    const result = enforceFrontmatterConstraints(input, 'entity');
    const today = localDateStamp();
    expect(result).toContain(`created: ${today}`);
    expect(result).not.toContain('2024-11-03');
  });

  it('ignores a caller value that is not an ISO date', () => {
    const input = '---\ntype: entity\n---\n\nBody';
    const today = localDateStamp();
    for (const bogus of ['gestern', '2025-13-99x', '', '   ']) {
      const result = enforceFrontmatterConstraints(input, 'entity', undefined, {
        preserveCreated: bogus,
      });
      expect(result).toContain(`created: ${today}`);
    }
  });

  it('reviewed-guard: keeps the caller-supplied created instead of stamping today', () => {
    // The reviewed branch returns early and previously forced `created` to
    // today unconditionally, so a reviewed page lost its real creation date on
    // every pass. With the value supplied it survives; without one the branch
    // behaves as before.
    const input = '---\ntype: entity\nreviewed: true\ncreated: 2024-11-03\nupdated: 2020-01-01\n---\n\nBody';
    const today = localDateStamp();

    const withValue = enforceFrontmatterConstraints(input, 'entity', undefined, {
      preserveCreated: '2026-01-05',
    });
    expect(withValue).toContain('created: 2026-01-05');
    expect(withValue).toContain(`updated: ${today}`);

    const withoutValue = enforceFrontmatterConstraints(input, 'entity');
    expect(withoutValue).toContain(`created: ${today}`);
  });

  it('#438 B: preserves block-style sources through a constraints pass', () => {
    const input = [
      '---',
      'type: concept',
      'created: 2026-08-08',
      'sources:',
      '  - "[[sources/a_aaa]]"',
      '  - "[[sources/b_bbb]]"',
      'tags: [term]',
      '---',
      '# X',
      '',
      'body',
    ].join('\n');
    const result = enforceFrontmatterConstraints(input, 'concept');
    const parsed = parseFrontmatter(result);
    // Both source links survive — prior behaviour kept the `sources:` header
    // but discarded every `- ` entry, then never re-emitted the field (#438 B).
    expect(parsed?.sources).toEqual(['[[sources/a_aaa]]', '[[sources/b_bbb]]']);
    expect(parsed?.tags).toEqual(['term']);
  });

  it('#438 B: preserves flow-style sources through a constraints pass', () => {
    const input = [
      '---',
      'type: concept',
      'sources: ["[[sources/a_aaa]]", "[[sources/b_bbb]]"]',
      'tags: [term]',
      '---',
      '# X',
      '',
      'body',
    ].join('\n');
    const result = enforceFrontmatterConstraints(input, 'concept');
    const parsed = parseFrontmatter(result);
    expect(parsed?.sources).toEqual(['[[sources/a_aaa]]', '[[sources/b_bbb]]']);
  });

  // DocTpoint #450 review Finding 1: when a page's `sources:` header has
  // already been emptied by the pre-fix constraints pass (the recovery
  // population this PR is for), `preservedSources` reads as `['']` and
  // the length check passes, so the next constraints pass would write
  // `sources:\n  - ""` instead of omitting the key. The `aliases` branch
  // filters empty entries at `:452`; mirror it here so the recovery
  // population gets a clean read instead of a corrupted re-emit.
  it('#450 Finding 1: omits the sources key entirely when every preserved entry is empty', () => {
    const input = [
      '---',
      'type: concept',
      'created: 2026-08-08',
      'sources:',
      'tags: [term]',
      '---',
      '# X',
      '',
      'body',
    ].join('\n');
    const result = enforceFrontmatterConstraints(input, 'concept');
    // No `sources:` key in the output — the recovery population is not
    // re-corrupted by the fix that protects it.
    expect(result).not.toMatch(/^sources:/m);
    // Tags still propagate normally.
    const parsed = parseFrontmatter(result);
    expect(parsed?.tags).toEqual(['term']);
    expect(parsed?.sources).toBeUndefined();
  });

  it('#450 Finding 1: filters whitespace-only entries alongside truly empty ones', () => {
    const input = [
      '---',
      'type: concept',
      'sources: ["  ", "[[sources/valid]]"]',
      'tags: [term]',
      '---',
      '# X',
      '',
      'body',
    ].join('\n');
    const result = enforceFrontmatterConstraints(input, 'concept');
    const parsed = parseFrontmatter(result);
    expect(parsed?.sources).toEqual(['[[sources/valid]]']);
  });
});

describe('enforceFrontmatterConstraints: minAliasLength reaches the create path', () => {
  const input = '---\ntype: entity\naliases: ["ML", "Maschinelles Lernen"]\n---\n\nBody';
  const opts = { pagePath: 'wiki/entities/machine-learning.md' };

  it('applies the settings floor to model-written aliases at page birth', () => {
    const settings = { minAliasLength: 3 } as unknown as LLMWikiSettings;
    const result = enforceFrontmatterConstraints(input, 'entity', settings, opts);
    expect(result).toContain('Maschinelles Lernen');
    expect(result).not.toContain('"ML"');
  });

  it('keeps the constant floor of 2 when the setting is absent', () => {
    const result = enforceFrontmatterConstraints(input, 'entity', undefined, opts);
    expect(result).toContain('"ML"');
  });
});

describe('serializeFrontmatter', () => {
  it('emits fields in canonical order: type, created, updated, passthrough, sources, tags, reviewed, aliases', () => {
    const block = serializeFrontmatter(
      {
        type: 'entity',
        created: '2026-01-01',
        updated: '2026-07-04',
        sources: ['[[sources/a]]'],
        tags: ['person'],
        reviewed: true,
        aliases: ['Alt'],
      },
      { passthroughLines: ['supersedes: "[[sources/old]]"'], tagStyle: 'block' }
    );
    const order = ['type:', 'created:', 'updated:', 'supersedes:', 'sources:', 'tags:', 'reviewed:', 'aliases:']
      .map(k => block.indexOf(k));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every(i => i !== -1)).toBe(true);
  });

  it('block vs inline tag style', () => {
    const fm = { created: '2026-01-01', updated: '2026-07-04', tags: ['method', 'theory'] };
    expect(serializeFrontmatter(fm, { tagStyle: 'block' })).toContain('tags:\n  - "method"\n  - "theory"');
    expect(serializeFrontmatter(fm, { tagStyle: 'inline' })).toContain('tags: [method, theory]');
  });

  it('emits a bare tags: line only when emitEmptyTags is set', () => {
    const fm = { created: '2026-01-01', updated: '2026-07-04', tags: [] as string[] };
    expect(serializeFrontmatter(fm, { emitEmptyTags: true })).toContain('\ntags:\n');
    expect(serializeFrontmatter(fm, { emitEmptyTags: false })).not.toMatch(/\ntags:/);
  });

  it('dedups aliases, keeping first occurrence and dropping empties', () => {
    const block = serializeFrontmatter({
      created: '2026-01-01', updated: '2026-07-04', aliases: ['A', 'A', '', 'B'],
    });
    expect(block.match(/- "A"/g)?.length).toBe(1);
    expect(block).toContain('- "B"');
  });

  it('omits sources/tags/aliases when absent, and omits type when undefined', () => {
    const block = serializeFrontmatter({ created: '2026-01-01', updated: '2026-07-04' });
    expect(block).toBe('---\ncreated: 2026-01-01\nupdated: 2026-07-04\n---');
  });
});

describe('mergeFrontmatter', () => {
  const today = localDateStamp();

  it('returns body as-is when no frontmatter exists', () => {
    const input = '# Just content\nNo frontmatter';
    const result = mergeFrontmatter(input, 'sources/test.md');
    expect(result.wasMerged).toBe(false);
    expect(result.frontmatter).toBe('');
    expect(result.body).toBe(input);
  });

  it('preserves type and adds source', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/test.md');
    expect(result.frontmatter).toContain('type: entity');
    expect(result.frontmatter).toContain('[[sources/test.md]]');
    expect(result.wasMerged).toBe(true);
  });

  it('does not emit a stray empty wikilink when an existing bare sources field is empty', () => {
    // The create-path stamp calls mergeFrontmatter on enforce output, where a
    // model-written block sources field has been reduced to a bare `sources:`
    // line → parseFrontmatter yields ['']. The empty entry must be dropped.
    const input = '---\ntype: entity\nsources:\ntags:\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/Neurologie');
    expect(result.frontmatter).toContain('[[sources/Neurologie]]');
    expect(result.frontmatter).not.toContain('[[]]');
  });

  it('preserves created date', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/test.md');
    expect(result.frontmatter).toContain('created: 2026-01-01');
  });

  it('updates updated date to today', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/test.md');
    expect(result.frontmatter).toContain(`updated: ${today}`);
  });

  it('merges sources with deduplication', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\nsources: ["[[sources/test]]"]\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/test');
    expect(result.frontmatter).toContain('[[sources/test]]');
    expect(result.frontmatter).toContain('sources:');
  });

  it('preserves existing tags', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags: [method, theory]\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/test.md');
    expect(result.frontmatter).toContain('method');
    expect(result.frontmatter).toContain('theory');
  });

  it('preserves existing aliases', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\naliases: ["CoT", "思维链"]\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/test.md');
    expect(result.frontmatter).toContain('CoT');
    expect(result.frontmatter).toContain('思维链');
  });

  it('preserves reviewed flag', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\nreviewed: true\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/test.md');
    expect(result.frontmatter).toContain('reviewed: true');
  });

  it('normalizes wiki-link format in sources', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\nsources: ["[[sources/old]]"]\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/new');
    expect(result.frontmatter).toContain('[[sources/old]]');
    expect(result.frontmatter).toContain('[[sources/new]]');
  });

  it('deduplicates when new source matches existing plain path source', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\nsources: ["sources/test"]\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/test');
    const count = (result.frontmatter.match(/- "\[\[sources\/test\]\]"/g) || []).length;
    expect(count).toBe(1);
  });

  it('deduplicates when new source matches existing wikilink source', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\nsources: ["[[sources/existing]]"]\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/existing');
    const count = (result.frontmatter.match(/sources\/existing/g) || []).length;
    expect(count).toBe(1);
  });

  it('handles empty sources array gracefully', () => {
    const input = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\nsources: []\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/new');
    expect(result.frontmatter).toContain('[[sources/new]]');
  });

  // Issue #356 follow-up (v1.25.10 PATCH): the array-only helpers
  // (replaceOrInsertYamlListField / replaceFrontmatterArrayField) call
  // extractPassthroughLines and pass the result into serializeFrontmatter so
  // re-touching a page preserves user-authored top-level fields. The full-page
  // rewrite path (mergePage → mergeFrontmatter) was missed in the v1.25.10
  // sweep; borthwick reported 4 entities losing `redirect_to:` after
  // re-ingest of "The Nature of Technology" on 2026-07-29. These tests pin
  // the post-fix behaviour for all three custom fields borthwick's repro
  // exercised (redirect_to / parent_org / source_url) and a fourth common
  // shape (single-line quoted value).
  it('preserves a single-line redirect_to through full-page rewrite (Issue #356 follow-up)', () => {
    const input = `---
type: entity
created: 2026-01-01
updated: 2026-01-01
reviewed: true
redirect_to: "[[external/DeepSeek]]"
sources: ["[[sources/the-great-reorg]]"]
---

Body
`;
    const result = mergeFrontmatter(input, 'sources/the-great-reorg');
    expect(result.frontmatter).toContain('redirect_to: "[[external/DeepSeek]]"');
    expect(result.frontmatter).toContain('reviewed: true');
    expect(result.frontmatter).toContain('[[sources/the-great-reorg]]');
  });

  it('preserves a single-line parent_org through full-page rewrite (Issue #356 follow-up)', () => {
    const input = `---
type: product
created: 2026-01-01
updated: 2026-01-01
parent_org: anthropic
sources: ["[[sources/the-great-reorg]]"]
---

Body
`;
    const result = mergeFrontmatter(input, 'sources/the-great-reorg');
    expect(result.frontmatter).toContain('parent_org: anthropic');
  });

  it('preserves a single-line source_url through full-page rewrite (Issue #356 follow-up)', () => {
    const input = `---
type: organization
created: 2026-01-01
updated: 2026-01-01
source_url: "https://www.anthropic.com/company"
sources: ["[[sources/the-great-reorg]]"]
---

Body
`;
    const result = mergeFrontmatter(input, 'sources/the-great-reorg');
    expect(result.frontmatter).toContain('source_url: "https://www.anthropic.com/company"');
  });

  it('preserves multiple custom fields simultaneously (Issue #356 follow-up)', () => {
    const input = `---
type: entity
created: 2026-01-01
updated: 2026-01-01
redirect_to: "[[p- John Fowles]]"
external_id: "nyt-bestseller-1975"
notion_url: "https://notion.so/abc123"
sources: ["[[sources/the-aristos]]"]
---

Body
`;
    const result = mergeFrontmatter(input, 'sources/the-aristos');
    expect(result.frontmatter).toContain('redirect_to: "[[p- John Fowles]]"');
    expect(result.frontmatter).toContain('external_id: "nyt-bestseller-1975"');
    expect(result.frontmatter).toContain('notion_url: "https://notion.so/abc123"');
  });

  it('deduplicates repeated aliases (parity with enforceFrontmatterConstraints)', () => {
    const input = '---\ntype: concept\ncreated: 2026-01-01\nupdated: 2026-01-01\naliases:\n  - "UPF"\n  - "Ultra-processed food"\n  - "UPF"\n  - "Ultra-processed food"\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/new');
    expect((result.frontmatter.match(/- "UPF"/g) || []).length).toBe(1);
    expect((result.frontmatter.match(/- "Ultra-processed food"/g) || []).length).toBe(1);
  });

  it('drops empty-string aliases', () => {
    const input = '---\ntype: concept\ncreated: 2026-01-01\nupdated: 2026-01-01\naliases:\n  - "Foo"\n  - ""\n---\n\nBody';
    const result = mergeFrontmatter(input, 'sources/new');
    expect(result.frontmatter).toContain('- "Foo"');
    expect(result.frontmatter).not.toContain('- ""');
  });

  // Incoming tags: `sources:` was a union and `tags:` was not, so the stored
  // tag was decided by whichever source reached the page first.
  const tagged = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\ntags:\n  - person\n---\n\nBody';

  it('is byte-identical when no incoming tags are passed', () => {
    const withArg = mergeFrontmatter(tagged, 'sources/new', undefined);
    const without = mergeFrontmatter(tagged, 'sources/new');
    expect(withArg.frontmatter).toBe(without.frontmatter);
    expect(without.frontmatter).toContain('- "person"');
  });

  it('unions an incoming tag with the ones the page already carries', () => {
    const result = mergeFrontmatter(tagged, 'sources/new', ['organization']);
    expect(result.frontmatter).toContain('- "person"');
    expect(result.frontmatter).toContain('- "organization"');
  });

  it('keeps the existing tag first, so the order does not depend on the merge', () => {
    const result = mergeFrontmatter(tagged, 'sources/new', ['organization']);
    expect(result.frontmatter.indexOf('- "person"'))
      .toBeLessThan(result.frontmatter.indexOf('- "organization"'));
  });

  it('does not repeat an incoming tag the page already has', () => {
    const result = mergeFrontmatter(tagged, 'sources/new', ['person']);
    expect((result.frontmatter.match(/- "person"/g) || []).length).toBe(1);
  });

  it('drops empty incoming tags', () => {
    const result = mergeFrontmatter(tagged, 'sources/new', ['']);
    expect(result.frontmatter).toContain('- "person"');
    expect(result.frontmatter).not.toContain('- \n');
  });

  it('adopts the incoming tag when the page carries none', () => {
    const untagged = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n\nBody';
    const result = mergeFrontmatter(untagged, 'sources/new', ['method']);
    expect(result.frontmatter).toContain('- "method"');
  });

  it('a page reached by two sources in either order ends with the same tags', () => {
    const base = '---\ntype: entity\ncreated: 2026-01-01\nupdated: 2026-01-01\n---\n\nBody';
    const aThenB = mergeFrontmatter(
      `${mergeFrontmatter(base, 'sources/a', ['person']).frontmatter}\n\nBody`,
      'sources/b', ['organization']).frontmatter;
    const bThenA = mergeFrontmatter(
      `${mergeFrontmatter(base, 'sources/b', ['organization']).frontmatter}\n\nBody`,
      'sources/a', ['person']).frontmatter;
    const tagsOf = (fm: string) => {
      const block = /\ntags:\n((?: {2}- .*\n)*)/.exec(`${fm}\n`)?.[1] ?? '';
      return (block.match(/- "([^"]+)"/g) || []).sort();
    };
    expect(tagsOf(aThenB)).toEqual(tagsOf(bThenA));
    expect(tagsOf(aThenB)).toEqual(['- "organization"', '- "person"']);
  });
});

describe('preserveFrontmatterReviewTag', () => {
  it('returns newContent as-is when original is not reviewed', () => {
    const orig = '---\ntype: entity\n---\n\nBody';
    const newC = '---\ntype: entity\n---\n\nUpdated body';
    expect(preserveFrontmatterReviewTag(orig, newC)).toBe(newC);
  });

  it('injects reviewed: true when original has reviewed flag but new lacks it', () => {
    const orig = '---\ntype: entity\nreviewed: true\n---\n\nBody';
    const newC = '---\ntype: entity\n---\n\nUpdated body';
    const result = preserveFrontmatterReviewTag(orig, newC);
    expect(result).toContain('reviewed: true');
    expect(result).toContain('Updated body');
  });

  it('does not duplicate reviewed when new already has it', () => {
    const orig = '---\ntype: entity\nreviewed: true\n---\n\nBody';
    const newC = '---\ntype: entity\nreviewed: true\n---\n\nUpdated body';
    const result = preserveFrontmatterReviewTag(orig, newC);
    // Should only appear once
    expect(result.match(/reviewed: true/g)?.length).toBe(1);
  });

  it('returns newContent as-is when it has no frontmatter', () => {
    const orig = '---\ntype: entity\nreviewed: true\n---\n\nBody';
    const newC = '# Just markdown\nNo frontmatter';
    expect(preserveFrontmatterReviewTag(orig, newC)).toBe(newC);
  });
});

describe('enforceFrontmatterConstraints: custom tag vocabulary (Issue #85)', () => {
  const entityContentWithCustomTag = `---
type: entity
tags: [person, Medical_Arzneimittel, bogus]
---

Body content`;

  it('accepts tags from custom vocabulary AND keeps out-of-vocab ones (Issue #85 v6)', () => {
    // v6 behavior change: in-vocab tags are accepted; out-of-vocab
    // tags are ALSO preserved (with a console.debug note) so the
    // user sees the LLM's full intent. Previously the validator
    // silently dropped out-of-vocab tags.
    const customSettings: Partial<LLMWikiSettings> = {
      tagVocabularyMode: 'custom',
      customEntityTags: 'person, organization, Medical_Arzneimittel'
    };
    const result = enforceFrontmatterConstraints(entityContentWithCustomTag, 'entity', customSettings as LLMWikiSettings);
    expect(result).toContain('Medical_Arzneimittel');
    expect(result).toContain('person');
    // "bogus" is also kept (v6 preserve-intent)
    expect(result).toContain('bogus');
  });

  it('falls back to default vocabulary when settings is omitted (backward compat)', () => {
    const content = `---
type: entity
tags: [person, bogus]
---

Body`;
    // No settings → default VALID_ENTITY_TAGS. v6 keeps both tags.
    const result = enforceFrontmatterConstraints(content, 'entity');
    expect(result).toContain('person');
    expect(result).toContain('bogus'); // preserved since v6
  });

  it('respects concept custom vocabulary (in-vocab kept; out-of-vocab also kept in v6)', () => {
    const content = `---
type: concept
tags: [theory, Arzneimittel/Neurologie, nonsense]
---

Body`;
    const customSettings: Partial<LLMWikiSettings> = {
      tagVocabularyMode: 'custom',
      customConceptTags: 'theory, Arzneimittel/Neurologie'
    };
    const result = enforceFrontmatterConstraints(content, 'concept', customSettings as LLMWikiSettings);
    expect(result).toContain('Arzneimittel/Neurologie');
    // v6: nonsense is also kept (preserve LLM intent)
    expect(result).toContain('nonsense');
  });
});

describe('enforceFrontmatterConstraints (Issue #85 v6 — preserve LLM intent)', () => {
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

  it('retains out-of-vocab tags (does NOT silently drop them)', () => {
    // User has default vocabulary (person/organization/…), LLM emits
    // an extra tag "Medical_Arzneimittel" that is not in the default
    // list. v6: keep it so the user can see what the LLM produced and
    // decide whether to expand their vocabulary.
    const content = `---
type: entity
tags: [person, organization, Medical_Arzneimittel]
---

Body`;
    const result = enforceFrontmatterConstraints(content, 'entity', baseSettings);
    expect(result).toContain('person');
    expect(result).toContain('organization');
    expect(result).toContain('Medical_Arzneimittel'); // previously dropped
  });

  it('retains out-of-vocab tags when mode=custom with a narrow vocabulary', () => {
    const customSettings: LLMWikiSettings = { ...baseSettings,
      tagVocabularyMode: 'custom',
      customEntityTags: 'person, organization',
    };
    const content = `---
type: entity
tags: [person, project, company]
---

Body`;
    const result = enforceFrontmatterConstraints(content, 'entity', customSettings);
    // All 3 tags kept (project + company are not in custom vocab but
    // we still preserve them so the user sees the LLM's full intent).
    expect(result).toContain('person');
    expect(result).toContain('project');
    expect(result).toContain('company');
  });

  it('dedupes repeated tags across LLM output', () => {
    const content = `---
type: entity
tags: [person, person, person, organization]
---

Body`;
    const result = enforceFrontmatterConstraints(content, 'entity', baseSettings);
    const tagLine = result.split('\n').find(l => l.startsWith('tags:'))!;
    // Should be exactly one occurrence per unique tag
    expect(tagLine).toBe('tags: [person, organization]');
  });

  it('strips the pageType literal if LLM emitted it as a tag (e.g. tags: [entity, person])', () => {
    const content = `---
type: entity
tags: [entity, person]
---

Body`;
    const result = enforceFrontmatterConstraints(content, 'entity', baseSettings);
    const tagLine = result.split('\n').find(l => l.startsWith('tags:'))!;
    expect(tagLine).toBe('tags: [person]');
  });

  it('preserves nested-tag syntax (Arzneimittel/Neurologie) without splitting', () => {
    const customSettings: LLMWikiSettings = { ...baseSettings,
      tagVocabularyMode: 'custom',
      customEntityTags: 'person, Arzneimittel/Neurologie',
    };
    const content = `---
type: entity
tags: [person, Arzneimittel/Neurologie, organization]
---

Body`;
    const result = enforceFrontmatterConstraints(content, 'entity', customSettings);
    expect(result).toContain('Arzneimittel/Neurologie');
    // The out-of-vocab "organization" is still kept (v6 preserve LLM intent)
    expect(result).toContain('organization');
  });

  it('emits empty tags field when collectedTags is empty, not fallback tag', () => {
    // Fix #114: empty tags array → tags: (empty), not DEFAULT_ENTITY_TAG.
    const content = `---
type: entity
tags: []
---

Body`;
    const result = enforceFrontmatterConstraints(content, 'entity', baseSettings);
    expect(result).toMatch(/\ntags:\s*(\n|$)/);
    expect(result).not.toContain('tags: [other]');
  });
});

// v1.25.10 PATCH Issue #356 — preserve unknown top-level frontmatter fields
// on re-touch (data-loss bug). User-authored metadata like `redirect_to:`,
// `parent_org:`, `source_url:` must survive every merge/replace writer.
describe('frontmatter passthrough — Issue #356', () => {
  it('mergeFrontmatterArrayField preserves an unknown scalar field', () => {
    // Repro from borthwick's report: a hand-written `redirect_to:` is stripped
    // when the merge path rewrites the page after a re-touch.
    const content = `---
type: concept
tags: [original]
redirect_to: "wiki/canonical/page.md"
parent_org: Acme
---

# Body`;
    const result = mergeFrontmatterArrayField(content, 'tags', ['added']);
    expect(result).toContain('redirect_to: "wiki/canonical/page.md"');
    expect(result).toContain('parent_org: Acme');
    // The known fields still update.
    expect(result).toContain('added');
    expect(result).not.toContain('tags: [original]');
  });

  it('replaceFrontmatterArrayField preserves an unknown scalar field', () => {
    const content = `---
type: entity
tags: [x]
parent_org: Globex
source_url: https://example.com/spec
---

# Body`;
    const result = replaceFrontmatterArrayField(content, 'tags', ['y', 'z']);
    expect(result).toContain('parent_org: Globex');
    expect(result).toContain('source_url: https://example.com/spec');
    expect(result).toContain('y');
    expect(result).toContain('z');
  });

  // The seam between the rebuilt block and the body: `serializeFrontmatter`
  // ends on `---` without a trailing newline and the retained slice starts
  // with whatever followed the old closing delimiter, so joining them with a
  // `\n` used to add one blank line per call. Two consecutive calls made it
  // two. Both directions are pinned here.
  it('replaceFrontmatterArrayField keeps exactly one blank line between frontmatter and body', () => {
    const content = `---
type: entity
tags: [x]
---

# Body

Text.
`;
    const once = replaceFrontmatterArrayField(content, 'tags', ['y']);
    expect(once).toContain('---\n\n# Body');
    expect(once).not.toContain('---\n\n\n');

    const twice = replaceFrontmatterArrayField(once, 'tags', ['z']);
    expect(twice).toContain('---\n\n# Body');
    expect(twice).not.toContain('---\n\n\n');
    // The seam is the only thing under test here, so compare the bodies.
    expect(twice.slice(twice.indexOf('\n---\n') + 5)).toBe(once.slice(once.indexOf('\n---\n') + 5));
  });

  it('replaceFrontmatterArrayField inserts the blank line when the body followed on the next line', () => {
    const content = `---
type: entity
tags: [x]
---
# Body`;
    const result = replaceFrontmatterArrayField(content, 'tags', ['y']);
    expect(result).toContain('---\n\n# Body');
  });

  it('mergeFrontmatterArrayField on a page with only canonical fields is byte-identical to v1.25.9', () => {
    // Backward-compat: when no unknown fields exist, the writer must not
    // invent a `---\n---` line just to "have a passthrough section".
    const content = `---
type: concept
tags: [a]
aliases: ["x"]
---

# Body`;
    const before = parseFrontmatter(content);
    const result = mergeFrontmatterArrayField(content, 'tags', ['b']);
    const after = parseFrontmatter(result);
    expect(Object.keys(before!).sort()).toEqual(Object.keys(after!).sort());
  });

  it('mergeFrontmatterArrayField preserves the body verbatim when adding aliases', () => {
    const content = `---
type: concept
redirect_to: "[[somewhere]]"
---

# Heading

Body content with **formatting** and a list:
- one
- two`;
    const result = mergeFrontmatterArrayField(content, 'aliases', ['alt']);
    expect(result).toContain('# Heading');
    expect(result).toContain('Body content with **formatting**');
    expect(result).toContain('- one');
    expect(result).toContain('- two');
    expect(result).toContain('redirect_to: "[[somewhere]]"');
  });

  it('mergeFrontmatterArrayField preserves an unknown list field (YAML block form)', () => {
    // More complex shape: a user-authored list under a non-canonical key.
    const content = `---
type: concept
tags: [a]
related_links:
  - "[[Foo]]"
  - "[[Bar]]"
---

# Body`;
    const result = mergeFrontmatterArrayField(content, 'tags', ['b']);
    expect(result).toContain('related_links:');
    expect(result).toContain('  - "[[Foo]]"');
    expect(result).toContain('  - "[[Bar]]"');
  });
  it('enforceFrontmatterConstraints preserves an unknown scalar field', () => {
    // Control for the block-list case below: the single-line shape has been
    // carried since the #356 follow-up and must stay byte-identical.
    const content = `---
type: concept
tags: [a]
redirect_to: "[[canonical]]"
parent_org: Acme
---

# Body`;
    const result = enforceFrontmatterConstraints(content, 'concept');
    expect(result).toContain('redirect_to: "[[canonical]]"');
    expect(result).toContain('parent_org: Acme');
  });

  it('enforceFrontmatterConstraints preserves an unknown list field (YAML block form)', () => {
    // Same page shape as the array-helper case above, through the constraints
    // pass. Before the fix the pass kept the header line and dropped every
    // `- ` entry beneath it, so a user-owned block list came back as a bare
    // `related_links:` — the key survived, its value did not.
    const content = `---
type: concept
tags: [a]
related_links:
  - "[[Foo]]"
  - "[[Bar]]"
---

# Body`;
    const result = enforceFrontmatterConstraints(content, 'concept');
    expect(result).toContain('related_links:');
    expect(result).toContain('  - "[[Foo]]"');
    expect(result).toContain('  - "[[Bar]]"');
    expect(parseFrontmatter(result)?.related_links).toEqual(['[[Foo]]', '[[Bar]]']);
  });
});

describe('enforceFrontmatterConstraints — aliases that repeat the page filename (create path)', () => {
  // The model writes the frontmatter of a new page itself, and it routinely
  // lists the page's own name among the aliases. `appendAliases` already
  // refuses exactly that via `filterRedundantAliases`; this pass is the other
  // writer of the same field and has to apply the same rule when it knows the
  // page path. Without a path (legacy callers) nothing changes.
  const page = (aliases: string) => `---\ntype: entity\ntags:\n  - other\naliases:\n${aliases}---\n\n## Description\nBody.\n`;

  it('drops an alias equal to the page basename when pagePath is given', () => {
    const out = enforceFrontmatterConstraints(page('  - "CD44"\n'), 'entity', undefined, {
      pagePath: 'wiki/entities/CD44.md',
    });
    expect(out).not.toMatch(/aliases:/);
    expect(out).toContain('## Description\nBody.');
  });

  it('compares case-insensitively, like filterRedundantAliases', () => {
    const out = enforceFrontmatterConstraints(page('  - "cd44"\n'), 'entity', undefined, {
      pagePath: 'wiki/entities/CD44.md',
    });
    expect(out).not.toMatch(/aliases:/);
  });

  it('keeps every alias that is not the basename — including the space-variant of it', () => {
    const out = enforceFrontmatterConstraints(
      page('  - "Interleukin-10"\n  - "IL-10"\n  - "Interleukin 10"\n'),
      'entity',
      undefined,
      { pagePath: 'wiki/entities/Interleukin-10.md' },
    );
    expect(out).toMatch(/aliases:\n  - "IL-10"\n  - "Interleukin 10"\n/);
    expect(out).not.toMatch(/- "Interleukin-10"/);
  });

  it('leaves the list untouched when no pagePath is passed (legacy callers)', () => {
    const out = enforceFrontmatterConstraints(page('  - "CD44"\n'), 'entity');
    expect(out).toMatch(/aliases:\n  - "CD44"\n/);
  });
});

describe('enforceFrontmatterConstraints: domainVocabulary strip (Tag-Achse S138)', () => {
  const content = [
    '---',
    'type: entity',
    'tags: [Sorte/Arzneimittel, Thema/Kardiologie, other]',
    '---',
    '',
    '# X',
  ].join('\n');

  it('strips any tag the domain vocabulary does not carry, flat ones included', () => {
    const out = enforceFrontmatterConstraints(content, 'entity', undefined, {
      domainVocabulary: ['Sorte/Arzneimittel'],
    });
    expect(out).toContain('Sorte/Arzneimittel');
    expect(out).not.toContain('Thema/Kardiologie');
    // the flat type is the training taxonomy leaking through, not an abstention marker
    expect(out).not.toContain('other');
  });

  it('keeps a flat tag the declared folders actually carry', () => {
    const out = enforceFrontmatterConstraints(content, 'entity', undefined, {
      domainVocabulary: ['Sorte/Arzneimittel', 'other'],
    });
    expect(out).toContain('Sorte/Arzneimittel');
    expect(out).toContain('other');
  });

  it('keeps a carried nested tag under fold (case/NFC-insensitive)', () => {
    const out = enforceFrontmatterConstraints(content, 'entity', undefined, {
      domainVocabulary: ['sorte/arzneimittel', 'thema/kardiologie'],
    });
    expect(out).toContain('Sorte/Arzneimittel');
    expect(out).toContain('Thema/Kardiologie');
  });

  it('changes nothing when the option is omitted (retain semantics)', () => {
    const out = enforceFrontmatterConstraints(content, 'entity');
    expect(out).toContain('Thema/Kardiologie');
  });
});

describe('mergeFrontmatterArrayField after a full strip (S140)', () => {
  it('appends domains to a bare tags: key without a phantom "" entry', () => {
    // Regression: model wrote a flat non-harvest tag, the constraints pass
    // stripped it (bare `tags:`), and the stage-4 domain append then wrote
    // `- ""` above the belonging value on 21 live pages.
    const content = '---\ntype: concept\ntags:\n---\n\nBody';
    const result = mergeFrontmatterArrayField(content, 'tags', ['Thema/Pathophysiologie']);
    expect(result).toContain('Thema/Pathophysiologie');
    expect(result).not.toContain('- ""');
  });
});

describe('enforceFrontmatterConstraints: source pages carry the form list next to the vocabulary', () => {
  const page = (tags: string) => [
    '---',
    'type: source',
    `tags: [${tags}]`,
    'source_file: "[[Notizen/X.md]]"',
    '---',
    '',
    '# X - Summary',
  ].join('\n');

  it('keeps a form value and a vocabulary value, drops the model\'s third option', () => {
    // `theory` is what the summary model wrote on one vault instead of `other`
    // — a built-in concept type, legal nowhere on a source page.
    const out = enforceFrontmatterConstraints(page('other, theory, Thema/Schlaf, Thema/Erfunden'), 'source', undefined, {
      domainVocabulary: ['Thema/Schlaf'],
    });
    expect(out).toMatch(/^tags: \[other, Thema\/Schlaf\]$/m);
    expect(out).not.toContain('theory');
    expect(out).not.toContain('Thema/Erfunden');
  });

  it('keeps the unknown source-page fields through the pass', () => {
    const out = enforceFrontmatterConstraints(page('other'), 'source', undefined, { domainVocabulary: [] });
    expect(out).toMatch(/^source_file: "\[\[Notizen\/X\.md\]\]"$/m);
    expect(out).toMatch(/^type: source$/m);
  });

  it('a form value is not legal on an entity page', () => {
    const entity = '---\ntype: entity\ntags: [paper, Sorte/Erkrankung]\n---\n\n# X';
    const out = enforceFrontmatterConstraints(entity, 'entity', undefined, { domainVocabulary: ['Sorte/Erkrankung'] });
    expect(out).toMatch(/^tags: \[Sorte\/Erkrankung\]$/m);
  });
});
