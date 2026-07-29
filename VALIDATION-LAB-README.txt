FPL CHALLENGE STUDIO — VALIDATION LAB PHASE 1

WHAT WAS ADDED
- Validation Lab workspace in the existing Studio sidebar.
- Player Inspector with player search, season selection and field-by-field data checks.
- Rule Tester with individual PASS / FAIL traces and a copyable debug report.
- Prompt Explorer showing valid answers and single-rule near misses.
- Season Health showing eligibility, missing metadata, blockers and completion percentage.
- Shared js/validation-engine.js module.
- Read-only js/validation-lab.js interface.

IMPORTANT SAFETY POINTS
- The Validation Lab does not edit players.js.
- It does not publish or change the live daily challenge.
- A player-season must contain at least one recorded minute to qualify as an answer.
- Saved prompts are evaluated by their original stored prompt function. The readable rule trace is diagnostic.

QUICK TEST
1. Open admin.html.
2. Choose Validation Lab from the sidebar.
3. Search for Pedro Neto. The database displays him as Pedro Lomba Neto.
4. Select 2020/21.
5. In Rule Tester choose:
   MID · Midfielder from a club finishing 8th–12th who scored exactly five goals
6. Press Evaluate rules.
7. Position and goals should pass; league finish should fail because Wolves finished 13th.

UPLOAD
Upload every file and folder in this extracted project to the repository root, replacing the existing versions.
The two new required files are:
- js/validation-engine.js
- js/validation-lab.js


AUTOMATED SEASON CERTIFICATION
------------------------------
Open Season Health, select a season and press Run certification. The Studio checks all critical player metadata, the full 20-club table, derived league flags, every enabled prompt, Rule Tester agreement and zero-minute exclusion. A green Certified result is only awarded when every critical check passes. Use Copy report to save the complete result.
