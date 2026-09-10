// Coverage for the #399 fix in appendSourceSlugToFrontmatter — the
// v1.25.11 provenance stamp previously inserted a duplicate block-style
// `sources:` key when the existing key was flow-style, producing invalid
// YAML. The fix detects flow-style and merges into it (re-emitting as
// block-style canonical shape).
//
// PR #405 review update: block-style entries MUST be double-quoted
// (`  - "[[value]]"`), not bare (`  - [[value]]`). The bare form is
// YAML-parsed as a NESTED flow sequence, not a string, which breaks
// Obsidian's Properties panel + backlinks + graph edges. The tests
// below assert the quoted output AND parse the resulting frontmatter
// with a real YAML parser (yaml, YAML 1.2 — same spec as js-yaml which
// Obsidian uses under the hood) to guarantee `sources` is `string[]`.

import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { appendSourceSlugToFrontmatter } from '../../../wiki/page-factory/create-page';

/** Extract the first `---`-delimited frontmatter block and YAML-parse it. */
function parseFrontmatter(content: string): Record<string, unknown> {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error('no frontmatter block found');
  return parseYaml(m[1]) as Record<string, unknown>;
}

describe('appendSourceSlugToFrontmatter (#399)', () => {
  it('merges into an existing FLOW-style sources key (single entry) — re-emits as block-style, no duplicate key', () => {
    const before = [
      '---',
      'type: concept',
      'sources: ["[[sources/Existing]]"]',
      'tags: [term]',
      '---',
      '',
      '# Title',
      '',
    ].join('\n');
    const out = appendSourceSlugToFrontmatter(before, 'New-Source_abcdef');
    // Exactly ONE sources: key
    const sourcesKeys = out.split('\n').filter(l => /^sources:/.test(l));
    expect(sourcesKeys.length).toBe(1);
    // Block-style with both entries preserved, in insertion order — QUOTED (see PR #405)
    expect(out).toContain('sources:\n  - "[[sources/Existing]]"\n  - "[[sources/New-Source_abcdef]]"');
  });

  it('merges into an existing FLOW-style sources key (multiple entries)', () => {
    const before = [
      '---',
      'type: concept',
      'sources: ["[[sources/A]]", "[[sources/B]]"]',
      'tags: [term]',
      '---',
      '',
      '# Title',
      '',
    ].join('\n');
    const out = appendSourceSlugToFrontmatter(before, 'C');
    const sourcesKeys = out.split('\n').filter(l => /^sources:/.test(l));
    expect(sourcesKeys.length).toBe(1);
    expect(out).toContain('sources:\n  - "[[sources/A]]"\n  - "[[sources/B]]"\n  - "[[sources/C]]"');
  });

  it('is idempotent when the new source is already present in flow-style', () => {
    const before = [
      '---',
      'type: concept',
      'sources: ["[[sources/Existing]]"]',
      'tags: [term]',
      '---',
      '',
      '# Title',
      '',
    ].join('\n');
    const out = appendSourceSlugToFrontmatter(before, 'Existing');
    // Unchanged
    expect(out).toBe(before);
  });

  it('still handles the block-style existing sources key (regression guard)', () => {
    const before = [
      '---',
      'type: concept',
      'sources:',
      '  - "[[sources/Existing]]"',
      'tags: [term]',
      '---',
      '',
      '# Title',
      '',
    ].join('\n');
    const out = appendSourceSlugToFrontmatter(before, 'New');
    const sourcesKeys = out.split('\n').filter(l => /^sources:/.test(l));
    expect(sourcesKeys.length).toBe(1);
    expect(out).toContain('sources:\n  - "[[sources/Existing]]"\n  - "[[sources/New]]"');
  });

  it('inserts a fresh block-style sources: when the key is absent', () => {
    const before = [
      '---',
      'type: concept',
      'tags: [term]',
      '---',
      '',
      '# Title',
      '',
    ].join('\n');
    const out = appendSourceSlugToFrontmatter(before, 'First');
    expect(out).toContain('sources:\n  - "[[sources/First]]"');
    expect(out).toContain('tags: [term]');
  });

  // PR #405 review — parser-shape regression guard.
  //
  // The string `contains` assertions above would silently pass even if the
  // emitted format were unquoted (`- [[value]]`), which YAML parses as a
  // nested flow sequence instead of a string and breaks user-visible output
  // in Obsidian's Properties panel. These tests parse the resulting
  // frontmatter with a real YAML parser and assert `sources` is a flat
  // string array — the shape Obsidian's property-type detection needs.
  describe('PR #405: parser-shape guard — sources must be string[], not nested array', () => {
    it('flow → block merge produces sources parseable as string[]', () => {
      const before = [
        '---',
        'type: concept',
        'sources: ["[[sources/Existing]]"]',
        'tags: [term]',
        '---',
        '',
        '# Title',
        '',
      ].join('\n');
      const out = appendSourceSlugToFrontmatter(before, 'New');
      const parsed = parseFrontmatter(out);
      const sources = parsed.sources;
      expect(Array.isArray(sources)).toBe(true);
      // Every entry must be a plain string containing the wikilink literal.
      // A nested-array bug would surface here as `[["sources/Existing"]]`.
      for (const entry of sources as unknown[]) {
        expect(typeof entry).toBe('string');
        expect(entry as string).toMatch(/^\[\[sources\/.+\]\]$/);
      }
      expect(sources).toEqual([
        '[[sources/Existing]]',
        '[[sources/New]]',
      ]);
    });

    it('fresh insertion produces sources parseable as string[]', () => {
      const before = [
        '---',
        'type: concept',
        'tags: [term]',
        '---',
        '',
        '# Title',
        '',
      ].join('\n');
      const out = appendSourceSlugToFrontmatter(before, 'First');
      const parsed = parseFrontmatter(out);
      expect(parsed.sources).toEqual(['[[sources/First]]']);
    });

    it('block-style merge stays parseable as string[]', () => {
      const before = [
        '---',
        'type: concept',
        'sources:',
        '  - "[[sources/Existing]]"',
        'tags: [term]',
        '---',
        '',
        '# Title',
        '',
      ].join('\n');
      const out = appendSourceSlugToFrontmatter(before, 'New');
      const parsed = parseFrontmatter(out);
      expect(parsed.sources).toEqual([
        '[[sources/Existing]]',
        '[[sources/New]]',
      ]);
    });
  });

  // PR #405 review — @DocTpoint notes A and B.
  //
  // A. "Flow heals, block doesn't": the block-append branch previously
  //    only spliced one new line, so a v1.25.11-stamped file (with bare
  //    `- [[x]]` continuation entries) ended up with a correct new entry
  //    next to a broken bare one. The block branch now re-emits the whole
  //    block from a Set, normalizing legacy entries on touch.
  //
  // B. The quote-tolerant dedup path had no test feeding legacy unquoted
  //    block input.
  //
  // These cases feed the exact shape a real v1.25.11 vault carries today
  // and assert both the healing behavior AND idempotency against it.
  describe('PR #405 note A/B: legacy bare block-style entries heal on touch', () => {
    it('bare entries get re-emitted as quoted when a new entry is appended', () => {
      const before = [
        '---',
        'type: concept',
        'sources:',
        '  - [[sources/Existing]]',  // legacy bare
        'tags: [term]',
        '---',
        '',
        '# Title',
        '',
      ].join('\n');
      const out = appendSourceSlugToFrontmatter(before, 'New');
      // Both entries end up quoted — the old one heals.
      expect(out).toContain('sources:\n  - "[[sources/Existing]]"\n  - "[[sources/New]]"');
      // No bare `- [[x]]` continuation lines survive.
      expect(out).not.toMatch(/^\s*-\s+\[\[/m);
      // Parser-shape guard: sources is a flat string array, both entries strings.
      const parsed = parseFrontmatter(out);
      expect(parsed.sources).toEqual([
        '[[sources/Existing]]',
        '[[sources/New]]',
      ]);
    });

    it('bare + quoted mixed continuation lines heal on touch (no duplication)', () => {
      // The exact shape a v1.25.11 vault could carry: an old bare entry
      // plus a newer quoted one, from two separate provenance stamps.
      const before = [
        '---',
        'type: concept',
        'sources:',
        '  - [[sources/OldBare]]',
        '  - "[[sources/NewerQuoted]]"',
        'tags: [term]',
        '---',
        '',
        '# Title',
        '',
      ].join('\n');
      const out = appendSourceSlugToFrontmatter(before, 'ThirdEntry');
      expect(out).toContain(
        'sources:\n  - "[[sources/OldBare]]"\n  - "[[sources/NewerQuoted]]"\n  - "[[sources/ThirdEntry]]"',
      );
      const parsed = parseFrontmatter(out);
      expect(parsed.sources).toEqual([
        '[[sources/OldBare]]',
        '[[sources/NewerQuoted]]',
        '[[sources/ThirdEntry]]',
      ]);
    });

    it('is idempotent against a legacy bare entry (dedup strips quotes on both sides)', () => {
      const before = [
        '---',
        'type: concept',
        'sources:',
        '  - [[sources/Existing]]',  // legacy bare
        'tags: [term]',
        '---',
        '',
        '# Title',
        '',
      ].join('\n');
      // Try to stamp the same source again — should be a no-op.
      const out = appendSourceSlugToFrontmatter(before, 'Existing');
      expect(out).toBe(before);
    });

    it('is idempotent against a legacy bare entry when the new stamp uses the target slug', () => {
      // Same as above but the "new" stamp uses the same slug the legacy
      // entry pointed to — proves the strip-both dedup catches it before
      // we go re-emit the block.
      const before = [
        '---',
        'type: concept',
        'sources:',
        '  - [[sources/Alpha]]',
        '  - [[sources/Beta]]',
        'tags: [term]',
        '---',
        '',
        '# Title',
        '',
      ].join('\n');
      const out = appendSourceSlugToFrontmatter(before, 'Beta');
      expect(out).toBe(before);
    });

    it('#438 A: does not introduce a blank line after the opening `---` when appending a source', () => {
      const before = [
        '---',
        'type: concept',
        'created: 2026-08-08',
        'sources:',
        '  - "[[sources/a_aaa]]"',
        'tags: [term]',
        '---',
        '# X',
        '',
        'body',
      ].join('\n');
      const out = appendSourceSlugToFrontmatter(before, 'b_bbb');
      const lines = out.split('\n');
      // line index 1 is the first frontmatter line — must not be blank (#438 A)
      expect(lines[0]).toBe('---');
      expect(lines[1]).toBe('type: concept');
      // Sources preserved + new one appended
      expect(out).toContain('  - "[[sources/a_aaa]]"');
      expect(out).toContain('  - "[[sources/b_bbb]]"');
    });
  });
});

// local patch (S142): the create path drops model-written `sources:` before
// stamping the true source — fabricated provenance is worse than none.
import { dropSourcesField } from '../../../wiki/page-factory/create-page';

describe('dropSourcesField (S142 create-path provenance guard)', () => {
  it('removes a block-style sources list, keeping every other field', () => {
    const input = '---\ntype: concept\nsources:\n  - "[[sources/Metabolismus_Übersicht]]"\n  - "[[sources/Acetylsalicylsäure]]"\ntags:\n  - "Thema/Diagnostik"\n---\n\n# Titel\n';
    const out = dropSourcesField(input);
    expect(out).not.toContain('sources:');
    expect(out).toContain('type: concept');
    expect(out).toContain('tags:');
    expect(out).toContain('# Titel');
  });

  it('removes a block-style list whose items sit at column 0', () => {
    const input = '---\ntype: entity\nsources:\n- "[[sources/A]]"\n- "[[sources/B]]"\ntags: [x]\n---\n\nBody\n';
    expect(dropSourcesField(input)).toBe('---\ntype: entity\ntags: [x]\n---\n\nBody\n');
  });

  it('removes a flow-style sources line', () => {
    const input = '---\ntype: entity\nsources: ["[[sources/X]]"]\n---\n\nBody\n';
    expect(dropSourcesField(input)).toBe('---\ntype: entity\n---\n\nBody\n');
  });

  it('leaves content without sources or frontmatter unchanged (same reference)', () => {
    const noFm = '# Nur Body\n';
    expect(dropSourcesField(noFm)).toBe(noFm);
    const noSources = '---\ntype: entity\n---\n\nBody\n';
    expect(dropSourcesField(noSources)).toBe(noSources);
  });

  it('drop + append leaves exactly the one true source', () => {
    const input = '---\ntype: concept\nsources:\n  - "[[sources/Erfunden]]"\n---\n\nBody\n';
    const out = appendSourceSlugToFrontmatter(dropSourcesField(input), 'Acetylsalicylsäure');
    expect(out).toContain('[[sources/Acetylsalicylsäure]]');
    expect(out).not.toContain('Erfunden');
  });
});
