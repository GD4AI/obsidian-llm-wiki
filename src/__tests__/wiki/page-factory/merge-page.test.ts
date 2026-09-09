// Module-level unit tests for page-factory/merge-page.ts
//
// v1.24.1 Phase 2 refactor: mergePage and appendToReviewedPage were lifted
// out of PageFactory. The tests pin the #216 triage routing (skip /
// complementary / merge / contradictory), the NO_NEW_CONTENT fallback path,
// and the reviewed-page lock (pageIsReviewed: true flag passed to
// injectMentionsSection).

import { describe, it, expect } from 'vitest';
import {
  mergePage,
  appendToReviewedPage,
  type MergeContext,
} from '../../../wiki/page-factory/merge-page';
import { createMockEntity } from '../../__support__/factories';
import type { LLMWikiSettings, LLMClient } from '../../../types';

function makeCtx(client: LLMClient | null = null): MergeContext & { written: Map<string, string> } {
  const written = new Map<string, string>();
  return {
    written,
    app: {
      vault: {
        getMarkdownFiles: () => [],
        read: async (f: { path: string }): Promise<string> => written.get(f.path) ?? '',
      },
    },
    settings: {
      wikiFolder: 'wiki',
      wikiLanguage: 'en',
      slugCase: 'preserve',
      disableThinking: false,
    } as LLMWikiSettings,
    async tryReadFile(p: string): Promise<string | null> {
      return written.get(p) ?? null;
    },
    async createOrUpdateFile(p: string, c: string): Promise<void> {
      written.set(p, c);
    },
    getClient: () => client,
    buildSystemPrompt: async () => 'system',
  };
}

function makeClient(responses: string[]): LLMClient {
  let i = 0;
  return {
    createMessage: async () => responses[i++] ?? 'NO_NEW_CONTENT',
  };
}

const EXISTING = `---\ntitle: Caching\n---\n\n## Description\nOld text.\n`;

describe('mergePage — client precondition', () => {
  it('throws when no LLM client is configured', async () => {
    const ctx = makeCtx(null);
    await expect(
      mergePage(ctx, createMockEntity({ name: 'X' }), 'entity', { path: 'p.md', basename: 'p.md' }, EXISTING, [], 'wiki/entities/x.md'),
    ).rejects.toThrow(/LLM client not initialized/);
  });
});

describe('mergePage — triage=skip preserves body', () => {
  it('writes back existing body with only frontmatter re-merged (skip path)', async () => {
    // 1st response: triage → strategy=skip. No body-merge call.
    const ctx = makeCtx(makeClient([JSON.stringify({ strategy: 'skip', reason: 'no new info' })]));
    const result = await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'new.md', basename: 'new.md' },
      EXISTING,
      [],
      'wiki/entities/caching.md',
    );
    expect(result).toBe('wiki/entities/caching.md');
    const written = ctx.written.get('wiki/entities/caching.md')!;
    // Body preserved.
    expect(written).toContain('Old text.');
  });
});

describe('mergePage — triage=complementary falls through to merge when NO_NEW_CONTENT', () => {
  it('when every per-section LLM says NO_NEW_CONTENT, falls back to body-merge', async () => {
    // Response 1: triage → complementary with 1 item.
    // Response 2: per-section LLM → NO_NEW_CONTENT.
    // Response 3: body-merge → "Merged body."
    const ctx = makeCtx(makeClient([
      JSON.stringify({
        strategy: 'complementary',
        reason: 'expand',
        items: [{ kind: 'complementary', content: 'new fact', target_section: 'Description' }],
      }),
      'NO_NEW_CONTENT',
      'Merged body.',
    ]));
    const result = await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'new.md', basename: 'new.md' },
      EXISTING,
      [],
      'wiki/entities/caching.md',
    );
    expect(result).toBe('wiki/entities/caching.md');
    const written = ctx.written.get('wiki/entities/caching.md')!;
    expect(written).toContain('Merged body.');
  });
});

describe('mergePage — triage failure falls through to merge path', () => {
  it('when triage throws, the merge path still runs', async () => {
    // Response 1: triage throws via JSON parse failure → fall through.
    // Response 2: body-merge → "Merged body."
    const ctx = makeCtx(makeClient([
      '', // empty → parseJsonResponse returns null → throws
      'Merged body.',
    ]));
    const result = await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'new.md', basename: 'new.md' },
      EXISTING,
      [],
      'wiki/entities/caching.md',
    );
    expect(result).toBe('wiki/entities/caching.md');
    const written = ctx.written.get('wiki/entities/caching.md')!;
    expect(written).toContain('Merged body.');
  });
});

describe('mergePage — NO_NEW_CONTENT from body-merge preserves existing', () => {
  it('returns path but does NOT write when body-merge says NO_NEW_CONTENT', async () => {
    const ctx = makeCtx(makeClient([
      JSON.stringify({ strategy: 'merge', reason: 'rewrite' }),
      'NO_NEW_CONTENT',
    ]));
    const result = await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'new.md', basename: 'new.md' },
      EXISTING,
      [],
      'wiki/entities/caching.md',
    );
    expect(result).toBe('wiki/entities/caching.md');
    // NO_NEW_CONTENT → no write happened.
    expect(ctx.written.has('wiki/entities/caching.md')).toBe(false);
  });
});

describe('appendToReviewedPage — client precondition', () => {
  it('throws when no LLM client is configured', async () => {
    const ctx = makeCtx(null);
    await expect(
      appendToReviewedPage(ctx, createMockEntity({ name: 'X' }), { path: 'p.md', basename: 'p.md' }, EXISTING, 'wiki/entities/x.md'),
    ).rejects.toThrow(/LLM client not initialized/);
  });
});

describe('appendToReviewedPage — NO_NEW_CONTENT preserves existing', () => {
  it('returns path but does NOT write when LLM says NO_NEW_CONTENT', async () => {
    const ctx = makeCtx(makeClient(['NO_NEW_CONTENT']));
    const result = await appendToReviewedPage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      { path: 'new.md', basename: 'new.md' },
      EXISTING,
      'wiki/entities/caching.md',
    );
    expect(result).toBe('wiki/entities/caching.md');
    expect(ctx.written.has('wiki/entities/caching.md')).toBe(false);
  });
});

describe('appendToReviewedPage — happy path writes merged content', () => {
  it('writes the LLM-produced body (Mentions section is LOCKED when pageIsReviewed)', async () => {
    const ctx = makeCtx(makeClient(['## New Section\nNew fact.']));
    const result = await appendToReviewedPage(
      ctx,
      createMockEntity({ name: 'Caching', mentions_in_source: ['quote-A'] }),
      { path: 'new.md', basename: 'new.md' },
      EXISTING,
      'wiki/entities/caching.md',
    );
    expect(result).toBe('wiki/entities/caching.md');
    const written = ctx.written.get('wiki/entities/caching.md')!;
    expect(written).toContain('## New Section');
    expect(written).toContain('New fact.');
    // Mentions section is intentionally NOT injected — appendToReviewedPage
    // passes pageIsReviewed: true so the existing Mentions section (if any)
    // is preserved verbatim and new mentions are NOT auto-injected.
    expect(written).not.toContain('quote-A');
  });
});
// Issue #312 part 2 — deterministic ownership guard. A source that carries the
// page's own lemma must not be dropped on a novelty judgement: that is how a
// page keeps a definition written by the first source that mentioned it in
// passing, while its actual subject source is skipped.
describe('mergePage — source owning the page lemma overrides triage=skip (#312)', () => {
  const OWNING_CONTEXT = {
    sourceTitle: 'Caching',
    summary: 'A note about caching.',
    sourcePath: 'Notes/Caching.md',
  };

  it('routes to the body merge when the source basename is the page lemma', async () => {
    const ctx = makeCtx(makeClient([
      JSON.stringify({ strategy: 'skip', reason: 'no new info' }),
      '## Description\nMerged text.',
    ]));

    const result = await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'Notes/Caching.md', basename: 'Caching' },
      EXISTING,
      [],
      'wiki/entities/caching.md',
      undefined,
      OWNING_CONTEXT,
    );

    expect(result).toBe('wiki/entities/caching.md');
    const written = ctx.written.get('wiki/entities/caching.md')!;
    // The skip verdict was overridden — the merge path produced the body.
    expect(written).toContain('Merged text.');
  });

  it('leaves triage=skip intact when the source does not carry the page lemma', async () => {
    const ctx = makeCtx(makeClient([
      JSON.stringify({ strategy: 'skip', reason: 'no new info' }),
      '## Description\nMerged text.',
    ]));

    await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'Notes/Distributed Systems.md', basename: 'Distributed Systems' },
      EXISTING,
      [],
      'wiki/entities/caching.md',
      undefined,
      { sourceTitle: 'Distributed Systems', summary: 's', sourcePath: 'Notes/Distributed Systems.md' },
    );

    const written = ctx.written.get('wiki/entities/caching.md')!;
    // Unchanged behaviour: an incidental source is still skipped.
    expect(written).toContain('Old text.');
    expect(written).not.toContain('Merged text.');
  });

  it('does not fire without a source context — lint-side callers are unchanged', async () => {
    const ctx = makeCtx(makeClient([
      JSON.stringify({ strategy: 'skip', reason: 'no new info' }),
      '## Description\nMerged text.',
    ]));

    await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      // Same basename as the page: only the missing context keeps the guard off.
      { path: 'Notes/Caching.md', basename: 'Caching' },
      EXISTING,
      [],
      'wiki/entities/caching.md',
    );

    const written = ctx.written.get('wiki/entities/caching.md')!;
    expect(written).toContain('Old text.');
    expect(written).not.toContain('Merged text.');
  });
});

// #419 — end-to-end on this call site: triage routes to the full body merge,
// the model returns a body starting at the first `##`, and the written page
// must still carry its title.
describe('mergePage — H1 survives a rewrite that omits it', () => {
  it('writes the page\'s own title back when the merged body has none', async () => {
    const withTitle = `---\ntitle: Caching\n---\n\n# Caching (HTTP), a title the file name cannot reproduce\n\n## Description\nOld text.\n`;
    const ctx = makeCtx(makeClient([
      JSON.stringify({ strategy: 'merge', reason: 'rewrite' }),
      '## Description\nMerged body.',
    ]));
    const result = await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'new.md', basename: 'new.md' },
      withTitle,
      [],
      'wiki/entities/caching.md',
    );
    expect(result).toBe('wiki/entities/caching.md');
    const written = ctx.written.get('wiki/entities/caching.md')!;
    expect(written).toContain('# Caching (HTTP), a title the file name cannot reproduce');
    expect(written).toContain('Merged body.');
  });
});

describe('mergePage — note excerpt window (payload fix)', () => {
  function makeCapturingClient(responses: string[]): LLMClient & { prompts: string[] } {
    let i = 0;
    const prompts: string[] = [];
    return {
      prompts,
      createMessage: async (req: { messages: Array<{ content: string }> }) => {
        prompts.push(req.messages[0].content);
        return responses[i++] ?? 'NO_NEW_CONTENT';
      },
    } as LLMClient & { prompts: string[] };
  }

  const NOTE = [
    '---',
    'tags:',
    '  - Thema/Test',
    '---',
    'Einleitung ohne den Begriff.',
    '',
    'Caching beschleunigt wiederholte Zugriffe erheblich und senkt die Latenz.',
    '',
    'Ein Absatz über etwas völlig anderes.',
  ].join('\n');

  it('passes the matching note paragraphs to triage AND body merge', async () => {
    const client = makeCapturingClient([
      JSON.stringify({ strategy: 'merge', reason: 'restructure' }),
      '## Description\nNew merged text.\n',
    ]);
    const ctx = makeCtx(client);
    ctx.written.set('Notizen/Some-Note.md', NOTE);
    await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'Notizen/Some-Note.md', basename: 'Some-Note' },
      EXISTING,
      [],
      'wiki/entities/Caching.md',
    );
    expect(client.prompts.length).toBe(2);
    // Triage prompt carries the excerpt block…
    expect(client.prompts[0]).toContain('says about "Caching"');
    expect(client.prompts[0]).toContain('senkt die Latenz');
    expect(client.prompts[0]).not.toContain('völlig anderes');
    // …and so does the body-merge prompt.
    expect(client.prompts[1]).toContain('senkt die Latenz');
    // Note frontmatter is stripped before matching/excerpting.
    expect(client.prompts[1]).not.toContain('Thema/Test');
  });

  it('lemma case: the note that IS the page delivers its full body', async () => {
    const client = makeCapturingClient([
      JSON.stringify({ strategy: 'merge', reason: 'own lemma' }),
      '## Description\nNew merged text.\n',
    ]);
    const ctx = makeCtx(client);
    ctx.written.set('Notizen/Caching.md', NOTE);
    await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'Notizen/Caching.md', basename: 'Caching' },
      EXISTING,
      [],
      'wiki/entities/Caching.md',
      undefined,
      { sourceTitle: 'Caching', summary: 'A note about caching.', sourcePath: 'Notizen/Caching.md' },
    );
    // Full-note mode: even the non-matching paragraphs travel.
    expect(client.prompts[0]).toContain('völlig anderes');
    expect(client.prompts[0]).toContain('Einleitung ohne den Begriff');
  });

  it('no prose about the page → prompts carry no excerpt block (prompt-invariant)', async () => {
    const client = makeCapturingClient([
      JSON.stringify({ strategy: 'merge', reason: 'x' }),
      '## Description\nNew merged text.\n',
    ]);
    const ctx = makeCtx(client);
    ctx.written.set('Notizen/Other.md', 'Nur fremde Themen.\n\nNichts über die Seite.');
    await mergePage(
      ctx,
      createMockEntity({ name: 'Caching' }),
      'entity',
      { path: 'Notizen/Other.md', basename: 'Other' },
      EXISTING,
      [],
      'wiki/entities/Caching.md',
    );
    expect(client.prompts[0]).not.toContain('says about');
    expect(client.prompts[1]).not.toContain('says about');
    expect(client.prompts[1]).not.toContain('{{source_excerpt}}');
  });
});

describe('mergePage — item-level contradiction lane stamps marker and writes a record', () => {
  it('routes kind=contradictory items to a record file, not the section append or the body', async () => {
    const triage = JSON.stringify({
      strategy: 'complementary',
      reason: 'one conflicting claim',
      items: [
        { kind: 'contradictory', content: 'Dose is 10mg', target_section: '## Description', reason: 'page states 5mg', existing_statement: 'Old text.' },
      ],
    });
    // Only ONE LLM response: the triage. A per-section append call for the
    // conflicting item would consume a second response and integrate the
    // claim as if it were a fact.
    const ctx = makeCtx(makeClient([triage]));
    await mergePage(ctx, createMockEntity({ name: 'Caching' }), 'entity', { path: 'note.md', basename: 'note' }, EXISTING, [], 'wiki/entities/caching.md');
    const written = ctx.written.get('wiki/entities/caching.md');
    expect(written).toBeDefined();
    expect(written).toContain('## Description\nOld text.');
    // No body block: it is unknown to the section schema, so
    // stripUnknownSections would remove it on the next rewrite.
    expect(written).not.toContain('Potential Contradiction');
    // The marker (the durable index) is stamped.
    expect(written).toContain('contradictions:');
    expect(written).toContain('note.md');
    // The prose lives in a record under <wikiFolder>/contradictions/.
    const recordPath = [...ctx.written.keys()].find(p => p.startsWith('wiki/contradictions/'));
    expect(recordPath).toBeDefined();
    const record = ctx.written.get(recordPath!)!;
    expect(record).toContain('status: detected');
    expect(record).toContain('Dose is 10mg');
    // The existing view is the page sentence gate 1 verified, not the model's paraphrase.
    expect(record).toContain('## Existing Knowledge\nOld text.');
    expect(record).not.toContain('page states 5mg');
    expect(record).toContain('source_page: "[[entities/caching]]"');
    expect(record).toContain('source_note: "note.md"');
  });
});

describe('mergePage — the triage lane reports what it records (onContradiction)', () => {
  it('emits one ContradictionInfo per kind=contradictory item, pointing at the page', async () => {
    const triage = JSON.stringify({
      strategy: 'complementary',
      reason: 'one conflicting claim',
      items: [
        { kind: 'contradictory', content: 'Dose is 10mg', target_section: '## Description', reason: 'page states 5mg', existing_statement: 'Old text.' },
        { kind: 'complementary', content: 'Sold since 1999', target_section: '## Description', reason: 'new fact' },
      ],
    });
    // Responses: triage, then the per-section append for the complementary item.
    const ctx = makeCtx(makeClient([triage, '## Description\nOld text. Sold since 1999.']));
    const seen: Array<{ claim: string; source_page: string; contradicted_by: string }> = [];
    ctx.onContradiction = c => seen.push(c);
    await mergePage(ctx, createMockEntity({ name: 'Caching' }), 'entity', { path: 'note.md', basename: 'note' }, EXISTING, [], 'wiki/entities/caching.md');
    expect(seen).toEqual([
      { claim: 'Dose is 10mg', source_page: '[[entities/caching]]', contradicted_by: 'Old text.', resolution: '' },
    ]);
  });

  it('emits once for the page-level strategy=contradictory (marker-only path)', async () => {
    const triage = JSON.stringify({ strategy: 'contradictory', reason: 'the whole page disagrees', items: [] });
    const ctx = makeCtx(makeClient([triage, '## Description\nRewritten with both views.']));
    const seen: Array<{ claim: string; source_page: string; contradicted_by: string }> = [];
    ctx.onContradiction = c => seen.push(c);
    await mergePage(ctx, createMockEntity({ name: 'Caching', summary: 'Caching is harmful' }), 'entity', { path: 'note.md', basename: 'note' }, EXISTING, [], 'wiki/entities/caching.md');
    expect(seen).toHaveLength(1);
    expect(seen[0].source_page).toBe('[[entities/caching]]');
    expect(seen[0].contradicted_by).toBe('the whole page disagrees');
  });

  it('a conflict that quotes no page sentence is appended as a fact — no record, no marker, but a warning', async () => {
    const triage = JSON.stringify({
      strategy: 'complementary',
      reason: 'one claim',
      items: [
        { kind: 'contradictory', content: 'Dose is 10mg', target_section: '## Description', reason: 'conflicts with what I know', existing_statement: 'The page says the dose is 5mg' },
      ],
    });
    // Two responses: triage, then the per-section append for the demoted item.
    const ctx = makeCtx(makeClient([triage, '## Description\nOld text. Dose is 10mg.']));
    const seen: unknown[] = [];
    ctx.onContradiction = c => seen.push(c);
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (m: unknown) => { warns.push(String(m)); };
    try {
      await mergePage(ctx, createMockEntity({ name: 'Caching' }), 'entity', { path: 'note.md', basename: 'note' }, EXISTING, [], 'wiki/entities/caching.md');
    } finally {
      console.warn = orig;
    }
    expect(seen).toEqual([]);
    const written = ctx.written.get('wiki/entities/caching.md')!;
    expect(written).toContain('Dose is 10mg');
    expect(written).not.toContain('contradictions:');
    expect([...ctx.written.keys()].some(p => p.startsWith('wiki/contradictions/'))).toBe(false);
    expect(warns.some(w => w.includes('demoted by gate "existing-statement"') && w.includes('The page says the dose is 5mg'))).toBe(true);
  });

  it('is silent for skip and complementary-only triage', async () => {
    const triage = JSON.stringify({ strategy: 'skip', reason: 'nothing new', items: [] });
    const ctx = makeCtx(makeClient([triage]));
    const seen: unknown[] = [];
    ctx.onContradiction = c => seen.push(c);
    await mergePage(ctx, createMockEntity({ name: 'Caching' }), 'entity', { path: 'note.md', basename: 'note' }, EXISTING, [], 'wiki/entities/caching.md');
    expect(seen).toEqual([]);
  });
});

// The complementary path writes into whatever section the triage names, and a
// Related section is a legal target — its per-section call produces prose
// bullets with a provenance marker, which the two Related sections are not
// supposed to carry: every other write path renders them from the typed lists.
describe('mergePage — a complementary append into a Related section is rendered, not pasted', () => {
  const WITH_RELATED = [
    '---', 'title: Caching', '---', '',
    '## Description', 'Old text.', '',
    '## Related Concepts', '', '- [[concepts/Alpha|Alpha]]', '- [[concepts/Beta|Beta]]', '',
  ].join('\n');

  function run(appended: string) {
    const ctx = makeCtx(makeClient([
      JSON.stringify({
        strategy: 'complementary',
        reason: 'expand',
        items: [{ kind: 'complementary', content: 'more', target_section: 'Related Concepts' }],
      }),
      appended,
    ]));
    return mergePage(
      ctx, createMockEntity({ name: 'Caching' }), 'entity',
      { path: 'note.md', basename: 'note.md' }, WITH_RELATED, [], 'wiki/entities/caching.md',
    ).then(() => ctx.written.get('wiki/entities/caching.md')!);
  }

  function relatedBullets(page: string): string[] {
    const sec = /^## Related Concepts\n([\s\S]*?)(?=^## |\Z)/m.exec(page);
    return (sec?.[1] ?? '').split('\n').filter(l => l.startsWith('- [['));
  }

  it('keeps the link the append named and drops the prose around it', async () => {
    const page = await run('- [[concepts/SCFAs|SCFAs]] strengthen the barrier. ^[Source: [[Leaky Gut]]]');
    const bullets = relatedBullets(page);
    expect(bullets).toContain('- [[concepts/SCFAs|SCFAs]]');
    expect(bullets.every(l => /^- \[\[[^\]]+\]\]$/.test(l))).toBe(true);
  });

  it('lists a target once when the append repeats one the page already has', async () => {
    const page = await run([
      '- [[concepts/Alpha|Alpha]] again, with prose. ^[Source: [[X]]]',
      '- [[concepts/SCFAs|SCFAs]] (protective)',
    ].join('\n'));
    expect(relatedBullets(page).filter(l => l.includes('concepts/Alpha'))).toHaveLength(1);
  });

  it('leaves the list untouched when the append lands in another section', async () => {
    const ctx = makeCtx(makeClient([
      JSON.stringify({
        strategy: 'complementary', reason: 'expand',
        items: [{ kind: 'complementary', content: 'more', target_section: 'Description' }],
      }),
      'One more sentence.',
    ]));
    await mergePage(
      ctx, createMockEntity({ name: 'Caching' }), 'entity',
      { path: 'note.md', basename: 'note.md' }, WITH_RELATED, [], 'wiki/entities/caching.md',
    );
    expect(relatedBullets(ctx.written.get('wiki/entities/caching.md')!))
      .toEqual(['- [[concepts/Alpha|Alpha]]', '- [[concepts/Beta|Beta]]']);
  });
});
