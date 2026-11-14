import { describe, expect, it } from 'vitest';
import { extractBody } from '../../core/frontmatter';
import { hashBody } from '../../core/source-requirements';
import { linkReducedBody, noteDriftState, noteHasDrifted } from '../../core/ingest-state';

/**
 * Issue #677 — a link path was rewritten, and the note was not edited.
 *
 * When a page moves folders, `fileManager.renameFile` rewrites inbound links so they
 * keep working. If a note linked a page by bare name and the vault also holds a note of
 * that name, Obsidian writes out the note's path: `[[Langzeitgedächtnis]]` becomes
 * `[[Notizen/Langzeitgedächtnis]]`, eight characters longer. The stored `contentHash`
 * then mismatches, and the plugin tells the user three notes were edited. Undoing that
 * one substitution reproduces the stored hash exactly — measured on the vault that
 * produced this issue.
 *
 * A link-blind hash would fix the false alarm and hide a real link edit, so the answer
 * is a second fingerprint: the same body with every wikilink reduced to its display
 * text. Body changed → `edited`. Only links changed → `links-only`. Nothing changed →
 * `unchanged`.
 */

const page = (fields: Record<string, string>, body: string) =>
	['---', ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), '---', '', body].join('\n');

const note = (body: string) => `---\ntags: []\n---\n\n${body}\n`;

describe('#677 — a rewritten link path is not an edit', () => {
	it('reduces a wikilink to its display text, so a path rewrite keeps the fingerprint', () => {
		expect(linkReducedBody('Siehe [[Langzeitgedächtnis]].')).toBe('Siehe Langzeitgedächtnis.');
		expect(linkReducedBody('Siehe [[Notizen/Langzeitgedächtnis]].')).toBe('Siehe Langzeitgedächtnis.');
	});

	it('uses the target name when the link has no display text', () => {
		expect(linkReducedBody('[[Notizen/Müller|Herr Müller]]')).toBe('Herr Müller');
		expect(linkReducedBody('[[concepts/Foo#Bar]]')).toBe('Foo#Bar');
		expect(linkReducedBody('![[bild.png]]')).toBe('bild.png');
	});

	it('reports a path-only rewrite as links-only, not as an edit', () => {
		// The exact shape from the issue: the note is 8 characters longer after the move.
		const before = note('Langzeitgedächtnis ist ein Begriff. Siehe [[Langzeitgedächtnis]].');
		const after = note('Langzeitgedächtnis ist ein Begriff. Siehe [[Notizen/Langzeitgedächtnis]].');
		expect(after.length - before.length, 'the fixture must reproduce the measured delta').toBe('Notizen/'.length);

		const stored = hashBody(extractBody(before));
		const storedLink = hashBody(linkReducedBody(extractBody(before)));
		const sourcePage = page({ contentHash: stored, linkHash: storedLink }, '# Langzeitgedächtnis\n');

		expect(noteDriftState(sourcePage, after)).toBe('links-only');
	});

	it('still calls a body edit an edit, even when the links are unchanged', () => {
		const before = note('Ein Satz. Siehe [[A]].');
		const after = note('Zwei Sätze. Siehe [[A]].');
		const stored = hashBody(extractBody(before));
		const storedLink = hashBody(linkReducedBody(extractBody(before)));
		const sourcePage = page({ contentHash: stored, linkHash: storedLink }, '# A\n');

		expect(noteDriftState(sourcePage, after)).toBe('edited');
	});

	it('still calls a link edit an edit the user made, when the body also changed', () => {
		const before = note('Ein Satz. Siehe [[A]].');
		const after = note('Zwei Sätze. Siehe [[B]].');
		const stored = hashBody(extractBody(before));
		const storedLink = hashBody(linkReducedBody(extractBody(before)));
		const sourcePage = page({ contentHash: stored, linkHash: storedLink }, '# A\n');

		expect(noteDriftState(sourcePage, after)).toBe('edited');
	});

	it('reports unchanged when nothing moved', () => {
		const body = note('Ein Satz. Siehe [[A]].');
		const stored = hashBody(extractBody(body));
		const storedLink = hashBody(linkReducedBody(extractBody(body)));
		const sourcePage = page({ contentHash: stored, linkHash: storedLink }, '# A\n');

		expect(noteDriftState(sourcePage, body)).toBe('unchanged');
	});

	it('keeps today’s behaviour on a page written before this change', () => {
		// No `linkHash` on disk. A path rewrite is indistinguishable from an edit, and
		// guessing would be worse than the false alarm — so it stays `edited`.
		const before = note('Siehe [[Langzeitgedächtnis]].');
		const after = note('Siehe [[Notizen/Langzeitgedächtnis]].');
		const stored = hashBody(extractBody(before));
		const legacyPage = page({ contentHash: stored }, '# X\n');

		expect(noteDriftState(legacyPage, after)).toBe('edited');
	});

	it('answers the older boolean the same way, so the file picker cannot disagree', () => {
		// `noteHasDrifted` is what the file picker and the ingest skip have always called.
		// If it kept comparing only `contentHash`, the picker would show "Note changed
		// since ingest" while the lint report said the links were the only change.
		const before = note('Siehe [[Langzeitgedächtnis]].');
		const after = note('Siehe [[Notizen/Langzeitgedächtnis]].');
		const sourcePage = page(
			{ contentHash: hashBody(extractBody(before)), linkHash: hashBody(linkReducedBody(extractBody(before))) },
			'# X\n',
		);
		expect(noteHasDrifted(sourcePage, after)).toBe(false);
	});

	it('says unknown when the page carries no fingerprint at all', () => {
		expect(noteDriftState(page({ type: 'source' }, '# X\n'), note('anything'))).toBe('unknown');
	});
});
