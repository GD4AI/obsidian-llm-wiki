/**
 * The composer grows with the content.
 *
 * #756: the input block was the same height whether the user typed three
 * characters or three paragraphs. For the common case — a one-line question —
 * that is dead space between the conversation and the buttons, and it
 * compounds the layout squeeze that issue describes.
 *
 * The fix is one line of CSS. `field-sizing: content` is Chromium 123+, Safari
 * 26.2+, and Baseline 2026; Obsidian runs on Electron (Chromium) so it is
 * available. No JavaScript fallback is needed — the plugin does not run on
 * Gecko, and the JS `scrollHeight` pattern costs a layout read on every
 * keystroke for a capability the browser has had since 2024.
 *
 * `min-height: 3lh` sets the default to three lines. `lh` is the line-height
 * unit, so the default tracks the font the user has chosen rather than a
 * pixel count that assumes one. `max-height` caps the growth so a very long
 * question scrolls inside the box instead of pushing the buttons off the
 * bottom of the pane.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', '..', '..', 'styles.css'), 'utf8');

const composerRule = (selector: string): string => {
  const idx = css.indexOf(selector);
  if (idx < 0) return '';
  const open = css.indexOf('{', idx);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
};

describe('the composer grows with the content (#756)', () => {
  it('uses field-sizing: content so the browser sizes the textarea', () => {
    const rule = composerRule('.llm-wiki-query-textarea');
    expect(rule).toContain('field-sizing: content');
  });

  it('defaults to three lines, not a pixel count', () => {
    const rule = composerRule('.llm-wiki-query-textarea');
    // `lh` tracks the user's font. A pixel count assumes one font size and
    // gets it wrong for anyone who changed it.
    expect(rule).toMatch(/min-height:\s*3lh/);
  });

  it('caps the growth so long input scrolls rather than pushes the buttons', () => {
    const rule = composerRule('.llm-wiki-query-textarea');
    expect(rule).toMatch(/max-height:\s*\d/);
  });

  it('no longer carries the old 150px minimum', () => {
    const rule = composerRule('.llm-wiki-query-textarea');
    expect(rule).not.toMatch(/min-height:\s*150px/);
  });
});

describe('the inline citation links are quieter than the prose (#756)', () => {
  it('the answer body\'s inline links are smaller than the body', () => {
    const rule = composerRule('.llm-wiki-answer-modal a.internal-link');
    expect(rule).toMatch(/font-size:\s*0\.\d+em/);
  });

  it('they carry a lower saturation than the reference list at the bottom', () => {
    // Two rules, two saturations. The inline marks are metadata about the
    // sentence; the bottom list is the full-strength link colour. The two
    // must not compete.
    const inline = composerRule('.llm-wiki-answer-modal a.internal-link');
    const list = composerRule('.llm-wiki-answer-references a');
    expect(inline).toMatch(/opacity:\s*0\.\d+/);
    // The reference list does not carry the same opacity.
    if (list) expect(list).not.toMatch(/opacity:\s*0\.\d+/);
  });

  it('keeps the underline (the accessibility affordance)', () => {
    const rule = composerRule('.llm-wiki-answer-modal a.internal-link');
    expect(rule).toMatch(/text-decoration:\s*(underline|auto)/);
  });
});
