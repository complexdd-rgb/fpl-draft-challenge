# Prompt curation — 144 calibration review

Source review batch: `shards_132804_10w85qw`  
Source size: 132,804 prompts · 17 families · 2,683 variant groups  
Generated: 7 September 2026

## Status

This is a **calibration review**, not a frozen survivor package. The batch was generated from an older promoted snapshot than the current Phase 1 baseline, so its prompt IDs and decisions must not become final Daily authority.

The batch itself is structurally sound as a review sample:

- 144 unique prompts;
- 48 proposed CERTIFY;
- 48 proposed RESCUE;
- 48 proposed REJECT;
- every family represented by 8 or 9 prompts;
- all 17 families present.

## Full-corpus audit findings

The source is substantially more compressed by structural variant groups than the earlier spot checks suggested:

- median group size: **15**;
- P90: **33**;
- P95: **71.3**;
- P99: **1,007.4**;
- maximum: **2,531**;
- groups with 251+ siblings: **106**;
- one-per-group simulation: **2,683** survivors;
- two-per-group simulation: **5,247** survivors;
- three-per-group simulation: **7,714** survivors.

The most extreme families are highly combinatorial. Examples:

- combined-stats: 41,292 prompts / 40 groups / average 1,032.3 per group;
- minutes-role: 16,685 / 19 / average 878.16;
- composite-story: 26,582 / 48 / average 553.79;
- value: 6,652 / 20 / average 332.6;
- career-longevity: 2,311 / 10 / average 231.1.

## Policy contradiction exposed by the audit

The original 5,585 family target table cannot be interpreted as a set of quotas while also enforcing a hard ceiling of three survivors per structural variant group.

Examples:

- combined-stats target 450, but 40 groups × 3 permits at most 120;
- minutes-role target 400, but 19 × 3 permits at most 57;
- value target 400, but 20 × 3 permits at most 60;
- career-longevity target 350, but 10 × 3 permits at most 30;
- club-count target 250, but 10 × 3 permits at most 30;
- champions target 200, but 9 × 3 permits at most 27.

Across all 17 families, applying both the family envelope and the three-per-group ceiling yields a maximum of **2,433** survivors on this source, not 5,585.

Therefore the 5,585 figure and family numbers must be treated as **maximum balancing envelopes, not quotas to fill**. Variant-group quality and family balance remain authoritative even when that produces a materially smaller library.

## RESCUE selection bug exposed

The generator currently measures a candidate's material distance from the group anchor only. That allows several siblings to all appear materially different from the anchor while being functionally indistinguishable from one another.

Six proposed RESCUE decisions in this batch should change to REJECT during calibration:

| Review # | Family | Prompt | Calibration decision | Reason |
|---:|---|---|---|---|
| 39 | club-stat | Liverpool, at least 18 goals | REJECT | Same answer count, difficulty, seasons and club breadth as the 16-goal rescue in the same group. |
| 56 | composite-story | Bottom-half DEF, 70+ points, 5+ assists | REJECT | Same 22-player / medium behaviour as the 65-point rescue. |
| 90 | minutes-role | 1,800+ minutes, 32+ goal involvements | REJECT | Same 15-player / medium behaviour as the 1,000-minute rescue. |
| 91 | minutes-role | 2,400+ minutes, 32+ goal involvements | REJECT | Same 15-player / medium behaviour as the 1,000-minute rescue. |
| 108 | position-stat | GK aged 25+ | REJECT | Near-identical broad/easy behaviour to the 24+ rescue; no material gameplay gain. |
| 125 | relegated-clubs | Relegated player, 5+ bonus | REJECT | Would make four kept candidates in one group and adds another very-broad easy threshold sibling. |

Calibration decision count after those changes:

- CERTIFY: **48**;
- RESCUE: **42**;
- REJECT: **54**.

The 48/48/48 split is therefore confirmed as a **sampling quota only**, not a required final decision distribution.

## Permanent rule change

A RESCUE must now be materially different from **every already-retained sibling in its structural variant group**, not only from the anchor.

Review order:

1. choose the strongest CERTIFY anchor;
2. consider RESCUE candidates greedily;
3. compare each candidate with every retained sibling;
4. reject it if its nearest retained sibling is not materially different;
5. never exceed three retained prompts in the structural group without an explicit manual exception.

Near-identical answer behaviour is a default REJECT even when numeric thresholds differ.

## Next gate

Do **not** freeze a survivor package from `shards_132804_10w85qw`.

Next production step:

`latest promoted source -> regenerate audit + 144 -> apply pairwise RESCUE rule -> review deltas -> freeze first survivor package -> regression -> explicit Daily cutover later`

Daily generation/runtime remains unchanged throughout this calibration work.
