// page-factory/stub-page.ts — S135: stubs born from gate dissent.
//
// The outcome table in core/candidate-gate.ts routes a candidate the two
// gates disagree on to a stub: a page built entirely from what the
// extraction already paid for (summary, one mention, the item's domain
// subset) — no LLM call. The format follows the Fix Dead Links stub
// (fix-dead-link.ts, #197/#485), with one difference in body (a dead-link
// stub has nothing to say — no extraction exists for it — a dissent stub
// carries the summary the extraction produced) and one shared addition:
// `stub: true` in the frontmatter.
//
// Why a dedicated marker and not `generation_complete: false`: that flag
// cannot carry "this is a stub". The engine's createOrUpdateFile stamps
// every wiki content page `generation_complete: true` right after the write
// (markPageComplete, #170) — the `false` a stub is born with is flipped
// before anyone reads it. And if it were NOT flipped, the startup QuickFixes
// Phase 3 would trash the page as an interrupted write. `stub: true` rides
// the #356 passthrough through every frontmatter merge and is stripped
// exactly once: when a source that treats the subject fills the page
// (merge-page.ts) — that is the stub's promotion.
//
// Identity is decided deterministically before birth (buildStubIdentityResolver):
// exactly one existing page carrying the name as title or curated alias means
// no stub — the edge lands on that page through normal link resolution. A
// name two pages claim gets no stub either (the #446 lesson: an alias claimed
// twice merges the next name into the wrong page); the outcome table prunes
// it. Only an unclaimed name is born as a stub. No LLM near any of this —
// a model call at stub birth would buy back the resolveEntityDedup cost the
// gate exists to save.

import type { EntityInfo, ConceptInfo } from '../../types';
import type { StubCandidate, StubIdentity } from '../../core/candidate-gate';
import { slugify } from '../../core/slug';
import { selectDomains } from '../../core/domain-axis';
import { localDateStamp } from '../../core/format';
import { serializeFrontmatter } from '../../core/frontmatter';

interface ExistingPageLike {
  path: string;
  title: string;
  aliases?: string[];
}

/**
 * Build a name → StubIdentity resolver over the existing wiki pages.
 * Keyed case-folded (`slugify(x, false)`) on both sides, per the contract at
 * slug.ts: comparison callers must not pass `preserveCase`. Titles outrank
 * aliases — a title is the page's own claim to a name, an alias is someone's
 * cross-reference to it — matching the related-link corrector's index
 * (related-link-corrector.ts). Only entities/ and concepts/ pages count:
 * sources/ is never a link target and a stub never answers to one.
 */
export function buildStubIdentityResolver(
  pages: ExistingPageLike[],
  wikiFolder: string,
): (name: string) => StubIdentity {
  const prefix = wikiFolder + '/';
  const pathByTitle = new Map<string, string>();
  const pathByAlias = new Map<string, string>();
  const ambiguousTitles = new Set<string>();
  const ambiguousAliases = new Set<string>();
  const register = (raw: string, relPath: string, into: Map<string, string>, clash: Set<string>) => {
    const s = slugify(raw, false);
    if (!s) return;
    const prev = into.get(s);
    if (prev && prev !== relPath) { clash.add(s); return; }
    into.set(s, relPath);
  };
  for (const page of pages) {
    if (!page.path.startsWith(prefix)) continue;
    const relPath = page.path.slice(prefix.length).replace(/\.md$/, '');
    if (!relPath.startsWith('entities/') && !relPath.startsWith('concepts/')) continue;
    register(page.title, relPath, pathByTitle, ambiguousTitles);
    for (const alias of page.aliases ?? []) {
      register(alias, relPath, pathByAlias, ambiguousAliases);
    }
  }
  return (name: string): StubIdentity => {
    const s = slugify(name, false);
    if (!s) return 'none';
    if (ambiguousTitles.has(s)) return 'ambiguous';
    if (pathByTitle.has(s)) return 'match';
    if (ambiguousAliases.has(s)) return 'ambiguous';
    if (pathByAlias.has(s)) return 'match';
    return 'none';
  };
}

/** Frontmatter key that marks a stub page. String-compared ('true') because
 *  parseFrontmatter does no boolean coercion; boolean accepted defensively. */
export function isStubPage(fm: Record<string, unknown> | null | undefined): boolean {
  return fm?.stub === 'true' || fm?.stub === true;
}

/**
 * Promotion: remove the `stub:` marker line from a rendered frontmatter
 * block (or full page content — the regex is line-anchored and the key is
 * frontmatter-only by construction). Called by merge-page.ts when a source
 * that treats the subject fills the page.
 */
export function stripStubMarker(frontmatterBlock: string): string {
  return frontmatterBlock.replace(/^stub:\s*(?:true|false)\s*\n?/m, '');
}

/**
 * The frontmatter both stub templates share (this module and
 * fix-dead-link.ts). It goes through `serializeFrontmatter`, so a stub is born
 * with the list shape every other writer emits (#808) — both templates used to
 * write `tags: [x]` by hand. The serializer has no stub fields, and its
 * passthrough slot sits above `sources:`; the two markers are appended instead,
 * which keeps the key order stubs have always had.
 */
export function buildStubFrontmatter(params: {
  stubType: 'entity' | 'concept';
  /** Wikilink target of the page or source the stub is born from. */
  source: string;
  tags: string[];
}): string {
  const { stubType, source, tags } = params;
  return serializeFrontmatter(
    { type: stubType, created: localDateStamp(), sources: [`[[${source}]]`], tags },
    { emitEmptyTags: true }
  ).replace(/\n---$/, '\nstub: true\ngeneration_complete: false\n---');
}

/**
 * The stub page content. Frontmatter matches the Fix Dead Links stub
 * (block-style quoted `sources:` wikilink — see the YAML notes in
 * fix-dead-link.ts — and the #170 birth stamp), plus `stub: true` (see the
 * module header) and what the extraction already knows: the item's type tag
 * and its validated domain subset. The body is the paid-for extraction
 * summary and one verbatim mention; the provenance line names the gate so a
 * reader (and a later session) can tell a dissent stub from a dead-link
 * stub.
 */
export function buildDissentStubContent(params: {
  item: EntityInfo | ConceptInfo;
  stubType: 'entity' | 'concept';
  sourceSlug: string;
  cell: string;
  /** Harvested tag vocabulary. When present, the identity value faces it like
   *  every other writer's tags do (S139); when absent, legacy behavior. */
  vocabulary?: readonly string[];
}): string {
  const { item, stubType, sourceSlug, cell, vocabulary } = params;
  // Tag-Achse Stufe 4 (S137): one field — the identity value (the extraction
  // type) and the validated belonging values share `tags:`; no `domains:`.
  // S142: the identity fallback leaked the settings typelist (`person`,
  // `theory`) into `tags:` — the same drift the S139 strips closed at
  // create/merge/fill. With a vocabulary the identity faces the harvest:
  // a value it does not carry is dropped, and an empty result stays empty —
  // a visible gap beats a wrong value (the fill path rewrites tags anyway).
  const identity = vocabulary
    ? (item.type ? selectDomains([item.type], vocabulary).kept[0] ?? '' : '')
    : item.type || (stubType === 'entity' ? 'other' : 'term');
  const tagValues = [...(identity ? [identity] : []), ...(item.domains ?? []).filter(d => d !== identity)];
  const frontmatter = buildStubFrontmatter({ stubType, source: `sources/${sourceSlug}`, tags: tagValues });
  const quote = item.mentions_with_provenance?.[0]?.quote ?? item.mentions_in_source?.[0];
  const summary = (item.summary ?? '').trim();
  const quoteBlock = quote ? `\n> "${quote.trim()}" — [[sources/${sourceSlug}]]\n` : '';
  return `${frontmatter}\n# ${item.name}\n\n> Stub created by the ingest candidate gate (${cell}) — [[sources/${sourceSlug}]] names this without treating it. Will be filled by the next ingest of a source that does.\n${summary ? `\n${summary}\n` : ''}${quoteBlock}`;
}

export interface StubBirthDeps {
  wikiFolder: string;
  preserveCase: boolean;
  normalizePath: (p: string) => string;
  fileExists: (path: string) => boolean;
  createOrUpdateFile: (path: string, content: string) => Promise<void>;
  /** Harvested tag vocabulary for the stub's identity tag (see buildDissentStubContent). */
  vocabulary?: readonly string[];
}

export interface StubBirthResult {
  created: string[];
  /** Planned stubs whose file already existed (or collided in-run by slug): skipped, never overwritten. */
  skipped: string[];
}

/** The vault path a stub for this candidate would occupy. */
export function stubPath(deps: Pick<StubBirthDeps, 'wikiFolder' | 'preserveCase' | 'normalizePath'>, stub: StubCandidate): string {
  const folder = stub.kind === 'entity' ? 'entities' : 'concepts';
  return deps.normalizePath(`${deps.wikiFolder}/${folder}/${slugify(stub.item.name, deps.preserveCase)}.md`);
}

/**
 * Write the stub pages. A path that already exists is skipped — identity was
 * resolved against titles and aliases, so an existing file here means a slug
 * collision (two names folding to one slug), and overwriting a page the
 * resolver did not claim would be a silent merge into the wrong page. Two
 * stubs folding to the same slug in one run: first one wins, same rule.
 */
export async function createDissentStubs(
  deps: StubBirthDeps,
  stubs: StubCandidate[],
  sourceSlug: string,
): Promise<StubBirthResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  const claimed = new Set<string>();
  for (const stub of stubs) {
    const path = stubPath(deps, stub);
    if (claimed.has(path) || deps.fileExists(path)) {
      skipped.push(path);
      continue;
    }
    claimed.add(path);
    await deps.createOrUpdateFile(path, buildDissentStubContent({
      item: stub.item,
      stubType: stub.kind,
      sourceSlug,
      cell: stub.cell,
      vocabulary: deps.vocabulary,
    }));
    created.push(path);
  }
  return { created, skipped };
}
