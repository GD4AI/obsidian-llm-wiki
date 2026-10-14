/**
 * Term index cache — build once per index file, score many.
 *
 * `buildPageTerms` + `buildCorpusTerms` were running on every query. Measured
 * on 2,864 synthetic pages with bodies: 4.4 s per rebuild against 21 ms to
 * score from a prebuilt index, about 200x. Scoring was never slow. Rebuilding
 * the same table from the same pages, once per question, was.
 *
 * The key is a CONTENT SIGNATURE covering both the wiki index file and the
 * bodies. Not just the index file: the full index carries body terms, and the
 * bodies come from the graph cache rather than from `index.md`. A vault write
 * that changes a body without touching `index.md` happens on every prose edit —
 * `QueryView.invalidateGraph` runs on lint, not on every write, so it cannot be
 * the only guard. The signature is one FNV-1a pass over the strings, which is
 * millisecond-scale against the 181 ms rebuild it avoids.
 *
 * One entry per kind. A cache of one is enough: a query session reads the same
 * index repeatedly, and a new signature means the previous entry is worthless.
 * A map would grow without bound across a session that edits pages.
 */
import {
  buildPageTerms,
  buildCorpusTerms,
  type PageTerms,
  type CorpusTerms,
} from './term-index';
import type { PageRef } from './ppr-cascade';

/**
 * FNV-1a over a string. Fast, no dependency, and good enough for a cache key:
 * a collision means one stale rebuild served, not a wrong ranking computed
 * from the wrong table in a way a later signature cannot correct.
 */
export function contentSignature(indexContent: string, pageRefs: readonly PageRef[]): string {
  let h = 0x811c9dc5;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x7fffffff;
    h = Math.imul(h, 0x01000193);
  };
  mix(indexContent);
  for (const p of pageRefs) mix(p.text ?? '');
  return `${pageRefs.length}:${(h >>> 0).toString(36)}`;
}

/** A built index: per-page terms plus the corpus IDF table. */
export interface BuiltTermIndex {
  readonly pageTerms: readonly PageTerms[];
  readonly corpus: CorpusTerms;
}

/**
 * Holds one name-tier index and one full index, each keyed by the index file
 * content that produced it.
 *
 * The name tier is title + aliases only. Stage 1's seed ranking and the
 * coverage gate run on it — deliberately without summary or body, because a
 * seed must not be moved by prose. The full index adds summary and body and
 * serves the answer path's lexical channel. Building one when the caller wants
 * the other is waste, so the two are cached apart.
 */
export class TermIndexCache {
  private nameKey: string | null = null;
  private nameIndex: BuiltTermIndex | null = null;
  private fullKey: string | null = null;
  private fullIndex: BuiltTermIndex | null = null;

  /** Title + aliases only. Keyed on the name-tier inputs, which live in the
   *  index file alone — the body is not built into this table at all. */
  getNameTier(indexContent: string, pageRefs: readonly PageRef[]): BuiltTermIndex {
    const key = `n:${contentSignature(indexContent, [])}`;
    if (this.nameIndex !== null && this.nameKey === key) return this.nameIndex;
    const pageTerms = pageRefs.map(p => buildPageTerms({
      title: p.title,
      aliases: p.aliases,
      summary: '',
      text: '',
    }));
    const built = { pageTerms, corpus: buildCorpusTerms(pageTerms) };
    this.nameKey = key;
    this.nameIndex = built;
    return built;
  }

  /** Title + aliases + summary + body. Keyed on the bodies too — they are not
   *  in `index.md` and they change on every prose edit. */
  getFull(indexContent: string, pageRefs: readonly PageRef[]): BuiltTermIndex {
    const key = `f:${contentSignature(indexContent, pageRefs)}`;
    if (this.fullIndex !== null && this.fullKey === key) return this.fullIndex;
    const pageTerms = pageRefs.map(p => buildPageTerms({
      title: p.title,
      aliases: p.aliases,
      summary: p.summary ?? '',
      text: p.text ?? '',
    }));
    const built = { pageTerms, corpus: buildCorpusTerms(pageTerms) };
    this.fullKey = key;
    this.fullIndex = built;
    return built;
  }

  /** Drop both. A vault write changes terms a stale table would keep serving. */
  invalidate(): void {
    this.nameKey = null;
    this.nameIndex = null;
    this.fullKey = null;
    this.fullIndex = null;
  }
}
