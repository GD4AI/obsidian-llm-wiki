// The Related sections are written from the shaped lists, not transcribed
// by the model.
//
// After shaping (core/related-shaping.ts) the analysis's related_entities /
// related_concepts are exact: vault pages under their title, siblings,
// unanswered names as written. The model was still asked to render them into
// the two sections and misspelt what it had been handed (`H₂O₂` re-encoded,
// `Vitamine/Vitamin C` as an invented path, underscores, a parenthetical
// appended) — every one a dead link the list had answered. So the list
// writes the section: deterministic link per name (vault path when the vault
// has the page, planned path otherwise), display text the name itself. On a
// rewrite the entries the page already had are kept in front — re-resolved
// against the vault, so a link that has since moved folders follows the page
// — and one target is listed once across both sections. The two sections
// belong to the list; everything else on the page is left byte-identical.

import { slugify } from './slug';
import { snapHeaderToCanonical } from './section-header-canonicalizer';
import { nameKey } from './related-shaping';

export interface RelatedRenderOpts {
  /** `slugCase: 'preserve'` — the planned path of a page not yet in the vault. */
  preserveCase: boolean;
  /** Vault path (`entities/X`) for a name the vault answers, else undefined. */
  resolve: (name: string) => string | undefined;
  /** Body before the rewrite: its list entries are kept in front of the new ones. */
  keepFrom?: string;
  /** Which Related section the page's schema puts first — decides where a missing one is inserted. */
  firstSection?: Folder;
}

export type Folder = 'entities' | 'concepts';

const HEADING_RE = /^## (.+?)\s*$/;
const LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/;

/**
 * The section under one of `labels`, tolerant of the spelling drift the
 * header canonicalizer tolerates. `universe` holds every label the page may
 * carry for either Related section, so a garbled header snaps to the nearer
 * of the two rather than to whichever section is asked for first.
 */
function findSection(lines: string[], labels: string[], universe: string[]): { start: number; end: number } | undefined {
  const wanted = new Set(labels.map(l => l.trim()));
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING_RE.exec(lines[i]);
    if (!m) continue;
    const snapped = snapHeaderToCanonical(m[1].trim(), universe);
    if (snapped === null || !wanted.has(snapped)) continue;
    let end = i + 1;
    while (end < lines.length && !HEADING_RE.test(lines[end])) end++;
    return { start: i, end };
  }
  return undefined;
}

interface Entry { rel: string; name: string }

/** The list links of one Related section, re-resolved: the page's current path when the vault knows the name. */
function keptEntries(lines: string[], labels: string[], universe: string[], resolve: RelatedRenderOpts['resolve']): Entry[] {
  const sec = findSection(lines, labels, universe);
  if (!sec) return [];
  const out: Entry[] = [];
  for (const line of lines.slice(sec.start + 1, sec.end)) {
    if (!/^\s*[-*]\s+\[\[/.test(line)) continue;
    const m = LINK_RE.exec(line);
    if (!m) continue;
    const target = m[1].trim();
    const name = (m[2] ?? target.slice(target.lastIndexOf('/') + 1)).trim();
    out.push({ rel: resolve(name) ?? target, name });
  }
  return out;
}

function folderOf(rel: string, fallback: Folder): Folder {
  return rel.startsWith('concepts/') ? 'concepts' : rel.startsWith('entities/') ? 'entities' : fallback;
}

/**
 * Replace (or insert) the two Related sections with lists rendered from the
 * typed related names. Everything outside the two sections is left byte-identical.
 */
export function renderRelatedSections(
  content: string,
  relatedEntities: string[] | undefined,
  relatedConcepts: string[] | undefined,
  relatedEntitiesLabel: string,
  relatedConceptsLabel: string,
  opts: RelatedRenderOpts,
): string {
  const labelsOf: Record<Folder, string[]> = {
    entities: [relatedEntitiesLabel, 'Related Entities'],
    concepts: [relatedConceptsLabel, 'Related Concepts'],
  };
  const headingOf: Record<Folder, string> = { entities: relatedEntitiesLabel.trim(), concepts: relatedConceptsLabel.trim() };
  const universe = [...labelsOf.entities, ...labelsOf.concepts];

  // Kept entries first, in the section their page lives in today; then the
  // list. One target once, whichever section names it first.
  const lists: Record<Folder, string[]> = { entities: [], concepts: [] };
  const seen = new Set<string>();
  const add = (rel: string, name: string, into: Folder) => {
    const k = nameKey(rel.slice(rel.lastIndexOf('/') + 1));
    if (!k || seen.has(k)) return;
    seen.add(k);
    lists[into].push(`- [[${rel}|${name}]]`);
  };
  const keptLines = opts.keepFrom ? opts.keepFrom.split('\n') : [];
  for (const folder of ['entities', 'concepts'] as const) {
    for (const e of keptEntries(keptLines, labelsOf[folder], universe, opts.resolve)) add(e.rel, e.name, folderOf(e.rel, folder));
  }
  for (const [names, folder] of [[relatedEntities, 'entities'], [relatedConcepts, 'concepts']] as const) {
    for (const raw of names ?? []) {
      const name = raw.trim();
      if (!name) continue;
      const rel = opts.resolve(name) ?? `${folder}/${slugify(name, opts.preserveCase)}`;
      add(rel, name, folderOf(rel, folder));
    }
  }

  // Sections in the order the page's schema lists them: a missing second
  // section goes right after the first, a missing first one at the end.
  const first: Folder = opts.firstSection ?? 'entities';
  const second: Folder = first === 'entities' ? 'concepts' : 'entities';
  let lines = content.split('\n');
  const put = (folder: Folder, after?: Folder) => {
    const block = [`## ${headingOf[folder]}`, '', ...lists[folder], ''];
    const sec = findSection(lines, labelsOf[folder], universe);
    if (sec) {
      lines = [...lines.slice(0, sec.start), ...block, ...lines.slice(sec.end)];
      return;
    }
    const anchor = after ? findSection(lines, labelsOf[after], universe) : undefined;
    const at = anchor ? anchor.end : lines.length;
    const tail = lines.slice(at);
    const head = lines.slice(0, at);
    while (head.length && head[head.length - 1].trim() === '') head.pop();
    lines = [...head, '', ...block, ...tail];
  };
  put(first);
  put(second, first);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}
