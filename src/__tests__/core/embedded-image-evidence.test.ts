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
      visibleText: 'Chart title', description: 'A chart', beforeRelevance: 'related', afterRelevance: 'unrelated',
      contextInterpretation: 'The preceding caption explains the chart.', status: 'analyzed',
    }],
  };
}

describe('embedded image evidence injector', () => {
  it('writes an auditable collapsible section', () => {
    const output = injectEmbeddedImageEvidenceSection('# Source', report(true), 'Embedded Image Visual Evidence');
    expect(output).toContain('<details>\n<summary>Embedded Image Visual Evidence (1)</summary>');
    expect(output).toContain('<div>\n<h3>Image 1</h3>');
    expect(output).toContain('<code>assets/chart.png</code>');
    expect(output).toContain('<pre><code>The preceding caption explains the chart.</code></pre>');
    expect(output).toContain('<li><code>remote.png</code> — remote</li>');
    expect(output).toContain('</div>\n</details>');
    expect(output).not.toContain('### Image 1');
    expect(output).not.toContain('```text');
  });

  it('escapes model evidence before writing it as HTML', () => {
    const output = injectEmbeddedImageEvidenceSection(
      '# Source',
      { ...report(true), evidence: [{ ...report(true).evidence[0], description: '<script>alert("unsafe")</script>' }] },
      'Evidence',
    );
    expect(output).toContain('&lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt;');
    expect(output).not.toContain('<script>');
  });

  it('replaces an older generated section and removes it when saving is off', () => {
    const first = injectEmbeddedImageEvidenceSection('# Source', report(true), 'Evidence');
    const second = injectEmbeddedImageEvidenceSection(first, report(true), 'Evidence');
    expect(second.match(/embedded-image-evidence:start/g)).toHaveLength(1);
    expect(injectEmbeddedImageEvidenceSection(second, undefined, 'Evidence')).not.toContain('embedded-image-evidence:start');
  });
});
