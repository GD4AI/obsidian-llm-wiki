// Issue #677, second half — the seam, not the two ends.
//
// `path-resolution.test.ts` proves the move is reported, and
// `log-writer.test.ts` proves a reported move is written. Neither can see the
// engine between them: a callback nobody supplies, or a list nobody consumes,
// leaves both suites green and the log silent — the #1034 defect shape, a
// reader whose production path never ran. So the wiring is asserted against
// the source that carries it.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const engine = readFileSync(join(process.cwd(), 'src', 'wiki', 'wiki-engine.ts'), 'utf8');

describe('#677 — a classification move reaches the ingest log entry', () => {
  it('the engine hands path resolution a callback that stages the move', () => {
    expect(engine).toContain('onPageMoved: move => this.pendingMoves.push(move)');
  });

  it('updateLog consumes the staged moves and passes them to the writer', () => {
    const start = engine.indexOf('async updateLog(');
    expect(start).toBeGreaterThan(-1);
    const body = engine.slice(start, engine.indexOf('async logLintFix', start));
    expect(body).toContain('const moves = this.pendingMoves;');
    expect(body).toContain('this.pendingMoves = [];');
    expect(body).toContain('staged, moves');
  });

  it('a failed run does not leave its moves for the next entry', () => {
    const finallyAt = engine.indexOf('this.triageContradictions = null;');
    expect(finallyAt).toBeGreaterThan(-1);
    const tail = engine.slice(finallyAt, finallyAt + 200);
    expect(tail).toContain('this.pendingMoves = [];');
  });
});
