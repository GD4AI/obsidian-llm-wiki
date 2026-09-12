// Contradiction record ("case file") builder.
//
// An OPEN contradiction lives in two carriers, neither of them the page
// body: the `contradictions:` frontmatter marker on the affected wiki
// page (the index — `core/contradicted-marker.ts`), and one record file
// under `<wikiFolder>/contradictions/` (the prose). The body block
// `## ⚠️ Potential Contradiction` is not a durable carrier: it is
// unknown to the section schema, so `stripUnknownSections` removes it
// on the next model rewrite of the page.
//
// The page a record points at is the page the merge triage was shown —
// a path the code holds, never a value the model named. The resolver
// that once validated model-named targets left with its producer (#666).
//
// Pure, no IO.

import { slugify } from './slug';

/**
 * Localized section labels the record's four `##` sections use — the
 * `new_claim` / `existing_knowledge` / `resolution_suggestion` /
 * `source_page` entries of `getSectionLabels(settings)`.
 */
export type ContradictionRecordLabels = Record<string, string>;

export interface ContradictionRecordInput {
  /** What the new source claims. */
  claim: string;
  /** What the affected page (or section) says today. */
  existingView: string;
  /** Suggested resolution; may be empty when the flagging path has none. */
  resolution: string;
  /** Resolved wiki-relative path (no `.md`) of the affected page. */
  pageRelPath: string;
  /** Vault path of the note whose ingest raised the conflict. */
  sourceNotePath: string;
  /** YYYY-MM-DD. */
  date: string;
}

/**
 * Build one record file. The body keeps exactly four `##` sections in
 * this order — `getOpenContradictions` parses them positionally.
 */
export function buildContradictionRecord(
  input: ContradictionRecordInput,
  labels: ContradictionRecordLabels,
): { fileName: string; content: string } {
  const fileName = `${slugify(input.claim.substring(0, 50))}-${input.date}.md`;
  const pageLink = `[[${input.pageRelPath}]]`;
  const content = `---
status: detected
detected: ${input.date}
source_page: "${pageLink}"
source_note: "${input.sourceNotePath}"
---

# Contradiction: ${input.claim.substring(0, 60)}

## ${labels.new_claim}
${input.claim}

## ${labels.existing_knowledge}
${input.existingView}

## ${labels.resolution_suggestion}
${input.resolution}

## ${labels.source_page}
${pageLink}

---
*Auto-detected on ${input.date}*
`;
  return { fileName, content };
}
