# FPL Draft Challenge — Phase 1 v1.2 Survivor Freeze Audit

Status: **PASS — freeze approved**
Source promotion fingerprint: `shards_134765_1pkuiu3`
Survivor Builder: **v1.2.0**
Proposal generated: `2026-09-08T11:51:38.868Z`
Source: **134,765 prompts · 17 families · 2,684 variant groups**
Frozen survivor count: **4,897**

## Decision

The v1.2 survivor proposal is accepted as the first permanent Phase 1 **frozen survivor set**.

The earlier v1.1 proposal was not accepted because 5,525 selections still retained too much one-axis threshold-ladder volume. v1.2 applies material-lane compression before family selection and removes that failure mode. The final 4,897-prompt result is higher than the earlier ~4,001 simulation because the simulation operated only on the v1.1 selected set; the real v1.2 run compresses all eligible clean classes first, then legitimately fills remaining distinct material cells.

No further global compression pass is justified by the residual-overlap audit below. Local future manual rescues/rejections remain possible, but they are not blockers to the Phase 1 freeze.

## Integrity

- Full proposal SHA-256: `339b4bb4026fef113d6513dd312eef88ab16b81a2d04c81ebdd273c96cd1f1b9`
- Frozen sorted survivor-ID SHA-256: `3d3b0776ca0df171f6017c8e436f167308c4bfdd4d0b74b4e57b6089edff972d`
- Canonical decision-ledger SHA-256: `5dfb2516e04421190e0ccc5d46a84c760c24e453220493d52048772776048e84`
- Selected IDs: **4,897**
- Duplicate survivor IDs: **0**
- Disabled survivors: **0**
- non-`pass` survivors: **0**
- missing/blank labels: **0**
- empty condition sets: **0**
- survivor answer-count mismatches: **0**
- survivors with decorative conditions: **0**

The companion frozen manifest stores all 4,897 selected source IDs by family, so curated-package construction can materialise the exact approved set from the immutable promoted snapshot without copying the 34 MB proposal into the repository.

## Hard-collapse result

- source prompts: **134,765**
- decorative hard rejects: **58,275**
- stored-answer mismatches: **0**
- clean exact-equivalent siblings collapsed: **28,948**
- clean exact representatives: **47,542**
- eligible clean representatives at quality >=65: **40,018**
- material cells after v1.2 compression: **11,613**
- material-lane deferred classes: **28,405**
- below-quality-floor deferred classes: **7,524**
- final selected survivors: **4,897**

All selected prompts have quality score **>=65**. Mean selected quality is **90.1**.

## Balance

### Difficulty

- easy: **2,420 (49.4%)**
- medium: **1,658 (33.9%)**
- hard: **819 (16.7%)**

This is a healthier final mix than the v1.1-selected-set simulation and preserves a substantial hard tail without making the library mostly niche.

### Position

- ANY: **1,423 (29.1%)**
- MID: **999 (20.4%)**
- DEF: **964 (19.7%)**
- FWD: **805 (16.4%)**
- GK: **706 (14.4%)**

### Answer bands

- 2: **10**
- 3–5: **201**
- 6–15: **1,337**
- 16–40: **1,557**
- 41–80: **1,016**
- 81–150: **522**
- 151+: **254**

The ultra-narrow 2-answer band is only 10 prompts; it remains an intentional hard tail rather than a material share of the library.

## Family result

| Family | Selected | Max envelope | Material cells | Eligible cells deferred by family cap |
|---|---:|---:|---:|---:|
| season-stats | 63 | 185 | 63 | 0 |
| position-stat | 291 | 325 | 291 | 0 |
| exact-stats | 300 | 300 | 340 | 40 |
| combined-stats | 450 | 450 | 1872 | 1422 |
| club-stat | 400 | 400 | 1431 | 1031 |
| league-position | 325 | 325 | 356 | 31 |
| promoted-clubs | 155 | 225 | 155 | 0 |
| relegated-clubs | 155 | 225 | 155 | 0 |
| champions | 48 | 200 | 48 | 0 |
| nationality | 400 | 400 | 1814 | 1414 |
| career-longevity | 350 | 350 | 388 | 38 |
| club-count | 157 | 250 | 157 | 0 |
| manager | 400 | 400 | 750 | 350 |
| anti-meta | 153 | 300 | 153 | 0 |
| value | 400 | 400 | 1308 | 908 |
| minutes-role | 400 | 400 | 972 | 572 |
| composite-story | 450 | 450 | 1360 | 910 |

Ten families still reach their review envelope. That is not the v1.1 quota failure: material-lane compression has already happened before the cap, and the overlap audit shows the resulting selected set is not dominated by adjacent equivalent ladders. The caps now serve their intended role — preventing combinatorial families from consuming the library — rather than manufacturing survivor volume.

The two 450-prompt families (`combined-stats`, `composite-story`) each represent about **9.2%** of the frozen library. This is a documented, modest exception to the policy's approximate 8% review guard: both have very large clean material spaces, are already bounded at 450, and do not show enough residual near-duplicate behaviour to justify an artificial cut merely to hit a round share.

## Entity coverage

- managers: **52 distinct**, selected representation **4–16 prompts each**
- nationalities: **49 distinct**, selected representation **1–43 prompts each**
- club-stat club entities: **30 distinct**, selected representation **4–21 prompts each**

The v1.2 pass therefore preserves the entity breadth that the v1.1 simulation was intended to protect.

## Residual answer-set overlap

Among 4,897 selected prompts:

- selected nearest-neighbour pairs with Jaccard >=0.90: **64**
- Jaccard >=0.95: **10**
- Jaccard >=0.98: **2**
- Jaccard >=0.99: **1**
- duplicated answer fingerprints across different selected semantic prompts: **75 groups / 86 extra records**
- largest cross-semantic identical-answer class: **3 prompts**

The duplicated fingerprints are not evidence of the old threshold-ladder failure by themselves: they occur across different semantic clue routes (for example club-specific points vs saves/clean-sheet clues) and represent only about **1.8%** of selected records.

### The ten selected >=0.95 nearest-neighbour pairs

- 0.9935 `club-count` — Player with at least 3 recorded Premier League clubs and with at least 75 FPL points ↔ Player with at least 3 recorded Premier League clubs and with at least 70 FPL points
- 0.9855 `composite-story` — Player from a bottom-half club and with at least 140 FPL points and with at least 4 goal involvements ↔ Player from a bottom-half club and with at least 140 FPL points and with at least 5 goal involvements
- 0.9762 `club-count` — Defender with at least 3 recorded Premier League clubs and with at least 70 FPL points ↔ Defender with at least 3 recorded Premier League clubs and with at least 75 FPL points
- 0.9737 `combined-stats` — Goalkeeper with at least 70 FPL points and with at least 5 bonus points ↔ Goalkeeper with at least 70 FPL points and with at least 4 bonus points
- 0.9677 `combined-stats` — Midfielder with at least 180 FPL points and with at least 20 bonus points ↔ Midfielder with at least 175 FPL points and with at least 20 bonus points
- 0.9667 `composite-story` — Player outside the traditional Big Six and with at least 130 FPL points and with at least 10 goal involvements ↔ Player outside the traditional Big Six and with at least 130 FPL points and with at least 9 goal involvements
- 0.9615 `composite-story` — Player from a top-four club and with at least 150 FPL points and with at least 10 goal involvements ↔ Player from a top-four club and with at least 150 FPL points and with at least 9 goal involvements
- 0.9512 `combined-stats` — Goalkeeper with at least 90 saves and with at least 10 bonus points ↔ Goalkeeper with at least 95 saves and with at least 10 bonus points
- 0.9512 `career-longevity` — Midfielder with at least 8 recorded Premier League seasons and with at least 140 FPL points ↔ Midfielder with at least 8 recorded Premier League seasons and with at least 145 FPL points
- 0.9500 `career-longevity` — Player with at least 10 recorded Premier League seasons and with at least 145 FPL points ↔ Player with at least 10 recorded Premier League seasons and with at least 150 FPL points

These are small local boundary effects in multi-axis/coarse material cells. Only two exceed 0.98. The permanent policy explicitly treats Jaccard >=0.95 as a soft review signal rather than a universal hard reject, so this residue is acceptable for the freeze.

## Frozen-set rule

For snapshot `shards_134765_1pkuiu3`:

> **The 4,897 IDs in `reports/prompt-curation-134765-survivor-v12-freeze-manifest.json` are the approved Phase 1 survivor set.**

The source promoted package remains immutable. All other source prompts remain provenance and are not physically destroyed.

This freeze does **not** change Daily authority.

## Next controlled stage

The permanent curation sequence is now:

`promoted source export -> curation audit -> paired calibration -> full evidence -> survivor proposal -> survivor balance audit -> FROZEN SURVIVOR DECISIONS -> curated package verification -> full generation regression -> explicit cutover`

The next implementation task is therefore **curated package construction + verification from the frozen 4,897 IDs**, followed by the full generation regression. Daily should not switch to the curated package until those checks pass and the cutover is made explicitly.
