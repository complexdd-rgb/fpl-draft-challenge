# Changelog

## 2026-07-30 — Same club-season teammate rule

- Added the rule “Same Premier League club-season as player” to the Safe Rule Builder.
- Added requested prompt wording: “A defender who played in the same Premier League season as a teammate of Mohamed Salah.”
- Added the rule to automatic prompt generation, live prompt tests, Rule Tester, Prompt Explorer and Player Inspector.
- Added club-season teammate coverage to season certification; a clean run now reports 15/15 critical checks.
- Positive minutes, the same club and the same season are all required; the reference player cannot answer their own prompt.

## Phase B — Career overlap and prompt deletion

- Added career-overlap rules using shared positive-minute Premier League seasons.
- Added searchable reference-player support to the Safe Rule Builder.
- Added career-overlap variants to the Auto Prompt Generator, Rule Tester, Prompt Explorer and certification.
- Added per-prompt deletion for built-in and custom prompts.
- Added filtered bulk deletion to the Prompt Quality Analyser with current-XI protection and typed confirmation.

# Changelog

## Phase B — Returned to a former club

- Added the **Returned to a former club** career relationship rule.
- Added the rule to the Safe Rule Builder, Auto Prompt Generator, live prompt logic, Rule Tester, Prompt Explorer and certification scan.
- Career context now stores a chronological positive-minute club timeline and the clubs a player returned to.
- Player Inspector now displays the returned-club result and club timeline.
- Season certification now checks returned-club timelines and Rule Tester agreement.

## 2026-07-29 — Phase B career relationships and quality controls

- Added **Played for both clubs** to the Safe Rule Builder.
- Added positive-minute career-club checks to the live prompt engine, Rule Tester and Prompt Explorer.
- Added played-for-both-clubs prompt creation to the Auto Prompt Generator.
- Added a twelfth season-certification test for career club relationships.
- Expanded the Prompt Quality Analyser with configurable bulk-disable thresholds: broken, poor, needs review, fair, analyser recommendations or the current filtered list.
- Kept every bulk change browser-only until a replacement `prompt-library.js` is downloaded and uploaded.
- Applied the global positive-minute eligibility rule during prompt-quality analysis.

## Phase 16 — Validation Lab Phase 1

- Added a Validation Lab workspace to the existing Challenge Studio.
- Added Player Inspector, Rule Tester, Prompt Explorer and Season Health.
- Added readable per-rule PASS / FAIL traces and copyable debug reports.
- Reused the global one-minute answer-eligibility rule.
- Added a shared read-only validation engine without modifying live player data.

## 2026-07-29 — 2025/26 final league positions

- Added the final 2025/26 Premier League position to every player-season record.
- Recalculated champion, top-four, bottom-half and relegation flags from the final table.
- Changed Validation Lab numeric checks so `null`, blank and missing values are not treated as zero.
- Missing league finishes now always fail league-position and league-status rules.
- Updated asset versions to prevent an older cached `players.js` or validation engine loading.

## 2026-07-29 — Validation Lab v1.1

- Added automated season certification to Season Health.
- Added full prompt-runtime, diagnostic-agreement and zero-minute exclusion scans.
- Added 20-club league-table and derived-flag checks.
- Added saved certificate status and copyable certification reports.
- Fixed goal-involvement parsing being mistaken for goals.
- Fixed “outside the top four” diagnosis.
- Corrected the veteran-defender 2,700-minute prompt test.
