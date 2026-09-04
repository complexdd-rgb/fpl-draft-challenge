# FPL Draft Challenge — Architecture Map

Updated: 4 September 2026

This document describes the current repository architecture after the September Prompt Studio, Career Evolution, Quality Enforcement v2, Refinement Incubator and Studio architecture cleanup. It also records the remaining migration direction so temporary compatibility layers are not mistaken for permanent design.

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
- `js/leaderboard-config.js` — public leaderboard configuration. On live pages it also starts the deferred `js/live-feature-loader.js`; it no longer owns any Studio feature chain.
- `js/live-feature-loader.js` — non-critical live feature loading.

### Protected invariant

`career-context.js` must load before `game-engine.js` whenever a live prompt can depend on `_career`, `_careerShape` or `_careerEvolution` data.

---

## 3. Challenge Studio boot chain

Primary page: `admin.html`

The Studio has a central asset/version manifest and one runtime bootstrap owner. The navigation/topbar/workspace shell is authored in `admin.html` as `#studioNativeWorkspaceTemplate`; `js/admin-stage-one.js` clones that native shell and restores the selected workspace.

**Validation Lab is now the first complete workspace migrated into the native template.** Its real panel markup lives directly inside `workspace-validation`, so it no longer exists in the legacy long-form `<main>` or needs re-parenting at startup. Stage One applies the same shared panel metadata/collapse behaviour to native-authored panels before it moves the remaining legacy panels. The old JS shell constructors remain only as a cache-safe fallback during the migration.

Current high-level boot:

```text
admin.html
→ asset-manifest.js
→ admin-stage-one.js (native shell activation / workspace restore)
   ├─ activates native Validation Lab
   └─ re-parents remaining legacy workspace panels
→ players.js
→ career-context.js
→ prompt-library.js
→ validation-engine.js
→ admin-core.js
→ weekly/daily guard layers
→ admin-import-tools.js compatibility shim
   → studio-bootstrap.js
      ├─ Prompt Studio lazy loader
      ├─ certification/quality finishing chain
      ├─ Refinement Incubator
      └─ publishing support when configuration is ready
→ leaderboard-config.js
   └─ dispatches Studio configuration readiness; no separate Studio loader chain
```

### Main Studio modules

- `config/asset-manifest.json` — authoritative Studio asset paths and cache versions.
- `js/asset-manifest.js` — generated browser-safe runtime view of the central manifest.
- `js/studio-bootstrap.js` — single Studio runtime feature/bootstrap owner.
- `js/admin-core.js` — large multi-phase Studio core. Currently owns more responsibilities than one permanent module should.
- `js/admin-stage-one.js` — activates the native workspace shell, restores navigation/scroll state, applies shared behaviour to native panels and re-parents only the workspaces that have not yet migrated.
- `js/admin-batch-calendar.js` — seven-day challenge generator.
- `js/admin-daily-generator-guard.js` — certified-prompt-pool lock/snapshot and final generation guard.
- `js/admin-daily-publish.js` — publishing/download support.
- `js/validation-engine.js` and `js/validation-lab.js` — prompt/data validation. Validation Lab's UI markup is native in `admin.html`; its behaviour remains in `js/validation-lab.js`.

### Temporary compatibility layers

`js/admin-import-tools.js` remains only as a **legacy compatibility shim**. Normal execution delegates to `js/studio-bootstrap.js`; an old Prompt Studio loader URL is retained only as an emergency cache-safe fallback if the bootstrap itself cannot load.

`js/studio-feature-loader.js` is also retired as an architectural owner. It remains as a compatibility shim for stale cached callers and redirects them to `js/studio-bootstrap.js`.

Both files should disappear after the migration has proved stable and no supported caller needs them.

---

## 4. Prompt Studio loading and Studio bootstrap

`js/studio-bootstrap.js` is the single owner for Studio-only feature loading. Heavy prompt-generation tooling remains lazy through `js/prompt-studio-loader.js`.

Prompt Studio lazy chain:

```text
studio-bootstrap
→ prompt-studio-loader
   → admin-import-tools-base
      ├─ main automatic prompt generator
      ├─ Prompt Quality Analyser
      └─ browser-library persistence helpers
   → prompt-target-survivor-generator
   → prompt-target-auto-explorer
   → Career Shape rule/studio/repair/unified modules
```

Certification/quality finishing chain:

```text
studio-bootstrap
→ legacy prompt additions
→ career-shape-validation-bridge
→ prompt-era-range-wording
→ admin-studio-finish
→ career-overlap-wording
→ quality packs / analyser stars / 4★ enforcer
```

The **Refinement Incubator** is also loaded by `studio-bootstrap` and continues to wait for Quality Enforcement v2 before doing refinement work. `leaderboard-config.js` no longer carries a separate Incubator load path.

### Architectural rule

New Studio-only runtime dependencies should join `studio-bootstrap` or a clearly owned lazy sub-chain. Do not create another top-level loader that discovers the same modules independently.

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

## 8. Generated wiring and build scripts

The repository still contains historical `scripts/apply-*.mjs` and matching `verify-*.mjs` files. Those remain useful regression fixtures, but Studio architecture is moving to manifest-driven builders rather than accumulating another patch layer.

Current architecture builders:

```text
config/asset-manifest.json
→ scripts/build-studio-cache-tags.mjs
→ scripts/build-native-studio-shell.mjs
   └─ native Validation Lab workspace
→ scripts/build-studio-wiring.mjs
→ generated runtime files
→ verification
```

The `Studio Architecture Build` workflow runs the builders twice and compares hashes. A second pass must be byte-identical. Native workspace slices also receive dedicated structural verification; Validation Lab is checked by `scripts/verify-native-validation-workspace.mjs`.

Historical patch scripts that still touch cache or fast-boot wiring read the central manifest rather than owning competing version literals.

### Current rule

Every remaining patch/build script must be **repeat-safe**. Running the same generated-wiring sequence twice must not duplicate declarations, markup or script tags.

---

## 9. Cache/version ownership

Studio asset/cache versions are centralised in `config/asset-manifest.json`.

The manifest owns, among other things:

- runtime manifest version;
- Studio bootstrap version;
- Stage One/native-workspace version;
- compatibility entrypoint version;
- Prompt Studio lazy-loader/module versions;
- Studio leaderboard configuration version.

`js/asset-manifest.js`, Admin static cache tags, lazy module URLs, generated wiring and relevant CI verification consume this source of truth.

### Rule

Do not add a new Studio cache version literal to an unrelated patcher or verifier when the asset belongs in the central manifest. CI should prefer behavioural/order assertions and manifest lookups over frozen historical version strings.

---

## 10. Current module hotspots

These files deserve decomposition planning, but **not one-shot rewrites**:

- `js/admin-core.js` — very large multi-phase Studio core;
- `js/admin-import-tools-base.js` — generator, analyser, UI and persistence responsibilities are coupled;
- `js/admin-batch-calendar.js` — substantial weekly engine;
- `admin.html` — native shell and Validation Lab are now authored in the native template, while the remaining tool panels still originate in the legacy long-form sequence and are re-parented at startup;
- Studio CSS — multiple generations of base/overhaul/mobile/prompt-specific overrides.

### Safe extraction order

Continue moving one workspace at a time into its native `admin.html` section. Validation Lab proves the migration pattern: authored panel in the template → stable IDs → Stage One shared labelling → no legacy source copy → dedicated verifier. Keep fallback/re-parenting behaviour only for workspaces that have not yet migrated.

Extract low-risk pure/helper logic before changing generator/certification behaviour. Keep existing regression suites around every boundary.

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
│   ├── central asset manifest
│   ├── studio-bootstrap
│   ├── Daily Challenge workspace       (migration pending)
│   ├── Prompt Studio workspace         (migration pending)
│   ├── Database workspace              (migration pending)
│   ├── Validation workspace            (native)
│   └── publishing support
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
│   └── repeat-safe manifest-driven builders
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

Structural work should now continue in this order:

1. keep `main` green and preserve the weekly/certification invariants;
2. treat `config/asset-manifest.json` as the single Studio cache/version authority;
3. keep `studio-bootstrap.js` as the single top-level Studio feature owner;
4. continue migrating workspace content into native `admin.html` sections one workspace at a time — Validation Lab is complete;
5. retire the `admin-import-tools.js` and `studio-feature-loader.js` compatibility shims after supported callers no longer need them;
6. split large modules along tested responsibility boundaries;
7. consolidate CSS without redesigning the UI;
8. resume prompt-quality work — the 144-prompt Refinement Incubator audit and survivor-library growth — on top of the cleaner architecture.

This document should be updated whenever a compatibility layer is added, retired or fully migrated so future cleanup can distinguish intentional temporary wiring from permanent architecture.
