# Prompt curation policy v1

Status: Phase 1 calibration policy for the promoted Prompt Library.

This policy applies after Promotion and before any curated survivor library is allowed to become a production authority. It does not alter Daily generation, publishing, the saved Prompt Library shard snapshot, or the currently certified production pool.

## 1. Source authority

- Curate only from a validated Prompt Library family-shard snapshot.
- Record the promotion fingerprint, saved timestamp, family count, variant-group count, quality-pass count and source prompt count on every audit/export.
- Curation is destructive only in the derived survivor output. The promoted source snapshot remains immutable and recoverable.

## 2. Family budgets are ceilings, not quotas to pad

The Phase 1 family survivor budgets remain:

| Family | Ceiling |
| --- | ---: |
| season-stats | 185 |
| champions | 200 |
| promoted-clubs | 225 |
| relegated-clubs | 225 |
| club-count | 250 |
| anti-meta | 300 |
| exact-stats | 300 |
| position-stat | 325 |
| league-position | 325 |
| career-longevity | 350 |
| value | 400 |
| club-stat | 400 |
| nationality | 400 |
| manager | 400 |
| minutes-role | 400 |
| composite-story | 450 |
| combined-stats | 450 |

The nominal ceiling total is 5,585. The effective target for a concrete snapshot is `sum(min(source family count, family ceiling))`. A family is never padded by generating new prompts just to hit its ceiling, and the final survivor count may be lower if quality rules reject too many records.

For the `shards_132804_10w85qw` snapshot, `season-stats` contains 178 records, so the effective Phase 1 ceiling is 5,578 rather than 5,585.

## 3. The current variant group is a semantic shape, not a hard survivor bucket

The old provisional rule of a default two representatives and a hard cap of three per current `variantGroup` is retired.

Reason: many current groups are deliberately broad threshold spaces. Applying a hard cap of three would make family budgets impossible in most families and would erase materially different challenge tiers from large groups such as `combined-stats`, `minutes-role`, `value`, `career-longevity` and `composite-story`.

The permanent unit is therefore:

`family -> semantic variant group -> material cell -> representative prompt`

A material cell is defined by the meaningful combination of:

- difficulty tier;
- answer-pool band;
- condition/threshold vector;
- position or entity dimension already encoded by the semantic group;
- and, where available, answer-set identity/overlap.

There is no global hard cap per current `variantGroup`. There is a hard cap of one survivor per materially equivalent cell.

## 4. Survivor selection

### CERTIFY

Keep the exact record when it is the strongest representative of a material cell and all conditions contribute meaningfully to the challenge.

Prefer records with:

- high existing quality score and coverage;
- useful answer-pool size;
- broad season/club coverage appropriate to the concept;
- clean, recognisable thresholds;
- and no decorative or dominated condition.

### RESCUE

Keep the concept in the survivor competition when it adds a genuinely different material cell but needs a threshold, wording or marginality check before certification.

A sibling is a legitimate rescue candidate when at least one of the following is true and the difference is not merely cosmetic:

- difficulty changes;
- answer-pool band changes;
- answer-pool size changes materially (20% is the default signal, not an automatic rule);
- the threshold vector moves substantially on one or more independent condition axes;
- or answer-set identity differs materially when answer IDs/overlap are available.

### REJECT

Reject a record when a stronger representative already covers the same material cell, including:

- adjacent threshold churn with the same difficulty and answer-pool band;
- monotonic nested siblings that produce the same answer count (therefore the same nested answer set);
- threshold changes that barely alter the answer pool;
- decorative conditions that do not materially reduce the answer set;
- dominated conditions where another condition already implies the weaker threshold;
- or arbitrary numeric variation with no recognisable football/challenge value.

For exact-stat prompts, adjacent exact values are not automatically distinct survivors. Prefer recognisable benchmarks and materially different answer sets.

## 5. Family balance comes before raw score concentration

Selection must respect the family ceilings and preserve useful internal diversity across:

- position;
- difficulty;
- answer-pool band;
- club/manager/nationality/entity values where relevant;
- and semantic variant groups.

No family may consume unused budget from another family during Phase 1. A family that cannot fill its ceiling with defensible survivors simply finishes below ceiling.

High-volume families must compress much more aggressively than low-volume families. `season-stats` is retained in full unless a prompt fails quality/redundancy review because its source count is already below its family ceiling.

## 6. Permanent 144-record calibration batch

The review batch is 48 same-group triads, not 144 independently sampled records.

Each triad contains:

1. **CERTIFY / anchor** — the strongest current representative of the group/material area;
2. **RESCUE / material contrast** — a sibling chosen because it represents a genuinely different material cell;
3. **REJECT / redundant sibling** — a sibling chosen because it is close enough to the anchor to test redundancy policy.

This guarantees that every proposed RESCUE or REJECT is shown beside the record it is being compared with.

Batch allocation:

- 48 triads = 144 records;
- every one of the 17 families must appear;
- families receive two or three triads, with the three smallest source families receiving two and the remainder receiving three;
- within entity-heavy families, repeated club/manager/nationality values are avoided when alternatives exist;
- position diversity is preferred when alternatives exist;
- a group is skipped if it cannot produce a defensible anchor + contrast + redundant sibling triad.

The 48/48/48 decision counts arise from the triad structure. They are not achieved by forcing arbitrary records into a decision bucket.

## 7. Additional signals required before automatic survivor export

Before the survivor builder is allowed to write the permanent curated library, add or derive these signals where feasible:

- per-condition marginal contribution (answer count with each condition removed);
- answer-set fingerprint or Jaccard overlap between candidate siblings;
- monotonic nested-equivalence detection;
- threshold-vector distance;
- entity-value concentration within each family;
- and final family/position/difficulty/answer-band balance checks.

Counts alone are not enough to decide whether two multi-condition prompts contain the same players.

## 8. Promotion and Daily boundaries

- Do not mutate Promotion or the durable shard snapshot during curation.
- Do not make the curated survivor library a Daily authority until it has passed the permanent policy, review calibration and production verification.
- The existing Daily generation architecture remains unchanged during Phase 1.
- After prompt curation is complete, the next major product phase remains the Daily Challenge UI redesign.
