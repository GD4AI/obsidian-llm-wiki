// Issue #954 — the wiring of #215, and the constraints it has to hold.
//
// @DocTpoint's 2026-06-30 spec on PR #215, in his words: "one-shot via Lint
// Wiki, report-only … surface crystallized candidates in the Lint Wiki report,
// leave the actual untag to the user (the retirement decision mutates the graph,
// so it belongs in human hands)".
//
// Three of the four constraints are structural, so they are asserted from the
// source and from the scan's own output rather than trusted to review.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanCrystallizedHubs } from '../../../wiki/lint/scanners';
import { detectHubs } from '../../../core/hub-detection';
import type { Graph } from '../../../core/build-graph';
import { RETIREMENT_HUB_TOP_N } from '../../../constants';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const PROGRAMMATIC = src('../../../wiki/lint/phases/programmatic.ts');
const REPORT = src('../../../wiki/lint/report-builder.ts');

function graphOf(edges: Record<string, string[]>): Graph {
	const nodes = new Set(Object.keys(edges));
	for (const targets of Object.values(edges)) for (const t of targets) nodes.add(t);
	const map = new Map<string, string[]>();
	for (const n of nodes) map.set(n, edges[n] ?? []);
	return { nodes: [...nodes], edges: map };
}

/**
 * Two hubs, and the difference between them is the whole design.
 *
 * `crystallized` has 40 neighbours that link each other in a ring, so its
 * neighbourhood holds together without it. `star` has 40 neighbours that link
 * nothing but the hub, so it is load-bearing. Both have degree 40, above the
 * module's degree floor of 30 — the only difference is what the neighbours do.
 *
 * `minInDegree: 5` keeps the leaves out of the assessed set: they reach in-degree
 * 2 through the ring, and a percentile taken over leaves as well would measure
 * the wrong population.
 */
function twoHubs(): Graph {
	const edges: Record<string, string[]> = {};
	const make = (prefix: string, hub: string, ring: boolean) => {
		const leaves = Array.from({ length: 40 }, (_, i) => `concepts/${prefix}${i}`);
		edges[hub] = leaves;
		leaves.forEach((leaf, i) => {
			edges[leaf] = ring
				? [hub, leaves[(i + 1) % leaves.length]]
				: [hub];
		});
	};
	make('a', 'concepts/crystallized', true);
	make('b', 'concepts/star', false);
	return graphOf(edges);
}

describe('#954 — crystallized hubs are reported, never acted on', () => {
	it('reports a hub whose neighbourhood interconnected', () => {
		const reported = scanCrystallizedHubs(twoHubs(), { topN: RETIREMENT_HUB_TOP_N, minInDegree: 5 });
		expect(reported.map((h) => h.path)).toContain('concepts/crystallized');
		const hub = reported.find((h) => h.path === 'concepts/crystallized');
		expect(hub?.degree).toBe(40);
		expect(hub?.clusteringPercentile).toBeGreaterThanOrEqual(0.75);
	});

	it('does not report a star, where the hub still holds the neighbourhood together', () => {
		const reported = scanCrystallizedHubs(twoHubs(), { topN: RETIREMENT_HUB_TOP_N, minInDegree: 5 });
		expect(reported.map((h) => h.path)).not.toContain('concepts/star');
		expect(reported.map((h) => h.path)).toEqual(['concepts/crystallized']);
	});

	it('mutates nothing — the graph it is handed is unchanged', () => {
		// The acceptance criterion that matters most: a report is not an action.
		const graph = twoHubs();
		const before = JSON.stringify({ nodes: graph.nodes, edges: [...graph.edges.entries()] });
		scanCrystallizedHubs(graph, { topN: RETIREMENT_HUB_TOP_N });
		const after = JSON.stringify({ nodes: graph.nodes, edges: [...graph.edges.entries()] });
		expect(after).toBe(before);
	});

	it('writes no tag and touches no page — asserted from the wiring itself', () => {
		// Structural, because "report-only" is a promise about code that is not
		// there. The scan call must not be followed by a write in the same block.
		const callIndex = PROGRAMMATIC.indexOf('scanCrystallizedHubs(');
		expect(callIndex).toBeGreaterThan(-1);
		const block = PROGRAMMATIC.slice(callIndex, callIndex + 400);
		expect(block).not.toMatch(/createOrUpdateFile|process\(|vault\.modify|writeTag/);
	});

	it('runs in the one-shot lint, and not in the periodic path', () => {
		// Crystallization is slow and monotonic, so a background pass buys nothing.
		const periodic = src('../../../main-commands/query-lint-commands.ts');
		expect(periodic).not.toContain('scanCrystallizedHubs');
	});

	it('states the assessed set, so the percentile can be read', () => {
		// A percentile over an unstated set is a number without a meaning.
		expect(RETIREMENT_HUB_TOP_N).toBeGreaterThan(detectHubsDefaultTopN());
		expect(PROGRAMMATIC).toContain('topN: RETIREMENT_HUB_TOP_N');
		expect(REPORT).toContain('{topN}');
	});

	it('prints no section when nothing crystallized', () => {
		// An empty heading reads as a finding that fired and found nothing. The
		// guard lives in the renderer, which is where the section is built.
		const rendererIndex = REPORT.indexOf('function renderCrystallizedHubs');
		expect(rendererIndex).toBeGreaterThan(-1);
		const renderer = REPORT.slice(rendererIndex);
		expect(renderer).toMatch(/if \(!hubs \|\| hubs\.length === 0\) return ''/);
	});
});

/** `detectHubs`'s own default, read from its source so the comparison cannot drift. */
function detectHubsDefaultTopN(): number {
	const detection = src('../../../core/hub-detection.ts');
	const match = detection.match(/DEFAULT_TOP_N\s*=\s*(\d+)/);
	expect(match).not.toBeNull();
	return Number(match?.[1] ?? 0);
}
