# Prompt Curation — 134,765 Full-Evidence Findings

Status: evidence pass complete; survivor proposal builder implementation
Source fingerprint: `shards_134765_1pkuiu3`
Evidence version: `1.0.0`

## Source integrity

The full-library evidence pass analysed all **134,765 promoted prompts** across **17 families** and **2,684 semantic variant groups** against **8,008 positive-minute player-season rows / 2,636 players**.

The most important integrity result is:

- stored answer-count mismatches: **0**

The evidence layer is therefore measuring the same answer populations stored by Promotion rather than exposing an evaluator drift.

## Full-library redundancy

The source contains much more mechanically redundant material than the 144-prompt calibration sample alone could establish:

- prompts with at least one decorative condition: **58,275**
- prompts with an exact-equivalent sibling: **98,148**
- prompts whose nearest one-axis sibling has Jaccard >= 0.95: **112,602**

`prompts with an exact-equivalent sibling` is not the same number as prompts that should be deleted after decorative filtering. Exact-equivalence classes overlap the decorative population.

After the evidence-backed hard pass:

1. decorative prompts cannot be final representatives;
2. exact-equivalent clean prompts collapse to the strongest clean representative in their local class;
3. the surviving clean exact-answer population is **47,542 classes**;
4. **28,948 additional clean prompts** collapse as exact-equivalent siblings;
5. **4,051 exact-answer classes are entirely decorative** and therefore have no survivor candidate.

The evidence engine's stored `exactEquivalentRepresentativeId` is deterministic class identity, not a quality winner. The survivor builder must choose the best **non-decorative** member of each class using Quality evidence, condition marginality, breadth and threshold recognisability rather than blindly retaining the lexicographically chosen evidence ID.

## Family hard-pass counts

| Family | Source | Decorative | Clean exact classes | Clean exact siblings collapsed | Maximum envelope | Effective first-pass ceiling |
|---|---:|---:|---:|---:|---:|---:|
| season-stats | 185 | 0 | 164 | 21 | 185 | 164 |
| champions | 299 | 1 | 189 | 109 | 200 | 189 |
| promoted-clubs | 462 | 0 | 419 | 43 | 225 | 225 |
| relegated-clubs | 414 | 2 | 377 | 35 | 225 | 225 |
| club-count | 632 | 121 | 368 | 143 | 250 | 250 |
| anti-meta | 721 | 80 | 568 | 73 | 300 | 300 |
| exact-stats | 796 | 0 | 794 | 2 | 300 | 300 |
| position-stat | 1,003 | 35 | 874 | 94 | 325 | 325 |
| league-position | 1,398 | 55 | 1,149 | 194 | 325 | 325 |
| career-longevity | 2,362 | 576 | 1,244 | 542 | 350 | 350 |
| value | 6,984 | 2,485 | 3,761 | 738 | 400 | 400 |
| club-stat | 8,606 | 74 | 5,028 | 3,504 | 400 | 400 |
| nationality | 10,386 | 559 | 4,780 | 5,047 | 400 | 400 |
| manager | 14,537 | 268 | 6,573 | 7,696 | 400 | 400 |
| minutes-role | 17,162 | 10,090 | 5,317 | 1,755 | 400 | 400 |
| composite-story | 26,879 | 17,118 | 6,317 | 3,444 | 450 | 450 |
| combined-stats | 41,939 | 26,811 | 9,620 | 5,508 | 450 | 450 |
| **Total** | **134,765** | **58,275** | **47,542** | **28,948** | **5,585** | **5,553** |

The first-pass effective ceiling is **5,553**, not 5,585. `season-stats` can supply only 164 clean exact classes and `champions` only 189 after hard evidence collapse. They are not padded back to their nominal envelopes.

## What is safe to automate now

### Hard evidence rules

These are deterministic and may be applied before softer library balancing:

- block any stored/recomputed answer-count mismatch;
- reject a prompt as a final representative when any condition is decorative (`addedPlayers = 0` when that condition is removed);
- collapse exact-equivalent answer sets to one clean representative inside the semantic variant group;
- when the evidence class's deterministic representative is decorative or weaker, choose the strongest clean class member instead.

### Soft survivor-proposal rules

The remaining compression from 47,542 clean exact classes towards the family envelopes is deliberately a **proposal**, not an irreversible rule. Selection should reward:

- Quality score and coverage;
- strong minimum per-condition marginal contribution;
- position spread;
- easy / medium / hard spread;
- answer-pool-band spread;
- entity diversity for club / manager / nationality material;
- semantic variant-group spread;
- coarse threshold-cell spread;
- recognisable threshold values as a soft tie-break;
- and distance from an already-selected nearest one-axis sibling.

A Jaccard >= 0.95 neighbour is a penalty, not a universal hard reject. High overlap is common throughout the generated lattice and can still contain a useful difficulty or football-story step.

## Calibration HOLD resolution

The 36 temporary HOLD rows from the 144-triad calibration are no longer a blocker. The evidence layer now supplies the missing marginality and exact-answer information for those rows.

Examples that explain why HOLD was necessary:

- `combined-stats` anchors/rescues can have one numeric axis add **0** players, proving that condition decorative even when the prompt looks like a legitimate two-stat challenge;
- `value` can distinguish a decorative high starting-price ceiling from a genuinely selective low-price + performance combination;
- `minutes-role` can distinguish a low minutes threshold that contributes **0** players from a high-minutes condition that genuinely changes the answer set;
- `career-longevity`, `club-count` and `composite-story` similarly contain both genuinely two-axis material and dominated/decorative combinations.

The survivor proposal therefore does not need to preserve HOLD as a permanent status. Every source prompt can now be classified as:

- `SELECT` — proposed survivor;
- `HARD_REJECT` — evidence-invalid as a final representative (for example decorative);
- `COLLAPSE` — exact-answer sibling represented by a stronger clean prompt;
- `DEFER` — clean exact representative outside the current family envelope. This is not a final rejection.

## Boundary

The survivor builder remains read-only. It exports a reviewable proposal and decision ledger only. It does **not** mutate Promotion, the durable saved shards, Daily generation authority, publishing, certification or the repository-certified prompt pool.

Daily cutover remains a later explicit phase after the survivor proposal itself has been audited for family, position, difficulty, answer-band and entity balance.
