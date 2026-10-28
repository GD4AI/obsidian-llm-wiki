// Issue #503 — a folder ingest must honour Obsidian's own "Excluded files" list.
//
// The plugin had no exclusion semantics at all: `LLMWikiSettings` has 68 fields and
// none of them says "leave this out", and collection filtered on extension and folder
// boundary only. So a vault whose exclude list already covers `copilot/`,
// `wiki/sources/` and a tag still ingested its own scaffolding as source material.
//
// Two decisions are pinned here, and both rule out the obvious alternative:
//
//   1. The plugin asks Obsidian (`metadataCache.isUserIgnored`) instead of
//      reimplementing the three entry kinds. A plain entry is a string prefix where
//      the trailing slash is part of the pattern, `#Definition` matches nothing at all,
//      and `/…/` entries are regexes. Two of those would drift; the third nobody would
//      think to write.
//   2. The predicate is threaded through the pure function as an argument rather than
//      imported there, so `folder-scope.ts` stays IO-free and testable without a vault.
//
// The two explicit file pickers deliberately keep the old behaviour: a file the user
// selected by hand is a decision, not something to filter.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isIngestableSource } from '../../core/folder-scope';
import { makeUserIgnorePredicate } from '../../core/user-ignore';

const WIKI = 'wiki';
const CONFIG = '.obsidian';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('makeUserIgnorePredicate — ask Obsidian, do not reimplement it (#503)', () => {
  it('passes paths through to isUserIgnored and returns its answer', () => {
    const isUserIgnored = vi.fn((path: string) => path.startsWith('copilot/'));
    const excluded = makeUserIgnorePredicate({ isUserIgnored });

    expect(excluded('copilot/copilot-custom-prompts/a.md')).toBe(true);
    expect(excluded('Notizen/a.md')).toBe(false);
    expect(isUserIgnored).toHaveBeenCalledTimes(2);
  });

  it('excludes nothing when the method is absent, which is an older Obsidian', () => {
    const excluded = makeUserIgnorePredicate({});

    expect(excluded('anything.md')).toBe(false);
  });

  it('excludes nothing when there is no metadata cache at all', () => {
    expect(makeUserIgnorePredicate(undefined)('x.md')).toBe(false);
    expect(makeUserIgnorePredicate(null)('x.md')).toBe(false);
  });

  it('treats a throwing isUserIgnored as not excluded, and warns', () => {
    // `userIgnoreFilters` accepts regexes and a user can write an invalid one. One
    // broken pattern must not stop a whole folder ingest.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const excluded = makeUserIgnorePredicate({
      isUserIgnored: () => { throw new SyntaxError('invalid regex'); },
    });

    expect(excluded('a.md')).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('does not treat a truthy non-true return as excluded', () => {
    // `=== true` keeps the contract boolean, so a future Obsidian returning something
    // else cannot silently start filtering the whole vault.
    const excluded = makeUserIgnorePredicate({ isUserIgnored: () => 'yes' });

    expect(excluded('a.md')).toBe(false);
  });
});

describe('isIngestableSource — the exclusion composes with the existing rules (#503)', () => {
  it('drops a file the user excluded, even inside the chosen folder', () => {
    const excluded = (p: string) => p.startsWith('Notizen/archive/');

    expect(isIngestableSource('Notizen/archive/x.md', 'Notizen', false, WIKI, CONFIG, excluded))
      .toBe(false);
    expect(isIngestableSource('Notizen/live/x.md', 'Notizen', false, WIKI, CONFIG, excluded))
      .toBe(true);
  });

  it('collects the file when the caller states that nothing is excluded', () => {
    // The predicate is required since #872, so "this caller excludes nothing"
    // is now a statement the caller makes rather than a silence it leaves.
    const excludesNothing = () => false;
    expect(isIngestableSource('Notizen/archive/x.md', 'Notizen', false, WIKI, CONFIG, excludesNothing))
      .toBe(true);
  });

  it('still refuses the wiki folder itself, so the exclusion is additive', () => {
    const excluded = () => false;

    expect(isIngestableSource('wiki/sources/x.md', '', true, WIKI, CONFIG, excluded))
      .toBe(false);
  });
});
