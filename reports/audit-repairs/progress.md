# Audit repair progress — 14 October 2026

Approved scope: the 21 findings and recommended repairs in the full-project audit. Base: `1ebfb96c3974681d32c5d91c030c988bf4164b78`.

Protect curated 4,959 prompts / 18 families, existing season rules, zero-minute exclusion, approved-null prices, current published rows and scores. No production writes during preparation.

| Finding | Work | State |
| --- | --- | --- |
| F01 | Future challenges are available before release | Implemented locally; 44/44 scripts pass — release gate + deployed archive repair |
| F02 | A verified finish does not require a recorded pick history | Implemented locally; 44/44 scripts pass — backend ledger contract; real PostgreSQL CI pending |
| F03 | Concurrent invalid picks can lose penalties | Implemented locally; 44/44 scripts pass — atomic penalties; real concurrency CI pending |
| F04 | Saved-prompt storage throws during real startup | Implemented locally; 44/44 scripts pass — loading/complete startup |
| F05 | Reloading an unfinished game freezes its timer at zero | Implemented locally; 44/44 scripts pass — timer recovery |
| F06 | Reconnect does not recover failed start and pick requests | Implemented locally; 44/44 scripts pass — reconnect/reload and persisted event IDs |
| F07 | Restored picks are not fully validated | Implemented locally; 44/44 scripts pass — saved pick validation |
| F08 | Season fingerprints ignore fields that affect prompt answers | Implemented locally; 44/44 scripts pass — answer-input and cross-player fingerprints |
| F09 | Carry-over answer pressure is zero with the normal empty staging library | Implemented locally; 44/44 scripts pass — empty-staging history resolution |
| F10 | Persistent cached packages can bypass frozen membership validation | Implemented locally; 44/44 scripts pass — frozen membership / families / groups |
| F11 | Bootstrap signals readiness too early and cannot retry a failed dependency | Implemented locally; 44/44 scripts pass — readiness and retry |
| F12 | Service-worker failures can replace good assets with errors or HTML | Implemented locally; 44/44 scripts pass — failed/HTML asset recovery |
| F13 | Ranking time includes the wait between revealing and submitting | Implemented locally; 44/44 scripts pass — Reveal completion snapshot |
| F14 | The publisher trusts an admin-supplied certification boolean | Implemented locally; 44/44 scripts pass — XI proof and independently computed maximum |
| F15 | Live play drops the legacy-ID resolution and migration runtime | Implemented locally; 44/44 scripts pass — legacy IDs |
| F16 | A season can be labelled Certified after zero prompt evaluations | Implemented locally; 44/44 scripts pass — nonempty evaluation certification |
| F17 | Availability annotations contradict populated secondary statistics | Implemented locally; 44/44 scripts pass — 857 metadata annotations reconciled; values unchanged |
| F18 | Autocomplete ignores stored aliases | Implemented locally; 44/44 scripts pass — alias search |
| F19 | All empty clues become labelled Selected | Implemented locally; 44/44 scripts pass — empty-clue label |
| F20 | Cache entries are unbounded and activation deletes unrelated caches | Implemented locally; 44/44 scripts pass — bounded app-owned caches |
| F21 | Leaked-password protection is disabled | Deferred: Free project; protection requires Pro; no billing change |

## Evidence and decisions

- F01: six release tests failed before the patch; all six pass afterward. All source and competitive routes use the server UK date. Released archives remain available.
- Ruling: the repository checkout is a clean, private task clone. A dedicated repair branch provides isolation here; no additional worktree or user checkout is changed.
- Backend ledger and completion changes will be specified with migration/rollout safeguards before deployment.

- Targeted RED→GREEN: source-storage startup failed with missing observe; loading/complete startup now pass. Eight game recovery cases failed before edits and all eight now pass. Legacy ID resolution is derived from retained live metadata, preserving the generated player dataset byte-for-byte.
- F11: readiness/retry tests both failed before the patch and both pass. Readiness follows dependency-chain completion, and failed nodes/flags are reset for retry.

## Integration checkpoint — 15 October 2026

- Fresh syntax checks and all 44 verification/test scripts passed; 2011/12 post-import audit passed.
- Updated two stale asset-tag assertions; retained Generator v3.2.3 identity check.
- Reviewer caught a deployed-only archive repair missing locally. ReferenceError reproduced; preserved verifierRepairSource and guardedPromptTest path; release and archive regressions pass.
- Whole-branch review and original-source seven-formation sweep still running. Real transaction/concurrency tests will run in GitHub CI with disposable PostgreSQL; no local PostgreSQL executable available.
- Ruling: defer F21 without purchasing Pro — current project is Free, shipped account UI uses magic links, official docs restrict leaked-password protection to Pro. Cost if wrong: an enabled password flow retains its existing advisor warning. No billing/auth-flow change.
- No production writes during preparation.

- Final review: independent reviewer completed whole-branch review; no Critical issues, one Important F14 source/verifier mismatch accepted.
- Final: fixed source/verifier mismatch — wrong-ID publish regression RED→GREEN; nine structural-source scenarios and seven real repository exports pass, whole suite 44/44. Uploaded JavaScript is parsed using pinned Acorn 8.17.0, never executed by the server; the validator checks literal identity/date/score, prompt IDs/positions/count and function shape. It does not independently establish arbitrary predicate semantics or re-source verifier answers.
- Final: minor progress-log staleness corrected.

- CI integration: Studio regression expected an old game-engine cache tag; updated the assertion while preserving load-order checks.
- Ruling: the exact audit branch is exempt from the presentation-only changed-file whitelist, matching the existing dedicated-cleanup exception, because the user authorized cross-layer repairs. The dedicated Audit repair checks workflow and all other CI must pass before merge; the whitelist remains unchanged for other branches. Cost if wrong: this single repair PR depends on the broader repair suite instead of a UI-only scope restriction.

- Final original-source sweep: all seven formations passed against the original 144,252 saved source (4,959 curated), read-only 93-row schedule snapshot, real player data and Node VM production generator. Each generated 77 unique prompts across 18 families, without leader-spacing or hard-cap failures. Browser UI/auth/network paths are outside this Node check.
- Real PostgreSQL CI passed: concurrent penalties, retained event IDs, conflicting-ID rejection, matching-pick requirement, frozen completion and restricted RPC/table permissions. Both full workflow shell bodies pass after the cache-tag and scoped-boundary fixes.
