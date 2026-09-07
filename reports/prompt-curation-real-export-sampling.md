# Prompt curation — real export sampling pass

Source: `fpl-prompt-library-shards-v1-shards_134765_1pkuiu3.json`  
Fingerprint: `shards_134765_1pkuiu3`  
Date sampled: 7 September 2026

## Purpose

This pass spot-checks real records from the saved 134,765-prompt export against the Phase 1 policy. It is not a substitute for the deterministic whole-file audit; it is evidence that the policy behaves sensibly across very different family/group shapes before the complete 144-record batch is materialised.

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

Conclusion: a Quality pass cannot be treated as a permanent-survivor decision. Variant-group compression is mandatory.

## Finding 2 — answer pools can be much broader than the original 150 guide

Real Quality-pass examples include:

- combined-stat prompts with **261** answer players;
- career-longevity prompts with **278–281** answer players;
- combined-stat groups with **175** answer players across several adjacent thresholds.

Conclusion: `151+` should remain an explicit very-broad answer-pool band. Broad prompts can still be useful, but breadth must not automatically earn multiple siblings.

## Finding 3 — compression must be group-aware, not a flat family percentage

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

Conclusion: the two-survivor rule is a **default ceiling/guide**, not a quota. A distinctive three-member group does not need two survivors merely to hit a number, while a 2,393-member group still normally needs only one or two genuinely distinct representatives.

## Finding 4 — champions shows why CERTIFY / RESCUE / REJECT must be semantic

Within champions prompts, the export contains many hard two-answer siblings differing by one threshold point, for example adjacent bonus thresholds inside 27–49-member groups. The same groups also contain medium/easy thresholds with materially larger answer pools.

That gives a useful calibration pattern:

- **CERTIFY** the strongest, clearest representative of a group;
- **RESCUE** a second sibling only when its answer-pool/difficulty contrast is genuinely useful;
- **REJECT** the chain of adjacent one-point threshold siblings that adds no new gameplay.

## Policy result

No sampled evidence requires loosening the Phase 1 compression policy.

The real export instead strengthens these rules:

1. keep the source export immutable;
2. retain the 5,585 survivor envelope;
3. use one survivor where siblings are interchangeable;
4. default to at most two survivors/group;
5. allow a third only for a documented scarcity/diversity reason;
6. judge RESCUE by material gameplay contrast rather than numerical threshold distance alone;
7. preserve family/position/difficulty diversity without reproducing generator-volume imbalance.

## Execution boundary

The exact export exists in the File Library and is searchable, but that File Library object is not mounted as a raw filesystem file in the current execution environment. Therefore this pass records only directly observed real-export evidence and does **not** pretend to be the deterministic 144-record output.

The repository audit remains the authority for producing the complete 144-record batch once the raw JSON is executable:

```bash
node scripts/audit-prompt-curation-v1.mjs fpl-prompt-library-shards-v1-shards_134765_1pkuiu3.json
```

Daily generation authority remains unchanged.
