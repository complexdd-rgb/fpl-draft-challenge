# FPL Draft Challenge — Architecture Map

Updated: 4 September 2026

This document records current runtime ownership and remaining Studio migration work. Temporary compatibility layers are called out explicitly so they are not mistaken for permanent architecture.

## 1. System boundaries

The repository has five main runtime areas:

1. **Live game** — public daily challenge, player search, scoring, results and leaderboard.
2. **Challenge Studio** — admin-only generation, prompt management, validation, database auditing and publishing.
3. **Prompt engine** — prompt families, generation, quality analysis, 4★+ enforcement, refinement and survivor targeting.
4. **Weekly engine** — seven-day generation, certified prompt snapshot, family quotas, exact rotation, nationality reservation and answer diversity.
5. **Historical data/certification** — player-season data, career context, field readiness and season certification.

Core rule: **Studio may build and analyse candidate material, but live generation and certification consume only repository-certified prompt/data state**.

---

## 2. Live game

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

`career-context.js` must load before `game-engine.js` whenever a live prompt depends on career-derived data.

---

## 3. Challenge Studio

Primary page: `admin.html`

The Studio has one central asset/version manifest, one top-level Studio bootstrap owner and a native workspace shell authored in `#studioNativeWorkspaceTemplate`.

Native workspaces:

- **Validation Lab** — `workspace-validation`.
- **Daily Challenge** — `workspace-challenge`, including settings, seven-day generation, XI review, Test Mode, download output and history.
- **Prompt Studio** — `workspace-prompts`, including Library, Create, Quality and Review/Promote views.

These workspaces no longer originate in the legacy long-form `<main>` or require title-based Stage One re-parenting.

```text
admin.html
→ asset-manifest.js
→ admin-stage-one.js
   ├─ native Daily Challenge
   ├─ native Prompt Studio
   ├─ native Validation Lab
   └─ re-parent remaining legacy workspaces
→ players.js
→ career-context.js
→ prompt-library.js
→ repository-certified-prompt-pool.js
→ validation-engine.js
→ admin-core.js
→ weekly/daily guards
→ admin-import-tools.js compatibility shim
   → studio-bootstrap.js
      ├─ Prompt Studio v2 controller
      ├─ Prompt Studio heavy-tool lazy loader
      ├─ certification/quality finishing chain
      ├─ Refinement Incubator
      └─ publishing support
```

Main modules:

- `config/asset-manifest.json` — authoritative Studio asset paths/cache versions.
- `js/studio-bootstrap.js` — single Studio feature/bootstrap owner.
- `js/admin-stage-one.js` — native shell activation and remaining legacy re-parenting.
- `js/prompt-studio-redesign.js` — Prompt Studio Library/Create/Quality/Review presentation and workflow controller.
- `js/prompt-library-canonical-state.js` — single visible Prompt Studio census and enabled/disabled policy.
- `js/repository-certified-prompt-pool.js` — immutable production membership boundary.
- `js/admin-core.js` — large multi-phase core; still a decomposition target.
- `js/admin-batch-calendar.js` — seven-day generator.
- `js/admin-daily-generator-guard.js` — certified-prompt generation snapshot/final guard.
- `js/admin-studio-finish.js` — preflight and all-season certification orchestration.
- `js/validation-engine.js` / `js/validation-lab.js` — validation behaviour.

Temporary shims:

- `js/admin-import-tools.js`
- `js/studio-feature-loader.js`

Retire them only when all supported callers have migrated.

---

## 4. Prompt Studio and quality ownership

Prompt Studio v2 is organised around four jobs rather than one long vertical tool stack:

```text
Library
→ browse/search canonical library
→ live prompts = enabled repository-certified prompts
→ working prompts = disabled until promoted or deleted

Create
→ manual safe rule builder
→ automatic/career generators
→ new candidates enter disabled review state

Quality
→ one full canonical-library analyser population
→ stale results hidden after membership changes
→ ratings / repair / bulk actions remain explicit

Review & Promote
→ disabled candidate queue
→ analyser evidence + issues + answer breadth
→ repository promotion gate
→ no self-promotion from browser state
```

Heavy prompt tooling remains lazy through `js/prompt-studio-loader.js`.

```text
studio-bootstrap
→ prompt-studio-redesign
→ prompt-studio-loader
   → admin-import-tools-base
   → survivor-target generator / auto-explorer
   → Career Shape modules

certification/quality finishing
→ approved baseline
→ refinement survivor pack
→ quality baseline finalizer
→ Prompt Quality Analyser
→ Quality Enforcement v2
→ repository-certified 4★+ pool
```

Current production membership is exactly **851 repository-certified prompts**. The working Studio library may contain additional candidates, but every non-production prompt is disabled until deliberately promoted or deleted.

The September Refinement Incubator audit is complete: **848 directly certified + 3 family/diversity rescued + 0 incubated + 0 rejected**, with two durable survivors replacing weak parents.

---

## 5. Weekly generation

```text
nationality pack readiness
→ repository-certified 851-prompt pool ready
→ immutable certified prompt snapshot
→ formation-aware selection
→ exactly one nationality prompt per day
→ family/mix quotas
→ exact rotation
→ family cooldown
→ answer/top-player diversity
→ perfect-XI validation
→ final certified-pool check
→ ZIP eligibility
```

Protected invariants:

- repository-certified Studio prompts only;
- immutable snapshot for each run;
- exactly one nationality prompt per generated day;
- safe exact rotation;
- family cooldown relaxes only where designed;
- certified-pool membership never relaxes;
- failed/partial seven-day runs cannot publish as valid packages.

---

## 6. All-season certification readiness gate

The in-page Regression Suite must not certify against the browser working library or a transient pre-enforcement library.

```text
Certify all seasons requested
→ load Prompt Studio quality tools if needed
→ wait for FPL_REPOSITORY_CERTIFIED_PROMPT_POOL
→ require exactly 851 prompt IDs
→ require unique IDs and 4★+ definitions
→ freeze FPL_VALIDATION_CERTIFICATION_PROMPT_POOL
→ certify every supported season against that snapshot
→ release snapshot after completion/cancellation
```

`js/validation-engine.js` prioritises the frozen certification snapshot only while it is active, then returns to its normal Studio inspection state.

This prevents both previously observed browser mismatches: certification against the transient **1,191-prompt** loading set and against larger Prompt Studio working libraries. Browser extras never become certification evidence merely by being present or enabled locally.

CI reconstructs the same repository-owned production pool, including the durable Refinement survivors and nine nationality-context prompts, and asserts **851 prompts before all 15 seasons are certified**.

---

## 7. Generated wiring

```text
config/asset-manifest.json
→ scripts/apply-all-season-certification-gate.mjs
→ scripts/build-studio-cache-tags.mjs
→ scripts/build-native-studio-shell.mjs
→ scripts/build-native-daily-workspace.mjs
→ scripts/build-native-prompt-workspace.mjs
→ scripts/build-studio-wiring.mjs
→ verification
```

The architecture build runs the chain twice; the second pass must be byte-identical.

Dedicated verifiers:

- `scripts/verify-native-validation-workspace.mjs`
- `scripts/verify-native-daily-workspace.mjs`
- `scripts/verify-native-prompt-workspace.mjs`
- `scripts/verify-all-season-certification-gate.mjs`

Canonical native markup:

- Daily Challenge: `fragments/admin-daily-workspace.html`
- Prompt Studio: `fragments/admin-prompt-workspace.html`

---

## 8. Cache/version ownership

`config/asset-manifest.json` is the source of truth.

Current Prompt Studio v2 slice:

- manifest/runtime: `1.5.0-prompt-studio-v2`
- Studio bootstrap: `1.1.0-prompt-redesign`
- Stage One: `1.5.0-native-prompts`
- Prompt Studio redesign: `2.0.0`
- repository-certified prompt pool: `1.1.0`
- canonical Prompt Studio state: `1.0.0`
- Validation Engine: `1.7.1-certification-snapshot`

Admin static cache tags, lazy module URLs, generated wiring and CI consume this manifest. Do not add competing version literals where the manifest can own them.

---

## 9. Current hotspots

Do not one-shot rewrite these:

- `js/admin-core.js`
- `js/admin-import-tools-base.js`
- `js/admin-batch-calendar.js`
- remaining legacy workspaces in `admin.html`
- accumulated Studio CSS layers

Migration pattern:

```text
canonical markup
→ native workspace
→ stable existing IDs
→ focused presentation/controller
→ remove legacy source copy
→ remove proven-redundant classifier/loader residue
→ dedicated verifier
→ protected regression suite
```

Remove only code proven redundant by migrated ownership or tests.

---

## 10. Target / cleanup order

1. Keep `main` green and preserve weekly/certification invariants.
2. Keep the central manifest and `studio-bootstrap.js` as single owners.
3. Finish and validate the **Prompt Studio v2** native redesign.
4. Migrate Database Health, then Leaderboard and Historical Imports.
5. Re-sweep Validation, Daily and Prompt Studio once all legacy re-parenting dependencies are gone.
6. Retire the two compatibility shims.
7. Split large modules along tested responsibility boundaries.
8. Consolidate accumulated CSS after dependency checks prove which older layers are redundant.
9. Resume survivor-library/new-family growth on the cleaner architecture.

Update this map when a compatibility layer is added/retired or a workspace becomes fully native.
