/**
 * A deterministic `LLMClient` for the golden net — Issue #926, track #925.
 *
 * It answers **per task from a table**, not from a queue. A queue makes the
 * snapshot depend on call order, so the snapshot would pass or fail on how many
 * calls happened rather than on what each stage produced. The table also makes an
 * unknown task loud: a new stage reaching the model throws here, and that throw
 * is the snapshot's most valuable failure — a refactor that adds a model call is
 * a behaviour change whether or not the output looks the same.
 *
 * The answers contain no prose. Every string a stage writes into a page is a
 * fixed token, so the snapshot can compare structure without comparing sentences.
 */
import type { LLMClient } from '../../types';

export interface FakeCallRecord {
	task: string;
}

export interface FakeClient extends LLMClient {
	/** Every task label, in the order the stages asked for one. */
	calls: FakeCallRecord[];
}

/** Answers keyed by the `task` label each production call site passes. */
const ANSWERS: Record<string, string> = {
	extract: JSON.stringify({
		entities: [
			{ name: 'Alpha', type: 'person', description: 'ALPHA', aliases: ['A'] },
			{ name: 'Beta', type: 'person', description: 'BETA', aliases: [] },
		],
		concepts: [{ name: 'Gamma', type: 'term', description: 'GAMMA', aliases: [] }],
		contradictions: [],
		related_pages: [],
		key_points: ['POINT'],
	}),
	'extract-retry': JSON.stringify({
		entities: [{ name: 'Alpha', type: 'person', description: 'ALPHA', aliases: [] }],
		concepts: [],
		contradictions: [],
		related_pages: [],
		key_points: [],
	}),
	'page-generate': '# PAGE\n\nBODY\n\n## Relations\n\n- LINK\n',
	// The source page the ingest writes last. Frontmatter is what the write gate
	// checks, so it carries the keys a real answer carries.
	'source-page':
		'---\ntype: source\ntags: [source]\n---\n\n# SOURCE\n\nSUMMARY\n\n## Key points\n\n- POINT\n',
	'merge-body': '# MERGED\n\nBODY\n\n## Relations\n\n- LINK\n',
	'reviewed-append': 'APPENDED\n',
	complementary: 'APPENDED\n',
	'merge-triage': JSON.stringify({ action: 'merge', reason: 'DUPLICATE' }),
	'source-stance': JSON.stringify({ stance: 'agrees', reason: 'AGREES' }),
	'type-repair': JSON.stringify({ entities: [], concepts: [] }),
	'lemma-classify': JSON.stringify({ kind: 'entity', confidence: 1 }),
	'embedded-image-analysis': JSON.stringify({ description: 'IMAGE' }),
};

export function createFakeClient(): FakeClient {
	const calls: FakeCallRecord[] = [];
	return {
		calls,
		createMessage: async (params: { task?: string }) => {
			const task = params.task ?? 'untagged';
			calls.push({ task });
			const answer = ANSWERS[task];
			if (answer === undefined) {
				throw new Error(
					`golden: no answer for task "${task}". A stage reached the model that the snapshot does not ` +
						`know about — that is a behaviour change, so the table in fake-client.ts needs an entry.`,
				);
			}
			return answer;
		},
	} as unknown as FakeClient;
}
