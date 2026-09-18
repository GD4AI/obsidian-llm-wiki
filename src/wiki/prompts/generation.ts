// Generation prompts — entity, concept, and summary page creation

export const GENERATION_PROMPTS = {
  generateEntityPage: `You are a Wiki knowledge base maintainer. Create a Wiki page for the following entity.

**Entity Information:**
- Name: {{entity_name}}
- Tag: {{entity_type}} (a tags: value — the frontmatter type: below stays "entity")
- Summary: {{entity_summary}}
- Related entities: {{related_entities}}
- Related concepts: {{related_concepts}}
- Extraction aliases (seeds): {{extraction_aliases}}

**Existing Related Content in Wiki:**
{{related_content}}

{{merge_strategy}}

**Task Requirements:**
1. Create an entity page with basic and key information
2. When referencing another page, write [[Name]] using the name as you would say it. Do NOT write a folder path and do NOT guess one — the system resolves every name to its real page after generation, against the whole wiki. A display name is optional: [[Qwen]] and [[Qwen|the Qwen family]] are both correct.
3. IMPORTANT: All related entities and concepts MUST be formatted as wiki-links using the [[path|display]] format — even if the target page does not yet exist in the Wiki. This allows the Lint system to detect dead links and create stub pages later. Never output a related entity/concept name as plain text.
4. If the entity already exists in the Wiki, use the merge strategy above for intelligent merging
4. Be objective, accurate, and concise
5. **Generate aliases for this page** — provide 1-3 alternative names. This field is REQUIRED:
   - Include acronyms, abbreviations, and same-language alternative names
   - English is universally acceptable as a "linker language" — when a term originates in English
     (e.g. "Transformer", "DNA", "API", "RoPE", "CUDA"), keep it as-is even in non-English wikis
   - **CRITICAL: do NOT invent translations for established technical terms.** If a term is universally
     used in English across scientific literature, do NOT coin a Chinese/Japanese/German equivalent
     that doesn't exist in real-world usage. Real-world convention always wins over linguistic purity.
   - **If no natural alias exists**, use the page title itself as the first alias. The aliases field MUST NOT be left empty — always provide at least one alias

   Examples:
   - 维生素 B2 (Chinese wiki) → ["维他命 B2", "Vitamin B2", "VB2"]
   - Transformer (Chinese wiki) → ["Transformers", "BERT"]      ← NO 变换器 (no such usage in Chinese)
   - Rotary Position Embedding (Japanese wiki) → ["RoPE", "回転位置埋め込み"]
   - Neural Network (Chinese wiki) → ["神经网络", "NN"]

**Output Format:**
---
type: entity  # MUST be exactly "entity" - do not change this value
created: {{date}}
updated: {{date}}
sources: ["[[{{source_file}}]]"]
tags: [{{entity_type}}]  # Copy the Tag value from Entity Information verbatim
aliases: ["Alternative name or translation"]  # REQUIRED: at least 1 alias, must NOT be empty
---

# {{entity_name}}

## {{section_description}}
[Detailed description of the entity with bidirectional links]

## {{section_related_entities}}
[Reference related entities using full paths from the list above]

## {{section_related_concepts}}
[Reference related concepts using full paths from the list above]
`,

  generateConceptPage: `You are a Wiki knowledge base maintainer. Create a Wiki page for the following concept.

**Concept Information:**
- Name: {{concept_name}}
- Tag: {{concept_type}} (a tags: value — the frontmatter type: below stays "concept")
- Summary: {{concept_summary}}
- Related concepts: {{related_concepts}}
- Related entities: {{related_entities}}
- Extraction aliases (seeds): {{extraction_aliases}}

**Existing Related Content in Wiki:**
{{related_content}}

{{merge_strategy}}

**Task Requirements:**
1. Create a concept page including definition, characteristics, and applications
2. When referencing another page, write [[Name]] using the name as you would say it. Do NOT write a folder path and do NOT guess one — the system resolves every name to its real page after generation, against the whole wiki. A display name is optional: [[Attention]] and [[Attention|attention mechanism]] are both correct.
3. IMPORTANT: All related entities and concepts MUST use [[wiki-link]] format even if the target page does not yet exist — this allows the Lint system to detect and fix them later. Never output a related entity/concept name as plain text.
4. If the concept already exists in the Wiki, use the merge strategy above for intelligent merging
4. Be objective, accurate, and concise
5. **Generate aliases for this page** — provide 1-3 alternative names. This field is REQUIRED:
   - Include acronyms, abbreviations, and same-language alternative names
   - English is universally acceptable as a "linker language" — when a term originates in English
     (e.g. "Transformer", "DNA", "API", "RoPE", "CUDA"), keep it as-is even in non-English wikis
   - **CRITICAL: do NOT invent translations for established technical terms.** If a term is universally
     used in English across scientific literature, do NOT coin a Chinese/Japanese/German equivalent
     that doesn't exist in real-world usage. Real-world convention always wins over linguistic purity.
   - **If no natural alias exists**, use the page title itself as the first alias. The aliases field MUST NOT be left empty — always provide at least one alias

   Examples:
   - 维生素 B2 (Chinese wiki) → ["维他命 B2", "Vitamin B2", "VB2"]
   - Transformer (Chinese wiki) → ["Transformers", "BERT"]      ← NO 变换器 (no such usage in Chinese)
   - Rotary Position Embedding (Japanese wiki) → ["RoPE", "回転位置埋め込み"]
   - Neural Network (Chinese wiki) → ["神经网络", "NN"]

**Output Format:**
---
type: concept  # MUST be exactly "concept" - do not change this value
created: {{date}}
updated: {{date}}
sources: ["[[{{source_file}}]]"]
tags: [{{concept_type}}]  # Copy the Tag value from Concept Information verbatim
aliases: ["Alternative name or translation"]  # REQUIRED: at least 1 alias, must NOT be empty
---

# {{concept_name}}

## {{section_definition}}
[Clear definition of the concept]

## {{section_key_characteristics}}
- Characteristic 1
- Characteristic 2

## {{section_applications}}
[Application scenarios for the concept]

## {{section_related_concepts}}
[Reference related concepts using full paths from the list above]

## {{section_related_entities}}
[Reference related entities using full paths from the list above]
`,

  generateSummaryPage: `You are a Wiki knowledge base maintainer. Create a summary page for the following source file.

**Source File Information:**
- Title: {{source_title}}
- Content: {{content}}
- Analysis Results: {{analysis}}

**All Created Wiki Pages (use these exact full paths when referencing):**
{{created_pages_list}}

**Task Requirements:**
1. Create a concise summary page
2. When referencing entities and concepts, use the exact full path format from the "All Created Wiki Pages" list above
3. {{constraints}}
4. Highlight key points
5. Be objective and accurate
6. **Generate aliases for this page** — provide 1-2 alternative names for the source. This field is REQUIRED:
   - Include alternative titles, abbreviations, or common alternative names for the source
   - English is universally acceptable as a "linker language" — when a term originates in English
     (e.g. "Transformer", "DNA", "API", "RoPE"), keep it as-is even in non-English wikis
   - **CRITICAL: do NOT invent translations for established technical terms.** Real-world usage
     always wins over linguistic purity. Only include translations that actually exist in the target language.
   - **If no natural alias exists**, use the source file name or the page title itself. The aliases field MUST NOT be left empty — always provide at least one alias
7. **Tags** — keep the values given in the tags field below. You may add values from the Active Tag Vocabulary that describe what this source is about. Never add any other value.

**Output Format:**
---
type: source
created: {{date}}
updated: {{date}}
source_file: "[[{{source_file}}]]"
tags: [{{tags}}]
aliases: ["Alternative title or translation"]  # REQUIRED: at least 1 alias, must NOT be empty
---

# {{source_title}} - Summary

## {{section_source}}
- Original file: [[{{source_file}}]]
- Ingested: {{date}}

## {{section_core_content}}
[100-200 word summary with bidirectional links]

## {{section_key_entities}}
[Reference entities using full paths from the list above]

## {{section_key_concepts}}
[Reference concepts using full paths from the list above]

## {{section_main_points}}
- Point 1
- Point 2
`,

  // Variant used when the existing page has `reviewed: true` in frontmatter.
  preserveReviewedEntityPage: `You are a Wiki knowledge base maintainer. The following entity page has been manually reviewed by the user (reviewed: true).

**⚠️ Important: User-reviewed content must be fully preserved. Do NOT delete or rewrite.**

**Entity Information (from new source file):**
- Name: {{entity_name}}
- Type: {{entity_type}}
- Summary: {{entity_summary}}

**Existing Wiki Pages (use these exact full paths when referencing):**
{{existing_pages}}

**User-Reviewed Existing Page Content (MUST be fully preserved):**
{{related_content}}

**Task Requirements:**
1. **Fully preserve** all user-reviewed content — do not delete or rewrite any paragraph
2. Only add non-duplicate information from the new source at the end in a "New Information" section
3. If new information duplicates or contradicts existing content, do NOT add it; keep the user's version
4. The frontmatter MUST retain reviewed: true
5. When referencing other pages, copy the wiki-link format EXACTLY from the list above. NEVER duplicate folder prefixes in the display name. Example: [[entities/Qwen|Qwen]] is CORRECT, [[entities/Qwen|entities/Qwen]] is WRONG

**Output Format:**
---
type: entity
created: {{date}}
updated: {{date}}
sources: ["[[{{source_file}}]]"]
tags: [{{tags}}]
aliases: []
reviewed: true
---

[Fully preserve user-reviewed existing content here]

## {{section_new_information}} ({{date}})
[Only add non-duplicate new information; write "No new information" if none]
`,

  // Variant used when the existing concept page has `reviewed: true` in frontmatter.
  preserveReviewedConceptPage: `You are a Wiki knowledge base maintainer. The following concept page has been manually reviewed by the user (reviewed: true).

**⚠️ Important: User-reviewed content must be fully preserved. Do NOT delete or rewrite.**

**Concept Information (from new source file):**
- Name: {{concept_name}}
- Type: {{concept_type}}
- Summary: {{concept_summary}}
- Related concepts: {{related_concepts}}

**Existing Wiki Pages (use these exact full paths when referencing):**
{{existing_pages}}

**User-Reviewed Existing Page Content (MUST be fully preserved):**
{{related_content}}

**Task Requirements:**
1. **Fully preserve** all user-reviewed content — do not delete or rewrite any paragraph
2. Only add non-duplicate information from the new source at the end in a "New Information" section
3. If new information duplicates or contradicts existing content, do NOT add it; keep the user's version
4. The frontmatter MUST retain reviewed: true
5. When referencing other pages, copy the wiki-link format EXACTLY from the list above. NEVER duplicate folder prefixes in the display name. Example: [[entities/Qwen|Qwen]] is CORRECT, [[entities/Qwen|entities/Qwen]] is WRONG

**Output Format:**
---
type: concept
created: {{date}}
updated: {{date}}
sources: ["[[{{source_file}}]]"]
tags: [{{tags}}]
aliases: []
reviewed: true
---

[Fully preserve user-reviewed existing content here]

## {{section_new_information}} ({{date}})
[Only add non-duplicate new information; write "No new information" if none]
`,

  suggestSchemaUpdate: `You are a Wiki Schema advisor. Review the current schema and the latest ingestion analysis.

Current Schema:
{{schema_content}}

Analysis Context:
{{analysis_context}}

Task: Determine if the schema needs updating to better accommodate recent content.
Consider:
1. Are there new entity types that should be added to the classification rules?
2. Are there new concept types that should be added?
3. Should naming conventions be adjusted?
4. Should page templates be updated (missing sections, better structure)?
5. Should maintenance policies be revised (stale thresholds, severity levels)?

Output JSON format:
{
  "changes_needed": true,
  "new_schema_body": "The COMPLETE schema body, in markdown, as it would read IF this proposal were accepted — starting with the H1 title, including every section that would exist after accepting (unchanged sections may be kept exactly as-is). Nothing has been applied yet.",
  "suggestions": "Markdown description of the PROPOSED schema changes with reasoning (1-3 sentences). Phrase this as a proposal that has not been applied yet ('would add...', 'proposes to...') — never past tense ('added...', 'changed...'), since Apply has not been clicked."
}

If no changes are needed:
{
  "changes_needed": false,
  "suggestions": "Short explanation of why no changes are needed"
}

CRITICAL:
- The "suggestions" field must be written in the user's UI language below (after this CRITICAL block). Do NOT default to English unless the user's UI language is English.
- new_schema_body is the COMPLETE schema as it would read IF this proposal were accepted — not a diff, not a patch, and not yet applied. The apply path replaces the current body with new_schema_body verbatim only if and when the user clicks Apply.
- DO NOT include YAML frontmatter (--- ... ---) in new_schema_body. Start directly with the H1 title (e.g. "# Wiki Schema Configuration").
- DO NOT wrap new_schema_body in markdown code fences (\`\`\`). The parser strips them, but cleaner output reduces parse risk on small models.
- Preserve all existing sections that are still relevant. Only change what the analysis actually warrants.
- Output ONLY the JSON, no other text.

User UI language: {{user_language}}`,
};
