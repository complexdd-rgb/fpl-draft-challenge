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

## 2026-07-29 — Validation Lab v1.1

- Added automated season certification to Season Health.
- Added full prompt-runtime, diagnostic-agreement and zero-minute exclusion scans.
- Added 20-club league-table and derived-flag checks.
- Added saved certificate status and copyable certification reports.
- Fixed goal-involvement parsing being mistaken for goals.
- Fixed “outside the top four” diagnosis.
- Corrected the veteran-defender 2,700-minute prompt test.

## 2026-07-29 — Phase B: Prompt Engine 2 season rules

- Added an editable **Season played** field to the Prompt Studio safe rule builder.
- Added exact-season, before-season, after-season and between-season operators.
- Added matching Rule Tester and Prompt Explorer diagnostics for all four season relationships.
- Added an automated season-rule regression check to Season Certification.
- Kept season comparisons based on the season start year so labels such as `2020/21` sort correctly.
- Invalid or missing season labels fail safely rather than qualifying as answers.
