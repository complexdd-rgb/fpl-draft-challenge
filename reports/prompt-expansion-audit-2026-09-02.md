# Prompt expansion audit — 2026-09-02

## Scope

This pass reviewed the existing FPL Draft Challenge prompt tooling with the historical database roadmap in mind. The goal is to let older seasons become useful progressively: a player-season may qualify for a goals/club/nationality prompt when those fields are known without waiting for FPL-native bonus, assists, points or starting price.

## Existing strengths retained

- Position-aware answer-pool ranges and five-star quality packs already exist.
- V1/V2/V3 quality packs already cover career, club-context, points, price, age, managers and performance combinations.
- The quality family generator already includes inverse/anti-meta prompt concepts such as low FPL points despite high minutes.
- Nationality enrichment and a nationality family generator already exist.
- The missing-field guard correctly prevents unknown historical values from qualifying at runtime; this is essential because JavaScript numeric comparison can coerce `null` to zero.
- Daily-generation tooling already penalises repeated top answers, clubs, seasons and score bands alongside prompt-family cooldowns.

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

Each installed prompt carries `requiredFields`, `historicalSafe: true`, measured field coverage/answer-pool metadata and historical-safe/partial-data-safe/anti-meta tags. Its test source explicitly checks for null/unknown values.

### `js/prompt-historical-era-pack-v1.js`

Adds era-specific prompts that do **not** depend on FPL points. Four-season windows are derived from whatever seasons are currently present in `FPL_PLAYERS`, so the pack automatically expands backwards as 2010/11, 2009/10 and earlier seasons are imported.

Families included:

- era scorer — season window + goals;
- era workhorse — season window + minutes.

This removes an important blocker in the existing V3 era approach, where era prompts were primarily points-led and therefore unsuitable for most pre-FPL seasons.

### `js/prompt-nationality-context-pack-v1.js`

Adds nationality combinations that remain useful when FPL-native points/prices are unavailable:

- nationality + bottom-half club + goals;
- nationality + relegated club + goals;
- nationality + outside-Big-Six club + goals.

Candidate selection penalises repeated countries and repeated families in the same position batch, while answer-pool overlap is capped before installation.

### `js/prompt-field-readiness.js`

Maps every prompt to its required player-season fields and classifies it as:

- `HISTORICAL_CORE_ELIGIBLE`;
- `REQUIRES_FPL_NATIVE`;
- `REQUIRES_ADDITIONAL_RECOVERY`;
- mixed/identity-only where applicable.

`season` is explicitly treated as historical-core data. This gives the project a direct bridge from the season-recovery checklist to prompt eligibility. Adding a partially recovered historical season no longer requires an all-or-nothing decision about its prompt library.

### `js/historical-season-field-manifest.js`

Measures known-field coverage by season across positive-minute player-seasons. It records counts and coverage for club, position, minutes, goals, assists, clean sheets, cards, keeper stats, bonus, prices, points and club-context fields, and exposes a `canEvaluate()` helper for readiness tooling.

### `js/prompt-field-readiness-panel.js`

Adds a lightweight Prompt Studio panel without rewriting the large Admin modules. It shows:

- counts of prompts by historical-readiness tier;
- the most-used required fields;
- readiness badges and required-field tooltips on prompt cards;
- a recent-season coverage table for goals, assists, clean sheets, yellow cards, points and starting price.

This makes partial historical readiness visible rather than hidden in metadata.

### Loader and CI

All new tools are wired through the Prompt Studio quality-tool bootstrap/readiness loader. A static check script and GitHub Actions workflow cover syntax, loader wiring, null-safety markers, historical/era/nationality-context pack markers, the season manifest and readiness UI.

## Historical prompt policy going forward

1. Never require a season to be globally complete before using fields that are independently certified.
2. Unknown/null fields make a player-season ineligible for that specific prompt, not ineligible for every prompt.
3. Nationality is a normal recoverable prompt field, not a blocker to completing the historical database.
4. Exact historical values, inferred values and future modelled prices remain distinct.
5. StatBunker support fields must not masquerade as FPL-native assists, points, bonus or prices.
6. Prefer anti-meta combinations that broaden the answer space without becoming obscure for obscurity's sake.
7. Keep answer-pool sizing and same-position overlap checks before automatically admitting new prompts.
8. Keep the existing weekly diversity penalties for repeated top answers, clubs, seasons and score bands; add nationality variety through quality prompt selection rather than destabilising the scheduler.

## Remaining useful prompt work

- Re-run Rule Tester and Prompt Quality Analyser against the expanded live library after the branch is merged/deployed and the browser can load the generated packs.
- Use the season field manifest during historical season certification/import to report which families unlock immediately.
- Consider a targeted null-safety retrofit to the older automatic family generator's *candidate analysis* path; runtime evaluation is already protected by the shared missing-field guard.
- Keep formation-aware generation deferred until the core historical prompt pool is broad enough.
