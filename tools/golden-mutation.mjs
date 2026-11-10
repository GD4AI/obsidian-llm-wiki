#!/usr/bin/env node
/**
 * Does the golden net actually fail when the code breaks?
 *
 * Issue #926 built the net. #981 found that a net can be named and cover nothing:
 * a lint snapshot was cited as the guard for about 430 moved lines, three
 * mutations passed the full suite, and the coverage had to be added afterwards.
 * A net nobody tests is a claim, not a guard — and the claim looks identical to
 * a working guard from the outside, because both print green.
 *
 * So this tool breaks the code on purpose and reads the exit code. Each mutation
 * is a one-line source edit whose only effect is on behaviour the net says it
 * records. A mutation that leaves the suite green is a hole, and the tool exits
 * non-zero rather than reporting a percentage.
 *
 * Three rules make the result trustworthy:
 *
 *   1. **The tree must be clean for every file it touches.** Restoring is a
 *      write, and a write over uncommitted work loses it.
 *   2. **The suite is run once unmutated first.** A suite that is already red
 *      kills every mutation for the wrong reason, which reads exactly like a
 *      working net.
 *   3. **The target text must occur exactly once.** A `find` that matches twice
 *      or not at all is a stale mutation, not a survivor — a mutation that never
 *      applied would otherwise count as evidence that the net is weak.
 *
 * Run: node tools/golden-mutation.mjs [--only <id>]
 *
 * It edits tracked source files and restores them. It is not part of Gate 1: the
 * cost is one suite run per mutation, which is release-time work, not per-commit
 * work. It belongs beside `pre-release-gate`, and a release that names the golden
 * net as a guard should quote this tool's output.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const INGEST = 'src/__tests__/golden/ingest.test.ts';
const LINT = 'src/__tests__/golden/lint.test.ts';

/**
 * `control` mutations address behaviour the net is believed to record today.
 * They are the tool's own positive control: if a control survives, the tool or
 * the suite wiring is broken and no other row means anything.
 *
 * `probe` mutations address behaviour a review suspected the net does not
 * record. A surviving probe is the finding, and the fix is to widen the net.
 *
 * `expects: 'inert'` records a mutation that the scenario never reaches, so its
 * survival says nothing either way. It is listed rather than deleted because a
 * green run over an inert mutation reads as coverage of code that was never
 * executed. If an inert row is ever killed, the label is stale and the tool
 * fails — the scenario grew to reach it, and the row must be reclassified.
 */
const MUTATIONS = [
	{
		id: 'heading-label-dropped',
		kind: 'control',
		file: 'src/core/related-sections.ts',
		find: 'concepts: relatedConceptsLabel.trim() };',
		replace: "concepts: `${relatedConceptsLabel.trim()} (mutated)` };",
		suites: [INGEST],
		expects: 'killed',
		why: 'the heading is a recorded heading',
	},
	{
		id: 'sources-entry-dropped',
		kind: 'probe',
		file: 'src/core/frontmatter.ts',
		find: 'lines.push(`sources:${yamlStringify(fm.sources)}`);',
		replace: 'lines.push(`sources:${yamlStringify(fm.sources.slice(0, 1))}`);',
		suites: [INGEST],
		expects: 'killed',
		why: 'the sources key survives and loses an entry — a value-only break',
	},
	{
		id: 'lint-merge-pairs-dropped',
		kind: 'probe',
		file: 'src/wiki/lint/controller.ts',
		find:
			'      if (duplicates.length > 0) {\n        const { merged, results } = await runDuplicateMerges(ctx, signal, duplicates);',
		replace:
			'      if (duplicates.length > 0) {\n        const { merged, results } = await runDuplicateMerges(ctx, signal, []);',
		suites: [LINT],
		expects: 'inert',
		why: 'the lint scenario yields no duplicate pair, so this branch never runs — merges are covered by smart-fix-all.test.ts (#981), a different net',
	},
];

function git(args) {
	return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function dirty(file) {
	const result = git(['status', '--porcelain', '--', file]);
	if (result.status !== 0) {
		throw new Error(`git status failed for ${file}: ${result.stderr.trim()}`);
	}
	return result.stdout.trim() !== '';
}

function countOccurrences(haystack, needle) {
	let count = 0;
	let index = haystack.indexOf(needle);
	while (index !== -1) {
		count += 1;
		index = haystack.indexOf(needle, index + needle.length);
	}
	return count;
}

function runSuites(suites) {
	const result = spawnSync('npx', ['vitest', 'run', ...suites], {
		cwd: ROOT,
		encoding: 'utf8',
		env: { ...process.env, ARCH_SNAPSHOT_UPDATE: '' },
	});
	return result.status === 0;
}

function main() {
	const onlyIndex = process.argv.indexOf('--only');
	const only = onlyIndex > -1 ? process.argv[onlyIndex + 1] : undefined;
	const selected = only ? MUTATIONS.filter((m) => m.id === only) : MUTATIONS;

	if (selected.length === 0) {
		console.error(`No mutation matches --only ${only}`);
		process.exit(2);
	}

	for (const mutation of selected) {
		if (dirty(mutation.file)) {
			console.error(
				`Refusing to run: ${mutation.file} has uncommitted changes. ` +
					'This tool writes to that file and restores it, which would discard them.',
			);
			process.exit(2);
		}
	}

	const suites = [...new Set(selected.flatMap((m) => m.suites))];
	process.stdout.write(`baseline: ${suites.join(', ')} ... `);
	if (!runSuites(suites)) {
		console.error('RED');
		console.error(
			'The suite already fails without a mutation, so every result below would be ' +
				'killed for the wrong reason. Fix the tree first.',
		);
		process.exit(2);
	}
	console.log('green');

	const rows = [];
	for (const mutation of selected) {
		const path = join(ROOT, mutation.file);
		const original = readFileSync(path, 'utf8');
		const occurrences = countOccurrences(original, mutation.find);

		if (occurrences !== 1) {
			rows.push({
				id: mutation.id,
				kind: mutation.kind,
				outcome: 'stale',
				suite: 'not run',
				detail: `target text occurs ${occurrences} times, expected 1`,
			});
			continue;
		}

		process.stdout.write(`  ${mutation.id} ... `);
		try {
			writeFileSync(path, original.replace(mutation.find, mutation.replace), 'utf8');
			const green = runSuites(mutation.suites);
			let outcome = green ? 'survived' : 'killed';
			if (mutation.expects === 'inert' && green) outcome = 'inert';
			if (mutation.expects === 'inert' && !green) outcome = 'stale-label';
			rows.push({
				id: mutation.id,
				kind: mutation.kind,
				outcome,
				suite: mutation.suites.join(' '),
				detail: mutation.why,
			});
			console.log(outcome.toUpperCase());
		} finally {
			writeFileSync(path, original, 'utf8');
		}
	}

	const survivors = rows.filter((row) => row.outcome === 'survived');
	const stale = rows.filter((row) => row.outcome === 'stale' || row.outcome === 'stale-label');
	const inert = rows.filter((row) => row.outcome === 'inert');

	console.log('\n| mutation | kind | result | what it breaks |');
	console.log('|---|---|---|---|');
	for (const row of rows) {
		console.log(`| \`${row.id}\` | ${row.kind} | **${row.outcome}** | ${row.detail} |`);
	}

	const controls = rows.filter((row) => row.kind === 'control');
	const controlsKilled = controls.filter((row) => row.outcome === 'killed').length;
	const live = rows.length - inert.length;
	console.log(
		`\n${controlsKilled}/${controls.length} controls killed — ${live - survivors.length - stale.length}/${live} live mutations killed — ` +
			`${inert.length} inert (recorded, not covered) `,
	);

	if (stale.length > 0) {
		const relabelled = rows.filter((row) => row.outcome === 'stale-label').map((row) => row.id);
		if (relabelled.length > 0) {
			console.error(
				`\n${relabelled.join(', ')} is marked inert but the suite killed it. The scenario now reaches ` +
					'that code, so the row must become a live probe instead of staying recorded as uncovered.',
			);
		}
		const unmatched = rows.filter((row) => row.outcome === 'stale').map((row) => row.id);
		if (unmatched.length > 0) {
			console.error(`\nA stale mutation is not evidence: ${unmatched.join(', ')}. Repair the pair, then re-run.`);
		}
		process.exit(2);
	}
	if (survivors.length > 0) {
		console.error(
			`\n${survivors.length} mutation(s) survived. The net does not record the behaviour it claims: ` +
				survivors.map((row) => row.id).join(', '),
		);
		process.exit(1);
	}
	console.log('\nEvery live mutation was killed.');
	if (inert.length > 0) {
		console.log(
			`${inert.length} row(s) are inert: the scenario never runs that code, so their green says nothing. ` +
				'They are listed so nobody reads coverage that does not exist.',
		);
	}
}

main();
