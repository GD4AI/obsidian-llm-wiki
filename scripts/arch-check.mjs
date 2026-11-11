#!/usr/bin/env node
/**
 * Architecture ratchet — Issue #927, part of the track in #925.
 *
 * Two rules, each measured rather than assumed:
 *
 *   1. No circular import among production modules.
 *   2. `src/core/` must not import an upper layer (`wiki/`, `llm-sdk/`, `ui/`,
 *      `schema/`, `main-commands/`, `main.ts`, `llm-client-wrapper.ts`).
 *
 * Both violations are listed in `scripts/arch-allowlist.json`, and **the list
 * may only shrink**. An unlisted violation fails the build by name; a listed
 * violation that no longer exists also fails, because a stale entry is how a
 * ratchet stops ratcheting — it hides the next real cycle behind a name nobody
 * re-reads.
 *
 * No dependency is added for this. `dependency-cruiser` was proposed and is not
 * needed: the walk is the code below, and this repository requires every pin to
 * appear in two lockfiles guarded by `override-parity.test.ts`. A measurement
 * tool should not have to touch two lockfiles to answer a question a script
 * answers.
 *
 * Usage:
 *   node scripts/arch-check.mjs                 # check the repository
 *   node scripts/arch-check.mjs --root <dir>    # check another tree (tests)
 *   node scripts/arch-check.mjs --print         # print today's violations as the
 *                                               # allowlist body; it never writes
 *                                               # the file, so widening the list
 *                                               # stays a visible diff
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';

const ROOT = process.argv.includes('--root')
	? resolve(process.argv[process.argv.indexOf('--root') + 1])
	: resolve(import.meta.dirname, '..');

const SRC = join(ROOT, 'src');
const ALLOWLIST_PATH = join(ROOT, 'scripts', 'arch-allowlist.json');

/** A `core/` file must not import from any of these. */
const UPPER_PREFIXES = [
	'wiki/',
	'llm-sdk/',
	'ui/',
	'schema/',
	'main-commands/',
	'main.ts',
	'llm-client-wrapper.ts',
];

/**
 * Static `import`/`export … from`, side-effect `import '…'`, and dynamic `import('…')`.
 *
 * Captures the clause between the keyword and `from`, so the caller can tell a
 * type-only statement (`import type { X } from '…'`, `export type { X } from '…'`)
 * from one that loads the module. TypeScript erases the first kind entirely, so it
 * cannot contribute to a module-initialization cycle (#930).
 */
const SPECIFIER = /(?:^|\n)\s*(import|export)\b([\s\S]*?)from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** True when the statement is `import type` / `export type`, which no runtime edge survives. */
function isTypeOnlyClause(clause) {
	return /^\s*type\b/.test(clause ?? '');
}

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) out.push(path);
	}
	return out;
}

/** Production modules only: the suite is not shipped, so its shape is not a constraint. */
function productionFiles() {
	return walk(SRC).filter((p) => !p.includes(`${sep}__tests__${sep}`) && !p.endsWith('.test.ts'));
}

function resolveSpecifier(fromFile, specifier) {
	if (!specifier.startsWith('.')) return null; // a package, not our graph
	const base = resolve(dirname(fromFile), specifier);
	for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
		if (existsSync(candidate) && candidate.endsWith('.ts')) return candidate;
	}
	return null;
}

function buildGraph(files) {
	const known = new Set(files);
	const edges = new Map(files.map((f) => [f, new Set()]));
	// The subset TypeScript does not erase. Cycle detection reads this; the
	// core → upper layer rule keeps reading `edges`, because a core module that
	// needs a ui type is still a core module depending on a upper layer.
	const runtimeEdges = new Map(files.map((f) => [f, new Set()]));
	let count = 0;
	let typeOnly = 0;
	for (const file of files) {
		const source = readFileSync(file, 'utf8');
		for (const match of source.matchAll(SPECIFIER)) {
			const specifier = match[3] ?? match[4] ?? match[5];
			if (!specifier) continue;
			const target = resolveSpecifier(file, specifier);
			if (!target || !known.has(target)) continue;
			edges.get(file).add(target);
			count++;
			if (isTypeOnlyClause(match[2])) typeOnly++;
			else runtimeEdges.get(file).add(target);
		}
	}
	return { edges, runtimeEdges, count, typeOnly };
}

/** Tarjan, iterative enough for a few hundred nodes. Returns components of size > 1. */
function cycles(edges) {
	const index = new Map();
	const low = new Map();
	const onStack = new Set();
	const stack = [];
	const found = [];
	let counter = 0;

	function strongConnect(node) {
		index.set(node, counter);
		low.set(node, counter);
		counter++;
		stack.push(node);
		onStack.add(node);

		for (const next of edges.get(node)) {
			if (!index.has(next)) {
				strongConnect(next);
				low.set(node, Math.min(low.get(node), low.get(next)));
			} else if (onStack.has(next)) {
				low.set(node, Math.min(low.get(node), index.get(next)));
			}
		}

		if (low.get(node) === index.get(node)) {
			const component = [];
			let popped;
			do {
				popped = stack.pop();
				onStack.delete(popped);
				component.push(popped);
			} while (popped !== node);
			if (component.length > 1) found.push(component);
		}
	}

	for (const node of edges.keys()) if (!index.has(node)) strongConnect(node);
	return found;
}

const toRel = (file) => relative(SRC, file).split(sep).join('/');

/** Sets compare by membership, so a cycle is the same cycle whatever order it was found in. */
const asKey = (files) => JSON.stringify([...files].sort());

function coreToUpperEdges(edges) {
	const edgesFound = [];
	for (const [from, targets] of edges) {
		if (!toRel(from).startsWith('core/')) continue;
		for (const to of targets) {
			const target = toRel(to);
			if (!UPPER_PREFIXES.some((prefix) => target.startsWith(prefix))) continue;
			edgesFound.push([toRel(from), target]);
		}
	}
	return edgesFound;
}

function readAllowlist() {
	if (!existsSync(ALLOWLIST_PATH)) return { cycles: [], coreUpper: [] };
	const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
	return { cycles: parsed.cycles ?? [], coreUpper: parsed.coreUpper ?? [] };
}

function main() {
	const files = productionFiles();
	const { edges, runtimeEdges, count, typeOnly } = buildGraph(files);

	if (process.argv.includes('--print')) {
		const body = {
			cycles: cycles(runtimeEdges)
				.map((component) => component.map(toRel).sort())
				.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0])),
			coreUpper: coreToUpperEdges(edges)
				.map(([a, b]) => [a, b])
				.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])),
		};
		console.log(JSON.stringify(body, null, 2));
		return;
	}

	const allowlist = readAllowlist();

	const cycleKeys = new Set(allowlist.cycles.map(asKey));
	const edgeKeys = new Set(allowlist.coreUpper.map(([a, b]) => `${a} → ${b}`));

	const foundCycles = cycles(runtimeEdges).map((component) => component.map(toRel).sort());
	const foundEdges = coreToUpperEdges(edges).map(([a, b]) => `${a} → ${b}`).sort();

	const unlistedCycles = foundCycles.filter((component) => !cycleKeys.has(asKey(component)));
	const foundCycleKeys = new Set(foundCycles.map(asKey));
	const staleCycles = allowlist.cycles.filter((component) => !foundCycleKeys.has(asKey(component)));

	const unlistedEdges = foundEdges.filter((edge) => !edgeKeys.has(edge));
	const foundEdgeSet = new Set(foundEdges);
	const staleEdges = allowlist.coreUpper
		.map(([a, b]) => `${a} → ${b}`)
		.filter((edge) => !foundEdgeSet.has(edge));

	const failed = unlistedCycles.length + staleCycles.length + unlistedEdges.length + staleEdges.length > 0;

	for (const component of unlistedCycles) {
		console.error(`unlisted cycle (${component.length} files): ${component.join(' ↔ ')}`);
	}
	for (const edge of unlistedEdges) {
		console.error(`unlisted core → upper edge: ${edge}`);
	}
	for (const component of staleCycles) {
		console.error(
			`stale allowlist entry, no longer a cycle: ${JSON.stringify(component)} — delete it, the list may only shrink`,
		);
	}
	for (const edge of staleEdges) {
		console.error(`stale allowlist entry, edge is gone: ${edge} — delete it, the list may only shrink`);
	}

	const total = `${files.length} modules, ${count} import edges (${typeOnly} type-only, erased at build)`;
	if (failed) {
		console.error(
			`arch-check FAILED — ${total}, ${unlistedCycles.length + staleCycles.length} cycle problem(s), ` +
				`${unlistedEdges.length + staleEdges.length} core → upper problem(s)`,
		);
		process.exit(1);
	}

	// The numbers printed on success are the baseline the allowlist stands at:
	// 0 unlisted, which is the whole point. A reader sees what is left.
	console.log(
		`arch-check clean — ${total}, cycles 0, core → upper 0 ` +
			`(${allowlist.cycles.length} allowlisted cycle(s), ${allowlist.coreUpper.length} allowlisted edge(s) remaining)`,
	);
}

main();
