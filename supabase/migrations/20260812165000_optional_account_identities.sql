-- Optional cross-device leaderboard accounts.
-- Guest play remains device-based; authenticated users receive a private stable
-- leaderboard identity and can link existing browser/device history to it.

create table if not exists public.leaderboard_account_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  identity_id uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create table if not exists public.leaderboard_account_devices (
  client_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now(),
  constraint leaderboard_account_devices_client_id_length check (char_length(client_id) between 8 and 120)
);

create index if not exists leaderboard_account_devices_user_idx
  on public.leaderboard_account_devices (user_id);

alter table public.leaderboard_account_identities enable row level security;
alter table public.leaderboard_account_devices enable row level security;

revoke all on public.leaderboard_account_identities from public, anon, authenticated;
revoke all on public.leaderboard_account_devices from public, anon, authenticated;
grant select, insert, update, delete on public.leaderboard_account_identities to service_role;
grant select, insert, update, delete on public.leaderboard_account_devices to service_role;

-- Rebuild the all-time view so linked guest devices and future authenticated entries
-- collapse into one account identity. If the same account has historical results from
-- more than one device for the same challenge, only the earliest verified submission
-- counts towards All-Time. Daily ranks themselves still use the live leaderboard rules.
create or replace view public.leaderboard_all_time
with (security_invoker = true) as
with identity_source as (
  select
    e.challenge_id,
    e.client_id,
    e.display_name,
    e.final_score,
    e.efficiency,
    e.elapsed_seconds,
    e.created_at,
    coalesce(
      direct_identity.identity_id::text,
      linked_identity.identity_id::text,
      e.client_id
    ) as identity_key
  from public.leaderboard_entries e
  left join public.leaderboard_account_identities direct_identity
    on e.client_id = ('acct:' || direct_identity.identity_id::text)
  left join public.leaderboard_account_devices device
    on e.client_id = device.client_id
  left join public.leaderboard_account_identities linked_identity
    on device.user_id = linked_identity.user_id
),
daily_ranked as (
  select
    *,
    row_number() over (
      partition by challenge_id
      order by final_score desc, elapsed_seconds asc, created_at asc
    ) as daily_rank
  from identity_source
),
identity_deduped as (
  select
    *,
    row_number() over (
      partition by identity_key, challenge_id
      order by created_at asc
    ) as identity_attempt_order
  from daily_ranked
),
ranked as (
  select *
  from identity_deduped
  where identity_attempt_order = 1
),
aggregated as (
  select
    identity_key as client_id,
    (array_agg(display_name order by created_at desc))[1] as display_name,
    count(*)::integer as games_played,
    sum(greatest(efficiency, 0::numeric)) as all_time_score,
    avg(greatest(efficiency, 0::numeric)) as average_efficiency,
    count(*) filter (where daily_rank = 1)::integer as wins,
    count(*) filter (where daily_rank <= 3)::integer as podiums,
    min(daily_rank)::integer as best_rank,
    min(created_at) as first_entry_at
  from ranked
  group by identity_key
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

comment on table public.leaderboard_account_identities is
  'Private Supabase Auth user to stable leaderboard identity mapping. Never exposed by public leaderboard APIs.';
comment on table public.leaderboard_account_devices is
  'Private mapping from historical browser leaderboard IDs to authenticated users for cross-device All-Time aggregation.';
comment on view public.leaderboard_all_time is
  'All-time standings with optional account identity merging. Historical duplicate device finishes for one account/challenge count only once (earliest verified submission).';
