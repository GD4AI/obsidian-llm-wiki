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
    .filter(({ rel, code }) => rel !== OWNER && /\btempSettings\.model\s*=/.test(code))
    .map(({ rel }) => rel);
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
});
