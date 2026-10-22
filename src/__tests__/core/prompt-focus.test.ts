import { describe, it, expect } from 'vitest';
import {
  getExtractionFocus,
  getContentRequirements,
  buildExtractionFocusSection,
  buildContentRequirementsSection,
  clampPromptFocusText,
  PROMPT_FOCUS_MAX_CHARS,
} from '../../core/prompt-focus';
import { LLMWikiSettings, WikiTopic } from '../../types';

// v1.27.3: topic-scoped prompt customization resolution — mirrors the
// tag-vocab precedence tests (topic override → global → off).

function baseSettings(partial: Partial<LLMWikiSettings> = {}): LLMWikiSettings {
  return {
    wikiFolder: 'wiki/default',
    wikiTopics: [],
    ...partial,
  } as LLMWikiSettings;
}

function topic(partial: Partial<WikiTopic> = {}): WikiTopic {
  return {
    id: 'topic-1',
    name: 'Delta',
    folder: 'wiki/Delta',
    ...partial,
  };
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

  it('topic override wins over global for the active topic folder', () => {
    const settings = baseSettings({
      extractionFocus: 'global focus',
      wikiFolder: 'wiki/Delta',
      wikiTopics: [topic({ extractionFocus: 'topic focus' })],
    });
    expect(getExtractionFocus(settings)).toBe('topic focus');
  });

  it('another topic folder does NOT capture the active topic', () => {
    const settings = baseSettings({
      extractionFocus: 'global focus',
      wikiFolder: 'wiki/other',
      wikiTopics: [topic({ extractionFocus: 'topic focus' })],
    });
    expect(getExtractionFocus(settings)).toBe('global focus');
  });

  it('an explicitly empty topic field overrides a non-empty global (off switch)', () => {
    const settings = baseSettings({
      extractionFocus: 'global focus',
      wikiFolder: 'wiki/Delta',
      wikiTopics: [topic({ extractionFocus: '' })],
    });
    expect(getExtractionFocus(settings)).toBe('');
  });

  it('folder matching tolerates trailing slashes and case-identical paths', () => {
    const settings = baseSettings({
      wikiFolder: 'wiki/Delta/',
      wikiTopics: [topic({ folder: 'wiki/Delta', extractionFocus: 'topic focus' })],
    });
    expect(getExtractionFocus(settings)).toBe('topic focus');
  });
});

describe('getContentRequirements — resolution precedence', () => {
  it('returns empty when nothing is configured', () => {
    expect(getContentRequirements(baseSettings())).toBe('');
  });

  it('topic override wins; global fallback applies elsewhere', () => {
    const settings = baseSettings({
      contentRequirements: 'global reqs',
      wikiFolder: 'wiki/Delta',
      wikiTopics: [topic({ contentRequirements: 'topic reqs' })],
    });
    expect(getContentRequirements(settings)).toBe('topic reqs');
    const elsewhere = { ...settings, wikiFolder: 'wiki/other' };
    expect(getContentRequirements(elsewhere)).toBe('global reqs');
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
