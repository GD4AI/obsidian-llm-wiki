/**
 * Query lex noise — measured on a 3,025-page German vault (2026-09-03).
 *
 * "Kann man bei eingeschränkter Nierenfunktion Creatin nehmen?" loaded
 * Kahneman, Karpman, Salbei, Pekannüsse and six more pages the query
 * never named, while the page titled "Creatin" was not among them.
 * Three mechanisms, each pinned below:
 *
 *   1. tokenizeQuery split "über" into "über" + "ber" (ASCII-only run
 *      class), double-counting every title "über" already hit, and
 *      kept "Creatin." with its full stop as a needle.
 *   2. Tokens matched as substrings: "man" → Kahneman, "creatin" →
 *      Phosphocreatin (a different substance).
 *   3. mergeWithPPR took max(lexRankHint ∈ (0,1], pprMass ≈ 0.05), so
 *      any keyword hit outranked every PPR seed.
 */
import { describe, it, expect } from 'vitest';
import {
  tokenizeQuery,
  needleHits,
  lexMatchByTitleAndAliases,
  pprCascade,
  type PageRef,
  type Graph,
} from '../../core/ppr-cascade';
import { makeRng } from '../__support__/rng';

function page(path: string, title: string, aliases: string[] = []): PageRef {
  return { path, title, aliases };
}

describe('tokenizeQuery — Latin diacritics and edge punctuation', () => {
  it('keeps umlaut words whole and emits no ASCII fragments', () => {
    const tokens = tokenizeQuery('Gib mir Informationen über Creatin.');
    expect(tokens).toContain('über');
    expect(tokens).toContain('creatin');
    expect(tokens).not.toContain('ber');
    expect(tokens).not.toContain('creatin.');
  });

  it('does not split a word at a diacritic', () => {
    const tokens = tokenizeQuery('eingeschränkter Nierenfunktion');
    expect(tokens).toEqual(expect.arrayContaining(['eingeschränkter', 'nierenfunktion']));
    expect(tokens).not.toContain('eingeschr');
    expect(tokens).not.toContain('nkter');
  });

  it('a punctuation-only token collapses to nothing', () => {
    expect(tokenizeQuery('???!!')).toEqual([]);
  });

  it('keeps words of other space-delimited scripts whole, punctuation stripped', () => {
    // RU is one of the shipped wiki languages; a Latin-only word class
    // stripped every Cyrillic token to nothing.
    expect(tokenizeQuery('Что такое креатин?')).toEqual(expect.arrayContaining(['что', 'такое', 'креатин']));
    expect(tokenizeQuery('Что такое креатин?')).not.toContain('креатин?');
    expect(tokenizeQuery('Τι είναι η κρεατίνη;')).toContain('κρεατίνη');
  });

  it('does not split a word at a combining mark (NFD text)', () => {
    const nfd = 'über Creatin'.normalize('NFD');
    const tokens = tokenizeQuery(nfd);
    expect(tokens).toContain('über'.normalize('NFD'));
    expect(tokens).not.toContain('ber');
  });

  it('still extracts CJK runs and mixed tokens', () => {
    expect(tokenizeQuery('什么是Obsidian？')).toEqual(expect.arrayContaining(['obsidian', '什么是']));
  });
});

describe('needleHits — Latin needles must start a word', () => {
  it('rejects a function word buried inside a name', () => {
    expect(needleHits('daniel kahneman', 'man')).toBe(false);
    expect(needleHits('salbei', 'bei')).toBe(false);
    expect(needleHits('pekannüsse', 'kann')).toBe(false);
  });

  it('accepts a needle at a word start, including after a hyphen or space', () => {
    expect(needleHits('manuka-honig', 'man')).toBe(true);
    expect(needleHits('vitamin-d3', 'd3')).toBe(true);
    expect(needleHits('deepseek dsa hca', 'dsa')).toBe(true);
    expect(needleHits('überregulation', 'über')).toBe(true);
    expect(needleHits('creatin-kinase', 'kinase')).toBe(true);
  });

  it('prefix compounds match, a shared tail does not', () => {
    expect(needleHits('nierenfunktionsstörung', 'nierenfunktion')).toBe(true);
    expect(needleHits('phosphocreatin', 'creatin')).toBe(false);
  });

  it('applies the word start to Cyrillic needles too', () => {
    expect(needleHits('креатинкиназа', 'киназа')).toBe(false);
    expect(needleHits('креатин-киназа', 'киназа')).toBe(true);
  });

  it('a combining mark belongs to its word (NFD)', () => {
    expect(needleHits('kübel'.normalize('NFD'), 'bel')).toBe(false);
    expect(needleHits('kübel'.normalize('NFC'), 'bel')).toBe(false);
  });

  it('keeps substring semantics for CJK needles (no word boundaries)', () => {
    expect(needleHits('深度学习', '学习')).toBe(true);
  });

  it('lexMatchByTitleAndAliases: the named page outscores the noise', () => {
    const pages = [
      page('e/Kahneman', 'Daniel Kahneman'),
      page('e/Salbei', 'Salbei'),
      page('e/Pekan', 'Pekannüsse'),
      page('e/Creatin', 'Creatin', ['CrM']),
    ];
    const hits = lexMatchByTitleAndAliases('Kann man bei Nierenfunktion Creatin nehmen?', pages);
    expect(hits.map(h => h.page.path)).toEqual(['e/Creatin']);
  });
});

describe('mergeWithPPR — PPR mass ranks, the lex hint only orders the rest', () => {
  // Mature graph: a 40-node ring (seed component, > 50 % of nodes) plus
  // 12 pages whose titles contain the query word but which PPR from the
  // seed never reaches. Before the fix the twelve "alphafold-*" pages
  // filled the top ten by lex rank alone.
  function fixture() {
    const pages: PageRef[] = [];
    const edges: Array<[string, string[]]> = [];
    for (let i = 0; i < 40; i++) {
      pages.push(page(`R${i}`, `Ring ${i}`));
      edges.push([`R${i}`, [`R${(i + 1) % 40}`, `R${(i + 2) % 40}`]]);
    }
    for (let i = 0; i < 12; i++) {
      pages.push(page(`N${i}`, `Alphafold ${i}`));
      edges.push([`N${i}`, [`N${(i + 1) % 12}`]]);
    }
    const g: Graph = {
      nodes: pages.map(p => p.path),
      edges: new Map(edges),
    };
    return { pages, g };
  }

  it('explicit seeds and their neighbourhood come before unreached lex hits', () => {
    const { pages, g } = fixture();
    const result = pprCascade('alphafold', pages, {
      graph: g, seeds: ['R0'], rng: makeRng(1),
    });
    expect(result[0].page.path).toBe('R0');
    expect(result[0].arm).toBe('graph-first-ppr');
    // The seed's out-neighbours carry PPR mass; the lex-only pages do not.
    const ringFirst = result.findIndex(m => m.page.path.startsWith('N'));
    const lastRing = result.map(m => m.page.path.startsWith('R')).lastIndexOf(true);
    expect(ringFirst === -1 || ringFirst > lastRing).toBe(true);
  });

  it('pages PPR never reached are still ordered by lex rank, below all reached pages', () => {
    const { pages, g } = fixture();
    const result = pprCascade('alphafold', pages, {
      graph: g, seeds: ['R0'], topN: 60, rng: makeRng(1),
    });
    // The property is ORDERING, not score monotonicity. Assembly applies
    // diminishing return per source, so within a band a lower raw score can be
    // picked before a higher one — that is the rule working. What must hold is
    // that every PPR-reached page comes before every page PPR never reached,
    // because the seed pages are what an LLM call paid for and an unreached
    // keyword hit must not displace them.
    const order = result.map(m => m.page.path);
    const firstUnreached = order.findIndex(p => p.startsWith('N'));
    const lastReached = order.map(p => p.startsWith('R')).lastIndexOf(true);
    if (firstUnreached !== -1 && lastReached !== -1) {
      expect(lastReached).toBeLessThan(firstUnreached);
    }
    const nPaths = result.filter(m => m.page.path.startsWith('N')).map(m => m.page.path);
    expect(nPaths.length).toBe(12);
    expect(nPaths[0]).toBe('N0');
  });
});
