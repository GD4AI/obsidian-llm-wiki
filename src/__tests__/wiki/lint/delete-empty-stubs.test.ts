// #678 — a page Fix Dead Links writes is never collected by "Delete Empty
// Stubs". #197 (d53caab) replaced the stub sentence and left `STUB_MARKER` on
// the old one, so `isPageEmpty` stopped recognising these pages: the current
// placeholder clears MIN_SUBSTANTIVE_CHARS by roughly a factor of two once
// EMPTY_CONTENT_STRIP has run.
//
// The fix keys off `stub: true` instead — the marker `fix-dead-link.ts`
// documents as the one that actually carries "this is a stub", and which
// `merge-page.ts` strips when a source that treats the subject fills the page.
// It is deliberately NOT folded into `isPageEmpty`, because that predicate also
// decides which pages "Expand Empty Pages" hands to the LLM, and #197's policy
// gate forbids fabricating content for an unresolvable link. The last test
// below pins that separation so a later edit cannot merge the two predicates
// back together by accident.

import { describe, it, expect } from 'vitest';
import { deleteEmptyStubs } from '../../../wiki/lint/delete-empty-stubs';
import { isPageEmpty } from '../../../wiki/lint/utils';
import { buildDissentStubContent } from '../../../wiki/page-factory/stub-page';
import { createMockContext } from '../../__support__/engine-context';
import { createFakeLinkVault } from '../../__support__/link-vault';
import type { EngineContext } from '../../../types';

const WIKI = 'wiki';
const STUB_PATH = `${WIKI}/concepts/smart-batch-skip.md`;

function deadLinkStub(title: string, referrer: string): string {
  return `---\ntype: concept\ncreated: 2026-09-12\nsources:\n  - "[[${referrer}]]"\ntags: [thema/wissen]\nstub: true\ngeneration_complete: false\n---\n# ${title}\n\n> Stub created by Fix Dead Links — referenced by [[${referrer}]]. Will be filled by next ingest of an actual source that defines this entity.\n`;
}

/** Built by the real gate writer, so the shape cannot drift away from the test. */
function dissentStub(withSummary: boolean, withMention = true): string {
  return buildDissentStubContent({
    item: {
      name: 'Smart Batch Skip',
      type: 'term',
      summary: withSummary ? 'An optimisation that skips batches nothing changed in.' : '',
      // `buildDissentStubContent` drops `quoteBlock` entirely when this is
      // empty (`stub-page.ts:138`), which is the third form below.
      mentions_in_source: withMention ? ['Batches whose inputs are unchanged are skipped entirely.'] : [],
      related_concepts: [],
    },
    stubType: 'concept',
    sourceSlug: 'some-source',
    cell: 'unnamed-but-present',
  });
}

const SUBSTANTIVE = `---\ntype: concept\n---\n# Real Page\n\nA page with a paragraph of actual content, comfortably past the substantive-character floor used by the empty-page predicate.\n`;

async function runDelete(vaultFiles: Record<string, string>) {
  const { ctx } = createMockContext({ vaultFiles });
  const deleted: string[] = [];
  ctx.deleteFile = async (p: string) => { deleted.push(p); };
  const result = await deleteEmptyStubs(ctx, WIKI);
  return { deleted, result };
}

describe('deleteEmptyStubs — a Fix Dead Links stub is collected (#678)', () => {
  it('deletes the stub even though its placeholder text is not "empty"', async () => {
    const stub = deadLinkStub('Smart Batch Skip', 'Notizen/note.md');
    // The premise of the bug: the placeholder clears the floor, so the
    // text-based predicate says the page is fine.
    expect(isPageEmpty(stub)).toBe(false);

    const { deleted, result } = await runDelete({ [STUB_PATH]: stub });

    expect(deleted).toEqual([STUB_PATH]);
    expect(result.deleted).toBe(1);
  });

  it('keeps a page that carries real content', async () => {
    const { deleted, result } = await runDelete({ [`${WIKI}/concepts/real.md`]: SUBSTANTIVE });

    expect(deleted).toEqual([]);
    expect(result.deleted).toBe(0);
  });

  it('keeps a stub the user marked reviewed', async () => {
    const reviewed = deadLinkStub('Kept On Purpose', 'Notizen/note.md')
      .replace('stub: true\n', 'stub: true\nreviewed: true\n');

    const { deleted } = await runDelete({ [STUB_PATH]: reviewed });

    expect(deleted).toEqual([]);
  });

  it('keeps a page a source has filled — merge-page strips the marker', async () => {
    const filled = deadLinkStub('Filled By Ingest', 'Notizen/note.md').replace('stub: true\n', '');

    const { deleted } = await runDelete({ [STUB_PATH]: filled });

    expect(deleted).toEqual([]);
  });

  it('collects an empty page that is not a stub — the text predicate still governs those', async () => {
    const empty = `---\ntype: concept\n---\n# Thin\n\nTiny.\n`;

    const { deleted, result } = await runDelete({ [`${WIKI}/concepts/thin.md`]: empty });

    expect(deleted).toEqual([`${WIKI}/concepts/thin.md`]);
    expect(result.deleted).toBe(1);
  });

  it('leaves isPageEmpty alone, so Expand Empty Pages never sees a stub (#197)', () => {
    // If a stub ever became "empty" here it would be offered to fillEmptyPage,
    // which #197's gate exists to prevent. Deleting and filling are different
    // decisions and must stay in different predicates.
    expect(isPageEmpty(deadLinkStub('Smart Batch Skip', 'Notizen/note.md'))).toBe(false);
  });

  // The marker `stub: true` has two writers. The dead-link one writes a
  // placeholder and nothing else; the ingest candidate gate writes a
  // placeholder PLUS the extraction's summary and a verbatim quote. Everything
  // below keeps that second kind on disk — the action is named "Delete Empty
  // Stubs" and those pages are not empty.
  it('keeps a gate stub that carries a summary and a quote', async () => {
    const stub = dissentStub(true);
    expect(isPageEmpty(stub)).toBe(false);
    expect(stub).toContain('stub: true');

    const { deleted } = await runDelete({ [STUB_PATH]: stub });

    expect(deleted).toEqual([]);
  });

  it('keeps a gate stub whose summary is empty — its quote is still content', async () => {
    const stub = dissentStub(false);
    expect(stub).toContain('stub: true');

    const { deleted } = await runDelete({ [STUB_PATH]: stub });

    expect(deleted).toEqual([]);
  });

  it('still collects the dead-link stub that sits beside those', async () => {
    // Same helper, same frontmatter, same marker — only the body differs. This
    // is the pair that makes the distinction mean something.
    const deadLink = deadLinkStub('Smart Batch Skip', 'Notizen/note.md');
    const gate = dissentStub(true);

    const { deleted } = await runDelete({ [`${WIKI}/concepts/from-dead-link.md`]: deadLink, [`${WIKI}/concepts/from-gate.md`]: gate });

    expect(deleted).toEqual([`${WIKI}/concepts/from-dead-link.md`]);
  });

  // The gate stub's third form, and the one a later reader is most likely to
  // mistake for a bug. With neither a summary nor a mention, `quoteBlock` is
  // empty (`stub-page.ts:138`), so the body is a heading and its placeholder —
  // the dead-link shape exactly. Collecting it is deliberate: there is nothing
  // on the page a model produced, which is the same test the dead-link stub
  // fails. Without this case, someone "fixing" isEmptyStub to spare gate stubs
  // would silently reintroduce #678.
  it('collects a gate stub with neither a summary nor a quote — nothing was paid for', async () => {
    const stub = dissentStub(false, false);
    expect(stub).toContain('stub: true');
    expect(stub).not.toContain('> "');

    const { deleted } = await runDelete({ [STUB_PATH]: stub });

    expect(deleted).toEqual([STUB_PATH]);
  });
});

// The other half of the round trip. Fix Dead Links creates this stub and
// repoints the referring link at it; once the stub is collected the link is
// dead again, and before this it stayed dead pointing at a folder-typed path
// nobody wrote.
describe('deleteEmptyStubs — the links pointing at a collected stub', () => {
  const REFERRER = 'Notizen/Blutbild.md';
  const STUB = `${WIKI}/entities/Vitamin-B12.md`;
  const STUB_2 = `${WIKI}/entities/Folsaeure.md`;

  function ctxOver(files: Record<string, string>, opts: { deleteThrows?: boolean } = {}): {
    ctx: EngineContext; fake: ReturnType<typeof createFakeLinkVault>; deleted: string[]; order: string[];
  } {
    const fake = createFakeLinkVault(files);
    const deleted: string[] = [];
    const order: string[] = [];
    const ctx = {
      app: {
        vault: {
          ...fake.vault,
          read: async (file: { path: string }) => fake.read(file.path),
          process: async (file: { path: string }, fn: (d: string) => string) => {
            order.push(`write:${file.path}`);
            return fake.vault.process(file, fn);
          },
        },
        metadataCache: fake.metadataCache,
      },
      settings: { wikiFolder: WIKI },
      deleteFile: async (path: string) => {
        order.push(`delete:${path}`);
        if (opts.deleteThrows) throw new Error('vault busy');
        deleted.push(path);
      },
    } as unknown as EngineContext;
    return { ctx, fake, deleted, order };
  }

  it('hands the link its name back instead of leaving a path to a deleted page', async () => {
    const { ctx, fake, deleted } = ctxOver({
      [STUB]: deadLinkStub('Vitamin-B12', 'sources/Blutbild'),
      [REFERRER]: 'Low [[entities/Vitamin-B12|Vitamin B12]] in the panel.\n',
    });

    const result = await deleteEmptyStubs(ctx, WIKI);

    expect(deleted).toEqual([STUB]);
    expect(fake.read(REFERRER)).toBe('Low [[Vitamin B12]] in the panel.\n');
    expect(result.linksRestored).toBe(1);
    expect(result.linksLeftDead).toBe(0);
  });

  it('keeps both links when one note references two collected stubs', async () => {
    const { ctx, fake } = ctxOver({
      [STUB]: deadLinkStub('Vitamin-B12', 'sources/Blutbild'),
      [STUB_2]: deadLinkStub('Folsaeure', 'sources/Blutbild'),
      [REFERRER]: 'Low [[entities/Vitamin-B12|Vitamin B12]] and [[entities/Folsaeure|Folsäure]].\n',
    });

    const result = await deleteEmptyStubs(ctx, WIKI);

    expect(fake.read(REFERRER)).toBe('Low [[Vitamin B12]] and [[Folsäure]].\n');
    expect(result.linksRestored).toBe(2);
    expect(result.linksLeftDead).toBe(0);
  });

  it('leaves the links untouched when the delete fails', async () => {
    // The page is still on disk. Rewriting its incoming links here would point
    // them away from a page that exists, and orphan the stub for good.
    const { ctx, fake } = ctxOver({
      [STUB]: deadLinkStub('Vitamin-B12', 'sources/Blutbild'),
      [REFERRER]: 'Low [[entities/Vitamin-B12|Vitamin B12]] in the panel.\n',
    }, { deleteThrows: true });

    const result = await deleteEmptyStubs(ctx, WIKI);

    expect(result.deleted).toBe(0);
    expect(result.failed).toBe(1);
    expect(fake.read(REFERRER)).toBe('Low [[entities/Vitamin-B12|Vitamin B12]] in the panel.\n');
    expect(result.linksRestored).toBe(0);
  });

  it('reports a link it cannot restore rather than inventing a name', async () => {
    const { ctx, fake, deleted } = ctxOver({
      [STUB]: deadLinkStub('Vitamin-B12', 'sources/Blutbild'),
      [REFERRER]: 'See [[entities/Vitamin-B12]].\n',
    });

    const result = await deleteEmptyStubs(ctx, WIKI);

    expect(deleted).toEqual([STUB]);
    expect(fake.read(REFERRER)).toBe('See [[entities/Vitamin-B12]].\n');
    expect(result.linksRestored).toBe(0);
    expect(result.linksLeftDead).toBe(1);
  });

  it('still deletes when the link layer is unavailable', async () => {
    // The action's job is collecting empty stubs. Link care is an addition to
    // it, so an unusable metadata cache must not turn a delete into a failure.
    const { ctx, deleted } = ctxOver({
      [STUB]: deadLinkStub('Vitamin-B12', 'sources/Blutbild'),
      [REFERRER]: 'Low [[entities/Vitamin-B12|Vitamin B12]] in the panel.\n',
    });
    (ctx.app as unknown as { metadataCache: unknown }).metadataCache = undefined;

    const result = await deleteEmptyStubs(ctx, WIKI);

    expect(deleted).toEqual([STUB]);
    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.linksRestored).toBe(0);
  });

  it('plans while the page is there and writes only after it is gone', async () => {
    // Both halves are timing-bound in opposite directions: resolving a link
    // needs the page, writing needs the delete to have succeeded.
    const { ctx, order } = ctxOver({
      [STUB]: deadLinkStub('Vitamin-B12', 'sources/Blutbild'),
      [REFERRER]: 'Low [[entities/Vitamin-B12|Vitamin B12]] in the panel.\n',
    });

    await deleteEmptyStubs(ctx, WIKI);

    expect(order).toEqual([`delete:${STUB}`, `write:${REFERRER}`]);
  });
});
