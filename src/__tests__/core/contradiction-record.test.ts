// The record file is the prose carrier of an open contradiction; the
// marker on the page is the index. `getOpenContradictions` parses the
// record's four `##` sections positionally, so their order is a contract.

import { describe, it, expect } from 'vitest';
import { buildContradictionRecord } from '../../core/contradiction-record';

describe('buildContradictionRecord', () => {
  it('keeps exactly four ## sections in order (getOpenContradictions parses positionally)', () => {
    const { content } = buildContradictionRecord(
      {
        claim: 'A',
        existingView: 'B',
        resolution: 'C',
        pageRelPath: 'entities/X',
        sourceNotePath: 'Notizen/N.md',
        date: '2026-09-01',
      },
      {
        new_claim: 'New Claim',
        existing_knowledge: 'Existing Knowledge',
        resolution_suggestion: 'Resolution Suggestion',
        source_page: 'Source Page',
      }
    );
    const sections = content
      .split('\n')
      .filter(l => l.startsWith('## '))
      .map(l => l.slice(3));
    expect(sections).toEqual([
      'New Claim',
      'Existing Knowledge',
      'Resolution Suggestion',
      'Source Page',
    ]);
  });
});
