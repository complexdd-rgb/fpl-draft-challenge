# Prompt Curation Evidence v1

Date: 8 September 2026
Baseline authority: `shards_134765_1pkuiu3`
Status: implementation complete; real full-library scan still to be run from Studio

## Purpose

The 144-record / 48-triad calibration proved that answer counts and threshold distance alone are not sufficient for permanent survivor selection. In particular, multi-numeric prompts can contain a condition that looks meaningful in the label but contributes nothing to the actual answer set.

`js/prompt-curation-evidence-v1.js` is the read-only measurement layer that closes that gap before survivor selection.

It does **not** decide or publish survivors. It measures prompt behaviour against the player database and exports the evidence that the later curation/survivor builder will use.

## Full-library scope

The engine reads the durable saved Prompt Library family-shard package via `FPL_PROMPT_LIBRARY_SHARDS_V1.buildRepositoryPackage()` and analyses every prompt in that snapshot.

For the current baseline that means:

- 134,765 promoted prompts;
- 17 families;
- 2,684 semantic variant groups;
- fingerprint `shards_134765_1pkuiu3`.

The evidence export stores the source Promotion fingerprint so evidence from one snapshot cannot be silently treated as evidence for another.

## Evaluation semantics

The evaluator reconstructs the same positive-minute player-season population used by Prompt Factory:

- only player-season records with `minutes > 0` are eligible;
- all conditions in a prompt must match the **same player-season row**;
- the final answer set is then projected to unique player IDs;
- career season count, career club count, canonical nationality, goal involvements, champion/top-four flags, manager membership and the existing Prompt Factory field/operator semantics are preserved.

The synthetic verifier includes a player whose points threshold is satisfied in one season and goals threshold in another. That player correctly does **not** qualify for the combined prompt, preventing cross-season false intersections.

## Performance model

The engine does not brute-force all 134,765 prompts independently across every player-season row.

Instead it:

1. builds position masks once;
2. evaluates every unique atomic condition once and caches it as a row bitset;
3. reconstructs each prompt by intersecting cached condition bitsets;
4. projects matching rows to a player bitset;
5. processes semantic variant groups independently for equivalence/overlap evidence.

This keeps repeated threshold/entity conditions reusable across the full library.

## Evidence recorded per prompt

### Recomputed answer set

Each prompt gets:

- recomputed unique answer-player count;
- stored `qualityEvidence.answerPlayers` count;
- a reconciliation flag showing whether the two agree;
- a deterministic answer-set fingerprint.

The fingerprint is a compact identity aid. Exact-equivalence classes are verified by bitset equality inside the current semantic variant group rather than trusting a hash alone.

### Per-condition marginality

Each condition is removed in turn and the prompt is re-evaluated.

For every condition the export records:

- answer players with that condition removed;
- how many additional players enter when it is removed;
- the added-player percentage of the relaxed answer set;
- `decorative: true` when removing the condition adds zero players.

This directly answers whether a condition changes the actual challenge.

### Exact-equivalent sibling classes

Within each current `variantGroup`, prompts with exactly the same answer-player bitset are grouped together.

The export records:

- exact-equivalent class size;
- deterministic representative ID;
- rank inside that class.

This gives the future survivor builder a safe automatic duplicate-collapse signal.

### Nearest one-axis sibling overlap

For numeric threshold axes, prompts that hold every other condition fixed are bucketed together. Adjacent threshold siblings are compared using exact player-set Jaccard overlap.

Each prompt can therefore record its nearest measured one-axis sibling with:

- sibling ID;
- Jaccard overlap;
- whether the answer sets are exactly identical;
- which condition axis was compared.

This is deliberately narrower than an all-pairs group search. It targets the threshold-churn problem efficiently while exact-equivalence fingerprints cover identical sets anywhere in the semantic group.

## Export summary

The evidence package reports snapshot-level counts for:

- prompts analysed;
- positive-minute player-season rows;
- unique players;
- unique atomic conditions cached;
- stored answer-count mismatches;
- prompts containing at least one decorative condition;
- prompts with an exact-equivalent sibling;
- prompts whose nearest one-axis sibling has Jaccard >= 0.95.

The detailed records are retained as family shards to preserve family ownership and make the later survivor builder easier to audit.

## Studio workflow

Prompt Studio now shows a **Full-library evidence layer** panel next to the curation review tools.

Use:

1. confirm the saved promoted library is the intended snapshot;
2. click **Analyse full library**;
3. allow the read-only scan to complete;
4. click **Download evidence JSON**;
5. preserve that JSON with the same Promotion fingerprint;
6. use it as input to resolve the remaining calibration holds and construct the first survivor-selection pass.

## Safety boundary

Evidence v1 does not write:

- Promotion candidates or promoted shards;
- `FPL_DAILY_GENERATION_PROMPT_POOL`;
- `FPL_DAILY_GENERATION_FAMILY_PLAN`;
- Daily challenge dates or schedules;
- publishing output;
- certification state;
- leaderboard/Supabase data.

Daily remains on the existing saved-library authority until a later explicit, fully verified curated-library cutover.

## What remains after the real scan

The real 134,765-prompt evidence export is the next required artifact.

After it exists we can:

1. reconcile any stored-answer-count mismatches before trusting curation;
2. resolve the 36 temporary HOLD rows from the 144 calibration;
3. define automatic exact-equivalence and decorative-condition removal rules from real distributions;
4. implement nearest-retained-sibling survivor selection;
5. build the first full survivor library inside the family envelopes;
6. audit family, position, difficulty, answer-band and entity balance;
7. regression-test the curated package before any Daily cutover.

No survivor count is frozen by this implementation alone.
