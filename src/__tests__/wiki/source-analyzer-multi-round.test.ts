/**
 * The net under multi-round extraction — Issue #932, after a mutation review
 * found that no test reaches these paths.
 *
 * What was missing. `analyzeSource` decides after every round whether to ask
 * again, and the review's second and third mutations both live here: stop telling
 * later rounds what has already been extracted, and stop honouring the
 * convergence signal. Both passed the whole suite. The existing analyzer tests
 * assert the shape of one answer; none asserts what the *next* prompt contains or
 * when the loop ends.
 *
 * The assertions are structural: which names appear in the next prompt, and how
 * many rounds happened. They never compare prompt prose, so a wording change
 * cannot fail them and a behaviour change cannot pass them (#926's rule).
 *
 * Mutations this file kills, each verified by hand before it was written down:
 *
 *   1. Drop the already-extracted list from the later-round context.
 *      Killed by "the second round is told what the first one extracted".
 *   2. Ignore `convergence.shouldStop`.
 *      Killed by "stops before the batch ceiling when rounds stop paying".
 *   3. Ignore the cumulative-limit stop.
 *      Killed by "stops at the user's custom cap".
 */
import { describe, it, expect } from 'vitest';
import { createMockContext, createMockFile, DEFAULT_SETTINGS } from '../__support__/engine-context';
import { SourceAnalyzer } from '../../wiki/source-analyzer';
import type { LLMClient } from '../../types';
import type { TFile } from 'obsidian';

const PATH = 'sources/long-note.md';

/** Long enough that the batch planner asks for several rounds. */
function longBody(): string {
	return Array.from({ length: 40 }, (_, i) =>
		`## Section ${i + 1}\n\nAlpha appears here. Beta appears here. Gamma appears here. ` +
		`Delta is discussed with Epsilon in the context of zeta numbering ${i}.`,
	).join('\n\n');
}

interface Recorded {
	/** The user message of every call, in order — the prompt the round was given. */
	prompts: string[];
	/**
	 * Only the extraction rounds.
	 *
	 * The analyzer makes other calls after the loop — vocabulary type repair and the
	 * lemma judgement — so counting `prompts` would count those too and every round
	 * assertion below would be off by a constant. The filter is a clause every
	 * extraction prompt carries and neither of the mutations touches, so it cannot
	 * mask the behaviour being tested.
	 */
	rounds: string[];
}

const ROUND_MARKER = 'CRITICAL LANGUAGE REQUIREMENT';

/** A client that records prompts and answers from a script, in call order. */
function recordingClient(answers: string[]): { client: LLMClient; rec: Recorded } {
	const rec: Recorded = { prompts: [], rounds: [] };
	let i = 0;
	const client = {
		createMessage: async (params: { messages?: Array<{ content?: string }> }) => {
			const prompt = params.messages?.map(m => m.content ?? '').join('\n') ?? '';
			rec.prompts.push(prompt);
			if (prompt.includes(ROUND_MARKER)) rec.rounds.push(prompt);
			return answers[i++] ?? JSON.stringify({ entities: [], concepts: [] });
		},
	} as unknown as LLMClient;
	return { client, rec };
}

/** Custom mode stops only when BOTH per-type caps are reached, so both are filled. */
function batchBoth(label: string, entities: string[], concepts: string[]): string {
	return JSON.stringify({
		entities: entities.map(n => ({ name: `${n}-${label}`, type: 'person', description: 'D', aliases: [] })),
		concepts: concepts.map(n => ({ name: `${n}-${label}`, type: 'term', description: 'D', aliases: [] })),
		contradictions: [],
		related_pages: [],
		key_points: [],
	});
}

function batch(label: string, names: string[]): string {
	return JSON.stringify({
		entities: names.map(n => ({ name: `${n}-${label}`, type: 'person', description: 'D', aliases: [] })),
		concepts: [],
		contradictions: [],
		related_pages: [],
		key_points: [],
	});
}

async function analyze(answers: string[], settings: Record<string, unknown> = {}): Promise<Recorded> {
	const { ctx } = createMockContext({
		vaultFiles: { [PATH]: `# Long note\n\n${longBody()}` },
		settings: { ...DEFAULT_SETTINGS, ...settings },
	});
	const { client, rec } = recordingClient(answers);
	ctx.getClient = () => client;
	const analyzer = new SourceAnalyzer(ctx);
	// The analyzer reads only path and basename from the file argument.
	await analyzer.analyzeSource(createMockFile(PATH) as unknown as TFile);
	return rec;
}

describe('analyzeSource — multiple rounds', () => {
	it('asks more than once when rounds keep yielding', async () => {
		const rec = await analyze([batch('one', ['Alpha', 'Beta']), batch('two', ['Gamma'])]);

		// The ceiling is the planner's, not this test's: what matters is that the
		// loop ran past the first round at all.
		expect(rec.rounds.length).toBeGreaterThan(1);
	});

	it('the second round is told what the first one extracted', async () => {
		const rec = await analyze([batch('one', ['Alpha', 'Beta']), batch('two', ['Gamma'])]);

		// Kills mutation 1. The names are passed as a hint so a small model does not
		// re-extract what it already produced; without this line the hint is gone and
		// every later round spends its budget on duplicates.
		expect(rec.rounds[1]).toContain('Alpha-one');
		expect(rec.rounds[1]).toContain('Beta-one');
		// And the first round had nothing to be told about.
		expect(rec.rounds[0]).not.toContain('Already extracted');
	});

	it('stops before the batch ceiling when the rounds stop paying', async () => {
		// One new name per round against an ask of twenty: the yield ratio collapses
		// and convergence should stop the loop well before the ceiling.
		const rec = await analyze([
			batch('one', ['Alpha']),
			batch('two', ['Beta']),
			batch('three', ['Gamma']),
			batch('four', ['Delta']),
		]);

		// Kills mutation 2. The exact number is the planner's behaviour; the claim is
		// that it is bounded well below the six-round ceiling for this granularity.
		expect(rec.rounds.length).toBeLessThanOrEqual(4);
		expect(rec.rounds.length).toBeGreaterThan(1);
	});

	it('stops at the user’s custom cap', async () => {
		const rec = await analyze(
			[
				batchBoth('one', ['Alpha', 'Beta'], ['X', 'Y']),
				batchBoth('two', ['Gamma', 'Delta'], ['Z', 'W']),
				batchBoth('three', ['Epsilon'], ['V']),
			],
			{ extractionGranularity: 'custom', customEntityLimit: 3, customConceptLimit: 3 },
		);

		// Kills mutation 3. The cap is a ceiling the user set, so the loop must stop
		// once the accumulated items reach it instead of spending the remaining
		// rounds. Custom granularity plans one round, so the assertion is on the plan
		// being honoured rather than on a fixed count.
		expect(rec.rounds.length).toBeLessThanOrEqual(2);
		expect(rec.rounds.length).toBeGreaterThan(0);
	});
});
