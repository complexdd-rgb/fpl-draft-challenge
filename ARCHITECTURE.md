# FPL Draft Challenge — Architecture Map

Updated: 4 September 2026

This document records current runtime ownership and remaining Studio migration work. Temporary compatibility layers are called out explicitly so they are not mistaken for permanent architecture.

## 1. System boundaries

The repository has five main runtime areas:

1. **Live game** — public daily challenge, player search, scoring, results and leaderboard.
2. **Challenge Studio** — admin-only generation, prompt management, validation, database auditing and publishing.
3. **Prompt engine** — prompt families, generation, quality analysis and prompt review.
4. **Weekly engine** — seven-day generation, certified prompt snapshot, family quotas, exact rotation, nationality reservation and answer diversity.
5. **Historical data/certification** — player-season data, career context, field readiness and season certification.

Core rule: **candidate-building tools must never silently change production prompt membership. Live generation and certification consume only explicit repository-certified state.**

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
- **Prompt Studio** — `workspace-prompts`.

Prompt Studio is now in a deliberate transition:

- the old V2 runtime remains available only to protect the existing live/certification pipeline;
- the human-facing Prompt Studio is being rebuilt as **V3 clean-room state starting from zero prompts**;
- V3 never mutates the legacy production library.

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
      ├─ Prompt Studio V2 compatibility controller
      ├─ Prompt Studio V3 clean-room controller
      ├─ V3 family registry
      ├─ V3 safe rule builder + database tester
      ├─ V3 advisory quality evidence
      ├─ Prompt Studio heavy-tool lazy loader
      ├─ legacy production certification/quality chain
      ├─ legacy Refinement Incubator
      └─ publishing support
```

Main modules:

- `config/asset-manifest.json` — authoritative Studio asset paths/cache versions.
- `js/studio-bootstrap.js` — single Studio feature/bootstrap owner.
- `js/admin-stage-one.js` — native shell activation and remaining legacy re-parenting.
- `js/prompt-studio-v3-clean-room.js` — isolated V3 Draft/Test/Quality/Review workflow.
- `js/prompt-family-registry-v3.js` — V3 family catalogue and coverage source.
- `js/prompt-studio-v3-rule-tester.js` — parser-safe structured rule builder and real player-database Test evidence.
- `js/prompt-studio-v3-quality-advisor.js` — advisory answer breadth, concentration, V3 overlap and family-coverage evidence; never a review authority.
- `js/prompt-studio-redesign.js` — V2 compatibility presentation while the old production pipeline still exists.
- `js/prompt-library-canonical-state.js` — V2 visible census/enabled policy; not V3 authority.
- `js/repository-certified-prompt-pool.js` — existing production membership boundary.
- `js/admin-core.js` — large multi-phase core; still a decomposition target.
- `js/admin-batch-calendar.js` — seven-day generator.
- `js/admin-daily-generator-guard.js` — production-certified prompt generation snapshot/final guard.
- `js/admin-studio-finish.js` — preflight and all-season certification orchestration.
- `js/validation-engine.js` / `js/validation-lab.js` — validation behaviour.

Temporary shims:

- `js/admin-import-tools.js`
- `js/studio-feature-loader.js`

Retire them only when all supported callers have migrated.

---

## 4. Prompt Studio V3 clean-room model

V3 deliberately starts with **zero prompts** and owns a separate browser state key:

`fplPromptStudioV3CleanRoom`

The existing 851-prompt production library remains frozen and continues to power the public game and certification until an explicit future V3 cutover.

### V3 lifecycle

```text
Draft
→ real database Test
→ advisory Quality evidence
→ Human quality review
→ Review
→ Human approval for future V3
→ explicit repository cutover later
```

Important distinction: **V3 approval is not the same as production enablement.** During the clean-room build every V3 prompt remains production-disabled, including approved prompts.

### V3 work areas

```text
Library
→ one isolated V3 list
→ starts at 0
→ total = disabled during the clean-room phase

Create
→ safe structured rule builder for parser-supported rules
→ generated wording must parse back to exactly the chosen rule fields
→ manual wording remains a fallback for families not covered yet
→ choose family + position + difficulty
→ always saves disabled

Test
→ executes the shared Validation Engine against the loaded FPL_PLAYERS database
→ calculates unique valid players, season breadth, club breadth, runtime errors and zero-minute violations
→ technical PASS requires safe mapping, at least one answer, zero runtime errors and zero accepted zero-minute records
→ technical evidence cannot rate or approve a prompt

Quality
→ automated evidence is advisory only
→ calculates answer breadth and concentration signals
→ calculates traditional-Big-Six concentration as an obviousness signal
→ compares answer-set overlap only against compatible technically-passing V3 peers
→ reports V3 family coverage and nearest overlaps
→ human may explicitly copy overlap/obviousness evidence into the review form
→ human still chooses quality rating and review decision
→ difficulty remains a separate property

Review
→ explicit human decision
→ approve / keep for refinement / delete
→ no automatic production promotion

Families
→ coverage across the V3 family registry
→ growth is driven by missing/weak families, not an arbitrary total
```

### No automatic Quality Enforcement in V3

The legacy production pipeline still contains `prompt-four-star-enforcer.js` and related Quality Enforcement v2 logic because the frozen 851-prompt library currently depends on it. **V3 does not consume those decisions.**

V3 must not automatically:

- change a star rating;
- rescue a 3★ prompt to 4★;
- apply a family-diversity bonus to promotion;
- enable a prompt;
- disable a prompt because of subjective quality;
- delete a prompt;
- approve a prompt.

Automated tools may provide evidence and suggestions. Only explicit human review changes V3 review status.

Technical impossibilities such as a broken rule/runtime failure may block approval, but they still do not silently delete material.

### V3 advisory-quality boundary

`js/prompt-studio-v3-quality-advisor.js` owns a separate evidence key:

`fplPromptStudioV3QualityAdvisoryEvidence`

Its outputs are deliberately non-authoritative. It may calculate:

- answer-pool breadth;
- season and club concentration;
- traditional Big Six share;
- obviousness-risk signals;
- highest overlap against compatible technically-passing V3 prompts;
- same-family V3 coverage.

Overlap uses the established smaller-answer-set convention: common valid player IDs divided by the smaller answer set. This makes near-subset prompts visible as high overlap rather than hiding them behind a low union/Jaccard score.

The advisor may populate a human form field only after an explicit **Copy** click. It must never write `qualityReview`, a star rating, a review decision, lifecycle status or production state itself.

### V3 family registry

The initial registry contains **33 families**, including core families and new priority areas:

- season stats;
- combined stats;
- exact values/bands;
- club + stat;
- position + stat;
- nationality + stat;
- league position;
- promoted clubs;
- relegated clubs;
- champions;
- career totals;
- career longevity;
- club journey;
- Premier League club count;
- return journey;
- career consistency;
- career peak;
- rise/fall;
- comeback;
- one-club career;
- one-season wonder;
- era crossover;
- manager relationship;
- manager journey;
- teammate relationship;
- name/identity;
- anti-meta;
- starting-price value;
- premium disappointment;
- minutes/role;
- cross-season achievement;
- club-status journey;
- composite/story prompts.

The family count is not a target by itself. V3 should favour genuinely different answer pools, recognisable football stories and coverage across eras/positions/clubs over raw prompt volume.

---

## 5. Frozen legacy production prompt pipeline

Until V3 is deliberately cut over, the current public pipeline remains unchanged.

Current production membership is exactly **851 repository-certified prompts**. The existing production reconstruction includes the approved baseline, quality packs, durable survivors and nationality-context prompts.

```text
legacy approved/quality sources
→ legacy quality/refinement chain
→ repository-certified 851-prompt pool
→ immutable generation/certification snapshot
```

The September Refinement Incubator audit remains historical evidence for that frozen production pool: **848 directly certified + 3 family/diversity rescued**, with two durable survivors replacing weak parents.

This legacy automatic enforcement must not be copied into V3.

---

## 6. Weekly generation

```text
nationality pack readiness
→ repository-certified 851-prompt legacy pool ready
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

Protected invariants during the V3 rebuild:

- V3 prompts cannot leak into production generation;
- repository-certified legacy prompts only;
- immutable snapshot for each run;
- exactly one nationality prompt per generated day;
- safe exact rotation;
- family cooldown relaxes only where designed;
- certified-pool membership never relaxes;
- failed/partial seven-day runs cannot publish as valid packages.

---

## 7. All-season certification readiness gate

The in-page Regression Suite must not certify against V3 drafts, browser working prompts or transient loading sets.

```text
Certify all seasons requested
→ wait for FPL_REPOSITORY_CERTIFIED_PROMPT_POOL
→ require exactly 851 legacy production prompt IDs
→ require unique IDs and valid 4★+ definitions
→ freeze FPL_VALIDATION_CERTIFICATION_PROMPT_POOL
→ certify every supported season against that snapshot
→ release snapshot after completion/cancellation
```

V3 will get its own candidate-certification workflow later, before any production cutover. That future candidate certification must remain read-only with respect to V3 approval state.

---

## 8. Generated wiring and verification

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

The architecture build runs the generated chain twice; the second pass must be byte-identical.

Dedicated verifiers include:

- `scripts/verify-native-validation-workspace.mjs`
- `scripts/verify-native-daily-workspace.mjs`
- `scripts/verify-native-prompt-workspace.mjs`
- `scripts/verify-prompt-studio-v3.mjs`
- `scripts/verify-all-season-certification-gate.mjs`

The V3 verifier explicitly proves zero-start isolation, disabled-by-default drafts, parser-safe structured rule mapping, real database Test evidence, advisory-only quality evidence, human quality review, non-live approval and the absence of automatic V3 promotion/removal logic.

---

## 9. Cache/version ownership

`config/asset-manifest.json` is the source of truth.

Current V3 quality slice:

- manifest/runtime: `1.8.0-prompt-studio-v3-quality`
- Studio bootstrap: `1.4.0-prompt-studio-v3-quality`
- Prompt Studio V3: `3.0.0`
- Prompt family registry V3: `3.0.0`
- V3 safe rule builder/database tester: `3.1.1`
- V3 advisory quality evidence: `3.2.0`
- Stage One: `1.5.0-native-prompts`
- legacy Prompt Studio redesign: `2.0.0`
- legacy repository-certified prompt pool: `1.1.0`
- Validation Engine: `1.7.1-certification-snapshot`

Do not add competing version literals where the manifest can own them.

---

## 10. Current hotspots and next order

Do not one-shot rewrite these:

- `js/admin-core.js`
- `js/admin-import-tools-base.js`
- `js/admin-batch-calendar.js`
- the legacy V2 prompt-generation/quality chain while it is still production-critical;
- remaining legacy workspaces in `admin.html`;
- accumulated Studio CSS layers.

Prompt Studio V3 progress/order:

1. **Complete** — keep the 851-prompt legacy production pool frozen and green.
2. **Complete** — establish V3 clean-room storage/UI/family coverage at zero prompts.
3. **Complete** — wire the safe rule builder and real validation engine into V3 Test without importing the old working library.
4. **Complete** — build advisory Quality evidence with no automatic state mutation.
5. **Next** — add deliberate candidate generation by family/target answer-pool size; generated material enters Draft only and must pass the same Test/Quality lifecycle.
6. Build V3 candidate all-season certification that reports evidence without approving prompts.
7. Grow an initial high-quality V3 set using Family Coverage rather than a fixed prompt-count target.
8. Simulate seven-day calendars against approved V3 candidates.
9. Design and separately approve the eventual production cutover.
10. Only after cutover, retire/archive the old automatic quality/refinement chain.

Update this map whenever V3 gains a new authority boundary or a legacy production dependency is retired.
