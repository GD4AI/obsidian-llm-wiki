#!/usr/bin/env node
// Decide whether a commit's Gate 1 state can still pass. Issue #975.
//
// The question this answers is not "did a run start" but "can the commit that
// would be merged ever show a green gate". Four outcomes, and only two are fine:
//
//   no run at all        → the gate is absent. Fails.
//   success              → fine.
//   queued / in progress → fine; a verdict is coming.
//   anything terminal    → fails. This is the case that was invisible: a run can
//                          end `completed / action_required`, which means it never
//                          started because a maintainer's approval was needed, and
//                          `gh pr checks` prints "no checks reported" for it. An
//                          unrun gate reads exactly like a gate that is not needed.
//
// Input is the comma-separated `status/conclusion` list the workflow builds from
// the runs API. An empty argument means no run exists for that commit.

const raw = process.argv[2] ?? '';
const entries = raw
	.split(',')
	.map(part => part.trim())
	.filter(Boolean);

const PASSED = new Set(['success']);
const COMING = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending', 'null']);

function split(entry) {
	const [status, conclusion] = entry.split('/');
	return { status, conclusion: conclusion && conclusion !== '-' ? conclusion : null };
}

const seen = entries.map(split);

if (entries.length === 0) {
	console.error(
		'::error::No Gate 1 run exists for this commit. The gate did not run on the commit that would be merged, and an absent check is not a passing check.',
	);
	process.exit(1);
}

if (seen.some(entry => entry.conclusion !== null && PASSED.has(entry.conclusion))) {
	console.log('Gate 1 passed on this commit.');
	process.exit(0);
}

if (seen.some(entry => COMING.has(entry.status) || (entry.conclusion !== null && COMING.has(entry.conclusion)))) {
	console.log(`Gate 1 is queued or running (${raw}); it will report a verdict.`);
	process.exit(0);
}

// Every remaining state is terminal and not a pass: failure, action_required,
// cancelled, timed_out, stale, skipped, startup_failure.
console.error(
	`::error::Gate 1 on this commit ended without a pass (${raw}). A run that needs approval and a run that failed both leave the pull request unguarded. Push a new commit so a fresh run starts — for Dependabot that is "@dependabot rebase".`,
);
process.exit(1);
