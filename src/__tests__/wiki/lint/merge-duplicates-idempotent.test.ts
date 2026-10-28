// Issue #825's other half: keeping the source makes the merge re-entrant.
//
// The reported defect was that a merge deleted the source even when some references
// to it could not be retargeted, so the next lint found fresh dead links. The fix
// keeps the source in that case — which means the same pair is reported again on the
// next run and merged again. The programmatic fallback appended
// `## From <title>` plus the whole source body unconditionally, so every run would
// have grown the survivor by one copy of the source.
//
// Idempotency is the requirement, not an optimisation: merging the same pair twice
// must leave the survivor as one copy of the source. The section header is already
// the block's identity, so no new marker is needed.

import { describe, it, expect } from 'vitest';
import { mergeDuplicatePages } from '../../../wiki/lint/merge-duplicates';
import { createMergeCtx } from '../../__support__/link-vault';

const TARGET = 'wiki/entities/Ferritin.md';
const SOURCE = 'wiki/entities/Ferritin-2.md';

const TARGET_CONTENT = '---\ntype: entity\ntags: [substance]\n---\n\n# Ferritin\n\nIron store.\n';
const SOURCE_CONTENT = '---\ntype: entity\ntags: [substance]\n---\n\n# Ferritin-2\n\nAlso the iron store.\n';

function makeCtx() {
  return createMergeCtx({ [TARGET]: TARGET_CONTENT, [SOURCE]: SOURCE_CONTENT });
}

describe('mergeDuplicatePages — a kept-source pair must not grow the survivor (#825)', () => {
  it('appends the source body exactly once on a first merge', async () => {
    const { ctx, fake } = makeCtx();

    await mergeDuplicatePages(ctx, TARGET, SOURCE);

    const written = fake.read(TARGET) ?? '';
    expect(written.split('## From ').length - 1).toBe(1);
    expect(written.split('Also the iron store.').length - 1).toBe(1);
  });

  it('does not append a second copy when the same pair is merged again', async () => {
    const { ctx, fake } = makeCtx();

    await mergeDuplicatePages(ctx, TARGET, SOURCE);
    // Production keeps the source when a reference could not be retargeted, so the
    // pair is reported again on the next lint run and reaches this path a second time.
    fake.write(SOURCE, SOURCE_CONTENT);
    await mergeDuplicatePages(ctx, TARGET, SOURCE);

    const written = fake.read(TARGET) ?? '';
    expect(written.split('## From ').length - 1).toBe(1);
    expect(written.split('Also the iron store.').length - 1).toBe(1);
  });

  it('leaves a survivor that already carries the block untouched', async () => {
    // The state a second run actually reads: the previous merge already wrote it.
    const survivor = `${TARGET_CONTENT}\n## From Ferritin-2\n\nAlso the iron store.\n`;
    const { ctx, fake } = createMergeCtx({ [TARGET]: survivor, [SOURCE]: SOURCE_CONTENT });

    await mergeDuplicatePages(ctx, TARGET, SOURCE);

    const written = fake.read(TARGET) ?? '';
    expect(written.split('Also the iron store.').length - 1).toBe(1);
  });
});
