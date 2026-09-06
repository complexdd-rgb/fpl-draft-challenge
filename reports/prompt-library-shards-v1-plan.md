# Prompt Library Shards v1

This branch adds the permanent save boundary after Prompt Promotion v1.

Goal: a user should only need to run Factory -> Quality -> Promotion once. The promoted pool is immediately persisted into IndexedDB as family shards and can be exported as repository-backed family shard files without rerunning Factory or Quality.

Design:
- 17 family shards, keyed by family id.
- IndexedDB is the durable browser cache so refresh/closing Prompt Studio does not lose the promoted pool.
- A generated manifest stores schema/version, prompt totals, family totals, variant-group totals and timestamps.
- Repository shard export is deterministic and contains only compact declarative prompt records.
- No localStorage use for the 100k+ library.
- No live/certified production membership is changed by saving. Certification/publishing remains a separate explicit boundary.
- Promotion source reconciliation remains mandatory before a new snapshot can replace the saved shard set.

This avoids requiring a second expensive Factory/Quality run just to publish the same approved library.
