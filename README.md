# FPL Draft Challenge

This package contains the live FPL Draft Challenge, the historical player database and the browser-based Challenge Studio.

## Validation Lab Phase 1

Open `admin.html` and choose **Validation Lab** from the Studio sidebar.

The first release includes:

- Player Inspector
- Rule Tester
- Prompt Explorer
- Season Health
- Copyable validation debug reports

The tools are read-only: they do not modify `players.js` or publish changes to the live game.

See `VALIDATION-LAB-README.txt` for the test steps and upload instructions.

## Prompt Engine 2 — Season relationship rules

In **Prompt Studio → Safe rule builder**, choose **Season played** and use one of:

- is exactly
- is before
- is after
- is between

These rules work in the live prompt test, Rule Tester, Prompt Explorer and Season Certification.
