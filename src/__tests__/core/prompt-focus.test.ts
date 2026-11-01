import { describe, it, expect } from 'vitest';
import { clampPromptFocusText, PROMPT_FOCUS_MAX_CHARS } from '../../core/prompt-focus';

// v1.27.3 prompt customization.
//
// **These values are Schema sections, not settings.** `## Extraction Focus` and
// `## Content Rules` live in `schema/config.md`, and `TASK_SECTIONS` routes them
// to analyze / entity / concept / merge. A settings copy was rejected on
// 2026-10-30: two stores for one instruction, with no precedence rule between
// the two blocks the model receives.
//
// So this file no longer tests prompt rendering — there is nothing left to
// render. What is left to test is the input guard the Settings editor applies
// before it writes a section, and that the two sections are actually routed.
// The routing half lives in `schema-section-routing.test.ts`.

describe('clampPromptFocusText', () => {
  it('trims and returns the text unchanged when it is in range', () => {
    expect(clampPromptFocusText('  cite the source  ')).toBe('cite the source');
  });

  it('treats undefined and whitespace-only as empty, not as a value', () => {
    // Empty is the documented "this section does nothing" state, and the
    // schema's own default for `## Extraction Focus` is empty.
    expect(clampPromptFocusText(undefined)).toBe('');
    expect(clampPromptFocusText('')).toBe('');
    expect(clampPromptFocusText('   \n\t ')).toBe('');
  });

  it('cuts at the cap rather than rejecting, so a long paste is kept partially', () => {
    // Rejecting would silently drop an edit the user just made. Cutting keeps
    // the beginning, which is where an instruction puts its point.
    const long = 'x'.repeat(PROMPT_FOCUS_MAX_CHARS + 250);
    expect(clampPromptFocusText(long)).toHaveLength(PROMPT_FOCUS_MAX_CHARS);
  });

  it('keeps a value that is exactly at the cap', () => {
    const exact = 'y'.repeat(PROMPT_FOCUS_MAX_CHARS);
    expect(clampPromptFocusText(exact)).toHaveLength(PROMPT_FOCUS_MAX_CHARS);
  });
});
