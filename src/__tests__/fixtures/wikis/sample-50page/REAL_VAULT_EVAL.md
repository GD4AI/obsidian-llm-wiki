# Real Vault PPR Evaluation (2026-06-30)

## Vault Stats

| Metric | Value |
|--------|-------|
| Wiki pages | 2142 (541 entities + 1571 concepts + 26 sources) |
| Graph vertices | 3473 |
| Graph edges | 12158 |
| Evaluation method | Leave-one-out (each page's outgoing links as ground truth) |
| Eval script | `/tmp/ppr-eval/eval-vault.ts` (outside project — not committed) |

## Parameter Tuning Results

### Config
| Param | Baseline | T1 | T2 | **T3 (recommended) 🏆** | T4 | T5 |
|-------|----------|-----|------|--------------------------|-----|-----|
| damping | 0.15 | 0.10 | 0.10 | **0.05** | 0.05 | 0.05 |
| numWalks | 1000 | 1000 | 3000 | **3000** | 3000 | 5000 |
| walkLength | 20 | 20 | 20 | **20** | 40 | 40 |

### Results

| Strategy | Baseline | T1 | T2 | **T3 🏆** | T4 | T5 |
|----------|----------|-----|-----|-----------|-----|-----|
| lex-only (R@5) | 10.5% | 10.5% | 10.5% | 10.5% | 10.5% | 10.5% |
| **cascade (R@5)** | **21.5%** | 22.3% | 22.3% | **23.8%** | 23.5% | 23.7% |
| cascade+seeds (R@5) | 21.4% | 22.0% | 22.0% | 23.5% | 23.2% | 23.6% |
| cascade (R@10) | 37.2% | 37.9% | 37.8% | **39.6%** | 38.2% | 38.5% |

### Key Findings

1. **damping reduction is the strongest lever**: 0.15→0.10 +0.8pp, 0.10→0.05 +1.5pp (cumulative +2.3pp R@5)
2. **walkLength 20 is optimal**: 40 shows slight degradation (the random walker drifts to irrelevant nodes)
3. **numWalks 3000 is the saturation point**: 5000 adds only +0.2pp R@5 for 67% more computation
4. **lex-only stable at 10.5%** (unaffected by PPR parameters, as expected)
5. **cascade+seeds ≈ cascade on this vault** (eval script uses simplified lex seeds, not the full LLM seed selection prompt shipped in the actual plugin)

### Recommended Parameters (v1.23.0)

```ts
damping = 0.05
numWalks = 3000
walkLength = 20
```

### Comparison with the sample-50page Synthetic Fixture

| Metric | sample-50page (CC0 synth) | Real vault (2142 pages) |
|--------|--------------------------|----------------------|
| lex-only R@5 | 13.3% | 10.5% |
| cascade R@5 (baseline) | 25.4% | 21.5% |
| cascade R@5 (T3) | — | **23.8%** |
| cascade+seeds R@5 (baseline) | 31.0% | 21.4% |

The real vault's lower lex score (10.5% vs 13.3%) is expected: leave-one-out is stricter than the synthetic fixture's hand-crafted queries, and the real graph contains more "noise" pages.
PPR's relative improvement (cascade/lex ≈ 2.3× under T3) is consistent with the synthetic fixture.

## Eval Scripts

Located under `/tmp/ppr-eval/` (independent project, not part of this repository):
- `eval-vault.ts` — main entry point
- `vault-eval.config.ts` — config (vault path, parameters)
- `results/` — per-run result JSON files

Usage:
```bash
npx tsx /tmp/ppr-eval/eval-vault.ts
```

## Conclusion

On this 2142-page real vault, the PPR cascade's R@5 improved from the baseline of 21.5% to 23.8% (+11% relative improvement).
Compared to lex-only at 10.5%, the PPR cascade provides a **2.3× recall improvement**.
The parameter set `damping=0.05, numWalks=3000, walkLength=20` is recommended as the v1.23.0 release default.

## knn Baseline Control (sample-50page, @DocTpoint 2026-06-30)

To separate "PPR cascade is good" from "graph structure tracks semantics", a knn baseline (bge-m3 embeddings, no graph) was run on the same `sample-50page` fixture by @DocTpoint ([#198 comment 4843838...](https://github.com/GD4AI/obsidian-llm-wiki/issues/198)).

| Strategy | R@5 | R@10 |
|----------|-----|------|
| lex (keyword) | 13.3% | 13.3% |
| **knn (bge-m3, no graph)** | **24.1%** | **36.4%** |
| cascade (graph) | 27.1% | 37.8% |

**Attribution.** Most of the cascade's 2.3× over lex lift is *semantic-over-keyword*, not *graph-over-semantic* — a pure semantic retriever (knn) lands within 1-3pp of the cascade. The two arms are complementary by query type:

- `AF rate control` (conceptual synonym): knn 0.43/0.71 **beats** cascade 0.14/0.29 — embeddings resolve the synonym.
- `Pinewood Heart Center` (proper-noun / structural): knn **0.00**, cascade 0.20/0.40 — semantics whiff, the graph walks the source cluster.

**Cascade's honest value:** embedding-grade R@k at zero embedding cost, offline, over links that exist anyway. The "2.3× over lex" framing is correct for the *combined semantic+structural* lift, but the structural component alone is only ~3pp on this fixture. The P2-3 eval gate reports `cascade vs knn` alongside `cascade vs lex` so the relative lift is correctly attributed.

**No opt-in embedding path in v1.24.0+.** 3pp gap (cascade 27.1% vs knn 24.1%) does not justify the 9-provider embedding matrix; reinforces the 2026-06-22 #175 rejection (graph signals cost zero API calls, work for all providers, no new dependencies).
