# Generator v3.2.3 — Production Certification Freeze

Date: 18 September 2026  
Status: **PRODUCTION CERTIFIED / FROZEN**  
Authority: frozen curated Daily package `4,959 prompts / 18 families`  
Generator: `v3.2.3`  
Certification runner: `v1.0.1`

## Result

The production certification sweep passed **7/7 supported formations**:

- 4-4-2
- 4-3-3
- 3-4-3
- 3-5-2
- 5-3-2
- 5-4-1
- 4-2-3-1

Every formation produced:

- 7 dated challenge days;
- 77 prompt slots;
- 77 unique prompt IDs;
- all 18 curated prompt families represented;
- exactly 7 nationality prompts across the reservoir;
- at least the configured Exclude Top Result floor;
- anti-meta coverage above the daily minimum;
- zero same-day top-answer repeats;
- zero hard 3-day leader-spacing breaches;
- zero max-three leader hard-cap breaches;
- exact formation totals;
- PASS status for all seven generated days.

## Retry-path evidence

The sweep also exercised the alternate-reservoir recovery path rather than only first-attempt success.

- 4-4-2 — reservoir attempt 1
- 4-3-3 — reservoir attempt 2
- 3-4-3 — reservoir attempt 2
- 3-5-2 — reservoir attempt 2
- 5-3-2 — reservoir attempt 1
- 5-4-1 — reservoir attempt 1
- 4-2-3-1 — reservoir attempt 2

This proves the bounded retry path can recover from a structurally valid but unarrangeable/less suitable first reservoir while preserving all hard production invariants.

## Authority evidence

The certification ran against:

- curated authority total: **4,959**
- curated families: **18**
- promotion fingerprint: `shards_144252_h2yx4a`

The original promoted source/archive remains provenance only. The curated 4,959-package remains the Daily production authority.

## Freeze decision

Generator v3.2.3 is the production baseline.

Do not reopen generator architecture, reservoir construction, family balancing, nationality logic, top-answer spacing, or publishing behaviour unless a reproducible production regression is demonstrated.

Future work may:

- add observational timing/diagnostic evidence without changing selection behaviour;
- update prompt authority only through the permanent Factory → Quality → Promotion/source archive → explicit curated-authority update workflow;
- run the existing 7-formation certification after any genuine generator-affecting change.

## Next active project phase

Return to **Historical Database Completion**, starting with the advanced **2010/11** master and closing its remaining import/certification blockers before moving to the next unfinished season.
