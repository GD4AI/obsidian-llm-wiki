import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPERIMENTAL_FLAGS, type ExperimentalFlagKey } from '../../core/experimental-flags';
import { DEFAULT_SETTINGS } from '../../types/settings';

const ROOT = join(__dirname, '../../..');

function currentVersion(): string {
	const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
	return pkg.version;
}

/** `1.32.0` and `1.9.0` must compare numerically, not as strings. */
function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d !== 0) return d;
	}
	return 0;
}

describe('experimental flags — an escape hatch carries a deadline, not a note', () => {
	it('the effective default matches the register, and absence counts as off', () => {
		const doc = readFileSync(join(ROOT, 'docs/EXPERIMENTAL-FLAGS.md'), 'utf8');
		// Anchor on the Default cell. The document has a second table whose first cell
		// is also a backticked flag name (the evidence each one waits on), so matching
		// the first cell alone silently reads the wrong table.
		const rows = new Map(
			[...doc.matchAll(/^\| `([A-Za-z][\w]*)` \| (\*\*)?(on|off)(\*\*)? \|/gm)].map((m) => [
				m[1],
				m[3],
			]),
		);

		for (const key of Object.keys(EXPERIMENTAL_FLAGS) as ExperimentalFlagKey[]) {
			// A flag added after a vault was created has no key in that vault's
			// `data.json`. Absence must therefore mean "off" — which is why
			// `legacyScorer` deliberately has no DEFAULT_SETTINGS entry at all.
			const effective = DEFAULT_SETTINGS[key] ?? false;
			const documented = rows.get(key);

			expect(documented, `${key} has a register row`).toBeDefined();
			// Changing a default in code without the register, or the reverse, fails here.
			expect(
				documented?.toLowerCase() === 'on' ? true : false,
				`${key}: the register says "${documented}"`,
			).toBe(effective);
		}
	});

	it('no flag has reached its expiry, so CI is the deadline', () => {
		const version = currentVersion();
		const expired = Object.entries(EXPERIMENTAL_FLAGS)
			.filter(([, flag]) => compareVersions(version, flag.expiry) >= 0)
			.map(([key, flag]) => `${key} (expired ${flag.expiry}, filed in #${flag.issue})`);

		// When this fails, the release is the deadline. Decide: remove the flag and
		// make its behaviour unconditional, or move the expiry with a reason. Do not
		// move it silently — a date nobody re-checks is not a deadline.
		expect(expired, `flag(s) reached their expiry in ${version}`).toEqual([]);
	});

	it('the expiry is stated in the code, so the doc cannot drift from a date nobody reads', () => {
		for (const [key, flag] of Object.entries(EXPERIMENTAL_FLAGS)) {
			expect(flag.expiry, `${key} needs a version`).toMatch(/^\d+\.\d+\.\d+$/);
			expect(flag.issue, `${key} needs the issue that filed it`).toBeGreaterThan(0);
			expect(flag.retiresWhen.length, `${key} needs the evidence it waits on`).toBeGreaterThan(20);
		}
	});

	it('the documented register names exactly these flags, and the same expiry', () => {
		const doc = readFileSync(join(ROOT, 'docs/EXPERIMENTAL-FLAGS.md'), 'utf8');
		// Only the register table rows: a backticked identifier in the first cell.
		const documented = new Set(
			[...doc.matchAll(/^\| `([A-Za-z][\w]*)` \|/gm)].map((m) => m[1]),
		);

		// Two lists that describe one thing will drift. This is the check that stops
		// it: adding a flag to the code without documenting it fails here, and so does
		// documenting a flag that no longer exists.
		expect([...documented].sort()).toEqual(Object.keys(EXPERIMENTAL_FLAGS).sort());

		const expiryInDoc = new Map(
			[...doc.matchAll(/^\| `([A-Za-z][\w]*)` \|[^|]*\|[^|]*\|[^|]*\|[^|]*\| ([\d.]+) \|/gm)].map(
				(m) => [m[1], m[2]],
			),
		);
		for (const [key, flag] of Object.entries(EXPERIMENTAL_FLAGS)) {
			// A deadline written in two places is a deadline that will disagree.
			expect(expiryInDoc.get(key), `${key} expiry in the register`).toBe(flag.expiry);
		}
	});
});
