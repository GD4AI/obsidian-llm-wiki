import { describe, expect, it } from 'vitest';
import { injectEmbeddedImageEvidenceSection } from '../../core/embedded-image-evidence';
import type { EmbeddedImageAnalysisReport } from '../../types';

function report(saved: boolean): EmbeddedImageAnalysisReport {
  return {
    discovered: 2, queued: 1, sent: 1, analyzed: 1, packages: 1, convertedGifs: 0, failedPackages: 0,
    skipped: [{ path: 'remote.png', reason: 'remote' }],
    evidenceSaved: saved,
    evidence: [{
      index: 1, path: 'assets/chart.png', contextBefore: 'Before', contextAfter: 'After',
      visibleText: 'Chart title', description: 'A chart', contextRelevance: 'Supports the caption', status: 'analyzed',
    }],
  };
}

describe('embedded image evidence injector', () => {
  it('writes an auditable collapsible section', () => {
    const output = injectEmbeddedImageEvidenceSection('# Source', report(true), 'Embedded Image Visual Evidence');
    expect(output).toContain('<details><summary>Embedded Image Visual Evidence (1)</summary>');
    expect(output).toContain('assets/chart.png');
    expect(output).toContain('Supports the caption');
    expect(output).toContain('remote.png');
  });

  it('replaces an older generated section and removes it when saving is off', () => {
    const first = injectEmbeddedImageEvidenceSection('# Source', report(true), 'Evidence');
    const second = injectEmbeddedImageEvidenceSection(first, report(true), 'Evidence');
    expect(second.match(/embedded-image-evidence:start/g)).toHaveLength(1);
    expect(injectEmbeddedImageEvidenceSection(second, undefined, 'Evidence')).not.toContain('embedded-image-evidence:start');
  });
});
