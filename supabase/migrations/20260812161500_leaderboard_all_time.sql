-- All-time leaderboard: every verified daily finish contributes its normalised
-- efficiency score (maximum 100 per challenge). Daily ranks use the same tie-breaks
-- as the live daily leaderboard.

create index if not exists leaderboard_entries_daily_rank_idx
  on public.leaderboard_entries (challenge_id, final_score desc, elapsed_seconds asc, created_at asc);

create or replace view public.leaderboard_all_time
with (security_invoker = true) as
with ranked as (
  select
    challenge_id,
    client_id,
    display_name,
    efficiency,
    created_at,
    row_number() over (
      partition by challenge_id
      order by final_score desc, elapsed_seconds asc, created_at asc
    ) as daily_rank
  from public.leaderboard_entries
),
aggregated as (
  select
    client_id,
    (array_agg(display_name order by created_at desc))[1] as display_name,
    count(*)::integer as games_played,
    sum(greatest(efficiency, 0::numeric)) as all_time_score,
    avg(greatest(efficiency, 0::numeric)) as average_efficiency,
    count(*) filter (where daily_rank = 1)::integer as wins,
    count(*) filter (where daily_rank <= 3)::integer as podiums,
    min(daily_rank)::integer as best_rank,
    min(created_at) as first_entry_at
  from ranked
  group by client_id
)
select
  client_id,
  display_name,
  games_played,
  all_time_score,
  average_efficiency,
  wins,
  podiums,
  best_rank,
  row_number() over (
    order by
      all_time_score desc,
      average_efficiency desc,
      wins desc,
      podiums desc,
      first_entry_at asc
  )::integer as all_time_rank
from aggregated;

revoke all on public.leaderboard_all_time from public, anon, authenticated;
grant select on public.leaderboard_all_time to service_role;

comment on view public.leaderboard_all_time is
  'Device-based all-time leaderboard. Score is the sum of verified daily efficiencies; daily ranks use score, time, then submission order.';
