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
import { buildCoCitationGraph, coCitationCandidates } from '../../core/co-citation';
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

  it('offers a page sharing one outgoing target, and not one that shares none', () => {
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/Hub'],
      'entities/B': ['concepts/Hub'],
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
    // Two shares both hubs, One shares one. Order is by evidence, not by path.
    expect(coCitationCandidates('entities/A', g)).toEqual(['entities/Two', 'entities/One']);
  });

  it('breaks ties by path, so the projection is deterministic', () => {
    // Without this the order follows Map insertion, which follows load order —
    // the same vault read twice could produce two different page bodies. The
    // acceptance measurement in Phase 6 is only repeatable if this holds.
    const g = buildCoCitationGraph(graphOf({
      'entities/A': ['concepts/Hub'],
      'entities/Zulu': ['concepts/Hub'],
      'entities/Alpha': ['concepts/Hub'],
      'entities/Mike': ['concepts/Hub'],
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
      'entities/A': ['concepts/Hub'],
      'entities/B': ['concepts/Hub'],
      'entities/C': ['concepts/Hub'],
    }));
    expect(coCitationCandidates('entities/A', g, { exclude: new Set(['entities/C']) }))
      .toEqual(['entities/B']);
  });

  it('caps the result but keeps the best-ranked candidates', () => {
    const edges: Record<string, string[]> = { 'entities/A': ['concepts/H1', 'concepts/H2'] };
    edges['entities/Top'] = ['concepts/H1', 'concepts/H2'];
    edges['entities/Mid'] = ['concepts/H1'];
    edges['entities/Low'] = ['concepts/H2'];
    const g = buildCoCitationGraph(graphOf(edges));
    // The cap keeps the highest-ranked two: Top on count. Mid and Low are a tie at
    // one shared target each, and the tie is broken by path — `entities/Low` sorts
    // before `entities/Mid`. This expectation is the tie rule being observable
    // rather than assumed.
    expect(coCitationCandidates('entities/A', g, { limit: 2 })).toEqual(['entities/Top', 'entities/Low']);
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
      'entities/A': ['concepts/Ghost'],
      'entities/B': ['concepts/Ghost'],
    }));
    expect(g.incoming.get('concepts/Ghost')).toEqual(['entities/A', 'entities/B']);
    // The projection still reports them — the target *is* shared — but the vault
    // resolver is what refuses to write an edge to a page that does not exist,
    // and that filter is asserted in related-shaping.test.ts.
    expect(coCitationCandidates('entities/A', g)).toEqual(['entities/B']);
  });
});
