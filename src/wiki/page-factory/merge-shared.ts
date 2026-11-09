// The triage item shape, shared by triage and the contradiction gates.
//
// Split out by #929: `merge-triage` and `contradiction-gates` imported each
// other for this alone, which made a two-file cycle.

/**
 * A single triage item (only populated when strategy === 'complementary').
 * `kind: 'contradictory'` marks a piece that conflicts with a specific
 * existing statement — it is appended as an attributed conflict note and
 * stamps the `contradictions:` frontmatter marker, instead of being
 * integrated as if it were a fact.
 */
export interface ComplementaryItem {
  kind: 'complementary' | 'contradictory';
  content: string;
  target_section: string;
  reason?: string;
  /** Contradictory only: the page sentence the claim conflicts with, verified on the page (gate 1, contradiction-gates.ts). */
  existing_statement?: string;
}
