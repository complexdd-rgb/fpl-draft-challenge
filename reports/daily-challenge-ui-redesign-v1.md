# Daily Challenge UI Redesign v1

## Scope

This phase redesigns the player-facing Daily Challenge experience after completion of Prompt Studio cleanup and prompt-library curation.

The following are fixed boundaries and are **not** part of this redesign:

- the frozen **4,897-prompt / 17-family** curated Daily generation authority;
- prompt tests, eligibility and Daily generation logic;
- challenge publishing and the Supabase/GitHub fallback schedule;
- Europe/London midnight rollover;
- challenge IDs, release dates and archive identity;
- scoring, penalties, perfect-XI calculation and saved-result semantics;
- leaderboard verification and backend submission behaviour.

The redesign is deliberately implemented as a player-facing presentation/accessibility layer over the existing game and results engines.

## Existing UI audit

The current live page is already assembled from several presentation layers rather than one UI module. `index.html` provides the stable game/result mounts, `game-engine.js` renders the active clue cards, Give Up decorates those cards after load, and later live modules polish the header, draft board, results and leaderboard.

The audit found these main experience problems:

1. **Prompt hierarchy is too compressed.** Later polish reduced important clue and feedback text into roughly 0.6–0.8rem ranges. Long historical clues are therefore visually similar to secondary metadata.
2. **The XI is not visible as an XI while drafting.** Players work through eleven stacked cards and only see a football-pitch representation after completion.
3. **States are not semantically distinct enough.** Selected, invalid and confirmed states rely heavily on colour and transient text. Give Up is technically rendered with the same `valid compact-confirmed` card structure as a successful answer, despite representing a zero-point surrender.
4. **Invalid feedback is too transient visually.** A short shake is useful feedback, but the persistent card should also remain visibly and semantically invalid until the player changes the selection.
5. **Autocomplete layering was fixed visually but not completed semantically.** The menu is forced above neighbouring cards, but the search lacked the complete combobox/listbox/active-descendant relationship expected by keyboard and assistive-technology users.
6. **Progress/navigation surfaces overlap in purpose.** The sticky progress dock, bottom navigation and completion actions can all compete for the same viewport space, especially on mobile.
7. **Results make the player travel too far before the next meaningful action.** Score, perfect score and efficiency should lead immediately into Share / Copy / Leaderboard, with pitch comparison and pick-by-pick analysis following as deeper review.
8. **Accessibility needs a coherent pass.** Focus visibility, live invalid feedback, progress semantics, state labels, reduced-motion support and forced-colour resilience should be part of the core presentation rather than isolated fixes.

## Redesign model

### 1. Challenge header

Keep the current compact challenge identity: game title, date/title, difficulty, formation, database range, streak and next-challenge countdown. Do not add generation or admin information to the player page.

### 2. Live XI overview

Add a compact pitch above the draft cards showing all eleven clue positions in the published formation order. Each mini shirt is a navigation target back to its clue and uses one of five explicit states:

- **Open** — no choice yet;
- **Selected** — player/season being prepared but not confirmed;
- **Invalid** — the last confirmed attempt failed;
- **Confirmed** — valid locked pick;
- **Given up** — deliberately resolved for zero points.

The pitch is an overview/navigation device only. It does not create, validate or persist picks.

### 3. Draft cards

Desktop uses a two-column board where space allows; tablet/mobile collapses to one column. Each card gives visual priority to:

1. position + full clue;
2. state chip;
3. player search;
4. season choice;
5. primary Confirm action;
6. feedback/secondary actions.

Prompt text increases to approximately 1rem with stronger line-height. Inputs use 46px minimum height, and mobile text inputs use 16px text to avoid browser zoom.

### 4. State presentation

Every card receives a text state chip in addition to colour. Invalid cards keep a persistent red/pink boundary and alert text. Confirmed cards use green only after validation. Give Up uses amber/pink treatment and never visually masquerades as a successful selection.

### 5. Autocomplete

Keep the existing matching and keyboard-selection engine unchanged. Presentation/accessibility additions provide:

- `role="combobox"` on the player search;
- `aria-expanded`, `aria-controls`, `aria-autocomplete` and `aria-activedescendant`;
- `role="listbox"` on suggestions;
- `role="option"` + `aria-selected` on player options;
- a high, isolated visual layer so suggestions cannot hide behind cards, feedback or sticky UI;
- clear active-option styling for keyboard use.

### 6. Progress and mobile navigation

Use the board progress dock as the primary in-game status/navigation surface: complete count, timer, penalties, progress bar and Next open pick. Keep it top-sticky near the draft board rather than stacking it above the mobile bottom navigation.

The bottom navigation remains useful on mobile for Today / Archive / Stats / contextual action, but is redundant on desktop and is hidden there by the redesign.

### 7. Score / perfect score / efficiency

After completion, Results v2 remains the preferred score summary when available:

- Final score;
- Perfect score;
- Efficiency;
- Best prompt picks / grade / time context.

The legacy score card stays available as secondary detail. No scoring values are recalculated by the redesign.

### 8. Completion, share and leaderboard

The first completion journey becomes:

**Result hero → primary score summary → Share / Copy / View leaderboard → pitch comparison → deeper pick review.**

The existing share implementation and leaderboard client remain owners of their actions. The redesign only reorders existing DOM nodes and adds a navigation button to the existing leaderboard panel. Archive practice never receives the verified-leaderboard action.

### 9. Accessibility acceptance

The redesign requires:

- visible keyboard focus on draft and result controls;
- a skip-to-draft-board link;
- textual state labels rather than colour alone;
- invalid feedback as an assertive live alert;
- normal feedback as a polite status;
- semantic draft progressbar values;
- accessible autocomplete relationships;
- descriptive labels for season, Confirm, Change/Clear, Give Up and Reopen;
- reduced-motion support;
- forced-colours resilience;
- touch targets around 40–46px for primary interactive controls.

## Implementation in `daily-ui-redesign-v1`

The first pass adds:

- `player-daily-redesign-v1.css` — main responsive presentation;
- `player-daily-redesign-v1-compat.css` — narrow high-specificity compatibility boundary for CSS still injected asynchronously by existing live presentation modules;
- `js/player-daily-redesign-v1.js` — DOM state decoration, live-XI navigation, ARIA semantics and result-flow ordering;
- two stylesheet entries and one presentation-script entry in `index.html`.

No generation, loader, challenge, prompt-authority, scoring, publishing or Supabase file is modified.

## Validation gates before merge

1. Syntax-check the new JavaScript.
2. Verify the redesign script has no prompt-testing, scoring, persistence or network ownership.
3. Verify only approved player-facing presentation/report/test paths changed.
4. Test open → selected → invalid → confirmed → Change pick → Give Up → Reopen states.
5. Test mouse/touch and full keyboard autocomplete flow.
6. Test official completion, restored completion and archive practice.
7. Test Results v2 loading after completion and share-button replacement.
8. Test leaderboard loading/submission remains server-owned.
9. Test representative desktop, tablet and narrow mobile widths plus reduced-motion mode.
10. Confirm midnight challenge selection/rollover and challenge identity are untouched by diff.

## Follow-up after v1 visual QA

Once the redesigned surface is visually certified, the older overlapping player-only CSS/polish rules can be retired in a later dedicated cleanup **only if they are proven redundant**. That is not required to ship this redesign and must not reopen the already-completed generation/Prompt Studio architecture work.
