# Historical Season Build Workflow

This is the standard workflow for building and recovering historical Premier League / FPL season workbooks for the FPL Draft Challenge.

## Permanent population rule

**Every historical master from 1993/94 onward must begin from the relevant season inside `eng.zip`.**

`eng.zip` is the canonical first-pass squad and identity population. StatBunker, Premier-League-Stats, Transfermarkt, FPL archives and all later sources are enrichment/corroboration layers; they do not replace `eng.zip` as the starting population.

This applies to both:
- FPL-era seasons from 2002/03 onward; and
- pre-FPL Premier League seasons from 1993/94 to 2001/02.

For pre-FPL seasons, fantasy-only fields should be explicitly marked `N/A — PRE-FPL` rather than being treated as unresolved/missing data.

## Core build order

**eng.zip population backbone → StatBunker appearance/stat layer → other supporting sources → FPL-native recovery where applicable → QA/archive**

## 1. Population backbone — eng.zip

Use the season contained in `eng.zip` as the canonical starting population for every season from 1993/94 onward.

For each season:
- extract every Premier League squad row from the relevant `eng.zip` season;
- de-duplicate player identities using name + date of birth where available;
- preserve every club represented during the season for transfer players;
- retain all squad members, including players with zero Premier League appearances;
- store historical squad position, nationality, DOB and club membership as supporting identity metadata;
- preserve the original `eng.zip` name/value alongside any normalised canonical identity where useful;
- do not treat the squad position as historical FPL position unless separately proven.

Population classes should distinguish:
- Premier League appearance-makers;
- StatBunker-listed zero-appearance players;
- `eng.zip`-only squad identities.

For prompt eligibility, zero-appearance players remain in the master but are normally ineligible for performance-based prompts.

### 1992/93 exception

`eng.zip` starts at 1993/94, so 1992/93 requires a separate squad-population source. Once found, use the same downstream workflow.

## 2. StatBunker — appearance and statistical backbone

Match the full `eng.zip` season population to StatBunker and use StatBunker to establish who actually appeared.

Harvest useful supporting fields where available, including:
- StatBunker player ID;
- season club / transfer club crosswalk;
- appearances;
- starts;
- substitute selections;
- came on / taken off;
- minutes where available;
- goals;
- ordinary football assists;
- yellow cards;
- red cards;
- own goals;
- penalties scored / missed / saved / conceded where available;
- goalkeeper clean sheets / other goalkeeper stats where available.

Important safety rules:
- StatBunker assists are normal football assists, not FPL assists;
- StatBunker fantasy points are StatBunker's own scoring system and must never be treated as FPL total points;
- StatBunker positions are supporting evidence only unless independently proven to match the historical FPL classification;
- supporting StatBunker stats must not silently overwrite stronger FPL-native values.

Transfer players should have one player-season master row. Preserve all clubs separately while using verified season-level aggregate stats.

## 3. Other supporting sources

Layer additional broad sources only after the `eng.zip` population and StatBunker backbone are stable.

Examples:
- Premier-League-Stats / Opta-PulseLive archive;
- Transfermarkt;
- other historical statistical archives;
- contemporary club / league records.

Rules:
- check the source de-dup / provenance trail before researching;
- do not repeat sources already harvested or exhausted;
- prefer bulk/archive routes over player-by-player searching;
- record every genuinely new source tried, including no-hit results;
- keep raw source fields separate where source semantics are unsafe.

For Premier-League-Stats specifically:
- numeric football stats can be useful supporting evidence;
- raw merged `team_name`, `team_id`, `position`, `nationality` and similar metadata may reflect later/current metadata and must not overwrite historical truth;
- ordinary assists are not FPL assists;
- the source does not provide historical FPL bonus/prices/total-points truth.

## 4. FPL-native recovery layer

### FPL era — 2002/03 onward

FPL-native evidence takes precedence for fantasy-specific fields.

Recover and materialise, where available:
- historical FPL position;
- FPL total points;
- FPL assists;
- bonus;
- starting price;
- final price where useful;
- other genuine FPL-native fields.

Rules:
- never infer FPL-native values from ordinary football stats without explicit justification;
- provenance must sit alongside recovered FPL-native values;
- classify evidence as exact / partial / unresolved;
- starting price may remain `null` after a reasonable search for otherwise usable players, with those rows excluded from price-based prompts;
- unresolved FPL-native data must not block use of reliable non-FPL fields.

### Pre-FPL era — 1993/94 to 2001/02

Keep the same workbook schema for compatibility, but mark fantasy-only fields as `N/A — PRE-FPL` rather than unresolved. These seasons should still support Premier League statistical, club, position, nationality and historical-player prompt families.

## 5. Workbook structure

Use one master workbook per season.

Preferred master layout:
- one row per player-season identity;
- canonical identity / population fields first;
- original `eng.zip` identity fields and source status;
- prompt eligibility / appearance status;
- FPL-native fields and their provenance/status where applicable;
- supporting source blocks clearly labelled by source;
- raw / quarantined source fields separated from canonical fields;
- `COMPLETE / PARTIAL / REVIEW` or equivalent status;
- `unresolved_fields` column;
- filters and frozen headers;
- missing-data / review highlighting.

Supporting sheets should normally include:
- `Evidence Ledger`;
- `Source Safety`;
- `QA`;
- source-specific audit sheets where useful.

## 6. QA gates before a season is considered stable

Verify:
- the full `eng.zip` season population is accounted for;
- every StatBunker positive-appearance player matches the population exactly once;
- any genuine StatBunker appearance-maker absent from `eng.zip` is explicitly investigated rather than silently appended;
- transfer identities are not duplicated as separate player-season rows;
- zero-appearance players remain distinguishable and prompt-ineligible where appropriate;
- recovered FPL-native values have not been overwritten by supporting-source stats;
- source-specific fantasy scoring is quarantined from FPL scoring;
- unresolved values are blanks/nulls, not accidental zeroes;
- pre-FPL fantasy fields are marked `N/A — PRE-FPL`, not unresolved;
- provenance is present for recovered FPL-native values;
- spreadsheet formula/error scan is clean;
- source de-dup / archive ledger is updated.

## 7. Source close-out / archive rule

A source should only be marked harvested/archived when every useful season and field within its actual scope has been extracted into the correct season masters, or when a season has been verified as a genuine no-hit.

Once archived, do not research the same source again unless new evidence shows that useful data was missed.

## Standard season pipeline

1. Build the full squad population from that season's `eng.zip` data.
2. De-duplicate identities and retain all season clubs.
3. Match StatBunker and establish appearance / eligibility status.
4. Harvest the StatBunker statistical block.
5. Cross-check other bulk historical sources already approved for that season.
6. For 2002/03 onward, recover FPL-native fields from contemporary / archived FPL sources.
7. For 1993/94–2001/02, mark fantasy-only fields `N/A — PRE-FPL`.
8. Resolve identities and aliases using DOB, club, season and stable source IDs.
9. Run QA and provenance checks.
10. Freeze the season master structure.
11. Mark exhausted/fully harvested sources in the source ledger.

## Historical master rollout

The long-term target is a consistent master workbook for every Premier League season available in `eng.zip`, working backwards from the current recovery frontier:

`2009/10 → 2008/09 → 2007/08 → 2006/07 → 2005/06 → 2004/05 → 2003/04 → 2002/03 → 2001/02 → ... → 1993/94`

Each new season should begin as an `eng.zip` population master before any additional source research is done. This allows the entire historical database to share one identity/population architecture even when later enrichment differs by era.

## Current reference implementation

The 2009/10 rebuild is the first implementation of this architecture:
- `eng.zip` / FootballSquads population: 792 unique identities;
- StatBunker positive-appearance players: 545;
- StatBunker-listed zero-appearance players: 86;
- `eng.zip`-only identities: 161;
- all 545 appearance-makers reconciled to the population;
- FPL-native evidence retained separately from supporting statistical layers.

Use this workflow as the default for all historical season masters from 1993/94 onward unless a season-specific source limitation requires an explicitly documented exception.
