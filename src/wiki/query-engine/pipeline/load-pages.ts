// PR #3 split: Phase 3 of buildWikiContext — load and summarize retrieved pages.
// Extracted from query-engine.ts (1175-1323).
//
// Pure: takes a list of paths + plugin + section labels, returns the
// raw markdown bodies (with Tier B summaries where applicable). No
// mutation of `this._graph` / `_lastRetrieval` (QueryView's job).

import { MAX_PAGE_CONTENT_CHARS } from '../../../constants';
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
  /** The query's terms. When given, the paragraphs that matched ride along
   *  with the summary so the model can see why the page was retrieved. The
   *  retrieval scores the full body and the display shows one section; the
   *  two units must agree or the model is reading the right page for a
   *  reason it cannot see. */
  queryTerms?: readonly string[],
): Promise<string[]> {
  const pages: string[] = [];
  const wikiPrefix = wikiFolder + '/';

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
          Math.floor(MAX_PAGE_CONTENT_CHARS / 3),
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

    pages.push(`## ${displayTitle}\n\n${body}`);
  }

  return pages;
}
