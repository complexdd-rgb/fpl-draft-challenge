# FPL Draft Challenge — Architecture Map

Updated: 18 September 2026

This map records the current runtime ownership after the Prompt Studio clean reset and the Studio relevance cleanup. Historical migration scripts are not runtime architecture.

## 1. Runtime boundaries

The repository has five active areas:

1. **Live game** — public Daily Challenge, answers, scoring, results and leaderboard.
2. **Challenge Studio** — admin generation, prompt management, validation, database audit and publishing.
3. **Clean Prompt Studio** — Factory → Quality → Promotion → durable saved family shards.
4. **Weekly engine** — seven-day generation from the saved promoted library.
5. **Historical data** — player-season database, field readiness and validation/certification tooling.

Candidate tools must never silently change production membership. Daily generation consumes only the explicitly versioned **4,959-prompt / 18-family curated authority** after its generation guard certifies the weekly reservoir. The larger promoted source/archive remains provenance and promotion input, not direct Daily production membership.

## 2. Live game

Primary page: `index.html`.

```text
challenge-manifest-bootstrap
→ daily-challenge-loader
→ challenge fallback/archive
→ players-live.js + career-context.js
→ game-engine.js
→ result/visual layers
→ leaderboard/account layers
```

Supabase is the live Daily schedule/source authority. Repository challenge files remain a static fallback path.

## 3. Challenge Studio

Primary page: `admin.html`.

```text
admin.html
→ asset-manifest.js
→ admin-stage-one.js
→ players.js + career-context.js
→ empty prompt-library.js initializer
→ repository-certified-prompt-pool.js (deferred production pool = 0)
→ validation-engine.js
→ admin-core.js
→ Daily batch/guard modules
→ studio-bootstrap.js
```

`studio-bootstrap.js` is the single Prompt Studio bootstrap owner. `admin.html` loads it directly; compatibility bootstraps and alternate Studio owners have been removed.

The Prompt workspace shell in `admin.html` is intentionally empty. `prompt-studio-clean-reset.js` owns and renders the current Prompt Studio DOM at runtime; the retired V2 static Prompt Manager markup is no longer shipped.

Native workspaces:

- `workspace-challenge` — Daily Challenge settings, seven-day generation, XI review, Test Mode and download output.
- `workspace-prompts` — clean Prompt Studio.
- `workspace-validation` — Validation Lab.

## 4. Clean Prompt Studio

```text
prompt-studio-clean-reset.js
→ prompt-factory-v1.js
→ prompt-quality-analyser-v1.js
→ prompt-promotion-v1.js
→ prompt-library-shards-v1.js
→ admin-daily-library-cutover-v1.js
```

The canonical repository `prompt-library.js` remains intentionally empty after the clean reset. Promoted Prompt Studio output is stored durably in IndexedDB as family shards. Factory candidates do not become Daily source material until they pass through Quality and Promotion and are saved.

The old V2/V3/V4 Prompt Studio runtimes, compatibility shims, prompt lazy-loader, career-overlap loader chain and V2 canonical-state layer are retired and physically absent. The obsolete V2 native-Prompt builder/verifier pair has also been removed; the clean Prompt Studio controller owns the current prompt workspace at runtime. The retired browser Prompt Library Manager phase has also been removed from `admin-core.js`, so it no longer restores or edits the shared prompt array before the clean controller starts.

## 5. Daily generation

Production baseline: **Generator v3.2.3**.

```text
frozen 4,959-prompt / 18-family curated authority
→ Daily cutover validation + curated authority cache
→ cheap evidence shortlist
→ bounded runtime certification
→ certified 77-prompt reservoir
→ alternate-reservoir retry when a valid 77 cannot be arranged
→ seven dated 11-prompt challenges
→ exact nationality / semantic / leader-day spacing policies
→ exact unique-player perfect-XI validation
→ final weekly certification
→ review + ZIP
→ explicit Supabase publish
```

Protected invariants:

- 7 days × 11 prompts;
- 77 unique prompt IDs in a successful week;
- exactly **7 nationality prompts per reservoir** and exactly one nationality prompt per day;
- all **18 curated prompt families** represented in every accepted reservoir;
- Exclude Top Result and anti-meta weekly floors preserved;
- formation totals remain exact;
- semantic clashes are guarded;
- same-day top-answer duplicates are forbidden;
- repeated top-answer leaders must respect a hard **3-day spacing rule**;
- two leader appearance days per player is preferred and three is the hard weekly maximum;
- the perfect XI uses 11 unique footballers;
- a failed/unarrangeable certified reservoir may be replaced by a bounded alternate certified reservoir;
- partial/failed weeks cannot publish as valid packages;
- publishing is future-only and never occurs merely because generation succeeded.

The production certification runner `js/admin-generator-production-certification-v1.js` is read-only. It runs the real generator across all seven supported formations, clears each shadow batch and cannot publish while the sweep is active. Generator v3.2.3 passed the 7/7 formation sweep on 18 September 2026.

### Browser rotation history

`admin-core.js` Phase 3 keeps a small browser history store only for cooldown/rotation state. Batch generation records completed generated days automatically through `FPL_STUDIO_PHASE3.recordBatchChallenges()` and reads recent prompt IDs through `getCooldownPromptIds()`.

There is no visible or hidden history-management DOM. The retired manual history buttons/cards were compatibility UI and have been removed.

## 6. Publishing and schedule ownership

- Supabase `daily_challenge_schedule` is the live schedule/source authority.
- Challenge identity is the release date: `daily-YYYY-MM-DD`.
- `admin-schedule-manager-v2.js` owns schedule management.
- `admin-daily-publish.js` owns explicit publishing.
- `challenges/manifest.js` is a static fallback file index, not the primary live schedule.

Publishing never occurs merely because a week was generated.

## 7. Certification boundary

**Daily generation is production-certified at Generator v3.2.3.** The permanent evidence record is:

- `reports/generator-v3-2-3-production-certification-2026-09-18.md`

The Daily certification sweep passed all seven supported formations against the 4,959-prompt / 18-family authority, including exact nationality, full family coverage, hard leader spacing and alternate-reservoir retry behaviour.

Full **all-season historical database certification** remains a separate deferred boundary. `repository-certified-prompt-pool.js` remains pinned to zero production prompts for that future all-season repository-wide certification path.

`validation-engine.js` still supports an explicit frozen `FPL_VALIDATION_CERTIFICATION_PROMPT_POOL` snapshot so a future all-season certification run can lock one deliberately supplied prompt set without reading mutable browser state mid-run.

Current CI protects both boundaries through the Generator production-certification, weekly snapshot/diversity and all-season certification guards.

## 8. Generated wiring

Authoritative asset versions live in `config/asset-manifest.json`.

```text
config/asset-manifest.json
→ scripts/build-asset-manifest-runtime.mjs
→ scripts/build-native-daily-workspace.mjs
→ scripts/build-studio-cache-tags.mjs
→ verification
```

The old native Studio shell migration builder/verifier have been removed. The shell is now settled in `admin.html`; only current generated wiring remains in this map.

Key verifiers include:

- `scripts/verify-prompt-studio-clean-reset.mjs`
- `scripts/verify-native-daily-workspace.mjs`
- `scripts/verify-native-validation-workspace.mjs`
- `scripts/verify-weekly-certified-snapshot-race.mjs`
- `scripts/verify-all-season-certification-gate.mjs`

## 9. Offline legacy analysis helpers

Some older generation/quality modules remain because diagnostic and refinement scripts still use them directly outside the live Studio runtime, particularly `js/admin-import-tools-base.js` and historical/refinement analysis helpers.

They are **not** Prompt Studio runtime owners. Offline diagnostic/refinement helpers are now loaded only by their direct analysis callers and are no longer advertised through the live asset manifest. Remove their source files only after those remaining diagnostics, audits and survivor-growth workflows have been migrated or retired.

## 10. Current execution order

1. Keep Generator v3.2.3 frozen unless a reproducible production regression is demonstrated.
2. Return to **Historical Database Completion**, starting with the advanced 2010/11 single-sheet master and its remaining import/certification blockers.
3. Continue through the unresolved historical-season frontier without re-harvesting already exhausted sources.
4. Build the historical starting-price model only after the canonical master index is substantially frozen.
5. Run true all-season production certification after historical database completion.

Offline cleanup may continue only when it is clearly isolated from the frozen production runtime and does not displace the active historical-data phase.

Update this document when a real runtime authority changes; do not keep historical migration architecture here.
