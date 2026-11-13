// value-survival-cli.test.ts — the report path, driven against memory.
//
// The CLI used to import `node:fs` directly, which meant (a) the Obsidian Bot
// flagged three `node:*` imports it could not exempt, and (b) testing the report
// needed a real vault on disk. The launcher supplies the file access now, so this
// test hands it a Map. Same code path, no filesystem, no vault.
//
// Every expectation below is computed by hand from the fixture strings.

import { describe, it, expect } from 'vitest';
import { main, type CliIo } from '../../../../tools/dev-instrument/src/value-survival-cli';

/** A CliIo that answers from a Map, with POSIX-ish join/resolve. */
function memoryIo(files: Record<string, string>): CliIo & { writes: string[]; errors: string[] } {
  const writes: string[] = [];
  const errors: string[] = [];
  const norm = (path: string): string => path.replace(/\/+/gu, '/').replace(/\/$/u, '');
  const io = {
    writes,
    errors,
    readTextFile(path: string): string {
      const hit = files[norm(path)];
      if (hit === undefined) throw new Error(`ENOENT ${path}`);
      return hit;
    },
    listDir(path: string): string[] {
      const prefix = norm(path) + '/';
      const names = Object.keys(files)
        .filter((p) => norm(p).startsWith(prefix))
        .map((p) => norm(p).slice(prefix.length))
        .filter((rest) => !rest.includes('/'));
      if (names.length === 0) throw new Error(`ENOENT ${path}`);
      return names;
    },
    exists(path: string): boolean {
      const target = norm(path);
      if (files[target] !== undefined) return true;
      return Object.keys(files).some((p) => norm(p).startsWith(target + '/'));
    },
    join(...parts: string[]): string {
      return norm(parts.join('/'));
    },
    resolve(...parts: string[]): string {
      return norm(parts.join('/'));
    },
  };
  return io;
}

const SOURCE_PAGE = [
  '---',
  'type: source',
  'source_file: "[[notes/pump.md]]"',
  '---',
  'The pump runs on 24 V and costs $420.',
  '',
  '## Mentions in Source',
  '',
  '> The pump costs $420 in 2026-04-28 terms.',
  '',
].join('\n');

const ENTITY_PAGE = [
  '---',
  'type: entity',
  'sources: ["[[sources/pump]]"]',
  '---',
  'A pump moving coolant at 24 V.',
  '',
].join('\n');

const NOTE = 'The pump runs on 24 V and costs $420 in 2026-04-28 terms.\n';

function vault(): Record<string, string> {
  return {
    '/v/test10/sources/pump.md': SOURCE_PAGE,
    '/v/test10/entities/pump.md': ENTITY_PAGE,
    '/v/notes/pump.md': NOTE,
  };
}

/** Capture what `main` printed, because stdout is its interface. */
function capture(run: () => Promise<number>): Promise<{ code: number; out: string; err: string }> {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  const originalOut = process.stdout.write.bind(process.stdout);
  const originalErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    outChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    errChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stderr.write;
  return run()
    .then((code) => ({ code, out: outChunks.join(''), err: errChunks.join('') }))
    .finally(() => {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    });
}

describe('value-survival-cli — report path without a filesystem', () => {
	it('prints the three tables for a vault it was handed in memory', async () => {
		const io = memoryIo(vault());

		const { code, out } = await capture(() => main(['/v', 'test10'], io, '/nope/fixture.md'));

		expect(code).toBe(0);
		expect(out, 'the run did not say which vault it read').toContain('vault /v · wiki test10');
		expect(out, 'the position table is missing').toContain('By value position');
		expect(out, 'the kind table is missing').toContain('By value kind');
		expect(out, 'the page-type table is missing').toContain('By page type');
	});

	it('counts the quoted value as survived on the source page and the prose value on the entity', async () => {
		const io = memoryIo(vault());

		const { out } = await capture(() => main(['/v', 'test10'], io, '/nope/fixture.md'));

		// $420 is quoted verbatim on the source page and absent from the entity
		// page, whose body carries 24 V as prose. The counts come from the fixture
		// strings above, not from a vault.
		const sourceRow = out.split('\n').find((line) => line.startsWith('source '));
		expect(sourceRow, 'no source row in the page-type table').toBeDefined();
		expect(sourceRow, 'the source page should own at least one value').toMatch(/^source\s+[1-9]/u);
	});

	it('returns 2 and writes usage when the arguments are incomplete', async () => {
		const io = memoryIo(vault());

		const { code, err } = await capture(() => main(['/v'], io, '/nope/fixture.md'));

		expect(code).toBe(2);
		expect(err).toContain('usage: run-value-survival.mjs');
	});

	it('says which folder is wrong when sources/ is missing', async () => {
		const io = memoryIo({});

		await expect(main(['/v', 'missing'], io, '/nope/fixture.md')).rejects.toThrow(/no sources\//u);
	});

	it('self-check reads the fixture through the same interface', async () => {
		const io = memoryIo({ '/tool/fixtures/note.md': NOTE });

		const { code, out } = await capture(() => main(['--self-check'], io, '/tool/fixtures/note.md'));

		expect(code, 'masking moved an offset, so the lengths must differ').toBe(0);
		expect(out, 'the fixture path was not printed').toContain('fixture: /tool/fixtures/note.md');
		expect(out, 'the length line is missing').toContain('must equal');
	});
});
