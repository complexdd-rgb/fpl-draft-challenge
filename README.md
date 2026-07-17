# FPL Draft Challenge 2025/26

A free static website. No paid builder or database is required.

## Included

- 537 players
- Type-to-search autocomplete after two letters
- Position-specific suggestions
- Prompt validation
- Duplicate-player prevention
- Hidden points until reveal
- Local browser saving
- Total score, efficiency and grade
- Calculated perfect unique-XI score: 2116

## Test it on a computer

Because browsers block local JSON loading when you double-click `index.html`, run a tiny local server:

### Windows
Open this folder in Command Prompt and run:

`python -m http.server 8000`

Then visit:

`http://localhost:8000`

### Mac
Open Terminal in this folder and run the same command.

## Publish free using GitHub Pages

1. Create a free GitHub account.
2. Create a new public repository named `fpl-draft-challenge`.
3. Upload all four files from this folder.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select `main` and `/root`, then save.
7. GitHub will provide a public link.

## Important data note

The website uses the supplied `players.json`. Check the season statistics before public launch. Updating the database later only requires replacing that file while keeping the same field names.
