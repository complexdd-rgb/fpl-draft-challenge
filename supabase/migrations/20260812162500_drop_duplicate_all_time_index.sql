-- The base leaderboard schema already provides leaderboard_entries_rank_idx with the
-- same columns/order used by the all-time ranking view. Remove the duplicate created
-- by the initial all-time migration and retain the original index.

drop index if exists public.leaderboard_entries_daily_rank_idx;
