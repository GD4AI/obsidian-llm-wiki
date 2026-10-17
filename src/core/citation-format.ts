/**
 * Inline citations in academic form.
 *
 * #756 follow-up: the answer carried two kinds of reference and rendered both
 * the same way — a wiki-link at the end of a paragraph and the list at the
 * bottom looked identical. The inline marks are metadata about the sentence;
 * the bottom list is the bibliography. They need different treatments.
 *
 * The inline form is the numeric citation every paper uses: `[1]` at the
 * point of use, a numbered list at the end. The number is assigned in order
 * of first appearance across the whole answer, and a page cited twice gets
 * the same number both times.
 *
 * This module is the pure transform: answer text in, cited text and the
 * reference list out. Rendering is the caller's job.
 */

export interface Citation {
  /** 1-based. Assigned in order of first appearance. */
  readonly n: number;
  /** The display name: the alias when the link has one, the path tail otherwise. */
  readonly label: string;
  /** The link target, as written. */
  readonly path: string;
}

export interface CiteResult {
  /** The answer with every `[[link]]` replaced by `[n]`. */
  readonly text: string;
  /** The bibliography, in numbering order. */
  readonly references: readonly Citation[];
}

const WIKI_LINK = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Replace every wiki-link with its citation number and collect the
 * bibliography.
 *
 * The same path always gets the same number, whatever alias it is written
 * with — `[[entities/kimi|Kimi]]` and `[[entities/kimi|K2]]` are one source
 * cited twice, and a bibliography that listed them separately would be
 * wrong.
 */
export function citeAnswer(answer: string): CiteResult {
  const byPath = new Map<string, Citation>();
  const references: Citation[] = [];

  // The reference list the model writes carries its own `[[link|Display]]`
  // forms. Replacing them with `[N]` there throws the display name away and
  // leaves `1. <a>[1]</a> — description` — the ordered-list marker and the
  // citation number both saying "first". The list is reformatted by
  // `normalizeReferenceSection` instead, which keeps the display name.
  const refStart = answer.search(/^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(参考文献|references|bibliography)\s*(?:\*\*)?\s*[:：]?\s*$/im);
  const head = refStart >= 0 ? answer.slice(0, refStart) : answer;
  const tail = refStart >= 0 ? answer.slice(refStart) : '';

  const textHead = head.replace(WIKI_LINK, (_full, path: string, alias?: string) => {
    const trimmed = (path ?? '').trim();
    const existing = byPath.get(trimmed);
    if (existing) return renderCitationMark(existing.n, existing.path);

    const label = (alias ?? '').trim() || trimmed.split('/').pop() || trimmed;
    const n = references.length + 1;
    const citation: Citation = { n, label, path: trimmed };
    byPath.set(trimmed, citation);
    references.push(citation);
    return renderCitationMark(n, trimmed);
  });

  return { text: textHead + tail, references };
}

/**
 * Render the bibliography as markdown. The caller decides where it goes;
 * the format is the one every paper uses — `[n] label`.
 */
/** The inline mark. A link so the citation is clickable; the class is so the
 *  stylesheet can size and colour it.  is what the wiki-link click
 *  binder reads. */
function renderCitationMark(n: number, path: string): string {
  return '<a class="llm-wiki-citation internal-link" data-href="' + path + '" href="' + path + '">[' + String(n) + ']</a>';
}

export function renderReferenceList(references: readonly Citation[]): string {
  if (references.length === 0) return '';
  return references.map(r => `[${r.n}] ${r.label}`).join('\n');
}

/**
 * Reformat a reference list the model wrote into the house form.
 *
 * The model writes `1. [N] — description` (an ordered list whose items carry
 * a citation number and a description but no page name). The house form is
 * `[N] title - description` — the number once, the page name, the
 * description. The ordered-list marker is dropped because the citation
 * number already carries the order.
 *
 * `byLabel` maps a description fragment to the page name, so the title can be
 * recovered when the model did not write it.
 */
export function reformatReferenceList(
  section: string,
  references: readonly Citation[],
): string {
  // Each item: optional ordered-list marker, optional [N], optional
  // separator, then the description.
  const ITEM = /^\s*(?:\d+\.\s*)?(?:\[(\d+)\]\s*)?(?:[—\-–]\s*)?(.+?)\s*$/;
  return section
    .split('\n')
    .map(line => {
      const m = line.match(ITEM);
      if (!m) return line;
      const n = m[1] ? Number(m[1]) : undefined;
      const description = m[2] ?? '';
      if (n === undefined) return line;
      const ref = references.find(r => r.n === n);
      const title = ref?.label ?? '';
      // The house form is `[N] title - description`. When the model wrote no
      // wiki-links we have no title; the number and the description still
      // carry the meaning, and the ordered-list marker is dropped either way
      // because `[N]` already numbers the entry.
      return title ? `[${n}] ${title} - ${description}` : `[${n}] ${description}`;
    })
    .join('\n');
}

/**
 * Find the reference section the model wrote and reformat it in place.
 * Returns the answer unchanged when there is no such section.
 */
export function normalizeReferenceSection(
  answer: string,
  references: readonly Citation[],
): string {
  const lines = answer.split('\n');
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    const heading = line.match(/^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(参考文献|references|bibliography)\s*(?:\*\*)?\s*[:：]?\s*$/i);
    if (heading) {
      inSection = true;
      out.push(line);
      continue;
    }
    // A new heading at the same or a higher level ends the section.
    if (inSection && /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(参考文献|references|bibliography)/i.test(line) === false && /^#{1,6}\s+\S/.test(line)) {
      inSection = false;
    }
    out.push(inSection ? reformatReferenceSectionLine(line, references) : line);
  }
  return out.join('\n');
}


/**
 * One line of the model's reference list. The model writes
 * `1. [[wiki/path|Display]] — description`. The house form is
 * `[N] Display - description`: the citation number once, the page name, the
 * description. The ordered-list marker is dropped because `[N]` already
 * numbers the entry.
 */
function reformatReferenceSectionLine(line: string, references: readonly Citation[]): string {
  const m = line.match(/^\s*(?:\d+\.\s*)?\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]\s*(?:[—\-–:]\s*)?(.+?)\s*$/);
  if (m) {
    const path = m[1].trim();
    const display = (m[2] ?? '').trim() || path.split('/').pop() || path;
    const description = m[3] ?? '';
    const ref = references.find(r => r.path === path);
    const n = ref?.n ?? references.length + 1;
    // Keep the entry clickable. The house form is `[N] Display - description`
    // and the whole `[N] Display` is the link; `data-href` is what the
    // wiki-link click binder reads.
    const link = '<a class="internal-link" data-href="' + path + '" href="' + path + '">[' + n + '] ' + display + '</a>';
    return description ? link + ' - ' + description : link;
  }
  return reformatReferenceList(line, references);
}
