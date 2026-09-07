# FPL Draft Challenge — Architecture Map

Updated: 7 September 2026

This map records the current runtime ownership after the Prompt Studio clean reset and the Studio relevance cleanup. Historical migration scripts are not runtime architecture.

## 1. Runtime boundaries

The repository has five active areas:

1. **Live game** — public Daily Challenge, answers, scoring, results and leaderboard.
2. **Challenge Studio** — admin generation, prompt management, validation, database audit and publishing.
3. **Clean Prompt Studio** — Factory → Quality → Promotion → durable saved family shards.
4. **Weekly engine** — seven-day generation from the saved promoted library.
5. **Historical data** — player-season database, field readiness and validation/certification tooling.

Candidate tools must never silently change production membership. Daily generation consumes only the explicitly saved promoted family-shard snapshot after its generation guard certifies the weekly reservoir.

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

```text
saved promoted 17-family snapshot
→ Daily library cutover validation
→ weekly generation guard
→ immutable 77-prompt reservoir
→ seven dated 11-prompt challenges
→ nationality / semantic / leader-day spacing policies
→ exact unique-player perfect-XI validation
→ review + ZIP
→ explicit Supabase publish
```

Protected invariants:

- 7 days × 11 prompts;
- 77 unique prompt IDs in a successful week;
- exactly one nationality prompt per day;
- all required prompt families represented;
- formation totals remain exact;
- semantic clashes are guarded;
- same top-answer player may lead multiple prompts on one day, but cross-day repeats target a three-day gap;
- two leader appearance days per player is preferred and three is the hard weekly maximum;
- the perfect XI uses unique footballers;
- partial/failed weeks cannot publish as valid packages.

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

Full repository all-season prompt certification remains deliberately deferred after the clean reset. `repository-certified-prompt-pool.js` is pinned to zero production prompts.

`validation-engine.js` still supports an explicit frozen `FPL_VALIDATION_CERTIFICATION_PROMPT_POOL` snapshot so a future certification run can lock one deliberately supplied prompt set without reading mutable browser state mid-run.

Current CI protects this state through `scripts/verify-all-season-certification-gate.mjs`. Daily generation is separate: it uses the saved promoted library only after the 77-prompt weekly reservoir passes structural, runtime and semantic checks.

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

They are **not** Prompt Studio runtime owners and retired refinement artifacts are no longer advertised through the live asset manifest. Remove direct-file analysis helpers only after their remaining diagnostics, audits and survivor-growth workflows have been migrated or retired.

## 10. Remaining cleanup order

1. Continue auditing the remaining `js/admin-core.js` phases and remove only controllers with no surviving runtime caller.
2. Audit offline legacy quality/generator helpers and their remaining diagnostic callers.
3. Continue removing demonstrably dead migration/static residue without disturbing the clean runtime.
4. Continue the Daily Challenge UI redesign on top of the now-clean runtime architecture.
5. Return to Prompt Factory/Quality/Promotion survivor-library growth.

Update this document when a real runtime authority changes; do not keep historical migration architecture here.
