# Historical nationality master audit — 9 September 2026

## Purpose

This audit separates three different claims that had previously been easy to conflate:

1. nationality **source evidence exists**;
2. nationality has been **resolved to the project football-nationality policy**;
3. nationality is **physically present and certified in the canonical season master**.

A season is only marked `MASTER VERIFIED COMPLETE` below when the current audit could inspect the authoritative workbook or a newly-produced master. Failure of File Library search to surface an old workbook is not evidence that the workbook never existed.

## Permanent nationality policy

- ENGZIP / FootballSquads remains the canonical population / identity / club-membership backbone and its `Nat` field is the preferred first nationality layer when the exact source row is available.
- For ambiguous or multi-nationality cases, use the existing project football-nationality policy: senior international football identity takes precedence; otherwise use authoritative player-profile nationality/citizenship.
- Never select the first citizenship value blindly for a dual-nationality player.
- Preserve provenance and confidence in the season master.
- Do not alter the frozen ENGZIP population in order to make a nationality source fit.

## New cross-season evidence pack

A single Transfermarkt-derived fallback/cross-check pack was harvested from `Samoilov2004/premier_league_dataset` for every Premier League season from 1993/94 through 2010/11.

- Seasons covered: 18 / 18
- Total source rows: 12,157
- Blank primary-nationality rows: 0
- Source files: 362 club-season JSON files
- Artifact: `historical-nationality-evidence-1993-2010`
- GitHub Actions run: `34364287910`
- Commit: `2d300ce4412f73bad8af3333a243891282c87cb3`

Per-season fallback evidence rows:

| Season | Club files | Source rows | Blank primary nationality |
|---|---:|---:|---:|
| 1993/94 | 22 | 682 | 0 |
| 1994/95 | 22 | 689 | 0 |
| 1995/96 | 20 | 656 | 0 |
| 1996/97 | 20 | 611 | 0 |
| 1997/98 | 20 | 663 | 0 |
| 1998/99 | 20 | 679 | 0 |
| 1999/00 | 20 | 685 | 0 |
| 2000/01 | 20 | 711 | 0 |
| 2001/02 | 20 | 679 | 0 |
| 2002/03 | 20 | 684 | 0 |
| 2003/04 | 20 | 683 | 0 |
| 2004/05 | 20 | 665 | 0 |
| 2005/06 | 20 | 614 | 0 |
| 2006/07 | 20 | 666 | 0 |
| 2007/08 | 20 | 675 | 0 |
| 2008/09 | 20 | 620 | 0 |
| 2009/10 | 20 | 739 | 0 |
| 2010/11 | 20 | 756 | 0 |

This proves that the nationality **research/source lane** no longer needs a broad season-by-season discovery programme. It does not by itself prove that every frozen ENGZIP identity has already been matched and written into every canonical workbook.

## Master-level audit ledger

| Season | Nationality master state | Current evidence / action |
|---|---|---|
| 1993/94 | `VERIFY MASTER` | Historical StatBunker season is closed; nationality source evidence now available. Locate/open canonical one-sheet master, match ENGZIP `Nat` first, apply football-nationality overrides, certify. |
| 1994/95 | `VERIFY MASTER` | Same as 1993/94; do not restart football-stat recovery. |
| 1995/96 | `VERIFY MASTER` | Same as 1993/94; historical recovery previously closed. |
| 1996/97 | `MASTER VERIFIED COMPLETE` | 658/658 nationality resolved and physically written to `FPL_1996-97_RECOVERY_MASTER_v4_COMPLETE_2026-09-09.xlsx`. Confidence: 652 HIGH, 5 MEDIUM_HIGH, 1 MEDIUM. |
| 1997/98 | `VERIFY MASTER` | StatBunker season closed; locate final v2 COMPLETE master and propagate/certify nationality if absent. |
| 1998/99 | `VERIFY MASTER` | StatBunker season closed; locate canonical master and propagate/certify nationality if absent. |
| 1999/00 | `VERIFY MASTER` | StatBunker season closed; locate canonical master and propagate/certify nationality if absent. |
| 2000/01 | `VERIFY MASTER` | StatBunker season closed; locate v2 COMPLETE master and propagate/certify nationality if absent. |
| 2001/02 | `VERIFY MASTER` | Claimed complete master exists in project trail but did not surface in current File Library audit. Source evidence is ready. |
| 2002/03 | `VERIFY MASTER` | Existing enrichment/FPL bridge work must be preserved. Add nationality only after latest one-sheet master is identified. |
| 2003/04 | `VERIFY MASTER` | Existing enrichment/FPL bridge work must be preserved. Add nationality only after latest one-sheet master is identified. |
| 2004/05 | `VERIFY MASTER` | Existing enrichment work must be preserved. Add nationality only after latest one-sheet master is identified. |
| 2005/06 | `VERIFY MASTER` | StatBunker season closed; locate v2 COMPLETE master and propagate/certify nationality if absent. |
| 2006/07 | `VERIFY MASTER` | StatBunker season closed; locate v2 COMPLETE master and propagate/certify nationality if absent. |
| 2007/08 | `MASTER VERIFIED COMPLETE` | 758/758 nationality resolved and physically written to `FPL_2007-08_RECOVERY_MASTER_v3_STATBUNKER_NATIONALITY_COMPLETE_REVIEW_2026-09-09.xlsx`. Confidence: 744 HIGH, 14 MEDIUM_HIGH. FPL-native lane remains open independently. |
| 2008/09 | `VERIFY MASTER` | StatBunker recovery is already complete; locate latest one-sheet master and inspect/propagate nationality. No StatBunker re-harvest. |
| 2009/10 | `VERIFY MASTER` | StatBunker recovery is already harvested; locate latest one-sheet master and inspect/propagate nationality. No StatBunker re-harvest. |
| 2010/11 | `NATIONALITY MISSING — PHYSICALLY VERIFIED` | Surviving one-sheet master inspected in File Library has no nationality column. Create a nationality-enriched successor from the latest canonical master once the binary is available, preserving all existing FPL-native/StatBunker fields. |

## App-level nationality is a separate layer

The repository's `nationality-final-residue-report.json` records 100% nationality coverage for the 2,636-player app-era identity set after resolving its final 65 missing identities. That is useful validation evidence and a source of manual overrides, but it is not treated as proof that nationality was physically propagated into every standalone historical ENGZIP season master.

## Definition of done for the nationality lane

Nationality is fully closed only when every canonical one-sheet master from 1993/94 through 2010/11 has:

- a populated football-nationality field for every frozen canonical identity;
- source/provenance and confidence fields;
- dual/switch cases resolved by the permanent policy;
- no unresolved nationality review flags;
- no identity/population changes caused by the nationality merge.

At that point the historical football-stat + nationality research lane can be frozen and the project should concentrate on genuine FPL-native fields and historical price modelling rather than further broad nationality discovery.
