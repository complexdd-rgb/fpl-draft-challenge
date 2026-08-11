FPL DRAFT CHALLENGE — DATE + BATCH HISTORY PATCH
================================================

WHAT THIS CHANGES
- User-facing challenge numbers are replaced by the challenge date.
- Numeric challenge numbers remain internal only for backwards compatibility.
- Successful 7-day batches are automatically saved into Challenge History with prompt IDs, labels and family data.
- Existing dated manifest challenges are imported into Challenge History when Admin opens, where prompt IDs are available.
- Challenge 6 is unlocked and can be deleted. It will not be recreated after deletion.

UPLOAD
1. Extract this ZIP.
2. Upload the files/folders inside to the matching locations in your GitHub repository.
3. Replace the existing files when prompted.
4. Commit the changes.
5. Wait for GitHub Pages to publish.
6. Hard-refresh the live site and Admin page (Ctrl+F5 on desktop).

AFTER UPLOAD
- Open Admin > Challenge History.
- Challenge 6 should now show a Delete entry button. Delete it if you want it removed.
- Existing scheduled dated challenges with prompt IDs should appear in Challenge History automatically.
- Generate the next 7 days: the seven successful challenges should be added to Challenge History immediately, including their prompts.
- The live site should display dates such as “11 August 2026” rather than “Challenge #31”.

NOTE
Do not delete the internal `number` properties from challenge JavaScript manually. They are hidden from users but retained for backwards compatibility with existing result and leaderboard records.
