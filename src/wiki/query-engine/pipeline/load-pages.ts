// PR #3 split: Phase 3 of buildWikiContext — load and summarize retrieved pages.
// Extracted from query-engine.ts (1175-1323).
//
// Pure: takes a list of paths + plugin + section labels, returns the
// raw markdown bodies (with Tier B summaries where applicable). No
// mutation of `this._graph` / `_lastRetrieval` (QueryView's job).

import { MAX_PAGE_CONTENT_CHARS, MATCHED_PARAGRAPHS_TOTAL_CHARS } from '../../../constants';
import { extractSummaryFromPage, extractMatchedParagraphs } from '../../../core/section-extractor';

export interface LoadedPagePayload {
  /** Display path used in the context body (e.g. "wiki/entities/foo"). */
  displayTitle: string;
  body: string;
  path: string;
}

/**
 * Minimal interface — only `tryReadFile`. Matches WikiEngine.
 */
export interface PageReader {
  tryReadFile(path: string): Promise<string | null>;
}

export interface SectionLabelsLike {
  description?: string;
  definition?: string;
}

/**
 * For each path, strip the wiki folder prefix (if any), read the file,
 * and optionally extract a Tier B summary for entity/concept pages.
 * Pages with type other than entities/concepts fall through to raw
 * content (possibly truncated to MAX_PAGE_CONTENT_CHARS).
 */
export async function loadRelevantPagesForQuery(
  pageTitles: string[],
  wikiFolder: string,
  reader: PageReader,
  sectionLabels: SectionLabelsLike | null,
  queryTerms?: readonly string[],
): Promise<string[]> {
  const loaded = await loadRelevantPagesForQueryWithPaths(
    pageTitles, wikiFolder, reader, sectionLabels, queryTerms,
  );
  return loaded.map((page) => page.body);
}

/** A loaded page and the path it came from. */
export interface LoadedPageForQuery {
  /** The path as it went into the wiki context, without the wiki folder. */
  path: string;
  /** The rendered `## Title` block that is concatenated into the context. */
  body: string;
}

/**
 * The same load, keeping the path of each page.
 *
 * Issue #880 review (DocTpoint, 2026-10-27): the retrieval label is built from
 * the pages retrieval SELECTED, but the token budget drops some of them, so the
 * label named pages the model never received. Recovering the paths from the
 * bodies is not possible — a body is anonymous markdown — and the loader skips
 * unreadable pages, so the index in `bodies` is not the index in
 * `pageTitles` either. The pairing has to be produced where the path is known,
 * which is here.
 */
export async function loadRelevantPagesForQueryWithPaths(
  pageTitles: string[],
  wikiFolder: string,
  reader: PageReader,
  sectionLabels: SectionLabelsLike | null,
  /** The query's terms. When given, the paragraphs that matched ride along
   *  with the summary so the model can see why the page was retrieved. The
   *  retrieval scores the full body and the display shows one section; the
   *  two units must agree or the model is reading the right page for a
   *  reason it cannot see. */
  queryTerms?: readonly string[],
): Promise<LoadedPageForQuery[]> {
  const pages: LoadedPageForQuery[] = [];
  const wikiPrefix = wikiFolder + '/';

  // The matched-paragraph budget is shared across the whole retrieval. One page
  // carrying `MAX_PAGE_CONTENT_CHARS / 3` of added prose times RETRIEVAL_BUDGET
  // pages is more context than `TOKENS_QUERY_ANSWER` allows, so the addition
  // gets its own total and every page takes a share of it.
  const matchedPerPage = Math.floor(
    MATCHED_PARAGRAPHS_TOTAL_CHARS / Math.max(1, pageTitles.length),
  );

  for (const title of pageTitles) {
    // Strip wiki folder prefix if path has it (e.g. "wiki/entities/xxx" → "entities/xxx").
    // v1.24.1 PATCH Phase 5.5.0: do NOT normalize the .md suffix blindly.
    // Upstream sources are inconsistent:
    //  - get-existing-pages.ts stores `f.path` which is the full vault
    //    path with extension (e.g. "wiki/entities/Foo.md").
    //  - Some other callers pass clean relative paths (e.g. "entities/Foo")
    //    without an extension.
    // Older code unconditionally appended `.md`, producing "Foo.md.md"
    // for the first case → tryReadFile could not resolve double-suffix
    // paths → caller saw an empty wiki context instead of the real pages.
    // Defense: strip the wiki prefix, then append `.md` only if the
    // resulting title does NOT already end in `.md`.
    const normalizedTitle = title.startsWith(wikiPrefix)
      ? title.slice(wikiPrefix.length)
      : title;
    const withExtension = normalizedTitle.endsWith('.md')
      ? normalizedTitle
      : `${normalizedTitle}.md`;
    const pagePath = `${wikiFolder}/${withExtension}`;
    const content = await reader.tryReadFile(pagePath);
    if (!content) {
      console.warn(`[Load Page] Cannot read page: ${pagePath}`);
      continue;
    }

    const displayTitle = `${wikiFolder}/${normalizedTitle}`;

    // Determine the page type from path: "entities/xxx" → entity, "concepts/xxx" → concept, else source.
    const pathSegment = normalizedTitle.split('/')[0];
    const pageTypeHint = pathSegment === 'entities'
      ? 'entity'
      : pathSegment === 'concepts'
        ? 'concept'
        : null;

    let body: string;

    // Tier B: extract summary section for entity/concept pages (zero LLM).
    if (pageTypeHint && sectionLabels?.description && sectionLabels.definition) {
      const summary = extractSummaryFromPage(content, {
        descriptionLabel: sectionLabels.description,
        definitionLabel: sectionLabels.definition,
        pageType: pageTypeHint,
        maxChars: Math.floor(MAX_PAGE_CONTENT_CHARS / 3), // shorter summary
      });
      if (summary) {
        // The summary section is already shown; the matched paragraphs
        // outside it are what the retrieval saw and the model has not.
        const matched = extractMatchedParagraphs(
          content,
          queryTerms ?? [],
          matchedPerPage,
          { summarySectionLabels: [sectionLabels.description, sectionLabels.definition] },
        );
        body = matched ? `${summary}

${matched}` : summary;
      } else {
        body = content.length > MAX_PAGE_CONTENT_CHARS
          ? content.substring(0, MAX_PAGE_CONTENT_CHARS) + '\n\n... (truncated)'
          : content;
      }
    } else {
      body = content.length > MAX_PAGE_CONTENT_CHARS
        ? content.substring(0, MAX_PAGE_CONTENT_CHARS) + '\n\n... (truncated)'
        : content;
    }

    pages.push({ path: normalizedTitle, body: `## ${displayTitle}\n\n${body}` });
  }

  return pages;
}
