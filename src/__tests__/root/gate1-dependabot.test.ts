// Gate 1 must run on the commit that would actually be merged, and for a
// Dependabot pull request it did not.
//
// The mechanism, read off run 42544230992 rather than assumed (Issue #974):
//
//   1. Dependabot opens the pull request updating `package.json` and
//      `pnpm-lock.yaml`. Gate 1 runs on that commit and fails on
//      `lockfile-check`, because `package-lock.json` drifted — the gate working.
//   2. `dependabot-lockfile.yml` regenerates the npm-side lockfile and pushes it
//      with `github-actions[bot]` as the author.
//   3. The push does not start a workflow run, so the commit that would be merged
//      carries no check. The run on the earlier commit is the only one that ever
//      existed, and `gh pr checks` prints "no checks reported".
//
// Falling back to a local Gate 1 run was the workaround for #949, #950 and #951,
// and a local run is not visible to branch protection.
//
// So three things have to stay true, and this file is what says so:
//
//   - Gate 1 keeps a `workflow_dispatch` trigger, because that is the only way a
//     bot-authored commit can start a run.
//   - The job name stays exactly `Gate 1 / Five-Gate`. The ruleset requires that
//     status context by string; renaming the job silently unrequires the check
//     rather than tightening it.
//   - The sync workflow dispatches Gate 1 only after a real push, and holds
//     `actions: write` to be allowed to.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const WORKFLOWS = join(__dirname, '..', '..', '..', '.github', 'workflows');

function read(name: string): string {
	return readFileSync(join(WORKFLOWS, name), 'utf8');
}

describe('Gate 1 reaches a Dependabot commit (#974)', () => {
	it('pr-ci.yml can be dispatched, not only triggered by events', () => {
		const ci = read('pr-ci.yml');

		// Without this key the only triggers are `pull_request` and `push`, and
		// neither fires for a commit pushed by `GITHUB_TOKEN`.
		expect(ci).toMatch(/^ {2}workflow_dispatch:/m);
	});

	it('keeps the frozen status context name', () => {
		const ci = read('pr-ci.yml');

		// Ruleset 16884813 requires `Gate 1 / Five-Gate` by that exact string. A
		// rename would not fail anything — it would remove the requirement.
		const names = [...ci.matchAll(/^ {4}name: (.+)$/gm)].map(m => m[1]);
		expect(names).toContain('Gate 1 / Five-Gate');
	});

	it('dispatches Gate 1 after the lockfile sync pushes, and only then', () => {
		const sync = read('dependabot-lockfile.yml');

		expect(sync).toContain('gh workflow run pr-ci.yml');
		// Guarded on the push outcome: when the lockfile already matched, the
		// original run stands and a second one would only duplicate it.
		expect(sync).toMatch(/if: steps\.push\.outputs\.pushed == 'true'/);
	});

	it('grants the sync job the action permission its dispatch needs', () => {
		const sync = read('dependabot-lockfile.yml');

		// `contents: write` alone cannot start a run; the dispatch 403s and the
		// pull request is back to having no checks, silently.
		expect(sync).toMatch(/^ {2}actions: write$/m);
	});

	it('checks the existing run when it did not push, instead of assuming one stands', () => {
		const sync = read('dependabot-lockfile.yml');

		// The push path dispatches. The other path used to trust "the original run
		// stands", and #975 showed that run can be `completed / action_required` —
		// never started, waiting for an approval that never came.
		expect(sync).toMatch(/if: steps\.push\.outputs\.pushed != 'true'/);
		expect(sync).toContain('node scripts/gate1-run-state.mjs');
	});
});

// The decision itself, driven through the script the workflow calls. A string
// assertion on the YAML would pass for a workflow that runs the wrong logic.
const SCRIPT = join(__dirname, '..', '..', '..', 'scripts', 'gate1-run-state.mjs');

function verdict(states: string): { status: number | null; output: string } {
	const result = spawnSync(process.execPath, [SCRIPT, states], { encoding: 'utf8' });
	return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('a Gate 1 run that cannot pass is not a gate (#975)', () => {
	it('fails when the commit has no Gate 1 run at all', () => {
		const { status, output } = verdict('');

		// The absent case is the one that reads as "nothing to check".
		expect(status).toBe(1);
		expect(output).toContain('No Gate 1 run exists');
	});

	it('fails when the run ended action_required', () => {
		const { status, output } = verdict('completed/action_required');

		// Terminal, and never started: waiting approval is not a pass and is not
		// pending. `gh pr checks` prints nothing for it.
		expect(status).toBe(1);
		expect(output).toContain('dependabot rebase');
	});

	it('fails when the run failed', () => {
		expect(verdict('completed/failure').status).toBe(1);
	});

	it('passes on success', () => {
		expect(verdict('completed/success').status).toBe(0);
	});

	it('passes when a run is still coming', () => {
		// A queued run is not evidence of anything yet, but failing here would
		// turn the lockfile job red on its own dispatch being slow to start.
		expect(verdict('in_progress/-').status).toBe(0);
		expect(verdict('queued/-').status).toBe(0);
		// `waiting` is the state an approval request actually sits in while live.
		expect(verdict('waiting/-').status).toBe(0);
	});

	it('passes when any run on the commit succeeded', () => {
		// A retry that passed makes the commit guarded, whatever older attempts did.
		expect(verdict('completed/action_required,completed/success').status).toBe(0);
	});
});
