// Issue #664, second half — the seam, not the function.
//
// `renderRelatedSections` unit tests prove the reserve works when the projection is
// named. They cannot see whether production names it: a caller that forgets the
// argument renders exactly as before, silently, and every unit test still passes.
// That is the #1034 defect shape — a reader whose production path never ran — so the
// wiring is asserted against the source that carries it.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), 'src', rel), 'utf8');

/** The call's argument text, from `name(` to its closing paren. */
function callText(source: string, name: string): string {
  const at = source.indexOf(`${name}(`);
  expect(at, `${name} is not called`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = source.indexOf('(', at); i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) return source.slice(at, i + 1);
    }
  }
  throw new Error(`${name} has no closing paren`);
}

describe('#664 — the projection reaches the renderer from the shaping pass', () => {
  it('the engine hands each page its own projection at the two page-creation calls', () => {
    const engine = read('wiki/wiki-engine.ts');
    expect(callText(engine, 'this.pageFactory.createOrUpdateEntityPage')).toContain(
      'this.pendingProjected.get(nameKey(entity.name))',
    );
    expect(callText(engine, 'this.pageFactory.createOrUpdateConceptPage')).toContain(
      'this.pendingProjected.get(nameKey(concept.name))',
    );
  });

  it('the engine resets the map before shaping, so a note cannot inherit the last one', () => {
    const engine = read('wiki/wiki-engine.ts');
    const shape = engine.indexOf('private async shapeRelatedListsForRun');
    expect(shape).toBeGreaterThan(-1);
    const reset = engine.indexOf('this.pendingProjected = new Map();', shape);
    const assign = engine.indexOf('this.pendingProjected = shaped.projected;', shape);
    expect(reset, 'the map is never reset at the start of a shaping pass').toBeGreaterThan(shape);
    expect(assign).toBeGreaterThan(-1);
    expect(reset, 'the reset runs after the assignment').toBeLessThan(assign);
  });

  it('the page factory forwards it, and the writer passes it with the tier budget', () => {
    const factory = read('wiki/page-factory/index.ts');
    expect(callText(factory, 'return createOrUpdateEntityPage')).toContain('projected');
    expect(callText(factory, 'return createOrUpdateConceptPage')).toContain('projected');
    const writer = read('wiki/page-factory/related-links.ts');
    const render = callText(writer, 'renderRelatedSections');
    expect(render).toContain('projected: opts.projected');
    expect(render).toContain('projectedBudget: budget.crossSource');
    expect(callText(read('wiki/page-factory/create-page.ts'), 'applyRelatedLinks')).toContain(
      'projected',
    );
  });
});

// Issue #1028, step 2 — the gate must reach the projection from the engine.
//
// Same reason as the reserve above: `coCitationCandidates` without `specificity`
// behaves exactly as it did before the gate existed, so a wiring that forgets the
// argument is invisible to every test that calls the function directly.
describe('#1028 — the specificity gate is passed on the production path', () => {
  it('the engine sets it from the constant, not from a literal', () => {
    const engine = read('wiki/wiki-engine.ts');
    const call = callText(engine, 'coCitationCandidates');
    expect(call).toContain('specificity: CO_CITATION_SPECIFICITY');
  });

  it('the constant is one judgement with the measurement next to it', () => {
    const constants = read('constants.ts');
    const at = constants.indexOf('export const CO_CITATION_SPECIFICITY');
    expect(at).toBeGreaterThan(-1);
    expect(constants.slice(at, at + 400)).toContain('= 25');
    expect(constants.slice(Math.max(0, at - 900), at)).toContain('judgement');
  });
});
