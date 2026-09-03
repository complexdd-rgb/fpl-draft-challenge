# FPL Draft Challenge — Architecture Map

Updated: 3 September 2026

This document describes the current repository architecture as it exists after the September Prompt Studio, Career Evolution, Quality Enforcement v2 and Refinement Incubator work. It also records the intended cleanup direction so temporary compatibility layers are not mistaken for permanent design.

## 1. System boundaries

The repository currently has five main runtime areas:

1. **Live game** — public daily challenge, player search, scoring, results and leaderboard.
2. **Challenge Studio** — admin-only generation, prompt management, quality analysis, database auditing, validation and publishing.
3. **Prompt engine** — prompt families, generator, analyser, 4★+ enforcement, refinement and survivor-target generation.
4. **Weekly engine** — seven-day generation, certified prompt snapshot, family quotas, exact rotation, nationality reservation and answer diversity.
5. **Historical data/certification** — player-season data, career context, field readiness, season certification and historical-safe prompt availability.

The most important architectural rule is that **Studio may build and analyse candidate material, but the live Daily Challenge must consume only certified prompt/data state**.

---

## 2. Live game boot chain

Primary page: `index.html`

Current critical order:

```text
challenge-manifest-bootstrap
→ daily-challenge-loader
→ challenge-legacy-fallback
→ challenge-archive
→ prompt-helpers
→ players-live.js
→ career-context.js
→ game-engine.js
→ live visual/result layers
→ leaderboard/account feature loading
```

### Key ownership

- `players-live.js` — live player-season database.
- `js/career-context.js` — reusable cross-season/career facts. Career Evolution facts are attached here so Studio-generated career rules also work in live play.
- `js/game-engine.js` — core challenge gameplay/scoring/reveal behaviour.
- `js/leaderboard-config.js` — public leaderboard configuration plus the environment feature-loader bridge.
- `js/live-feature-loader.js` — non-critical live feature loading.

### Protected invariant

`career-context.js` must load before `game-engine.js` whenever a live prompt can depend on `_career`, `_careerShape` or `_careerEvolution` data.

---

## 3. Challenge Studio boot chain

Primary page: `admin.html`

The current Studio is functional but still contains architectural debt. The HTML is historically a long-form sequence of panels. `js/admin-stage-one.js` builds the current workspace/navigation presentation and restores the saved workspace. The September fast-boot work hides the old raw layout before first paint and runs Stage One early, but the current workspace structure is **not yet fully native HTML**.

Current high-level boot:

```text
admin.html
→ admin-stage-one.js (workspace construction / restore)
→ players.js
→ career-context.js
→ prompt-library.js
→ validation-engine.js
→ admin-core.js
→ weekly/daily guard layers
→ admin-import-tools.js compatibility entrypoint
→ leaderboard-config.js
→ studio-feature-loader.js
```

### Main Studio modules

- `js/admin-core.js` — large multi-phase Studio core. Currently owns more responsibilities than one permanent module should.
- `js/admin-stage-one.js` — workspace shell, navigation, panel re-parenting and refresh-position restoration.
- `js/admin-batch-calendar.js` — seven-day challenge generator.
- `js/admin-daily-generator-guard.js` — certified-prompt-pool lock/snapshot and final generation guard.
- `js/admin-daily-publish.js` — publishing/download support.
- `js/validation-engine.js` and `js/validation-lab.js` — prompt/data validation.

### Temporary compatibility layer

`js/admin-import-tools.js` is explicitly a **legacy compatibility entrypoint**. Its active responsibilities have moved to `js/prompt-studio-loader.js` and the Career Shape validation bridge. It should be removed once callers are migrated to the real loader directly.

---

## 4. Prompt Studio lazy-loading chain

`js/prompt-studio-loader.js` is the main lazy entrypoint for heavy prompt-generation tooling.

Current chain:

```text
prompt-studio-loader
→ admin-import-tools-base
   ├─ main automatic prompt generator
   ├─ Prompt Quality Analyser
   └─ browser-library persistence helpers
→ prompt-target-survivor-generator
→ prompt-target-auto-explorer
→ Career Shape rule/studio/repair/unified modules
```

A separate Studio feature path currently loads quality/certification helpers through:

```text
leaderboard-config
→ studio-feature-loader
→ legacy prompt additions
→ career-shape-validation-bridge
→ prompt-era-range-wording
→ admin-studio-finish
→ career-overlap-wording
→ quality packs / analyser stars / 4★ enforcer
```

The **Refinement Incubator** is Studio-only and is currently loaded separately from `leaderboard-config.js`, then waits for Quality Enforcement v2 to become ready.

### Cleanup target

These overlapping dependency chains should eventually become one explicit Studio bootstrap/registry rather than multiple modules dynamically discovering one another.

---

## 5. Prompt generation pipeline

Current functional pipeline:

```text
family providers
→ main automatic generator
→ answer-count / difficulty / duplicate / near-pool checks
→ checked browser-library batch
→ Prompt Quality Analyser
→ Quality Enforcement v2
   ├─ 4★ / 5★ certified
   ├─ borderline 3★ family/diversity rescue
   ├─ promising 3★ refinement incubator
   └─ broken/unsafe rejection
→ survivor-target runner / auto-explorer
→ certified prompt library
```

### Integrated family providers

The main generator currently integrates:

- normal automatic families from `admin-import-tools-base.js`;
- Quality Families;
- Nationality Family;
- Career Evolution families.

Career Evolution currently includes season-to-season change, bounce-back, career streaks, position journeys, club/status journeys, nationality × career and manager journeys.

### Quality rule

The live Daily Challenge remains **4★+ only**. The Refinement Incubator may preserve and mutate promising 3★ ideas, but they do not become live prompts unless the normal full-library enforcement later certifies them.

---

## 6. Weekly generation pipeline

The seven-day generator has several deliberately hard safeguards. Treat these as protected behaviour during refactors.

```text
nationality prompt pack readiness
→ 4★+ certified library ready
→ immutable certified prompt snapshot
→ formation-aware candidate selection
→ exactly one nationality prompt per day
→ other family/mix quotas
→ exact-prompt rotation
→ family cooldown
→ answer/top-player diversity
→ perfect-XI validation
→ final certified-pool check
→ ZIP/download eligibility
```

### Protected weekly invariants

Do not regress these during architecture cleanup:

- only the authoritative certified Studio library may supply prompts;
- the generation snapshot is immutable for the duration of a run;
- exactly one nationality prompt is required per generated day;
- exact-prompt rotation must remain safe when the library grows;
- family cooldown may relax where designed, but certified-pool membership may not;
- failed/partial seven-day runs must not be published as valid packages.

---

## 7. Historical data and career context

Historical player-season data lives primarily in `players.js` / `players-live.js`, with season-level fields and derived context used by the prompt engine.

`js/career-context.js` is the shared runtime derivation layer for facts that need multiple seasons. Keeping these facts in a shared context is preferable to embedding Studio-only logic in prompt source strings because saved prompts must evaluate identically in the live game.

Historical prompt availability is further controlled by field-readiness/certification logic so missing FPL-native fields should disable only the affected prompt families rather than invalidating otherwise-usable historical seasons.

---

## 8. Generated wiring and patch scripts

The repository currently contains many `scripts/apply-*.mjs` and matching `verify-*.mjs` files. These were useful for introducing features safely and idempotently, but they have become an architectural layer of their own.

Current examples cover:

- weekly nationality reservation;
- immutable certified snapshots;
- library-expansion rotation;
- unified prompt families;
- survivor-target generation;
- Career Evolution;
- Studio refresh fast boot;
- cache wiring.

### Current rule

Every patch script that remains must be **repeat-safe**. Running the same generated-wiring sequence twice must not duplicate declarations, markup or script tags.

### Target

Replace the growing patch chain with one manifest-driven Studio wiring/build step, for example:

```text
scripts/build-studio-wiring.mjs
```

Desired contract:

1. read desired asset/module manifest;
2. write/update wiring once;
3. validate dependency order;
4. run twice in CI;
5. second run produces zero diff.

---

## 9. Cache/version ownership

Cache query versions are currently scattered across HTML, loaders, patchers and CI assertions. This has already produced false CI failures when a runtime asset moved from one version to another but a literal regression assertion did not.

### Target

Create one Studio/live asset-version manifest and have loaders, generated wiring and CI consume it. CI should prefer behavioural/order assertions over hard-coded version strings unless the version itself is the behaviour under test.

---

## 10. Current module hotspots

These files deserve decomposition planning, but **not one-shot rewrites**:

- `js/admin-core.js` — very large multi-phase Studio core;
- `js/admin-import-tools-base.js` — generator, analyser, UI and persistence responsibilities are coupled;
- `js/admin-batch-calendar.js` — substantial weekly engine;
- `admin.html` — still contains the legacy long-form panel structure;
- Studio CSS — multiple generations of base/overhaul/mobile/prompt-specific overrides.

### Safe extraction order

Extract low-risk pure/helper logic first, then UI/persistence boundaries, then change boot ownership. Keep generator/certification behaviour protected by existing regression suites throughout.

---

## 11. Target architecture

```text
FPL Draft Challenge
│
├── Live Game
│   ├── data bootstrap
│   ├── career context
│   ├── game engine
│   ├── challenge loader
│   └── leaderboard/account features
│
├── Studio
│   ├── studio-bootstrap
│   ├── Daily Challenge workspace
│   ├── Prompt Studio workspace
│   ├── Database workspace
│   ├── Validation workspace
│   └── Publishing workspace
│
├── Prompt Engine
│   ├── family providers
│   ├── generator core
│   ├── quality analyser
│   ├── Quality Enforcement v2
│   ├── refinement incubator
│   └── survivor-target runner
│
├── Weekly Engine
│   ├── certified snapshot
│   ├── formation builder
│   ├── family quotas
│   ├── exact rotation
│   └── answer diversity
│
├── Historical Data
│   ├── player-season data
│   ├── nationality / identity
│   ├── career derivations
│   └── field readiness / certification
│
├── Build / Wiring
│   └── one repeat-safe manifest-driven builder
│
└── CI
    ├── syntax/static checks
    ├── prompt-engine behaviour
    ├── weekly-generation behaviour
    ├── historical/all-season certification
    └── Studio boot/end-to-end regression
```

---

## 12. Cleanup order

Use this order for structural work:

1. keep `main` green and remove stale CI assertions;
2. resolve superseded/open wiring PRs;
3. make every remaining generated patch repeat-safe;
4. centralise asset/cache versions;
5. make the current Stage One workspace layout native in `admin.html`, one workspace at a time;
6. collapse overlapping Studio loader chains into one bootstrap owner;
7. retire `admin-import-tools.js` compatibility entrypoint;
8. split large modules along tested responsibility boundaries;
9. consolidate CSS without redesigning the UI;
10. preserve weekly/certification invariants after every step.

This document should be updated whenever a compatibility layer is added or retired so future cleanup can distinguish intentional temporary wiring from permanent architecture.
