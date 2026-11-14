// Issue #729 Phase 1 — does the wire actually carry co-citation into a written page?
//
// The unit tests cover the projection and the shaper separately. Neither covers the
// one thing that can still be wrong: whether `wiki-engine` passes a provider that
// works at all — the right path space, the right resolver, the right graph. A wiring
// mistake in any of those passes every unit test, which is the lesson from #467's
// guard (a guard that re-implements the rule cannot fail when the rule moves).
//
// **The premise has to be chosen carefully, and the first version of this file got it
// wrong.** Two pages born from the *same* note are siblings, and the sibling rule runs
// before the cross-source source by design — so it already links them, `seen` already
// contains the partner, and the projection is asked to exclude it. `crossSource` is 0
// there, correctly: a same-note pair is exactly what M0 is *not* for.
//
// So the pair has to come from different notes. `Beta` exists and links the same hub
// as `Alpha`, but this note's extraction names only `Alpha`, which makes `Beta` not a
// survivor — the sibling rule cannot reach it, and any edge between them here can only
// have come from the vault's own structure.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import { createWikiEngineHarness } from '../__support__/wiki-engine-harness';
import type { LLMClient } from '../../types';

const NOTE_PATH = 'Notizen/Quelle.md';
const noteFile = () => Object.assign(new TFile(), { path: NOTE_PATH, basename: 'Quelle', extension: 'md' });

/** One entity, no related names of its own — so the sibling rule has nothing to add. */
const ONLY_ALPHA = JSON.stringify({
  source_title: 'Quelle',
  summary: 'Quelle.',
  entities: [{ name: 'Alpha', type: 'other', summary: 's', mentions_in_source: ['A'], related_entities: [] }],
  concepts: [],
});

describe('#729 Phase 1 — co-citation reaches a written page', () => {
  it('relates two pages that link the same target when no note named them together', async () => {
    const h = createWikiEngineHarness({
      files: {
        [NOTE_PATH]: '# Quelle\n\nEin Satz ueber Alpha.\n',
        'wiki/concepts/Hub.md': '---\ntype: concept\n---\n# Hub\n',
        'wiki/concepts/Spoke.md': '---\ntype: concept\n---\n# Spoke\n',
        // Two shared targets, not one: the strength floor is two, because a pair
        // whose entire evidence is one hub is not a relation. What this test is
        // about is the path — graph built, provider resolved Alpha, Beta came
        // back, link written — and that path is the same either way.
        'wiki/entities/Alpha.md': '---\ntype: entity\n---\n# Alpha\n\nSiehe [[concepts/Hub]] und [[concepts/Spoke]].\n',
        'wiki/entities/Beta.md': '---\ntype: entity\n---\n# Beta\n\nSiehe [[concepts/Hub]] und [[concepts/Spoke]].\n',
      },
      llmResponses: [ONLY_ALPHA],
      settings: { wikiLanguage: 'de', watchedFolders: ['Notizen'] },
    });
    await h.engine.ingestSource(noteFile());

    // The edge exists on the page...
    const alpha = h.files.get('wiki/entities/Alpha.md') ?? '';
    expect(alpha).toContain('[[entities/Beta|Beta]]');

    // ...and it is attributable. Zero siblings, because Alpha is the only survivor —
    // so the sibling rule had nothing to rescue and could not have written this. One
    // cross-source entry, which is the projection's, and it means the whole path ran:
    // the graph was built, the provider resolved Alpha to a node, and `Beta` came back.
    const progress = h.progressMessages.find(m => m.startsWith('Related lists:'));
    expect(progress).toBe('Related lists: 0 sibling edges, 1 cross-source edges, 0 unanswered names, 0 tag values dropped');
  });

  it('does not reach across when the two pages share no target', async () => {
    // The negative case, so the test above cannot pass on a provider that returns
    // everything it can resolve.
    const h = createWikiEngineHarness({
      files: {
        [NOTE_PATH]: '# Quelle\n\nEin Satz ueber Alpha.\n',
        'wiki/concepts/Hub.md': '---\ntype: concept\n---\n# Hub\n',
        'wiki/concepts/Other.md': '---\ntype: concept\n---\n# Other\n',
        'wiki/entities/Alpha.md': '---\ntype: entity\n---\n# Alpha\n\nSiehe [[concepts/Hub]].\n',
        'wiki/entities/Beta.md': '---\ntype: entity\n---\n# Beta\n\nSiehe [[concepts/Other]].\n',
      },
      llmResponses: [ONLY_ALPHA],
      settings: { wikiLanguage: 'de', watchedFolders: ['Notizen'] },
    });
    await h.engine.ingestSource(noteFile());

    const alpha = h.files.get('wiki/entities/Alpha.md') ?? '';
    expect(alpha).not.toContain('Beta');
    // Nothing to report at all: no siblings (Alpha is the only survivor), no
    // cross-source entries, no unanswered names, no tags — and the log line is
    // emitted only when at least one of those is non-zero. Its absence is the
    // assertion, and it is a stronger one than a `0 cross-source edges` string
    // would be, because it cannot be satisfied by a provider that merely ran.
    expect(h.progressMessages.find(m => m.startsWith('Related lists:'))).toBeUndefined();
  });
});

// Issue #1018 — a note must see the pages an earlier note of the same run wrote.
//
// The projection's graph is built once per run and cached by batch-context identity.
// That is what keeps the cost at O(vault) per run instead of O(notes × vault), and
// the memo is right. What it also did was freeze the graph at the run's first note:
// on an empty-vault rebuild the first note saw nothing, and every later note saw a
// graph missing everything the run had written so far. The projection contributed
// nothing for the whole rebuild — the case the acceptance measurement is about.
//
// The fix follows the write path instead of dropping the memo: when a wiki page is
// written during a run, its outgoing edges are added to the cached graph. The cost
// stays O(links) per written page, and the graph is built once.
//
// The order dependence is deliberate and is not new: every other relation in the
// pipeline already depends on the vault as it stood at write time. A page written
// earlier cannot name a page written later, in the note-grounded list or in the
// sibling rule either. What this test pins is that the projection behaves the same
// way as the rest of the write path, rather than being the one part that freezes.
describe('#1018 — an ingest run sees the pages it has already written', () => {
  it('offers a later note a page that an earlier note of the same run created', async () => {
    // A per-prompt stub, not a queue: an ingest issues more than one model call per
    // note (batch analysis), so a queue would feed the second batch's answer to the
    // first and the page bodies would not be what this test asserts on.
    const answer = (params: Parameters<LLMClient['createMessage']>[0]): string => {
      const prompt = JSON.stringify(params.messages ?? '');
      // The note's own body is what reaches the prompt, so the discriminator is
      // the body text, not the filename.
      const first = prompt.includes('ueber Gamma');
      const name = first ? 'Gamma' : 'Delta';
      return JSON.stringify({
        source_title: first ? 'Erste' : 'Zweite',
        summary: 's',
        // Each page names the two concepts, so both link Hub and Spoke. That makes
        // Gamma and Delta a two-target pair for the projection — the only way the
        // later note could be offered the earlier note's page.
        entities: [{ name, type: 'other', summary: 's', mentions_in_source: ['x'], related_entities: ['Hub', 'Spoke'] }],
        concepts: [],
      });
    };

    const h = createWikiEngineHarness({
      files: {
        'Notizen/Erste.md': '# Erste\n\nEin Satz ueber Gamma.\n',
        'Notizen/Zweite.md': '# Zweite\n\nEin Satz ueber Delta.\n',
        // A rebuild: nothing but the roots exists, so the graph at the first note is
        // empty apart from these two concepts.
        'wiki/index.md': '---\ntype: index\n---\n# Index\n',
        'wiki/concepts/Hub.md': '---\ntype: concept\n---\n# Hub\n',
        'wiki/concepts/Spoke.md': '---\ntype: concept\n---\n# Spoke\n',
      },
      llmClient: { createMessage: async (params: Parameters<LLMClient['createMessage']>[0]) => answer(params) } as unknown as LLMClient,
      settings: { wikiLanguage: 'de', watchedFolders: ['Notizen'] },
    });

    const batchCtx = h.engine.createBatchContext();
    await h.engine.ingestSource(Object.assign(new TFile(), { path: 'Notizen/Erste.md', basename: 'Erste', extension: 'md' }), { batchCtx });
    await h.engine.ingestSource(Object.assign(new TFile(), { path: 'Notizen/Zweite.md', basename: 'Zweite', extension: 'md' }), { batchCtx });

    console.log('DELTA2 >>>', h.files.get('wiki/entities/delta.md'));
    console.log('GAMMA2 >>>', h.files.get('wiki/entities/gamma.md'));
    const gamma = h.files.get('wiki/entities/gamma.md') ?? '';
    const delta = h.files.get('wiki/entities/delta.md') ?? '';
    expect(gamma).toContain('[[concepts/Hub');
    expect(delta).toContain('[[concepts/Hub');
    // The page the earlier note wrote is offered to the later one. Its title is the
    // slug, because the page did not exist when the title map was built — the link
    // target is what matters here, and it could not appear before #1018.
    expect(delta).toContain('[[entities/gamma|');
    // And it is a Related entry, not a mention of the source note: the section it
    // lands in is the one the projection writes to.
    const relatedSection = delta.slice(delta.indexOf('Verwandte Entitäten'));
    expect(relatedSection).toContain('[[entities/gamma|');
    expect(h.progressMessages.some(m => m.includes('cross-source edges'))).toBe(true);
  });
});
