import { describe, it, expect } from 'vitest';
import {
  folderScopePrefix,
  isInFolderScope,
  isAtOrInFolderScope,
  isExcludedFromSourcePicker,
  isIngestableSource,
  isInSourceScope,
} from '../../core/folder-scope';

describe('folderScopePrefix', () => {
  it('anchors a folder path on a trailing slash', () => {
    expect(folderScopePrefix('Notizen', false)).toBe('Notizen/');
    expect(folderScopePrefix('a/b', false)).toBe('a/b/');
  });

  it('returns an empty prefix for the vault root', () => {
    expect(folderScopePrefix('/', true)).toBe('');
    expect(folderScopePrefix('', true)).toBe('');
  });

  it('does not double the separator on an already-trailing slash', () => {
    expect(folderScopePrefix('Notizen/', false)).toBe('Notizen/');
    expect(folderScopePrefix('Notizen//', false)).toBe('Notizen/');
  });

  it('treats an empty non-root path as unscoped rather than emitting a bare slash', () => {
    expect(folderScopePrefix('', false)).toBe('');
  });
});

describe('isInFolderScope', () => {
  it('matches true descendants at any depth', () => {
    expect(isInFolderScope('Notizen/a.md', 'Notizen', false)).toBe(true);
    expect(isInFolderScope('Notizen/sub/deep/a.md', 'Notizen', false)).toBe(true);
  });

  // Issue #364, the reported case.
  it('does not match a sibling folder sharing a name prefix', () => {
    expect(isInFolderScope('Notizen-temp/a.md', 'Notizen', false)).toBe(false);
    expect(isInFolderScope('Notizen2/a.md', 'Notizen', false)).toBe(false);
  });

  // Same root cause, second symptom: an unanchored prefix also swallows a
  // file that merely starts with the folder's name.
  it('does not match a file sitting beside the folder', () => {
    expect(isInFolderScope('Notizen.md', 'Notizen', false)).toBe(false);
  });

  it('does not match the folder itself', () => {
    expect(isInFolderScope('Notizen', 'Notizen', false)).toBe(false);
  });

  it('scopes nested folders without leaking into name-prefixed neighbours', () => {
    expect(isInFolderScope('a/b/x.md', 'a/b', false)).toBe(true);
    expect(isInFolderScope('a/bc/x.md', 'a/b', false)).toBe(false);
  });

  it('accepts every path at the vault root', () => {
    expect(isInFolderScope('a.md', '/', true)).toBe(true);
    expect(isInFolderScope('deep/nested/a.md', '/', true)).toBe(true);
  });

  it('is unaffected by the folder name appearing later in the path', () => {
    expect(isInFolderScope('Archiv/Notizen/a.md', 'Notizen', false)).toBe(false);
  });
});

describe('isAtOrInFolderScope', () => {
  it('matches the folder itself — the case isInFolderScope refuses', () => {
    expect(isAtOrInFolderScope('Notizen', 'Notizen', false)).toBe(true);
  });

  it('still matches descendants at any depth', () => {
    expect(isAtOrInFolderScope('Notizen/a.md', 'Notizen', false)).toBe(true);
    expect(isAtOrInFolderScope('Notizen/sub/deep/a.md', 'Notizen', false)).toBe(true);
  });

  it('still refuses sibling folders and adjacent files', () => {
    expect(isAtOrInFolderScope('Notizen-temp/a.md', 'Notizen', false)).toBe(false);
    expect(isAtOrInFolderScope('Notizen.md', 'Notizen', false)).toBe(false);
  });

  it('normalises a trailing slash on the folder path', () => {
    expect(isAtOrInFolderScope('Notizen', 'Notizen/', false)).toBe(true);
    expect(isAtOrInFolderScope('Notizen/a.md', 'Notizen/', false)).toBe(true);
  });
});

describe('isExcludedFromSourcePicker', () => {
  it('excludes the wiki folder itself', () => {
    expect(isExcludedFromSourcePicker('wiki', 'wiki', '.obsidian')).toBe(true);
  });

  it('excludes wiki descendants at any depth', () => {
    expect(isExcludedFromSourcePicker('wiki/entities', 'wiki', '.obsidian')).toBe(true);
    expect(isExcludedFromSourcePicker('wiki/sources/deep', 'wiki', '.obsidian')).toBe(true);
  });

  it('keeps a sibling folder sharing the wiki name prefix', () => {
    expect(isExcludedFromSourcePicker('wiki-archive', 'wiki', '.obsidian')).toBe(false);
  });

  it('keeps an unrelated user folder', () => {
    expect(isExcludedFromSourcePicker('Notes', 'wiki', '.obsidian')).toBe(false);
  });

  it('excludes the config directory and its descendants', () => {
    expect(isExcludedFromSourcePicker('.obsidian/plugins', 'wiki', '.obsidian')).toBe(true);
    expect(isExcludedFromSourcePicker('.obsidian/plugins/foo/bar', 'wiki', '.obsidian')).toBe(true);
  });

  // Same root cause as #383 — unanchored prefix leak. PR #384's
  // `FolderSuggestModal` line `folder.path.startsWith(configDir)` let
  // `.obsidian-backup/...` enter the picker; the centralised rule here
  // uses isAtOrInFolderScope and is anchored.
  it('does not leak a folder sharing the config name prefix', () => {
    expect(isExcludedFromSourcePicker('.obsidian-backup/x.md', 'wiki', '.obsidian')).toBe(false);
  });

  it('keeps the vault root selectable', () => {
    expect(isExcludedFromSourcePicker('/', 'wiki', '.obsidian')).toBe(false);
  });
});

// Issue #502 — the two rules above are each correct on their own, and the
// two tests directly above pin them: the vault root stays selectable, and
// root scope accepts every path. Composed at the folder-ingest call site
// they cancel the picker's own boundary — choosing the root reinstates the
// `wiki/` folder the picker deliberately refuses to offer, and the plugin
// ingests its own generated pages as source material.
//
// `FileSuggestModal` and `MultiFileSuggestModal` already apply the picker
// rule to the FILES they offer. `FolderSuggestModal` applies it to the
// FOLDERS it offers, and the collection step that follows applied nothing.
// This function is that missing file-level rule, in the same module as the
// other three.
describe('isIngestableSource', () => {
  const none = () => false;

  it('collects an ordinary source file inside the chosen folder', () => {
    expect(isIngestableSource('Notizen/a.md', 'Notizen', false, 'wiki', '.obsidian', none)).toBe(true);
  });

  it('collects an ordinary source file when the vault root is chosen', () => {
    expect(isIngestableSource('Notizen/a.md', '/', true, 'wiki', '.obsidian', none)).toBe(true);
    expect(isIngestableSource('a.md', '/', true, 'wiki', '.obsidian', none)).toBe(true);
  });

  it('does not reinstate the wiki folder when the vault root is chosen', () => {
    // Both premises hold and are pinned above ...
    expect(isExcludedFromSourcePicker('wiki/entities/x.md', 'wiki', '.obsidian')).toBe(true);
    expect(isInFolderScope('wiki/entities/x.md', '/', true)).toBe(true);
    // ... so the collection step has to combine them.
    expect(isIngestableSource('wiki/entities/x.md', '/', true, 'wiki', '.obsidian', none)).toBe(false);
  });

  it('keeps the folder boundary it inherits from isInFolderScope', () => {
    expect(isIngestableSource('Notizen-temp/a.md', 'Notizen', false, 'wiki', '.obsidian', none)).toBe(false);
    expect(isIngestableSource('Notizen.md', 'Notizen', false, 'wiki', '.obsidian', none)).toBe(false);
  });

  it('keeps a sibling folder sharing the wiki name prefix', () => {
    expect(isIngestableSource('wiki-archive/x.md', '/', true, 'wiki', '.obsidian', none)).toBe(true);
  });

  // Issue #872 — the automatic path asked a different question than the manual one.
  // The manual folder ingest consulted Obsidian's "Excluded files" list; the
  // automatic watcher and the related-names list did not, so a file the user
  // had excluded was ingested anyway whenever the change came from the
  // watcher. The predicate is required rather than optional, so a call site
  // cannot forget it and silently get the pre-#872 behaviour.
  it('refuses a file the user excluded from ingestion', () => {
    const excluded = (p: string) => p === 'Notizen/private.md';
    expect(isIngestableSource('Notizen/private.md', 'Notizen', false, 'wiki', '.obsidian', excluded)).toBe(false);
    expect(isIngestableSource('Notizen/public.md', 'Notizen', false, 'wiki', '.obsidian', excluded)).toBe(true);
  });
});

// The two questions are different, and one function answered both.
//
// "May this file be ingested as a source?" is about the user's ingest intent.
// "Does this note already exist in the vault?" is about the vault's contents.
// A file the user excluded from ingestion still exists — it is still a note the
// user wrote, and a link to it is still a true link. The related-names list
// asked the second question through the first function, and inherited the
// first function's answer. These two tests pin the difference, because
// merging them back is the easy mistake.
describe('isInSourceScope — existence, not ingestability', () => {
  it('accepts a file the user excluded from ingestion, because the note still exists', () => {
    expect(isInSourceScope('Notizen/private.md', 'Notizen', false, 'wiki', '.obsidian')).toBe(true);
  });

  it('still refuses the wiki folder and the config directory', () => {
    expect(isInSourceScope('wiki/entities/x.md', '/', true, 'wiki', '.obsidian')).toBe(false);
    expect(isInSourceScope('.obsidian/plugins/x.md', '/', true, 'wiki', '.obsidian')).toBe(false);
  });

  it('keeps the folder boundary', () => {
    expect(isInSourceScope('Notizen-temp/a.md', 'Notizen', false, 'wiki', '.obsidian')).toBe(false);
  });
});
