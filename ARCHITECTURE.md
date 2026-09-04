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

Core rule: **Studio may build and analyse candidate material, but live generation and certification must consume only certified prompt/data state**.

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

These panels no longer originate in the legacy long-form `<main>` or require Stage One re-parenting.

```text
admin.html
→ asset-manifest.js
→ admin-stage-one.js
   ├─ native Daily Challenge
   ├─ native Validation Lab
   └─ re-parent remaining legacy workspaces
→ players.js
→ career-context.js
→ prompt-library.js
→ validation-engine.js
→ admin-core.js
→ weekly/daily guards
→ admin-import-tools.js compatibility shim
   → studio-bootstrap.js
      ├─ Prompt Studio lazy loader
      ├─ certification/quality finishing chain
      ├─ Refinement Incubator
      └─ publishing support
```

Main modules:

- `config/asset-manifest.json` — authoritative Studio asset paths/cache versions.
- `js/studio-bootstrap.js` — single Studio feature/bootstrap owner.
- `js/admin-stage-one.js` — native shell activation and remaining legacy re-parenting.
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

## 4. Prompt loading and quality

Heavy prompt tooling remains lazy through `js/prompt-studio-loader.js`.

```text
studio-bootstrap
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
→ certified 4★+ library
```

The September Refinement Incubator audit is complete. The effective **851-prompt** library resolves to **848 directly certified + 3 family/diversity rescued + 0 incubated + 0 rejected**, with two durable survivors replacing weak parents.

---

## 5. Weekly generation

```text
nationality pack readiness
→ 4★+ certified library ready
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

- authoritative certified Studio prompts only;
- immutable snapshot for each run;
- exactly one nationality prompt per generated day;
- safe exact rotation;
- family cooldown relaxes only where designed;
- certified-pool membership never relaxes;
- failed/partial seven-day runs cannot publish as valid packages.

---

## 6. All-season certification readiness gate

The in-page Regression Suite must not certify against the transient pre-enforcement library.

```text
Certify all seasons requested
→ load Prompt Studio quality tools if needed
→ wait for FPL_FOUR_STAR_LIBRARY.ready
→ require live count === certified metadata count
→ require unique IDs
→ require every prompt at 4★+
→ freeze FPL_VALIDATION_CERTIFICATION_PROMPT_POOL
→ certify every supported season against that snapshot
→ release snapshot after completion/cancellation
```

`js/validation-engine.js` prioritises the frozen certification snapshot only while it is active, then returns to the live Studio library.

This fixes the race where browser certification could start against **1,191 loading prompts** while the authoritative final library was **851 prompts**. Results from the transient library do not match the final certified-library fingerprint and are treated as stale rather than current season evidence.

CI now mirrors this concept: `scripts/diagnose-approved-library-certification.mjs` certifies **every supported season** against the repository-owned approved 4★+ library plus durable refinement survivors. The older duplicate all-season harness was removed.

---

## 7. Generated wiring

```text
config/asset-manifest.json
→ scripts/apply-all-season-certification-gate.mjs
→ scripts/build-studio-cache-tags.mjs
→ scripts/build-native-studio-shell.mjs
→ scripts/build-native-daily-workspace.mjs
→ scripts/build-studio-wiring.mjs
→ verification
```

The architecture build runs the chain twice; the second pass must be byte-identical.

Dedicated verifiers:

- `scripts/verify-native-validation-workspace.mjs`
- `scripts/verify-native-daily-workspace.mjs`
- `scripts/verify-all-season-certification-gate.mjs`

Canonical Daily markup lives in `fragments/admin-daily-workspace.html`.

---

## 8. Cache/version ownership

`config/asset-manifest.json` is the source of truth.

Current certification-gate slice:

- manifest/runtime: `1.4.1-certification-gate`
- Validation Engine: `1.7.1-certification-snapshot`
- Studio finishing layer: `1.0.2-certification-gate`
- Stage One remains `1.4.0-native-daily`

Admin static cache tags, lazy module URLs, generated wiring and CI consume this manifest. Do not add competing version literals elsewhere.

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
→ shared Stage One behaviour
→ remove legacy source copy
→ dedicated verifier
→ protected regression suite
```

Remove only code proven redundant by migrated ownership or tests.

---

## 10. Target / cleanup order

1. Keep `main` green and preserve weekly/certification invariants.
2. Keep the central manifest and `studio-bootstrap.js` as single owners.
3. Migrate **Prompt Studio** next with the same native + dead-code sweep.
4. Migrate Database Health, then Leaderboard and Historical Imports.
5. Re-sweep Validation and Daily once all legacy re-parenting dependencies are gone.
6. Retire the two compatibility shims.
7. Split large modules along tested responsibility boundaries.
8. Consolidate CSS without redesigning the UI.
9. Resume survivor-library/new-family growth on the cleaner architecture.

Update this map when a compatibility layer is added/retired or a workspace becomes fully native.
