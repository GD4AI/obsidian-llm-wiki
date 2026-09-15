import { describe, it, expect } from 'vitest';
import { buildDefaultSchemaBody, stripLegacyBakedTagEnum } from '../../schema/schema-manager';
import { VALID_ENTITY_TAGS, VALID_CONCEPT_TAGS } from '../../types';
import type { LLMWikiSettings } from '../../types';

// For the runtime-header pin test, we cross-import the section builder
// so the test catches the case where the runtime header is renamed
// without updating the schema body's Classification Rules pointer.
import { buildActiveTagVocabularySection } from '../../wiki/system-prompts';

// Issue #328 Phase 1: the active tag vocabulary is the Settings-derived runtime
// state. It MUST NOT be baked into `schema/config.md`. The runtime injection
// layer (buildActiveTagVocabularySection in src/wiki/system-prompts.ts) is the
// single authoritative source — schema body must reference it, not duplicate it.
//
// These tests are the Phase 1 contract. They replace the v1.22.0 Phase 2 tests
// in default-schema.test.ts (which asserted the OPPOSITE: that custom tags WERE
// baked into the body). Phase 2's contract has been permanently reversed; this
// file is the new home for "schema body holds no tag enum" assertions.
//
// The default tag vocabularies are imported from src/types.ts (the single
// source of truth) rather than copied: if upstream adds or removes a default
// subtype, the assertions below automatically follow.

function mkSettings(overrides: Partial<LLMWikiSettings> = {}): LLMWikiSettings {
  return {
    wikiFolder: 'wiki',
    wikiLanguage: 'en',
    extractionGranularity: 'standard',
    customEntityTags: '',
    customConceptTags: '',
    tagVocabularyMode: 'default',
    ...overrides,
  } as LLMWikiSettings;
}

describe('buildDefaultSchemaBody — runtime-injection contract (Issue #328 Phase 1)', () => {
  it('does NOT bake the default entity tag list into Wiki Structure or Entity Page Template', () => {
    // Default mode + no custom tags. The hardcoded VALID_ENTITY_TAGS must
    // not appear in either the Wiki Structure bullet or the Entity Page
    // Template `tags:` field. (Two assertions because Phase 1 touches both.)
    const body = buildDefaultSchemaBody();

    // Wiki Structure: - Entity pages: `entities/` (...) — the parenthetical
    // used to interpolate ${entityList}. The cooked comma-joined default
    // list is the signature.
    const wikiMatch = body.match(/## Wiki Structure[\s\S]*?(?=\n## |\s*$)/);
    expect(wikiMatch).not.toBeNull();
    expect(wikiMatch![0]).not.toMatch(/person,\s*organization,\s*project/);

    // Entity Page Template tags: field — used to say
    // "MUST be one of: ${entityList}". Now MUST NOT contain the cooked list.
    const entityMatch = body.match(/## Entity Page Template[\s\S]*?(?=\n## |\s*$)/);
    expect(entityMatch).not.toBeNull();
    expect(entityMatch![0]).not.toMatch(/MUST be one of:[^.\n]*person,\s*organization/);
  });

  it('does NOT bake the default concept tag list into Wiki Structure or Concept Page Template', () => {
    const body = buildDefaultSchemaBody();

    const wikiMatch = body.match(/## Wiki Structure[\s\S]*?(?=\n## |\s*$)/);
    expect(wikiMatch).not.toBeNull();
    expect(wikiMatch![0]).not.toMatch(/theory,\s*method,\s*field/);

    const conceptMatch = body.match(/## Concept Page Template[\s\S]*?(?=\n## |\s*$)/);
    expect(conceptMatch).not.toBeNull();
    expect(conceptMatch![0]).not.toMatch(/MUST be one of:[^.\n]*theory,\s*method/);
  });

  it('does NOT bake custom entity tags into the schema body (#328 Phase 1 reverses Phase 2 contract)', () => {
    // v1.22.0 Phase 2 asserted that customEntityTags WOULD land in the body
    // ("Medical_Arzneimittel appears"). Phase 1 deletes that assertion —
    // settings changes no longer touch schema files. The runtime layer is
    // the only authoritative source for the active vocabulary.
    const custom = mkSettings({
      tagVocabularyMode: 'custom',
      customEntityTags: 'person, organization, Medical_Arzneimittel',
    });
    const body = buildDefaultSchemaBody(custom);
    expect(body).not.toContain('Medical_Arzneimittel');
    // No subset of the custom list leaked through either: the slash-bearing
    // sentinel prevents a future contributor's "substring match" bypass.
    expect(body).not.toMatch(/Medical_Arzneimittel|Kardiologie|Immunologie/);
  });

  it('does NOT bake custom concept tags into the schema body', () => {
    const custom = mkSettings({
      tagVocabularyMode: 'custom',
      customConceptTags: 'Kardiologie, Arzneimittel/Neurologie',
    });
    const body = buildDefaultSchemaBody(custom);
    expect(body).not.toContain('Kardiologie');
    expect(body).not.toContain('Arzneimittel/Neurologie');
  });

  it('Classification Rules section explicitly references runtime injection (no baked enum)', () => {
    // Phase 1 contract: the schema file must NOT bake any tag enum, and the
    // Classification Rules section must be the canonical pointer to runtime
    // injection. Any future contributor re-baking enum would need to defeat
    // both the not-contains assertion above AND this explicit handoff.
    const body = buildDefaultSchemaBody();

    const classMatch = body.match(/## Classification Rules[\s\S]*?(?=\n## |\s*$)/);
    expect(classMatch).not.toBeNull();
    const section = classMatch![0];

    // The section must mention the Active Tag Vocabulary surface that the
    // runtime injection layer produces. Loose match on case + whitespace.
    expect(section).toMatch(/Active Tag Vocabulary/);

    // And it must NOT contain any baked-in enum (no `Entity subtypes` /
    // `Concept subtypes` followed by a comma-joined list of the defaults).
    expect(section).not.toMatch(/Entity subtypes[\s\S]*?person,\s*organization/);
    expect(section).not.toMatch(/Concept subtypes[\s\S]*?theory,\s*method/);
  });

  it('default body never contains a comma-joined enum of the active entity or concept tags', () => {
    // Catch-all: covers every default tag name in one assertion. A future
    // contributor who tries to re-bake enum will trip this no matter which
    // subset they pick.
    //
    // Why this is the right shape:
    //   - The actual harm Phase 1 prevents is "LLM sees the tag list
    //     TWICE" — once baked into schema body, once injected at runtime.
    //     That harm requires a comma-joined string of subtypes.
    //   - Individual English uses of words like "other" (e.g. "no inbound
    //     links from other wiki pages") are not tag-list leakage and
    //     should not trip the assertion — the previous \b based check
    //     was a false-positive trap.
    //
    // The regex looks for a comma-joined sequence of at least 3 default
    // tags within a single non-newline span, in either entity or concept
    // position. Both default lists interleave with arbitrary other words,
    // so the substring must be a contiguous sequence.
    const body = buildDefaultSchemaBody();
    // Quantifier {1,} means 1+ comma-followed tags, i.e. any contiguous
    // comma-joined list of 2 or more default tags trips. This catches
    // both the full default list AND a truncated 2-element leak (e.g.
    // an LLM-generated or hand-edited schema body that bakes only a
    // partial list — the predecessor quantifier {2,} missed these).
    const entityRegex = new RegExp(
      `\\b(${VALID_ENTITY_TAGS.join('|')})(,\\s*(${VALID_ENTITY_TAGS.join('|')})){1,}`
    );
    const conceptRegex = new RegExp(
      `\\b(${VALID_CONCEPT_TAGS.join('|')})(,\\s*(${VALID_CONCEPT_TAGS.join('|')})){1,}`
    );
    expect(body).not.toMatch(entityRegex);
    expect(body).not.toMatch(conceptRegex);
  });

  it('body stays consistent across settings permutations (param is unused since Phase 1)', () => {
    // Phase 1 keeps the settings parameter for backwards compatibility (so
    // ensureSchemaExists / regenerateDefaultSchema callers don't churn),
    // but settings MUST NOT influence the body any more. Two settings objects
    // with wildly different tag inventories must produce byte-identical
    // bodies.
    const a = mkSettings({
      tagVocabularyMode: 'custom',
      customEntityTags: 'Kardiologie, Immunologie',
      customConceptTags: 'Medizin',
    });
    const b = mkSettings({
      tagVocabularyMode: 'default',
      customEntityTags: 'ignored',
      customConceptTags: 'ignored',
    });
    expect(buildDefaultSchemaBody(a)).toBe(buildDefaultSchemaBody(b));
  });
});

// === stripLegacyBakedTagEnum (in-memory schema sanitization) ===
//
// Existing user vaults created under v1.22.0-v1.25.1 carry a baked tag
// enum in the Classification Rules section. loadSchema() now sanitizes
// that view in-memory before the LLM sees it — the on-disk file is not
// touched. These tests pin the sanitization contract.
describe('stripLegacyBakedTagEnum (legacy schema body, in-memory)', () => {
  it('replaces the legacy v1.22.0+ baked entity subtype bullet with a runtime pointer', () => {
    const legacy = `## Classification Rules
- type field: foo
- Entity subtypes (valid tags for type=entity): ${VALID_ENTITY_TAGS.join(', ')}
- Source types: document
`;
    const sanitized = stripLegacyBakedTagEnum(legacy);
    expect(sanitized).not.toContain(VALID_ENTITY_TAGS[0]); // sentinel — first default tag leaked
    expect(sanitized).not.toMatch(/Entity subtypes \(valid tags for type=entity\):/);
    expect(sanitized).toMatch(/Entity subtypes: see the \*\*Active Tag Vocabulary\*\*/);
  });

  it('replaces the legacy v1.22.0+ baked concept subtype bullet with a runtime pointer', () => {
    const legacy = `## Classification Rules
- Concept subtypes (valid tags for type=concept): ${VALID_CONCEPT_TAGS.join(', ')}
`;
    const sanitized = stripLegacyBakedTagEnum(legacy);
    expect(sanitized).not.toMatch(/Concept subtypes \(valid tags for type=concept\):/);
    expect(sanitized).toMatch(/Concept subtypes: see the \*\*Active Tag Vocabulary\*\*/);
  });

  it('replaces both entity and concept bullets in the same body', () => {
    const legacy = `## Classification Rules
- Entity subtypes (valid tags for type=entity): a, b, c
- Concept subtypes (valid tags for type=concept): x, y, z
- Source types: document
`;
    const sanitized = stripLegacyBakedTagEnum(legacy);
    expect(sanitized).not.toMatch(/Entity subtypes \(valid tags for type=entity\):/);
    expect(sanitized).not.toMatch(/Concept subtypes \(valid tags for type=concept\):/);
    expect(sanitized).toMatch(/Source types: document/); // unrelated lines preserved
  });

  it('returns the body byte-for-byte unchanged when no legacy fingerprints are present', () => {
    // The freshly-generated body from buildDefaultSchemaBody() must NOT
    // be mutated by sanitize — fast path. Test this with the canonical
    // output of buildDefaultSchemaBody() to pin "sanitize is a no-op
    // on already-clean bodies".
    const cleanBody = buildDefaultSchemaBody();
    expect(stripLegacyBakedTagEnum(cleanBody)).toBe(cleanBody);
  });

  it('is idempotent — running sanitize on an already-sanitized body is a no-op', () => {
    const legacy = `## Classification Rules
- Entity subtypes (valid tags for type=entity): a, b, c
- Concept subtypes (valid tags for type=concept): x, y, z
`;
    const once = stripLegacyBakedTagEnum(legacy);
    const twice = stripLegacyBakedTagEnum(once);
    expect(twice).toBe(once);
  });

  it('leaves non-Classification-Rules sections untouched (no over-eager rewrite)', () => {
    // A user could have an unrelated sentence that happens to mention
    // "Entity subtypes" elsewhere. Sanitize must only touch the legacy
    // fingerprint pattern, not blanket-strip the words.
    const body = `## Wiki Structure
- Entity subtypes and Concept subtypes are documented below.

## Classification Rules
- Entity subtypes (valid tags for type=entity): a, b, c
`;
    const sanitized = stripLegacyBakedTagEnum(body);
    // Wiki Structure sentence survives
    expect(sanitized).toMatch(/Entity subtypes and Concept subtypes are documented below\./);
    // Classification Rules legacy line is gone
    expect(sanitized).not.toMatch(/Entity subtypes \(valid tags for type=entity\):/);
  });

  // === Wiki Structure + Page Template fixtures (#328 Phase 1, code-review
  //     finding #1: the sanitizer must hit ALL 6 legacy sites, not just
  //     Classification Rules). ===
  it('replaces the legacy Wiki Structure entity parenthetical with a runtime pointer', () => {
    const legacy = `## Wiki Structure\n- Entity pages: \`entities/\` (${VALID_ENTITY_TAGS.join(', ')})\n- Concept pages: \`concepts/\` — already-clean pointer (do NOT match this form)\n- Source pages: \`sources/\`\n`;
    const sanitized = stripLegacyBakedTagEnum(legacy);
    expect(sanitized).not.toContain(VALID_ENTITY_TAGS[0]);
    expect(sanitized).not.toMatch(/Entity pages: `entities\/` \([^)]*\)/);
    expect(sanitized).toMatch(/Entity pages: `entities\/` — entity subtype tags are runtime-injected/);
    // Concept line was a non-sanitizable clean pointer; survives verbatim
    expect(sanitized).toMatch(/Concept pages: `concepts\/` — already-clean pointer/);
  });

  it('replaces the legacy Wiki Structure concept parenthetical with a runtime pointer', () => {
    const legacy = `## Wiki Structure\n- Entity pages: \`entities/\` (person, organization)\n- Concept pages: \`concepts/\` (${VALID_CONCEPT_TAGS.join(', ')})\n`;
    const sanitized = stripLegacyBakedTagEnum(legacy);
    expect(sanitized).not.toContain(VALID_CONCEPT_TAGS[0]);
    expect(sanitized).not.toMatch(/Concept pages: `concepts\/` \([^)]*\)/);
    expect(sanitized).toMatch(/Concept pages: `concepts\/` — concept subtype tags are runtime-injected/);
  });

  it('replaces the legacy Entity Page Template MUST-be-one-of line with a runtime pointer', () => {
    const legacy = `**Frontmatter fields:**
- \`type: entity\` — page category
- \`tags:\` — entity subtype, MUST be one of: ${VALID_ENTITY_TAGS.join(', ')}
- \`aliases:\` (optional) — alternative names
`;
    const sanitized = stripLegacyBakedTagEnum(legacy);
    expect(sanitized).not.toContain(VALID_ENTITY_TAGS[0]);
    expect(sanitized).not.toMatch(/MUST be one of:/);
    expect(sanitized).toMatch(/`tags:` — entity subtype; the valid values are runtime-injected by the \*\*Active Tag Vocabulary\*\*/);
    // Other frontmatter field lines are preserved (separate lines, separate anchors)
    expect(sanitized).toMatch(/`aliases:` \(optional\) — alternative names/);
  });

  it('replaces the legacy Concept Page Template MUST-be-one-of line with a runtime pointer', () => {
    const legacy = `**Frontmatter fields:**
- \`type: concept\` — page category
- \`tags:\` — concept subtype, MUST be one of: ${VALID_CONCEPT_TAGS.join(', ')}
`;
    const sanitized = stripLegacyBakedTagEnum(legacy);
    expect(sanitized).not.toContain(VALID_CONCEPT_TAGS[0]);
    expect(sanitized).not.toMatch(/MUST be one of:/);
    expect(sanitized).toMatch(/`tags:` — concept subtype; the valid values are runtime-injected/);
  });

  it('replaces ALL six legacy sites in a single body (full legacy vault fixture)', () => {
    // Composite: a minimal but complete legacy schema body containing all
    // six baked-enum sites. After sanitize, none of the 6 should contain
    // any actual tag name; all should reference the runtime layer.
    const legacy = `# Wiki Schema Configuration

## Wiki Structure
- Entity pages: \`entities/\` (${VALID_ENTITY_TAGS.join(', ')})
- Concept pages: \`concepts/\` (${VALID_CONCEPT_TAGS.join(', ')})
- Source pages: \`sources/\`

## Entity Page Template
**Frontmatter fields:**
- \`type: entity\` — page category
- \`tags:\` — entity subtype, MUST be one of: ${VALID_ENTITY_TAGS.join(', ')}

## Concept Page Template
**Frontmatter fields:**
- \`type: concept\` — page category
- \`tags:\` — concept subtype, MUST be one of: ${VALID_CONCEPT_TAGS.join(', ')}

## Classification Rules
- Entity subtypes (valid tags for type=entity): ${VALID_ENTITY_TAGS.join(', ')}
- Concept subtypes (valid tags for type=concept): ${VALID_CONCEPT_TAGS.join(', ')}
`;
    const sanitized = stripLegacyBakedTagEnum(legacy);
    // No legacy tag name leaks through.
    for (const t of VALID_ENTITY_TAGS) {
      expect(sanitized).not.toMatch(new RegExp(`\\b${t}\\b`));
    }
    for (const t of VALID_CONCEPT_TAGS) {
      expect(sanitized).not.toMatch(new RegExp(`\\b${t}\\b`));
    }
    // All 6 sites were replaced (the precise count of "Active Tag Vocabulary"
    // pointers matches the 6 legacy fingerprints).
    const runtimeRefs = sanitized.match(/runtime-injected|Active Tag Vocabulary/g) ?? [];
    expect(runtimeRefs.length).toBeGreaterThanOrEqual(6);
  });
});

// === Cross-layer seam pin (Issue #328 Phase 1) ===
//
// The schema body's Classification Rules section tells the LLM to
// consult "the Active Tag Vocabulary section". That section is the
// runtime-injected header produced by buildActiveTagVocabularySection.
// If the runtime header is renamed in the future without updating
// the schema pointer, the LLM is told to consult a section that no
// longer exists.
//
// These tests pin BOTH sides of the contract.
describe('schema ↔ runtime header contract (#328 Phase 1)', () => {
  it('schema body Classification Rules points at "Active Tag Vocabulary"', () => {
    const body = buildDefaultSchemaBody();
    expect(body).toMatch(/## Classification Rules[\s\S]*?Active Tag Vocabulary/);
  });

  it('runtime buildActiveTagVocabularySection header contains "Active Tag Vocabulary"', () => {
    // Cross-layer pin: a future contributor renaming the runtime header
    // would now need to update BOTH this test AND keep the schema body
    // pointing to the renamed header. The two contracts are coupled.
    const settings = mkSettings();
    const section = buildActiveTagVocabularySection(settings);
    expect(section).toMatch(/## Active Tag Vocabulary/);
  });
});

describe('buildActiveTagVocabularySection — renders the one vocabulary when given', () => {
  it('lists the harvested lists instead of the settings list, and names the source-page rule', () => {
    const section = buildActiveTagVocabularySection(
      mkSettings({ tagVocabularyMode: 'custom', customEntityTags: 'Sorte/Erkrankung' }),
      { entities: ['Sorte/Erkrankung', 'Sorte/Organisation'], concepts: ['Sorte/Mechanismus'] },
    );
    expect(section).toContain('- Sorte/Organisation');
    expect(section).toContain('- Sorte/Mechanismus');
    expect(section).toMatch(/Source pages:.*form value/);
  });
});
