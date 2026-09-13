import { describe, it, expect } from 'vitest';
import { normalizeProvenanceMarkers } from '../../core/provenance-marker';

describe('normalizeProvenanceMarkers — bracket count', () => {
  it('repairs the two-bracket form the model writes most often', () => {
    expect(normalizeProvenanceMarkers('Satz. ^[Quelle: [[Big-Pharma-Bias]]'))
      .toBe('Satz. ^[Quelle: [[Big-Pharma-Bias]]]');
  });

  it('trims a four-bracket overshoot down to three', () => {
    expect(normalizeProvenanceMarkers('Satz. ^[Quelle: [[X]]]]'))
      .toBe('Satz. ^[Quelle: [[X]]]');
  });

  it('keeps a correct marker unchanged and stays idempotent', () => {
    const ok = 'Satz. ^[Quelle: [[Berberin]]] Weiter.';
    expect(normalizeProvenanceMarkers(ok)).toBe(ok);
    expect(normalizeProvenanceMarkers(normalizeProvenanceMarkers(ok))).toBe(ok);
  });

  it('preserves trailing punctuation after the marker', () => {
    expect(normalizeProvenanceMarkers('… gesättigte Fette ^[Quelle: [[Big-Pharma-Bias]].'))
      .toBe('… gesättigte Fette ^[Quelle: [[Big-Pharma-Bias]]].');
  });

  it('handles piped link labels and path targets', () => {
    expect(normalizeProvenanceMarkers('S. ^[Quelle: [[Notizen/Big-Pharma-Bias|Big-Pharma-Bias]]'))
      .toBe('S. ^[Quelle: [[Notizen/Big-Pharma-Bias|Big-Pharma-Bias]]]');
  });

  it('returns content without a wikilink unchanged (same reference)', () => {
    const s = 'Kein Marker hier.';
    expect(normalizeProvenanceMarkers(s)).toBe(s);
  });
});

describe('normalizeProvenanceMarkers — the label is the vault\'s, not ours', () => {
  it('carries an English label through verbatim', () => {
    expect(normalizeProvenanceMarkers('A sentence. ^[Source: [[Berberine]]'))
      .toBe('A sentence. ^[Source: [[Berberine]]]');
  });

  it('carries a non-Latin label through verbatim', () => {
    expect(normalizeProvenanceMarkers('一句话。^[[来源: [[小檗碱]]]]'))
      .toBe('一句话。^[来源: [[小檗碱]]]');
  });

  it('never rewrites one label into another', () => {
    const out = normalizeProvenanceMarkers('X ^[Fonte: [[Berberina]] Y ^[Quelle: [[Berberin]]');
    expect(out).toBe('X ^[Fonte: [[Berberina]]] Y ^[Quelle: [[Berberin]]]');
  });
});

describe('normalizeProvenanceMarkers — swapped opening brackets', () => {
  it('repairs the [^Quelle: form the merge model writes', () => {
    expect(normalizeProvenanceMarkers('Satz. [^Quelle: [[Adaptogen]]]'))
      .toBe('Satz. ^[Quelle: [[Adaptogen]]]');
  });

  it('repairs it with a wrong closing bracket count as well', () => {
    expect(normalizeProvenanceMarkers('Satz. [^Quelle: [[Adaptogen]]'))
      .toBe('Satz. ^[Quelle: [[Adaptogen]]]');
  });
});

describe('normalizeProvenanceMarkers — doubled opening bracket', () => {
  it('repairs the ^[[Quelle: form', () => {
    expect(normalizeProvenanceMarkers('Satz. ^[[Quelle: [[Reaktive Sauerstoffspezies]]]]'))
      .toBe('Satz. ^[Quelle: [[Reaktive Sauerstoffspezies]]]');
  });

  it('repairs it with any closing count and keeps a piped label', () => {
    expect(normalizeProvenanceMarkers('S. ^[[Quelle: [[Notizen/Eisen|Eisen]]] Weiter.'))
      .toBe('S. ^[Quelle: [[Notizen/Eisen|Eisen]]] Weiter.');
  });

  it('repairs the bare-name form ^[[Quelle: X]] and keeps the text after it', () => {
    expect(normalizeProvenanceMarkers('Depletion) ^[[Quelle: Reaktive Sauerstoffspezies]]\\. Eine'))
      .toBe('Depletion) ^[Quelle: [[Reaktive Sauerstoffspezies]]]\\. Eine');
  });
});

describe('normalizeProvenanceMarkers — the caret lost from the front', () => {
  it('repairs the nested form with trailing carets', () => {
    expect(normalizeProvenanceMarkers('Satz. [[Quelle: [[Reaktive Sauerstoffspezies]]]^^^. Weiter.'))
      .toBe('Satz. ^[Quelle: [[Reaktive Sauerstoffspezies]]]. Weiter.');
  });

  it('repairs the nested form with no caret left at all', () => {
    expect(normalizeProvenanceMarkers('Satz. [[Quelle: [[Curcumin]]]'))
      .toBe('Satz. ^[Quelle: [[Curcumin]]]');
  });

  it('repairs the bare form when a caret trails it', () => {
    expect(normalizeProvenanceMarkers('Satz. [[Quelle: Curcumin]]^'))
      .toBe('Satz. ^[Quelle: [[Curcumin]]]');
  });
});

describe('normalizeProvenanceMarkers — what it must not touch', () => {
  it('leaves a wikilink whose page name contains a colon alone', () => {
    const s = 'Siehe [[Studie: Berberin 2021]] und [[COVID-19: Long Covid]].';
    expect(normalizeProvenanceMarkers(s)).toBe(s);
  });

  it('leaves a colon-named wikilink alone when a footnote follows it', () => {
    const s = 'Siehe [[Studie: Berberin 2021]]^[Quelle: [[Berberin]]]';
    expect(normalizeProvenanceMarkers(s)).toBe(s);
  });

  it('leaves an ordinary inline footnote without a wikilink alone', () => {
    const s = 'Satz.^[eine gewöhnliche Fußnote: mit Doppelpunkt]';
    expect(normalizeProvenanceMarkers(s)).toBe(s);
  });

  it('leaves the mentions quote line alone', () => {
    // What the mentions formatter writes on every source page — one character
    // away from a marker, and it must never be read as one.
    const s = '> **Quelle: [[sources/X|X]]**\n> - "ein Zitat"';
    expect(normalizeProvenanceMarkers(s)).toBe(s);
  });

  it('leaves an ordinary wikilink alone', () => {
    const s = 'Siehe [[Berberin]] und [[entities/Chrom|Chrom]].';
    expect(normalizeProvenanceMarkers(s)).toBe(s);
  });
});
