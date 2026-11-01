import { describe, it, expect } from 'vitest';
import {
  calculateBatchLimits,
  adjustBatchSizeForResponse,
  getCustomTypeCaps,
  GRANULARITY_CONFIG,
} from '../../core/batch-limits';

describe('Batch Limits — Pure Functions', () => {
  describe('calculateBatchLimits', () => {
    it('returns standard config by default', () => {
      const result = calculateBatchLimits(25000); // Long content to avoid downgrade

      expect(result.initialBatchSize).toBe(20);
      expect(result.maxTotalItems).toBe(50);
      expect(result.minBatchSize).toBe(5);
    });

    it('scales batches with content length', () => {
      const short = calculateBatchLimits(1000);
      const medium = calculateBatchLimits(10000);
      const long = calculateBatchLimits(50000);

      expect(short.maxBatches).toBeLessThan(medium.maxBatches);
      expect(medium.maxBatches).toBeLessThanOrEqual(long.maxBatches);
    });

    it('caps max batches at 3x base', () => {
      const veryLong = calculateBatchLimits(100000);
      expect(veryLong.maxBatches).toBe(18); // 6 * 3 for standard
    });

    it('ensures minimum 2 batches', () => {
      const veryShort = calculateBatchLimits(100);
      expect(veryShort.maxBatches).toBeGreaterThanOrEqual(2);
    });

    it('handles fine granularity', () => {
      const result = calculateBatchLimits(25000, 'fine'); // Long content to avoid downgrade
      expect(result.initialBatchSize).toBe(30);
      expect(result.maxTotalItems).toBe(100);
    });

    it('handles coarse granularity', () => {
      const result = calculateBatchLimits(10000, 'coarse');
      expect(result.initialBatchSize).toBe(10);
      expect(result.maxTotalItems).toBe(10);
    });

    it('handles minimal granularity', () => {
      const result = calculateBatchLimits(10000, 'minimal');
      expect(result.initialBatchSize).toBe(5);
      expect(result.maxTotalItems).toBe(5);
    });

    it('handles custom granularity', () => {
      const result = calculateBatchLimits(10000, 'custom');
      expect(result.initialBatchSize).toBe(5);
      expect(result.maxTotalItems).toBeNull();
    });

    it('standard granularity ignores customLimits', () => {
      const result = calculateBatchLimits(100000, 'standard', { entityCap: 300, conceptCap: 300 });
      expect(result.initialBatchSize).toBe(GRANULARITY_CONFIG.standard.initialBatchSize);
      expect(result.maxTotalItems).toBe(GRANULARITY_CONFIG.standard.maxTotalItems);
    });

    it('custom granularity default (no customLimits) stays small', () => {
      const result = calculateBatchLimits(100000, 'custom');
      expect(result.initialBatchSize).toBe(5);
      expect(result.maxBatches).toBeGreaterThanOrEqual(2);
    });

    it('custom granularity scales batchSize to match user caps (300+300)', () => {
      const result = calculateBatchLimits(634212, 'custom', { entityCap: 300, conceptCap: 300 });
      // totalCap = 600 → batchSize should be 50 (capped), maxBatchesBase = ceil(600/50) = 12
      expect(result.initialBatchSize).toBe(50);
      expect(result.maxBatches).toBeGreaterThanOrEqual(12); // min(12*3, 319) = 36
    });

    it('custom granularity scales moderately for medium caps (50+50)', () => {
      const result = calculateBatchLimits(100000, 'custom', { entityCap: 50, conceptCap: 50 });
      // totalCap = 100 → batchSize = min(50, max(10, 100)) = 50, maxBatchesBase = ceil(100/50) = 2
      expect(result.initialBatchSize).toBe(50);
      expect(result.maxBatches).toBeGreaterThanOrEqual(2);
    });

    it('custom granularity stays conservative for small caps (5+5)', () => {
      const result = calculateBatchLimits(100000, 'custom', { entityCap: 5, conceptCap: 5 });
      // #567 changed this from `toBe(5)`. The ceiling is 10, so a round asking
      // for 10 cannot over-generate; what the old assertion protected was "do
      // not ask for 50 when the user keeps 10", and that is what is kept.
      expect(result.initialBatchSize).toBeLessThanOrEqual(10);
      expect(result.initialBatchSize).toBeLessThan(50);
    });

    // Issue #567. The setting reads as a ceiling, and since v1.18.2 it is one:
    // the extraction is hard-sliced to it. But the same number was also the
    // per-round ask, and `detectConvergence` divides the yield by the ask. So a
    // generous ceiling made every round ask for more, every yield ratio lower,
    // and the note stopped sooner — raising a limit produced less output.
    //
    // The reading confirmed with @DocTpoint on 2026-08-28 is ceiling-only: the
    // ask comes from the text, the cap stays a cap. These tests are written from
    // that contract, not from the current formula.
    describe('#567 — the ceiling must not size the ask', () => {
      it('asks for the same amount whatever the ceiling is', () => {
        // The reported defect in one assertion. Between 11 and 50 the ask WAS
        // the ceiling, so this equality could not hold.
        const small = calculateBatchLimits(6800, 'custom', { entityCap: 15, conceptCap: 15 });
        const large = calculateBatchLimits(6800, 'custom', { entityCap: 50, conceptCap: 50 });

        expect(small.initialBatchSize).toBe(large.initialBatchSize);
      });

      it('sizes the ask from the content, so a longer note asks for more', () => {
        const short = calculateBatchLimits(3000, 'custom', { entityCap: 20, conceptCap: 20 });
        const long = calculateBatchLimits(20000, 'custom', { entityCap: 20, conceptCap: 20 });

        expect(long.initialBatchSize).toBeGreaterThan(short.initialBatchSize);
      });

      it('never asks for more than the ceiling, because the excess is sliced away', () => {
        // Asking for 50 when the ceiling is 10 can only produce items that get
        // dropped at the hard slice. Clamping down is the safe direction; it is
        // the growth with the ceiling that was the defect.
        const tiny = calculateBatchLimits(60000, 'custom', { entityCap: 5, conceptCap: 5 });

        expect(tiny.initialBatchSize).toBeLessThanOrEqual(10);
      });

      it('still raises the round budget when the ceiling rises', () => {
        // This is the benefit the cap-derived ask was introduced for: without
        // it, custom mode maxed out at 15 items whatever the user set. It has to
        // survive the fix, or the fix trades one wrong behaviour for another.
        const small = calculateBatchLimits(6800, 'custom', { entityCap: 5, conceptCap: 5 });
        const large = calculateBatchLimits(6800, 'custom', { entityCap: 100, conceptCap: 100 });

        expect(large.maxBatches).toBeGreaterThan(small.maxBatches);
      });

      it('keeps the ask inside the configured bounds at both extremes', () => {
        const tinyNote = calculateBatchLimits(100, 'custom', { entityCap: 100, conceptCap: 100 });
        const hugeNote = calculateBatchLimits(2_000_000, 'custom', { entityCap: 300, conceptCap: 300 });

        expect(tinyNote.initialBatchSize).toBeGreaterThanOrEqual(5);
        expect(hugeNote.initialBatchSize).toBeLessThanOrEqual(50);
      });

      it('leaves the non-custom granularities alone', () => {
        // The coupling only ever existed in the custom branch.
        expect(calculateBatchLimits(6800, 'standard').initialBatchSize).toBe(20);
        expect(calculateBatchLimits(6800, 'fine').initialBatchSize).toBe(30);
      });
    });

    it('custom granularity with only entity cap set uses default for missing concept cap', () => {
      const result = calculateBatchLimits(100000, 'custom', { entityCap: 100 });
      // totalCap = 100 + 5 = 105 → batchSize = min(50, max(10, 105)) = 50, maxBatchesBase = ceil(105/50) = 3
      expect(result.initialBatchSize).toBe(50);
      expect(result.maxBatches).toBeGreaterThanOrEqual(3);
    });

    it('short content caps maxTotalItems even for fine granularity', () => {
      const result = calculateBatchLimits(5000, 'fine');
      // 5000 chars / 600 chars/item ≈ 9 items, capped at max(5, 9) = 9
      expect(result.maxTotalItems).toBeLessThanOrEqual(9);
    });

    it('auto-downgrades maxTotalItems for short content', () => {
      const shortContent = 6000; // 6000 chars
      const result = calculateBatchLimits(shortContent, 'standard');

      // 6000 / 600 = 10, but capped at reasonable minimum of 5
      expect(result.maxTotalItems).toBeLessThanOrEqual(10);
    });

    it('does not downgrade below 5 items', () => {
      const veryShort = calculateBatchLimits(1000, 'standard');
      expect(veryShort.maxTotalItems).toBeGreaterThanOrEqual(5);
    });

    it('does not downgrade for long content', () => {
      const longContent = calculateBatchLimits(25000, 'standard');
      expect(longContent.maxTotalItems).toBe(50);
    });

    it('does not downgrade when maxTotalItems is null', () => {
      const custom = calculateBatchLimits(5000, 'custom');
      expect(custom.maxTotalItems).toBeNull();
    });

    it('calculates response fullness threshold at 70%', () => {
      const result = calculateBatchLimits(10000);
      expect(result.responseFullnessThreshold).toBe(16000 * 0.7);
    });

    it('returns different configs for different granularities', () => {
      const fine = calculateBatchLimits(10000, 'fine');
      const coarse = calculateBatchLimits(10000, 'coarse');

      expect(fine.initialBatchSize).toBeGreaterThan(coarse.initialBatchSize);
      expect(fine.maxTotalItems).toBeGreaterThan(coarse.maxTotalItems!);
    });

    it('falls back to standard for unknown granularity', () => {
      const result = calculateBatchLimits(10000, 'unknown');
      expect(result.initialBatchSize).toBe(20);
    });
  });

  describe('adjustBatchSizeForResponse', () => {
    it('reduces batch size when response exceeds threshold', () => {
      const result = adjustBatchSizeForResponse(20, 12000, 10000);
      expect(result).toBeLessThan(20);
    });

    it('reduces by 25% (floored)', () => {
      const result = adjustBatchSizeForResponse(20, 12000, 10000);
      expect(result).toBe(15); // floor(20 * 0.75)
    });

    it('does not reduce below minimum', () => {
      const result = adjustBatchSizeForResponse(6, 12000, 10000);
      expect(result).toBe(5); // min is 5
    });

    it('keeps batch size when response is under threshold', () => {
      const result = adjustBatchSizeForResponse(20, 5000, 10000);
      expect(result).toBe(20);
    });

    it('keeps batch size at threshold boundary', () => {
      const result = adjustBatchSizeForResponse(20, 10000, 10000);
      expect(result).toBe(20);
    });

    it('uses default threshold when not provided', () => {
      const result = adjustBatchSizeForResponse(20, 12000);
      expect(result).toBeLessThan(20);
    });

    it('does not reduce when already at minimum', () => {
      const result = adjustBatchSizeForResponse(5, 12000, 10000);
      expect(result).toBe(5);
    });
  });

  describe('getCustomTypeCaps', () => {
    it('returns null caps for non-custom granularity', () => {
      const result = getCustomTypeCaps({
        extractionGranularity: 'standard'
      });
      expect(result.entityCap).toBeNull();
      expect(result.conceptCap).toBeNull();
    });

    it('returns default caps for custom mode', () => {
      const result = getCustomTypeCaps({
        extractionGranularity: 'custom'
      });
      expect(result.entityCap).toBe(5);
      expect(result.conceptCap).toBe(5);
    });

    it('returns custom entity cap', () => {
      const result = getCustomTypeCaps({
        extractionGranularity: 'custom',
        customEntityLimit: 10
      });
      expect(result.entityCap).toBe(10);
      expect(result.conceptCap).toBe(5);
    });

    it('returns user-defined caps for custom granularity', () => {
      expect(getCustomTypeCaps({ extractionGranularity: 'custom', customEntityLimit: 300, customConceptLimit: 200 }))
        .toEqual({ entityCap: 300, conceptCap: 200 });
    });

    it('returns custom concept cap', () => {
      const result = getCustomTypeCaps({
        extractionGranularity: 'custom',
        customConceptLimit: 15
      });
      expect(result.entityCap).toBe(5);
      expect(result.conceptCap).toBe(15);
    });

    it('returns both custom caps', () => {
      const result = getCustomTypeCaps({
        extractionGranularity: 'custom',
        customEntityLimit: 8,
        customConceptLimit: 12
      });
      expect(result.entityCap).toBe(8);
      expect(result.conceptCap).toBe(12);
    });
  });

  describe('GRANULARITY_CONFIG', () => {
    it('has all granularity levels', () => {
      expect(GRANULARITY_CONFIG.fine).toBeDefined();
      expect(GRANULARITY_CONFIG.standard).toBeDefined();
      expect(GRANULARITY_CONFIG.coarse).toBeDefined();
      expect(GRANULARITY_CONFIG.minimal).toBeDefined();
      expect(GRANULARITY_CONFIG.custom).toBeDefined();
    });

    it('fine has highest limits', () => {
      expect(GRANULARITY_CONFIG.fine.initialBatchSize).toBe(30);
      expect(GRANULARITY_CONFIG.fine.maxTotalItems).toBe(100);
    });

    it('custom has null maxTotalItems', () => {
      expect(GRANULARITY_CONFIG.custom.maxTotalItems).toBeNull();
    });
  });
});
