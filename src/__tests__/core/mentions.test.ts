// #244 — Programmatic Mentions-citation writes
//
// Modules under test:
//   - core/mentions-formatter.ts : formatMentionsSection (deterministic emit)
//   - core/mentions-injector.ts : injectMentionsSection (replace LLM-written section)
//
// Both are pure functions — no I/O, no LLM. They run in the page-factory
// post-processing pipeline after the LLM has produced the page body.
//
// Note: core/mentions-verifier.ts was deferred to v1.24.x — the lint
// scanner's scanQuoteGrounding already covers the same Tier 1/2 logic
// via shared helpers in lint/utils.ts.
//
// Design intent (schema-manager.ts:117-128): Mentions is a per-quote
// provenance-to-original link. The link target should land on the verbatim
// source, not a wiki-summary round-trip.

import { describe, it, expect } from 'vitest';
import { formatMentionsSection } from '../../core/mentions-formatter';
import { injectMentionsSection } from '../../core/mentions-injector';
import { normalizeBatchResponse } from '../../wiki/source-analyzer';
import { parseMentionsSection } from '../../core/mentions-parser';

// ─── formatMentionsSection ──────────────────────────────────────────────

describe('formatMentionsSection', () => {
  it('returns empty string when there are no mentions', () => {
    expect(formatMentionsSection([], 'notes/MyNote.md', 'Mentions in Source')).toBe('');
  });

  it('returns empty string when sectionLabel is empty (caller passed empty label)', () => {
    // Defensive: an empty label means the LLM page-gen stripped the
    // section header entirely; formatter should refuse to emit.
    expect(formatMentionsSection(['a quote'], 'notes/MyNote.md', '')).toBe('');
  });

  it('formats a single quote as one bullet line', () => {
    const out = formatMentionsSection(['the quick brown fox'], 'notes/MyNote.md', 'Mentions in Source');
    expect(out).toContain('## Mentions in Source');
    expect(out).toContain('- "the quick brown fox" — [[notes/MyNote|MyNote]]');
  });

  it('strips the .md extension from the link target', () => {
    const out = formatMentionsSection(['q'], 'path/to/note.md', 'Mentions in Source');
    expect(out).toContain('[[path/to/note|note]]');
  });

  it('uses the basename (last path segment) as the display name', () => {
    const out = formatMentionsSection(['q'], 'a/b/c/MyNote.md', 'Mentions in Source');
    expect(out).toContain('|MyNote]]');
    expect(out).not.toContain('|c]]');
  });

  it('preserves verbatim quote text exactly (no transformation)', () => {
    const out = formatMentionsSection(['  spaced  "quote"  '], 'notes/x.md', 'Mentions in Source');
    // Quote text is rendered as-is inside the double quotes.
    expect(out).toContain('- "  spaced  "quote"  " — ');
  });

  it('joins multiple quotes with newlines in order', () => {
    const out = formatMentionsSection(['first', 'second', 'third'], 'notes/x.md', 'Mentions in Source');
    const lines = out.split('\n').filter(l => l.startsWith('- '));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('first');
    expect(lines[1]).toContain('second');
    expect(lines[2]).toContain('third');
  });

  it('truncates at the 500-char total budget, dropping tail quotes', () => {
    const long = 'a'.repeat(200);
    const quotes = [long, long, long, long];
    const out = formatMentionsSection(quotes, 'notes/x.md', 'Mentions in Source');
    expect(out.length).toBeLessThanOrEqual(800); // head + 500 budget + tail space
    const bullets = out.split('\n').filter(l => l.startsWith('- '));
    expect(bullets.length).toBeLessThan(4);
  });

  it('emits only the section header line when mentions is empty (NOT a bare header)', () => {
    // The formatter contract: empty mentions → empty output (caller decides
    // whether to omit the section entirely or show "No specific mentions").
    expect(formatMentionsSection([], 'x.md', 'Mentions in Source')).toBe('');
  });

  it('respects a custom maxChars override', () => {
    const out = formatMentionsSection(['short'], 'x.md', 'Mentions in Source', { maxChars: 80 });
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('handles a wiki/sources/ path as the sourcePath (no double-strip)', () => {
    const out = formatMentionsSection(['q'], 'wiki/sources/article.md', 'Mentions in Source');
    // Should still strip the trailing .md, leaving wiki/sources/article.
    expect(out).toContain('[[wiki/sources/article|article]]');
  });
});

// ─── formatMentionsSection — MentionWithProvenance input ────────────────

describe('formatMentionsSection (with MentionWithProvenance input)', () => {
  it('formats mentions_with_provenance in source-timestamp order', () => {
    const mentions = [
      { quote: 'b quote', source_path: 'a.md', source_slug: 'a', extracted_at: '2026-01-02T00:00:00Z' },
      { quote: 'a quote', source_path: 'b.md', source_slug: 'b', extracted_at: '2026-01-01T00:00:00Z' },
    ];
    const out = formatMentionsSection(mentions, 'default.md', 'Mentions in Source');
    // 'a quote' (earlier extracted_at) should come BEFORE 'b quote' (later).
    const aIdx = out.indexOf('a quote');
    const bIdx = out.indexOf('b quote');
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeLessThan(bIdx);
  });

  it('dedups identical quotes appearing in multiple sources', () => {
    const mentions = [
      { quote: 'shared quote', source_path: 'a.md', source_slug: 'a', extracted_at: '2026-01-01T00:00:00Z' },
      { quote: 'shared quote', source_path: 'b.md', source_slug: 'b', extracted_at: '2026-01-02T00:00:00Z' },
    ];
    const out = formatMentionsSection(mentions, 'default.md', 'Mentions in Source');
    const occurrences = (out.match(/shared quote/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('falls back to legacy string[] when MentionWithProvenance not provided', () => {
    const out = formatMentionsSection(['legacy quote'], 'notes/x.md', 'Mentions in Source');
    expect(out).toContain('legacy quote');
    expect(out).toContain('[[notes/x|x]]');
  });

  // ── Cross-language translation (verbatim + optional translation) ────

  it('renders quote without translation when translation field absent (single-language wiki)', () => {
    const mentions = [{
      quote: 'Machine learning is a subset of AI',
      source_path: 'notes/x.md',
      source_slug: 'x',
      extracted_at: '2026-07-05T00:00:00Z',
    }];
    const out = formatMentionsSection(mentions, 'default.md', 'Mentions in Source');
    expect(out).toContain('- "Machine learning is a subset of AI" — [[notes/x|x]]');
    expect(out).not.toContain('(');   // no half-width parens around translation
  });

  it('renders verbatim German quote followed by half-width paren translation', () => {
    const mentions = [{
      quote: 'Maschinelles Lernen ist ein Teilgebiet der künstlichen Intelligenz',
      translation: '机器学习是人工智能的一个子领域',
      source_path: 'notes/de.md',
      source_slug: 'de',
      extracted_at: '2026-07-05T00:00:00Z',
    }];
    const out = formatMentionsSection(mentions, 'default.md', 'Mentions in Source');
    expect(out).toContain('"Maschinelles Lernen ist ein Teilgebiet der künstlichen Intelligenz" (机器学习是人工智能的一个子领域)');
    // half-width parens
    expect(out).toContain('(');
    expect(out).toContain(')');
  });

  it('renders Classical Chinese quote followed by Simplified Chinese translation', () => {
    const mentions = [{
      quote: '學而時習之，不亦說乎',
      translation: '学习并经常温习它，不也是愉快的吗',
      source_path: 'notes/analects.md',
      source_slug: 'analects',
      extracted_at: '2026-07-05T00:00:00Z',
    }];
    const out = formatMentionsSection(mentions, 'default.md', 'Mentions in Source');
    expect(out).toContain('"學而時習之，不亦說乎" (学习并经常温习它，不也是愉快的吗)');
  });

  it('skips empty-string translation (treats it as absent)', () => {
    const mentions = [{
      quote: 'verbatim',
      translation: '',
      source_path: 'notes/x.md',
      source_slug: 'x',
      extracted_at: '2026-07-05T00:00:00Z',
    }];
    const out = formatMentionsSection(mentions, 'default.md', 'Mentions in Source');
    expect(out).toContain('- "verbatim" — ');
    expect(out).not.toContain('()');
  });

  it('mixed: some quotes have translation, some do not', () => {
    const mentions = [
      { quote: 'verbatim A', translation: '翻译 A', source_path: 'a.md', source_slug: 'a', extracted_at: '2026-07-05T00:00:00Z' },
      { quote: 'verbatim B', source_path: 'b.md', source_slug: 'b', extracted_at: '2026-07-05T00:00:00Z' },
    ];
    const out = formatMentionsSection(mentions, 'default.md', 'Mentions in Source');
    expect(out).toContain('"verbatim A" (翻译 A)');
    expect(out).toContain('"verbatim B" — ');  // no parens after B
    expect(out).not.toContain('"verbatim B" (');
  });
});

// ─── formatMentionsSection — conversation mode (Issue #244 manual fix) ────

describe('formatMentionsSection — conversation mode', () => {
  it('renders a single programmatic citation when conversationMode is true', () => {
    const out = formatMentionsSection(
      [],   // empty mentions array — ignored in conversation mode
      'wiki/sources/my-conversation.md',
      'Mentions in Source',
      { conversationMode: true, conversationLabel: 'Conversation: my-conversation' }
    );
    expect(out).toContain('## Mentions in Source');
    expect(out).toContain('(Conversation: my-conversation) — [[wiki/sources/my-conversation|my-conversation]]');
  });

  it('falls back to default label when conversationLabel is missing', () => {
    const out = formatMentionsSection(
      [],
      'wiki/sources/abc.md',
      'Mentions in Source',
      { conversationMode: true }
    );
    expect(out).toContain('(this conversation) — ');
  });

  it('ignores mentions array content in conversation mode', () => {
    // Even with structured provenance provided, conversation mode ignores it.
    const mentions = [{
      quote: 'should be ignored',
      source_path: 'a.md',
      source_slug: 'a',
      extracted_at: '2026-07-05T00:00:00Z',
    }];
    const out = formatMentionsSection(
      mentions,
      'wiki/sources/conv.md',
      'Mentions in Source',
      { conversationMode: true, conversationLabel: 'Conversation: conv' }
    );
    expect(out).not.toContain('should be ignored');
    expect(out).toContain('Conversation: conv');
  });

  it('does not enter conversation mode when flag is false', () => {
    const out = formatMentionsSection([], 'wiki/sources/abc.md', 'Mentions in Source');
    expect(out).toBe('');  // empty mentions → empty output (normal behavior)
  });
});

// ─── injectMentionsSection ──────────────────────────────────────────────

describe('injectMentionsSection', () => {
  const sectionLabel = 'Mentions in Source';

  it('appends the section when body has no existing Mentions section', () => {
    const body = '# Foo\n\nSome summary text.';
    const out = injectMentionsSection(body, ['a quote'], 'notes/Foo.md', { sectionLabel });
    expect(out).toContain('Some summary text.');
    expect(out).toContain('## Mentions in Source');
    expect(out).toContain('- "a quote"');
  });

  it('replaces an LLM-written Mentions section when present', () => {
    const body = [
      '# Foo',
      '',
      '## Mentions in Source',
      '- "LLM-fabricated quote that is NOT in source" — [[notes/Foo|Foo]]',
      '- "another fake quote"',
      '',
      '## Other Section',
      'body',
    ].join('\n');
    const out = injectMentionsSection(body, ['real quote'], 'notes/Foo.md', { sectionLabel });
    expect(out).not.toContain('LLM-fabricated');
    expect(out).not.toContain('another fake quote');
    expect(out).toContain('## Mentions in Source');
    expect(out).toContain('- "real quote"');
    expect(out).toContain('## Other Section'); // preserved
  });

  it('preserves the Mentions section of a reviewed page (pageIsReviewed)', () => {
    const body = [
      '# Foo',
      '',
      '## Mentions in Source',
      '- "user-curated quote" — [[notes/Foo|Foo]]',
      '',
    ].join('\n');
    const out = injectMentionsSection(body, ['replacement quote'], 'notes/Foo.md', {
      sectionLabel,
      pageIsReviewed: true,
    });
    expect(out).toBe(body); // reviewed page → returned untouched
    expect(out).toContain('user-curated quote');
    expect(out).not.toContain('replacement quote');
  });

  it('does not duplicate the section when called twice', () => {
    const body = '# Foo\n\n## Summary\n\nsomething.';
    const first = injectMentionsSection(body, ['q1'], 'notes/Foo.md', { sectionLabel });
    const second = injectMentionsSection(first, ['q2'], 'notes/Foo.md', { sectionLabel });
    const matches = second.match(/## Mentions in Source/g) || [];
    expect(matches.length).toBe(1);
    // Latest quotes should win on second invocation.
    expect(second).toContain('q2');
    expect(second).not.toContain('q1');
  });

  it('places the section at the end of the body (after all other sections)', () => {
    const body = [
      '# Foo',
      '',
      '## Summary',
      'summary text',
      '',
      '## Related Entities',
      'related entities body',
    ].join('\n');
    const out = injectMentionsSection(body, ['q'], 'notes/Foo.md', { sectionLabel });
    const relatedIdx = out.indexOf('## Related Entities');
    const mentionsIdx = out.indexOf('## Mentions in Source');
    expect(mentionsIdx).toBeGreaterThan(relatedIdx);
  });

  it('handles empty body gracefully (creates section at end of nothing)', () => {
    const out = injectMentionsSection('', ['q'], 'notes/x.md', { sectionLabel });
    expect(out).toContain('## Mentions in Source');
    expect(out).toContain('- "q"');
  });

  it('returns body unchanged when mentions are empty AND no existing section', () => {
    const out = injectMentionsSection('# Foo\n\nSome content.', [], 'notes/x.md', { sectionLabel });
    expect(out).not.toContain('## Mentions in Source');
    expect(out).toContain('Some content.');
  });
});

// ─── normalizeBatchResponse (source-analyzer) integration ──────────────

describe('normalizeBatchResponse — fillMentionsWithProvenance (#244)', () => {
  it('preserves existing mentions_with_provenance when LLM returned it', () => {
    const raw = {
      entities: [{
        name: 'Entity One',
        type: 'person' as const,
        summary: 'Test',
        mentions_in_source: ['legacy quote'],
        mentions_with_provenance: [{ quote: 'structured quote', source_path: 'x.md', source_slug: 'x', extracted_at: '2026-07-05T00:00:00Z' }],
      }],
      concepts: [],
    };
    const { data } = normalizeBatchResponse(raw, 'note.md');
    expect(data.entities[0].mentions_with_provenance).toHaveLength(1);
    expect(data.entities[0].mentions_with_provenance![0].quote).toBe('structured quote');
    // Manual-test fix: when both fields are present, legacy is cleared to avoid
    // duplicate mention data in the analysis log.
    expect(data.entities[0].mentions_in_source).toBeUndefined();
  });

  it('auto-fills mentions_with_provenance from legacy mentions_in_source when absent', () => {
    const raw = {
      entities: [{
        name: 'Entity A',
        type: 'person' as const,
        summary: 'Test',
        mentions_in_source: ['quote A', 'quote B'],
      }],
      concepts: [],
    };
    const { data } = normalizeBatchResponse(raw, 'note.md');
    expect(data.entities[0].mentions_with_provenance).toHaveLength(2);
    expect(data.entities[0].mentions_with_provenance![0].quote).toBe('quote A');
    expect(data.entities[0].mentions_with_provenance![1].quote).toBe('quote B');
    // extracted_at should be set to an ISO string
    expect(data.entities[0].mentions_with_provenance![0].extracted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles empty mentions_in_source without error', () => {
    const raw = {
      entities: [{ name: 'Entity X', type: 'person' as const, summary: '', mentions_in_source: [] }],
      concepts: [],
    };
    const { data } = normalizeBatchResponse(raw, 'note.md');
    expect(data.entities[0].mentions_with_provenance).toBeUndefined();
  });

  it('auto-fills for concepts as well as entities', () => {
    const raw = {
      entities: [],
      concepts: [{
        name: 'Concept A',
        type: 'theory' as const,
        summary: 'Test',
        mentions_in_source: ['concept quote'],
        related_concepts: [],
      }],
    };
    const { data } = normalizeBatchResponse(raw, 'note.md');
    expect(data.concepts[0].mentions_with_provenance).toHaveLength(1);
    expect(data.concepts[0].mentions_with_provenance![0].quote).toBe('concept quote');
  });

  // Issue #679: the prompt asks the model to copy the note path into every
  // quote, and downstream `m.source_path || defaultSourcePath` let the copy
  // win. Measured copies: a typo (`Zytokines`), a control character for `α`,
  // a translation (`Omega-3-Fatty-Acids`). Every quote of a batch comes from
  // the note being ingested, and the code knows its path.
  it('replaces a model-copied source_path with the note path the code passes', () => {
    const raw = {
      entities: [],
      concepts: [{
        name: 'JAK-STAT',
        type: 'phenomenon' as const,
        summary: 'Test',
        mentions_in_source: [],
        mentions_with_provenance: [
          { quote: 'fördert Th17-Differenzierung', source_path: 'Notizen/Zytokines.md', source_slug: 'zytokines', extracted_at: '2026-09-11T00:00:00Z' },
          { quote: 'Akute-Phase-Proteine', source_path: '', source_slug: '', extracted_at: '2026-09-11T00:00:00Z' },
        ],
        related_concepts: [],
      }],
    };
    const { data } = normalizeBatchResponse(raw, 'Notizen/Zytokine.md');
    const paths = data.concepts[0].mentions_with_provenance!.map(m => m.source_path);
    expect(paths).toEqual(['Notizen/Zytokine.md', 'Notizen/Zytokine.md']);
    expect(data.concepts[0].mentions_with_provenance![0].quote).toBe('fördert Th17-Differenzierung');
  });

  it('gives synthesized provenance the note path as well', () => {
    const raw = {
      entities: [{ name: 'TNF-α', type: 'other' as const, summary: 'Test', mentions_in_source: ['TNF-α treibt die Entzündung'] }],
      concepts: [],
    };
    const { data } = normalizeBatchResponse(raw, 'Notizen/TNF-α.md');
    expect(data.entities[0].mentions_with_provenance![0].source_path).toBe('Notizen/TNF-α.md');
  });
});

// v1.25.10 PATCH Issue #363 — parser tolerance for empty-target bullets.
//
// A formatter-produced bullet has shape `- "quote" — [[leftPath|display]]`
// with `leftPath` non-empty by construction. The legacy #289 path also has
// non-empty targets by construction. v1.25.9's strict parser rejected
// lines where the LLM's `source_path` was empty (e.g. an auto-provenance
// builder emitting ""), the page was frozen by the #267 fail-safe, and
// never accumulated another quote.
//
// After the formatter-side fix in Step 1, this should never happen on
// newly-written pages. But the parser also needs to be tolerant so that
// pages that already carry the broken line self-heal on next ingest:
// the parse must succeed, the broken line must be recoverable as
// `sourcePath: ''` (so the re-emit has somewhere to anchor via the
// section's sourcePath fallback), and the page must not flip
// `fullyParsed` to false.
describe('parseMentionsSection — Issue #363 self-heal on empty link', () => {
  it('accepts a formatter-style bullet with an empty link target', () => {
    const body = `## Mentions in Source

- "verbatim quote" — [[|]]
`;
    const parsed = parseMentionsSection(body, 'Mentions in Source');
    expect(parsed.found).toBe(true);
    expect(parsed.fullyParsed).toBe(true);
    expect(parsed.mentions.length).toBe(1);
    expect(parsed.mentions[0].quote).toBe('verbatim quote');
    expect(parsed.mentions[0].source_path).toBe('');
  });

  it('mixes empty and non-empty targets without flipping fullyParsed', () => {
    const body = `## Mentions in Source

- "q1" — [[sources/x|x]]
- "q2" — [[|]]
- "q3" — [[sources/y|y]]
`;
    const parsed = parseMentionsSection(body, 'Mentions in Source');
    expect(parsed.fullyParsed).toBe(true);
    expect(parsed.mentions.length).toBe(3);
    expect(parsed.mentions[0].source_path).toBe('sources/x');
    expect(parsed.mentions[1].source_path).toBe('');
    expect(parsed.mentions[2].source_path).toBe('sources/y');
  });
});
