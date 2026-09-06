// Related lists: siblings link each other, and a related name the vault
// already answers is written under that page's own title and folder.
//
// The extraction may name anything from the note in `related_entities` /
// `related_concepts`; nothing downstream checks whether a page exists or
// will. Measured on a rebuild of a 413-note vault after 136 notes: 676 dead
// related entries on 870 pages, 93 % of them naming neither a page nor a
// note. In the same vault 101 of 103 pages without a single live outgoing
// link had at least one sibling page born from the same note — an edge the
// engine knew and never wrote. A further 265 dead links were spelling
// variants of pages the vault had (`Interleukin 6` for `Interleukin-6`).
//
// Both are deterministic shaping of the analysis after the candidate gate,
// before any page is planned: no model call, no new setting. A name nothing
// answers is left exactly as it is today — it is counted in the log so the
// gap stays visible, but not removed.

import { slugKeys } from './slug';
import type { EntityInfo, ConceptInfo, SourceAnalysis } from '../types';

export type RelatedKind = 'entity' | 'concept';

export interface RelatedShapingDeps {
  /** A page the vault holds under this name (title or alias): its title and folder kind. */
  resolve: (name: string) => { title: string; kind: RelatedKind } | undefined;
  /** Names that will have a page without being survivors: notes in the watched folders, stubs this run plans. */
  willExist: readonly string[];
  /** The active tag vocabulary (`Group/Value` or bare values): a tag is not a page. */
  vocabulary?: readonly string[];
}

export interface RelatedShapingResult {
  entities: EntityInfo[];
  concepts: ConceptInfo[];
  /** Related names nothing answers yet — kept as written, counted. */
  unanswered: Array<{ on: string; name: string }>;
  /** Sibling edges added (one per list entry). */
  siblings: number;
  /** Related names that were tag values, not pages — removed. */
  tags: Array<{ on: string; name: string }>;
}

/** The comparison key two names meet under — `slugKeys`' contract (NFC, never `preserveCase`). */
export function nameKey(name: string): string {
  for (const k of slugKeys(name)) return k;
  return '';
}

/** The folder kind a vault-relative page path denotes. */
export function kindOf(rel: string): RelatedKind {
  return rel.startsWith('concepts/') ? 'concept' : 'entity';
}

/** `Thema/Therapie`, `Th.Therapie`, `Thema: Therapie` → `Therapie`; a bare name stays. */
function tagLeaf(name: string): { leaf: string; prefixed: boolean } {
  const m = /^\s*([\p{L}]+)\s*[/.:]\s*(.+)$/u.exec(name);
  return m ? { leaf: m[2].trim(), prefixed: true } : { leaf: name.trim(), prefixed: false };
}

/** `Interleukin-6 (IL-6)` → also try `Interleukin-6` and `IL-6`. */
function nameVariants(name: string): string[] {
  const m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(name);
  return m ? [name, m[1].trim(), m[2].trim()].filter(Boolean) : [name];
}

export function shapeRelatedLists(
  analysis: Pick<SourceAnalysis, 'entities' | 'concepts'>,
  deps: RelatedShapingDeps,
): RelatedShapingResult {
  const survivors = new Map<string, { name: string; kind: RelatedKind }>();
  for (const e of analysis.entities) survivors.set(nameKey(e.name), { name: e.name, kind: 'entity' });
  for (const c of analysis.concepts) survivors.set(nameKey(c.name), { name: c.name, kind: 'concept' });
  const willExist = new Set(deps.willExist.map(nameKey));
  const tagLeaves = new Set((deps.vocabulary ?? []).map(v => nameKey(tagLeaf(v).leaf)).filter(Boolean));
  const unanswered: RelatedShapingResult['unanswered'] = [];
  const tags: RelatedShapingResult['tags'] = [];
  let siblings = 0;

  const shape = (self: string, ents: string[] | undefined, cons: string[] | undefined) => {
    const outE: string[] = []; const outC: string[] = []; const seen = new Set<string>([nameKey(self)]);
    const put = (name: string, kind: RelatedKind | undefined, into: RelatedKind) => {
      const k = nameKey(name);
      if (!k || seen.has(k)) return;
      seen.add(k);
      ((kind ?? into) === 'concept' ? outC : outE).push(name);
    };
    for (const [list, into] of [[ents, 'entity'], [cons, 'concept']] as const) {
      for (const raw of list ?? []) {
        const name = raw.trim();
        if (!name) continue;
        // A tag value is not a page: `Thema/Therapie`, `Th.Therapie` (the
        // model abbreviates the group) or the bare generic `Therapie` when
        // nothing but the vocabulary knows the word.
        const { leaf, prefixed } = tagLeaf(name);
        const k = nameKey(name);
        if (prefixed && tagLeaves.has(nameKey(leaf))) { tags.push({ on: self, name }); continue; }
        let placed = false;
        for (const v of nameVariants(name)) {
          const vk = nameKey(v);
          const s = survivors.get(vk);
          if (s) { put(s.name, s.kind, into); placed = true; break; }
          const r = deps.resolve(v);
          if (r) { put(r.title, r.kind, into); placed = true; break; }
        }
        if (placed) continue;
        if (willExist.has(k)) { put(name, undefined, into); continue; }
        if (!prefixed && tagLeaves.has(k)) { tags.push({ on: self, name }); continue; }
        if (!seen.has(k)) unanswered.push({ on: self, name });
        put(name, undefined, into);
      }
    }
    for (const s of survivors.values()) {
      if (seen.has(nameKey(s.name))) continue;
      put(s.name, s.kind, s.kind); siblings++;
    }
    return { outE, outC };
  };

  const entities = analysis.entities.map(e => {
    const { outE, outC } = shape(e.name, e.related_entities, e.related_concepts);
    const next: EntityInfo = { ...e };
    if (outE.length || e.related_entities) next.related_entities = outE;
    if (outC.length || e.related_concepts) next.related_concepts = outC;
    return next;
  });
  const concepts = analysis.concepts.map(c => {
    const { outE, outC } = shape(c.name, c.related_entities, c.related_concepts);
    const next: ConceptInfo = { ...c, related_concepts: outC };
    if (outE.length || c.related_entities) next.related_entities = outE;
    return next;
  });
  return { entities, concepts, unanswered, siblings, tags };
}
