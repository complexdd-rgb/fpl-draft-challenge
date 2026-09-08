# Prompt curation — 134,765 baseline triad calibration

Source: `fpl-prompt-curation-review-144-triads-shards_134765_1pkuiu3.json`  
Fingerprint: `shards_134765_1pkuiu3`  
Generated: 8 September 2026

## Executive result

- 48 same-group triads / 144 records reviewed.
- 104 proposed decisions confirmed as-is.
- 4 proposed RESCUE decisions overridden to REJECT.
- 36 anchor/rescue rows held pending condition-marginality evidence.
- All 48 proposed REJECT rows are defensible, but only 45 are suitable for automation from the current evidence.

Calibrated row state:

| Decision | Rows |
|---|---:|
| CERTIFY | 30 |
| RESCUE | 26 |
| REJECT | 52 |
| HOLD | 36 |

## Reject calibration

- **31 safe automatic rejects**: `nestedEquivalent=true`. Monotonic set containment plus equal answer count proves the same answer set.
- **14 guarded automatic rejects**: same difficulty and answer band, adjacent monotonic threshold movement, and under 20% answer-count change.
- **3 manual-only exact-stat rejects**: reasonable compression choices, but equality prompts are not monotonic so count similarity alone cannot prove answer-set redundancy.

This means the REJECT side of the policy is calibrated strongly enough to automate the first two classes, while exact-stat adjacency still needs answer-set/benchmark evidence.

## RESCUE overrides

| Triad | Family | Candidate | Why the proposal is rejected |
|---|---|---|---|
| triad_13 | club-stat | Forward who played for Man Utd and with at least 160 FPL points | Quality 64 is below the proposed default rescue floor and the candidate has only 5 answers across 6 seasons; the high-volume club-stat family has stronger hard alternatives. |
| triad_24 | champions | Player from the league champions and with at least 1 bonus points | At least 1 bonus point leaves 169 answers and adds almost no useful challenge beyond being from the champions. |
| triad_34 | manager | Forward managed by Sean Dyche and with at least 115 FPL points | Quality 63 with only 4 answers across 5 seasons / 1 club is too thin for a default rescue in the very large manager family. |
| triad_35 | manager | Goalkeeper managed by David Moyes and with at least 130 FPL points | Quality 64 with 3 answers remains hard like the anchor and is too narrow to justify a default second material cell without a manual scarcity exception. |

Recommended default RESCUE proposal floor before any manual exception:

- quality score >= 65;
- at least 5 answer players;
- still requires material contrast from retained siblings;
- a lower-quality/narrower rescue is allowed only with an explicit scarcity/story exception.

The champions `>=1 bonus` example is a separate failure mode: it is broad but effectively decorative, so distance/band change alone must never qualify a RESCUE.

## Rows held for evidence

The six families below contain two numeric axes in the sampled prompts. Their 18 anchors and 18 rescues are not rejected; they are **held** because the current review export only reports the final answer count.

| Family | Held rows | Why |
|---|---:|---|
| combined-stats | 6 | A second numeric condition can be decorative/dominated even when the full prompt has a good answer count. |
| career-longevity | 6 | A second numeric condition can be decorative/dominated even when the full prompt has a good answer count. |
| club-count | 6 | A second numeric condition can be decorative/dominated even when the full prompt has a good answer count. |
| value | 6 | A second numeric condition can be decorative/dominated even when the full prompt has a good answer count. |
| minutes-role | 6 | A second numeric condition can be decorative/dominated even when the full prompt has a good answer count. |
| composite-story | 6 | A second numeric condition can be decorative/dominated even when the full prompt has a good answer count. |

Required evidence before these rows can become CERTIFY/RESCUE:

- answer-player IDs/fingerprint for the full prompt;
- answer count/set with each condition removed;
- marginal expansion caused by removing each condition;
- pairwise Jaccard overlap against the nearest retained sibling;
- explicit decorative-condition flag when removing a condition does not expand the answer set.

## Threshold quality finding

The triad structure fixed the missing-anchor problem, but anchor selection still optimises existing Quality/evidence more than player-facing threshold quality. Examples such as `23 goal involvements`, `19 bonus points`, and exact `13 goal involvements` are valid but less recognisable than nearby football benchmarks.

Before permanent survivor ranking, add a soft **threshold recognisability** preference. This must be a tie-break/soft score, not a hard rule, because odd exact values can still produce excellent prompts.

## Family calibration matrix

| Family | CERTIFY | RESCUE | REJECT | HOLD |
|---|---:|---:|---:|---:|
| anti-meta | 3 | 3 | 3 | 0 |
| career-longevity | 0 | 0 | 3 | 6 |
| champions | 2 | 1 | 3 | 0 |
| club-count | 0 | 0 | 3 | 6 |
| club-stat | 3 | 2 | 4 | 0 |
| combined-stats | 0 | 0 | 3 | 6 |
| composite-story | 0 | 0 | 3 | 6 |
| exact-stats | 3 | 3 | 3 | 0 |
| league-position | 3 | 3 | 3 | 0 |
| manager | 3 | 1 | 5 | 0 |
| minutes-role | 0 | 0 | 3 | 6 |
| nationality | 3 | 3 | 3 | 0 |
| position-stat | 3 | 3 | 3 | 0 |
| promoted-clubs | 3 | 3 | 3 | 0 |
| relegated-clubs | 2 | 2 | 2 | 0 |
| season-stats | 2 | 2 | 2 | 0 |
| value | 0 | 0 | 3 | 6 |

## Automation boundary after this review

Safe now:

1. auto-REJECT monotonic nested-equivalent siblings with identical answer counts;
2. guarded auto-REJECT adjacent monotonic siblings when difficulty and answer band are unchanged and answer-count change stays below 20%;
3. keep exact-stat adjacency out of automatic count-only rejection.

Not safe yet:

1. automatic CERTIFY/RESCUE for prompts with two numeric axes;
2. distance-maximising RESCUE selection without a quality/breadth floor;
3. treating a broad threshold shift as material when a condition may be decorative;
4. freezing exact survivor IDs before threshold-recognisability and nearest-survivor checks.

## Next implementation

The next curation tool should enrich the paired review using the existing Prompt Factory evaluator. For every reviewed prompt it should export the full answer-player set/fingerprint, per-condition removal counts/sets and pairwise overlap. Once that evidence exists, the 36 held rows can be resolved and the permanent survivor builder can be implemented without guessing.
