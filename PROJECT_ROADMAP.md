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

## Working rules for the roadmap

- Avoid broad architecture rewrites unless a real blocker appears.
- Do not repeatedly redesign finished UI sections; switch to QA and bug-fixing.
- For historical research, check prior chats/workbooks/source-de-dup logs first.
- Prefer bulk and archive routes before player-by-player searches.
- Record every genuinely new source tried, including no-hit / exhausted routes.
- Do not substitute conventional football assists for historical FPL assists.
- Missing optional historical fields should disable only the relevant prompt family rather than block an otherwise valid season where appropriate.
