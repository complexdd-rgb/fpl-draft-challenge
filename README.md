# FPL Draft Challenge

This repository contains the live FPL Draft Challenge, its historical player database and the browser-based Challenge Studio.

## Current Studio tools

- Daily Challenge generator and direct Supabase publisher
- Prompt Library Manager and Safe Rule Builder
- Checked Auto Prompt Generator including Career Shape rules
- Prompt Quality Analyser
- Validation Lab with Player Inspector, Rule Tester, Prompt Explorer and Season Health
- Automated season certification
- Player Database Auditor
- Live leaderboard backend health tools

The browser Historical Imports and Identity Consolidation workspaces are retired from the active Studio. Historical season expansion continues through audited season-master data work and explicit import/build scripts, while the Player Database Auditor remains the read-only browser health check.

## Prompt Engine 2

The current rule engine includes season relationships, recorded career totals, Career Shape rules and career relationships such as **played for both clubs**. Career rules only use player-seasons with recorded positive minutes.

Open `admin.html` through the GitHub Pages site to use the Studio. Prompt-library edits remain browser-local until you download and upload the replacement library; validated seven-day Daily Challenge batches can be published directly to Supabase.
