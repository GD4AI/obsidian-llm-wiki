import { describe, it, expect } from 'vitest';
import {
  getExtractionFocus,
  getContentRequirements,
  buildExtractionFocusSection,
  buildContentRequirementsSection,
  clampPromptFocusText,
  PROMPT_FOCUS_MAX_CHARS,
} from '../../core/prompt-focus';
import { LLMWikiSettings } from '../../types';

// v1.27.3: prompt customization values. The per-topic override layer is not
// tested here because it is not shipped: it had no picker to write a topic and
// no reader for `activeTopicId`, so the only reachable path is the global field.

function baseSettings(partial: Partial<LLMWikiSettings> = {}): LLMWikiSettings {
  return {
    wikiFolder: 'wiki/default',
    ...partial,
  } as LLMWikiSettings;
}

describe('clampPromptFocusText', () => {
  it('trims and passes through short text', () => {
    expect(clampPromptFocusText('  hello  ')).toBe('hello');
  });

  it('returns empty for undefined/blank input', () => {
    expect(clampPromptFocusText(undefined)).toBe('');
    expect(clampPromptFocusText('   ')).toBe('');
  });

  it('caps at PROMPT_FOCUS_MAX_CHARS', () => {
    const long = 'x'.repeat(PROMPT_FOCUS_MAX_CHARS + 100);
    expect(clampPromptFocusText(long)).toHaveLength(PROMPT_FOCUS_MAX_CHARS);
  });
});

describe('getExtractionFocus — resolution precedence', () => {
  it('returns empty when nothing is configured (feature off)', () => {
    const settings = baseSettings();
    expect(getExtractionFocus(settings)).toBe('');
  });

  it('falls back to the global field when no topic is active', () => {
    const settings = baseSettings({ extractionFocus: 'global focus', wikiFolder: 'wiki' });
    expect(getExtractionFocus(settings)).toBe('global focus');
  });

});

describe('getContentRequirements — resolution precedence', () => {
  it('returns empty when nothing is configured', () => {
    expect(getContentRequirements(baseSettings())).toBe('');
  });

  it('returns the configured global value', () => {
    expect(getContentRequirements(baseSettings({ contentRequirements: 'global reqs' }))).toBe('global reqs');
  });
});

describe('prompt section rendering', () => {
  it('extraction-focus section is empty when focus is empty', () => {
    expect(buildExtractionFocusSection('')).toBe('');
  });

  it('extraction-focus section carries the text and the protocol guard', () => {
    const section = buildExtractionFocusSection('weapons and maps');
    expect(section).toContain('weapons and maps');
    expect(section).toContain('does NOT change the JSON protocol');
  });

  it('content-requirements section carries the text and the system-owned guard', () => {
    const section = buildContentRequirementsSection('cite episode numbers');
    expect(section).toContain('cite episode numbers');
    expect(section).toContain('remain binding');
  });

  it('both sections are empty for blank input', () => {
    expect(buildExtractionFocusSection('   ')).toBe('');
    expect(buildContentRequirementsSection('')).toBe('');
  });
});
