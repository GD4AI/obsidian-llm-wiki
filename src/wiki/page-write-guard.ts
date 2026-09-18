// Issue #603 slice 1: the `pageGuard` layer as a pure function.
//
// ## Why this is a separate layer
//
// `WikiEngine.createOrUpdateFile` was documented as a "single write gate with
// pollution defense", but it did four separable things and offered "all four" or
// "none": pollution correction, heading/provenance normalization, IO with retry
// and path resolution, and notification (`onFileWrite` + cache invalidation).
// Callers want different subsets. The evidence was already in the codebase —
// `wiki-engine.ts:845-851` records a *deliberate* bypass for the PDF sidecar,
// because going through the gate "would fire `onFileWrite` + `invalidatePageCaches`,
// which could trigger auto-ingest cascades if the source folder is watched".
//
// This file is the second of those concerns made addressable on its own: it is a
// pure content transformation, so it can be tested without a vault, and a caller
// that wants it can say so.
//
// ## Why the regexes live inside the function
//
// Both carry the `g` flag, and `RegExp.prototype.test` advances `lastIndex` on a
// global regex. Hoisting them to module scope would make the second call see a
// non-zero `lastIndex` and skip the correction — alternating between fixed and
// broken on consecutive writes. The previous inline form was safe only because it
// built a fresh literal per call, which is what this reproduces.
//
// ## What it deliberately does not do
//
// It does not log. The engine keeps its existing messages, so the split is
// invisible in the console, and the return value states exactly what changed —
// which is what makes the layer testable.

import { fixPollutedSources } from '../core/sources-normalizer';
import { normalizeHeadingSpacing } from '../core/markdown-spacing';
import { normalizeProvenanceMarkers } from '../core/provenance-marker';

/** What `applyPageGuard` corrected, for the caller to report. */
export interface PageGuardCorrections {
  /** Pattern A — `[[entities/X|entities/Y]]` → `[[entities/X|Y]]`. */
  displayNamePollution: boolean;
  /** Pattern B — `[[concepts/conceptsFoo|Foo]]` → `[[concepts/Foo|Foo]]`. */
  pathPrefixPollution: boolean;
  /** Number of `sources:` frontmatter entries repaired. */
  sourcesEntries: number;
  /** Whether heading spacing + provenance markers were normalized. */
  normalizedWikiPage: boolean;
}

export interface PageGuardOptions {
  wikiFolder: string;
  /** `settings.slugCase === 'preserve'`. */
  preserveCase: boolean;
  /**
   * True only for `entities/`, `concepts/` and `sources/` under the wiki folder.
   * Passed in rather than derived so the guard stays free of engine state and so
   * the boundary has exactly one definition.
   */
  isWikiContentPage: boolean;
}

/**
 * Apply the pollution and normalization half of the old write gate.
 *
 * Order matters and is preserved from the original: the two link-pollution
 * patterns are corrected before the `sources:` field is normalized (which
 * re-parses frontmatter), and heading spacing runs last so it sees the final
 * text.
 */
export function applyPageGuard(
  content: string,
  opts: PageGuardOptions
): { content: string; corrections: PageGuardCorrections } {
  const corrections: PageGuardCorrections = {
    displayNamePollution: false,
    pathPrefixPollution: false,
    sourcesEntries: 0,
    normalizedWikiPage: false,
  };

  // Pattern A: display-name pollution — [[entities/X|entities/Y]]
  //   e.g. [[entities/Qwen|entities/Qwen]] → [[entities/Qwen|Qwen]]
  const DISPLAY_POLLUTION_REGEX = /\[\[(entities|concepts|sources)\/([^|\]]+)\|(entities|concepts|sources)\/([^|\]]+)\]\]/g;
  if (DISPLAY_POLLUTION_REGEX.test(content)) {
    corrections.displayNamePollution = true;
    content = content.replace(
      DISPLAY_POLLUTION_REGEX,
      (_match: string, folder: string, pathPart: string, _dupFolder: string, display: string) => {
        return `[[${folder}/${pathPart}|${display}]]`;
      }
    );
  }

  // Pattern B: path-prefix duplication — [[X/Xname|name]]
  //   e.g. [[concepts/concepts布局优化|布局优化]] → [[concepts/布局优化|布局优化]]
  //   The folder prefix is duplicated in the path portion, directly before
  //   the page name with no separator (CJK char, letter, etc.).
  //   Safe: [[concepts/concepts-of-ML|...]] — '-' separator indicates legitimate slug.
  const PATH_DUP_REGEX = /\[\[(entities|concepts|sources)\/\1([^\s\-_|\]]+)(\|[^\]]+)?\]\]/g;
  if (PATH_DUP_REGEX.test(content)) {
    corrections.pathPrefixPollution = true;
    content = content.replace(
      PATH_DUP_REGEX,
      (_match: string, folder: string, rest: string, display: string | undefined) => {
        const displayPart = display || '';
        return `[[${folder}/${rest}${displayPart}]]`;
      }
    );
  }

  // Issue #125: normalize the `sources:` frontmatter field on every write.
  // The LLM emits raw note paths, `.md` extensions, `|alias` pipes, and
  // space/paren-containing titles. Left unfixed these become dead links.
  const sourcesFix = fixPollutedSources(content, opts.wikiFolder, opts.preserveCase);
  if (sourcesFix.fixed > 0) {
    corrections.sourcesEntries = sourcesFix.fixed;
    content = sourcesFix.content;
  }

  // Cosmetic spacing: one blank line after each heading, blank-line runs
  // collapsed (see core/markdown-spacing.ts). Wiki content pages only —
  // log/schema writes pass through untouched.
  if (opts.isWikiContentPage) {
    content = normalizeHeadingSpacing(content);
    // Repair the provenance footnote's brackets on the same pass. The model
    // gets them wrong often enough that paragraph-provenance.ts stops seeing
    // the marker, and a marker it cannot see is a paragraph with no owner.
    content = normalizeProvenanceMarkers(content);
    corrections.normalizedWikiPage = true;
  }

  return { content, corrections };
}
