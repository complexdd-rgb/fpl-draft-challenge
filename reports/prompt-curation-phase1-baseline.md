# Prompt curation Phase 1 — baseline

Baseline export fingerprint: `shards_134765_1pkuiu3`
Saved: 7 September 2026

## Confirmed source state

- Promoted prompts: **134,765**
- Families: **17**
- Variant groups: **2,684**
- Quality pass: **134,765**
- Quality review: **0**
- Average prompts per variant group: **50.21**

This is a curation problem, not a generation shortage.

## Family balance

| Rank | Family | Prompts | Source share | Phase 1 maximum envelope |
|---:|---|---:|---:|---:|
| 1 | combined-stats | 41,939 | 31.12% | 450 |
| 2 | composite-story | 26,879 | 19.95% | 450 |
| 3 | minutes-role | 17,162 | 12.73% | 400 |
| 4 | manager | 14,537 | 10.79% | 400 |
| 5 | nationality | 10,386 | 7.71% | 400 |
| 6 | club-stat | 8,606 | 6.39% | 400 |
| 7 | value | 6,984 | 5.18% | 400 |
| 8 | career-longevity | 2,362 | 1.75% | 350 |
| 9 | league-position | 1,398 | 1.04% | 325 |
| 10 | position-stat | 1,003 | 0.74% | 325 |
| 11 | exact-stats | 796 | 0.59% | 300 |
| 12 | anti-meta | 721 | 0.54% | 300 |
| 13 | club-count | 632 | 0.47% | 250 |
| 14 | promoted-clubs | 462 | 0.34% | 225 |
| 15 | relegated-clubs | 414 | 0.31% | 225 |
| 16 | champions | 299 | 0.22% | 200 |
| 17 | season-stats | 185 | 0.14% | 185 |

The five largest families contain **82.29%** of the source library. The six largest contain **88.68%**. That concentration is far too high to use raw family volume as a permanent-library weighting.

## Calibrated compression envelope

The Phase 1 nominal maximum envelope is **5,585 prompts**.

- source -> nominal-envelope reduction: **95.86%**;
- nominal envelope/current variant group: **2.08** as an aggregate diagnostic only;
- family numbers are ceilings, not quotas;
- the current `variantGroup` is a semantic shape, not a hard survivor bucket;
- there is **no universal 2-per-group target or 3-per-group cap**;
- the permanent compression unit is the **material cell**;
- keep at most one representative per materially equivalent cell.

The baseline source contains at least each family envelope amount, so its source-limited effective ceiling is the full **5,585**. The final curated library can finish lower after material-equivalence, quality and balance rules are applied.

The source export remains immutable. Curation creates downstream survivor decisions/packages and never deletes provenance.

## Why the structural-group cap was retired

The older provisional policy treated a current variant group as if it were a narrow threshold-sibling bucket. The calibration batch showed that this is not true for several families.

Examples from the older `shards_132804_10w85qw` calibration snapshot:

- `minutes-role`: 19 groups against a family envelope of 400 — a three-per-group cap would allow only 57;
- `combined-stats`: 40 groups against 450 — a three-per-group cap would allow only 120;
- `career-longevity`: 10 groups against 350 — a three-per-group cap would allow only 30;
- `value`: 20 groups against 400 — a three-per-group cap would allow only 60.

Those groups contain broad two-dimensional threshold spaces and multiple difficulty/answer-pool regions. Compressing the entire structural group to three would discard materially different gameplay.

The corrected hierarchy is:

`family -> semantic variant group -> material cell -> representative prompt`

Diagnostic one/two/three-per-group simulations are still useful for understanding structural concentration, but they no longer define survivor capacity.

## Evidence of threshold explosion

The promoted records expose very large threshold families. Examples in the source include 30+ near-neighbour point thresholds, 100+ career-club/stat variants and combined-stat groups whose stored `variantGroupSize` exceeds 2,300. File Library sampling observed a group size of **2,393**.

These prompts can all pass structural Quality checks while still containing both:

- large chains of redundant adjacent thresholds that should collapse; and
- genuinely different answer-pool/difficulty/threshold regions that should not be destroyed by a global group cap.

## Permanent 144-record calibration batch

The calibrated audit tool creates **48 same-group triads / 144 records**:

- 48 proposed CERTIFY anchors;
- 48 proposed RESCUE material contrasts;
- 48 proposed REJECT redundancy challenges.

Every triad contains all three comparisons from the same `variantGroup`, and every non-anchor row records the displayed anchor ID.

Family representation:

- all 17 families appear;
- the three smallest source families contribute two triads each;
- the remaining fourteen contribute three triads each;
- entity and position diversity are preferred when alternatives exist.

The 48/48/48 split is a sampling structure, not a required final decision distribution. Human review can and should change proposed decisions.

## Calibration evidence from the uploaded 132,804 batch

The older `shards_132804_10w85qw` batch is retained as policy-calibration evidence only; it is not the current promoted baseline.

It exposed that:

- 43/48 proposed REJECT rows lacked a same-group CERTIFY anchor in the sample;
- 29/48 proposed RESCUE rows lacked a same-group CERTIFY anchor;
- several proposed RESCUE siblings were monotonic threshold variants with identical answer counts.

Examples include Liverpool 16/18-goal prompts both returning four players, bottom-half DEF 65/70-point + 5-assist prompts both returning 22, and the 1,000/1,800/2,400-minute + 32-GI trio all returning 15.

For monotonic nested filters, an unchanged count guarantees the nested answer set is unchanged. Those examples are equivalent-cell evidence, not distinct rescues.

Detailed record-level evidence is preserved in `reports/prompt-curation-132804-calibration-findings.md`.

## What remains before survivor export

Before a permanent curated package is written, add or derive where feasible:

- per-condition marginal contribution;
- answer-set fingerprint/Jaccard overlap;
- monotonic nested-equivalence detection;
- threshold-vector distance;
- nearest-retained-sibling distance;
- entity concentration;
- final family/position/difficulty/answer-band balance checks.

The export contains Quality-pass prompts well above 150 answer players, so `151+` remains a separate very-broad answer band.

Daily generation authority remains unchanged throughout Phase 1 until a separately verified explicit survivor cutover.
