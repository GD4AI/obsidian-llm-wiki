// Issue #758 — the id filter and the post-fetch reconcile.
//
// Both rules lived inside the settings tab's fetch callback, where no test could
// reach them. The filter had already shipped wrong: LM Studio's Hub-managed
// models are keyed `publisher/model`, every non-ollama provider rejected `/`, so
// those models could not appear in the list at all. The reconcile then rewrote a
// hand-typed id to the first listed entry and cleared `useCustomModel`, so the
// user's working value was destroyed as well.

import { describe, it, expect } from 'vitest';
import { filterModelIds, isUsableModelId, reconcileModelSelection } from '../../core/model-id-filter';

describe('#758 — which ids a catalogue may offer', () => {
  it('keeps a namespaced LM Studio Hub id', () => {
    // The report's two, verbatim: Hub-managed downloads alongside flat keys.
    const ids = [
      'ornith-1.5-35b-a3b-mlx',
      'qwen/qwen3.6-35b-a3b',
      'openai/gpt-oss-120b',
    ];
    expect(filterModelIds('lmstudio', ids)).toEqual(ids);
  });

  it('still rejects a variant separator for a provider that does not use it', () => {
    // `/` is a namespace; `:` is provider-specific tag/variant syntax. Only the
    // second is a reason to drop an id.
    expect(isUsableModelId('lmstudio', 'foo:bar')).toBe(false);
    expect(isUsableModelId('openai', 'qwen/qwen3.6-35b-a3b')).toBe(false);
  });

  it('leaves OpenRouter alone and keeps Ollama\u2019s own rule', () => {
    // OpenRouter uses ':' for catalogue variants, so nothing there is a reason to
    // drop an id. Ollama's `/api/tags` lists a bare name and its
    // `library/`-qualified twin, so the `/` rejection stays — this fix does not
    // reach any provider but the one that was reported.
    expect(isUsableModelId('openrouter', 'liquid/lfm-2.5-2.6b:free')).toBe(true);
    expect(isUsableModelId('ollama', 'llama3.2:latest')).toBe(true);
    expect(isUsableModelId('ollama', 'library/llama3.2')).toBe(false);
    expect(isUsableModelId('openai', 'qwen/qwen3.6-35b-a3b')).toBe(false);
  });

  it('drops non-strings', () => {
    // The input is a parsed HTTP response, so an endpoint returning objects must
    // contribute nothing rather than an "[object Object]" entry.
    expect(filterModelIds('openai', ['ok', 42, null, { id: 'x' }, undefined])).toEqual(['ok']);
  });
});

describe('#758 — what a successful fetch does to the chosen model', () => {
  it('leaves a chosen model alone when the fetch did not list it', () => {
    // The bug. `qwen/qwen3.6-35b-a3b` works at request time against this
    // endpoint, and the old form set the field to `availableModels[0]` and
    // `useCustomModel = false` — silently taking away a value the user had
    // already shown to be valid.
    expect(reconcileModelSelection('qwen/qwen3.6-35b-a3b', ['ornith-1.5-35b-a3b-mlx'])).toEqual({});
  });

  it('clears the custom flag when the chosen model was in the list', () => {
    expect(reconcileModelSelection('gpt-4o', ['gpt-4o', 'gpt-4o-mini'])).toEqual({
      useCustomModel: false,
    });
  });

  it('seeds from the catalogue when nothing is chosen yet', () => {
    expect(reconcileModelSelection(undefined, ['a', 'b'])).toEqual({
      model: 'a',
      useCustomModel: false,
    });
    expect(reconcileModelSelection('', ['a'])).toEqual({ model: 'a', useCustomModel: false });
  });

  it('changes nothing when the fetch returned nothing usable', () => {
    // The empty branch is handled by the caller (it shows the failure Notice and
    // sets the custom flag itself), so this must not also seed a field.
    expect(reconcileModelSelection('typed', [])).toEqual({});
    expect(reconcileModelSelection(undefined, [])).toEqual({});
  });

  it('is idempotent for a typed id across repeated fetches', () => {
    // The failure was silent and repeatable: every fetch took the value back.
    let model: string | undefined = 'qwen/qwen3.6-35b-a3b';
    let useCustomModel = true;
    for (const fetched of [['a'], ['a', 'b'], []]) {
      const patch = reconcileModelSelection(model, fetched);
      if (patch.model !== undefined) model = patch.model;
      if (patch.useCustomModel !== undefined) useCustomModel = patch.useCustomModel;
    }
    expect(model).toBe('qwen/qwen3.6-35b-a3b');
    expect(useCustomModel).toBe(true);
  });
});
