# Prompt expansion audit — 2026-09-02

## Scope

This pass reviewed the existing FPL Draft Challenge prompt tooling with the historical database roadmap in mind. The goal is to let older seasons become useful progressively: a player-season may qualify for a goals/club/nationality prompt when those fields are known without waiting for FPL-native bonus, assists, points or starting price.

## Existing strengths retained

- Position-aware answer-pool ranges and five-star quality packs already exist.
- V1/V2/V3 quality packs already cover career, club-context, points, price, age, managers and performance combinations.
- The quality family generator already includes inverse/anti-meta prompt concepts such as low FPL points despite high minutes.
- Nationality enrichment and a nationality family generator already exist.
- The missing-field guard correctly prevents unknown historical values from qualifying at runtime; this is essential because JavaScript numeric comparison can coerce `null` to zero.
- Daily-generation tooling already uses prompt-family/cooldown concepts and score-band diversity.

## Gap found

Runtime missing-field safety did not guarantee that *candidate answer-pool analysis* in every generator was null-safe. A rule such as `Number(p.points) < 100` can count an unknown `points: null` as zero while a generator is sizing its answer pool, even though the runtime guard later rejects that row. New historical prompt generation should therefore require known referenced fields during analysis as well as runtime.

## Added in this branch

### `js/prompt-historical-safe-pack-v1.js`

A dynamic quality pack that only analyses records when every required field is genuinely known. It selects a diverse subset by position, answer-pool breadth and answer overlap.

Families included:

- workhorse scorer — minutes + goals;
- inverse-points workhorse — low FPL points despite high minutes;
- outside-Big-Six scorer;
- relegated-club scorer;
- disciplined workhorse — minutes + low yellow-card count;
- clean-sheet workhorse for GK/DEF;
- nationality scorer.

Each installed prompt carries:

- `requiredFields`;
- `historicalSafe: true`;
- measured `fieldCoverage`;
- measured `answerPool`;
- `historical-safe` / `partial-data-safe` / anti-meta tags;
- a self-contained test source with explicit null checks.

The pack deliberately avoids inventing or modelling FPL-native facts. Existing exact-data packs remain responsible for bonus, price, FPL assists and similar fields.

### `js/prompt-field-readiness.js`

Maps every prompt to its required player-season fields and classifies it as:

- `HISTORICAL_CORE_ELIGIBLE`;
- `REQUIRES_FPL_NATIVE`;
- `REQUIRES_ADDITIONAL_RECOVERY`;
- mixed/identity-only where applicable.

This gives the project a direct bridge from the season-recovery checklist to prompt eligibility. Adding a partially recovered historical season no longer requires an all-or-nothing decision about its prompt library.

### Loader and CI

Both tools are wired into the Prompt Studio quality-tool bootstrap. A static check script and GitHub Actions workflow verify syntax, loader wiring, null-safety markers and the readiness tiers.

## Historical prompt policy going forward

1. Never require a season to be globally complete before using fields that are independently certified.
2. Unknown/null fields must make a player-season ineligible for that specific prompt, not ineligible for every prompt.
3. Nationality is a normal recoverable prompt field, not a blocker to completing the historical database.
4. Exact historical values, inferred values and future modelled prices remain distinct.
5. StatBunker support fields must not masquerade as FPL-native assists, points, bonus or prices.
6. Prefer anti-meta combinations that broaden the answer space without becoming obscure for obscurity's sake.
7. Keep answer-pool sizing and same-position overlap checks before automatically admitting new prompts.

## Next useful prompt work

- Surface the field-readiness tier and required fields in the Admin Prompt Explorer/Quality Analyser UI.
- Let historical season import/certification emit a compact field-availability manifest so Prompt Studio can report exactly which prompt families unlock for that season.
- Add nationality + club-context families once older-season nationality is materialised in the game database.
- Add era-specific historical prompt families once pre-2011 seasons enter `FPL_PLAYERS`.
- Re-run Rule Tester and Prompt Quality Analyser on the expanded live library after merge.
- Keep formation-aware generation deferred until the core historical prompt pool is broad enough.
