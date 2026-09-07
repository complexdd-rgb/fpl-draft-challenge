# FPL Draft Challenge — Current Roadmap

Updated: 7 September 2026  
Baseline: post-cleanup `main` after PR #137

This file is the current project priority order. The architecture/relevance cleanup is complete and must not be restarted unless a concrete regression is found.

## Completed foundation

- Architecture/relevance cleanup completed through PR #137.
- Historical Imports and Identity Consolidation retired from the Studio UI/runtime.
- Doni and Hilario verified as canonical mononyms.
- Prompt Builder is Live.
- Quality Analyser is Live.
- Current promoted source preserved as a 17-family shard export.
- Daily generation, 77-prompt weekly reservoir, nationality/semantic-diversity logic, certification boundary, publishing, leaderboard and Supabase behaviour remain the protected baseline.

## 1. Prompt curation and compression — current phase

The current promoted export contains 134,765 prompts across 17 families and 2,684 variant groups. Do **not** generate more prompt volume until this pool is curated.

Order:

1. full 17-family balance audit;
2. variant-group compression audit;
3. freeze family survivor targets;
4. create a representative 144-prompt CERTIFY / RESCUE / REJECT calibration batch;
5. review the batch and tune decision thresholds if necessary;
6. establish the permanent curation policy;
7. produce the first frozen curated survivor package;
8. run full generation/regression checks before any explicit Daily cutover.

The source export remains immutable provenance. Curation is downstream of Factory / Quality / Promotion and must not silently change Daily generation authority.

Primary policy: `PROMPT_CURATION_POLICY.md`.

## 2. Daily Challenge UI redesign

Once prompt curation is stable, redesign the player-facing Daily Challenge experience without reopening the generation architecture.

Priorities:

- cleaner challenge/pitch layout on desktop and mobile;
- stronger prompt readability and hierarchy;
- clearer selected / invalid / confirmed / Give Up states;
- autocomplete that never hides behind cards or feedback;
- polished score, perfect-score and efficiency presentation;
- completion/share/leaderboard flow;
- accessibility and responsive QA;
- preserve midnight rollover and current challenge identity/publishing behaviour.

## 3. Historical database completion

Return to the season-master programme after the Daily UI redesign.

- keep ENGZIP / FootballSquads as the frozen population/identity/club backbone;
- complete StatBunker and other prompt-relevant enrichment season by season;
- retain nationality as a standard recovery field;
- preserve source/provenance and uncertainty flags;
- certify each season before treating it as production-ready;
- do not substitute conventional football assists for historical FPL assists.

## 4. Historical starting-price modelling

After the historical database is substantially complete:

- build a transparent pre-FPL starting-price model for seasons before official FPL pricing exists;
- use the same model only for genuinely unrecoverable prices in later seasons where appropriate;
- keep modelled values visibly distinct from recovered FPL-native prices;
- retain inputs, model version, confidence and provenance on every modelled row;
- never overwrite a subsequently recovered genuine historical price.

## 5. Full production certification

Before broader launch/product work:

- all-season database certification;
- curated prompt-library certification;
- Daily generation regression across formations/families/diversity constraints;
- null/missing-field safety;
- perfect-XI uniqueness and score verification;
- publishing/schedule/midnight rollover;
- Give Up and invalid-answer flows;
- leaderboard/Supabase submission and restore behaviour;
- desktop/mobile cross-browser pass;
- new/returning/guest/signed-in user journeys.

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

Use this as the default structure whenever a season is rebuilt, consolidated or expanded.

## One active workbook per season

Maintain one canonical active workbook for each season, for example:

- `FPL_2011-12_MASTER.xlsx`
- `FPL_2010-11_MASTER.xlsx`
- `FPL_2009-10_MASTER.xlsx`

The final season master remains a **single-sheet workbook**. All usable stats, provenance, audit/status fields, identity flags and later price/model metadata belong as columns in that one master sheet. Temporary staging files are allowed during research, but extra worksheets must not become part of the final master.

## One row per player-season

Keep all relevant data for that player-season on the same row. Include where available:

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
- Preserve current Daily generation architecture during prompt curation and UI redesign.
- Curate before generating more prompt volume.
- Prefer deterministic, auditable transformations over manual hidden state.
- Keep source exports/workbooks immutable as provenance where practical.
- Missing optional historical fields should disable only the dependent prompt family rather than block an otherwise valid season where appropriate.
- Move to the next roadmap phase only after the current phase has a clear frozen boundary and verifier coverage.
