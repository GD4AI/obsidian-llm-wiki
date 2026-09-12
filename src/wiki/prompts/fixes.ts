// Fix prompts — dead link repair, empty page expansion, orphan linking, contradiction resolution

export const FIX_PROMPTS = {
  fixDeadLink: `You are a Wiki dead link repair assistant. Analyze the dead link and repair it based on the situation.

Dead Link Source Page:
{{source_content}}

Dead Link Target (link text):
{{target_name}}

Existing Wiki Page List:
{{existing_pages}}

Task:
1. **FIRST, check aliases:** Look at the \`aliases:\` listed after each page. If the dead link target matches any page's title OR any page's aliases (case-insensitive), that page IS the correct target — use action=correct
2. If no alias match, search for semantic similarity (translations, abbreviations, alternative phrasings)
3. If a matching page is found: output the correct [[entities/page-name|Display Name]] or [[concepts/page-name|Display Name]] link. The display name after | must NOT include folder prefixes like entities/ or concepts/
4. If no match is found after checking BOTH aliases and semantic similarity: output a concise name suitable as a new page title

Output JSON format:
{"action": "correct|create_stub", "correct_link": "Corrected link (when action=correct)", "stub_title": "New page title (when action=create_stub)", "stub_type": "entity|concept", "reason": "Reason for judgment (one sentence)"}`,

  fillEmptyPage: `You are a Wiki page expansion assistant. Generate content for the following under-populated Wiki page.

Page Type (entities/concepts/sources): {{page_type}}

Existing Content:
{{existing_content}}

Wiki Index (background reference):
{{wiki_index}}

**Target Language Section Headers (use EXACTLY these headers):**
{{section_labels}}

Task:
1. Generate appropriate content (150-300 words) based on the page type and title
2. entities type: describe the entity's definition, relevant background, and relationships with other entities
3. concepts type: explain the concept's definition, application scenarios, and related concepts
4. sources type: summarize the source's core viewpoints and contributions
5. Use [[wiki-links]] to link to related pages. Copy the link format EXACTLY from the Wiki Index — the LEFT side is the full path (folder/page-name), the RIGHT side after | is the DISPLAY NAME only. NEVER duplicate folder prefixes like entities/ or concepts/ in the display name. Example: [[entities/Qwen|Qwen]] is correct, [[entities/Qwen|entities/Qwen]] is WRONG
6. **Related entities/concepts LIMIT:** Create at MOST {{max_entities}} related entity links and {{max_concepts}} related concept links. Focus on the most important connections only. Do NOT generate exhaustive lists
7. **IMPORTANT — Source Mentions:** Only create a "Mentions in Source" section if the existing content already contains verbatim source quotes. If no source quotes exist in the existing content, do NOT fabricate a "Mentions in Source" section — instead, note "*(No source content available for this page)*" in the description. NEVER invent fake citations or source references
8. Preserve any existing frontmatter fields exactly (type, created, sources, tags, reviewed). Do NOT remove or alter these fields
9. **Aliases are REQUIRED:** If the existing content has non-empty aliases, keep them. If aliases are missing or empty, you MUST generate 1-2 meaningful aliases following the fallback hierarchy: translation in Wiki language → alternative names → abbreviations. The aliases field MUST NOT be left empty
10. **Tags constraint:** use only values from the Active Tag Vocabulary given in the system prompt. Never invent new tags outside that list

Output format: directly output the complete Markdown page content (do not output explanatory text)`,

  linkOrphanPage: `You are a Wiki link repair assistant. Establish backlinks to an orphan page from relevant pages.

Orphan Page:
{{orphan_content}}

Wiki Index:
{{wiki_index}}

Task:
1. Analyze the orphan page's topic
2. Select 1-3 most relevant existing pages from the Wiki index
3. For each relevant page, generate a suggested link text (one sentence description + wiki-link)

Output JSON format:
{"related_pages": [{"page_path": "{{wikiFolder}}/entities/xxx.md", "link_text": "One sentence describing this connection", "link_target": "[[entities/orphan-name]]"}], "reason": "Connection rationale"}`,
};
