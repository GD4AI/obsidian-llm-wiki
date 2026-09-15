import { describe, it, expect } from 'vitest';
import { retargetLinksToPage, planDisplayNameRestores, applyRestorePlan } from '../../core/link-retarget';
import { createFakeLinkVault } from '../__support__/link-vault';

const FROM = 'wiki/entities/Osteopontin-2.md';
const TO = 'wiki/entities/Osteopontin.md';

describe('retargetLinksToPage', () => {
  it('rewrites a bare-title link in a note outside the wiki folder', async () => {
    // The measured case: 1762 of 1762 incoming links from user notes were
    // written bare, and the previous rewrite visited wiki files only.
    const fake = createFakeLinkVault({
      [FROM]: '# Osteopontin-2\n',
      [TO]: '# Osteopontin\n',
      'Notizen/Knochenstoffwechsel.md': 'See [[Osteopontin-2]] for the marker.\n',
    });

    const result = await retargetLinksToPage(fake, FROM, TO);

    expect(fake.read('Notizen/Knochenstoffwechsel.md')).toBe('See [[Osteopontin]] for the marker.\n');
    expect(result).toEqual({ filesChanged: 1, linksRewritten: 1, stale: 0 });
  });

  it('leaves a same-named page elsewhere in the vault alone', async () => {
    // Resolve-before-replace: a bare `[[Osteopontin-2]]` next to the note's own
    // Osteopontin-2 addresses that file, not the wiki page being merged. A
    // string match would bend this link to a page it never referenced.
    const fake = createFakeLinkVault({
      [FROM]: '# Osteopontin-2\n',
      [TO]: '# Osteopontin\n',
      'Notizen/Osteopontin-2.md': '# My own note\n',
      'Notizen/Knochenstoffwechsel.md': 'See [[Osteopontin-2]].\n',
    });

    const result = await retargetLinksToPage(fake, FROM, TO);

    expect(fake.read('Notizen/Knochenstoffwechsel.md')).toBe('See [[Osteopontin-2]].\n');
    expect(result).toEqual({ filesChanged: 0, linksRewritten: 0, stale: 0 });
    expect(fake.processed).toEqual([]);
  });

  it('keeps the link shape: a folder-prefixed link stays folder-prefixed', async () => {
    const fake = createFakeLinkVault({
      [FROM]: '# Osteopontin-2\n',
      [TO]: '# Osteopontin\n',
      'wiki/concepts/Knochenumbau.md': 'Regulated by [[entities/Osteopontin-2]].\n',
      'Notizen/Knochenstoffwechsel.md': 'See [[Osteopontin-2]].\n',
    });

    await retargetLinksToPage(fake, FROM, TO);

    expect(fake.read('wiki/concepts/Knochenumbau.md')).toBe('Regulated by [[entities/Osteopontin]].\n');
    expect(fake.read('Notizen/Knochenstoffwechsel.md')).toBe('See [[Osteopontin]].\n');
  });

  it('preserves display text, subpath and the embed marker', async () => {
    const fake = createFakeLinkVault({
      [FROM]: '# Osteopontin-2\n',
      [TO]: '# Osteopontin\n',
      'Notizen/Knochenstoffwechsel.md':
        'A [[Osteopontin-2|OPN]] and a section [[Osteopontin-2#Funktion]].\n' +
        '![[Osteopontin-2#Funktion|OPN]]\n',
    });

    const result = await retargetLinksToPage(fake, FROM, TO);

    expect(fake.read('Notizen/Knochenstoffwechsel.md')).toBe(
      'A [[Osteopontin|OPN]] and a section [[Osteopontin#Funktion]].\n' +
      '![[Osteopontin#Funktion|OPN]]\n'
    );
    expect(result.linksRewritten).toBe(3);
  });

  it('does not touch a link quoted inside a code block', async () => {
    const fake = createFakeLinkVault({
      [FROM]: '# Osteopontin-2\n',
      [TO]: '# Osteopontin\n',
      'Notizen/Plugin-Notizen.md': 'Example:\n\n```\n[[Osteopontin-2]]\n```\n',
    });

    const result = await retargetLinksToPage(fake, FROM, TO);

    expect(fake.read('Notizen/Plugin-Notizen.md')).toContain('[[Osteopontin-2]]');
    expect(result.linksRewritten).toBe(0);
  });

  it('skips the page being deleted and files without references', async () => {
    const fake = createFakeLinkVault({
      [FROM]: '# Osteopontin-2\n\nSee [[Osteopontin-2]] and [[Osteopontin]].\n',
      [TO]: '# Osteopontin\n',
      'Notizen/Unrelated.md': 'No links here.\n',
    });

    const result = await retargetLinksToPage(fake, FROM, TO);

    expect(fake.read(FROM)).toContain('[[Osteopontin-2]]');
    expect(fake.processed).toEqual([]);
    expect(result).toEqual({ filesChanged: 0, linksRewritten: 0, stale: 0 });
  });

  it('reports a link it could not rewrite instead of splicing on a stale offset', async () => {
    const fake = createFakeLinkVault({
      [FROM]: '# Osteopontin-2\n',
      [TO]: '# Osteopontin\n',
      'Notizen/Knochenstoffwechsel.md': 'See [[Osteopontin-2]].\n',
    });
    // The cache is read first; the file then changes underneath, as it would if
    // the user edited the note between indexing and the merge.
    const cache = fake.metadataCache.getFileCache;
    fake.metadataCache.getFileCache = file => {
      const result = cache({ path: file.path });
      if (file.path === 'Notizen/Knochenstoffwechsel.md') {
        fake.write(file.path, 'Rewritten by hand. See [[Osteopontin-2]].\n');
      }
      return result;
    };

    const result = await retargetLinksToPage(fake, FROM, TO);

    expect(fake.read('Notizen/Knochenstoffwechsel.md')).toBe('Rewritten by hand. See [[Osteopontin-2]].\n');
    expect(result).toEqual({ filesChanged: 0, linksRewritten: 0, stale: 1 });
  });

  it('rewrites several links in one file in a single write', async () => {
    const fake = createFakeLinkVault({
      [FROM]: '# Osteopontin-2\n',
      [TO]: '# Osteopontin\n',
      'Notizen/Knochenstoffwechsel.md': '[[Osteopontin-2]] und [[Osteopontin-2|OPN]] und [[Osteopontin-2]].\n',
    });

    const result = await retargetLinksToPage(fake, FROM, TO);

    expect(fake.read('Notizen/Knochenstoffwechsel.md')).toBe(
      '[[Osteopontin]] und [[Osteopontin|OPN]] und [[Osteopontin]].\n'
    );
    expect(result).toEqual({ filesChanged: 1, linksRewritten: 3, stale: 0 });
    expect(fake.processed).toEqual(['Notizen/Knochenstoffwechsel.md']);
  });

  it('is a no-op when source and target are the same page', async () => {
    const fake = createFakeLinkVault({
      [TO]: '# Osteopontin\n',
      'Notizen/Knochenstoffwechsel.md': 'See [[Osteopontin]].\n',
    });

    const result = await retargetLinksToPage(fake, TO, TO);

    expect(result).toEqual({ filesChanged: 0, linksRewritten: 0, stale: 0 });
    expect(fake.processed).toEqual([]);
  });
});

// The deletion with no successor page: Fix Dead Links wrote this stub and
// repointed the referring link at it, carrying the author's name over as
// display text. Delete Empty Stubs collects the stub again (#691), and the
// name is the one thing left to put the link back the way it was written.
const STUB = 'wiki/entities/Vitamin-B12.md';

/** Plan and apply in one go, the way a caller does when every target is deleted. */
async function restoreAll(fake: ReturnType<typeof createFakeLinkVault>, targets: string[]) {
  const plan = planDisplayNameRestores(fake, new Set(targets));
  const applied = await applyRestorePlan(fake, plan.restores);
  return { ...applied, left: plan.left };
}

describe('planDisplayNameRestores / applyRestorePlan', () => {
  it('gives the display text back as the link target', async () => {
    const fake = createFakeLinkVault({
      [STUB]: '# Vitamin-B12\n',
      'Notizen/Blutbild.md': 'Low [[entities/Vitamin-B12|Vitamin B12]] in the panel.\n',
    });

    const result = await restoreAll(fake, [STUB]);

    expect(fake.read('Notizen/Blutbild.md')).toBe('Low [[Vitamin B12]] in the panel.\n');
    expect(result).toEqual({ filesChanged: 1, linksRestored: 1, left: 0, stale: 0 });
  });

  it('rewrites a note referencing two deleted pages once, keeping both links', async () => {
    // One pass for all targets. Two passes would shift the second link's cached
    // offsets under a metadata cache that has not re-indexed, and the stale
    // guard would drop exactly the link this exists to save.
    const OTHER = 'wiki/entities/Folsaeure.md';
    const fake = createFakeLinkVault({
      [STUB]: '# Vitamin-B12\n',
      [OTHER]: '# Folsaeure\n',
      'Notizen/Blutbild.md':
        'Low [[entities/Vitamin-B12|Vitamin B12]] and [[entities/Folsaeure|Folsäure]] in the panel.\n',
    });

    const result = await restoreAll(fake, [STUB, OTHER]);

    expect(fake.read('Notizen/Blutbild.md')).toBe('Low [[Vitamin B12]] and [[Folsäure]] in the panel.\n');
    expect(result).toEqual({ filesChanged: 1, linksRestored: 2, left: 0, stale: 0 });
    expect(fake.processed).toEqual(['Notizen/Blutbild.md']);
  });

  it('leaves a link with no display text and reports it', async () => {
    // Nothing to restore it from: the name its author wrote is not in the file
    // any more. Inventing one from the slug is what put it here to begin with.
    const fake = createFakeLinkVault({
      [STUB]: '# Vitamin-B12\n',
      'Notizen/Blutbild.md': 'See [[entities/Vitamin-B12]].\n',
    });

    const result = await restoreAll(fake, [STUB]);

    expect(fake.read('Notizen/Blutbild.md')).toBe('See [[entities/Vitamin-B12]].\n');
    expect(result).toEqual({ filesChanged: 0, linksRestored: 0, left: 1, stale: 0 });
    expect(fake.processed).toEqual([]);
  });

  it('leaves a link whose subpath addresses the page being deleted', async () => {
    const fake = createFakeLinkVault({
      [STUB]: '# Vitamin-B12\n',
      'Notizen/Blutbild.md': 'See [[entities/Vitamin-B12#Description|Vitamin B12]].\n',
    });

    const result = await restoreAll(fake, [STUB]);

    expect(fake.read('Notizen/Blutbild.md')).toBe('See [[entities/Vitamin-B12#Description|Vitamin B12]].\n');
    expect(result).toEqual({ filesChanged: 0, linksRestored: 0, left: 1, stale: 0 });
  });

  it('leaves a display text that would read as link syntax of its own', async () => {
    // `[[a|b|c]]` rewritten to `[[b|c]]` is target `b`, alias `c` — a different
    // link than the one that was there.
    const fake = createFakeLinkVault({
      [STUB]: '# Vitamin-B12\n',
      'Notizen/Blutbild.md': 'See [[entities/Vitamin-B12|B12|cobalamin]].\n',
    });

    const result = await restoreAll(fake, [STUB]);

    expect(fake.read('Notizen/Blutbild.md')).toBe('See [[entities/Vitamin-B12|B12|cobalamin]].\n');
    expect(result).toEqual({ filesChanged: 0, linksRestored: 0, left: 1, stale: 0 });
  });

  it('leaves a link that resolves to a different page alone', async () => {
    // Resolve before replacing, same property the retarget half is built on.
    const fake = createFakeLinkVault({
      [STUB]: '# Vitamin-B12\n',
      'Notizen/Vitamin-B12.md': '# My own note\n',
      'Notizen/Blutbild.md': 'See [[Vitamin-B12|Vitamin B12]].\n',
    });

    const result = await restoreAll(fake, [STUB]);

    expect(fake.read('Notizen/Blutbild.md')).toBe('See [[Vitamin-B12|Vitamin B12]].\n');
    expect(result).toEqual({ filesChanged: 0, linksRestored: 0, left: 0, stale: 0 });
    expect(fake.processed).toEqual([]);
  });

  it('keeps the embed marker', async () => {
    const fake = createFakeLinkVault({
      [STUB]: '# Vitamin-B12\n',
      'Notizen/Blutbild.md': 'Panel: ![[entities/Vitamin-B12|Vitamin B12]]\n',
    });

    await restoreAll(fake, [STUB]);

    expect(fake.read('Notizen/Blutbild.md')).toBe('Panel: ![[Vitamin B12]]\n');
  });

  it('plans nothing when no page is being deleted', () => {
    const fake = createFakeLinkVault({
      [STUB]: '# Vitamin-B12\n',
      'Notizen/Blutbild.md': 'Low [[entities/Vitamin-B12|Vitamin B12]].\n',
    });

    expect(planDisplayNameRestores(fake, new Set())).toEqual({ restores: [], left: 0 });
  });
});
