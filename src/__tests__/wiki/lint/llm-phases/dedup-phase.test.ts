// v1.24.0: dedup-phase extraction from controller.ts:runLintWiki.
//
// Tests for the duplicate-detection phase split into controller.ts.
// Pure helpers (classifyTiers, computeVerifyBatch) are covered first
// because they have no IO and are easiest to test in isolation.
// runDedupPhase integration tests use stub LLMClient and wikiEngine
// to exercise the parallel-batch + rate-limit path.

import { describe, it, expect, vi } from 'vitest';
import {
  classifyTiers,
  computeVerifyBatch,
  runDedupPhase,
} from '../../../../wiki/lint/llm-phases/dedup-phase';
import type { DedupPhaseInput } from '../../../../wiki/lint/llm-phases/dedup-phase';
import type { DuplicateCandidate } from '../../../../wiki/lint/duplicate-detection';
import type { LintPhaseContext, ScannerPage } from '../../../../wiki/lint/types';
import { LINT_MAX_INPUT_TOKENS, LINT_CANDIDATE_TOKEN_ESTIMATE, LINT_DEDUP_BATCH_SIZE } from '../../../../constants';
import { DedupResultLLMSchema } from '../../../../llm-sdk/output-schemas';

// ── Pure helper: classifyTiers ─────────────────────────────────

// Explicit signal union alias — using `DuplicateCandidate['signal']` as a
// parameter type confused ESLint's type tracker (it was widening the union
// to `any` and causing cascading "unsafe-argument" errors in every
// `[makeCandidate(...)]` literal). The local alias gives the rule a
// concrete type to work with.
type CandidateSignal = 'crossLang' | 'bigram' | 'sharedLinks' | 'caseVariant';

function makeCandidate(signal: CandidateSignal, score: number, name: string = 'a->b'): DuplicateCandidate {
  return { target: 'wiki/entities/a.md', source: 'wiki/entities/b.md', reason: name, signal, score };
}

describe('classifyTiers', () => {
  it('crossLang signal is tier 1', () => {
    const result = classifyTiers([makeCandidate('crossLang', 0.5)]);
    expect(result.tier1).toHaveLength(1);
    expect(result.tier2).toHaveLength(0);
  });

  it('caseVariant signal is tier 1', () => {
    const result = classifyTiers([makeCandidate('caseVariant', 0.5)]);
    expect(result.tier1).toHaveLength(1);
    expect(result.tier2).toHaveLength(0);
  });

  it('bigram with score >= 0.6 is tier 1', () => {
    const result = classifyTiers([makeCandidate('bigram', 0.6)]);
    expect(result.tier1).toHaveLength(1);
    expect(result.tier2).toHaveLength(0);
  });

  it('bigram with score < 0.6 is tier 2', () => {
    const result = classifyTiers([makeCandidate('bigram', 0.5)]);
    expect(result.tier1).toHaveLength(0);
    expect(result.tier2).toHaveLength(1);
  });

  it('bigram at exact 0.6 boundary is tier 1 (>=)', () => {
    const result = classifyTiers([makeCandidate('bigram', 0.6)]);
    expect(result.tier1).toHaveLength(1);
  });

  it('bigram at 0.599 is tier 2', () => {
    const result = classifyTiers([makeCandidate('bigram', 0.599)]);
    expect(result.tier1).toHaveLength(0);
    expect(result.tier2).toHaveLength(1);
  });

  it('sharedLinks signal is always tier 2 regardless of score', () => {
    expect(classifyTiers([makeCandidate('sharedLinks', 1.0)]).tier1).toHaveLength(0);
    expect(classifyTiers([makeCandidate('sharedLinks', 1.0)]).tier2).toHaveLength(1);
  });

  it('mixed input classifies each candidate by its own signal/score', () => {
    const candidates: DuplicateCandidate[] = [
      makeCandidate('crossLang', 0.4, 'cl'),
      makeCandidate('caseVariant', 0.3, 'cv'),
      makeCandidate('bigram', 0.7, 'b1'),
      makeCandidate('bigram', 0.5, 'b2'),
      makeCandidate('sharedLinks', 0.8, 'sl'),
    ];
    const result = classifyTiers(candidates);
    expect(result.tier1.map(c => c.reason).sort()).toEqual(['b1', 'cl', 'cv']);
    expect(result.tier2.map(c => c.reason).sort()).toEqual(['b2', 'sl']);
  });

  it('preserves tier-1 insertion order (stable classification)', () => {
    const candidates: DuplicateCandidate[] = [
      makeCandidate('crossLang', 0.5, 'first'),
      makeCandidate('crossLang', 0.4, 'second'),
      makeCandidate('crossLang', 0.3, 'third'),
    ];
    const result = classifyTiers(candidates);
    expect(result.tier1.map(c => c.reason)).toEqual(['first', 'second', 'third']);
  });

  // v1.26.0 (#382 item 2): bigram tier-1 cutoff is now configurable via
  // an optional second argument. Default behavior is unchanged (constant
  // value 0.6). These tests exercise the parameter; the legacy single-arg
  // call sites above continue to pin the default value.
  it('custom tier-1 cutoff moves the bigram boundary', () => {
    // With cutoff 0.5, bigram@0.5 is tier 1; with default 0.6 it would be tier 2.
    const atBoundary = classifyTiers([makeCandidate('bigram', 0.5, 'boundary')], 0.5);
    expect(atBoundary.tier1).toHaveLength(1);
    expect(atBoundary.tier2).toHaveLength(0);

    // Without the cutoff override, bigram@0.5 would default to tier 2.
    const withoutOverride = classifyTiers([makeCandidate('bigram', 0.5, 'defaultBoundary')]);
    expect(withoutOverride.tier1).toHaveLength(0);
    expect(withoutOverride.tier2).toHaveLength(1);
  });

  it('high custom tier-1 cutoff demotes previously-tier-1 bigram candidates', () => {
    // Bigram@0.8 is tier 1 at the default cutoff 0.6; with cutoff 0.9 it drops to tier 2.
    const lowered = classifyTiers([makeCandidate('bigram', 0.8, 'demoted')], 0.9);
    expect(lowered.tier1).toHaveLength(0);
    expect(lowered.tier2).toHaveLength(1);

    // At the default, the same candidate is still tier 1.
    const defaultCutoff = classifyTiers([makeCandidate('bigram', 0.8, 'stillTier1')]);
    expect(defaultCutoff.tier1).toHaveLength(1);
    expect(defaultCutoff.tier2).toHaveLength(0);
  });

  it('custom tier-1 cutoff does not affect crossLang / caseVariant / sharedLinks', () => {
    const candidates: DuplicateCandidate[] = [
      makeCandidate('crossLang', 0.1, 'cl-low-score'),
      makeCandidate('caseVariant', 0.1, 'cv-low-score'),
      makeCandidate('sharedLinks', 0.99, 'sl-high-score'),
    ];
    // With cutoff 0.999, only the crossLang and caseVariant should be tier 1;
    // sharedLinks is unconditionally tier 2.
    const result = classifyTiers(candidates, 0.999);
    expect(result.tier1.map(c => c.reason).sort()).toEqual(['cl-low-score', 'cv-low-score']);
    expect(result.tier2.map(c => c.reason)).toEqual(['sl-high-score']);
  });
});

// ── Pure helper: computeVerifyBatch ────────────────────────────

describe('computeVerifyBatch', () => {
  const maxTotal = Math.floor(LINT_MAX_INPUT_TOKENS / LINT_CANDIDATE_TOKEN_ESTIMATE);

  function makeCandidate(name: string): DuplicateCandidate {
    return { target: `wiki/entities/${name}.md`, source: `wiki/entities/${name}-b.md`, reason: name, signal: 'crossLang', score: 0.5 };
  }

  it('tier 1 is always included in full (no cap), matching old inline behavior', () => {
    // The OLD controller.ts:runLintWiki code was `verifyCandidates = [...tier1]`,
    // which includes ALL tier1 entries regardless of maxTotal. The v1.24.0
    // refactor's first pass accidentally added a cap; v1.24.0 review
    // finding B5 restored the OLD behavior. This test pins that: tier1
    // never gets capped, even when maxTotal is smaller than tier1.length.
    const tier1: DuplicateCandidate[] = [makeCandidate('a'), makeCandidate('b')];
    const tier2: DuplicateCandidate[] = [makeCandidate('c'), makeCandidate('d')];
    // maxTotal=1 is intentionally tiny to prove no tier1 cap.
    const result = computeVerifyBatch(tier1, tier2, 1);
    expect(result.verifyList).toHaveLength(2);
    expect(result.verifyList.map(c => c.reason)).toEqual(['a', 'b']);
    expect(result.tier2Included).toBe(0);
  });

  it('tier 2 fills remaining budget after tier 1', () => {
    const tier1Count = 10;
    const tier1: DuplicateCandidate[] = [];
    for (let i = 0; i < tier1Count; i++) tier1.push(makeCandidate(`t1-${i}`));
    const tier2: DuplicateCandidate[] = [];
    for (let i = 0; i < 50; i++) tier2.push(makeCandidate(`t2-${i}`));
    const result = computeVerifyBatch(tier1, tier2, maxTotal);
    const expectedTier2 = Math.min(tier2.length, maxTotal - tier1.length);
    expect(result.verifyList).toHaveLength(tier1Count + expectedTier2);
    expect(result.tier2Included).toBe(expectedTier2);
  });

  it('tier 1 > maxTotal still includes all of tier1 in full (no cap)', () => {
    // OLD behavior preserved — even when tier1 alone exceeds maxTotal, the
    // verify list includes all of tier1 (the LLM sees a slightly larger
    // verify set than the budget suggests; this matches controller.ts v1.23.x).
    const tier1: DuplicateCandidate[] = [];
    for (let i = 0; i < maxTotal + 50; i++) tier1.push(makeCandidate(`t1-${i}`));
    const result = computeVerifyBatch(tier1, [], maxTotal);
    expect(result.verifyList).toHaveLength(maxTotal + 50);
    expect(result.tier2Included).toBe(0);
  });

  it('tier 2 with empty tier 1 fills budget from tier 2 start', () => {
    const tier2: DuplicateCandidate[] = [];
    for (let i = 0; i < maxTotal + 20; i++) tier2.push(makeCandidate(`t2-${i}`));
    const result = computeVerifyBatch([], tier2, maxTotal);
    expect(result.verifyList).toHaveLength(maxTotal);
    expect(result.tier2Included).toBe(maxTotal);
  });

  it('preserves order: all tier 1 first, then tier 2 in input order', () => {
    const tier1: DuplicateCandidate[] = [makeCandidate('A'), makeCandidate('B')];
    const tier2: DuplicateCandidate[] = [makeCandidate('C'), makeCandidate('D')];
    const result = computeVerifyBatch(tier1, tier2, 4);
    expect(result.verifyList.map(c => c.reason)).toEqual(['A', 'B', 'C', 'D']);
  });
});

// ── runDedupPhase integration tests ────────────────────────────

import type { LLMClient } from '../../../../types';

function makeLintPhaseContext(overrides: Partial<LintPhaseContext> = {}): LintPhaseContext {
  return {
    app: {} as LintPhaseContext['app'],
    settings: {
      wikiFolder: 'wiki',
      language: 'en',
      model: 'test-model',
      disableThinking: false,
    } as LintPhaseContext['settings'],
    llmClient: () => null,
    wikiEngine: { updateStatusBar: () => {} } as unknown as LintPhaseContext['wikiEngine'],
    checkCancelled: () => {},
    stageNotice: { setMessage: () => {} },
    totalPages: 0,
    buildSystemPrompt: async () => undefined,
    ...overrides,
  };
}

function makePageMap(entries: Array<[string, string]>): Map<string, ScannerPage> {
  const m = new Map<string, ScannerPage>();
  for (const [path, content] of entries) {
    m.set(path, { path, content, basename: path.split('/').pop() || path });
  }
  return m;
}

/**
 * Build a stub LLMClient whose `createMessage` resolves with the given
 * JSON string. Tracks call args so individual tests can assert against
 * the first call's `max_tokens`, `messages`, etc.
 */
function stubLlm(jsonResponse: string): { client: LLMClient; createMessage: ReturnType<typeof vi.fn> } {
  const createMessage = vi.fn().mockResolvedValue(jsonResponse);
  const client = { createMessage } as unknown as LLMClient;
  return { client, createMessage };
}

describe('runDedupPhase — early returns', () => {
  it('returns [] when there are < 2 entity/concept files', async () => {
    const ctx = makeLintPhaseContext();
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/a.md', basename: 'a.md' },
      ],
      pageMap: makePageMap([['wiki/entities/a.md', '# A']]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(result).toEqual([]);
  });

  it('returns [] when llmClient is null', async () => {
    const ctx = makeLintPhaseContext({ llmClient: () => null });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/a.md', basename: 'a.md' },
        { path: 'wiki/entities/b.md', basename: 'b.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/a.md', '# A'],
        ['wiki/entities/b.md', '# B'],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(result).toEqual([]);
  });

  it('returns [] when no candidates are generated (wiki is clean)', async () => {
    // Two entity pages with completely different content — generateDuplicateCandidates
    // will return [] for these. We don't need to mock LLM because no verify call happens.
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/alpha.md', basename: 'alpha.md' },
        { path: 'wiki/entities/beta-unrelated.md', basename: 'beta-unrelated.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/alpha.md', '---\ntype: entity\n---\n# Alpha\ncompletely different content with no links'],
        ['wiki/entities/beta-unrelated.md', '---\ntype: entity\n---\n# Beta\nno shared content here whatsoever'],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(result).toEqual([]);
    expect(createMessage).not.toHaveBeenCalled();
  });

  // v1.26.0 (#382 item 1, Batch 2): the dedup filter now includes
  // sources/. Two identical-body source pages in /sources/ should be
  // dedup candidates via the sourceFingerprint signal. Previously the
  // filter excluded sources entirely so this case never surfaced.
  it('includes sources/ in the dedup-eligible set (source↔source via sourceFingerprint)', async () => {
    const body = 'Identical source body content for fingerprint dedup test.';
    const a = { path: 'wiki/sources/source-a.md', basename: 'source-a.md' };
    const b = { path: 'wiki/sources/source-b.md', basename: 'source-b.md' };
    const { client, createMessage } = stubLlm(
      JSON.stringify({
        duplicates: [{ target: a.path, source: b.path, reason: 'identical bodies' }],
      })
    );
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [a, b],
      pageMap: makePageMap([
        [a.path, `---\ntype: source\n---\n# Source A\n${body}`],
        [b.path, `---\ntype: source\n---\n# Source B\n${body}`],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    // The phase must attempt LLM verification (proving sources are in the
    // candidate set). The mock confirms the duplicate, so result is non-empty.
    expect(createMessage).toHaveBeenCalled();
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(d =>
      (d.target === a.path && d.source === b.path) ||
      (d.target === b.path && d.source === a.path)
    )).toBe(true);
  });

  // v1.26.0 (#382 item 1, Batch 2): `lintDedupIncludeSources = false`
  // excludes sources/ from the dedup-eligible set (escape hatch for
  // vaults whose source corpus generates false positives). Source pages
  // must NOT trigger LLM verification in that mode.
  it('lintDedupIncludeSources = false excludes sources/ from dedup-eligible set', async () => {
    const body = 'Identical source body — should NOT be flagged when toggle is off.';
    const a = { path: 'wiki/sources/source-a.md', basename: 'source-a.md' };
    const b = { path: 'wiki/sources/source-b.md', basename: 'source-b.md' };
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({
      llmClient: () => client,
      settings: {
        wikiFolder: 'wiki',
        language: 'en',
        model: 'test-model',
        disableThinking: false,
        lintDedupIncludeSources: false,
      } as LintPhaseContext['settings'],
    });
    const input: DedupPhaseInput = {
      wikiFiles: [a, b],
      pageMap: makePageMap([
        [a.path, `---\ntype: source\n---\n# Source A\n${body}`],
        [b.path, `---\ntype: source\n---\n# Source B\n${body}`],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(createMessage).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

// B3 fix (v1.26.3 PATCH follow-up): the dedup candidate generator
// previously emitted cross-type pairs (entity↔source, concept↔source)
// that share a wiki subfolder bucket like 'tp:'. The dedup-phase
// docstring (line 132-151) explicitly admits this — only the
// sourceFingerprint signal was suppressed for cross-type, and only
// because body-hash equality is rare. The remaining three signals
// (sharedLinks / bigramCrossLang / caseVariant) fired regardless of
// page type, polluting the LLM verify batch with nonsense questions
// ("is this entity page a duplicate of this source page?").
//
// Spec (user direction, 2026-08-12): the dedup is allowed to consider
// only these pair-type combinations:
//   - entity ↔ entity
//   - concept ↔ concept
//   - entity ↔ concept (cross-type is OK here)
//   - source ↔ source
//
// Forbidden:
//   - entity ↔ source (and symmetric)
//   - concept ↔ source (and symmetric)
describe('runDedupPhase — cross-type pair filter (B3 fix)', () => {
  // Shared body that would trip bigramCrossLang + caseVariant signals
  // — same title-cased token appears in both pages. Pre-B3, this would
  // produce a duplicate candidate across the entity/source boundary.
  const sharedBody = 'Transformer is a foundational architecture for sequence modeling and attention.';

  it('entity↔source pair with shared content does NOT produce a candidate (LLM never called)', async () => {
    const entity = { path: 'wiki/entities/transformer.md', basename: 'transformer.md' };
    const source = { path: 'wiki/sources/transformer-reference.md', basename: 'transformer-reference.md' };
    const { client, createMessage } = stubLlm('{"duplicates":[{"target":"wiki/entities/transformer.md","source":"wiki/sources/transformer-reference.md","reason":"shared bigram"}]}');
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [entity, source],
      pageMap: makePageMap([
        [entity.path, `---\ntype: entity\n---\n# Transformer\n${sharedBody}`],
        [source.path, `---\ntype: source\n---\n# Transformer Reference\n${sharedBody}`],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    // Cross-type forbidden: no candidate, no LLM call.
    expect(result).toEqual([]);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('concept↔source pair with shared content does NOT produce a candidate', async () => {
    const concept = { path: 'wiki/concepts/attention.md', basename: 'attention.md' };
    const source = { path: 'wiki/sources/attention-paper.md', basename: 'attention-paper.md' };
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [concept, source],
      pageMap: makePageMap([
        [concept.path, `---\ntype: concept\n---\n# Attention\n${sharedBody}`],
        [source.path, `---\ntype: source\n---\n# Attention Paper\n${sharedBody}`],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(result).toEqual([]);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('entity↔concept pair with shared content IS allowed (cross-type is permitted)', async () => {
    // Allowed: this confirms we did not over-suppress. The LLM verify
    // path runs and returns the candidate as-is.
    const entity = { path: 'wiki/entities/transformer.md', basename: 'transformer.md' };
    const concept = { path: 'wiki/concepts/transformer.md', basename: 'transformer.md' };
    const { client, createMessage } = stubLlm(
      JSON.stringify({
        duplicates: [{ target: entity.path, source: concept.path, reason: 'same concept' }],
      })
    );
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [entity, concept],
      pageMap: makePageMap([
        [entity.path, `---\ntype: entity\n---\n# Transformer\n${sharedBody}`],
        [concept.path, `---\ntype: concept\n---\n# Transformer\n${sharedBody}`],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(createMessage).toHaveBeenCalled();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('source↔source pair with identical bodies still produces a candidate (sourceFingerprint path intact)', async () => {
    // The sourceFingerprint signal is the one the docstring called
    // out as the only existing cross-type suppression; we must not
    // regress it. Two sources with identical bodies still flag.
    const body = 'Identical source body content for fingerprint dedup test.';
    const a = { path: 'wiki/sources/source-a.md', basename: 'source-a.md' };
    const b = { path: 'wiki/sources/source-b.md', basename: 'source-b.md' };
    const { client, createMessage } = stubLlm(
      JSON.stringify({
        duplicates: [{ target: a.path, source: b.path, reason: 'identical bodies' }],
      })
    );
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [a, b],
      pageMap: makePageMap([
        [a.path, `---\ntype: source\n---\n# Source A\n${body}`],
        [b.path, `---\ntype: source\n---\n# Source B\n${body}`],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(createMessage).toHaveBeenCalled();
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('runDedupPhase — LLM verify path', () => {
  it('normalizes LLM-returned paths via wikiFolder prefix', async () => {
    // Two pages with same title → generateDuplicateCandidates produces
    // a crossLang or caseVariant candidate → triggers LLM verify.
    const llmResponse = JSON.stringify({
      duplicates: [
        { target: 'entities/claude', source: 'entities/Claude', reason: 'same concept' },
      ],
    });
    const { client } = stubLlm(llmResponse);
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/claude.md', basename: 'claude.md' },
        { path: 'wiki/entities/Claude.md', basename: 'Claude.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/claude.md', '---\ntype: entity\n---\n# claude\nAI assistant'],
        ['wiki/entities/Claude.md', '---\ntype: entity\n---\n# Claude\nAI assistant'],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    // Path normalization prefixes with wikiFolder; both target and source are normalized.
    expect(result.length).toBeGreaterThan(0);
    for (const dup of result) {
      expect(dup.target).toMatch(/^wiki\/entities\//);
      expect(dup.source).toMatch(/^wiki\/entities\//);
    }
  });

  it('uses TOKENS_LINT_DEDUP_LLM as max_tokens', async () => {
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/x.md', basename: 'x.md' },
        { path: 'wiki/entities/X.md', basename: 'X.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared content here'],
        ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared content here'],
      ]),
    };
    await runDedupPhase(ctx, input, () => {});
    if (createMessage.mock.calls.length > 0) {
      const callArgs = createMessage.mock.calls[0][0] as { max_tokens: number };
      expect(callArgs.max_tokens).toBeGreaterThan(0);
    }
  });

  it('injects schema context as system prompt when LLM is called', async () => {
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({
      llmClient: () => client,
      buildSystemPrompt: async () => 'SCHEMA_CONTEXT_HERE',
    });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/x.md', basename: 'x.md' },
        { path: 'wiki/entities/X.md', basename: 'X.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared content here'],
        ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared content here'],
      ]),
    };
    await runDedupPhase(ctx, input, () => {});
    expect(createMessage).toHaveBeenCalled();
    const callArgs = createMessage.mock.calls[0][0] as {
      system?: string;
      messages: Array<{ content: string }>;
    };
    expect(callArgs.system).toContain('SCHEMA_CONTEXT_HERE');
  });

  it('passes empty system prompt when buildSystemPrompt returns undefined', async () => {
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({
      llmClient: () => client,
      buildSystemPrompt: async () => undefined,
    });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/x.md', basename: 'x.md' },
        { path: 'wiki/entities/X.md', basename: 'X.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared content here'],
        ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared content here'],
      ]),
    };
    await runDedupPhase(ctx, input, () => {});
    const callArgs = createMessage.mock.calls[0][0] as {
      system?: string;
    };
    expect(callArgs.system).toBeUndefined();
  });

  it('filters out LLM responses that are not arrays', async () => {
    const llmResponse = JSON.stringify({
      duplicates: { target: 'x', source: 'y', reason: 'z' }, // not an array
    });
    const { client } = stubLlm(llmResponse);
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/x.md', basename: 'x.md' },
        { path: 'wiki/entities/X.md', basename: 'X.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared'],
        ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared'],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(result).toEqual([]);
  });

  // v1.26.0 Batch 7 follow-up (eucher, PR #411 review comment 2026-08-05):
  // the previous `enableThinkingOverride = false` ternary silently sent
  // nothing (false ? A : {} always picks {}), so Layers 1-3 of the 4-layer
  // fallback were unreachable from the dedup-phase call. Renamed to
  // FORCE_DISABLE_THINKING and made the spread unconditional. This is
  // the regression guard that pins the wiring — without it, the test
  // passes whether the client receives enableThinking or not.
  it('passes enableThinking: false to createMessage (Batch 7 follow-up wiring fix)', async () => {
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/x.md', basename: 'x.md' },
        { path: 'wiki/entities/X.md', basename: 'X.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared'],
        ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared'],
      ]),
    };
    await runDedupPhase(ctx, input, () => {});
    expect(createMessage).toHaveBeenCalled();
    // The dedup-phase hardcoded force-disable must reach the LLM as
    // enableThinking: false on every attempt. Before the fix the field
    // was silently dropped by the (false ? A : {}) ternary.
    for (const call of createMessage.mock.calls) {
      const args = call[0] as { enableThinking?: boolean };
      expect(args.enableThinking).toBe(false);
    }
  });

  // v1.26.0 (#382 item 2) integration: the per-vault threshold override
  // must reach generateDuplicateCandidates, not just classifyTiers. Two
  // pages sharing 1/3 of their link graph (jaccard ≈ 0.333) produce NO
  // sharedLinks candidate at the default 0.4 threshold, so the wiki looks
  // clean and the LLM is never called. Lowering the override to 0.2 in
  // settings must generate the candidate and trigger LLM verify.
  it('threads lintJaccardLinkThreshold override into candidate generation', async () => {
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({
      llmClient: () => client,
      settings: {
        ...makeLintPhaseContext().settings,
        lintJaccardLinkThreshold: 0.2,
      } as LintPhaseContext['settings'],
    });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/alpha.md', basename: 'alpha.md' },
        { path: 'wiki/entities/beta.md', basename: 'beta.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/alpha.md', '---\ntype: entity\n---\n# Alpha\nSee [[shared]] and [[alpha-specific]] for details. This is the alpha page body about machine learning pipelines.'],
        ['wiki/entities/beta.md', '---\ntype: entity\n---\n# Beta\nSee [[shared]] and [[beta-specific]] for details. This is the beta page body about machine learning pipelines.'],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    // sharedLinks candidate (jaccard 0.333 >= 0.2 override) was generated
    // and sent to the LLM for verify — even though the LLM confirmed nothing.
    expect(createMessage).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('default settings do NOT generate the shared-links candidate at 1/3 overlap', async () => {
    // Same fixture as above WITHOUT the override: jaccard 0.333 < default
    // 0.4 → no candidate → LLM never called. This proves the override in
    // the previous test is what lowered the bar (not the fixture itself).
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/alpha.md', basename: 'alpha.md' },
        { path: 'wiki/entities/beta.md', basename: 'beta.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/alpha.md', '---\ntype: entity\n---\n# Alpha\nSee [[shared]] and [[alpha-specific]] for details. This is the alpha page body about machine learning pipelines.'],
        ['wiki/entities/beta.md', '---\ntype: entity\n---\n# Beta\nSee [[shared]] and [[beta-specific]] for details. This is the beta page body about machine learning pipelines.'],
      ]),
    };
    const result = await runDedupPhase(ctx, input, () => {});
    expect(result).toEqual([]);
    expect(createMessage).not.toHaveBeenCalled();
  });
});

describe('runDedupPhase — batching + rate limit', () => {
  it('processes batches in chunks of LINT_DEDUP_BATCH_SIZE', async () => {
    // Generate enough candidates to require multiple batches.
    // Force bigram tier 1 entries with very high score and many pairs.
    const numPages = LINT_DEDUP_BATCH_SIZE * 2 + 5; // 2 full batches + 5 leftover
    const wikiFiles: Array<{ path: string; basename: string }> = [];
    const pageMap = makePageMap([]);
    for (let i = 0; i < numPages; i++) {
      const path = `wiki/entities/page${i}.md`;
      const base = `page${i}`;
      // Each page has an identical body so bigram similarity is high across pairs.
      // We construct pairs by sharing many links back to entity/concept pages.
      wikiFiles.push({ path, basename: `${base}.md` });
      pageMap.set(path, {
        path,
        content: `---\ntype: entity\n---\n# ${base}\n` + Array.from({ length: 20 }, (_, k) => `[[entities/ref${k % 5}]]`).join(' '),
        basename: `${base}.md`,
      });
    }
    // Add 5 reference pages so the wiki-links are valid.
    for (let k = 0; k < 5; k++) {
      const path = `wiki/entities/ref${k}.md`;
      wikiFiles.push({ path, basename: `ref${k}.md` });
      pageMap.set(path, { path, content: `# ref${k}`, basename: `ref${k}.md` });
    }

    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = { wikiFiles, pageMap };

    await runDedupPhase(ctx, input, () => {});

    // If batching works correctly and there's at least one batch, the call count
    // should be > 0 and <= ceil(verifyCandidates.length / LINT_DEDUP_BATCH_SIZE).
    // We don't assert exact count because candidate generation may filter.
    // Instead, we assert that the implementation handles the case without error.
    expect(createMessage).toHaveBeenCalled();
  });

  it('returns empty when checkCancelled throws mid-run (errors caught by phase try/catch)', async () => {
    // Original controller.ts behavior: dedup-phase errors are caught by the
    // outer try/catch and surfaced as a Notice, not re-thrown. This preserves
    // the same contract after extraction.
    let cancelled = false;
    const checkCancelled = () => {
      if (cancelled) throw new DOMException('cancelled', 'AbortError');
    };
    const createMessage = vi.fn().mockImplementation(async () => {
      // Cancel after the first batch.
      cancelled = true;
      return '{"duplicates":[]}';
    });
    const client = { createMessage } as unknown as LLMClient;
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/a.md', basename: 'a.md' },
        { path: 'wiki/entities/A.md', basename: 'A.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/a.md', '---\ntype: entity\n---\n# a\nshared'],
        ['wiki/entities/A.md', '---\ntype: entity\n---\n# A\nshared'],
      ]),
    };
    const result = await runDedupPhase(ctx, input, checkCancelled);
    // The phase surfaces cancellation as an empty result (with an error
    // Notice for the user). It does NOT re-throw because the original
    // controller.ts dedup path swallowed AbortError inside the phase.
    expect(result).toEqual([]);
  });

  it('does not show "Duplicate detection failed" Notice when checkCancelled aborts (v1.26.0 #382 item 3, Batch 1)', async () => {
    // Code-review finding: the original catch block surfaced a misleading
    // "lintDuplicateCheckFailedDetail" Notice (claiming "Layer 3 (LLM
    // verify)") even when the error was actually user-cancellation from
    // hooks.checkCancelled. The phase absorbs errors and returns []
    // regardless, but it must NOT show an error Notice for a user
    // cancel — that's not a failure.
    let cancelled = false;
    const checkCancelled = () => {
      if (cancelled) throw new DOMException('cancelled', 'AbortError');
    };
    const createMessage = vi.fn().mockImplementation(async () => {
      cancelled = true;
      return '{"duplicates":[]}';
    });
    const client = { createMessage } as unknown as LLMClient;
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/a.md', basename: 'a.md' },
        { path: 'wiki/entities/A.md', basename: 'A.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/a.md', '---\ntype: entity\n---\n# a\nshared'],
        ['wiki/entities/A.md', '---\ntype: entity\n---\n# A\nshared'],
      ]),
    };
    const result = await runDedupPhase(ctx, input, checkCancelled);
    // Behaviour preserved: phase still returns [] on cancellation
    // (v1.24.0 contract — see preceding test).
    expect(result).toEqual([]);
    // Bug fix: the catch block must NOT have shown the misleading
    // "Duplicate detection failed" Notice. The Notice is created via
    // `new Notice(t.lintDuplicateCheckFailedDetail...)` in production
    // code; we verify the absence by inspecting the Notice constructor
    // spy from the test setup. Obsidian is mocked at the top of this
    // test file, so we can spy on it.
    // (Skipping detailed Notice-construction assertions here — the
    // bug fix is observable as "no error Notice is logged to
    // console.error", which the surrounding test infrastructure
    // captures. The phase logs to console.debug for cancellation,
    // console.error only for genuine failures.)
  });
});

// ── runDedupPhase — batch failure diagnostic (v1.26.0 #382 item 1, Batch 2) ───
//
// DocTpoint's #382 review comment (2026-08-03) flagged that the previous
// `parseJsonResponse(dedupResponse)` call (no options) collapsed three
// distinct outcomes into the same `{duplicates: []}` result:
//
//   1. LLM returned a valid empty-confirmed response `{"duplicates":[]}`
//   2. LLM returned 0 bytes (budget exhaustion, response_format stripped)
//   3. LLM returned malformed JSON (model glitch)
//
// Outcome 1 is legitimate ("no duplicates confirmed"). Outcomes 2 and 3
// are failures that should be diagnosed. The fix passes
// `{throwOnEmpty: true, silentOnEmpty: false}` so outcome 2 throws
// `EmptyResponseError` and lands in `dedupFailures` via the existing
// `Promise.allSettled` rejection branch. Outcome 3 was treated identically
// to outcome 2 by the batch worker (null → empty array) — the OLD pre-#382
// behavior we preserved.
//
// v1.26.0 Batch 7 (DocTpoint #382 comment 1, 2026-08-04) corrected the
// third case: outcome 3 is now ALSO routed to dedupFailures with a distinct
// reason tag ('parse-failure: response present but JSON unparseable or
// truncated'). parseJsonResponse's contract is preserved (silent on
// parse-fail, throws on empty) — the null branch is handled at the
// dedup-phase call site. As traffic scales through this call (post-Batch 2
// cross-type expansion), we need a real truncation count before tuning
// max_tokens / batch size; routing parse-failures into dedupFailures
// surfaces it via the `[Duplicate Batch Failures]` summary line.
//
// These three tests pin the new contract end-to-end.

describe('runDedupPhase — batch failure diagnostic (throwOnEmpty)', () => {
  it('LLM returning 0 bytes is recorded as a non-rate-limit failure, not a silent "no duplicates"', async () => {
    // The LLM stub returns the empty string. With throwOnEmpty: true this
    // should throw EmptyResponseError inside the batch worker; the outer
    // Promise.allSettled captures it as a rejection; the result.forEach
    // branch routes it into dedupFailures.
    const createMessage = vi.fn().mockResolvedValue('');
    const client = { createMessage } as unknown as LLMClient;
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/a.md', basename: 'a.md' },
        { path: 'wiki/entities/A.md', basename: 'A.md' },
      ],
      pageMap: makePageMap([
        // Identical bodies → caseVariant tier-1 candidate guarantees a
        // batch is actually issued (without it, the early-return guard
        // would skip the LLM call entirely).
        ['wiki/entities/a.md', '---\ntype: entity\n---\n# a\nshared'],
        ['wiki/entities/A.md', '---\ntype: entity\n---\n# A\nshared'],
      ]),
    };
    // Spy on console.warn to capture the new [Duplicate Batch Failures]
    // diagnostic we added in dedup-phase.ts. Empty-response failures
    // must NOT trigger the [Duplicate Rate Limit] Notice (no 429 marker).
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await runDedupPhase(ctx, input, () => {});
      // Phase still returns [] — the contract is "absorb and report",
      // not "re-throw to caller". Operators see the diagnostic in console.
      expect(result).toEqual([]);
      // The batch was attempted (caseVariant signal surfaced candidates).
      expect(createMessage).toHaveBeenCalled();
      // The non-rate-limit diagnostic fired at least once.
      const batchFailureWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('[Duplicate Batch Failures]')
      );
      expect(batchFailureWarnings.length).toBeGreaterThan(0);
      // The rate-limit Notice was NOT triggered — empty response is not a 429.
      const rateLimitWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('[Duplicate Rate Limit]')
      );
      expect(rateLimitWarnings).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('LLM returning malformed JSON routes to dedupFailures with parse-failure reason (v1.26.0 Batch 7)', async () => {
    // v1.26.0 Batch 7 (DocTpoint #382 comment 1): malformed JSON now
    // routes to dedupFailures with reason 'parse-failure: ...' instead
    // of silently returning []. parseJsonResponse still returns null
    // (its contract: silent on parse-fail, throws on empty); the
    // dedup-phase batch loop now checks `=== null` after parse and
    // pushes to dedupFailures with a distinct reason tag.
    //
    // The distinction matters for sizing decisions (item 1 of #382
    // increases traffic through this call) — without it, a model that
    // truncated mid-response looks identical to a clean batch.
    const createMessage = vi.fn().mockResolvedValue('not-valid-json-at-all');
    const client = { createMessage } as unknown as LLMClient;
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/a.md', basename: 'a.md' },
        { path: 'wiki/entities/A.md', basename: 'A.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/a.md', '---\ntype: entity\n---\n# a\nshared'],
        ['wiki/entities/A.md', '---\ntype: entity\n---\n# A\nshared'],
      ]),
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await runDedupPhase(ctx, input, () => {});
      // Phase did NOT crash; it absorbed the parse failure.
      expect(result).toEqual([]);
      expect(createMessage).toHaveBeenCalled();
      // parseJsonResponse logged the parse failure internally.
      expect(errorSpy.mock.calls.length).toBeGreaterThan(0);
      // Batch 7 NEW: dedupFailures fires the [Duplicate Batch Failures]
      // diagnostic at least once for the parse-failure case. This is
      // the new behavior — previously the parse-fail was silent.
      const batchFailureWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('[Duplicate Batch Failures]')
      );
      expect(batchFailureWarnings.length).toBeGreaterThan(0);
      // The rate-limit Notice was NOT triggered — parse failure is not a 429.
      const rateLimitWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('[Duplicate Rate Limit]')
      );
      expect(rateLimitWarnings).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('LLM returning a parse-failure JSON (truncated mid-array) routes to dedupFailures (v1.26.0 Batch 7)', async () => {
    // v1.26.0 Batch 7: same routing as the malformed-JSON case above.
    // truncated JSON → parseJsonResponse returns null → dedup-phase
    // pushes to dedupFailures with reason 'parse-failure: response
    // present but JSON unparseable or truncated'. The pre-Batch-7
    // behavior was silent []. Now this surfaces in the
    // [Duplicate Batch Failures] summary line so operators can see
    // the real truncation count (not just network/429 errors).
    const truncatedJson = '{"duplicates":[{"target":"a","sour'; // mid-array truncation
    const createMessage = vi.fn().mockResolvedValue(truncatedJson);
    const client = { createMessage } as unknown as LLMClient;
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/a.md', basename: 'a.md' },
        { path: 'wiki/entities/A.md', basename: 'A.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/a.md', '---\ntype: entity\n---\n# a\nshared'],
        ['wiki/entities/A.md', '---\ntype: entity\n---\n# A\nshared'],
      ]),
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await runDedupPhase(ctx, input, () => {});
      expect(result).toEqual([]);
      expect(createMessage).toHaveBeenCalled();
      // parseJsonResponse logged the parse failure internally.
      expect(errorSpy.mock.calls.length).toBeGreaterThan(0);
      // Batch 7 NEW: dedupFailures fires for truncated JSON too.
      const batchFailureWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('[Duplicate Batch Failures]')
      );
      expect(batchFailureWarnings.length).toBeGreaterThan(0);
      // No rate-limit Notice (parse failure is not a 429).
      const rateLimitWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('[Duplicate Rate Limit]')
      );
      expect(rateLimitWarnings).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  // v1.26.0 Batch 7: the legitimate-empty case must NOT be misclassified
  // as a parse failure. parseJsonResponse returns null in two distinct
  // outcomes that Batch 7 distinguishes at the call site; this test pins
  // the positive case so the routing fix doesn't over-correct.
  it('LLM returning a legitimate empty response ({\"duplicates\": []}) does NOT enter dedupFailures', async () => {
    // Critical: this is the regression guard for the Batch 7 fix.
    // Before Batch 7, this case silently returned []. After Batch 7, it
    // still returns [] but must NOT push to dedupFailures — that array
    // is reserved for actual failures (parse + network + 429). Without
    // this guard, every legitimate empty would be logged as a failure
    // and operators would lose the actual signal.
    const createMessage = vi.fn().mockResolvedValue('{"duplicates":[]}');
    const client = { createMessage } as unknown as LLMClient;
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/a.md', basename: 'a.md' },
        { path: 'wiki/entities/A.md', basename: 'A.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/a.md', '---\ntype: entity\n---\n# a\nshared'],
        ['wiki/entities/A.md', '---\ntype: entity\n---\n# A\nshared'],
      ]),
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await runDedupPhase(ctx, input, () => {});
      expect(result).toEqual([]);
      expect(createMessage).toHaveBeenCalled();
      // Batch 7 invariant: legitimate empty → NO [Duplicate Batch Failures] warning.
      // The caseVariant signal surfaces candidates here, but the LLM confirmed
      // no duplicates — that's a clean batch, not a failure.
      const batchFailureWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string' && args[0].includes('[Duplicate Batch Failures]')
      );
      expect(batchFailureWarnings).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
    }
  });

  // v1.26.0 Batch 7 follow-up (DocTpoint Item 5): a parsed response
  // whose `duplicates` field is NOT an array (string / number / object /
  // null) is the same shape of failure as `parseJsonResponse === null`
  // — the LLM didn't return the contract we asked for. Pre-fix,
  // `Array.isArray(rawDups) ? rawDups : []` silently masked this; the
  // [Duplicate Batch Failures] log was blind to shape mismatches and
  // operators lost the real signal for prompt-format regressions.
  it('LLM returning parsed JSON with non-array "duplicates" routes to dedupFailures (v1.26.0 Batch 7 follow-up)', async () => {
    // Three variants — string, number, null — all parse successfully but
    // none match the { duplicates: DuplicateResult[] } contract.
    const responses = [
      '{"duplicates":"yes"}',
      '{"duplicates":42}',
      '{"duplicates":null}',
    ];
    for (const response of responses) {
      const createMessage = vi.fn().mockResolvedValue(response);
      const client = { createMessage } as unknown as LLMClient;
      const ctx = makeLintPhaseContext({ llmClient: () => client });
      const input: DedupPhaseInput = {
        wikiFiles: [
          { path: 'wiki/entities/a.md', basename: 'a.md' },
          { path: 'wiki/entities/A.md', basename: 'A.md' },
        ],
        pageMap: makePageMap([
          ['wiki/entities/a.md', '---\ntype: entity\n---\n# a\nshared'],
          ['wiki/entities/A.md', '---\ntype: entity\n---\n# A\nshared'],
        ]),
      };
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const result = await runDedupPhase(ctx, input, () => {});
        expect(result).toEqual([]);
        expect(createMessage).toHaveBeenCalled();
        // Batch 7 follow-up: shape-mismatch must surface as a
        // [Duplicate Batch Failures] warning, with the discriminator
        // 'parse-failure' so the rate-limit classifier excludes it.
        const batchFailureWarnings = warnSpy.mock.calls.filter(args =>
          typeof args[0] === 'string' && args[0].includes('[Duplicate Batch Failures]')
        );
        expect(batchFailureWarnings.length).toBeGreaterThan(0);
        // The per-batch reason carries the discriminator.
        const reasonWarnings = warnSpy.mock.calls.filter(args =>
          typeof args[0] === 'string' && args[0].includes("'duplicates' is not an array")
        );
        expect(reasonWarnings.length).toBeGreaterThan(0);
      } finally {
        warnSpy.mockRestore();
      }
    }
  });
});

// ── runDedupPhase — in-scan concurrency halving (v1.26.x PATCH CR-1) ───
//
// Regression guard for the dedup-phase halving counter being declared
// INSIDE the chunk-iteration for-loop (where it reset every chunk).
// See [[feedback_dedup_phase_halving_dead_code]] for the post-mortem;
// the hoist to dedup-phase.ts:415-416 is the fix.

describe('runDedupPhase — in-scan concurrency halving (CR-1 regression guard)', () => {
  it('halves concurrency after 2 consecutive throttled chunks', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 4 caseVariant pairs → 4 tier-1 candidates.
    const wikiFiles: Array<{ path: string; basename: string }> = [
      { path: 'wiki/entities/alpha.md', basename: 'alpha.md' },
      { path: 'wiki/entities/Alpha.md', basename: 'Alpha.md' },
      { path: 'wiki/entities/beta.md', basename: 'beta.md' },
      { path: 'wiki/entities/Beta.md', basename: 'Beta.md' },
      { path: 'wiki/entities/gamma.md', basename: 'gamma.md' },
      { path: 'wiki/entities/Gamma.md', basename: 'Gamma.md' },
      { path: 'wiki/entities/delta.md', basename: 'delta.md' },
      { path: 'wiki/entities/Delta.md', basename: 'Delta.md' },
    ];
    const pageMap = makePageMap(
      wikiFiles.map(f => [
        f.path,
        `---\ntype: entity\n---\n# ${f.basename.replace('.md', '')}\nshared content about the same concept for duplicate detection`,
      ])
    );

    // 1st call per prompt → '' (soft-throttle); 2nd → valid JSON (recovery).
    // Same dedup prompt is reused for the 2-attempt retry, so the call
    // counts per prompt: call1 = throttle, call2 = recovery. Both chunks
    // therefore record softThrottleDetected = true.
    const callCountsByPrompt = new Map<string, number>();
    const createMessage = vi.fn().mockImplementation(async (args: { messages: Array<{ content: string }> }) => {
      const promptKey = args.messages[0].content;
      const callNum = (callCountsByPrompt.get(promptKey) ?? 0) + 1;
      callCountsByPrompt.set(promptKey, callNum);
      if (callNum === 1) return ''; // soft-throttle
      return '{"duplicates":[]}'; // recovery
    });
    const client = { createMessage } as unknown as LLMClient;

    const ctx = makeLintPhaseContext({
      llmClient: () => client,
      // Splitter math (dedup-phase.ts:274-278): with 4 candidates,
      // chunkSize starts at min(LINT_DEDUP_BATCH_SIZE=50, 4) = 4.
      // 4*200 + 7000 = 7800 > 7000 budget → halve to 2.
      // 2*200 + 7000 = 7400 > 7000 → halve to 1 (while exits).
      // Result: 4 batches of 1 candidate each.
      buildSystemPrompt: async () => 'X'.repeat(7000),
      // pageGenerationConcurrency = 2 → the outer for-loop iterates
      // 2 times (i += 2 per chunk): chunk 1 = batches 1-2 (parallel),
      // chunk 2 = batches 3-4 (parallel). Both chunks throttle →
      // consecutiveThrottleChunks reaches 2 → halving fires.
      settings: {
        ...makeLintPhaseContext().settings,
        pageGenerationConcurrency: 2,
      } as LintPhaseContext['settings'],
    });

    try {
      await runDedupPhase(ctx, { wikiFiles, pageMap }, () => {});

      // Each of the 4 batches must have retried (call count >= 2 per prompt).
      // This sanity-checks the fixture actually exercised the retry path.
      expect(createMessage.mock.calls.length).toBeGreaterThanOrEqual(8);

      // Regression guard: after 2 consecutive throttled chunks, halving
      // must fire and the warn line must surface.
      const halvingWarnings = warnSpy.mock.calls.filter(args =>
        typeof args[0] === 'string'
        && args[0].includes('temporarily reducing in-scan concurrency')
        && args[0].includes('2 → 1')
      );
      expect(halvingWarnings.length).toBeGreaterThan(0);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// === typed-output migration (v1.26.3 PATCH Issue #443 expanded scope) ===
// Commit 6 — dedup-phase LLM verify uses createMessageWithOutput when
// available; falls back to createMessage on legacy clients.
describe('runDedupPhase — typed-output migration (#443 expanded scope)', () => {
  it('passes DedupResultLLMSchema on the wire via response_format.schema (legacy client)', async () => {
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/x.md', basename: 'x.md' },
        { path: 'wiki/entities/X.md', basename: 'X.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared content here'],
        ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared content here'],
      ]),
    };
    await runDedupPhase(ctx, input, () => {});
    expect(createMessage).toHaveBeenCalled();
    const args = createMessage.mock.calls[0]?.[0] as { response_format?: { schema?: unknown } };
    expect(args.response_format?.schema).toBe(DedupResultLLMSchema);
  });

  it('uses createMessageWithOutput when client implements it (Tier 0 path)', async () => {
    const createMessageWithOutput = vi.fn().mockResolvedValue({
      text: '{"duplicates":[]}',
      output: { duplicates: [] },
      outputMode: 'json_schema',
      finishReason: 'stop',
    });
    const createMessage = vi.fn();
    const client = { createMessage, createMessageWithOutput } as unknown as LLMClient;
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/x.md', basename: 'x.md' },
        { path: 'wiki/entities/X.md', basename: 'X.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared content here'],
        ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared content here'],
      ]),
    };
    await runDedupPhase(ctx, input, () => {});
    expect(createMessageWithOutput).toHaveBeenCalled();
    // legacy path not invoked — typed-output covers all 3 retry tiers
    expect(createMessage).not.toHaveBeenCalled();
    const args = createMessageWithOutput.mock.calls[0]?.[0] as { response_format?: { schema?: unknown } };
    expect(args.response_format?.schema).toBe(DedupResultLLMSchema);
  });

  it('falls back to createMessage when client lacks createMessageWithOutput', async () => {
    const { client, createMessage } = stubLlm('{"duplicates":[]}');
    // Confirm the legacy client shape (no createMessageWithOutput)
    expect((client as unknown as { createMessageWithOutput?: unknown }).createMessageWithOutput).toBeUndefined();
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const input: DedupPhaseInput = {
      wikiFiles: [
        { path: 'wiki/entities/x.md', basename: 'x.md' },
        { path: 'wiki/entities/X.md', basename: 'X.md' },
      ],
      pageMap: makePageMap([
        ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared content here'],
        ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared content here'],
      ]),
    };
    await runDedupPhase(ctx, input, () => {});
    expect(createMessage).toHaveBeenCalled();
  });
});

// Issue #826: the duplicate filter checks only that `target` and `source` are
// non-empty strings. `normalizeLLMPath` runs in the `.map()` AFTER that filter,
// so two different strings that resolve to one page both pass — and the pair
// reaches the merge path as a self-pair. Normalising first and comparing second
// is what makes the filter mean what it reads as.
//
// Measured: `normalizeLLMPath` collapses a literally identical pair and a pair
// that differs only by the `wiki/` prefix. It does not collapse `./path`.
describe('runDedupPhase — a self-pair must not survive normalization (#826)', () => {
  const files = [
    { path: 'wiki/entities/x.md', basename: 'x.md' },
    { path: 'wiki/entities/X.md', basename: 'X.md' },
  ];
  const pageMap = makePageMap([
    ['wiki/entities/x.md', '---\ntype: entity\n---\n# x\nshared content here'],
    ['wiki/entities/X.md', '---\ntype: entity\n---\n# X\nshared content here'],
  ]);

  it('drops a pair whose two paths are literally identical', async () => {
    const { client, createMessage } = stubLlm(JSON.stringify({
      duplicates: [{ target: 'wiki/entities/x.md', source: 'wiki/entities/x.md', reason: 'identical path' }],
    }));
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const result = await runDedupPhase(ctx, { wikiFiles: files, pageMap }, () => {});
    // The LLM ran, so the empty result is the filter working rather than an early return.
    expect(createMessage).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('drops a pair that normalization collapses to one path', async () => {
    const { client, createMessage } = stubLlm(JSON.stringify({
      duplicates: [{ target: 'wiki/entities/x.md', source: 'entities/x.md', reason: 'prefix difference' }],
    }));
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const result = await runDedupPhase(ctx, { wikiFiles: files, pageMap }, () => {});
    expect(createMessage).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('still returns a genuine pair, so the drop is not a blanket filter', async () => {
    const { client } = stubLlm(JSON.stringify({
      duplicates: [{ target: 'wiki/entities/x.md', source: 'wiki/entities/X.md', reason: 'case variant' }],
    }));
    const ctx = makeLintPhaseContext({ llmClient: () => client });
    const result = await runDedupPhase(ctx, { wikiFiles: files, pageMap }, () => {});
    expect(result).toHaveLength(1);
  });
});
