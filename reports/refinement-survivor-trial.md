# Refinement survivor trial

Generated: 2026-09-04T06:26:25.186Z

## Result

- Incubator parents available: **2**
- Parents attempted by the actual Incubator runtime: **2**
- Controlled variants tested: **5**
- Provisional parent winners selected: **1**
- Full-library candidate pool rechecked: **850 prompts**
- Predicted full-library promotions: **1**
- Predicted failures after full-pool recheck: **0**

## Candidate outcomes

### quality_v2_mid_price_6_gi_15_refined_1_6_5

- Parent: `quality_v2_mid_price_6_gi_15`
- Position: MID
- Label: Midfielder who started at £6.0m or less with 15+ goal involvements
- Full-library state: **certified**
- Raw score: 84
- Adjusted score: 86
- Answers: 74
- Max overlap: 0.000
- Promotion: **YES**
- Issues: none


## Interpretation

This trial uses the repository's real `prompt-refinement-incubator.js` to generate and select controlled variants. It then removes the incubated parents, combines the selected candidates with the currently certified/rescued base, and reruns the same Prompt Quality Analyser across the full candidate library. A predicted promotion therefore has passed both the Incubator's provisional screen and a full-pool overlap/quality recheck.
