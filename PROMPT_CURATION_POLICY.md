# FPL Draft Challenge — Permanent Prompt Curation Policy

Status: Phase 1 calibration-refined  
Current baseline export: `shards_134765_1pkuiu3`  
Current baseline size: 134,765 promoted prompts · 17 families · 2,684 variant groups

## Purpose

Prompt Factory and Quality Analyser deliberately explore a large prompt space. A Quality `pass` means a prompt is structurally valid and playable; it does **not** mean every numeric-threshold sibling deserves permanent library space.

Curation is the boundary between **eligible generated material** and the **long-lived survivor library**.

This policy is intentionally downstream of Prompt Factory, Quality Analyser and Promotion. It does not change Daily generation, the 77-prompt weekly reservoir, nationality/semantic-diversity rules, certification, publishing, leaderboard behaviour or Supabase publication.

## Core rules

1. **Keep the source export immutable.** The promoted shard package is provenance. Curation produces decisions and survivor IDs/packages; it never destroys the source pool.
2. **Quality pass is an entry ticket, not certification.** A prompt can be technically excellent and still be rejected as redundant.
3. **The current `variantGroup` is a semantic shape, not a hard survivor bucket.** Some groups contain hundreds or thousands of legitimate threshold combinations and difficulty tiers. A universal two-per-group target or three-per-group cap is therefore invalid.
4. **The permanent compression unit is the material cell.** Treat the hierarchy as `family -> semantic variant group -> material cell -> representative prompt`.
5. **Only one survivor is allowed per materially equivalent cell.** Equivalent or near-equivalent threshold siblings collapse to the strongest representative.
6. **A second prompt from the same structural group must add gameplay contrast.** It should materially change answer behaviour, difficulty, threshold vector or another useful player-facing dimension.
7. **There is no arbitrary maximum number of survivors per current structural group.** A large group may contribute many survivors if they occupy genuinely different material cells and the family remains inside its envelope.
8. **RESCUE is pairwise, not anchor-only.** A rescue candidate must be materially different from every already-retained sibling in its local material neighbourhood, not merely from the first CERTIFY anchor.
9. **Family balance beats generator volume.** Large combinatorial families do not earn a proportionally large survivor allocation.
10. **Exact duplicates and nested-equivalent siblings are automatic REJECT.** If monotonic threshold changes leave the answer count unchanged, the nested answer set is unchanged too.
11. **Historical/data safety remains mandatory.** Missing-field/null safety and all existing certification boundaries still apply after curation.
12. **Every decision is explainable and reproducible.** Store decision, reason code, source prompt ID, variant group, material evidence and comparison anchor/nearest survivor.

## Material-cell definition

A material cell is the smallest useful gameplay neighbourhood inside a semantic variant group. It is determined from the combination of:

- difficulty tier;
- answer-pool band;
- answer-player count and, when available, answer-set identity/overlap;
- the numeric/string condition vector and the size of threshold moves on independent axes;
- position or entity dimensions already encoded by the group;
- per-condition marginal contribution where available;
- and recognisable player-facing football value.

Two prompts are **not** different material cells merely because one number changed.

Strong evidence that two siblings are materially equivalent includes:

- same difficulty and answer-pool band with only adjacent threshold movement;
- very small answer-count change;
- monotonic nested thresholds with exactly the same answer count;
- near-identical answer-set fingerprint/Jaccard overlap;
- a condition whose removal does not materially expand the answer set;
- or one condition being dominated by another condition.

## Decision vocabulary

### CERTIFY

Use for the strongest representative of a useful material cell.

Default evidence:

- structurally valid promoted prompt;
- preferably quality score >= 65;
- preferably at least 3 answer players;
- good coverage/evidence breadth;
- clean, recognisable wording and thresholds;
- every condition contributes meaningfully;
- and no clearly superior sibling covers the same material cell.

### RESCUE

Use for a non-anchor sibling that represents a genuinely different material cell but still needs a threshold, wording, marginality or balance check before certification.

A RESCUE needs at least one material reason:

- changes answer-pool band;
- answer-player count differs materially (guide: >= max(3 players, 20%));
- changes useful difficulty band;
- moves substantially on one or more independent threshold axes;
- has materially different answer-set identity/overlap;
- fills a family/position/entity scarcity;
- preserves a particularly strong or recognisable football story;
- or is needed for a documented Daily diversity constraint after curation becomes production authority.

A RESCUE must also pass the **nearest-retained-sibling test**:

1. start with the strongest CERTIFY representative in the local material area;
2. consider rescue candidates in descending usefulness;
3. compare each candidate with every nearby survivor already retained in that semantic group;
4. retain it only when the nearest retained sibling is materially different;
5. reject near-identical answer behaviour even when the numeric threshold itself differs.

RESCUE is not a softer version of CERTIFY. It is an explicit claim that the sibling adds distinct gameplay value.

### REJECT

Use when a prompt adds volume without meaningful new gameplay.

Typical reasons:

- redundant threshold sibling;
- adjacent threshold churn with the same answer behaviour;
- monotonic nested-equivalent sibling;
- decorative or non-contributory condition;
- dominated condition;
- materially weaker representative of the same material cell;
- duplicate/near-duplicate wording or answer behaviour;
- tiny answer pool with weak breadth when a better sibling exists;
- arbitrary numeric variation with no recognisable football/challenge value.

REJECT does not mean the prompt was broken. It remains valid provenance in the immutable source export.

For exact-stat prompts, adjacent exact values are not automatically distinct survivors. Prefer recognisable benchmarks and materially different answer sets.

## Survivor envelope

Phase 1 nominal balancing envelope: **5,585 prompts**.

This is **not a quota to fill**. Family numbers are maximum review envelopes. A family is never padded by generating new prompts or by weakening equivalence rules merely to reach its envelope.

| Family | Current baseline source | Maximum envelope |
|---|---:|---:|
| combined-stats | 41,939 | 450 |
| composite-story | 26,879 | 450 |
| minutes-role | 17,162 | 400 |
| manager | 14,537 | 400 |
| nationality | 10,386 | 400 |
| club-stat | 8,606 | 400 |
| value | 6,984 | 400 |
| career-longevity | 2,362 | 350 |
| league-position | 1,398 | 325 |
| position-stat | 1,003 | 325 |
| exact-stats | 796 | 300 |
| anti-meta | 721 | 300 |
| club-count | 632 | 250 |
| promoted-clubs | 462 | 225 |
| relegated-clubs | 414 | 225 |
| champions | 299 | 200 |
| season-stats | 185 | 185 |
| **Total maximum envelope** | **134,765** | **5,585** |

### Snapshot feasibility guard

For every source snapshot and family:

`effective family envelope = min(source family count, family maximum envelope)`

The effective snapshot ceiling is the sum of those effective family envelopes. The final survivor count may be lower again after material-equivalence, quality and balance rules are applied.

For the older calibration snapshot `shards_132804_10w85qw`, `season-stats` contains 178 records rather than 185, so its source-limited effective ceiling is **5,578**, not 5,585. That is a calibration fact about that snapshot, not a reason to generate seven replacement prompts.

The old diagnostic counts for one/two/three prompts per structural group may still be reported by the audit, but they are diagnostics only and are **not** survivor caps.

## Balance guards inside the survivor library

Use these as review guards rather than blind quotas:

- preserve all 17 families unless a future family is explicitly retired;
- no family may consume unused envelope from another family during Phase 1;
- avoid any one family exceeding roughly 8% of the curated library without a documented exception;
- where a family genuinely supports all playing positions, keep usable GK/DEF/MID/FWD coverage rather than allowing one position to dominate because it generated more combinations;
- retain a deliberate spread of easy/medium/hard material;
- retain a deliberate spread of answer-pool bands: 2, 3–5, 6–15, 16–40, 41–80, 81–150 and 151+;
- treat 151+ answer-player prompts as an explicit very-broad band rather than silently folding them into 81–150;
- diversify club, manager, nationality and other entity values where the family supports them;
- do not use broad answer count alone as a quality proxy: a narrow prompt may be excellent if it is memorable and fair.

`season-stats` may remain close to or at its envelope because the family is already small, but individual prompts can still be rejected for weak/redundant material.

## Permanent representative 144-prompt calibration batch

Every Phase 1 calibration batch is exactly **144 records arranged as 48 same-group triads**.

Each triad contains:

1. **CERTIFY / anchor** — the strongest current representative in the sampled semantic group/material area;
2. **RESCUE / material contrast** — a sibling selected because it appears to occupy a genuinely different material cell;
3. **REJECT / redundant sibling** — a sibling selected because it is the strongest redundancy challenge against the displayed anchor.

All three records in a triad come from the **same `variantGroup`**, and every RESCUE/REJECT row stores its displayed `anchorId`. This makes the human decision directly auditable instead of asking reviewers to infer an unseen comparison prompt.

Family allocation:

- 48 triads = 144 records;
- every one of the 17 families appears;
- the three smallest source families receive two triads each;
- the remaining fourteen families receive three triads each;
- entity-heavy families prefer different club/manager/nationality values where alternatives exist;
- position diversity is preferred where alternatives exist;
- a structural group is skipped if it cannot produce a defensible anchor + material contrast + redundant sibling.

The resulting proposal counts are naturally:

- 48 proposed CERTIFY;
- 48 proposed RESCUE;
- 48 proposed REJECT.

The **48/48/48 split is a sampling structure only**. Human calibration is expected to change decisions when evidence requires it, and a reviewed batch must never be forced back to 48/48/48.

## Calibration finding — 7 September 2026

The uploaded review batch from `shards_132804_10w85qw` exposed three useful policy failures before any survivor cutover:

1. the 5,585 family table and a hard three-per-structural-group ceiling were mutually incompatible across many families;
2. 43 of 48 proposed REJECT records and 29 of 48 proposed RESCUE records were shown without their same-group CERTIFY anchor, making the claimed comparison impossible to review directly;
3. anchor-only distance based mainly on answer count/difficulty could label non-contributory threshold changes as RESCUE while missing threshold-vector redundancy.

Examples from that calibration batch include monotonic siblings with identical answer counts, such as:

- `minutes-role`: 1,000 / 1,800 / 2,400 minutes paired with >=32 goal involvements all returning 15 answer players;
- `club-stat`: Liverpool >=16 and >=18 goals both returning 4 answer players;
- `composite-story`: bottom-half defenders with >=5 assists and >=65/70 points both returning 22 answer players.

Because these are nested monotonic filters with unchanged counts, their answer sets are unchanged. The extra threshold does not create a new material cell.

The uploaded batch remains useful **calibration evidence only**. No survivor package should be frozen from it. The current promoted baseline remains the later 134,765-prompt snapshot until a new explicit Promotion replaces it.

## Additional evidence required before automatic survivor export

Before the survivor builder is allowed to write the permanent curated library, add or derive these signals where feasible:

- per-condition marginal contribution (answer count with each condition removed);
- answer-set fingerprint or Jaccard overlap between candidate siblings;
- monotonic nested-equivalence detection;
- threshold-vector distance;
- entity-value concentration within each family;
- nearest-retained-sibling distance;
- and final family/position/difficulty/answer-band balance checks.

Counts alone are not enough to decide whether two arbitrary multi-condition prompts contain the same players. The nested-equivalence shortcut is safe only where monotonicity guarantees set containment.

## Reason codes

Recommended permanent reason codes:

- `anchor-best-representative`
- `material-answer-band-change`
- `material-answer-count-change`
- `material-threshold-vector-change`
- `material-answer-set-change`
- `difficulty-contrast`
- `position-scarcity`
- `family-scarcity`
- `entity-diversity`
- `story-value`
- `daily-diversity-need`
- `redundant-threshold-sibling`
- `nested-equivalent-sibling`
- `near-duplicate-behaviour`
- `decorative-condition`
- `dominated-condition`
- `weaker-sibling`
- `exact-duplicate`
- `weak-evidence-breadth`
- `manual-exception`

## Promotion into Daily

Phase 1 does **not** switch Daily generation authority.

The safe sequence is:

`promoted source export -> curation audit -> paired 144 calibration review -> frozen survivor decisions -> curated package verification -> full generation regression -> explicit cutover`

Until that final explicit cutover, the existing Daily saved-library architecture remains authoritative exactly as it is today.

After prompt curation, the next major product phase remains the **Daily Challenge UI redesign**, followed by historical database completion, historical starting-price modelling, full production certification and later product expansion.

## Tooling

Run:

```bash
node scripts/audit-prompt-curation-v1.mjs path/to/fpl-prompt-library-shards-v1-*.json
```

The audit writes:

- a full JSON audit;
- a Markdown balance/compression report;
- a deterministic 144-record / 48-triad review batch.

The browser Studio exporter and CLI audit share the same curation-selection implementation so they cannot silently drift onto different review policies.

The audit verifies all 17 families, manifest totals, prompt IDs, family ownership, variant-group count and saved Quality status counts before producing results.

Generated CERTIFY/RESCUE/REJECT labels remain calibration proposals until human review and the additional survivor-evidence checks above have been applied.
