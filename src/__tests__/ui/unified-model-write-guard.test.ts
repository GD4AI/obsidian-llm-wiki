// Issue #467 — one sanctioned way to write the unified model.
//
// Background: the unified `model` field owns three per-task overrides
// (`ingestModel` / `lintModel` / `queryModel`). Changing the unified value has to
// clear them, or live task routing keeps using the old per-task model while the
// picker shows the new one. That was the 2026-07-13 UX bug, and v1.24.1 Phase
// 5.5.0 fixed it inside `setFieldValue('model', …)` → `cascadeUnifiedModelChange`.
//
// PR #462 then removed a *commit-time* belt-and-suspenders cascade, on the grounds
// that per-task ownership belongs to the live-edit path. That is right, but it
// left the guarantee resting on every future writer remembering the rule: three
// sites already assign `tempSettings.model` directly, and #467's own words are
// that "the next contributor who adds any 'write tempSettings.model' feature will
// silently reintroduce" the bug.
//
// **This test reads the production tree rather than mirroring the rule.**
// `settings-cascade.test.ts` re-implements the cascade and notes in its header
// that "production code ... changes, update this mirror to match" — a mirror
// cannot fail when the thing it mirrors moves, which is exactly the failure mode
// #467 is about. Reaching the same conclusion from the source cannot drift.
//
// The three known sites are not exempted here. They are expected to route through
// the sanctioned entry, so their names appearing below is a failure, not a waiver
// — that is the difference between pinning the current state and pinning the rule.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(__dirname, '..', '..');

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue;
      out.push(...productionFiles(full));
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Strip comments so a comment *describing* a direct write is not read as one. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(line => {
      const i = line.indexOf('//');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

/** POSIX-normalised repo-relative path — `relative` yields backslashes on win32. */
const relPosix = (f: string): string => relative(SRC, f).split(sep).join('/');

/** The one module allowed to hold the write: it owns `setFieldValue`. */
const OWNER = 'ui/settings.ts';

function writers(): string[] {
  return productionFiles(SRC)
    .map(f => ({ rel: relPosix(f), code: stripComments(readFileSync(f, 'utf8')) }))
    // `(?!=)` because the guard is about assignment: `tempSettings.model === ''`
    // is a read, and it failed here as "a writer bypassed setFieldValue".
    .filter(({ rel, code }) => rel !== OWNER && /\btempSettings\.model\s*=(?!=)/.test(code))
    .map(({ rel }) => rel);
}

/**
 * Functions outside the tab that assign `.model` on a settings object they
 * **receive**, instead of on `this.tempSettings`.
 *
 * A literal search cannot see that shape, and it is not hypothetical: the Codex
 * policy module writes the field twice this way, through a parameter typed
 * `CodexModelPolicyTarget` — which is why the sentence that used to sit above
 * `syncModelsFromPlugin`, "`tempSettings.model` is only assignable here", was
 * false. #467's own risk case is this shape too, because a preset or profile
 * helper is most naturally written as `applyPreset(tab.tempSettings, preset)`.
 *
 * So the guard names the sanctioned holders instead of the syntax. Declared
 * rather than inferred, because a third one appearing has to be a decision: an
 * unlisted writer is reported, including one in an already-listed file.
 */
const PARAM_WRITER_ALLOWLIST = [
  'core/openai-codex-model-policy.ts:applyCodexModelPolicy',
  'core/openai-codex-model-policy.ts:preserveCodexRuntimeModelState',
];

/**
 * The parameter names and types that mean "this object is the temp settings".
 * Two ways to qualify, and the second exists because the policy module does not
 * name its parameter `tempSettings`: a `CodexModelPolicyTarget` annotation, or
 * the name itself.
 */
function paramAcceptsSettings(code: string, ident: string): boolean {
  if (ident === 'tempSettings') return true;
  return new RegExp(`\\b${ident}\\s*:\\s*CodexModelPolicyTarget`).test(code);
}

/**
 * Nearest preceding top-level `function` declaration.
 *
 * `interface` members and arrow-with-name shapes are not matched, which is why
 * an unrecognised writer reports `<unknown>` and fails the allow-list rather
 * than being skipped. Failing closed is the point: the guard is allowed to be
 * shallow about *where* the function starts, but not about whether it exists.
 */
function enclosingFunction(code: string, index: number): string {
  const before = code.slice(0, index);
  const decls = [...before.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)];
  return decls.length > 0 ? decls[decls.length - 1][1] : '<unknown>';
}

function paramWriters(): string[] {
  const found: string[] = [];
  for (const file of productionFiles(SRC)) {
    const rel = relPosix(file);
    if (rel === OWNER) continue; // `this.tempSettings` is the owner's own field
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const m of code.matchAll(/(?<!this\.)\b([A-Za-z_$][\w$]*)\.model\s*=(?!=)/g)) {
      if (!paramAcceptsSettings(code, m[1])) continue;
      found.push(`${rel}:${enclosingFunction(code, m.index ?? 0)}`);
    }
  }
  return found;
}

describe('#467 — the unified model has one sanctioned write path', () => {
  it('has no direct `tempSettings.model` assignment outside the settings tab', () => {
    // A new site here means a writer bypassed `setFieldValue('model', …)` and
    // therefore skipped `cascadeUnifiedModelChange`. The per-task overrides stay
    // pinned to their old values while the picker shows the new model — silently,
    // because nothing about the picker looks wrong.
    expect(writers()).toEqual([]);
  });

  it('routes the sites that used to write directly through a sanctioned entry', () => {
    // Two entries exist, and the difference between them is the point: a user
    // edit expands one field into a coherent selection and must clear the
    // per-task overrides, while a wholesale sync takes all four from the source
    // of truth and must not.
    const provider = stripComments(readFileSync(join(SRC, 'ui/settings-sections/provider-section.ts'), 'utf8'));
    expect(provider, 'provider-section must set the unified model through setFieldValue').toMatch(
      /setFieldValue\(\s*'model'\s*,/
    );

    const testConnection = stripComments(
      readFileSync(join(SRC, 'ui/settings-sections/test-connection-section.ts'), 'utf8')
    );
    expect(testConnection, 'test-connection-section must sync through the tab').toMatch(/syncModelsFromPlugin\(\)/);
  });

  it('keeps the assignment and the cascade inside setFieldValue’s model branch', () => {
    // The two halves have to stay together, and asserting them separately is
    // what this guard got wrong first: the field is *also* assigned by
    // `syncModelsFromPlugin`, so `toMatch(/tempSettings\.model\s*=/)` passes even
    // once `setFieldValue` stops writing it; and `toContain(
    // 'cascadeUnifiedModelChange')` passes on the method's own definition even
    // when nothing calls it. Both mutations were measured against the earlier
    // version and neither failed it.
    //
    // `[^}]*` rather than `[\s\S]{0,400}?` is load-bearing: a lazy any-character
    // span reaches past the closing brace into the method's own definition, so
    // deleting the call still matched. Forbidding a brace keeps the two
    // assertions inside one block.
    const owner = stripComments(readFileSync(join(SRC, OWNER), 'utf8'));
    expect(owner).toMatch(
      /if\s*\(field\s*===\s*'model'\)\s*\{[^}]*tempSettings\.model\s*=[^}]*cascadeUnifiedModelChange\(\)/
    );
  });

  it('keeps the two entries distinct, so a future editor finds them together', () => {
    const owner = stripComments(readFileSync(join(SRC, OWNER), 'utf8'));
    expect(owner).toContain('syncModelsFromPlugin');
    // `syncModelsFromPlugin` writes the field and deliberately does not cascade.
    // If it ever starts calling the cascade, the two entries have collapsed into
    // one and this test's premise is gone.
    const sync = owner.slice(owner.indexOf('syncModelsFromPlugin'));
    expect(sync.slice(0, 400)).not.toContain('cascadeUnifiedModelChange');
  });

  it('names every holder allowed to write the model through a parameter', () => {
    // The literal search above is blind to this shape, and the shape already
    // exists: `applyCodexModelPolicy` and `preserveCodexRuntimeModelState` both
    // assign `.model` on an object they were handed. Declaring them here is what
    // makes the set closed — a third one fails, including inside a file that is
    // already listed.
    expect(paramWriters().sort()).toEqual([...PARAM_WRITER_ALLOWLIST].sort());
  });

  it('does not route a wholesale sync through the cascading entry', () => {
    // The comment above `syncModelsFromPlugin` used to justify this with the
    // three per-task values and their `*UseCustom` flags, and neither has an
    // effect on the method's only caller: those values are reassigned from the
    // same source on the next lines, and the flags are already `false` because
    // `syncCodexModelsFromPlugin` runs first.
    //
    // The reason that does hold is `llmReady`. `setFieldValue` always ends with
    // `markLLMConfigStale()`, so a *successful* Codex connection test would
    // commit `llmReady = false` and `requireLLMReady` would then reject every
    // ingest and query. The earlier version of this test asserted that the
    // following 400 characters do not contain the word `cascadeUnifiedModelChange`
    // — which a call to `setFieldValue` also does not contain, so an editor who
    // read the comment, concluded the flag flip was harmless, and switched the
    // sync to `setFieldValue` passed and shipped the bug.
    const owner = stripComments(readFileSync(join(SRC, OWNER), 'utf8'));
    const sync = owner.slice(owner.indexOf('public syncModelsFromPlugin'));
    const body = sync.slice(0, sync.indexOf('\n  }'));
    expect(body).not.toMatch(/setFieldValue/);
    expect(body).not.toMatch(/markLLMConfigStale/);
  });
});
