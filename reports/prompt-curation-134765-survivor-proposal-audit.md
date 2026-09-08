# Prompt Curation — 134,765 Survivor Proposal Audit

Date: 8 September 2026
Source fingerprint: `shards_134765_1pkuiu3`
Builder audited: `prompt-curation-survivor-builder-v1` v1.0.0
Proposal records selected: **5,553**

## Executive finding

The first full survivor proposal proves the evidence/collapse architecture is healthy, but the 5,553 proposal should **not** be frozen unchanged.

The hard evidence layer reconciles perfectly: 134,765 source prompts and 134,765 evidence rows, with **0 stored/recomputed answer-count mismatches**. The proposal also correctly excludes all 58,275 decorative prompts as possible representatives and collapses 28,948 clean exact-equivalent siblings.

The audit exposed one policy bug in the soft selection stage: the builder filled every family envelope whenever enough clean exact classes existed, so a maximum envelope was acting too much like a quota. That is most visible in `manager`, where all 400 slots were filled even though 171 selected prompts had quality below 65.

The follow-up builder therefore moves to v1.1.0 with a **default automatic proposal floor of quality >= 65**. A clean representative below that floor is `DEFER`, not `HARD_REJECT`, so unusual/scarce material remains available for explicit manual rescue later. Family ceilings remain ceilings rather than quotas.

## First proposal totals

| Measure | Count |
|---|---:|
| Source prompts | 134,765 |
| Selected | 5,553 |
| Decorative hard rejects | 58,275 |
| Stored-answer mismatches | 0 |
| Exact-equivalent clean siblings collapsed | 28,948 |
| Clean distinct representatives before envelope selection | 47,542 |
| Clean representatives deferred | 41,989 |

The decision ledger reconciles exactly to the source population.

## Global balance of the 5,553 proposal

### Position

| Position | Count | Share |
|---|---:|---:|
| ANY | 1,714 | 30.87% |
| MID | 1,102 | 19.85% |
| DEF | 998 | 17.97% |
| FWD | 914 | 16.46% |
| GK | 825 | 14.86% |

This is broadly usable. `ANY` is intentionally the largest bucket because several families are naturally player-wide rather than position-specific.

### Difficulty

| Difficulty | Count | Share |
|---|---:|---:|
| Easy | 2,996 | 53.95% |
| Medium | 1,778 | 32.02% |
| Hard | 779 | 14.03% |

The global mix is healthy. Family-level skew still needs to be respected rather than flattened blindly: for example, manager prompts naturally skew harder than combined-stat prompts.

### Answer-player bands

| Answer band | Count | Share |
|---|---:|---:|
| 2 | 32 | 0.58% |
| 3–5 | 133 | 2.40% |
| 6–15 | 1,263 | 22.74% |
| 16–40 | 1,824 | 32.85% |
| 41–80 | 1,460 | 26.29% |
| 81–150 | 647 | 11.65% |
| 151+ | 194 | 3.49% |

The proposal has a strong centre of playable answer pools while still preserving a small hard-tail and a broad-answer tail.

## Envelope-is-not-a-quota failure

The first proposal selected **219 prompts below quality 65**. The concentration is highly uneven:

| Family | Selected below 65 |
|---|---:|
| manager | 171 |
| champions | 15 |
| club-stat | 14 |
| season-stats | 12 |
| position-stat | 3 |
| exact-stats | 2 |
| club-count | 1 |
| relegated-clubs | 1 |

`manager` is the decisive signal: 171/400 selected prompts were below the default calibration floor, and 31 manager survivors had fewer than five answer players. Many are legitimate scarce historical shapes, but automatic selection should not consume envelope space merely to reach 400.

### v1.1 correction

- Default automatic survivor-proposal quality floor: **65**.
- Below-floor clean representatives become `DEFER / below-default-quality-floor`.
- They remain in provenance and can be explicitly rescued for scarcity/story reasons later.
- The new effective ceiling is calculated from **eligible clean classes**, not all clean classes.
- The builder may therefore return fewer than a family's maximum even when lower-quality clean material exists.

## Remaining similarity audit

The proposal is much less repetitive than the source library.

Among selected prompts whose exported nearest one-axis neighbour was also selected:

- only **39** selected neighbour pairs have Jaccard >= 0.95;
- only **1** reaches >= 0.98;
- none reaches >= 0.995;
- the maximum observed selected-neighbour Jaccard is **0.9867**.

That supports keeping nearest-neighbour overlap as a soft diversity penalty rather than adding a blunt universal Jaccard hard cut.

There are **100 selected answer-fingerprint classes** represented more than once across different structural groups; 28 of those cross family boundaries. This is not automatically wrong: a prompt can ask a materially different football question while coincidentally producing the same answer set. Cross-family fingerprint identity therefore remains an audit signal rather than a hard collapse rule.

## Label polish finding

The selected package contains **139 definite singular/plural defects** such as `1 goals`, `1 assists`, `1 bonus points`, `1 clean sheets`, `1 red cards` or `1 yellow cards`.

The source snapshot remains immutable. Survivor Builder v1.1 normalises these labels only in the survivor package and records:

- `sourceLabel` with the original promoted wording; and
- `curationEdits: ["singular-stat-label"]`.

This keeps provenance while ensuring the eventual player-facing curated package is polished.

## Other v1.1 safety correction

Boolean conditions such as `promoted: true` or `relegated: true` must not be treated as numeric threshold value `1` by JavaScript coercion. v1.1 explicitly excludes booleans from coarse threshold-cell and threshold-recognisability scoring. This affects only soft diversity/tie-break scoring; it does not alter the evidence evaluator or answer sets.

## Freeze decision

**Do not freeze the 5,553 v1.0.0 proposal.**

The correct next sequence is:

1. merge Survivor Builder v1.1.0 after CI;
2. rerun **Build survivor proposal** against the same `shards_134765_1pkuiu3` saved source/evidence;
3. audit the new selected count and family/entity coverage, especially manager/nationality/club-stat scarcity;
4. decide whether any below-floor prompts merit explicit manual scarcity rescue;
5. only then freeze the curated survivor package.

Daily generation remains unchanged throughout this audit.