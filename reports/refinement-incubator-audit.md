# Refinement Incubator audit

Generated: 2026-09-04T07:08:30.470Z

## Headline

- Enabled Studio prompts analysed: **851**
- Certified: **845**
- Family/diversity rescued: **4**
- Incubated promising 3★: **2**
- Hard/weak rejected: **0**
- Previous working reference: **144 incubated**
- Delta from reference: **-142**

## Refinement readiness

- Safely tunable by the current Incubator strategy: **2**
- Structurally stuck with no safe threshold detected: **0**
- Near the existing family/diversity rescue line: **2**
- Controlled variants the current strategy would plan: **6**

### By position
- FWD: 1
- MID: 1

### By dominant family
- anti-meta: 1
- manager: 1

### By tunability
- builder-threshold: 1
- source-threshold: 1

### By answer-pool band
- ideal: 2

### By overlap band
- low: 2

## Highest-priority parents

| ID | Pos | Score | Adj | Answers | Overlap | Family | Tune route | Near rescue |
|---|---:|---:|---:|---:|---:|---|---|---|
| quality_v2_mid_price_6_gi_15 | MID | 68 | 70 | 55 | 0.000 | anti-meta | builder-threshold:startingPrice | yes |
| quality_v3_fwd_manager_david_moyes_p55 | FWD | 63 | 69 | 17 | 0.000 | manager | source-threshold:points | yes |

## Near-rescue parents

- **quality_v2_mid_price_6_gi_15** (MID) — raw 68, adjusted 70, answers 55, overlap 0.000, builder-threshold.
- **quality_v3_fwd_manager_david_moyes_p55** (FWD) — raw 63, adjusted 69, answers 17, overlap 0.000, source-threshold.

## Structurally stuck parents

These prompts meet the 3★ Incubator floor but the current safe threshold strategy cannot create a controlled variant. They are the main candidates for a second refinement strategy rather than repeated threshold mutation.

None.

## Method

This report rebuilds the current approved Studio prompt library from repository sources, reinstalls the nationality context pack in its stable post-baseline state, runs the same Prompt Quality Analyser used by Quality Enforcement v2, applies the same v2 decision thresholds, and then classifies held 3★ prompts using the current Refinement Incubator's threshold-detection rules. It does not read browser localStorage or mutate the live prompt library.
