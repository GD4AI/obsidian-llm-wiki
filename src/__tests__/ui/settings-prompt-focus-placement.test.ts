import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Prompt customization is content policy, not LLM sampling.
//
// `AGENTS.md` §"Settings panel scope rule" splits the two advanced surfaces: LLM
// sampling and provider overrides go in the Advanced section behind
// `advancedSettingsMode`; every other power-user setting goes in the bottom
// "Advanced settings" panel behind `showAdvancedSettings`. Prompt text is policy,
// so it belongs to the bottom panel — and it is off for a normal user by default,
// which is the property that can regress silently.
//
// The assertion is structural rather than rendered, because the gating lives in
// one early return in the panel renderer, and a render test would need the whole
// Obsidian DOM surface to check one `if`.

const ADVANCED = readFileSync('src/ui/settings-sections/advanced-settings-section.ts', 'utf8');
const WIKI_CONFIG = readFileSync('src/ui/settings-sections/wiki-config-section.ts', 'utf8');

describe('prompt customization lives in the bottom Advanced panel', () => {
  it('renders there and not in Wiki Configuration', () => {
    expect(ADVANCED).toContain('promptFocusSectionName');
    expect(WIKI_CONFIG).not.toContain('promptFocusSectionName');
  });

  it('reads and writes the schema from that panel', () => {
    // The two textareas are views of `schema/config.md`, so the panel needs both
    // halves of the access pair plus the path for its "go to schema" button.
    expect(ADVANCED).toContain('readSection');
    expect(ADVANCED).toContain('writeSection');
    expect(ADVANCED).toContain('getSchemaFilePath');
  });

  it('sits below the showAdvancedSettings gate, so it is closed by default', () => {
    // Order in the file is the mechanism: a line after the early return is gated
    // by it. If the block is ever moved above, this test fails rather than the
    // panel quietly appearing for every user.
    const gate = ADVANCED.indexOf('if (!tempSettings.showAdvancedSettings) return;');
    const panel = ADVANCED.indexOf('promptFocusSectionName');
    expect(gate).toBeGreaterThan(-1);
    expect(panel).toBeGreaterThan(gate);
  });

  it('is not in the LLM Advanced section either', () => {
    // The scope rule is explicit that the LLM Advanced section carries sampling
    // parameters only. This is the edge that would blur it.
    const llmAdvanced = readFileSync('src/ui/settings-sections/advanced-section.ts', 'utf8');
    expect(llmAdvanced).not.toContain('promptFocusSectionName');
  });

  it('keeps the default off', () => {
    const defaults = readFileSync('src/types.ts', 'utf8');
    expect(defaults).toMatch(/showAdvancedSettings:\s*false/);
  });
});
