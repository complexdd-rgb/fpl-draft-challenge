# Prompt Curation — 134,765 Survivor v1.1 Material-Lane Audit

Date: 8 September 2026
Source fingerprint: `shards_134765_1pkuiu3`
Builder audited: `prompt-curation-survivor-builder-v1` v1.1.0
Proposal records selected: **5,525**

## Executive finding

The v1.1 quality-floor correction worked, but the proposal is still not ready to freeze.

The good news is clear:

- 134,765 source prompts reconcile to 134,765 evidence rows;
- stored/recomputed answer mismatches remain **0**;
- all 5,525 selected prompts have quality **>= 65**;
- the source still hard-rejects 58,275 decorative prompts;
- 28,948 clean exact-equivalent siblings are collapsed;
- survivor wording normalisation is active and the selected package contains no remaining definite `1 goals` / `1 assists` / `1 bonus points` style defects.

The remaining problem is structural repetition. **15 of 17 families still fill their maximum envelope exactly.** That means the quality floor stopped weak quota-filling but did not stop strong-looking threshold ladders from filling the same envelopes.

Examples in the selected package include long monotonic sequences such as the same goalkeeper/relegated-club points prompt surviving at many adjacent thresholds. These are not exact answer-set duplicates, but they are too similar as player-facing challenges to justify separate permanent survivor slots.

## v1.1 global balance

### Position

| Position | Count | Share |
|---|---:|---:|
| ANY | 1,636 | 29.61% |
| MID | 1,096 | 19.84% |
| DEF | 1,014 | 18.35% |
| FWD | 944 | 17.09% |
| GK | 835 | 15.11% |

### Difficulty

| Difficulty | Count | Share |
|---|---:|---:|
| Easy | 3,011 | 54.50% |
| Medium | 1,878 | 33.99% |
| Hard | 636 | 11.51% |

### Answer-player bands

| Answer band | Count | Share |
|---|---:|---:|
| 2 | 10 | 0.18% |
| 3–5 | 112 | 2.03% |
| 6–15 | 1,240 | 22.44% |
| 16–40 | 1,853 | 33.54% |
| 41–80 | 1,462 | 26.46% |
| 81–150 | 653 | 11.82% |
| 151+ | 195 | 3.53% |

The balance is healthy enough that further compression can focus on repetition rather than trying to reshape the global difficulty distribution.

## Evidence that envelopes still behave like quotas

The following 15 families hit their maximum exactly in v1.1:

`position-stat`, `exact-stats`, `combined-stats`, `club-stat`, `league-position`, `promoted-clubs`, `relegated-clubs`, `nationality`, `career-longevity`, `club-count`, `manager`, `anti-meta`, `value`, `minutes-role`, `composite-story`.

Only `season-stats` (152/185) and `champions` (173/200) naturally stop below their ceiling.

That is too close to the nominal 5,585 ceiling for a library whose stated objective is curation/compression rather than quota completion.

## Material-lane simulation on the selected v1.1 package

A conservative next-pass rule was simulated against the 5,525 selected records:

1. If a prompt has exactly one numeric condition and the operator is monotonic (`>=`, `<=`, `>`, `<`), keep at most one representative per:
   - semantic variant group;
   - difficulty; and
   - answer-player band.
2. Otherwise, keep at most one representative per existing coarse material cell.
3. Pick the strongest representative using the existing quality, coverage, marginality, answer utility and threshold-recognisability score.
4. Defer the other lane members rather than hard-delete them.

Applied only to the already-selected v1.1 package, this reduces **5,525 -> approximately 4,001** records, a further **1,524-record compression**.

| Family | v1.1 selected | Simulated material-lane survivors | Further compression |
|---|---:|---:|---:|
| season-stats | 152 | 52 | 100 |
| position-stat | 325 | 185 | 140 |
| exact-stats | 300 | 238 | 62 |
| combined-stats | 450 | 446 | 4 |
| club-stat | 400 | 384 | 16 |
| league-position | 325 | 175 | 150 |
| promoted-clubs | 225 | 102 | 123 |
| relegated-clubs | 225 | 103 | 122 |
| champions | 173 | 34 | 139 |
| nationality | 400 | 363 | 37 |
| career-longevity | 350 | 237 | 113 |
| club-count | 250 | 141 | 109 |
| manager | 400 | 282 | 118 |
| anti-meta | 300 | 107 | 193 |
| value | 400 | 369 | 31 |
| minutes-role | 400 | 345 | 55 |
| composite-story | 450 | 438 | 12 |

This is a simulation on the v1.1 selected set, not the final v1.2 result. The full v1.2 builder runs the material-lane rule before family-envelope selection, so it can still choose a better representative from eligible deferred material where appropriate.

## Coverage survives the simulated compression

The simulation preserves the full selected entity coverage in the three most entity-sensitive families:

- manager: **52/52** represented manager entities retained;
- nationality: **49/49** represented nationalities retained;
- club-stat: **30/30** represented club entities retained.

The simulated difficulty balance also remains healthy:

- easy: about 53%;
- medium: about 34%;
- hard: about 13%.

This supports material-lane compression as genuine redundancy reduction rather than diversity loss.

## Remaining answer-set overlap

Among v1.1 selected prompts whose exported nearest one-axis neighbour is also selected:

- 222 pairs are at Jaccard >= 0.90;
- 39 pairs are at Jaccard >= 0.95;
- 2 pairs are at Jaccard >= 0.98;
- 0 pairs are at Jaccard >= 0.995.

The overlap evidence still supports using Jaccard as a soft tie-break rather than a universal hard cutoff. The larger repetition problem is semantic threshold-ladder density, which the new lane rule addresses directly.

## v1.2 policy correction

Survivor Builder v1.2 therefore adds a proposal-only material compression stage after exact-answer collapse and the quality floor, but before family-envelope selection:

- **single monotonic numeric axis:** one representative per semantic group + difficulty + answer band;
- **all other prompts:** one representative per coarse material cell;
- deferred lane siblings remain recoverable for manual scarcity/story rescue;
- family envelopes remain maximums only;
- Daily generation authority remains unchanged.

This aligns the implementation with the permanent policy hierarchy:

`family -> semantic variant group -> material cell/lane -> representative prompt`

## Freeze decision

**Do not freeze the 5,525 v1.1 proposal.**

The next candidate should be generated with Survivor Builder v1.2.0. If that full run lands near the simulated ~4,000 range while preserving family/entity balance, it should be the first serious freeze candidate.

Daily generation, publishing and the saved promoted source remain untouched throughout this pass.
