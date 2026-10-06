// #197: fixDeadLink must NOT fabricate AI-expanded stub pages for unresolvable
// dead links. The pre-#164 bug class — empty-source hallucination — reappeared
// through the lint path: a dead forward-reference was being silently replaced
// with an LLM-generated stub that asserted unsourced alias claims (e.g.
// VCAM-1 got the alias "ICAM-2" via this path).
//
// The fix has two layers, both unit-testable at the pure-function level:
//   1. `buildStubContent` produces an honest placeholder (no LLM content).
//      It carries `generation_complete: false` so #170 incomplete-cleaner
//      recognises it as a stub to be filled by a future real ingest.
//   2. `shouldFabricateStubForUnresolvableLink` is the policy gate: it must
//      return FALSE, period — there is no case where the lint path should
//      hand a stub to fillEmptyPage(). This is a one-line guard that protects
//      against future code accidentally re-introducing the regression.

import { describe, it, expect } from 'vitest';
import {
  buildStubContent,
  shouldFabricateStubForUnresolvableLink,
} from '../../../wiki/lint/fix-dead-link';
import { parseFrontmatter } from '../../../core/frontmatter';

describe('fixDeadLink stub construction (#197 — honest placeholders)', () => {
  describe('buildStubContent', () => {
    it('emits generation_complete: false marker so #170 incomplete-cleaner recognises it', () => {
      const out = buildStubContent({
        title: 'EntityX',
        stubType: 'entity',
        wikiFolder: 'wiki',
        referringPageRel: 'entities/SomeSource',
      });
      expect(out).toContain('generation_complete: false');
    });

    it('emits stub: true — the marker that survives the write (S135)', () => {
      const out = buildStubContent({
        title: 'EntityX',
        stubType: 'entity',
        wikiFolder: 'wiki',
        referringPageRel: 'entities/SomeSource',
      });
      expect(out).toContain('stub: true');
    });

    it('body is the placeholder template, NOT LLM-generated content', () => {
      const out = buildStubContent({
        title: 'EntityX',
        stubType: 'entity',
        wikiFolder: 'wiki',
        referringPageRel: 'entities/SomeSource',
      });
      expect(out).toMatch(/# EntityX\s*\n\n> Stub created by Fix Dead Links/);
      // The honest stub must not contain sections that an LLM fill would produce
      expect(out).not.toMatch(/## Description/);
      expect(out).not.toMatch(/## Related Concepts/);
      expect(out).not.toMatch(/## Related Entities/);
    });

    it('records the referring page as the source (best available provenance)', () => {
      const out = buildStubContent({
        title: 'EntityX',
        stubType: 'entity',
        wikiFolder: 'wiki',
        referringPageRel: 'entities/SomeSource',
      });
      // sources points at the referring page — better than nothing, and the
      // placeholder text explicitly notes this is not a real source yet.
      // Emitted as block-style so the v1.25.11 provenance-stamp writer in
      // create-page.ts merges into it instead of appending a duplicate
      // top-level `sources:` key. See issue #399.
      //
      // PR #405 review: wikilink value MUST be double-quoted. Bare
      // `- [[value]]` YAML-parses as a nested flow sequence, not a string,
      // breaking Obsidian's Properties panel + backlinks + graph edges.
      expect(out).toContain('sources:\n  - "[[entities/SomeSource]]"');
    });

    it('produces a concept-shaped stub when stubType is concept', () => {
      const out = buildStubContent({
        title: 'UnknownConcept',
        stubType: 'concept',
        wikiFolder: 'wiki',
        referringPageRel: 'concepts/Source',
      });
      expect(out).toContain('type: concept');
      expect(out).toContain('# UnknownConcept');
    });

    // #808: the shape, not only the value.
    it('writes tags as the block list every other writer emits', () => {
      for (const [stubType, tag] of [['entity', 'other'], ['concept', 'term']] as const) {
        const out = buildStubContent({
          title: 'X',
          stubType,
          wikiFolder: 'wiki',
          referringPageRel: 'entities/SomeSource',
        });
        expect(out).toContain(`\ntags:\n  - "${tag}"\nstub: true\n`);
        expect(parseFrontmatter(out)?.tags).toEqual([tag]);
      }
    });
  });

  describe('shouldFabricateStubForUnresolvableLink (#197 policy gate)', () => {
    it('is FALSE for the LLM "create_stub" branch', () => {
      // fixDeadLink path: LLM responded with action=create_stub. Even though
      // the LLM asks for a stub, we deliberately do NOT let the lint path
      // manufacture one — the dead link is left as-is (honest forward-ref)
      // until a real source defines the target.
      expect(
        shouldFabricateStubForUnresolvableLink({ branch: 'llm-create-stub' })
      ).toBe(false);
    });

    it('is FALSE for the deterministic fallback branch', () => {
      // fixDeadLink path: no alias match found, no LLM match found. Same
      // policy — leave the dead link, do not fabricate.
      expect(
        shouldFabricateStubForUnresolvableLink({ branch: 'deterministic-fallback' })
      ).toBe(false);
    });
  });
});