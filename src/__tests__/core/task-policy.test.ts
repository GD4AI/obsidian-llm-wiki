// Issue #481 follow-up: per-step output mode and thinking.
//
// The property that matters most here is the same one #208's resolver pins:
// an unset policy must leave every step exactly as it was. Everything else in
// this module is opt-in, and an opt-in that changes the default path is a
// regression no measurement would catch — both arms would have moved.
//
// The second group covers the parser. It throws rather than skipping bad
// entries on purpose: a skipped entry produces a run whose manifest names an
// arm it did not execute, and the manifest is the only record tying a number
// to its conditions.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TASK_POLICY,
  formatTaskPolicyMap,
  parseTaskPolicySpec,
  resolveTaskPolicy,
  thinkingEffort,
} from '../../core/task-policy';

// Every `task:` label a production call site passes today.
const TASK_LABELS = [
  'extract', 'extract-retry', 'lemma-classify', 'type-repair', 'merge-triage', 'merge-body',
  'reviewed-append', 'related-page', 'complementary', 'page-generate',
  'source-page', 'pdf-convert', 'dedup', 'conversation-extract',
  'conversation-extract-retry', 'conversation-page', 'conversation-save-dedup',
  'contradictions', 'fix-dead-link', 'link-orphan', 'lint-alias', 'lint-dedup',
  'lint-tag-fix', 'query-view-evaluate', 'schema-suggest', 'welcome-translate',
];

// Issue #524: the two steps with a built-in baseline. Every other step is
// still "change nothing".
const BUILTIN_TEXT_STEPS = ['extract', 'extract-retry'];
const UNTOUCHED_LABELS = TASK_LABELS.filter(t => !BUILTIN_TEXT_STEPS.includes(t));

describe('resolveTaskPolicy — the default path is untouched', () => {
  it('resolves every known task without a built-in baseline to the default when no policy is set', () => {
    for (const task of UNTOUCHED_LABELS) {
      expect(resolveTaskPolicy(undefined, task)).toEqual(DEFAULT_TASK_POLICY);
      expect(resolveTaskPolicy({}, task)).toEqual(DEFAULT_TASK_POLICY);
    }
  });

  it('resolves an untagged call to the default', () => {
    expect(resolveTaskPolicy(undefined, undefined)).toEqual(DEFAULT_TASK_POLICY);
    expect(resolveTaskPolicy({ extract: { outputMode: 'text_prompt', thinking: 'on' } }, undefined))
      .toEqual(DEFAULT_TASK_POLICY);
  });

  it('leaves the steps a policy does not name alone', () => {
    const policies = parseTaskPolicySpec('extract=text:on');
    expect(resolveTaskPolicy(policies, 'extract'))
      .toEqual({ outputMode: 'text_prompt', thinking: 'on' });
    for (const task of UNTOUCHED_LABELS.filter(t => t !== 'extract')) {
      expect(resolveTaskPolicy(policies, task)).toEqual(DEFAULT_TASK_POLICY);
    }
  });
});

// Issue #524: the built-in baseline. Extraction under `json_schema` degraded
// on LM Studio / gemma-4-26b in 3 of 3 replays of the real request, twice
// silently; the server logs show 14 loops in 125 schema-mode extraction calls
// against 9 in 2,368 text-mode ones. The baseline puts the one long-output
// step back on the wire shape every user had before 1.26.3, and nothing
// else moves. A user entry or a wildcard must still win — the field is what
// makes the comparison run possible.
describe('resolveTaskPolicy — built-in baseline (#524)', () => {
  it('pins extract and extract-retry to text mode when no policy is set', () => {
    for (const task of BUILTIN_TEXT_STEPS) {
      expect(resolveTaskPolicy(undefined, task)).toEqual({ outputMode: 'text_prompt', thinking: 'default' });
      expect(resolveTaskPolicy({}, task)).toEqual({ outputMode: 'text_prompt', thinking: 'default' });
    }
  });

  it('keeps the baseline for the steps a policy does not name', () => {
    const policies = parseTaskPolicySpec('merge-triage=text:on');
    for (const task of BUILTIN_TEXT_STEPS) {
      expect(resolveTaskPolicy(policies, task)).toEqual({ outputMode: 'text_prompt', thinking: 'default' });
    }
  });

  it('lets a user entry move the step back onto the schema', () => {
    const policies = parseTaskPolicySpec('extract=schema:off');
    expect(resolveTaskPolicy(policies, 'extract')).toEqual({ outputMode: 'json_schema', thinking: 'off' });
    expect(resolveTaskPolicy(policies, 'extract-retry')).toEqual({ outputMode: 'text_prompt', thinking: 'default' });
  });

  it('lets a wildcard win over the baseline', () => {
    const policies = parseTaskPolicySpec('*=schema:-');
    for (const task of BUILTIN_TEXT_STEPS) {
      expect(resolveTaskPolicy(policies, task)).toEqual({ outputMode: 'json_schema', thinking: 'default' });
    }
  });

  it('does not touch the thinking axis', () => {
    for (const task of BUILTIN_TEXT_STEPS) {
      expect(resolveTaskPolicy(undefined, task).thinking).toBe('default');
    }
  });
});

describe('resolveTaskPolicy — wildcard', () => {
  it('applies to every step that has no entry of its own', () => {
    const policies = parseTaskPolicySpec('*=-:off,extract=text:on');
    expect(resolveTaskPolicy(policies, 'extract'))
      .toEqual({ outputMode: 'text_prompt', thinking: 'on' });
    expect(resolveTaskPolicy(policies, 'page-generate'))
      .toEqual({ outputMode: 'default', thinking: 'off' });
    expect(resolveTaskPolicy(policies, 'merge-triage'))
      .toEqual({ outputMode: 'default', thinking: 'off' });
  });
});

describe('parseTaskPolicySpec', () => {
  it('accepts the short aliases and the wire names', () => {
    expect(parseTaskPolicySpec('a=schema,b=json,c=text,d=-')).toEqual({
      a: { outputMode: 'json_schema', thinking: 'default' },
      b: { outputMode: 'json_object', thinking: 'default' },
      c: { outputMode: 'text_prompt', thinking: 'default' },
      d: { outputMode: 'default', thinking: 'default' },
    });
    expect(parseTaskPolicySpec('a=json_schema:on')).toEqual({
      a: { outputMode: 'json_schema', thinking: 'on' },
    });
  });

  it('tolerates whitespace and empty entries', () => {
    expect(parseTaskPolicySpec(' extract = text : on , , merge-triage=text ')).toEqual({
      extract: { outputMode: 'text_prompt', thinking: 'on' },
      'merge-triage': { outputMode: 'text_prompt', thinking: 'default' },
    });
  });

  it('returns an empty map for an empty spec', () => {
    expect(parseTaskPolicySpec('')).toEqual({});
    expect(parseTaskPolicySpec('   ')).toEqual({});
  });

  it('throws on a malformed entry rather than skipping it', () => {
    expect(() => parseTaskPolicySpec('extract')).toThrow(/expected "task=mode/);
    expect(() => parseTaskPolicySpec('=text')).toThrow(/expected "task=mode/);
    expect(() => parseTaskPolicySpec('extract=grammar')).toThrow(/unknown mode "grammar"/);
    expect(() => parseTaskPolicySpec('extract=text:maybe')).toThrow(/unknown thinking "maybe"/);
  });

  it('round-trips through formatTaskPolicyMap', () => {
    const spec = 'extract=text:on,page-generate=-:off';
    const parsed = parseTaskPolicySpec(spec);
    expect(parseTaskPolicySpec(formatTaskPolicyMap(parsed))).toEqual(parsed);
  });
});

// The bounded levels (#481 follow-up). Unbounded thinking at the extraction
// step spent the whole 16000-token batch budget in the reasoning channel and
// returned nothing, twice, so "may think" and "may think this much" had to
// become different settings.
describe('parseTaskPolicySpec — bounded thinking', () => {
  it('accepts the three effort levels', () => {
    expect(parseTaskPolicySpec('extract=text:low,a=text:medium,b=text:high')).toEqual({
      extract: { outputMode: 'text_prompt', thinking: 'low' },
      a: { outputMode: 'text_prompt', thinking: 'medium' },
      b: { outputMode: 'text_prompt', thinking: 'high' },
    });
  });

  it('names them in the error for an unknown level', () => {
    expect(() => parseTaskPolicySpec('extract=text:lowish'))
      .toThrow(/expected one of -, off, on, low, medium, high/);
  });

  // #525 review: last-one-wins was silent, and this module's whole point is
  // that a spec is the record of which arm a number came from. Two entries
  // for one task state two arms; picking one quietly is the manifest lie the
  // parser refuses everywhere else.
  it('rejects a task set twice instead of letting the last entry win', () => {
    expect(() => parseTaskPolicySpec('extract=text:on,extract=schema:off'))
      .toThrow(/"extract" is set twice/);
  });

  // #543: the duplicate-task guard relied on `Object.prototype.hasOwnProperty.call`
  // against a plain object literal, which leaves `__proto__` as an inherited
  // accessor — `policies['__proto__'] = ...` never becomes an own property, so
  // a second `__proto__=...` entry passed the guard and silently mutated the
  // object's prototype instead. The contract "a task named twice is an error"
  // must hold for every key the parser accepts as a task name.
  it('rejects a __proto__ entry set twice (closes the hasOwnProperty.call bypass, #543)', () => {
    expect(() => parseTaskPolicySpec('__proto__=text:on,__proto__=schema:off'))
      .toThrow(/"__proto__" is set twice/);
  });

  it('rejects a repeated wildcard too', () => {
    expect(() => parseTaskPolicySpec('*=text,*=schema')).toThrow(/set twice/);
  });

  it('still accepts different tasks that share a mode', () => {
    const policies = parseTaskPolicySpec('extract=text:on,merge-triage=text:on');
    expect(Object.keys(policies)).toEqual(['extract', 'merge-triage']);
  });

  it('reports an effort only for the levels that name one', () => {
    expect(thinkingEffort('low')).toBe('low');
    expect(thinkingEffort('high')).toBe('high');
    expect(thinkingEffort('on')).toBeUndefined();
    expect(thinkingEffort('off')).toBeUndefined();
    expect(thinkingEffort('default')).toBeUndefined();
  });
});

describe('json_schema_strict as a pinnable mode (Issue #658)', () => {
  it('parses `strict` and `json_schema_strict` to the strict tier', () => {
    expect(parseTaskPolicySpec('extract=strict:off').extract?.outputMode).toBe('json_schema_strict');
    expect(parseTaskPolicySpec('*=json_schema_strict:default')['*']?.outputMode).toBe('json_schema_strict');
  });
});
