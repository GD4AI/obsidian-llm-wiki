/**
 * The golden net for the query path — Issue #926, track #925.
 *
 * The entry is `selectPprSeeds`, which is what `QueryView` calls. That choice is
 * not a convenience: `production-reachability.test.ts` exists because ten
 * measurements were once taken on a path the product does not run, so a golden
 * net that entered lower would repeat the mistake it is meant to prevent.
 *
 * What it records is the page selection and its **order** — the thing the answer
 * is built from. What it does not record is the answer text: the model never
 * runs here, and a snapshot of prose written by an unmodified prompt would be a
 * constant compared against itself.
 *
 * The seed stage is stubbed to an empty list, so the lexical and PPR stages are
 * the ones under test and no model call is involved. A refactor that changes
 * which pages reach the answer, or their order, fails here.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { selectPprSeeds } from '../../wiki/query-engine/pipeline/select-seeds';
import type { PageRef } from '../../core/ppr-cascade';
import type { Graph } from '../../core/build-graph';

vi.mock('../../wiki/query-engine/pipeline/seed-selector', async (importOriginal) => {
	const mod = await importOriginal<typeof import('../../wiki/query-engine/pipeline/seed-selector')>();
	return { ...mod, selectSeedsWithLLM: vi.fn(async () => ({ seeds: [], chip: 'Lex+PPR' })) };
});

const BASELINE = join(__dirname, 'baseline', 'query.json');

const TEXTS = {
	queryPhaseSearching: 'Searching...',
	queryPhaseFoundPages: 'Found {count}: {pages}',
};

/** Ten pages: one title hit, one alias hit, two body hits, plus fillers. */
function pages(): PageRef[] {
	const base: PageRef[] = [
		{ path: 'wiki/concepts/quantum', title: 'quantum field', aliases: ['quantum'], summary: 'core idea', text: '' },
		{ path: 'wiki/entities/planck', title: 'Max Planck', aliases: ['planck'], summary: 'physicist', text: '' },
		{
			path: 'wiki/concepts/entanglement',
			title: 'Entanglement',
			aliases: [],
			summary: 'a pair of particles',
			text: 'quantum links these two, and the link holds at a distance',
		},
		{
			path: 'wiki/concepts/decoherence',
			title: 'Decoherence',
			aliases: [],
			summary: 'loss of coherence',
			text: 'the quantum behaviour disappears as the system grows',
		},
		{ path: 'wiki/concepts/language-model', title: '語言模型', aliases: ['大模型'], summary: '模型', text: '語言模型 用於生成' },
	];
	for (let i = 0; i < 5; i += 1) {
		base.push({ path: `wiki/entities/filler${i}`, title: `Filler ${i}`, aliases: [], summary: 'nothing', text: 'nothing' });
	}
	return base;
}

function graph(): Graph {
	const edges = new Map<string, string[]>();
	for (const p of pages()) edges.set(p.path, []);
	// A small graph, so the PPR stage has something to walk. Quantum is the hub,
	// which is the shape a real wiki has and the reason the cascade exists.
	const link = (from: string, to: string) => edges.set(from, [...(edges.get(from) ?? []), to]);
	link('wiki/entities/planck', 'wiki/concepts/quantum');
	link('wiki/concepts/entanglement', 'wiki/concepts/quantum');
	link('wiki/concepts/decoherence', 'wiki/concepts/entanglement');
	link('wiki/concepts/language-model', 'wiki/concepts/quantum');
	return { nodes: pages().map((p) => p.path), edges };
}

const QUERIES = ['quantum', 'entanglement decoherence', '語言模型'];

interface QueryStructure {
	queries: Array<{ query: string; ranked: string[]; count: number }>;
}

async function runScenario(): Promise<QueryStructure> {
	const out: QueryStructure['queries'] = [];
	for (const query of QUERIES) {
		// A fresh graph per query: `selectPprSeeds` is free to memoise, and a shared
		// object would let one query's state decide the next one's result.
		const result = await selectPprSeeds(query, pages(), graph(), undefined, { model: 'm' }, TEXTS);
		out.push({
			query,
			ranked: result.matches.map((match) => match.page.path),
			count: result.matches.length,
		});
	}
	return { queries: out };
}

describe('golden — the query path holds its shape', () => {
	it('matches the recorded page selection and order', async () => {
		const actual = await runScenario();

		if (process.env.ARCH_SNAPSHOT_UPDATE === '1') {
			mkdirSync(dirname(BASELINE), { recursive: true });
			writeFileSync(BASELINE, `${JSON.stringify(actual, null, '\t')}\n`, 'utf8');
			return;
		}

		expect(existsSync(BASELINE)).toBe(true);
		expect(actual).toEqual(JSON.parse(readFileSync(BASELINE, 'utf8')));
	});

	it('is deterministic — two runs on one commit are identical', async () => {
		expect(await runScenario()).toEqual(await runScenario());
	});
});
