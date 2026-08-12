-- Store the server-verified XI for each accepted leaderboard result.
-- Existing entries remain valid; their selections default to an empty array because
-- older submissions were not persisted at player/season level.

alter table public.leaderboard_entries
  add column if not exists selections jsonb not null default '[]'::jsonb;

comment on column public.leaderboard_entries.selections is
  'Server-verified leaderboard XI: promptId, playerId, season, points and prompt position. Only exposed after the viewer has submitted their own verified result.';
