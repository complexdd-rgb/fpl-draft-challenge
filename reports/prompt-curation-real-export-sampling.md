# Prompt curation — real export sampling pass

Source: `fpl-prompt-library-shards-v1-shards_134765_1pkuiu3.json`
Fingerprint: `shards_134765_1pkuiu3`
Date sampled: 7 September 2026

## Status note

This report records an early real-export spot-sampling pass. Its observed source evidence remains valid, but its original conclusion that the current `variantGroup` should normally be capped at two or three survivors has been **superseded by the later Phase 1 calibration review**.

The permanent policy is `PROMPT_CURATION_POLICY.md`: current variant groups are semantic shapes, the permanent compression unit is the material cell, and there is no universal hard survivor cap per current structural group.

## Purpose

This pass spot-checks real records from the saved 134,765-prompt export against the Phase 1 policy. It is not a substitute for the deterministic whole-file audit; it is evidence about real family/group shapes and threshold density.

## Confirmed manifest

- 134,765 promoted prompts
- 17 families
- 2,684 variant groups
- 134,765 Quality pass
- 0 Quality review

## Finding 1 — combined-stat threshold explosion is extreme

The current export contains variant groups above two thousand siblings. Examples observed:

- `vg_fwd_akvlpe`: stored group size **2,393**. Adjacent prompts include forwards on 90 / 95 FPL points with the same 24-bonus threshold.
- `vg_any_116bs1b`: stored group size **2,389**. The same group spans broad/easy material such as 50–65 FPL points + 19 bonus, medium material around 140–155 points + 32 bonus, and much narrower material above 220 points + 36/37 bonus.
- `vg_any_j88uy`: stored group size **1,657** with dense adjacent point thresholds against the same goals condition.

Conclusion: a Quality pass cannot be treated as a permanent-survivor decision. Compression is mandatory.

The important later calibration refinement is that a 2,393-member group is **not one material cell**. It contains both dense redundant threshold chains and materially different difficulty/answer-pool regions. Compression must happen inside that semantic shape rather than by imposing a universal cap on the whole group.

## Finding 2 — answer pools can be much broader than the original 150 guide

Real Quality-pass examples include:

- combined-stat prompts with **261** answer players;
- career-longevity prompts with **278–281** answer players;
- combined-stat groups with **175** answer players across several adjacent thresholds.

Conclusion: `151+` should remain an explicit very-broad answer-pool band. Broad prompts can still be useful, but breadth must not automatically earn multiple near-identical siblings.

## Finding 3 — compression must be group-aware and cell-aware, not a flat family percentage

### Career longevity

Observed single-condition groups can be small:

- goalkeeper 12+ recorded PL seasons: group size **11**;
- forward 11+ recorded PL seasons: group size **9**;
- defender 4+ recorded PL seasons: group size **12**.

But career + points groups are much larger:

- defender career-season + points group: **474**;
- all-position career-season + points group: **517**;
- midfielder career-season + points group: **546**.

### Career club count

Observed single-condition material can be tiny:

- midfielder with 4+ recorded PL clubs: group size **3**.

Combination groups are much larger:

- defender club-count + points: **114**;
- forward club-count + points: **138**;
- all-position club-count + points: **139**.

### Club + stat

Observed groups frequently sit in a smaller range than combined-stats:

- examples with group sizes **4, 5, 9, 11, 12, 13, 18, 19, 21, 29, 31, 36, 38**.

Calibrated conclusion: family percentages and raw group sizes are diagnostic signals, not survivor quotas. Small groups may collapse to one representative, while large two-dimensional groups may contain more than three legitimate material cells even though most numeric siblings should still be rejected.

## Finding 4 — champions shows why CERTIFY / RESCUE / REJECT must be semantic

Within champions prompts, the export contains many hard two-answer siblings differing by one threshold point, for example adjacent bonus thresholds inside 27–49-member groups. The same groups also contain medium/easy thresholds with materially larger answer pools.

That gives a useful calibration pattern:

- **CERTIFY** the strongest, clearest representative of a material area;
- **RESCUE** a sibling only when its answer-pool/difficulty/threshold contrast is genuinely useful;
- **REJECT** adjacent one-point threshold chains that add no new gameplay.

This pattern remains valid after retiring the global structural-group cap.

## Superseded provisional conclusion

The original version of this report concluded:

- default to at most two survivors per current `variantGroup`;
- allow a third only for scarcity/diversity.

That inference was too aggressive because it treated the current group key as a narrow equivalence bucket. The later 144-record calibration exposed that some families have very few structural groups relative to their deliberately broad family envelopes—for example `minutes-role` has only 19 groups and `combined-stats` only 40 in the older 132,804 snapshot.

A three-per-group cap would therefore discard whole difficulty/answer-pool regions rather than merely compress threshold churn.

The corrected permanent rules are:

1. keep the source export immutable;
2. keep 5,585 as a nominal family-envelope ceiling, not a quota;
3. treat the current variant group as a semantic shape;
4. subdivide that shape by material gameplay behaviour;
5. keep one strongest representative per materially equivalent cell;
6. use nearest-retained-sibling comparison for additional survivors;
7. reject nested-equivalent and adjacent near-duplicate threshold churn;
8. preserve family/position/difficulty/entity diversity without reproducing generator-volume imbalance.

## Execution boundary

The exact 134,765 export remains the current promoted baseline. This report itself is only sampled evidence and does not freeze survivor decisions.

The repository audit is the authority for producing the complete paired review batch from an executable shard package:

```bash
node scripts/audit-prompt-curation-v1.mjs fpl-prompt-library-shards-v1-shards_134765_1pkuiu3.json
```

The current audit/exporter produces **48 same-group triads / 144 records**, allowing every CERTIFY / RESCUE / REJECT proposal to be reviewed against its displayed comparison siblings.

Daily generation authority remains unchanged.
