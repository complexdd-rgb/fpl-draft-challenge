# FPL Draft Challenge — Current Roadmap

Updated: 9 September 2026
Baseline: historical database phase after PR #161

This file is the current project priority order. The architecture/relevance cleanup, prompt curation, Prompt Studio cleanup, Daily Challenge redesign and Live Challenge runtime cleanup are complete and must not be restarted unless a concrete regression is found.

## Completed foundation

- Architecture/relevance cleanup completed through PR #137.
- Historical Imports and Identity Consolidation retired from the Studio UI/runtime.
- Doni and Hilario verified as canonical mononyms.
- Prompt Builder / Factory is Live.
- Quality Analyser is Live.
- Promotion + durable source-shard storage is the maintained provenance path.
- The original 134,765-prompt / 17-family promoted snapshot remains preserved as source provenance.
- Phase 1 curation compressed that source to a frozen **4,897-prompt / 17-family** survivor package.
- PR #153 made those exact 4,897 prompts the Daily generation authority while preserving the source snapshot separately.
- A real seven-day / 77-prompt production export was verified as 77/77 sourced from the frozen curated package.
- Prompt Studio cleanup is complete and guarded against retired-workspace regression.
- Daily Challenge UI v1/v1.1 and the mobile follow-up fixes are merged.
- PR #159 completed the Live Challenge KEEP / CONSOLIDATE / RETIRE / DELETE sweep and added permanent cleanup regression coverage.
- PR #160 froze the season-by-season historical status audit and made Historical Database Completion the current phase.
- PR #161 quarantined the invalid later 1996/97 COMPLETE checkpoint.
- Daily generation, 77-prompt weekly reservoir, nationality/semantic-diversity logic, publishing, leaderboard and Supabase behaviour remain protected.

## 1. Prompt curation and compression — COMPLETE

The frozen Daily authority remains **4,897 prompts across 17 families**. Future families use the maintained Factory → Quality → Promotion/source archive → explicit versioned curated-authority update path. Do not restart the retired Phase 1 curation/incubator runtime.

Permanent references:

- `PROMPT_CURATION_POLICY.md`
- `PROMPT_FAMILY_ONBOARDING.md`
- `prompt-library-curated-v1/`

## 2. Daily Challenge UI + Live Challenge cleanup — COMPLETE

The player-facing redesign and follow-up architecture cleanup are frozen unless a concrete regression is demonstrated. Preserve challenge identity/loading, midnight rollover, scoring, Give Up, archive, Results v2, leaderboard and the frozen curated prompt authority.

## 3. Historical database completion — CURRENT PHASE

Starting authorities:

- `reports/historical-season-status-audit-2026-09-08.md`
- `reports/1996-97-reconciliation-2026-09-08.md` (corrected 9 September after the physical review master was recovered)

Do **not** restart the historical programme from 1993/94. ENGZIP / FootballSquads is already frozen as the population/identity/club backbone.

### Current execution order

1. **Finish 1996/97 using the recovered physical v2 REVIEW master**:
   - keep exactly **658 canonical identities**;
   - preserve the workbook-proven **671 FootballSquads source rows → 658 canonical identities** reconciliation;
   - preserve the exact **13 duplicate source occurrences = 11 multi-club identities + 2 same-club re-registrations**;
   - retain the already-audited **421 direct StatBunker matches / 14 clubs / 5,852 starts = 14 × 418**;
   - recover only the six missing direct StatBunker club tables: **Aston Villa, Blackburn Rovers, Derby County, Liverpool, Southampton and Wimbledon**;
   - force **418 starts per club / 8,360 league-wide**;
   - then recover nationality, currently **0/658**, and finish goals/provenance/unresolved-field audit;
   - export exactly one canonical single-sheet COMPLETE master.
2. Finish 2007/08, the next clearly unfinished season in surviving artifact evidence.
3. Close 2008/09, 2009/10 and 2010/11 by verifying their latest masters, genuine FPL-native gaps, price state and import/certification disposition — do not re-harvest already exhausted bulk sources.
4. Verify the final canonical artifacts for 2002/03–2004/05.
5. Verify the claimed-complete early masters rather than rebuilding them.
6. Create one definitive frozen historical-master index with one authoritative single-sheet master per season.

### 1996/97 safeguards

- The recovered v2 REVIEW workbook is the **authoritative working master**.
- The previous inferred `672 raw / 14 duplicates` arithmetic is superseded by direct workbook evidence: **671 / 13**.
- The later `672 identities / 9,108 starts / 1,133 goals / 67 send-offs / COMPLETE` checkpoint remains quarantined and must never be used as a production source.
- Hard controls are **418 starts per club / 8,360 starts league-wide / 970 league goals**.
- Historical Wimbledon must not be overwritten by StatBunker's later Milton Keynes Dons label.
- Do not add StatBunker-only unmatched names to the frozen ENGZIP population.

### Standing historical rules

- keep ENGZIP / FootballSquads as the frozen population/identity/club backbone;
- complete only genuinely missing StatBunker and other prompt-relevant enrichment;
- retain nationality as a standard recovery field;
- preserve source/provenance and uncertainty flags;
- certify each season before treating it as production-ready;
- do not substitute conventional football assists for historical FPL assists;
- final historical season masters remain **single-sheet workbooks**;
- 2011/12 is closed/imported and must not be reopened.

## 4. Historical starting-price modelling

After the historical database is substantially complete and the master index is frozen:

- build a transparent pre-FPL starting-price model for seasons before official FPL pricing exists;
- use the same model only for genuinely unrecoverable prices in later seasons where appropriate;
- keep modelled values visibly distinct from recovered FPL-native prices;
- retain inputs, model version, confidence and provenance on every modelled row;
- never overwrite a subsequently recovered genuine historical price.

## 5. Full production certification

Before broader launch/product work:

- true all-season database certification;
- curated prompt-library certification;
- Daily generation regression across formations/families/diversity constraints;
- null/missing-field safety;
- perfect-XI uniqueness and score verification;
- publishing/schedule/midnight rollover;
- Give Up and invalid-answer flows;
- leaderboard/Supabase submission and restore behaviour;
- desktop/mobile cross-browser pass;
- new/returning/guest/signed-in user journeys.

The current workflow named `All-season certification` is a deferred-boundary guard; it is **not** evidence that every historical season has already passed true all-season database certification.

## 6. Product expansion

Only after the production boundary is green:

- achievements and richer local player statistics;
- archive/practice improvements;
- shareable result expansion;
- PWA/offline polish;
- public-beta methodology/data-source/privacy pages;
- analytics and anti-abuse hardening;
- optional formation-aware themes and other new game modes;
- later commercial/community expansion if useful.

---

# Standard historical workbook model

## One active workbook per season

Maintain one canonical active workbook for each season. The final season master remains a **single-sheet workbook**. All usable stats, provenance, audit/status fields, identity flags and later price/model metadata belong as columns in that one master sheet. Temporary staging files are allowed during research, but extra worksheets must not become part of the final master.

## One row per player-season

Keep all relevant data for that player-season on the same row, including where available:

- identity: player ID, player name, club, position;
- prompt-relevant statistics: minutes, goals, clean sheets, saves, goals conceded, cards and related fields;
- FPL-native fields: FPL assists, bonus and total FPL points;
- starting price and final price where useful;
- nationality, league position and other prompt-engine context;
- source/provenance columns beside important recovered fields;
- confidence/review/model status where required;
- `unresolved_fields`, notes and last-updated metadata where useful.

## Working method

`find a missing value -> fill the field -> record the source -> clear that item from unresolved_fields`

Prefer bulk/archive routes before individual player research. Record genuinely new sources tried, including exhausted/no-hit routes, and do not repeat already harvested season/field work.

## Workbook presentation

- one filterable table;
- frozen header row;
- sensible column widths;
- missing/review-needed conditional formatting;
- simple `COMPLETE` / `PARTIAL` / `NEEDS REVIEW` state.

## Archive policy

Old recovery/staging workbooks are provenance. Do not discard a superseded workbook until every unique value, evidence note and source reference has been carried into the canonical master or explicitly preserved in the archive index.

---

# Working rules

- Do not restart broad architecture cleanup after PR #137 without a proven blocker/regression.
- Do not restore completed Phase 1 curation/refinement runtime to Prompt Studio just to add future families.
- Preserve the current 4,897-prompt Daily authority while historical work proceeds.
- New prompt families must follow `PROMPT_FAMILY_ONBOARDING.md` and require an explicit versioned curated-authority update before entering Daily.
- Prefer deterministic, auditable transformations over manual hidden state.
- Keep source exports/workbooks immutable as provenance where practical.
- Missing optional historical fields should disable only the dependent prompt family rather than block an otherwise valid season where appropriate.
- Move to the next roadmap phase only after the current phase has a clear frozen boundary and verifier coverage.
