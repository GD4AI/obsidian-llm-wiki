// #912 (item 2 of #904's remainder): the plugin guesses a model's output
// limit at 128,000 tokens and learns the real one by halving when a provider
// rejects the value. That learning used to live in local variables inside one
// `analyzeSource` call, so a 20-note ingest paid for the same two rejected
// requests 20 times.
//
// Keyed by (baseURL, model), the same composite key `TokenKeyProber` and
// `OutputModeProber` use, and for the same reason: the limit is a property of
// the backend behind the model, not of the gateway URL. A per-model routing
// proxy (LiteLLM, one-api) or a multi-model LM Studio can host models with
// different limits behind one baseURL, so a per-URL key would spread one
// model's verdict over its siblings.
//
// Memory only, deliberately. The cost of losing the entry on restart is one
// probe per model per session; the cost of persisting it is a new `data.json`
// field plus a migration story for every vault that upgrades, to save those
// same two requests once per launch.

import { MAX_TOKENS_BATCH } from '../constants';

export class OutputCeilingCache {
  private readonly ceilings: Map<string, number> = new Map();

  /** Composite key: baseURL + model, so sibling models share no state. */
  private key(baseUrl: string, model: string): string {
    return `${baseUrl}::${model}`;
  }

  /** The ceiling this pair was last seen to accept, or `undefined`. */
  get(baseUrl: string, model: string): number | undefined {
    return this.ceilings.get(this.key(baseUrl, model));
  }

  /** Record a ceiling the provider accepted after rejecting a larger one. */
  set(baseUrl: string, model: string, ceiling: number): void {
    this.ceilings.set(this.key(baseUrl, model), ceiling);
  }

  /**
   * Drop entries. A bare baseURL clears every model reached through it, which
   * is what a changed gateway URL or a signed-out account needs. Called by
   * tests between cases, so one case cannot inherit another's verdict.
   */
  invalidate(baseUrl?: string): void {
    if (baseUrl === undefined) {
      this.ceilings.clear();
      return;
    }
    const prefix = `${baseUrl}::`;
    for (const k of [...this.ceilings.keys()]) {
      if (k.startsWith(prefix)) this.ceilings.delete(k);
    }
  }

  /** Number of remembered pairs. Diagnostics and tests. */
  get size(): number {
    return this.ceilings.size;
  }
}

/**
 * One cache for the process. The analyzer is constructed per engine, and the
 * engine can be rebuilt when settings change; a cache on the analyzer would be
 * lost exactly when the user changes a setting and starts a new ingest, which
 * is when the saving matters most.
 */
export const outputCeilingCache = new OutputCeilingCache();

/** The two settings that identify a pair. Structural, so a full `Settings` fits. */
export interface CeilingKey {
  baseUrl: string;
  model: string;
}

/**
 * The ceiling to start a note from: what an earlier note learned for this
 * pair, or `outputCeiling` when nothing is known.
 *
 * A learned value can only lower the starting point. The user's own choice and
 * the context window still bound it, and a floor of `MAX_TOKENS_BATCH` keeps a
 * learned value from strangling a batch that only just fit.
 */
export function startCeilingFor(key: CeilingKey, outputCeiling: number): number {
  const learned = outputCeilingCache.get(key.baseUrl, key.model);
  if (learned === undefined) return outputCeiling;
  return Math.min(outputCeiling, Math.max(learned, MAX_TOKENS_BATCH));
}

/** Record a ceiling the provider just accepted, and hand it back for reuse. */
export function rememberCeiling(key: CeilingKey, ceiling: number): number {
  outputCeilingCache.set(key.baseUrl, key.model, ceiling);
  return ceiling;
}
