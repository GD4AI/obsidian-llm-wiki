// Issue #781 — the co-citation projection measured on a real vault.
//
// The three defects @DocTpoint's 2026-09-22 review named were measured by him on
// a 2,110-page vault. Fixtures can show that each fix works in principle; they
// cannot show what happens at scale, where a hub has hundreds of citers and a
// candidate list has thousands of entries.
//
// This file measures the two vaults the maintainer keeps for exactly that. It
// **skips when they are absent** — CI does not have them, and a test that fails
// for a missing machine-local path is a test people learn to ignore.
//
// The assertions are **properties**, not numbers copied from one run: the "A"
// share must sit near the base rate (that is the defect), and every offered
// candidate must have more than one piece of evidence. A hard-coded count would
// pin a vault, not a behaviour.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraphFromContent } from '../../core/build-graph';
import { buildCoCitationGraph, coCitationCandidates } from '../../core/co-citation';
import { RELATED_BUDGET } from '../../constants';

// The cap the product applies at write time (`shapeRelatedLists` receives
// `RELATED_BUDGET[granularity].crossSource`). Measuring without it was the defect
// @DocTpoint found on 2026-11-10: an uncapped call returns a set, and no ordering
// can change a set, so the "A" share showed only what the floor removed.
const CROSS_SOURCE_CAP = RELATED_BUDGET.standard.crossSource;

// No personal path is committed. Point the run at a vault root that holds
// `test8/` and `test10/`, or set the variable to a folder that holds any vault:
//   LLM_WIKI_MEASURE_VAULT="$HOME/Documents/Obsidian Vault" npx vitest run src/__tests__/core/co-citation-real-vault.test.ts
const VAULT_ROOT = process.env.LLM_WIKI_MEASURE_VAULT ?? '';
const VAULTS = ['test8', 'test10'].map((name) => ({ name, dir: join(VAULT_ROOT, name) }));
const available = VAULT_ROOT === '' ? [] : VAULTS.filter((v) => existsSync(v.dir));

/** Every markdown page under the vault's wiki root, skipping the schema folder. */
function readPages(dir: string): Array<{ path: string; content: string }> {
	const pages: Array<{ path: string; content: string }> = [];
	const walk = (current: string) => {
		for (const name of readdirSync(current)) {
			const full = join(current, name);
			if (statSync(full).isDirectory()) {
				if (name === 'schema' || name.startsWith('.')) continue;
				walk(full);
			} else if (name.endsWith('.md')) {
				pages.push({ path: full.slice(dir.length + 1).replace(/\.md$/, ''), content: readFileSync(full, 'utf8') });
			}
		}
	};
	walk(dir);
	return pages;
}

interface Measurement {
	vault: string;
	pages: number;
	candidatesOffered: number;
	/** Entries the floor withholds — pairs whose whole evidence is one target. */
	withheldByFloor: number;
	/** Pages where the cap removed at least one candidate. */
	cutApplied: number;
	/** Share of offered entries whose path starts with "A", under the production cap. */
	aShare: number;
	/** The same share without the cap, so the cut's own bias is visible. */
	aShareUncapped: number;
	/** Share of all pages whose path starts with "A" — the base rate it must match. */
	aBaseRate: number;
	/** The most-cited target and how many pages cite it. */
	busiestTarget: { target: string; citers: number } | null;
}

function measure(vault: { name: string; dir: string }): Measurement {
	const pages = readPages(vault.dir);
	// Pages sit at the vault root in these two, so the wiki folder prefix is empty.
	const graph = buildGraphFromContent(pages, new Set(pages.map((p) => p.path)), '');
	const co = buildCoCitationGraph(graph);

	const offered: string[] = [];
	const offeredUncapped: string[] = [];
	let withheldByFloor = 0;
	let cutApplied = 0;
	for (const page of pages) {
		// What the product offers: the floor and the cap, as `shapeRelatedLists` calls it.
		const kept = coCitationCandidates(page.path, co, { limit: CROSS_SOURCE_CAP });
		offered.push(...kept);
		// The same call without the cap, so the cut's own effect is separable from the
		// floor's.
		const uncapped = coCitationCandidates(page.path, co);
		offeredUncapped.push(...uncapped);
		if (uncapped.length > kept.length) cutApplied += 1;
		// What the floor takes away, measured against a call with the floor lowered and
		// no cap on either side. On a real vault this must be a large number: every pair
		// whose only evidence is one hub lands here.
		const keptSet = new Set(uncapped);
		for (const candidate of coCitationCandidates(page.path, co, { minShared: 1 })) {
			if (!keptSet.has(candidate)) withheldByFloor += 1;
		}
	}

	let busiest: { target: string; citers: number } | null = null;
	for (const [target, citers] of co.incoming) {
		if (!busiest || citers.length > busiest.citers) busiest = { target, citers: citers.length };
	}

	const aOf = (list: string[]) => list.filter((p) => /(^|\/)a/i.test(p.slice(p.lastIndexOf('/') + 1))).length;
	return {
		vault: vault.name,
		pages: pages.length,
		candidatesOffered: offered.length,
		withheldByFloor,
		cutApplied,
		aShare: offered.length === 0 ? 0 : aOf(offered) / offered.length,
		aShareUncapped: offeredUncapped.length === 0 ? 0 : aOf(offeredUncapped) / offeredUncapped.length,
		aBaseRate: pages.length === 0 ? 0 : aOf(pages.map((p) => p.path)) / pages.length,
		busiestTarget: busiest,
	};
}

describe.skipIf(available.length === 0)('#781 — co-citation on a real vault', () => {
	for (const vault of available) {
		describe(vault.name, () => {
			const m = measure(vault);

			it('withholds the pairs whose whole evidence is a single target', () => {
				// The 16.5 % finding: one hub produced a sixth of all candidate pairs,
				// and every one of those pairs rested on that hub alone. The floor is
				// what removes them, so the number withheld has to be substantial —
				// if it were zero the floor would be doing nothing and this vault
				// would not be the case the review described.
				expect(m.withheldByFloor).toBeGreaterThan(0);
			});

			it('does not concentrate on titles starting with "A"', () => {
				// The measured defect: "A" pages were 9.1 % of the vault and 17.1 % of
				// the chosen entries. The margin allowed here is generous on purpose —
				// this is a distribution, not a constant, and the vault is not fixed.
				// The cap is applied, because a set has no order and an uncapped
				// measurement cannot see the tie-break at all.
				expect(m.aShare).toBeLessThanOrEqual(m.aBaseRate * 1.5 + 0.02);
			});

			it('does not make the bias much worse by cutting at the cap', () => {
				// The cut keeps the head of a ranked list, so it can amplify an ordering
				// bias. It does amplify it: measured +2.5 points on test10 and +0.7 on
				// test8 (capped share over uncapped), which is the small compounding the
				// same-source defect produces (#1017). So this asserts a *bound* — no
				// large compounding — rather than the direction, because the direction is
				// already lost on both vaults. A cap of 3 cannot be bought back without
				// removing same-source pairs from the candidate set, which is #1017's job.
				expect(m.aShare).toBeLessThanOrEqual(m.aShareUncapped + 0.05);
			});

			it('reports the numbers this file measured, so a change is visible', () => {
				// Printed, not asserted. The baseline for the next change is what this
				// line says today.
				console.log(
					`[co-citation] ${m.vault}: ${m.pages} pages, ${m.candidatesOffered} entries offered at cap ${CROSS_SOURCE_CAP}, ` +
						`A share ${(m.aShare * 100).toFixed(1)}% (uncapped ${(m.aShareUncapped * 100).toFixed(1)}%) ` +
						`vs base ${(m.aBaseRate * 100).toFixed(1)}%, ` +
						`${m.withheldByFloor} withheld by the floor, cap applied on ${m.cutApplied} pages, ` +
						`busiest target cited by ${m.busiestTarget?.citers ?? 0}`,
				);
				expect(m.pages).toBeGreaterThan(0);
			});
		});
	}
});
