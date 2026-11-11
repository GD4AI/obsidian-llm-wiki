import type { LLMWikiSettings } from '../types/settings';

/**
 * The settings that exist to keep an older behaviour reachable, and the release
 * each one must be decided in (#933 step 2).
 *
 * Why this lives in code and not only in `docs/EXPERIMENTAL-FLAGS.md`: a table in
 * a document records an intention, and nothing fails when the date passes. Here
 * `experimental-flags.test.ts` compares every `expiry` to `package.json`'s version
 * and fails on the release that reaches it. That converts the register into a
 * deadline with a mechanism, which is the condition #933 sets for doing this step
 * at all ("an experimental flag must have an expiry version").
 *
 * The dates are the proposals recorded in step 1, not an agreement — nobody has
 * set a release date. Moving one is allowed and expected; moving it without a
 * reason is what the test is there to make visible.
 */
export interface ExperimentalFlag {
	/** The release this flag must be decided in. Reaching it fails the suite. */
	readonly expiry: string;
	/** The issue that filed the flag. */
	readonly issue: number;
	/** The evidence that retires it. A flag with none of this is just a preference. */
	readonly retiresWhen: string;
}

/**
 * Intersected with the settings keys, so renaming or deleting a settings field
 * fails compilation here instead of leaving a register that points at a key the
 * type no longer has.
 */
type SettingsKey = keyof LLMWikiSettings;

/**
 * Only the keys a settings blob may omit. A flag added after a vault exists must be
 * optional, because that vault's `data.json` has no key for it and absence has to
 * mean "behave like the new version". Intersecting with this set makes a flag that
 * is later promoted to a required field fail compilation: the key drops out of the
 * union and the `satisfies` map below gains an excess property.
 */
type OptionalSettingsKey = {
	[K in SettingsKey]-?: object extends Pick<LLMWikiSettings, K> ? K : never;
}[SettingsKey];

export type ExperimentalFlagKey =
	| ('legacyScorer' & OptionalSettingsKey)
	| ('skipMentionOnlyCandidates' & OptionalSettingsKey)
	| ('gateDissentStubs' & OptionalSettingsKey)
	| ('createStubsForUnresolvableLinks' & OptionalSettingsKey);

export const EXPERIMENTAL_FLAGS = {
	legacyScorer: {
		expiry: '1.32.0',
		issue: 819,
		retiresWhen:
			'The accuracy harness shows BM25F is not worse than the linear scorer on the same vault. Today the only measurement is that the two orders differ.',
	},
	skipMentionOnlyCandidates: {
		expiry: '1.32.0',
		issue: 514,
		retiresWhen:
			'The candidate gate has an answer for every supported wiki language, and users on multi-language vaults report it as a net improvement.',
	},
	gateDissentStubs: {
		expiry: '1.32.0',
		issue: 514,
		retiresWhen:
			'Nobody asks for the drop-on-dissent behaviour. The outcome table already measured equal to it over 1,153 items across three runs.',
	},
	createStubsForUnresolvableLinks: {
		expiry: '1.33.0',
		issue: 75,
		retiresWhen:
			'Users report stub pages as worse than dead links. This flag undoes a default, so the evidence it waits on points the other way from the other three.',
	},
} as const satisfies Record<ExperimentalFlagKey, ExperimentalFlag>;
