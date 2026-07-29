# Changelog

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
