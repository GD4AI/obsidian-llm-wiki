// A vault fake with the two things `src/core/link-retarget.ts` depends on and
// the production mock context does not model: a link cache with positions, and
// a linkpath resolver.
//
// The resolver deliberately mirrors Obsidian's own behaviour, because the
// safeguard under test ("only rewrite links that actually resolve to the page
// being deleted") is only meaningful against a realistic resolver:
//
//   * a linkpath may be a full path, a partial path, or a bare basename
//   * frontmatter aliases are NOT consulted — Obsidian's resolver reads its
//     file lookup, not aliases, so a bare link matching only an alias does not
//     resolve
//   * when several files match, the one in the linking file's own folder wins,
//     then the shortest path
//
// Links inside fenced code blocks are not reported, which is also what the real
// metadata cache does — a quoted `[[Foo]]` in documentation is not a link.

import type { EngineContext } from '../../types';

export interface FakeReference {
  link: string;
  original: string;
  position: { start: { offset: number }; end: { offset: number } };
}

export interface FakeLinkVault {
  vault: {
    getMarkdownFiles(): Array<{ path: string }>;
    process(file: { path: string }, fn: (data: string) => string): Promise<string>;
  };
  metadataCache: {
    getFileCache(file: { path: string }): { links?: FakeReference[]; embeds?: FakeReference[] } | null;
    getFirstLinkpathDest(linkpath: string, sourcePath: string): { path: string } | null;
  };
  read(path: string): string;
  write(path: string, content: string): void;
  /**
   * Remove a file. Added so the fake can be as faithful as production here: it used
   * to record a delete without performing one, which made a caller that read the
   * path back afterwards see the file still present and was the reason a read-back
   * check could not be written for #825.
   */
  remove(path: string): void;
  /** Paths whose content was handed to `vault.process`, in call order. */
  processed: string[];
}

const FENCE = /^\s*(```|~~~)/;

function fencedLineRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let offset = 0;
  let openedAt: number | null = null;
  for (const line of content.split('\n')) {
    if (FENCE.test(line)) {
      if (openedAt === null) openedAt = offset;
      else {
        ranges.push([openedAt, offset + line.length]);
        openedAt = null;
      }
    }
    offset += line.length + 1;
  }
  if (openedAt !== null) ranges.push([openedAt, content.length]);
  return ranges;
}

function scanReferences(content: string): { links: FakeReference[]; embeds: FakeReference[] } {
  const fenced = fencedLineRanges(content);
  const inFence = (offset: number): boolean =>
    fenced.some(([start, end]) => offset >= start && offset < end);

  const links: FakeReference[] = [];
  const embeds: FakeReference[] = [];
  const pattern = /(!?)\[\[([^\][]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (inFence(match.index)) continue;
    const inner = match[2];
    const pipe = inner.indexOf('|');
    const link = pipe >= 0 ? inner.slice(0, pipe) : inner;
    const reference: FakeReference = {
      link,
      original: match[0],
      position: {
        start: { offset: match.index },
        end: { offset: match.index + match[0].length },
      },
    };
    (match[1] === '!' ? embeds : links).push(reference);
  }
  return { links, embeds };
}

export function createFakeLinkVault(initial: Record<string, string>): FakeLinkVault {
  const files = new Map<string, string>(Object.entries(initial));
  const processed: string[] = [];

  const resolve = (linkpath: string, sourcePath: string): { path: string } | null => {
    const wanted = linkpath.replace(/\.md$/, '');
    const sourceFolder = sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1);
    const matches = [...files.keys()].filter(path => {
      const withoutExt = path.replace(/\.md$/, '');
      if (withoutExt === wanted) return true;
      if (withoutExt.endsWith(`/${wanted}`)) return true;
      return false;
    });
    if (matches.length === 0) return null;
    matches.sort((a, b) => {
      const exact = (p: string): number => (p.replace(/\.md$/, '') === wanted ? 0 : 1);
      if (exact(a) !== exact(b)) return exact(a) - exact(b);
      const local = (p: string): number => (p.startsWith(sourceFolder) ? 0 : 1);
      if (local(a) !== local(b)) return local(a) - local(b);
      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b);
    });
    return { path: matches[0] };
  };

  return {
    vault: {
      getMarkdownFiles: () => [...files.keys()].map(path => ({ path })),
      process: async (file, fn) => {
        processed.push(file.path);
        const next = fn(files.get(file.path) ?? '');
        files.set(file.path, next);
        return next;
      },
    },
    metadataCache: {
      getFileCache: file => {
        const content = files.get(file.path);
        if (content === undefined) return null;
        return scanReferences(content);
      },
      getFirstLinkpathDest: resolve,
    },
    read: path => files.get(path) ?? '',
    write: (path, content) => { files.set(path, content); },
    remove: path => { files.delete(path); },
    processed,
  };
}

/**
 * EngineContext wrapper over a FakeLinkVault, for tests that drive a
 * lint/wiki module through ctx methods (mergeDuplicatePages and friends).
 * Mirrors what the three merge-duplicates test files used to hand-roll:
 * tryReadFile falls back to the vault fake, createOrUpdateFile writes
 * through, deleteFile pushes into the optional `deleted` capture array.
 */
export function createMergeCtx(
  files: Record<string, string>,
  opts: { captureDeletes?: boolean } = {},
): { ctx: EngineContext; fake: FakeLinkVault; deleted: string[] } {
  const fake = createFakeLinkVault(files);
  const deleted: string[] = [];
  const ctx = {
    app: { vault: fake.vault, metadataCache: fake.metadataCache },
    settings: { wikiFolder: 'wiki', language: 'en' },
    getClient: () => null,
    tryReadFile: async (path: string) => (files[path] === undefined ? fake.read(path) || null : fake.read(path)),
    createOrUpdateFile: async (path: string, content: string) => { fake.write(path, content); },
    deleteFile: async (path: string) => { if (opts.captureDeletes) deleted.push(path); fake.remove(path); },
    getSchemaContext: async () => undefined,
  } as unknown as EngineContext;
  return { ctx, fake, deleted };
}
