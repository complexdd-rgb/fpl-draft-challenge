# Refinement survivor trial

Generated: 2026-09-04T07:10:19.333Z

## Result

- Incubator parents available: **2**
- Parents attempted by the actual Incubator runtime: **2**
- Controlled variants tested: **6**
- Provisional parent winners selected: **2**
- Full-library candidate pool rechecked: **851 prompts**
- Predicted full-library promotions: **2**
- Predicted failures after full-pool recheck: **0**

## All provisional variants

### quality_v2_mid_price_6_gi_15

- `quality_v2_mid_price_6_gi_15_refined_1_6_5` — certified; raw 96, adjusted 98, answers 74, overlap 0.000 — **selected**
- `quality_v2_mid_price_6_gi_15_refined_2_5` — certified; raw 82, adjusted 84, answers 10, overlap 0.000
- `quality_v2_mid_price_6_gi_15_refined_3_5_5` — certified; raw 94, adjusted 96, answers 36, overlap 0.000

### quality_v3_fwd_manager_david_moyes_p55

- `quality_v3_fwd_manager_david_moyes_p55_refined_1_45` — rescued; raw 69, adjusted 75, answers 18, overlap 0.000
- `quality_v3_fwd_manager_david_moyes_p55_refined_2_75` — certified; raw 72, adjusted 78, answers 14, overlap 0.000 — **selected**
- `quality_v3_fwd_manager_david_moyes_p55_refined_3_65` — rescued; raw 69, adjusted 75, answers 16, overlap 0.000

## Full-library candidate outcomes

### quality_v2_mid_price_6_gi_15_refined_1_6_5

- Parent: `quality_v2_mid_price_6_gi_15`
- Position: MID
- Label: Midfielder who started at £6.5m or less with 15+ goal involvements
- Full-library state: **certified**
- Raw score: 84
- Adjusted score: 86
- Answers: 74
- Max overlap: 0.000
- Promotion: **YES**
- Issues: none

### quality_v3_fwd_manager_david_moyes_p55_refined_2_75

- Parent: `quality_v3_fwd_manager_david_moyes_p55`
- Position: FWD
- Label: Forward managed by David Moyes who scored 75+ FPL points
- Full-library state: **certified**
- Raw score: 78
- Adjusted score: 84
- Answers: 14
- Max overlap: 0.000
- Promotion: **YES**
- Issues: none


## Interpretation

This trial uses the repository's real `prompt-refinement-incubator.js` to generate and select controlled variants. It captures every provisional variant/result, then removes the incubated parents, combines selected candidates with the currently certified/rescued base, and reruns the same Prompt Quality Analyser across the full candidate library. A predicted promotion therefore has passed both the Incubator's provisional screen and a full-pool overlap/quality recheck.
