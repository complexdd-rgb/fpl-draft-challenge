# Prompt Factory v1 boundary

Prompt Factory v1 is the clean candidate-exploration layer for the rebuilt Prompt Studio.

## Goal

Maximise the number of useful prompt candidates that can be discovered from each supported family before later quality, diversity and refinement stages reduce the pool.

## Current families

- season stats
- position stats
- exact stats
- combined stats
- club + stat
- league position
- promoted clubs
- relegated clubs
- champions
- nationality
- career longevity
- career club count
- manager
- anti-meta
- value
- minutes + role
- composite stories

## Pipeline in v1

1. Build positive-minute player-season rows from `window.FPL_PLAYERS`.
2. Derive observed thresholds from the actual database rather than relying on a small fixed threshold list.
3. Generate declarative candidate conditions for a selected family.
4. Evaluate every generated candidate against eligible rows.
5. Record generated, playable and basic-survivor counts plus answer-player, season, club and data-coverage evidence.
6. Keep the candidate pool isolated from the canonical prompt library.

## Non-publishing boundary

Prompt Factory v1 does not write to `window.FPL_PROMPT_LIBRARY`, does not call the clean Studio `addPrompt` API and does not persist candidate results to local storage. The canonical library therefore remains empty until a later explicit promotion/publishing stage is built.

## Safety boundary

Generation is capped at 60,000 unique candidates per family in v1 to prevent an accidental combinatorial explosion while the real-data behaviour is measured. The UI exposes a Stop action and evaluates candidates in browser-frame batches.

## Next stage

The next layer should add Quality Analyser / survivor scoring on top of Factory evidence, including stronger duplicate similarity, answer diversity, historical spread and prompt wording quality before any promotion to the canonical library.
