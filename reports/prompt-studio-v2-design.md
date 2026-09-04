# Prompt Studio v2 — design and ownership

Prompt Studio v2 replaces the previous single long scrolling workspace with four focused views while preserving the existing prompt rules and control IDs.

## Views

### Library

- Search/filter the full canonical working library.
- Enabled means repository-certified and production-eligible.
- Non-production prompts remain disabled until promoted or deleted.
- Backup/import/download utilities are collapsed under Library tools.

### Create

- Manual safe rule builder and automatic generators live together.
- New/generated candidates enter the working library disabled for review.
- Creation cannot bypass the repository promotion boundary.

### Quality

- The analyser uses the full canonical library.
- Stale reports are invalidated when library membership changes.
- Bulk actions and report exports remain available, but are visually secondary.

### Review & promote

- Disabled candidates are surfaced as a queue.
- Quality evidence, answer breadth and issues are shown when available.
- Passing analyser checks marks a candidate ready for promotion review only.
- Browser state never directly promotes a prompt into the 851-prompt production pool.

## Native ownership

Canonical markup: `fragments/admin-prompt-workspace.html`

Builder: `scripts/build-native-prompt-workspace.mjs`

Verifier: `scripts/verify-native-prompt-workspace.mjs`

Presentation/controller: `js/prompt-studio-redesign.js`

Responsive layout: `admin-prompt-studio-v2.css`

Production boundary remains owned by `js/repository-certified-prompt-pool.js`; visible enabled/disabled state remains owned by `js/prompt-library-canonical-state.js`.

## Protected invariants

- exactly 851 repository-certified production prompts;
- 4★+ production floor;
- browser/working prompts cannot leak into Daily generation or certification;
- nationality readiness and one-nationality-per-day generation rule unchanged;
- exact rotation, cooldown, diversity, perfect-XI and seven-day publish safeguards unchanged;
- all-season certification uses the frozen repository-certified snapshot.
