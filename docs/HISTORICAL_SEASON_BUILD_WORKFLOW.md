# Historical Season Build Workflow

This is the standard workflow for building and recovering historical Premier League / FPL season workbooks for the FPL Draft Challenge.

## Core build order

**eng.zip / FootballSquads population backbone → StatBunker appearance/stat layer → other supporting sources → FPL-native recovery → QA/archive**

## 1. Population backbone — eng.zip / FootballSquads

Use `eng.zip` as the canonical starting population for every season it covers (1993/94 onward).

For each season:
- extract all Premier League squad rows;
- de-duplicate player identities using name + date of birth where available;
- preserve every club represented during the season for transfer players;
- retain all squad members, including players with zero Premier League appearances;
- store historical squad position, nationality, DOB and club membership as supporting identity metadata;
- do not treat FootballSquads position as historical FPL position.

Population classes should distinguish:
- Premier League appearance-makers;
- StatBunker-listed zero-appearance players;
- FootballSquads-only squad identities.

For prompt eligibility, zero-appearance players remain in the master but are normally ineligible for performance-based prompts.

### 1992/93 exception

`eng.zip` starts at 1993/94, so 1992/93 requires a separate squad-population source. Once found, use the same downstream workflow.

## 2. StatBunker — appearance and statistical backbone

Match the season population to StatBunker and use StatBunker to establish who actually appeared.

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

Layer additional broad sources only after the population and StatBunker backbone are stable.

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

## 5. Workbook structure

Use one master workbook per season.

Preferred master layout:
- one row per player-season identity;
- canonical identity / population fields first;
- prompt eligibility / appearance status;
- FPL-native fields and their provenance/status;
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
- the full `eng.zip` / FootballSquads season population is accounted for;
- every StatBunker positive-appearance player matches the population exactly once;
- transfer identities are not duplicated as separate player-season rows;
- zero-appearance players remain distinguishable and prompt-ineligible where appropriate;
- recovered FPL-native values have not been overwritten by supporting-source stats;
- source-specific fantasy scoring is quarantined from FPL scoring;
- unresolved values are blanks/nulls, not accidental zeroes;
- provenance is present for recovered FPL-native values;
- spreadsheet formula/error scan is clean;
- source de-dup / archive ledger is updated.

## 7. Source close-out / archive rule

A source should only be marked harvested/archived when every useful season and field within its actual scope has been extracted into the correct season masters, or when a season has been verified as a genuine no-hit.

Once archived, do not research the same source again unless new evidence shows that useful data was missed.

## Standard season pipeline

1. Build the full squad population from `eng.zip` / FootballSquads.
2. De-duplicate identities and retain all season clubs.
3. Match StatBunker and establish appearance / eligibility status.
4. Harvest the StatBunker statistical block.
5. Cross-check other bulk historical sources already approved for that season.
6. Recover FPL-native fields from contemporary / archived FPL sources.
7. Resolve identities and aliases using DOB, club, season and stable source IDs.
8. Run QA and provenance checks.
9. Freeze the season master structure.
10. Mark exhausted/fully harvested sources in the source ledger.

## Current reference implementation

The 2009/10 rebuild is the first implementation of this architecture:
- `eng.zip` / FootballSquads population: 792 unique identities;
- StatBunker positive-appearance players: 545;
- StatBunker-listed zero-appearance players: 86;
- FootballSquads-only identities: 161;
- all 545 appearance-makers reconciled to the population;
- FPL-native evidence retained separately from supporting statistical layers.

Use this workflow as the default when working backwards through historical seasons unless a season-specific source limitation requires an explicitly documented exception.
