# Prompt curation Phase 1 — baseline

Baseline export fingerprint: `shards_134765_1pkuiu3`  
Saved: 7 September 2026

## Confirmed source state

- Promoted prompts: **134,765**
- Families: **17**
- Variant groups: **2,684**
- Quality pass: **134,765**
- Quality review: **0**
- Average prompts per variant group: **50.21**

This is a curation problem, not a generation shortage.

## Family balance

| Rank | Family | Prompts | Source share | Phase 1 target |
|---:|---|---:|---:|---:|
| 1 | combined-stats | 41,939 | 31.12% | 450 |
| 2 | composite-story | 26,879 | 19.95% | 450 |
| 3 | minutes-role | 17,162 | 12.73% | 400 |
| 4 | manager | 14,537 | 10.79% | 400 |
| 5 | nationality | 10,386 | 7.71% | 400 |
| 6 | club-stat | 8,606 | 6.39% | 400 |
| 7 | value | 6,984 | 5.18% | 400 |
| 8 | career-longevity | 2,362 | 1.75% | 350 |
| 9 | league-position | 1,398 | 1.04% | 325 |
| 10 | position-stat | 1,003 | 0.74% | 325 |
| 11 | exact-stats | 796 | 0.59% | 300 |
| 12 | anti-meta | 721 | 0.54% | 300 |
| 13 | club-count | 632 | 0.47% | 250 |
| 14 | promoted-clubs | 462 | 0.34% | 225 |
| 15 | relegated-clubs | 414 | 0.31% | 225 |
| 16 | champions | 299 | 0.22% | 200 |
| 17 | season-stats | 185 | 0.14% | 185 |

The five largest families contain **82.29%** of the source library. The six largest contain **88.68%**. That concentration is far too high to use raw family volume as a permanent-library weighting.

## Compression target

The Phase 1 survivor envelope is **5,585 prompts**.

- source -> target reduction: **95.86%**;
- target survivors/current variant group: **2.08**;
- default variant-group target: **2**;
- hard variant-group ceiling: **3**;
- one survivor is preferred when siblings are functionally interchangeable.

The source export remains immutable. The target is applied by survivor decisions, not by deleting source provenance.

## Evidence of threshold explosion

The promoted records already expose very large threshold families. Examples in the source include variant groups with 30+ near-neighbour point thresholds, 100+ career-club/stat variants and a career-longevity group whose stored `variantGroupSize` reaches 474. These prompts can all pass structural Quality checks while still being redundant as permanent gameplay material.

## 144-prompt calibration batch

The audit tool creates a deterministic review batch with:

- 48 proposed CERTIFY;
- 48 proposed RESCUE;
- 48 proposed REJECT;
- 8 prompts from every family plus one extra from each of the eight largest source families.

This prevents the 144 review from reproducing the source imbalance.

## What remains to measure from the complete export

The audit script calculates the full per-family variant-group distribution, median/P90/P95/P99/max group sizes, group-size buckets, position/difficulty/answer-pool distributions, and 1/2/3-survivor compression simulations when run against the complete JSON export.

No unobserved distribution values are invented in this baseline report.
