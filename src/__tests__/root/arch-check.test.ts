import { test, describe, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(__dirname, '../../../scripts/arch-check.mjs');

interface Fixture {
	dir: string;
	write(relPath: string, content: string): void;
	allowlist(value: unknown): void;
}

function makeFixture(): Fixture {
	const dir = mkdtempSync(join(tmpdir(), 'arch-check-'));
	return {
		dir,
		write(relPath, content) {
			const full = join(dir, relPath);
			mkdirSync(join(full, '..'), { recursive: true });
			writeFileSync(full, content, 'utf8');
		},
		allowlist(value) {
			const target = join(dir, 'scripts', 'arch-allowlist.json');
			mkdirSync(join(dir, 'scripts'), { recursive: true });
			writeFileSync(target, JSON.stringify(value), 'utf8');
		},
	};
}

interface Run {
	code: number;
	out: string;
}

function runArchCheck(dir: string): Run {
	try {
		const out = execFileSync(process.execPath, [SCRIPT, '--root', dir], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		return { code: 0, out };
	} catch (err) {
		const e = err as { status?: number; stdout?: string; stderr?: string };
		return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
	}
}

const EMPTY_ALLOWLIST = { cycles: [], coreUpper: [] };

describe('arch-check — the ratchet fails by name', () => {
	let fixture: Fixture;

	beforeEach(() => {
		fixture = makeFixture();
	});

	afterEach(() => {
		rmSync(fixture.dir, { recursive: true, force: true });
	});

	test('a tree with no cycle and no core-to-upper edge passes', () => {
		fixture.write('src/core/a.ts', "import { b } from './b';\nexport const a = 1;\n");
		fixture.write('src/core/b.ts', 'export const b = 2;\n');
		fixture.write('src/wiki/c.ts', "import { b } from '../core/b';\nexport const c = 3;\n");
		fixture.allowlist(EMPTY_ALLOWLIST);

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(0);
		expect(result.out).toContain('cycles 0');
	});

	test('a two-file cycle fails, and the message names both files', () => {
		fixture.write('src/core/a.ts', "import { b } from './b';\nexport const a = 1;\n");
		fixture.write('src/core/b.ts', "import { a } from './a';\nexport const b = 2;\n");
		fixture.allowlist(EMPTY_ALLOWLIST);

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(1);
		expect(result.out).toMatch(/unlisted cycle/i);
		expect(result.out).toContain('core/a.ts');
		expect(result.out).toContain('core/b.ts');
	});

	test('core importing an upper layer fails, and the message names the edge', () => {
		fixture.write('src/core/reads-up.ts', "import { w } from '../wiki/w';\nexport const r = w;\n");
		fixture.write('src/wiki/w.ts', 'export const w = 1;\n');
		fixture.allowlist(EMPTY_ALLOWLIST);

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(1);
		expect(result.out).toMatch(/unlisted core.*upper|core → upper/i);
		expect(result.out).toContain('core/reads-up.ts');
		expect(result.out).toContain('wiki/w.ts');
	});

	test('an allowlisted cycle passes, and the remainder is still checked', () => {
		fixture.write('src/core/a.ts', "import { b } from './b';\nexport const a = 1;\n");
		fixture.write('src/core/b.ts', "import { a } from './a';\nexport const b = 2;\n");
		fixture.allowlist({ cycles: [['core/a.ts', 'core/b.ts']], coreUpper: [] });

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(0);
		expect(result.out).toContain('cycles 0');
	});

	test('a stale allowlist entry fails — the list may only shrink', () => {
		fixture.write('src/core/a.ts', 'export const a = 1;\n');
		fixture.allowlist({ cycles: [['core/a.ts', 'core/gone.ts']], coreUpper: [] });

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(1);
		expect(result.out).toMatch(/stale|no longer/i);
		expect(result.out).toContain('core/gone.ts');
	});
});

describe('arch-check — a type-only import is not a runtime edge (#930)', () => {
	let fixture: Fixture;

	beforeEach(() => {
		fixture = makeFixture();
	});

	afterEach(() => {
		rmSync(fixture.dir, { recursive: true, force: true });
	});

	test('a two-file cycle made only of `import type` passes', () => {
		// The nineteen-file entry #930 removed was mostly this shape: every settings
		// section imported the tab class for a type and was counted as a cycle.
		fixture.write('src/ui/a.ts', "import type { B } from './b';\nexport const a = 1 as unknown as B;\n");
		fixture.write('src/ui/b.ts', "import type { A } from './a';\nexport type B = { a: A };\nimport { a } from './a';\nexport const b = a;\n");
		fixture.allowlist(EMPTY_ALLOWLIST);

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(0);
		expect(result.out).toContain('cycles 0');
		expect(result.out).toMatch(/type-only/);
	});

	test('a value cycle is still a cycle, so the precision did not weaken the rule', () => {
		// Same two files, one word shorter. If this ever passes, the guard is gone.
		fixture.write('src/ui/a.ts', "import { b } from './b';\nexport const a = b;\n");
		fixture.write('src/ui/b.ts', "import { a } from './a';\nexport const b = a;\n");
		fixture.allowlist(EMPTY_ALLOWLIST);

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(1);
		expect(result.out).toMatch(/unlisted cycle \(2 files\)/);
	});

	test('`export type … from` is erased too, and is not a cycle', () => {
		fixture.write('src/core/a.ts', "export type { B } from './b';\nexport const a = 1;\n");
		fixture.write('src/core/b.ts', "import type { A } from './a';\nexport type B = A;\nexport const b = 1;\n");
		fixture.allowlist(EMPTY_ALLOWLIST);

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(0);
	});

	test('a type-only `core` → `ui` import is still a layer violation', () => {
		// The layer rule keeps its full strength: `core/` may not need an upper layer,
		// not even for a type. Only cycle detection got the erasure argument.
		fixture.write('src/core/a.ts', "import type { U } from '../ui/u';\nexport const a = 1 as unknown as U;\n");
		fixture.write('src/ui/u.ts', 'export type U = number;\n');
		fixture.allowlist(EMPTY_ALLOWLIST);

		const result = runArchCheck(fixture.dir);

		expect(result.code).toBe(1);
		expect(result.out).toMatch(/core → upper/);
	});
});

describe('arch-check — the tree it ships against', () => {
	test('the repository passes its own ratchet, and the numbers are the measured ones', () => {
		const result = runArchCheck(resolve(__dirname, '../../..'));

		expect(result.code).toBe(0);
		// The baseline that #927 records. A change here means an item landed —
		// good — and the allowlist shrank to match.
		expect(result.out).toContain('cycles 0');
		expect(result.out).toContain('core → upper 0');
	});
});
