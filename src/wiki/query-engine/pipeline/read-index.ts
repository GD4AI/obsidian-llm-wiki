// PR #3 split: Phase 1 of buildWikiContext — read and parse the wiki index.
// Extracted from query-engine.ts (1093-1117).
//
// Pure: reads the index file via the supplied `tryReadFile` and parses
// it into PageRef[] via `parseIndexForPages`. No state mutation.

import { parseIndexForPages } from '../../../core/index-search';
import type { PageRef } from '../../../core/ppr-cascade';

export interface WikiIndexResult {
  /** Empty when the index doesn't exist (empty wiki). */
  indexContent: string;
  pageRefs: PageRef[];
  /** Full set of paths for graph validation. */
  allPaths: Set<string>;
}

/**
 * Minimal interface — only `tryReadFile` needed. Matches both WikiEngine
 * and any test stub.
 */
export interface IndexReader {
  tryReadFile(path: string): Promise<string | null>;
}

/**
 * Read the wiki index file and parse it into PageRef[]. Returns
 * empty `indexContent` (but populated `pageRefs=[]`) when the file is
 * missing — caller distinguishes "empty wiki" from "wiki exists".
 */
export async function readWikiIndex(
  wikiFolder: string,
  reader: IndexReader,
): Promise<WikiIndexResult> {
  const indexPath = `${wikiFolder}/index.md`;
  const indexContent = await reader.tryReadFile(indexPath);
  if (!indexContent) {
    return { indexContent: '', pageRefs: [], allPaths: new Set() };
  }
  const allPages = parseIndexForPages(indexContent);
  const pageRefs: PageRef[] = allPages.map(p => ({
    path: p.path,
    title: p.title,
    aliases: p.aliases,
    summary: p.summary,
    ...(p.sourceSlug !== undefined ? { sourceSlug: p.sourceSlug } : {}),
  }));
  const allPaths = new Set(allPages.map(p => p.path));
  return { indexContent, pageRefs, allPaths };
}
