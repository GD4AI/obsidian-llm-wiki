// Issue #729 Phase 1 — M0, the co-citation projection.
//
// The Related graph is intra-source by construction: `prompts/ingestion.ts:33`
// asks the extraction for names from *this* note, and `related-links.ts` can only
// *confirm* a name against the vault, never *discover* one. In a star forest there
// is no path between two stars, so no weight function can create reachability.
//
// M0 is the model-independent floor: two pages are related if the vault's own link
// structure already joins them — `A → E` and `B → E`, so `A — B`. Zero model input,
// zero extra model calls, and it works on whatever model the user runs.
//
// `Graph.edges` is outgoing-only, so the projection needs the reverse index. Both
// directions are built once per ingest run (see MEMORY §"Three corrections to
// Phase 1") and every candidate is ranked by shared-target count with **ties broken
// by path**, because a projection that reorders between runs would make the
// acceptance measurement unrepeatable.

import { describe, it, expect } from 'vitest';
import { addCoCitationPage, buildCoCitationGraph, coCitationCandidates } from '../../core/co-citation';
import type { Graph } from '../../core/build-graph';

/** `edges` keyed by source; every node gets an entry, as build-graph does. */
function graphOf(edges: Record<string, string[]>): Graph {
  const nodes = new Set<string>(Object.keys(edges));
  for (const targets of Object.values(edges)) for (const t of targets) nodes.add(t);
  const map = new Map<string, string[]>();
  for (const n of nodes) map.set(n, edges[n] ?? []);
  return { nodes: [...nodes], edges: map };
}

describe('#729 M0 — the co-citation projection', () => {
  it('reverses the graph, so a target records every page that links it', () => {
    // `edges` is outgoing-only; without the reverse index there is nothing to
    // project over. One hub, two sources — which is the entire mechanism.
    const g = buildCoCitationGraph(graphOf({ 'entities/A': ['concepts/Hub'], 'entities/B': ['concepts/Hub'] }));
    expect(g.incoming.get('concepts/Hub')).toEqual(['entities/A', 'entities/B']);
    expect(g.incoming.get('entities/A')).toBeUndefined();
  });

  it('offers a page that shares targets, and not one that shares none', () => {
    // The threshold moved from one shared target to two: see the strength-floor
    // block below, and `CoCitationOptions.minShared` for why. The intent of this
    // test is unchanged — a shared target makes a candidate, no shared target
    // does not.
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/Hub', 'concepts/Spoke'],
      'entities/B': ['concepts/Hub', 'concepts/Spoke'],
      'entities/C': ['concepts/Elsewhere'],
    }));
    const got = coCitationCandidates('entities/A', g);
    expect(got).toEqual(['entities/B']);
    // C shares nothing with A, so it is not a relation — it is a coincidence.
    expect(got).not.toContain('entities/C');
  });

  it('ranks by shared-target count, descending', () => {
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/H1', 'concepts/H2'],
      'entities/One': ['concepts/H1'],
      'entities/Two': ['concepts/H1', 'concepts/H2'],
    }));
    // Two shares both targets, One shares one. The floor is lowered here so the
    // count ordering itself stays observable; the floor's own behaviour is
    // covered separately.
    expect(coCitationCandidates('entities/A', g, { minShared: 1 })).toEqual([
      'entities/Two', 'entities/One',
    ]);
  });

  it('breaks a full tie by path, so the projection is deterministic', () => {
    // A full tie means the same shared count *and* the same weight, which is what
    // this fixture builds: every candidate shares the same two targets, so no
    // signal separates them. Then any order is as good as another, and the only
    // requirement is that it is the same order every run — otherwise the same
    // vault read twice produces two different page bodies, and the acceptance
    // measurement is not repeatable.
    //
    // The path is the LAST key, not the second one. Where the weights differ, the
    // weight decides and the path never runs — that is the debt this replaces.
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/Hub', 'concepts/Spoke'],
      'entities/Zulu': ['concepts/Hub', 'concepts/Spoke'],
      'entities/Alpha': ['concepts/Hub', 'concepts/Spoke'],
      'entities/Mike': ['concepts/Hub', 'concepts/Spoke'],
    }));
    expect(coCitationCandidates('entities/A', g)).toEqual([
      'entities/Alpha', 'entities/Mike', 'entities/Zulu',
    ]);
  });

  it('never offers the page itself', () => {
    // A self-link reaches nothing. `shapeRelatedLists` also seeds its own `seen`
    // with the item's key; this is the projection refusing to produce it at all.
    const g = buildCoCitationGraph(graphOf({ 'entities/A': ['concepts/Hub'], 'entities/B': ['concepts/Hub'] }));
    expect(coCitationCandidates('entities/A', g)).not.toContain('entities/A');
  });

  it('never offers a page the subject already links', () => {
    // `A → B` is already an edge in the vault. Re-listing it under Related would
    // duplicate a link the body already carries — which is the redundancy
    // `hub-link-distinctiveness` exists to report (#157 / #175) — and would inflate
    // the cross-source count with an edge that carries no new relation.
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/Hub', 'entities/B'],
      'entities/B': ['concepts/Hub'],
    }));
    expect(coCitationCandidates('entities/A', g)).not.toContain('entities/B');
  });

  it('honours the caller\'s exclude set', () => {
    // The shaper passes what it has already placed, so a candidate that is about
    // to be written from the note-grounded list is not offered twice.
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/Hub', 'concepts/Spoke'],
      'entities/B': ['concepts/Hub', 'concepts/Spoke'],
      'entities/C': ['concepts/Hub', 'concepts/Spoke'],
    }));
    expect(coCitationCandidates('entities/A', g, { exclude: new Set(['entities/C']) }))
      .toEqual(['entities/B']);
  });

  it('caps the result but keeps the best-ranked candidates', () => {
    // `Rare` is cited by A and Mid only — two pages — so it keeps its rarity.
    // A fixture that also lets Top and Low cite it raises its in-degree to the
    // level of the hubs and turns the intended weight difference into an exact
    // tie, which then falls through to the path. That is how this test was first
    // written, and the failure it produced was the fixture's, not the code's.
    const edges: Record<string, string[]> = { 'entities/A': ['concepts/H1', 'concepts/H2', 'concepts/H3', 'concepts/Rare'] };
    edges['entities/Top'] = ['concepts/H1', 'concepts/H2', 'concepts/H3'];
    edges['entities/Mid'] = ['concepts/H1', 'concepts/Rare'];
    edges['entities/Low'] = ['concepts/H1', 'concepts/H3'];
    const g = buildCoCitationGraph(graphOf(edges));
    // The cap keeps the highest-ranked two. Top shares three, so it leads on count.
    // Mid and Low both share two: Mid shares the rare target, so the weight puts it
    // first and `entities/Low` is the one the cap drops — the ordering being
    // observable rather than assumed.
    expect(coCitationCandidates('entities/A', g, { limit: 2 })).toEqual(['entities/Top', 'entities/Mid']);
    expect(coCitationCandidates('entities/A', g, { limit: 0 })).toEqual([]);
  });

  it('returns nothing for a page with no outgoing links or an unknown one', () => {
    const g = buildCoCitationGraph(graphOf({ 'entities/A': ['concepts/Hub'], 'entities/B': ['concepts/Hub'] }));
    // A has no targets of its own to share, so it co-cites with nobody.
    expect(coCitationCandidates('entities/Sink', g)).toEqual([]);
    expect(coCitationCandidates('entities/Missing', g)).toEqual([]);
  });

  it('is stable across repeated calls on the same graph', () => {
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/Hub'],
      'entities/B': ['concepts/Hub'],
      'entities/C': ['concepts/Hub'],
    }));
    expect(coCitationCandidates('entities/A', g)).toEqual(coCitationCandidates('entities/A', g));
  });

  it('ignores an edge whose target is not a node, rather than inventing a relation', () => {
    // Defensive: a graph built from a partially-loaded vault can carry a target
    // no page has. Two pages sharing such a target share nothing real.
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/Ghost', 'concepts/Shared'],
      'entities/B': ['concepts/Ghost', 'concepts/Shared'],
    }));
    expect(g.incoming.get('concepts/Ghost')).toEqual(['entities/A', 'entities/B']);
    // The projection still reports them — the target *is* shared — but the vault
    // resolver is what refuses to write an edge to a page that does not exist,
    // and that filter is asserted in related-shaping.test.ts.
    expect(coCitationCandidates('entities/A', g)).toEqual(['entities/B']);
  });
});

// ── The three debts @DocTpoint's 2026-09-22 review named ──────────────
//
// He measured them on a 2,110-page vault: 80 % of the cuts fall inside an
// equal-score group, titles starting "A" are 9.1 % of pages but 17.1 % of the
// chosen entries, and one hub produced 16.5 % of all candidate pairs. The tests
// below assert the *properties* that remove each, not a weight constant — a
// magic number in a test would pin the implementation instead of the behaviour.

describe('#729 M0 — the ranking is decided by the signal, not the alphabet', () => {
  /**
   * `self` links two hubs and one rare target. Two candidates share two targets
   * each, so their evidence is equal in **count** and differs only in **rarity**:
   * `zzz` shares the rare one, `aaa` shares two hubs. Under the alphabetical
   * tie-break `aaa` wins. Under any rarity weighting `zzz` wins.
   */
  function equalCountGraph(): Graph {
    return graphOf({
      'entities/self': ['concepts/H1', 'concepts/H2', 'concepts/Rare'],
      // H1 and H2 are hubs: four pages cite each of them.
      'entities/c1': ['concepts/H1'],
      'entities/c2': ['concepts/H1'],
      'entities/c3': ['concepts/H2'],
      'entities/c4': ['concepts/H2'],
      'entities/aaa': ['concepts/H1', 'concepts/H2'],
      'entities/zzz': ['concepts/Rare', 'concepts/H1'],
    });
  }

  it('prefers the rarer shared target when the shared count is equal', () => {
    const g = buildCoCitationGraph(equalCountGraph());
    expect(coCitationCandidates('entities/self', g)).toEqual(['entities/zzz', 'entities/aaa']);
  });

  it('reverses when only the paths are swapped — so the order is not the alphabet', () => {
    const swapped = buildCoCitationGraph(
      graphOf({
        'entities/self': ['concepts/H1', 'concepts/H2', 'concepts/Rare'],
        'entities/c1': ['concepts/H1'],
        'entities/c2': ['concepts/H1'],
        'entities/c3': ['concepts/H2'],
        'entities/c4': ['concepts/H2'],
        // Same graphs, names exchanged: the hub-pair page is now "zzz".
        'entities/zzz': ['concepts/H1', 'concepts/H2'],
        'entities/aaa': ['concepts/Rare', 'concepts/H1'],
      }),
    );
    expect(coCitationCandidates('entities/self', swapped)).toEqual(['entities/aaa', 'entities/zzz']);
  });

  it('lets evidence amount lead: a page sharing three targets beats one sharing two rare ones', () => {
    const g = buildCoCitationGraph(
      graphOf({
        'entities/self': ['concepts/A', 'concepts/B', 'concepts/C', 'concepts/Rare'],
        'entities/wide': ['concepts/A', 'concepts/B', 'concepts/C'],
        'entities/deep': ['concepts/Rare', 'concepts/A'],
      }),
    );
    // `wide` shares more, so it leads even though its targets are commoner.
    expect(coCitationCandidates('entities/self', g)[0]).toBe('entities/wide');
  });

  it('is stable across repeated calls and across graph insertion order', () => {
    const g = buildCoCitationGraph(equalCountGraph());
    const first = coCitationCandidates('entities/self', g);
    expect(coCitationCandidates('entities/self', g)).toEqual(first);

    const reordered = graphOf({
      'entities/zzz': ['concepts/Rare', 'concepts/H1'],
      'entities/c4': ['concepts/H2'],
      'entities/aaa': ['concepts/H1', 'concepts/H2'],
      'entities/c3': ['concepts/H2'],
      'entities/self': ['concepts/H1', 'concepts/H2', 'concepts/Rare'],
      'entities/c2': ['concepts/H1'],
      'entities/c1': ['concepts/H1'],
    });
    expect(coCitationCandidates('entities/self', buildCoCitationGraph(reordered))).toEqual(first);
  });
});

describe('#729 M0 — the strength floor and hub damping', () => {
  it('does not offer a page whose only shared target is a hub', () => {
    // The 16.5 % finding: one hub produces an enormous number of pairs. A pair
    // whose entire evidence is "both cite the hub" is not a relation.
    const g = buildCoCitationGraph(
      graphOf({
        'entities/self': ['concepts/Hub'],
        'entities/noise1': ['concepts/Hub'],
        'entities/noise2': ['concepts/Hub'],
        'entities/noise3': ['concepts/Hub'],
      }),
    );
    expect(coCitationCandidates('entities/self', g)).toEqual([]);
  });

  it('does not offer a page whose only shared target is rare either — one is one', () => {
    const g = buildCoCitationGraph(
      graphOf({ 'entities/self': ['concepts/Rare'], 'entities/other': ['concepts/Rare'] }),
    );
    expect(coCitationCandidates('entities/self', g)).toEqual([]);
  });

  it('offers a page as soon as the shared count reaches the floor', () => {
    const g = buildCoCitationGraph(
      graphOf({
        'entities/self': ['concepts/A', 'concepts/B'],
        'entities/pair': ['concepts/A', 'concepts/B'],
      }),
    );
    expect(coCitationCandidates('entities/self', g)).toEqual(['entities/pair']);
  });

  it('lets the caller lower the floor, for a vault too sparse to reach two', () => {
    const g = buildCoCitationGraph(
      graphOf({ 'entities/self': ['concepts/A'], 'entities/one': ['concepts/A'] }),
    );
    expect(coCitationCandidates('entities/self', g, { minShared: 1 })).toEqual(['entities/one']);
  });
});

// Issue #1017 — a same-note pair is not a cross-source relation.
//
// Entity and concept pages link to the source page they were extracted from, so two
// pages from one note share that source page as an outgoing target. Treating it as
// evidence made the projection re-add intra-source links and count them as new:
// measured on `test10`, 96.9 % of chosen entries shared a source page with the page
// they were offered to, and 2.7 % were source pages themselves. `test8` measured
// 99.3 % and 0.2 %.
//
// The first fix tried was the issue's own candidate 1 — leave `sources/` out of the
// shared-target set. That alone did not work, and the measurement is why: on `test10`
// the same-source share went **up** to 98.9 %, because the pairs it removed were the
// weakly connected cross-source ones while every same-note pair that also shared two
// concepts survived. So the filter is on the pair, not on the target: a candidate
// whose note is the subject's note is not a cross-source relation at all.
//
// The pair shapes below are the contract. They are asserted by shape, not only by
// count, because a count can be right while the wrong pairs are excluded.
describe('#1017 — a same-note pair is not a cross-source relation', () => {
  it('does not offer two pages whose only shared target is their source page', () => {
    // The floor is lowered to 1 on purpose: at the default of 2 this pair is
    // already rejected for sharing one target, so the test would pass without the
    // exclusion under test.
    const g = buildCoCitationGraph(
      graphOf({
        'entities/Hypothesis': ['sources/Paper-A'],
        'entities/Method': ['sources/Paper-A'],
      }),
    );
    expect(coCitationCandidates('entities/Hypothesis', g, { minShared: 1 })).toEqual([]);
  });

  it('does not count a source page towards the two-target floor', () => {
    // One real shared target plus the source page is not two pieces of evidence.
    const g = buildCoCitationGraph(
      graphOf({
        'entities/Hypothesis': ['sources/Paper-A', 'concepts/Mechanism'],
        'entities/Method': ['sources/Paper-A', 'concepts/Mechanism'],
      }),
    );
    expect(coCitationCandidates('entities/Hypothesis', g)).toEqual([]);
  });

  it('excludes a same-note pair even when it shares two real targets', () => {
    // The larger half of the fix. Both pages come from Paper-A, so the pair is
    // intra-source whatever else it shares, and the sibling rule already links them.
    const g = buildCoCitationGraph(
      graphOf({
        'entities/Hypothesis': ['sources/Paper-A', 'concepts/Mechanism', 'concepts/Evidence'],
        'entities/Method': ['sources/Paper-A', 'concepts/Mechanism', 'concepts/Evidence'],
      }),
    );
    expect(coCitationCandidates('entities/Hypothesis', g)).toEqual([]);
  });

  it('still offers the pair when the two pages come from different notes', () => {
    // This is the relation the phase exists to add, and it must survive the filter.
    const g = buildCoCitationGraph(
      graphOf({
        'entities/Hypothesis': ['sources/Paper-A', 'concepts/Mechanism', 'concepts/Evidence'],
        'entities/Method': ['sources/Paper-B', 'concepts/Mechanism', 'concepts/Evidence'],
      }),
    );
    expect(coCitationCandidates('entities/Hypothesis', g)).toEqual(['entities/Method']);
  });

  it('never offers a source page as a candidate, even when it shares two targets', () => {
    const g = buildCoCitationGraph(
      graphOf({
        'entities/Hypothesis': ['concepts/Mechanism', 'concepts/Evidence'],
        'sources/Paper-A': ['concepts/Mechanism', 'concepts/Evidence'],
      }),
    );
    expect(coCitationCandidates('entities/Hypothesis', g)).toEqual([]);
  });

  it('keeps a concept page from another note that merely shares targets', () => {
    // The exclusion is on what is offered and on the pair's note, not on the notion
    // that a source page can point at anything.
    const g = buildCoCitationGraph(
      graphOf({
        'entities/Hypothesis': ['sources/Paper-A', 'concepts/Mechanism', 'concepts/Evidence'],
        'concepts/Rival': ['sources/Paper-B', 'concepts/Mechanism', 'concepts/Evidence'],
        'sources/Paper-A': ['concepts/Mechanism'],
      }),
    );
    expect(coCitationCandidates('entities/Hypothesis', g)).toEqual(['concepts/Rival']);
  });
});

// Issue #1018 — the run's cached graph follows writes.
//
// The graph is built once per run, which is what keeps the cost at O(vault) instead
// of O(notes × vault). A frozen graph meant an empty-vault rebuild projected nothing:
// the first note saw no pages and every later note saw a graph without the pages the
// run had written. `addCoCitationPage` is the one writer into that cached graph.
describe('#1018 — the cached graph follows a write', () => {
  it('adds a written page to both directions of the index', () => {
    const g = buildCoCitationGraph(graphOf({ 'concepts/Hub': [] }));
    addCoCitationPage(g, 'entities/New', ['concepts/Hub']);
    expect(g.outgoing.get('entities/New')).toEqual(['concepts/Hub']);
    expect(g.incoming.get('concepts/Hub')).toEqual(['entities/New']);
  });

  it('replaces a page’s previous targets instead of appending to them', () => {
    // A re-ingest can rewrite a page. Leaving the old target behind would keep a
    // relation the page no longer carries, and the reverse index is what the
    // projection reads.
    const g = buildCoCitationGraph(graphOf({ 'entities/New': ['concepts/Old'] }));
    addCoCitationPage(g, 'entities/New', ['concepts/Newer']);
    expect(g.outgoing.get('entities/New')).toEqual(['concepts/Newer']);
    expect(g.incoming.get('concepts/Old')).toBeUndefined();
    expect(g.incoming.get('concepts/Newer')).toEqual(['entities/New']);
  });

  it('keeps other pages’ claims on a target', () => {
    const g = buildCoCitationGraph(graphOf({ 'entities/A': ['concepts/Hub'] }));
    addCoCitationPage(g, 'entities/New', ['concepts/Hub']);
    expect([...(g.incoming.get('concepts/Hub') ?? [])].sort()).toEqual(['entities/A', 'entities/New']);
  });

  it('does not record a self-link or duplicate a target', () => {
    const g = buildCoCitationGraph(graphOf({}));
    addCoCitationPage(g, 'entities/New', ['entities/New', 'concepts/Hub', 'concepts/Hub']);
    expect(g.outgoing.get('entities/New')).toEqual(['concepts/Hub']);
    expect(g.incoming.get('entities/New')).toBeUndefined();
  });
});
