# Historical season status audit — 8 September 2026

## Purpose

This report reconciles the historical-database project state from three evidence classes:

1. current repository history and permanent certification code;
2. surviving File Library masters/checkpoints;
3. recorded project-chat completion checkpoints.

It is deliberately conservative. `COMPLETE` means the relevant historical recovery lane was explicitly closed. `VERIFY` means substantial work exists but the final canonical artifact or production state was not independently proven in this audit. `PARTIAL` means an explicit unfinished checkpoint survives. `RECONCILED` means a previously conflicting lineage has been resolved, but the final canonical artifact/enrichment still needs closure.

The File Library search index is not an exhaustive archive listing, so failure to surface an old generated workbook is **not** treated as proof that the workbook never existed.

## Permanent rules

- ENGZIP / FootballSquads is the frozen population, identity and club-membership backbone for every historical Premier League season from 1993/94 onward.
- Do not rebuild or overwrite that backbone from StatBunker.
- StatBunker and other public football-stat sources are enrichment layers only.
- Never substitute conventional football assists, positions or fantasy values for genuine historical FPL-native fields.
- Final season masters remain single-sheet workbooks.
- Preserve provenance, confidence, uncertainty and unresolved-field state on the same canonical row.
- Historical starting-price modelling remains a later phase and must not overwrite subsequently recovered genuine prices.

## Status key

| State | Meaning |
|---|---|
| `PRODUCTION` | Present in the established app-era database; no historical backbone rebuild required. |
| `DONE` | Historical recovery lane explicitly completed/frozen. |
| `DONE + IMPORTED` | Historical master completed and imported into the app with permanent post-import checks. |
| `VERIFY` | Strong/advanced work exists, but final master/import/certification state needs one focused verification pass. |
| `PARTIAL` | Surviving evidence explicitly says work remains. |
| `RECONCILED` | A prior source/checkpoint conflict has been resolved, but final artifact/enrichment closure is still outstanding. |

## Season-by-season ledger

| Season | Status | What is already established | Remaining action | Evidence confidence |
|---|---|---|---|---|
| 2025/26 | PRODUCTION | Current/app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2024/25 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2023/24 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2022/23 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2021/22 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2020/21 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2019/20 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2018/19 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2017/18 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2016/17 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2015/16 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2014/15 | PRODUCTION | Established app-era FPL-native database season. | No historical recovery. Include later in full production certification. | High |
| 2013/14 | PRODUCTION | Established app-era season; prompt-stat recovery work also repaired 2013/14 card/identity fields alongside 2012/13. | Include later in full production certification. | High |
| 2012/13 | PRODUCTION | Previously season-certified; later repository work recovered missing prompt stats and rebuilt player-facing data. | No historical reconstruction. Include later in full production certification. | High |
| **2011/12** | **DONE + IMPORTED** | **539/539 positive-minute identities; starting-price decisions closed; certified import payload wired into canonical/live data; permanent post-import audit checks 539 canonical + 539 live rows, duplicates, zero-minute rows, certification/runtime/Rule Tester disagreements.** | **None. Do not reopen.** | **Repository-proven** |
| **2010/11** | **VERIFY** | Advanced single-sheet master lineage exists. Official historical FPL-history recovery, launch-list pricing work, StatBunker and Premier-League-Stats enrichment were harvested. Earlier recovery authority was 544 players with 335 FPL-native histories and 209 unresolved at that checkpoint. Repository history contains 2010/11 frontier/Morph certification work, but this audit did not prove a final imported/certified season. | Locate/freeze latest one-sheet master; quantify remaining FPL-native gaps; verify whether any later recovery superseded the 335/209 checkpoint; then import/certify if ready. Do **not** redo harvested sources. | High that work is advanced; medium on final closure |
| **2009/10** | **VERIFY** | ENGZIP backbone built; StatBunker bulk/club/minutes harvest is documented in repository history; later workbook inventory records `FPL_2009-10_RECOVERY_MASTER_v3_ENGZIP_BACKBONE_STATBUNKER_HARVESTED_2026-08-27.xlsx` and a PL-stats-complete derivative. Earlier StatBunker population audit had 545 appearance-makers, 502 automatic matches + 43 aliases. | Verify latest canonical one-sheet master and unresolved FPL-native/price fields; do not rerun StatBunker/PL-stats harvest. | High on source harvest; medium on final closure |
| **2008/09** | **DONE / VERIFY IMPORT** | ENGZIP starting master built; project inventory records `FPL_2008-09_RECOVERY_MASTER_v2_STATBUNKER_COMPLETE.xlsx`. | Confirm final one-sheet artifact and production-import state; then leave source recovery frozen. | High from project checkpoint; artifact not re-opened in this audit |
| **2007/08** | **PARTIAL — PRIMARY UNFINISHED SEASON** | Surviving File Library checkpoints prove 367 clean positive-minute rows from the FFScout 2008/09 carrier (33 GK, 126 DEF, 134 MID, 74 FWD), 328 official launch-list matches (89.4%), 39 launch follow-ups, and Gary Neville quarantined as corrupted. Checkpoint explicitly warns 367 is carrier coverage, not the full league universe. ENGZIP master exists. | Finish canonical population/stat enrichment against frozen ENGZIP backbone; resolve the 39 launch follow-ups and missing/departed/relegated population; preserve Gary Neville quarantine until independently resolved; issue audited single-sheet master. | File-Library-proven |
| **2006/07** | **DONE / VERIFY IMPORT** | Project completion checkpoint: `FPL_2006-07_RECOVERY_MASTER_v2_STATBUNKER_ENRICHED_COMPLETE.xlsx`; 741 frozen ENGZIP identities; 260/260 scorer entries matched; 259 canonical scorers; 889 player goals + 42 residual = 931. | Artifact/import verification only. No source re-harvest. | Strong chat checkpoint |
| **2005/06** | **DONE / VERIFY IMPORT** | Project completion checkpoint: `FPL_2005-06_RECOVERY_MASTER_v2_STATBUNKER_ENRICHED_COMPLETE.xlsx`; 742 frozen ENGZIP identities; 257/257 club-split scorer entries matched; 255 canonical scorers; 916 player goals + 28 residual = 944. | Artifact/import verification only. No source re-harvest. | Strong chat checkpoint |
| **2004/05** | **VERIFY** | ENGZIP master created during backward build. Sequential enrichment work proceeded beyond this season, and substantial early-FPL official points/launch-price bridge data was recovered around 2002/03–2004/05. | Locate latest canonical master and verify its final StatBunker/enrichment gate before marking frozen. Do not restart broad source discovery. | Medium-high chat evidence; final artifact not surfaced |
| **2003/04** | **VERIFY** | ENGZIP master created; substantial official early-FPL points/launch-price bridge recovery exists. Sequential enrichment programme progressed beyond this season. | Locate latest canonical master and verify final enrichment/completeness gate. | Medium-high chat evidence; final artifact not surfaced |
| **2002/03** | **VERIFY** | ENGZIP master created. Important genuine-FPL bridge work exists: official 2002/03 points and 2003/04 launch-period prices were recovered in bulk for historical player groups. | Locate latest canonical master and verify final enrichment/FPL-native merge state. This is the first FPL-era historical season, so genuine FPL-native values take precedence over conventional-stat substitutes. | Medium-high chat evidence; final artifact not surfaced |
| **2001/02** | **DONE? — VERIFY ARTIFACT** | Project trail records work continuing through 2001/02 and a claimed `FPL_2001-02_SINGLE_SHEET_MASTER_v3_COMPLETE_2026-09-08.xlsx` with 724 canonical identities. The file did not surface in this File Library audit. | Find/open the claimed final master and validate counts/status before freezing. If found clean, no StatBunker re-harvest. | Medium; artifact not surfaced |
| **2000/01** | **DONE / VERIFY ARTIFACT** | Explicit completion checkpoint: `FPL_2000-01_RECOVERY_MASTER_v2_STATBUNKER_ENRICHED_COMPLETE_2026-09-02.xlsx`; 766 frozen ENGZIP players; 489/489 relevant StatBunker identities matched; 8,360 starts; 963 player goals + 29 own goals = 992. | Artifact verification only; then freeze. | Strong chat checkpoint |
| **1999/00** | **DONE / VERIFY ARTIFACT** | Explicit completion checkpoint: 752 frozen players; 20/20 clubs at 418 starts; 8,360 total starts; 1,027 player-attributed goals against 1,060 club goals. | Artifact verification only; then freeze. | Strong chat checkpoint |
| **1998/99** | **DONE / VERIFY ARTIFACT** | Final completion checkpoint superseded earlier in-progress state: 740 frozen canonical identities; 489/489 relevant identities matched; 20/20 clubs at 418 starts; 8,360 starts; 943 player-attributed goals. Earlier audit identified 25 multi-club players and resolved Everton's 11-start gap as Francis Jeffers. | Artifact verification only; then freeze. | Strong chat checkpoint |
| **1997/98** | **DONE / VERIFY ARTIFACT** | Explicit completion checkpoint: `FPL_1997-98_RECOVERY_MASTER_v2_STATBUNKER_ENRICHED_COMPLETE_2026-09-01.xlsx`; 705 canonical players; 20/20 clubs; 8,360 starts; 26 multi-club identities; scorer totals reconciled. | Artifact verification only; then freeze. | Strong chat checkpoint |
| **1996/97** | **RECONCILED / PARTIAL — 658 CANONICAL** | The 658-vs-672 conflict is resolved at the lineage level. FootballSquads contains **672 raw named rows** across the 20 clubs; Derby closes the raw total at 35 rows. Same-season re-registrations/intra-PL transfers mean raw rows are not unique people; the earlier deduplicated **658-player canonical checkpoint remains the working authority**. The later `672 / 9,108 starts / 1,133 goals / 67 send-offs` COMPLETE checkpoint is quarantined because its aggregates fail hard league controls: **8,360 starts**, **970 league goals**, and **43 red cards**. See `reports/1996-97-reconciliation-2026-09-08.md`. | Locate the original 658-row master or deterministically reconstruct it from the frozen raw backbone with a 14-occurrence dedupe ledger; then finish StatBunker enrichment to 20/20 clubs and audit every club to 418 starts / league to 8,360 before issuing the final one-sheet master. | High on reconciliation; final artifact not yet physically verified |
| **1995/96** | **DONE / VERIFY ARTIFACT** | Project checkpoint says the season was completed before work moved to 1996/97. | Locate final master and verify audit markers; no broad re-harvest unless artifact disproves completion. | Strong chat sequence |
| **1994/95** | **DONE / VERIFY ARTIFACT** | StatBunker programme was run sequentially from 1993/94 forward and had progressed past 1995/96. | Locate final master and verify audit markers. | Strong chat sequence, artifact not surfaced |
| **1993/94** | **DONE / VERIFY ARTIFACT** | First season of the StatBunker enrichment programme; project thread explicitly finished it before moving to the next season. ENGZIP remains frozen authority. | Locate final master and verify audit markers. Do **not** restart from scratch. | Strong chat sequence, artifact not surfaced |

## Audit findings

### 1. ENGZIP is not outstanding

The ENGZIP / FootballSquads population/identity/club backbone was harvested through the full Premier League history back to 1993/94. This is frozen work and must not be repeated.

### 2. 2011/12 is closed

2011/12 is the strongest historical season in the project: the 539-player master was closed, imported and given a permanent post-import certification guard. It should be treated as the reference pattern for future historical imports.

### 3. The true next unfinished season is 2007/08

The surviving 2007/08 checkpoint explicitly records incomplete carrier coverage and 39 launch-list follow-ups. This is a genuine data-completion job, not an artifact-finding exercise.

### 4. 1996/97 population conflict is reconciled; final master is still open

The later 672-player COMPLETE claim is no longer accepted as a competing canonical population. The 672 count reconciles to raw FootballSquads named rows, while the later checkpoint's 9,108 starts, 1,133 goals and 67 send-offs fail the season's hard controls. The working canonical population is therefore the earlier 658-player deduplicated backbone. The remaining task is artifact recovery/reconstruction plus completion of the enrichment/audit, not another population debate.

### 5. 2008/09–2010/11 require closure/import verification rather than broad source recovery

The source-harvest work is already extensive. The remaining job is to establish the latest canonical one-sheet master for each, quantify genuinely unresolved FPL-native/price fields, and promote only the clean final state into production.

### 6. 2002/03–2004/05 need artifact-level verification

There is strong evidence that their sequential historical enrichment and early-FPL recovery work was carried out, but this audit did not surface the definitive final masters. Verify before either redoing work or calling them production-ready.

### 7. Current `All-season certification` CI is a deferred-boundary guard, not proof that every season is certified

The current repository verifier explicitly protects the deferred all-season state while Daily generation uses its separate curated reservoir. Full database/prompt certification remains a later roadmap phase.

## Recommended execution order

1. **Finish the reconciled 1996/97 master** — locate/reconstruct the 658-row canonical backbone, materialise the 14-occurrence dedupe ledger, complete StatBunker enrichment and force the 8,360-start audit.
2. **Finish 2007/08** — first clearly unfinished season by surviving artifact evidence.
3. **Close 2008/09, 2009/10 and 2010/11** — verify final masters, remaining FPL-native gaps, prices and import state; no repeated bulk harvesting.
4. **Verify 2002/03–2004/05 final artifacts** — promote/freeze if clean.
5. **Verify claimed-complete early masters** — 1993/94–1995/96 and 1997/98–2001/02; this is an artifact/audit pass, not a new research programme.
6. **Create the definitive frozen historical-master index** — one authoritative master per season, one status and one provenance pointer.
7. **Only then start historical starting-price modelling** for pre-FPL seasons and genuinely unrecoverable later prices.
8. **After price modelling, run true all-season production certification** and import the newly completed historical seasons into the app.

## Immediate definition of done for Phase 3

Historical database completion is finished when every season from 1993/94 through 2011/12 has exactly one designated canonical single-sheet master with:

- frozen canonical identities;
- prompt-relevant statistics populated or explicitly unavailable;
- nationality/audit/provenance fields present;
- uncertainty/quarantine state resolved or explicitly accepted;
- genuine FPL-native fields distinguished from conventional-stat enrichment;
- starting-price state recorded as genuine / reconstructed / approved null / not applicable, without prematurely modelling pre-FPL values;
- a clear import/certification disposition;
- no ambiguous competing `COMPLETE` masters.

At that point the project moves to the historical starting-price model rather than reopening data-source architecture.