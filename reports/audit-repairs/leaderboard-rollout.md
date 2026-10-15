# Leaderboard accounting repair

F02/F03/F06/F13 share one change: an append-only event ledger and a server-owned completion snapshot.

- Record each pick with a persisted event ID. A database transaction locks the attempt, validates against the released verifier, records the result and adds an invalid-pick penalty exactly once. Retries reuse the same ID. Reusing an ID for a different pick fails.
- Reveal sends an explicit completion request after queued picks and Give Up selections. Completion checks every selection against the latest accepted event for that clue, checks unique footballers, recomputes points, and freezes the server clock and result. Display-name submission publishes that frozen result later.
- Store pending events before sending them; remove only after acknowledgement. Start, completion and events retry after reconnect or reload. Existing local picks can be re-recorded during recovery, but this does not reconstruct missing historic invalid attempts.
- Existing entries and published challenges are untouched. Existing incomplete attempts retain their accumulated penalties as a floor. Previously completed attempts with an entry keep their original result. Clients must refresh to the new protocol; old clients receive a clear conflict instead of silently bypassing the ledger.

This accounts for events received by the server. It cannot prove a human solved the puzzle or prevent automation from submitting qualifying picks rapidly. Offline time before a failed initial start cannot be authenticated; the UI must explain that server timing begins when connection succeeds.

Deploy after reviewing the migration and CI database checks: migration first, pick/completion/finish/start functions next, then versioned browser assets. Preserve the deployed public-source verifier-repair path. Stage reconnect, Give Up, concurrent invalid picks, delayed name entry and linked-device duplicate checks before production. Keep old function bundles available for rollback; do not drop ledger columns or rewrite entries on rollback.
