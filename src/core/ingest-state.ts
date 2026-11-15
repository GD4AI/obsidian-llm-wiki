// ingest-state.ts — the on-disk answer the file picker shows (#598).
//
// The picker used to describe every row from `ingestQueue.getSnapshot()`,
// which is session state: empty again after a plugin reload. So on a fresh
// Obsidian start every note read as never ingested, even when its summary
// page had been on disk for weeks. This module holds the two decisions the
// picker needs to say otherwise, and nothing else.
//
// PURE: no Obsidian APIs, no DOM, no IO. The caller reads the files and
// passes their contents in — which also lets it skip reading the note when
// the page is absent.

import { parseFrontmatter, extractBody, originNoteRefs } from './frontmatter';
import { hashBody } from './source-requirements';

/**
 * What a candidate note's `sources/` page says about it.
 *
 *   none      no page under this note's slug, or one that belongs to a
 *             different note
 *   ingested  a page exists and was built from this note
 *   drifted   as above, and the note has been edited since
 */
export type IngestDiskState = 'none' | 'ingested' | 'drifted';

/**
 * Whether the `sources/` page found by slug was built from THIS note.
 *
 * Same decision as `isAlreadyIngested` (main-commands/ingest-commands.ts),
 * and deliberately the same code: the two answer one question, and a second
 * implementation of it is how #595 happened in the first place. The ownership
 * data lives in `source_file:` (scalar, canonical) with `sources:` as the
 * fallback — `originNoteRefs` is the resolver.
 *
 * A page with no recorded origin falls back to existence. That is the
 * pre-#164 behaviour and it is deliberate: absence of evidence is not proof
 * of a different owner. It is also the reason this reads note → slug → page
 * rather than indexing the `sources/` folder and inverting it — an inverted
 * index cannot attribute an origin-less page to any note at all, and would
 * silently disagree with the skip check on exactly those pages.
 */
export function pageBelongsToNote(pageContent: string, notePath: string): boolean {
  const fm = parseFrontmatter(pageContent);
  if (!fm) return true;
  const origins = originNoteRefs(fm);
  if (origins.length === 0) return true;
  return origins.includes(notePath);
}

/**
 * Whether the note has been edited since the page was built from it.
 *
 * The comparison is the one `scanSourceDrift` (#577) makes: the page stores a
 * `contentHash` of the note body it was written from (#164), so recomputing
 * that fingerprint answers the question without an LLM call.
 *
 * Undecidable in two cases, both answered `false` rather than guessed:
 *
 *   - No stored hash (pre-#164 pages). Absence of evidence is not drift.
 *   - More than one recorded origin. A page carries ONE hash, belonging to
 *     whichever note wrote it last, so a mismatch on a multi-source page
 *     cannot be told apart from "a different origin wrote it last". Claiming
 *     drift there would mark most origins of every merged page — a marker
 *     that fires on pages nobody touched is worse than no marker.
 *
 * The narrower per-note question is why this is not `scanSourceDrift` itself:
 * that scanner asks whether a PAGE is stale (flagging only when no listed
 * note matches), which is decidable where this is not.
 */
/**
 * The note body with every wikilink reduced to what the reader sees.
 *
 * A link target is a path, and a path changes when a page moves (#677): the move goes
 * through `fileManager.renameFile` so inbound links keep working, and Obsidian writes
 * out the new path. `[[Langzeitgedächtnis]]` becomes `[[Notizen/Langzeitgedächtnis]]` —
 * the same link, eight characters longer. Hashing that literal body makes the plugin
 * report "note changed since ingest" for notes nobody touched.
 *
 * Reducing each link to its display text — or to the target's last segment when it has
 * none — gives a fingerprint that survives a path rewrite and still moves when the
 * words around the link change. A link-blind hash would go further and hide a link edit
 * the user made on purpose, which is why this keeps the heading and the display text.
 */
export function linkReducedBody(body: string): string {
  return body.replace(/!?\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    const [targetPart, display] = splitLink(inner);
    if (display !== undefined) return display;
    const hashAt = targetPart.indexOf('#');
    const path = hashAt === -1 ? targetPart : targetPart.slice(0, hashAt);
    const heading = hashAt === -1 ? '' : targetPart.slice(hashAt);
    const name = path.slice(path.lastIndexOf('/') + 1);
    return `${name}${heading}`;
  });
}

function splitLink(inner: string): [string, string | undefined] {
  const bar = inner.indexOf('|');
  if (bar === -1) return [inner.trim(), undefined];
  return [inner.slice(0, bar).trim(), inner.slice(bar + 1).trim()];
}

/** What a source page's two fingerprints say about its origin note. */
export type NoteDriftState = 'unchanged' | 'links-only' | 'edited' | 'unknown';

/**
 * Three states, not one boolean (#677).
 *
 * `links-only` is the case the issue measured: the body hash moved, the link-reduced
 * hash did not, so only link paths changed. It gets its own label rather than
 * "note changed since ingest", and it is not treated as an edit anywhere.
 *
 * A page written before this change carries no `linkHash`, and a path rewrite stays
 * indistinguishable from an edit there. That is deliberate: guessing from a missing
 * field would hide real edits on every legacy page, and legacy pages age out as their
 * notes are re-ingested.
 */
export function noteDriftState(pageContent: string, noteContent: string): NoteDriftState {
  const fm = parseFrontmatter(pageContent);
  if (!fm) return 'unknown';
  if (originNoteRefs(fm).length > 1) return 'unknown';
  const stored = fm.contentHash;
  if (typeof stored !== 'string' || !stored) return 'unknown';
  const body = extractBody(noteContent);
  if (hashBody(body) === stored) return 'unchanged';
  const storedLink = fm.linkHash;
  if (typeof storedLink === 'string' && storedLink && hashBody(linkReducedBody(body)) === storedLink) {
    return 'links-only';
  }
  return 'edited';
}

export function noteHasDrifted(pageContent: string, noteContent: string): boolean {
  // A rewritten link path is not an edit (#677), so only `edited` answers true here.
  return noteDriftState(pageContent, noteContent) === 'edited';
}
