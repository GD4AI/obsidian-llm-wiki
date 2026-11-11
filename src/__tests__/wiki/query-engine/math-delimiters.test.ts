// #915: a formula in a Query Wiki answer arrived degraded and unrendered.
//
// The model emits `\( … \)` for inline maths (checked against the raw answer
// kept in the plugin's own query history). Obsidian's renderer treats `$…$`
// and `$$…$$` as maths and leaves `\(…\)` as literal text, so the underscores
// inside the span become ordinary markdown and emphasis parsing eats them —
// that is why `w_{t,j}^{l}` arrived as `w{t,j}^{l}`.
//
// The fix is at render time, on the answer text only.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { normalizeMathDelimiters } from '../../../wiki/query-engine/math-delimiters';

describe('normalizeMathDelimiters (#915)', () => {
  it('rewrites an inline LaTeX span to the delimiter Obsidian renders', () => {
    expect(normalizeMathDelimiters('score \\(x_{t}\\) here')).toBe('score $x_{t}$ here');
  });

  it('rewrites a display span to the delimited Obsidian renders', () => {
    expect(normalizeMathDelimiters('\\[a = b\\]')).toBe('$$a = b$$');
  });

  it('keeps the subscript that emphasis parsing was eating', () => {
    const out = normalizeMathDelimiters('the score \\(I_{t,s} = \\sum_{j=1}^{H^i} w_{t,j}^l\\) is');
    expect(out).toContain('_{t,s}');
    expect(out).toContain('_{j=1}');
    expect(out).toContain('_{t,j}');
    expect(out, 'no opening delimiter survives').not.toContain('\\(');
  });

  it('rewrites the exact span a real answer carried', () => {
    // Verbatim from the plugin's query history (data.json, queryHistory[21]).
    const answer =
      'DSA index score \\(I_{t,s} = \\sum_{j=1}^{H^i} w_{t,j}^l ReLU(q_{t,j}^l · k_s^l)\\). The source page includes.';
    const out = normalizeMathDelimiters(answer);
    expect(out).toBe(
      'DSA index score $I_{t,s} = \\sum_{j=1}^{H^i} w_{t,j}^l ReLU(q_{t,j}^l · k_s^l)$. The source page includes.',
    );
  });

  it('leaves a fenced code block alone, because that text is shown verbatim', () => {
    const md = 'before\n\n```latex\n\\(x_{t}\\) stays\n\\[y\\] stays\n```\n\nafter \\(z\\)';
    const out = normalizeMathDelimiters(md);
    expect(out).toContain('\\(x_{t}\\) stays');
    expect(out).toContain('\\[y\\] stays');
    expect(out, 'the prose span is still converted').toContain('after $z$');
  });

  it('leaves inline code alone', () => {
    const out = normalizeMathDelimiters('write `\\(x\\)` and use \\(y\\)');
    expect(out).toContain('`\\(x\\)`');
    expect(out).toContain('use $y$');
  });

  it('leaves a span that already uses dollar delimiters untouched', () => {
    expect(normalizeMathDelimiters('already $x_{t}$ fine')).toBe('already $x_{t}$ fine');
    expect(normalizeMathDelimiters('$$a = b$$')).toBe('$$a = b$$');
  });

  it('is idempotent, because a re-render runs it again on the same text', () => {
    const once = normalizeMathDelimiters('a \\(x\\) and \\[y\\] and $z$');
    expect(normalizeMathDelimiters(once)).toBe(once);
  });

  it('leaves an unmatched delimiter as text rather than emitting half a span', () => {
    expect(normalizeMathDelimiters('an open \\( with no close')).toBe('an open \\( with no close');
    expect(normalizeMathDelimiters('a close \\) with no open')).toBe('a close \\) with no open');
  });

  it('does not convert an escaped backslash followed by a bracket', () => {
    expect(normalizeMathDelimiters('a literal \\\\( in prose')).toBe('a literal \\\\( in prose');
  });

  it('passes a formula-free answer through unchanged', () => {
    const md = '## References\n\n- [[concepts/x]]\n';
    expect(normalizeMathDelimiters(md)).toBe(md);
  });
});

describe('normalizeMathDelimiters wiring (#915)', () => {
  it('is called on the answer before the markdown pass, once for every answer path', () => {
    // A wiring guard, not a behaviour test. The behaviour is above. Without
    // this, a converter that nobody calls passes every test it has — the
    // failure mode this repository has shipped twice.
    const src = readFileSync('src/wiki/query-engine/QueryView-class.ts', 'utf8');
    const call = src.indexOf('normalizeMathDelimiters(toRender)');
    const render = src.indexOf('MarkdownRenderer.render(');
    expect(call, 'the converter is called').toBeGreaterThan(-1);
    expect(render, 'the markdown pass exists').toBeGreaterThan(-1);
    expect(call, 'and before the pass that would eat the underscores').toBeLessThan(render);
    // Every answer — live, streamed and re-hydrated from history — reaches the
    // markdown pass through one method, so one call covers them all.
    expect(src.match(/MarkdownRenderer\.render\(/g) ?? []).toHaveLength(1);
  });
});
