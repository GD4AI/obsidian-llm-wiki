// Merge prompts — multi-source knowledge fusion and content integration

export const MERGE_PROMPTS = {
  // Multi-Source Knowledge Fusion: structured merge analysis.
//
// v1.24.0 #216 — Tier-2: extended from binary triage to 4-class
// per-item classification. The classifier outputs a structured
// `items[]` array so the complementary path can append each new
// fact into its target section (Tier-2: targeted append, not full
// rewrite). Strategies:
//
//   - 'skip'           — every item is a duplicate; items[] is empty.
//                         Skip path: only update frontmatter.
//   - 'merge'          — substantial restructuring needed (e.g. new
//                         section, full rewrite); items[] is empty.
//                         Falls through to the existing body-merge path.
//   - 'complementary'  — each item adds detail to an existing section;
//                         populate items[] with target_section =
//                         EXACTLY one of the {{section_labels}} values.
//                         Per-section append path.
//   - 'contradictory'  — new info conflicts with existing; items[]
//                         is empty; falls through to the existing
//                         body-merge path (which already handles
//                         "preserve both with attribution").
//
// The {{section_labels}} placeholder is rendered with the **localized**
// section names from getSectionLabels(settings), so target_section
// values match the labels actually present in the existing page
// (matters for i18n wikis: de uses "Beschreibung", ja uses "説明", etc.).
  mergeAnalysis: `You are a Wiki knowledge fusion analyzer. Decide how to integrate new source information into the existing Wiki page.

**Page Name:** {{page_name}}
**Page Type:** {{page_type}}

**Existing Page Content:**
{{existing_content}}

**New Information from Source File:**
{{new_info}}{{source_excerpt}}{{source_context}}

**Available sections in the existing page (target_section MUST be one of these exact names):**
{{section_labels}}

**Task:**
Examine the new information and classify each piece into ONE of the four strategies:

- "skip" — every piece is already fully present in the existing page. No new content to add. \`items\` MUST be an empty array.
- "merge" — substantial restructuring needed (e.g. a new section is required, or the existing structure is wrong). The full body-rewrite path will be used. \`items\` MUST be an empty array.
- "complementary" — each piece adds new facts that fit into one of the existing sections, or conflicts with a specific existing statement. Populate \`items\` with one entry per piece:
  - \`kind\` = "complementary" for a new fact, "contradictory" for a piece that CONFLICTS with a specific statement already on the page
  - \`content\` = the specific new fact or conflicting claim (verbatim from the source if possible, otherwise a concise paraphrase)
  - \`target_section\` = EXACTLY one name from the available sections list (for "contradictory": the section containing the contradicted statement)
  - \`reason\` = one-sentence justification
  - \`existing_statement\` (contradictory only) = the sentence on the page that the piece conflicts with, copied VERBATIM from "Existing Page Content"
- "contradictory" — the new info AS A WHOLE conflicts with the page's core claims (not just single statements — use a "contradictory" item inside "complementary" for those). The full body-rewrite path will handle attribution. \`items\` MUST be an empty array.

Output JSON format (ONLY this object, no other text):
{
  "strategy": "skip" | "merge" | "complementary" | "contradictory",
  "items": [
    {
      "kind": "complementary" | "contradictory",
      "content": "Specific new fact text",
      "target_section": "Exact section name from the available sections list",
      "reason": "Why this belongs in target section (one sentence)",
      "existing_statement": "(contradictory only) verbatim sentence from the existing page"
    }
  ],
  "reason": "One-sentence overall justification"
}

Rules:
- Default to "merge" if uncertain — better to rewrite than to silently drop new info.
- \`target_section\` MUST be exactly one of the available sections list (case-sensitive).{{source_ownership_rule}}
- Output ONLY JSON, nothing else.`,

  // Contradiction gate 2 — the source-stance question, asked as its own small
  // call over the note excerpt the triage already saw. Inside the triage the
  // same question (as a `stance` field) answered "reports" for every item,
  // the RCT the note itself presents included; alone, over excerpt + claim,
  // it separated reported from held positions 24/24 vs 48/48 (S150/S151).
  // The evidence sentence is checked against the excerpt by the caller.
  sourceStance: `You are given an excerpt of a source note and one claim that was extracted from it.

**Excerpt of the source note (what it says about "{{page_name}}"):**
{{source_excerpt}}{{source_context}}

**Extracted claim:**
{{claim}}

**Question:** Does the source itself hold this claim as its own position?
- Answer "yes" if the source asserts the claim, presents it as established, or reports evidence it accepts.
- Answer "no" if the source attributes the claim to others (critics, older reviews, a minority view, a hypothesis under debate) without endorsing it, or describes it as a position it argues against.

Answer with JSON only:
{"holds": "yes" | "no", "evidence": "<the sentence from the excerpt that shows this, verbatim>"}`,

  mergeEntityPage: `You are a Wiki editor performing intelligent content integration. Merge new source information into an existing page following the schema-defined structure.

**Schema Rules (MUST follow this structure):**
- ## {{section_description}}: Core definition and significance (3-6 sentences)
- ## {{section_related_entities}}: Links to related entities
- ## {{section_related_concepts}}: Links to related concepts

**Existing Page Content (the current version):**
{{existing_body}}

**New Information from Source "{{new_source}}":**
- Summary: {{entity_summary}}
- Related entities: {{related_entities}}
- Related concepts: {{related_concepts}}
- Key details: {{key_details}}{{source_excerpt}}

{{content_requirements}}

**Integration Requirements:**
1. STRUCTURE: Follow the schema sections exactly. If a section exists, update it; if missing, create it.
2. DESCRIPTION: Integrate new facts naturally. When a verbatim excerpt block is present, it is the authoritative payload: integrate EVERY fact in it that concerns this page, not only the summary lines. Do NOT duplicate existing information.
3. RELATED: Update "{{section_related_entities}}" and "{{section_related_concepts}}" sections with new relationships.
4. CONTRADICTIONS: If new info conflicts with existing, preserve BOTH with clear attribution.
5. LINKS: Write [[Name]] as you would say the name. Do NOT write or guess a folder path — the system resolves every name to its real page after the merge, against the whole wiki. A display name is optional.
6. STYLE: Match existing writing style.
7. NO REDUNDANCY: Do NOT restate existing facts.

**Output Format:**
Output ONLY the body content (no frontmatter):

## {{section_description}}
[Integrated description — merge existing + new, no duplication]

## {{section_related_entities}}
[Updated entity links]

## {{section_related_concepts}}
[Updated concept links]`,

  mergeConceptPage: `You are a Wiki editor performing intelligent content integration. Merge new source information into an existing concept page following the schema-defined structure.

**Schema Rules (MUST follow this structure):**
- ## {{section_description}}: Detailed explanation with examples (3-6 sentences)
- ## {{section_related_concepts}}: Links to related concepts
- ## {{section_related_entities}}: Links to related entities

**Existing Page Content (the current version):**
{{existing_body}}

**New Information from Source "{{new_source}}":**
- Summary: {{concept_summary}}
- Related concepts: {{related_concepts}}
- Related entities: {{related_entities}}
- Key details: {{key_details}}{{source_excerpt}}

{{content_requirements}}

**Integration Requirements:**
1. STRUCTURE: Follow the schema sections exactly. Update existing, create missing.
2. DESCRIPTION: Integrate new understanding coherently with existing. When a verbatim excerpt block is present, it is the authoritative payload: integrate EVERY fact in it that concerns this concept, not only the summary lines.
3. RELATED CONCEPTS: Update links — add new ones, preserve existing.
4. RELATED ENTITIES: Update links — add new ones from this source.
5. CONTRADICTIONS: If new info conflicts, preserve both with attribution.
6. LINKS: Write [[Name]] as you would say the name. Do NOT write or guess a folder path — the system resolves every name to its real page after the merge, against the whole wiki. A display name is optional.
7. STYLE: Match existing writing style.
8. NO REDUNDANCY: Do NOT restate existing facts.

**Output Format:**
Output ONLY the body content (no frontmatter):

## {{section_description}}
[Integrated description — merge existing + new]

## {{section_related_concepts}}
[Updated concept links]

## {{section_related_entities}}
[Updated entity links]`,

  // Minimal append mode for reviewed pages
  appendToReviewedPage: `You are a Wiki editor adding new information to a user-reviewed page. The existing content is AUTHORITATIVE and must be preserved exactly.

**User-Reviewed Existing Content (MUST preserve completely):**
{{existing_body}}

**New Information from Source "{{new_source}}":**
- Summary: {{entity_summary}}
- Key details: {{key_details}}{{source_excerpt}}

{{content_requirements}}

**Task:**
1. Compare new information against existing content
2. If new info is COMPLETELY REDUNDANT with existing content → output "NO_NEW_CONTENT"
3. If new info adds genuinely new facts → append them in a "New Information ({{new_source}})" section at the end
4. DO NOT modify any existing content
5. DO NOT remove or rewrite any existing sections
6. {{constraints}}

**Output Format:**
If no new content: output exactly "NO_NEW_CONTENT"

If new content exists:
[existing content preserved exactly]

## New Information ({{new_source}})
[Only genuinely new facts, written to match existing style]`,

  // Update related page with incremental information from a new source
  //
  // The output contract mirrors `appendToReviewedPage`: existing content keeps
  // its position and new information goes AFTER it. Without an explicit format
  // block the model routinely emitted the new facts as an opening paragraph,
  // pushing the page's own definition down — the page reads as if the newest
  // incidental source were its subject.
  updateRelatedPage: `Existing Wiki page: {{page_name}}

Existing content:
{{existing_body}}

The new source file ("{{source_basename}}") provides additional information about {{page_name}}:
{{new_info}}

Update the page by adding the new information without deleting existing content.
{{content_requirements}}
{{constraints}}
Use wiki-link syntax [[page-name]].


**Output Format:**
Output ONLY the updated page BODY content (without frontmatter), no other text:

[existing sections, preserved in their current order]

[new information — integrated into the section it belongs to, or appended as a
final section when it fits none of them]

NEVER place new information above the existing content.`,
};
