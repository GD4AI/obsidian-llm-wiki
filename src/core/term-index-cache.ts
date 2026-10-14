/**
 * Term index cache — build once per index file, score many.
 *
 * `buildPageTerms` + `buildCorpusTerms` were running on every query. Measured
 * on 2,864 synthetic pages with bodies: 4.4 s per rebuild against 21 ms to
 * score from a prebuilt index, about 200x. Scoring was never slow. Rebuilding
 * the same table from the same pages, once per question, was.
 *
 * The key is the wiki INDEX FILE content, not the path set and not the ref
 * array. `QueryView` reads `index.md` on every query and builds `PageRef[]`
 * from it; when the file has not changed the refs are equivalent but never
 * identical, so pointer identity misses every time. The index content is what
 * determines the terms — title, aliases and summary all come from it — so it is
 * the right key. The body is added separately and changes under the same vault
 * writes.
 *
 * One entry per kind. A cache of one is enough: a query session reads the same
 * index repeatedly, and a new index means the previous entry is worthless. A
 * map would grow without bound across a session that edits pages.
 */
import {
  buildPageTerms,
  buildCorpusTerms,
  type PageTerms,
  type CorpusTerms,
} from './term-index';
import type { PageRef } from './ppr-cascade';

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

  /** Title + aliases only. */
  getNameTier(indexContent: string, pageRefs: readonly PageRef[]): BuiltTermIndex {
    if (this.nameIndex !== null && this.nameKey === indexContent) return this.nameIndex;
    const pageTerms = pageRefs.map(p => buildPageTerms({
      title: p.title,
      aliases: p.aliases,
      summary: '',
      text: '',
    }));
    const built = { pageTerms, corpus: buildCorpusTerms(pageTerms) };
    this.nameKey = indexContent;
    this.nameIndex = built;
    return built;
  }

  /** Title + aliases + summary + body. */
  getFull(indexContent: string, pageRefs: readonly PageRef[]): BuiltTermIndex {
    if (this.fullIndex !== null && this.fullKey === indexContent) return this.fullIndex;
    const pageTerms = pageRefs.map(p => buildPageTerms({
      title: p.title,
      aliases: p.aliases,
      summary: p.summary ?? '',
      text: p.text ?? '',
    }));
    const built = { pageTerms, corpus: buildCorpusTerms(pageTerms) };
    this.fullKey = indexContent;
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
