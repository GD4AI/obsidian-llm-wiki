// Ingestion prompts — source analysis, entity resolution

export const INGESTION_PROMPTS = {
  analyzeSource: `You are a Wiki knowledge base maintainer. Analyze the following source file and output structured JSON.

**Source File:**
- Original vault path: {{source_path}}
- Use this EXACT path in every mentions_with_provenance[i].source_path field. Do NOT invent a wiki/sources/<slug> path.

**Source File Content:**
{{content}}
{{domain_context}}
{{batch_context}}

**Extraction Scope:**
{{granularity_instruction}}

**Task Requirements:**
0. [FIRST ROUND ONLY] Write a 100-200 word source summary (field: summary) and extract the source title (field: source_title). These fields must NOT appear in later rounds.
1. In EVERY round (including the first), output both "entities" and "concepts" arrays. Use [] when a category has no items. Never omit either array.
2. Optionally generate 1-2 aliases per entity/concept — alternative names, acronyms, translations, or common phrasings. Aliases serve as seeds for page generation and help the model avoid duplicate extractions in later rounds. The aliases field is OPTIONAL in extraction; skip it when no natural alias exists.
3. Output at most {{batch_size}} items (entities + concepts total) this round
3. Write a detailed, informative summary for each item (target 4-6 sentences). Include concrete information: what the entity/concept is, its role/significance in the source, key factual details, and how it relates to other items. Provide enough substance that the summary alone can seed a quality Wiki page
4. For mentions_in_source: quote 2-4 verbatim sentences from the source where this entity/concept appears or is discussed. These quotes are critical — they provide the downstream page generator with source-grounded evidence. Include surrounding context, not just the name mention
4b. OPTIONAL — mentions_with_provenance: for each verbatim quote, you can also output structured provenance with the quote, source_path, source_slug, and extracted_at timestamp. This enables programmatic cross-source Mentions tracking. When omitted, the system auto-generates provenance from mentions_in_source.
4c. CROSS-LANGUAGE TRANSLATION (only when wikiLanguage is different from source language): each entry in mentions_with_provenance may include an optional 'translation' field -- a wiki-language translation of the quote. The 'quote' field itself MUST stay verbatim in the source's original language; translation goes in a separate field. Skip this field entirely when source and wiki languages match.
5. For related_entities and related_concepts: identify entities/concepts mentioned in the same context as this item. These should be other items extracted from this same source file
5b. For coverage: report how the source treats this item — "defined" when the source says what it is, "discussed" when the source says something substantive about it (properties, effects, relationships), "named" when it appears only as an example, in an enumeration, or as a passing mention. Report what the text does; do not decide whether that is enough
5c. For domains (only when a "Domain tag vocabulary of this vault" list is given above): output the subset of that list that describes what this item itself is or belongs to — not merely the context it appears in. Copy the exact spelling from the list, including the part before the "/". Use [] when none applies. Never add a tag that is not in the list; omit the field when no list is given
7. Generate key points from the source file (only output key_points in the first round)

**Output Format (strict JSON, output only JSON, no explanatory text):**
{
  "source_title": "Source file title",
  "summary": "150-250 word source summary (first round only, omitted thereafter)",
  "entities": [
    {
      "name": "Entity name — MUST be in the source's original language, NEVER translate",
      "type": "person|organization|project|product|event|place|other",
      "aliases": ["Optional: 1-2 alternative names, abbreviations, or translations. Helps prevent duplicate extractions in later rounds.", "If provided, these will seed the page aliases."],
      "summary": "Detailed 4-6 sentence description with concrete facts: identity, role/significance, key attributes",
      "mentions_in_source": ["Verbatim sentence from source: '...'.", "Another verbatim quote: '...'."],
      "mentions_with_provenance": [{"quote": "Verbatim sentence from source: '...'.", "translation": "OPTIONAL: <wiki_language> translation only when cross-language wiki", "source_path": "path/to/source.md", "source_slug": "source-slug", "extracted_at": "2026-07-05T00:00:00Z"}],
      "related_entities": ["Related entity names from this source"],
      "related_concepts": ["Related concept names from this source"],
      "coverage": "defined|discussed|named",
      "domains": ["Subset of the vault's domain-tag vocabulary that describes this item itself; [] when none"]
    }
  ],
  "concepts": [
    {
      "name": "Concept name — MUST be in the source's original language, NEVER translate",
      "type": "theory|method|field|phenomenon|standard|term|other",
      "aliases": ["Optional: 1-2 alternative names, abbreviations, or translations. Helps prevent duplicate extractions in later rounds.", "If provided, these will seed the page aliases."],
      "summary": "Detailed 4-6 sentence description with concrete facts: definition, importance, relationships",
      "mentions_in_source": ["Verbatim sentence from source: '...'.", "Another verbatim quote: '...'."],
      "mentions_with_provenance": [{"quote": "Verbatim sentence from source: '...'.", "translation": "OPTIONAL: <wiki_language> translation only when cross-language wiki", "source_path": "path/to/source.md", "source_slug": "source-slug", "extracted_at": "2026-07-05T00:00:00Z"}],
      "related_concepts": ["Related concept names from this source"],
      "related_entities": ["Related entity names from this source"],
      "coverage": "defined|discussed|named",
      "domains": ["Subset of the vault's domain-tag vocabulary that describes this item itself; [] when none"]
    }
  ],
  "key_points": ["Key point 1", "Key point 2"]
}

**Entity Recognition Guide:**
- person: individual who is a significant SUBJECT of the source. Authors cited only as evidence sources ("Smith et al. found...") are NOT wiki-worthy entities
- organization: organization/institution (company, school, team, department, etc.)
- project: project/initiative/program
- product: product/tool/software/service. Publications only when they are the primary subject of analysis, not when cited as evidence sources
- event: event/conference/milestone/historical occurrence
- location: place/region/geographic concept
- other: observable, instantiable concrete things (a specific dataset, benchmark, physical instrument) that do not fit any category above. NOT for abstract ideas, paradigms, or techniques — those are concepts

**Classification Decision Tree (Entity vs. Concept) — apply in order, stop at first match:**
1. Named PERSON → entity (person)
2. Named ORGANIZATION, institution, company, team, lab → entity (organization)
3. Named PROJECT or named initiative → entity (project)
4. Named LOCATION, place, region → entity (location)
5. Named EVENT, conference, competition, release milestone → entity (event)
6. Named PRODUCT with its own vendor/release cycle (specific software package, hardware device, hosted service) → entity (product). Examples: PyTorch, GPT-4, BERT, TensorFlow. BUT if the source is not primarily ABOUT this product, extract its key ideas as concepts instead
7. Abstract THEORY, principle, hypothesis, cognitive/scientific model → concept (theory)
8. Procedural METHOD, algorithm, technique, protocol, training procedure → concept (method). Examples: gradient descent, RLHF, fine-tuning, chain-of-thought prompting, backpropagation
9. Broad TECHNOLOGY paradigm or architectural pattern → concept (technology). Examples: transformer architecture, deep learning, attention mechanism, retrieval-augmented generation
10. Any TERM, definition, or construct explaining how something works → concept (term)
11. A concrete named thing that does not fit rules 1–6 → entity (other). Reserve for observable/instantiable things only
12. If still uncertain → **prefer concept over entity**

**Key boundary**: Named AI models and named frameworks are entities (product). Architectural ideas and learning techniques are concepts (method/technology). When a source mentions a product only as a tool used for something else, extract its role/capabilities as a concept, not the product as an entity.

**Important Rules:**
- Output ONLY JSON, nothing else
- **CRITICAL: Entity and concept "name" MUST use the ORIGINAL language from the source file. NEVER translate names.** If the source says "Yinmin Zhong", the name MUST be "Yinmin Zhong", NOT "钟胤敏". If the source says "Conditional Memory", the name MUST be "Conditional Memory", NOT "条件记忆". If the source says "Cache-Compute Ratio", the name MUST be "Cache-Compute Ratio". Translation of names is FORBIDDEN. Summaries and descriptions may use the wiki language, but the name field is inviolable
- "mentions_in_source" MUST contain 2-4 verbatim quotes from the source text. Do NOT paraphrase — copy the actual sentences where the entity/concept appears. Include full sentences with context, not fragments
- Each entity and concept should have its own independent Wiki page
- Output must be valid JSON format
- Do NOT repeat any item already in the "extracted list". If no unextracted items remain in the source, return empty arrays [] for entities and concepts
- Apply the wiki-link test to every candidate: if an entity/concept would not be linked from other notes, do not extract it. Knowledge claims and findings are more valuable than evidence containers`,

  // Semantic entity resolution: when slug-based matching fails, use LLM to determine
  // whether a newly extracted entity/concept is semantically equivalent to an existing page.
  //
  // Layout constraint: the {{existing_pages}} list MUST stay before the
  // per-call candidate block. The list is the invariant bulk of the prompt;
  // with it first, consecutive dedup calls share a byte-identical prefix and
  // a local KV prefix cache collapses the prefill (~46K tokens) to the short
  // variable suffix. Candidate-first ordering limits the shared prefix to
  // ~200 chars and forfeits the cache entirely.
  resolveEntityDedup: `You are an entity resolution engine. Given a newly extracted entity/concept and a list of existing wiki pages, determine if it is semantically equivalent to any existing page.

**Existing wiki pages (entities and concepts):**
{{existing_pages}}

**New entity/concept:**
- Name: {{entity_name}}
- Type: {{entity_type}}
- Summary: {{entity_summary}}

**Task:** Determine whether the new entity/concept is semantically the SAME as any existing page. Consider:
- Translations between languages (e.g. "清华大学" = "Tsinghua University")
- Abbreviations and full names (e.g. "MIT" = "Massachusetts Institute of Technology")
- Alternative phrasings (e.g. "Supervised Learning" = "Supervised ML")
- Spelling variations

The list can hold pages from both the entities/ and the concepts/ folder. The folder does not decide identity: a page in the other folder is a match when it denotes the same thing (the folder reflects an earlier classification, which may differ for the same referent). But sharing a name is not identity either — an abbreviation can stand for two different things; match only when the summaries describe the same referent. Never match a page about a related, broader, narrower, or component thing — a relationship is not sameness.

When you output a match, also output "classification": whether the referent itself is an entity or a concept under the Classification Rules in the system prompt. Judge this from the definitions alone — not from the folder the matched page currently sits in, which records an earlier call's guess.

**Output JSON:**
- If it matches an existing page, output: {"match": true, "path": "{{wikiFolder}}/entities/existing-slug.md", "classification": "entity" or "concept"}
- If no match exists, output: {"match": false, "path": null}

Do NOT create a new name — only match against the existing pages listed above.`,
};
