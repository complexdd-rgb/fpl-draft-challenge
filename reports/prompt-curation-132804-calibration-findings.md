# Prompt curation calibration findings — `shards_132804_10w85qw`

Date reviewed: 7 September 2026
Source review export: `fpl-prompt-curation-review-144-shards_132804_10w85qw.json`

## Status

This 144-record export is **calibration evidence only**. It is not the current promoted baseline and must not be used to freeze survivor decisions.

The current baseline remains `shards_134765_1pkuiu3` with 134,765 promoted prompts, 17 families and 2,684 variant groups.

## Source snapshot represented by this review

- promoted prompts: **132,804**
- families: **17**
- variant groups: **2,683**
- Quality pass: **132,804**
- Quality review: **0**
- review records: **144**
- proposed CERTIFY / RESCUE / REJECT: **48 / 48 / 48**

The source-level audit reported:

- average prompts per structural group: **49.5**;
- median group size: **15**;
- P90: **33**;
- P95: **71.3**;
- P99: **1,007.4**;
- maximum group size: **2,531**;
- top-five family share: **82.44%**;
- top-six family share: **88.92%**.

These figures confirm that permanent curation must compress threshold churn heavily while preserving family balance.

## Finding 1 — the old structural-group cap conflicts with the family envelopes

The review package proposed both:

- a nominal family-envelope total of **5,585**; and
- a hard ceiling of **3 survivors per current `variantGroup`**.

Those rules cannot sensibly coexist because several current groups are broad semantic threshold spaces rather than narrow equivalence buckets.

Examples:

| Family | Source prompts | Structural groups | Family envelope | Max under 3/group |
|---|---:|---:|---:|---:|
| combined-stats | 41,292 | 40 | 450 | 120 |
| composite-story | 26,582 | 48 | 450 | 144 |
| minutes-role | 16,685 | 19 | 400 | 57 |
| career-longevity | 2,311 | 10 | 350 | 30 |
| value | 6,652 | 20 | 400 | 60 |
| club-count | 623 | 10 | 250 | 30 |

The corrected permanent hierarchy is:

`family -> semantic variant group -> material cell -> representative prompt`

The structural group remains useful for comparison/search, but is no longer a survivor-cap bucket.

## Finding 2 — the old 144 was not pairwise-reviewable

The 144 records cover **87 distinct variant groups**.

Sampled-record counts per represented group:

- 52 groups appear once;
- 17 groups appear twice;
- 14 groups appear three times;
- 4 groups appear four times.

As a result:

- **43/48 proposed REJECT** rows have no sampled CERTIFY anchor from the same group;
- **29/48 proposed RESCUE** rows have no sampled CERTIFY anchor from the same group.

The rationale often says a row is a redundant or materially different sibling, but the comparison prompt is not present. Human reviewers cannot reliably validate that claim from this file alone.

This is why the permanent review batch is now 48 **same-group triads**: displayed anchor + material-contrast candidate + redundancy candidate.

## Finding 3 — nine provable nested-equivalence pairs are visible anyway

Where the old sample happened to include monotonic siblings from the same group, equal answer counts allow a stronger conclusion.

For monotonic filters, one threshold produces an answer set that is a subset of the other. If both nested sets have the same count, the sets are identical. Therefore the threshold change does not create a new material cell.

The review contains **9 such sampled pairs**, affecting **7 proposed RESCUE records** and **8 proposed REJECT records**.

### Proposed RESCUE records that are provably not distinct from another sampled sibling

1. Review 38 vs 39 — `club-stat`, Liverpool >=16 vs >=18 goals: **4 answers / 4 answers**.
2. Review 55 vs 56 — `composite-story`, bottom-half DEF + >=5 assists + >=65 vs >=70 points: **22 / 22**.
3. Review 89 vs 90 — `minutes-role`, >=1,000 vs >=1,800 minutes + >=32 goal involvements: **15 / 15**.
4. Review 89 vs 91 — same group, >=1,000 vs >=2,400 minutes + >=32 goal involvements: **15 / 15**.
5. Review 90 vs 91 — same group, >=1,800 vs >=2,400 minutes + >=32 goal involvements: **15 / 15**.

The minutes-role trio means all three sampled minute thresholds select the same 15-player answer set once >=32 goal involvements is applied. They are not three legitimate rescue cells.

### Proposed REJECT pairs that correctly expose redundancy

1. Review 31 vs 32 — forward 3+ PL clubs + >=65 vs >=70 points: **38 / 38**.
2. Review 41 vs 42 — Liverpool >=75 vs >=70 FPL points: **52 / 52**.
3. Review 49 vs 51 — forward >=20 vs >=90 points + >=24 bonus: **40 / 40**.
4. Review 83 vs 84 — Arsène Wenger player >=145 vs >=140 FPL points: **14 / 14**.

These examples support automatic `nested-equivalent-sibling` rejection where monotonicity is provable.

## Finding 4 — source-limited envelope for this old snapshot is 5,578

The nominal family envelope is 5,585, but `season-stats` contains only **178** source prompts while its envelope is 185.

For this snapshot:

`sum(min(source family count, family envelope)) = 5,578`

The seven-prompt difference should **not** be filled by generating replacement material. Family envelopes are ceilings, not quotas.

The later 134,765 baseline contains 185 season-stats prompts, so its source-limited nominal envelope returns to 5,585 before material-equivalence/quality reductions.

## Finding 5 — counts alone are not enough for arbitrary multi-condition siblings

The nested-equal-count shortcut above is safe because monotonicity proves set containment. It does **not** justify assuming arbitrary siblings with similar counts contain the same players.

Before automatic survivor export, the curation layer should derive where feasible:

- answer-set fingerprint/Jaccard overlap;
- per-condition marginal contribution;
- threshold-vector distance;
- nearest-retained-sibling distance;
- monotonic nested-equivalence;
- entity concentration and family-balance signals.

## Permanent calibration outcome

The old review achieved its real purpose: it exposed weaknesses before any survivor cutover.

Permanent policy changes established from it:

1. keep the promoted source immutable;
2. keep family values as maximum envelopes, never padding quotas;
3. retire the global current-variant-group survivor cap;
4. compress to one representative per materially equivalent cell;
5. make RESCUE pairwise/nearest-survivor aware;
6. use 48 same-group triads for the permanent 144-record calibration batch;
7. store anchor/comparison metadata with each proposed decision;
8. add answer-behaviour evidence before automatic survivor export;
9. keep Daily generation authority unchanged throughout Phase 1.

## Next valid review artifact

The next manual review should be generated from the **current 134,765-prompt baseline** using the paired exporter after this calibration change is merged.

That artifact should contain:

- 48 triads;
- 144 unique records;
- one displayed CERTIFY / RESCUE / REJECT proposal per triad;
- all three records from the same variant group;
- `anchorId`, threshold-distance and redundancy evidence on the comparison rows.

Only that paired batch should be used for the next human calibration pass.
