// WikiPageIndex — the per-file page index (Issue #662).
//
// The index exists because `getExistingWikiPages` reads every wiki page in
// full and its callers run per written page. What it must guarantee: the same
// list a full walk produces, in the same order, with each body read only when
// that file actually changed.

import { describe, it, expect } from 'vitest';
import { WikiPageIndex } from '../../../wiki/lint/get-existing-pages';
import type { App } from 'obsidian';

interface Entry { content: string; mtime: number; size: number }

function makeVault(initial: Record<string, string>) {
  const files = new Map<string, Entry>();
  const order: string[] = [];
  const reads: string[] = [];
  /** Fires while that path's body is being read — the editor saving mid-read. */
  const duringRead = new Map<string, () => void>();

  const put = (path: string, content: string, mtime = 1): void => {
    if (!files.has(path)) order.push(path);
    files.set(path, { content, mtime, size: content.length });
  };
  for (const [path, content] of Object.entries(initial)) put(path, content);

  const app = {
    vault: {
      // `stat` is a live view, as Obsidian's TFile.stat is: a change that
      // lands after the file object was handed out is visible through it.
      // A snapshot here would hide the very race this index has to survive.
      getMarkdownFiles: () => order.filter(p => files.has(p)).map(path => ({
        path,
        basename: path.split('/').pop()!.replace(/\.md$/, ''),
        get stat() {
          const e = files.get(path)!;
          return { ctime: 0, mtime: e.mtime, size: e.size };
        },
      })),
      read: async (f: { path: string }): Promise<string> => {
        reads.push(f.path);
        const content = files.get(f.path)!.content;
        const hook = duringRead.get(f.path);
        if (hook) { duringRead.delete(f.path); hook(); }
        return content;
      },
    },
  } as unknown as App;

  return {
    app,
    reads,
    put,
    onNextRead: (path: string, fn: () => void): void => { duringRead.set(path, fn); },
    remove: (path: string): void => { files.delete(path); },
    /** Insert at a position other than the end, the way a vault listing can. */
    insertAt: (i: number, path: string, content: string): void => {
      order.splice(i, 0, path);
      files.set(path, { content, mtime: 1, size: content.length });
    },
  };
}

const PAGES = {
  'wiki/entities/Alpha.md': '---\naliases: [A]\n---\nalpha body',
  'wiki/entities/Beta.md': '---\ntags: [other]\n---\nbeta body',
  'wiki/concepts/Gamma.md': 'gamma body',
};

describe('WikiPageIndex', () => {
  it('reads every page once and reuses the entries on the next call', async () => {
    const vault = makeVault(PAGES);
    const index = new WikiPageIndex(vault.app, () => 'wiki');

    const first = await index.pages();
    expect(first.map(p => p.path)).toEqual(Object.keys(PAGES));
    expect(vault.reads).toHaveLength(3);

    const second = await index.pages();
    expect(second.map(p => p.path)).toEqual(Object.keys(PAGES));
    expect(vault.reads).toHaveLength(3); // no second read of anything
  });

  it('re-reads only the file whose mtime or size changed', async () => {
    const vault = makeVault(PAGES);
    const index = new WikiPageIndex(vault.app, () => 'wiki');
    await index.pages();

    vault.put('wiki/entities/Beta.md', 'beta body, edited elsewhere', 2);
    const pages = await index.pages();

    expect(vault.reads.slice(3)).toEqual(['wiki/entities/Beta.md']);
    expect(pages.find(p => p.title === 'Beta')!.text).toContain('edited elsewhere');
  });

  it('re-reads a page the writer invalidated, even at an unchanged mtime', async () => {
    // A filesystem mtime has second granularity: a write followed by a read
    // inside the same second would otherwise be invisible. The writer says so.
    const vault = makeVault(PAGES);
    const index = new WikiPageIndex(vault.app, () => 'wiki');
    await index.pages();

    vault.put('wiki/entities/Alpha.md', '---\naliases: [A]\n---\nalpha body', 1); // same mtime AND size
    index.invalidate('wiki/entities/Alpha.md');
    await index.pages();

    expect(vault.reads.slice(3)).toEqual(['wiki/entities/Alpha.md']);
  });

  it('places a page created mid-run where the vault lists it, not at the end', async () => {
    const vault = makeVault(PAGES);
    const index = new WikiPageIndex(vault.app, () => 'wiki');
    await index.pages();

    vault.insertAt(1, 'wiki/entities/Anew.md', 'new body');
    const pages = await index.pages();

    expect(pages.map(p => p.title)).toEqual(['Alpha', 'Anew', 'Beta', 'Gamma']);
  });

  it('does not hold a body it read before a change that landed during the read', async () => {
    // `TFile.stat` is live. If the stat were taken after the body, a file
    // changed mid-read would be held as {old body, new stat} — valid-looking
    // for good. Taken before, the pair is {old body, old stat} and the next
    // call re-reads.
    const vault = makeVault(PAGES);
    const index = new WikiPageIndex(vault.app, () => 'wiki');

    vault.onNextRead('wiki/entities/Alpha.md', () => {
      vault.put('wiki/entities/Alpha.md', 'alpha body, saved by the editor mid-read', 9);
    });
    await index.pages();

    const pages = await index.pages();
    expect(pages.find(p => p.title === 'Alpha')!.text).toContain('mid-read');
  });

  it('drops a page that left the vault', async () => {
    const vault = makeVault(PAGES);
    const index = new WikiPageIndex(vault.app, () => 'wiki');
    await index.pages();

    vault.remove('wiki/entities/Beta.md');
    const pages = await index.pages();

    expect(pages.map(p => p.title)).toEqual(['Alpha', 'Gamma']);
    expect(index.size).toBe(2);
  });

  it('keeps the Welcome note out and does not hold it', async () => {
    const vault = makeVault({
      ...PAGES,
      'wiki/Welcome.md': '---\ntype: welcome\n---\nonboarding',
    });
    const index = new WikiPageIndex(vault.app, () => 'wiki');

    const pages = await index.pages();
    expect(pages.map(p => p.title)).not.toContain('Welcome');
    expect(index.size).toBe(3);
  });
  it('carries the page H1 as displayTitle, through a reused entry too', async () => {
    // `displayTitle` is what a link repair shows the reader (dead-link-detector,
    // fix-dead-link). It is derived from the body, so it has to survive both the
    // first read and every later call that reuses the held entry.
    const vault = makeVault({ 'wiki/entities/Delta.md': '# Delta Ray\n\ndelta body' });
    const index = new WikiPageIndex(vault.app, () => 'wiki');

    expect((await index.pages())[0].displayTitle).toBe('Delta Ray');
    expect((await index.pages())[0].displayTitle).toBe('Delta Ray');
    expect(vault.reads).toHaveLength(1);
  });
});
