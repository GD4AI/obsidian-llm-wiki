/**
 * Inline citations in academic form.
 *
 * #756 follow-up: the answer carried two kinds of reference and rendered both
 * the same way — a wiki-link at the end of a paragraph and the list at the
 * bottom looked identical. The inline marks are metadata about the sentence;
 * the bottom list is the bibliography. They need different treatments.
 *
 * The inline form is the numeric citation every paper uses: `[1]` at the
 * point of use, a numbered list at the end. The number is assigned in order
 * of first appearance across the whole answer, and a page cited twice gets
 * the same number both times.
 *
 * The rendering is the caller's job. This module is the pure transform:
 * answer text in, cited text and the reference list out.
 */
import { describe, it, expect } from 'vitest';
import { citeAnswer, reformatReferenceList, type Citation } from '../../core/citation-format';

describe('inline citations in academic form (#756 follow-up)', () => {
  it('replaces a wiki-link with its number', () => {
    const out = citeAnswer('MoE helps. [[Kimi K2]] says so.');
    expect(out.text).toContain('[1]');
    expect(out.text).not.toContain('[[Kimi K2]]');
  });

  it('assigns numbers in order of first appearance', () => {
    const out = citeAnswer('[[Alpha]] then [[Beta]] then [[Alpha]] again.');
    expect(out.text).toContain('[1]');
    expect(out.text).toContain('[2]');
    // Alpha is cited twice and keeps its number.
    expect(out.text.match(/\[1\]/g)?.length).toBe(2);
  });

  it('the reference list carries every cited page once', () => {
    const out = citeAnswer('[[Alpha]] then [[Beta]] then [[Alpha]] again.');
    expect(out.references).toHaveLength(2);
    expect(out.references[0].label).toBe('Alpha');
    expect(out.references[1].label).toBe('Beta');
  });

  it('the reference list numbers match the inline numbers', () => {
    const out = citeAnswer('[[Beta]] then [[Alpha]].');
    expect(out.references[0].label).toBe('Beta');
    expect(out.references[0].n).toBe(1);
    expect(out.references[1].label).toBe('Alpha');
    expect(out.references[1].n).toBe(2);
  });

  it('handles a link with an alias: [[path|display]] cites as the display name', () => {
    const out = citeAnswer('See [[entities/kimi-k2|Kimi K2]].');
    expect(out.references[0].label).toBe('Kimi K2');
    expect(out.references[0].path).toBe('entities/kimi-k2');
  });

  it('handles a link with no alias: [[path]] cites as the path tail', () => {
    const out = citeAnswer('See [[entities/kimi-k2]].');
    expect(out.references[0].label).toBe('kimi-k2');
  });

  it('an answer with no citations is unchanged', () => {
    const out = citeAnswer('No links here.');
    expect(out.text).toBe('No links here.');
    expect(out.references).toHaveLength(0);
  });

  it('the same page cited with different aliases gets one number', () => {
    const out = citeAnswer('[[entities/kimi|Kimi]] and [[entities/kimi|K2]].');
    expect(out.references).toHaveLength(1);
    expect(out.text.match(/\[1\]/g)?.length).toBe(2);
  });

  it('picks up citations across paragraphs', () => {
    const out = citeAnswer('First. [[Alpha]]\n\nSecond. [[Beta]]\n\nThird. [[Gamma]].');
    expect(out.references.map(r => r.n)).toEqual([1, 2, 3]);
  });
});

describe('the reference list is metadata about the answer', () => {
  it('each entry carries the number, the label and the path', () => {
    const out = citeAnswer('[[entities/kimi-k2|Kimi K2]].');
    const ref: Citation = out.references[0];
    expect(ref.n).toBe(1);
    expect(ref.label).toBe('Kimi K2');
    expect(ref.path).toBe('entities/kimi-k2');
  });

  it('the number is stable across repeated cites', () => {
    const a = citeAnswer('[[X]] and [[X]].');
    const b = citeAnswer('[[X]] and [[X]].');
    expect(a.references[0].n).toBe(b.references[0].n);
  });
});

describe('the reference list the model wrote is reformatted', () => {
  it('drops the ordered-list marker and adds the page name', () => {
    const refs = [
      { n: 1, label: '标准提示', path: 'entities/standard' },
      { n: 2, label: '思维链提示', path: 'entities/cot' },
    ];
    const section = '1. [1] — 不含推理步骤的对照提示\n2. [2] — CoT 的定义';
    const out = reformatReferenceList(section, refs);
    expect(out).toBe('[1] 标准提示 - 不含推理步骤的对照提示\n[2] 思维链提示 - CoT 的定义');
  });

  it('keeps the number when the model already wrote it', () => {
    const refs = [{ n: 3, label: 'X', path: 'p' }];
    const out = reformatReferenceList('[3] — desc', refs);
    expect(out).toBe('[3] X - desc');
  });

  it('a line with no number passes through', () => {
    expect(reformatReferenceList('some prose', [])).toBe('some prose');
  });
});
