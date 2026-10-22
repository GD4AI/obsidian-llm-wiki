// Issue #317: "Schema.md changes are ignored."
//
// The schema body was cached, and the cache was invalidated from exactly one
// place — the plugin's own "apply suggestion" flow (`schema-commands.ts`). A
// user who opened `wiki/schema/config.md` in the Obsidian editor, changed it,
// and ran an ingest saw no change: the next call read the cached body, so the
// edit was invisible until Obsidian was restarted.
//
// The cache is keyed on the file's mtime. That needs no event wiring, and it
// also catches an edit made outside Obsidian — a sync, a file drop, a git
// checkout — which an event listener would not see.

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian'; // mocked in setup.ts
import { SchemaManager } from '../../schema/schema-manager';
import type { LLMWikiSettings } from '../../types';

const ORIGINAL = '## Naming Conventions\n\nOriginal rule.\n';
const EDITED = '## Naming Conventions\n\nEdited rule.\n';

const settings = {
  provider: 'mock',
  model: 'mock-model',
  language: 'en',
  wikiLanguage: 'English',
  wikiFolder: 'wiki',
  disableThinking: false,
  maxTokensPerCall: 0,
} as unknown as LLMWikiSettings;

function makeManager(initialBody: string) {
  let body = initialBody;
  let mtime = 1;
  const reads: number[] = [];
  const app = {
    vault: {
      getAbstractFileByPath: (path: string) =>
        path.includes('schema/config')
          ? Object.assign(new TFile(), { path, stat: { mtime } })
          : null,
      read: async () => {
        reads.push(mtime);
        return body;
      },
      adapter: {
        read: async () => body,
        readToString: async () => body,
      },
      getMarkdownFiles: () => [],
    },
  } as never;
  const mgr = new SchemaManager(app, settings, () => null);
  return {
    mgr,
    reads,
    /** The user edits the schema file in the Obsidian editor. */
    edit(next: string) {
      body = next;
      mtime += 1;
    },
  };
}

describe('SchemaManager — a direct edit of the schema file is not ignored (#317)', () => {
  it('serves the edited body on the next call', async () => {
    const { mgr, edit } = makeManager(ORIGINAL);

    const before = await mgr.getSchemaContext('full');
    expect(before).toContain('Original rule.');

    edit(EDITED);

    const after = await mgr.getSchemaContext('full');
    expect(after).toContain('Edited rule.');
    expect(after).not.toContain('Original rule.');
  });

  it('still caches while the file is unchanged', async () => {
    const { mgr, reads } = makeManager(ORIGINAL);

    await mgr.getSchemaContext('full');
    await mgr.getSchemaContext('full');
    await mgr.getSchemaContext('full');

    // One read for three calls. The cache is a real optimisation, not a
    // side effect of always re-reading.
    expect(reads).toHaveLength(1);
  });

  it('re-reads once after an edit, then caches again', async () => {
    const { mgr, reads, edit } = makeManager(ORIGINAL);

    await mgr.getSchemaContext('full');
    edit(EDITED);
    await mgr.getSchemaContext('full');
    await mgr.getSchemaContext('full');

    expect(reads).toHaveLength(2);
  });

  it('invalidateCache still forces a read', async () => {
    const { mgr, reads } = makeManager(ORIGINAL);

    await mgr.getSchemaContext('full');
    mgr.invalidateCache();
    await mgr.getSchemaContext('full');

    expect(reads).toHaveLength(2);
  });
});
