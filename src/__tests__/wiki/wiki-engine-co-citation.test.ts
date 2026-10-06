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
        'wiki/entities/Alpha.md': '---\ntype: entity\n---\n# Alpha\n\nSiehe [[concepts/Hub]].\n',
        'wiki/entities/Beta.md': '---\ntype: entity\n---\n# Beta\n\nSiehe [[concepts/Hub]].\n',
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
