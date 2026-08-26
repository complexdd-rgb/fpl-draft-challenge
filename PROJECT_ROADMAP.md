# FPL Draft Challenge — 9-Point Roadmap

Saved: 26 August 2026

This is the agreed project priority order to use as the reference roadmap in future work.

## 1. Finish the current draft-board / UI QA
Test the polished draft board on desktop and mobile, especially the invalid-answer → new search → autocomplete path so wrong-answer feedback never blocks player names. Check common phone widths and selected / unselected / confirmed card states.

## 2. Attack the preserved official FPL pickle snapshots
Use the preserved official FPL snapshot files as the highest-value bulk route for 2010/11. Extract historical `season_history` data from the pickle files and cross-match it against the remaining unresolved 2010/11 frontier before doing more player-by-player research.

## 3. Freeze the 2010/11 FPL-assists checkpoint
Once the snapshot/bulk pass is complete, produce an audited checkpoint containing exact recoveries, unresolved players, source, confidence, provenance/source de-dup notes and exhausted routes.

## 4. Continue the remaining 2010/11 recovery
After assists are frozen, proceed in this order:

1. Bonus points
2. Total FPL points
3. Starting prices

Use bulk/archive routes before individual searches and preserve the provenance trail.

## 5. Complete the final 2011/12 live integration audit
Confirm the canonical 539-player 2011/12 season maps cleanly into the current player identity model, audit the imported fields, then formally certify the season for the live database.

## 6. Run a whole-site regression pass
Test the complete user journey across key states:

- New user
- Returning user
- Guest
- Signed-in user
- Incomplete challenge
- Invalid answer
- Give Up
- Completed challenge
- Leaderboard submission
- Refresh / restore
- Second device
- Archive / practice
- Midnight daily rollover

## 7. Build Prompt Engine V2
Prioritise:

- Nationality-based prompts
- Anti-meta / less-obvious prompt families
- Answer-diversity controls across players, clubs, positions, nationalities, seasons and score bands
- Formation-aware themed generation after the diversity work is stable

## 8. Public-beta finishing layer
Add or finish the production-facing essentials:

- Privacy-conscious analytics
- About / How to Play / methodology / data sources
- Privacy / terms / feedback/contact
- Competition hardening and anti-abuse controls
- Optional custom domain / launch polish

## 9. Start the 2009/10 historical expansion
Only begin 2009/10 once the 2010/11 checkpoint is in a controlled state and the 2011/12 integration/certification boundary is closed. Continue backwards season by season toward 2002/03.

---

## Standard historical workbook model for all future seasons

Use this as the default structure whenever a season is rebuilt, consolidated or expanded.

### One active workbook per season
Maintain one canonical active workbook for each season, for example:

- `FPL_2011-12_MASTER.xlsx`
- `FPL_2010-11_MASTER.xlsx`
- `FPL_2009-10_MASTER.xlsx`

The active workbook should contain one main visible sheet with the complete player-season dataset in one filterable table. Avoid accumulating version-after-version worksheets such as `v8`, `v9`, `v10` inside the same workbook.

### One row per player-season
Keep all relevant data for that player-season on the same row. The table should include, where available:

- identity: player ID, player name, club, position
- normal statistical fields: minutes, goals, clean sheets, saves, goals conceded and other prompt-relevant fields
- FPL-native fields: FPL assists, bonus and total FPL points
- prices: starting price and final price where useful
- nationality, league position and other prompt-engine fields
- source/provenance columns beside important recovered fields, such as `assists_source`, `bonus_source`, `points_source` and `price_source`
- confidence / review status where required
- `unresolved_fields`
- notes
- last-updated information where useful

### Working method
Use the master table as the single destination for research:

`find a missing value → fill the field → record the source → clear that item from unresolved_fields`

Do not create a new worksheet or workbook version for every research pass unless there is a genuine temporary processing need.

### Workbook presentation
Keep the active master simple and practical:

- Excel table / filters enabled
- frozen header row
- sensible column widths
- conditional formatting for missing or review-needed fields
- a simple status such as `COMPLETE`, `PARTIAL` or `NEEDS REVIEW`

### Archive policy
Old recovery workbooks, staging workbooks and superseded versions should live outside the active workbook as archived provenance. Do not delete or archive an older workbook until every unique value, evidence note and source reference has either been carried into the canonical master or explicitly preserved in the archive index.

The aim is to finish each season with one clean master dataset rather than a chain of active workbook versions.

### Consolidation order
Use 2011/12 as the first template season because its 539-player recovery is the most mature. Once the structure is proven, apply exactly the same master format to 2010/11 and then every earlier season.

For future historical expansion, the preferred sequence is:

`consolidate existing workbooks → freeze the master baseline → harvest bulk sources → fill master-table blanks → run residual player-by-player research → certify season`

---

## Working rules for the roadmap

- Avoid broad architecture rewrites unless a real blocker appears.
- Do not repeatedly redesign finished UI sections; switch to QA and bug-fixing.
- For historical research, check prior chats/workbooks/source-de-dup logs first.
- Prefer bulk and archive routes before player-by-player searches.
- Record every genuinely new source tried, including no-hit / exhausted routes.
- Do not substitute conventional football assists for historical FPL assists.
- Missing optional historical fields should disable only the relevant prompt family rather than block an otherwise valid season where appropriate.
- Use the single-sheet canonical master workbook model above for all future season recovery work.
