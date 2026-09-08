# FPL Draft Challenge — Prompt Family Onboarding

Status: permanent post-curation workflow

The live Daily generator is currently pinned to the frozen **4,897-prompt / 17-family** curated selector package. Adding or experimenting with a new prompt family must never alter that authority implicitly.

## Permanent workflow

1. **Define the family in Prompt Factory.**
   - Add the family metadata to `FAMILY_DEFS` in `js/prompt-factory-v1.js`.
   - Add the family generation branch in `generateFamily()` using the existing condition schema and stable IDs.
   - Reuse common field/threshold helpers where possible rather than adding a parallel generator.

2. **Extend the Factory verifier.**
   - Update `scripts/verify-prompt-factory-v1.mjs` so the new family is generated and evaluated on a deterministic fixture.
   - The family must respect positive-minute eligibility, null safety and current position semantics.

3. **Generate candidates in Prompt Studio.**
   - Use Prompt Builder / Factory to explore the new family.
   - Candidate generation is staging only and does not change Daily.

4. **Run the Quality Analyser.**
   - Reject broken rules, duplicates, weak coverage and low-value threshold churn before promotion.
   - Quality pass is required before source promotion but is not by itself permission to enter Daily.

5. **Promote approved source material.**
   - Use the existing Promotion + durable source-shard path.
   - The promoted shard snapshot is provenance/source material. Do not overwrite the frozen Daily selectors merely because new source prompts exist.

6. **Curate only the new/affected material.**
   - Compare proposed additions with the current curated library for answer-set duplication, decorative conditions, threshold-lane redundancy and gameplay balance.
   - Reuse the rules recorded in `PROMPT_CURATION_POLICY.md`; do not restore the retired Phase 1 evidence/review/survivor UI.
   - Keep only material additions that justify changing the curated package.

7. **Create a new versioned curated selector package.**
   - Never edit the current frozen 4,897 identity silently.
   - Update the selector manifest/count/family metadata and hashes as one deliberate versioned change.
   - If a new family becomes live, the family count must change explicitly from 17 and the authority verifier must be updated in the same PR.

8. **Update the curated Daily authority explicitly.**
   - `js/admin-daily-curated-authority-v1.js` remains the authority boundary.
   - Update its expected selector identity/count/family contract only after the new curated package is ready.
   - Source/provenance storage remains separate from Daily authority.

9. **Run mandatory regression gates.**
   - `scripts/verify-prompt-curated-selectors-v1.mjs`
   - `scripts/verify-daily-curated-authority-v1.mjs`
   - `scripts/verify-daily-library-cutover-v1.mjs`
   - Factory, Quality, Promotion and source-shard verifiers
   - weekly formation, nationality, semantic-diversity and immutable-reservoir checks
   - all-season certification and Studio regression

10. **Shadow-test a real week before cutover.**
    - Revalidate every proposed survivor against the current player database.
    - Generate all supported formations without publishing.
    - Confirm the week is unique, balanced, clash-free and contains only IDs from the proposed curated package.
    - Only then merge the authority update.

## What stays in Prompt Studio

The maintained Prompt Studio path is intentionally small:

**Prompt Builder / Factory → Quality Analyser → Promotion + source archive → explicit curated-authority update**

The following completed Phase 1 tools are not part of the permanent runtime and should not be reintroduced just to add a family:

- 144-prompt calibration/review exporter;
- full-library evidence panel;
- survivor builder panel;
- Refinement Incubator;
- pre-cutover curated-package panel;
- standalone shadow-regression page.

When deeper analysis is needed for a future family, implement it as a scoped offline verifier/report for that change rather than restoring a second permanent Prompt Studio pipeline.

## Safety invariant

**Builder, Quality and Promotion may expand source material; only a reviewed, versioned curated selector/authority change may expand Daily generation.**
