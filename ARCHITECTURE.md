# FPL Draft Challenge — Architecture Map

Updated: 4 September 2026

This document records the current runtime ownership and the remaining Studio migration work. Temporary compatibility layers are called out explicitly so they are not mistaken for permanent architecture.

## 1. System boundaries

The repository has five main runtime areas:

1. **Live game** — public daily challenge, player search, scoring, results and leaderboard.
2. **Challenge Studio** — admin-only generation, prompt management, validation, database auditing and publishing.
3. **Prompt engine** — prompt families, generation, quality analysis, 4★+ enforcement, refinement and survivor targeting.
4. **Weekly engine** — seven-day generation, certified prompt snapshot, family quotas, exact rotation, nationality reservation and answer diversity.
5. **Historical data/certification** — player-season data, career context, field readiness and season certification.

The key architectural rule is unchanged: **Studio may build and analyse candidate material, but the live Daily Challenge and certification workflows must consume only certified prompt/data state**.

---

## 2. Live game boot chain

Primary page: `index.html`

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

Key ownership:

- `players-live.js` — live player-season database.
- `js/career-context.js` — shared cross-season/career facts.
- `js/game-engine.js` — core gameplay, scoring and reveal behaviour.
- `js/leaderboard-config.js` — public leaderboard configuration and deferred live feature start.
- `js/live-feature-loader.js` — non-critical live feature loading.

Protected invariant: `career-context.js` must load before `game-engine.js` whenever a live prompt depends on `_career`, `_careerShape` or `_careerEvolution`.

---

## 3. Challenge Studio boot chain

Primary page: `admin.html`

The Studio now has a central asset/version manifest, one top-level Studio bootstrap owner and a native workspace shell authored in `#studioNativeWorkspaceTemplate`.

Two complete workspaces are native:

- **Validation Lab** — native in `workspace-validation`.
- **Daily Challenge** — native in `workspace-challenge`, including Challenge settings, seven-day generation, XI review, Test Mode, download output and challenge history.

Neither workspace is sourced from the legacy long-form `<main>` or re-parented at startup. Stage One applies shared panel labelling/collapse behaviour directly to native panels, then re-parents only the workspaces that have not yet migrated.

```text
admin.html
→ asset-manifest.js
→ admin-stage-one.js
   ├─ activates native Daily Challenge
   ├─ activates native Validation Lab
   └─ re-parents remaining legacy workspaces
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
      └─ publishing support
→ leaderboard-config.js
   └─ dispatches Studio configuration readiness
```

Main Studio modules:

- `config/asset-manifest.json` — authoritative Studio asset paths/cache versions.
- `js/asset-manifest.js` — generated browser-safe manifest runtime.
- `js/studio-bootstrap.js` — single Studio runtime feature/bootstrap owner.
- `js/admin-stage-one.js` — native shell activation, navigation/scroll state and remaining legacy re-parenting.
- `js/admin-core.js` — large multi-phase Studio core; still a decomposition target.
- `js/admin-batch-calendar.js` — seven-day challenge generator.
- `js/admin-daily-generator-guard.js` — certified-prompt snapshot/final generation guard.
- `js/admin-daily-publish.js` — publishing/download support.
- `js/admin-studio-finish.js` — Studio preflight and all-season certification orchestration.
- `js/validation-engine.js` / `js/validation-lab.js` — validation behaviour.

### Temporary compatibility layers

`js/admin-import-tools.js` remains a legacy compatibility shim that normally delegates to `js/studio-bootstrap.js`.

`js/studio-feature-loader.js` is also a compatibility shim for stale cached callers and redirects them to `js/studio-bootstrap.js`.

Retire both only after all supported callers no longer need them.

---

## 4. Prompt Studio loading

`js/studio-bootstrap.js` owns Studio-only feature loading. Heavy prompt-generation tooling remains lazy through `js/prompt-studio-loader.js`.

```text
studio-bootstrap
→ prompt-studio-loader
   → admin-import-tools-base
      ├─ main automatic prompt generator
      ├─ Prompt Quality Analyser
      └─ browser-library persistence helpers
   → prompt-target-survivor-generator
   → prompt-target-auto-explorer
   → Career Shape modules
```

Certification/quality finishing:

```text
studio-bootstrap
→ legacy prompt additions
→ career-shape-validation-bridge
→ prompt-era-range-wording
→ admin-studio-finish
→ career-overlap-wording
→ quality packs / approved baseline / survivor pack / analyser stars / 4★ enforcer
```

New Studio-only dependencies should join `studio-bootstrap` or a clearly owned lazy sub-chain. Do not create another top-level loader for the same modules.

---

## 5. Prompt generation and quality

```text
family providers
→ main automatic generator
→ answer-count / difficulty / duplicate / near-pool checks
→ checked browser-library batch
→ Prompt Quality Analyser
→ Quality Enforcement v2
   ├─ 4★ / 5★ certified
   ├─ borderline 3★ family/diversity rescue
   ├─ promising 3★ refinement
   └─ broken/unsafe rejection
→ survivor-target runner / auto-explorer
→ certified prompt library
```

Integrated providers include normal automatic families, Quality Families, Nationality Family and Career Evolution families.

The September Refinement Incubator audit is complete. The effective 851-prompt library now resolves to **848 directly certified + 3 family/diversity rescued + 0 incubated + 0 rejected**, with two durable certified survivors replacing their weak parents.

The live Daily Challenge remains **4★+ only**. Refinement may preserve/mutate promising ideas, but nothing becomes live unless normal enforcement certifies it.

---

## 6. Weekly generation pipeline

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

Protected invariants:

- only the authoritative certified Studio library may supply prompts;
- the generation snapshot is immutable for the run;
- exactly one nationality prompt is required per generated day;
- exact-prompt rotation must remain safe as the library grows;
- family cooldown may relax only where designed;
- certified-pool membership may not relax;
- failed/partial seven-day runs must not publish as valid packages.

The native Daily migration changes UI ownership only. It does not alter this selection/certification pipeline.

---

## 7. Historical data and all-season certification

Historical player-season data lives primarily in `players.js` / `players-live.js`.

`js/career-context.js` is the shared derivation layer for multi-season facts so Studio-generated career rules evaluate identically in live play.

Field-readiness/certification logic should disable only affected historical prompt families when FPL-native data is missing rather than invalidate otherwise usable seasons.

### Certified prompt readiness gate

All-season certification must not start against the transient pre-enforcement Studio library. The browser flow now follows the same safety principle as seven-day generation:

```text
Certify all seasons requested
→ request/load Prompt Studio quality tools if needed
→ wait for FPL_FOUR_STAR_LIBRARY.ready
→ require live library size === certified metadata total
→ require unique prompt IDs
→ require every prompt at 4★+
→ freeze FPL_VALIDATION_CERTIFICATION_PROMPT_POOL
→ certify every supported season against that immutable snapshot
→ release snapshot when the run finishes or is cancelled
```

`js/validation-engine.js` gives `FPL_VALIDATION_CERTIFICATION_PROMPT_POOL` precedence only while that snapshot is active. Normal Validation Lab operations fall back to the live Studio library afterwards.

This prevents a loading race where the in-page Regression Suite could previously start while the larger pre-enforcement prompt population was still present. Certification fingerprints and cached results are therefore derived from the final certified prompt state rather than a transient loader state. Old browser results produced from the transient library no longer match the final certified-library fingerprint and are treated as stale rather than current evidence about a season.

CI mirrors the same policy: `scripts/diagnose-approved-library-certification.mjs` now certifies every supported season against the repository-owned approved 4★+ library plus durable refinement survivors. The older duplicate all-season harness has been removed.

---

## 8. Generated wiring and native workspace builders

Studio architecture uses repeat-safe builders rather than ad-hoc duplicated loader/version patches.

```text
config/asset-manifest.json
→ scripts/apply-all-season-certification-gate.mjs
   └─ browser readiness gate + frozen validation snapshot support
→ scripts/build-studio-cache-tags.mjs
→ scripts/build-native-studio-shell.mjs
   └─ native shell + Validation workspace
→ scripts/build-native-daily-workspace.mjs
   └─ native Daily workspace + canonical Daily fragment
→ scripts/build-studio-wiring.mjs
→ generated runtime files
→ verification
```

Canonical Daily markup is retained in `fragments/admin-daily-workspace.html` so the shell builder can be rerun safely while Daily remains a separately owned migration slice.

The `Studio Architecture Build` workflow runs the full builder chain twice and compares hashes. The second pass must be byte-identical.

Dedicated structural/behavioural verifiers:

- `scripts/verify-native-validation-workspace.mjs`
- `scripts/verify-native-daily-workspace.mjs`
- `scripts/verify-all-season-certification-gate.mjs`

Every remaining patch/build script must stay repeat-safe.

---

## 9. Cache/version ownership

Studio asset/cache versions are centralised in `config/asset-manifest.json`.

The certification-gate slice is versioned as manifest `1.4.1-certification-gate`; the manifest owns the Validation Engine cache tag (`1.7.1-certification-snapshot`) and Studio finishing-layer tag (`1.0.2-certification-gate`) alongside the existing bootstrap, Stage One, compatibility, Prompt Studio and leaderboard assets.

`js/asset-manifest.js`, Admin static cache tags, lazy module URLs, generated wiring and CI consume this source of truth.

Do not add a competing Studio cache-version literal to an unrelated patcher or verifier.

---

## 10. Current module hotspots

These deserve decomposition, but not one-shot rewrites:

- `js/admin-core.js` — large multi-phase Studio core.
- `js/admin-import-tools-base.js` — generator, analyser, UI and persistence responsibilities are coupled.
- `js/admin-batch-calendar.js` — substantial weekly engine; behaviour is heavily protected by generation regressions.
- `admin.html` — native Daily + Validation are complete; Prompt Studio, Database Health, Leaderboard and Historical Imports still originate from the legacy source area.
- Studio CSS — multiple generations of base/overhaul/mobile/prompt-specific overrides.

Safe migration pattern:

```text
canonical workspace markup
→ native template section
→ stable existing IDs
→ Stage One shared labelling
→ no legacy source copy
→ dedicated structural verifier
→ protected behaviour regressions
```

Cleanup should remove only code proven redundant by the migrated ownership or existing tests. Pure/helper extraction comes before generator/certification changes.

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
│   ├── Daily Challenge workspace       (native)
│   ├── Prompt Studio workspace         (migration pending)
│   ├── Database workspace              (migration pending)
│   ├── Validation workspace            (native)
│   ├── Leaderboard workspace           (migration pending)
│   ├── Historical Imports workspace    (migration pending)
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
├── Historical Data / Certification
│   ├── player-season data
│   ├── nationality / identity
│   ├── career derivations
│   ├── field readiness
│   └── frozen certified-prompt snapshot
│
├── Build / Wiring
│   └── repeat-safe manifest-driven builders
│
└── CI
    ├── syntax/static checks
    ├── prompt-engine behaviour
    ├── weekly-generation behaviour
    ├── approved-library all-season certification
    └── Studio architecture/regression checks
```

---

## 12. Cleanup order

1. Keep `main` green and preserve weekly/certification invariants.
2. Keep `config/asset-manifest.json` as the single Studio cache/version authority.
3. Keep `studio-bootstrap.js` as the single top-level Studio feature owner.
4. Migrate **Prompt Studio** into its native workspace next, with the same code/dead-line sweep used for Daily.
5. Migrate Database Health, then Leaderboard and Historical Imports.
6. Re-sweep Validation and Daily after all legacy re-parenting dependencies are gone.
7. Retire `admin-import-tools.js` and `studio-feature-loader.js` once supported callers no longer need them.
8. Split large modules along tested responsibility boundaries.
9. Consolidate CSS without redesigning the UI.
10. Resume survivor-library growth/new prompt-family work on top of the clean architecture when structural migration is far enough along.

Update this document whenever a compatibility layer is added, retired or a workspace becomes fully native.
