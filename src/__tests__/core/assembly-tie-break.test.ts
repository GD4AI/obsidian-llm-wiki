/**
 * The assembler must not undo the fusion's tie-break.
 *
 * `maxFuse` resolves a tie by channel index: the lexical channel's pick comes
 * first. `assembleWithCoverage` re-sorts by `item.key` alphabetically, which
 * throws that decision away. Two pages that the fusion scored exactly the
 * same come out of the assembler in dictionary order, so the page the fusion
 * chose is not the page the assembler returns.
 *
 * Measured on eight scripts of the Obsidian help vault before this fix:
 * self-retrieval MRR 0.785-0.830 instead of 1.000. Removing the one
 * comparison takes every script to 1.000.
 *
 * The contract: when two candidates carry the same score and tier, the
 * assembler returns them in the order the fusion produced.
 */
import { describe, it, expect } from 'vitest';
import { maxFuse, assembleWithCoverage } from '../../core/assembly';

const tieCandidates = () => {
  // Each page is rank 1 in one channel and rank 2 in the other, so the two
  // fuse to exactly the same score.
  const lex = {
    channel: 'lex',
    candidates: [
      { item: { key: 'zzz-target', sourceSlug: 'a' }, rank: 1 },
      { item: { key: 'aaa-other', sourceSlug: 'a' }, rank: 2 },
    ],
  };
  const ppr = {
    channel: 'ppr',
    candidates: [
      { item: { key: 'aaa-other', sourceSlug: 'a' }, rank: 1 },
      { item: { key: 'zzz-target', sourceSlug: 'a' }, rank: 2 },
    ],
  };
  return maxFuse([lex, ppr]);
};

describe('the assembler preserves the fusion\'s tie-break', () => {
  it('the fixture really is a tie', () => {
    const fused = tieCandidates();
    expect(fused).toHaveLength(2);
    expect(fused[0].score).toBe(fused[1].score);
  });

  it('maxFuse breaks the tie by channel index (lexical first)', () => {
    const fused = tieCandidates();
    // `zzz-target` is lex rank 1, so it wins the tie.
    expect(fused[0].item.key).toBe('zzz-target');
  });

  it('assembleWithCoverage keeps that order', () => {
    const fused = tieCandidates();
    const assembled = assembleWithCoverage(
      fused.map(f => ({ item: { ...f.item, tier: 0 }, score: f.score })),
      2,
    );
    expect(assembled.picked.map(p => p.item.key)).toEqual(['zzz-target', 'aaa-other']);
  });

  it('does not sort by key when the scores differ', () => {
    // A real ordering decision must survive the fix. Unequal scores sort by
    // score, not by input order and not by key.
    const fused = maxFuse([
      { channel: 'lex', candidates: [{ item: { key: 'zzz-high', sourceSlug: 'a' }, rank: 1 }] },
      { channel: 'ppr', candidates: [{ item: { key: 'aaa-low', sourceSlug: 'a' }, rank: 5 }] },
    ]);
    const assembled = assembleWithCoverage(
      fused.map(f => ({ item: { ...f.item, tier: 0 }, score: f.score })),
      2,
    );
    expect(assembled.picked[0].item.key).toBe('zzz-high');
  });
});
