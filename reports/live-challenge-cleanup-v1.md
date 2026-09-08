# Live Challenge cleanup v1

Baseline: `de0c85b15a37cd0e13f0889b204e0a4fe42c7375` (post Daily UI v1.1.2).

## Purpose

Give the player-facing Daily Challenge the same architecture cleanup already completed for Prompt Studio: one clear owner per responsibility, no stacked legacy presentation systems, and explicit protection around the gameplay/generation boundary.

## Permanent ownership

| Area | Decision | Permanent owner |
| --- | --- | --- |
| Challenge identity/calendar/midnight rollover | KEEP | `challenge-manifest-bootstrap.js`, `daily-challenge-loader.js`, archive/fallback modules |
| Prompt helpers / player data / career context | KEEP | existing data/runtime modules |
| Validation, scoring, perfect XI, persistence | KEEP | `game-engine.js` |
| Give Up | KEEP | existing Give Up gameplay module/loader |
| Slot-level player/season performance optimisation | KEEP | `season-select-performance.js` |
| Live challenge header | KEEP | `top-header-polish.js` |
| Daily clue board, states, Live XI, accessibility | KEEP | `player-daily-redesign-v1.js` + Daily CSS |
| Mobile draft-board nav visibility | KEEP | `player-daily-mobile-nav-visibility.js` |
| Local history + fallback share + quick navigation | CONSOLIDATE | `phase45-dashboard.js` without the retired hidden hero/countdown loop |
| Leaderboard/account mobile collapse controls | CONSOLIDATE | `mobile-results-cleanup.js` without draft-board/nav positioning ownership |
| Results metrics, per-pick ranking and spoiler-free share | KEEP | `results-v2.js` only |
| Leaderboard/account/backend | KEEP | existing leaderboard modules/config/client |

## Physically retired

The following files were superseded and are deleted, not hidden behind compatibility flags:

- `js/ui-cleanup.js` — compatibility hop whose only job was to load the real bootstrap.
- `js/live-visual-enhancements.js` — duplicate hero metadata, progress and countdown observer/interval.
- `js/autocomplete-layer.js` — old CSS-in-JS autocomplete layer superseded by Daily UI.
- `js/draft-board-polish.js` — old CSS-in-JS clue-card hierarchy superseded by Daily UI.
- `js/visual-overhaul.js` — full legacy theme/brand/animation system that forced later compatibility overrides.
- `js/visual-finishing.js` — narrow-mobile legacy finishing layer; useful static metadata moved to `index.html`.
- `js/results-polish-v3.js` — second Results/share system layered over Results v2. Results v2 already owns the required score, perfect score, efficiency, per-pick analysis and share card/actions.

## Additional consolidation

- `live-feature-loader.js` now loads `live-ui-bootstrap.js` directly and defers only current optional features.
- `live-ui-bootstrap.js` now owns only the prompt-readiness guard and slot-level performance layer.
- the empty/hidden Phase 4.5 hero mount was removed from `index.html`.
- `phase45-dashboard.js` no longer re-renders a hidden hero every second or observes every clue-card mutation.
- `player-ui-pass-3.css` now contains only the retained local-history/details styles.
- `player-daily-redesign-v1-compat.css` no longer contains `fpl-visual-overhaul-body` compatibility selectors.
- `mobile-results-cleanup.js` no longer owns app padding, bottom-nav position or draft-progress position; the Daily UI owns those surfaces.
- favicon/application metadata formerly injected by `visual-finishing.js` is now static in `index.html`.

## Protected boundary

This cleanup does **not** modify the curated prompt authority, Daily challenge data, challenge publication, midnight rollover, `game-engine.js`, validation rules, scoring rules, perfect-XI calculation, saved-result semantics, Give Up gameplay, leaderboard verification or Supabase/backend behavior.

The permanent cleanup regression test fails if retired files or references return, if Results v2 stops being the results authority, or if the core challenge/game-engine order changes.
