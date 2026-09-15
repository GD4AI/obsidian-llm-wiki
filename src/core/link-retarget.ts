// Issue #386 — retarget every link that points at a page before that page is
// deleted.
//
// `mergeDuplicatePages` merges a duplicate into its target and then deletes the
// duplicate. Every link still pointing at the deleted page is dead from that
// moment on, and the deletion is what makes it unfindable afterwards: no scan
// can report a reference to a file that no longer exists.
//
// The rewrite this replaces looked only inside the wiki folder, and searched
// only for the wiki-relative form (`[[entities/Foo]]`). Measured on a vault
// with 2824 wiki pages and 473 notes outside the wiki: of the links pointing
// from outside into the wiki, 1762 (across 340 notes) were written as a bare
// title `[[Foo]]` and none carried a folder prefix — the bare form is what
// Obsidian's own autocomplete inserts. Widening the radius without widening
// the link form would therefore have changed nothing at all.
//
// Two properties this module is built around:
//
//   * Resolve before replacing. A bare `[[Foo]]` is not evidence that this
//     page is meant: another note named `Foo` elsewhere in the vault owns that
//     link. Every candidate is resolved through the same resolver the app uses
//     (`getFirstLinkpathDest`, which is source-file relative), and only a link
//     that actually lands on the page being deleted is touched. Frontmatter
//     aliases are deliberately NOT consulted, because Obsidian's resolver does
//     not consult them either — a bare link matching only an alias does not
//     resolve today, and pretending otherwise here would rewrite links that
//     were never pointing at this page.
//
//   * Write surgically. Foreign notes are the user's own files. Replacements
//     are applied at the offsets the metadata cache reports, so nothing else
//     in the file is reformatted, and links inside code blocks are left alone
//     because the cache does not report them as links. This is also why the
//     write goes through `vault.process` rather than the wiki's own write gate
//     (`createOrUpdateFile`), which normalizes `sources:` frontmatter and
//     corrects link pollution on every write — appropriate for a generated
//     wiki page, not for someone's own note.
//
// The module is deliberately free of wiki vocabulary (no `wikiFolder`, no page
// types) so the same primitive serves a rename or a redirect feature later.

/** The subset of `TFile` this module needs. */
export interface RetargetFile {
  path: string;
}

/** The subset of `Reference` (link and embed cache entries) this module needs. */
export interface RetargetReference {
  /** Link destination as written, including any `#subpath`. */
  link: string;
  /** The reference exactly as it appears in the document, e.g. `[[a/b|c]]`. */
  original: string;
  position: { start: { offset: number }; end: { offset: number } };
}

/** The subset of `MetadataCache` this module needs. */
export interface RetargetMetadataCache {
  getFileCache(file: RetargetFile): {
    links?: RetargetReference[];
    embeds?: RetargetReference[];
  } | null;
  getFirstLinkpathDest(linkpath: string, sourcePath: string): RetargetFile | null;
}

/** The subset of `Vault` this module needs. */
export interface RetargetVault {
  getMarkdownFiles(): RetargetFile[];
  process(file: RetargetFile, fn: (data: string) => string): Promise<string>;
}

export interface RetargetDeps {
  vault: RetargetVault;
  metadataCache: RetargetMetadataCache;
}

export interface RetargetResult {
  /** Files whose content was rewritten. */
  filesChanged: number;
  /** Individual references rewritten. */
  linksRewritten: number;
  /**
   * References that resolved to the page but could not be rewritten because
   * the file on disk no longer matched the cached position. Non-zero means
   * those links are about to go dead — the caller should surface it.
   */
  stale: number;
}

/**
 * Every linkpath under which `filePath` is addressable, shortest first:
 * `Foo`, `entities/Foo`, `wiki/entities/Foo`. Which of them actually resolves
 * to this file depends on the linking file and is decided by the resolver.
 */
function addressableForms(filePath: string): string[] {
  const withoutExt = filePath.replace(/\.md$/, '');
  const segments = withoutExt.split('/');
  const forms: string[] = [];
  for (let i = segments.length - 1; i >= 0; i--) {
    forms.push(segments.slice(i).join('/'));
  }
  return forms;
}

/**
 * Pick the linkpath to write for a link that lived in `fromFile` and pointed at
 * the page now being replaced by `toPath`.
 *
 * Preference order is *shape first*: a link written with two segments is
 * rewritten with two segments where that resolves. The wiki writes its own
 * internal links folder-prefixed and a user note writes bare titles; a rewrite
 * that silently converted between the two would be a second, unasked-for change
 * to the file. Only when the original's shape does not resolve does this fall
 * back to the shortest form that does, and finally to the full path, which
 * always resolves.
 */
function chooseLinkpath(
  metadataCache: RetargetMetadataCache,
  linkingFilePath: string,
  originalLinkpath: string,
  toPath: string
): string {
  const forms = addressableForms(toPath);
  const resolvesToTarget = (candidate: string): boolean =>
    metadataCache.getFirstLinkpathDest(candidate, linkingFilePath)?.path === toPath;

  const originalDepth = originalLinkpath.split('/').length;
  const sameShape = forms.find(f => f.split('/').length === originalDepth);
  if (sameShape && resolvesToTarget(sameShape)) return sameShape;

  const shortestResolving = forms.find(resolvesToTarget);
  if (shortestResolving) return shortestResolving;

  return forms[forms.length - 1];
}

/**
 * Rewrite every link in the vault that resolves to `fromPath` so it points at
 * `toPath` instead. Call this BEFORE deleting `fromPath` — resolution depends
 * on the file still existing.
 *
 * `fromPath` itself is skipped: its own links are about to disappear with it.
 */
export async function retargetLinksToPage(
  deps: RetargetDeps,
  fromPath: string,
  toPath: string
): Promise<RetargetResult> {
  if (fromPath === toPath) return { filesChanged: 0, linksRewritten: 0, stale: 0 };

  const edits: FileEdit[] = [];
  for (const found of collectResolvingReferences(deps, new Set([fromPath]))) {
    const newLinkpath = chooseLinkpath(deps.metadataCache, found.file.path, found.linkpath, toPath);
    // Rebuild from `original` so display text (`|…`), the embed marker (`!`)
    // and the subpath survive verbatim; only the destination changes.
    const replacement = found.ref.original.replace(
      `[[${found.ref.link}`,
      `[[${newLinkpath}${found.subpath}`
    );
    if (replacement === found.ref.original) continue;
    edits.push({ file: found.file, edit: editFor(found.ref, replacement) });
  }

  const { filesChanged, linksWritten, stale } = await applyFileEdits(deps, edits);
  return { filesChanged, linksRewritten: linksWritten, stale };
}

/** A reference somewhere in the vault that resolves to one of the pages asked about. */
interface ResolvedReference {
  /** The file the reference is written in. */
  file: RetargetFile;
  ref: RetargetReference;
  /** The page it resolves to — one of the targets. */
  dest: RetargetFile;
  /** The link's destination without its `#subpath`. */
  linkpath: string;
  /** The `#subpath`, or the empty string. */
  subpath: string;
}

/**
 * Every reference in the vault that resolves to one of `targets`, target files
 * themselves excluded — their own links are about to disappear with them.
 *
 * This is the half both callers share, and the half that carries the module's
 * first property: resolve before replacing. A bare `[[Foo]]` is not evidence
 * that a particular page is meant, so every candidate goes through the app's
 * own resolver and only a link that actually lands on a target is handed back.
 */
function collectResolvingReferences(
  deps: RetargetDeps,
  targets: ReadonlySet<string>
): ResolvedReference[] {
  const found: ResolvedReference[] = [];
  if (targets.size === 0) return found;

  for (const file of deps.vault.getMarkdownFiles()) {
    if (targets.has(file.path)) continue;

    const cache = deps.metadataCache.getFileCache(file);
    const references = [...(cache?.links ?? []), ...(cache?.embeds ?? [])];
    if (references.length === 0) continue;

    for (const ref of references) {
      const hashIndex = ref.link.indexOf('#');
      const linkpath = hashIndex >= 0 ? ref.link.slice(0, hashIndex) : ref.link;
      const subpath = hashIndex >= 0 ? ref.link.slice(hashIndex) : '';
      // `[[#Heading]]` addresses the current file and has no linkpath.
      if (!linkpath) continue;

      const dest = deps.metadataCache.getFirstLinkpathDest(linkpath, file.path);
      if (!dest || !targets.has(dest.path)) continue;

      found.push({ file, ref, dest, linkpath, subpath });
    }
  }

  return found;
}

/** The edit that puts `replacement` where `ref` stands. */
function editFor(ref: RetargetReference, replacement: string): ReferenceEdit {
  return {
    start: ref.position.start.offset,
    end: ref.position.end.offset,
    original: ref.original,
    replacement,
  };
}

/** An edit together with the file it belongs to. */
export interface FileEdit {
  file: RetargetFile;
  edit: ReferenceEdit;
}

/**
 * Apply edits, one `vault.process` call per file so several edits in the same
 * note land in one pass and keep each other's offsets valid.
 */
async function applyFileEdits(
  deps: RetargetDeps,
  edits: readonly FileEdit[]
): Promise<{ filesChanged: number; linksWritten: number; stale: number }> {
  const byFile = new Map<string, { file: RetargetFile; edits: ReferenceEdit[] }>();
  for (const { file, edit } of edits) {
    const entry = byFile.get(file.path);
    if (entry) entry.edits.push(edit);
    else byFile.set(file.path, { file, edits: [edit] });
  }

  let filesChanged = 0;
  let linksWritten = 0;
  let stale = 0;
  for (const entry of byFile.values()) {
    const applied = await applyEdits(deps, entry.file, entry.edits);
    stale += applied.stale;
    if (applied.applied > 0) {
      filesChanged++;
      linksWritten += applied.applied;
    }
  }
  return { filesChanged, linksWritten, stale };
}

/** One in-place replacement of a reference, at the offsets the cache reported. */
interface ReferenceEdit {
  start: number;
  end: number;
  original: string;
  replacement: string;
}

/**
 * Apply the edits to one file through `vault.process`, descending so an
 * earlier edit's offsets stay valid. The cache can lag the file, and splicing
 * on a stale offset would corrupt the note — a position that no longer holds
 * what the cache promised is counted, never guessed at.
 */
async function applyEdits(
  deps: RetargetDeps,
  file: RetargetFile,
  edits: ReferenceEdit[]
): Promise<{ applied: number; stale: number }> {
  let applied = 0;
  let stale = 0;
  await deps.vault.process(file, data => {
    let next = data;
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      if (next.slice(edit.start, edit.end) !== edit.original) {
        stale++;
        continue;
      }
      next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end);
      applied++;
    }
    return next;
  });
  return { applied, stale };
}

export interface PlannedRestore {
  /** The page whose deletion makes this edit due. */
  targetPath: string;
  file: RetargetFile;
  edit: ReferenceEdit;
}

export interface RestorePlan {
  /** One entry per reference that can be handed its name back. */
  restores: PlannedRestore[];
  /**
   * References resolving to one of the targets that were left as written: one
   * without display text carries no name to restore, one with a `#subpath`
   * addressed a heading of the page that is going, and a display text carrying
   * link syntax of its own cannot become a target. All stay dead.
   */
  left: number;
}

export interface ApplyRestoreResult {
  /** Files whose content was rewritten. */
  filesChanged: number;
  /** References whose display text became the link target again. */
  linksRestored: number;
  /** As in `RetargetResult`: cached position no longer matched the file. */
  stale: number;
}

/**
 * Plan the counterpart to `retargetLinksToPage`, for deletions with no
 * successor page to point at: give every link that resolves to one of
 * `targetPaths` its display text back as the target, so
 * `[[entities/Vitamin-B12|Vitamin B12]]` becomes `[[Vitamin B12]]`.
 *
 * Fix Dead Links creates a placeholder page and repoints the referring link at
 * it, carrying the author's name over as display text. When Delete Empty Stubs
 * collects that placeholder again, this puts the link back the way it was
 * written instead of leaving a folder-typed path to a file that is gone.
 *
 * Planning and applying are separate because the two halves have opposite
 * timing constraints. Resolving needs the pages to still exist — after the
 * delete, `getFirstLinkpathDest` cannot confirm that a link ever pointed at
 * them. Writing must not happen until the delete has actually succeeded, or a
 * failed delete leaves the links pointing away from a page that is still
 * there. So: plan, delete, then apply what the delete made due.
 *
 * One pass over the vault for all targets, not one pass each: a note that
 * references two collected stubs is rewritten once, with both edits applied
 * together. Rewriting it twice would shift the offsets of the second set under
 * a metadata cache that has not re-indexed yet, and the stale guard would drop
 * exactly the links this exists to save.
 *
 * The restored link is the one its author wrote, so it resolves exactly as it
 * did before Fix Dead Links ran — to nothing, or to a page of that name that
 * has since appeared. That is the same outcome as never having run the action,
 * which is the point; this heals nothing on its own.
 */
export function planDisplayNameRestores(
  deps: RetargetDeps,
  targetPaths: ReadonlySet<string>
): RestorePlan {
  const plan: RestorePlan = { restores: [], left: 0 };

  for (const found of collectResolvingReferences(deps, targetPaths)) {
    const name = restorableName(found.ref, found.subpath !== '');
    if (!name) {
      plan.left++;
      continue;
    }

    const replacement = `${found.ref.original.startsWith('!') ? '!' : ''}[[${name}]]`;
    if (replacement === found.ref.original) continue;

    plan.restores.push({
      targetPath: found.dest.path,
      file: found.file,
      edit: editFor(found.ref, replacement),
    });
  }

  return plan;
}

/**
 * Apply the planned restores, one `vault.process` call per file so several
 * edits in the same note land in one pass and keep each other's offsets valid.
 */
export async function applyRestorePlan(
  deps: RetargetDeps,
  restores: readonly PlannedRestore[]
): Promise<ApplyRestoreResult> {
  const { filesChanged, linksWritten, stale } = await applyFileEdits(deps, restores);
  return { filesChanged, linksRestored: linksWritten, stale };
}

/**
 * The display text of `ref`, if it can stand as a link target on its own, else
 * null. A subpath disqualifies the reference outright — it addressed a heading
 * of the page being deleted. So does a display text carrying link syntax of its
 * own: `[[a|b|c]]` reads as target `b`, alias `c` once rewritten, which is a
 * different link than the one that was there.
 */
function restorableName(ref: RetargetReference, hasSubpath: boolean): string | null {
  if (hasSubpath) return null;
  const pipeIndex = ref.original.indexOf('|');
  if (pipeIndex < 0) return null;
  const name = ref.original.slice(pipeIndex + 1, ref.original.lastIndexOf(']]')).trim();
  if (!name || /[[\]|#]/.test(name)) return null;
  return name;
}
