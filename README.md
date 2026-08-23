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

The generic Historical Database Import Centre and Identity Consolidation tools are retained for verified season expansion. The one-off 2015/16 archive hotfix importer is retired and has been removed; older automatic database-repair workspaces remain outside the active Studio workflow while cleanup continues.

## Prompt Engine 2

The current rule engine includes season relationships, recorded career totals, Career Shape rules and career relationships such as **played for both clubs**. Career rules only use player-seasons with recorded positive minutes.

Open `admin.html` through the GitHub Pages site to use the Studio. Prompt-library edits remain browser-local until you download and upload the replacement library; validated seven-day Daily Challenge batches can be published directly to Supabase.
