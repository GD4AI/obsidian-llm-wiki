import { describe, it, expect } from 'vitest';
import { GENERATION_PROMPTS } from '../../../wiki/prompts/generation';
import { renderTemplate } from '../../../core/template-renderer';
import { buildContentRequirementsSection } from '../../../core/prompt-focus';

// v1.27.3: {{content_requirements}} placeholder contract — the two
// page-generation templates carry the optional block, and rendering with
// an empty value must leave a byte-identical prompt shape (no dangling
// placeholder, no stray blank-section markers).

describe('generation templates — content requirements placeholder (v1.27.3)', () => {
  it('generateEntityPage carries the {{content_requirements}} placeholder', () => {
    expect(GENERATION_PROMPTS.generateEntityPage).toContain('{{content_requirements}}');
  });

  it('generateConceptPage carries the {{content_requirements}} placeholder', () => {
    expect(GENERATION_PROMPTS.generateConceptPage).toContain('{{content_requirements}}');
  });

  it('rendering with empty requirements leaves no placeholder behind', () => {
    for (const tpl of [GENERATION_PROMPTS.generateEntityPage, GENERATION_PROMPTS.generateConceptPage]) {
      const rendered = renderTemplate(tpl, { content_requirements: '' });
      expect(rendered).not.toContain('{{content_requirements}}');
    }
  });

  it('rendering with configured requirements injects the full section text', () => {
    const section = buildContentRequirementsSection('cite the episode number');
    expect(section).toContain('cite the episode number');
    for (const tpl of [GENERATION_PROMPTS.generateEntityPage, GENERATION_PROMPTS.generateConceptPage]) {
      const rendered = renderTemplate(tpl, { content_requirements: section });
      expect(rendered).toContain('cite the episode number');
      expect(rendered).not.toContain('{{content_requirements}}');
    }
  });
});
