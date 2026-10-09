import { computeSlug } from './slug';

interface PageRef {
  path: string;
  title: string;
  aliases: string[];
  summary?: string;
  /** Source slug from the index line's `source:` marker. Absent when unknown. */
  sourceSlug?: string;
  score: number;
}

export function parseIndexForPages(indexContent: string): Omit<PageRef, 'score'>[] {
  const pages: Omit<PageRef, 'score'>[] = [];
  // Per-line match (one match per line — avoids regex greedy-cross-newline).
  // Captures: 1: path, 2: optional aliases, 3: optional source slug, 4: optional summary (after " - ").
  // `source:` is the #819 review wiring: without it PageRef.sourceSlug is never
  // set and the assembly layer's source coverage cannot act in production.
  // Older indexes carry no marker, parse fine, and leave the slug undefined.
  const lineRegex = /^- \[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*(?:`aliases:\s*([^`]+)`)?\s*(?:`source:\s*([^`]+)`)?(?:\s*-\s*(.+))?$/;
  for (const line of indexContent.split('\n')) {
    const match = lineRegex.exec(line);
    if (!match) continue;
    const path = match[1];
    const aliasStr = match[2] || '';
    const sourceSlug = (match[3] || '').trim();
    const summary = (match[4] || '').trim();
    const title = path.split('/').pop() || path;
    const aliases = aliasStr.split(',').map(a => a.trim()).filter(Boolean);
    pages.push({ path, title, aliases, summary, ...(sourceSlug ? { sourceSlug } : {}) });
  }
  return pages;
}

export function localKeywordMatch(query: string, pages: Omit<PageRef, 'score'>[]): PageRef[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
  const scored: PageRef[] = [];
  for (const page of pages) {
    let score = 0;
    const titleLower = page.title.toLowerCase();
    for (const kw of keywords) {
      if (titleLower.includes(kw)) score += 3;
      for (const alias of page.aliases) {
        if (alias.toLowerCase().includes(kw)) score += 2;
      }
    }
    if (score > 0) scored.push({ ...page, score });
  }
  return scored.sort((a, b) => b.score - a.score);
}

export function matchExtractedToExisting(
  extractedNames: string[],
  existingPages: Array<{ title: string; aliases?: string[] }>
): string[] {
  const pageSlugs = existingPages.map(p => ({
    title: p.title,
    slug: computeSlug(p.title),
    aliasSlugs: (p.aliases || []).map(a => computeSlug(a)),
  }));

  const matched = new Set<string>();
  for (const name of extractedNames) {
    const targetSlug = computeSlug(name);
    const match = pageSlugs.find(p =>
      p.slug === targetSlug ||
      p.aliasSlugs.some(a => a === targetSlug)
    );
    if (match) matched.add(match.title);
  }
  return [...matched];
}
