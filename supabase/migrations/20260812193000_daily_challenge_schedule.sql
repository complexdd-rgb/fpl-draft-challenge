-- FPL Draft Challenge — Supabase-backed daily challenge publishing.
-- Validated future challenges can be published from Studio and become live automatically
-- at UK midnight. Browser roles never access the schedule or admin allow-list directly.

create table if not exists public.app_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_challenge_schedule (
  release_date date primary key,
  challenge_id text not null unique,
  challenge_number integer not null default 0,
  title text not null default '',
  difficulty text not null default 'Mixed',
  formation text not null default '4-4-2',
  theme text not null default 'Generated Mix',
  perfect_score integer not null check (perfect_score >= 0),
  source_js text not null,
  manifest_entry jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_challenge_schedule_source_length check (char_length(source_js) between 100 and 500000)
);

create index if not exists daily_challenge_schedule_active_date_idx
  on public.daily_challenge_schedule (active, release_date);

alter table public.app_admin_users enable row level security;
alter table public.daily_challenge_schedule enable row level security;

revoke all on public.app_admin_users from public, anon, authenticated;
revoke all on public.daily_challenge_schedule from public, anon, authenticated;
grant select, insert, update, delete on public.app_admin_users to service_role;
grant select, insert, update, delete on public.daily_challenge_schedule to service_role;

-- Keep the multi-day publish atomic: either the complete validated batch and its private
-- leaderboard verifiers are written, or none of it is. Only service-role Edge Functions
-- may execute this function.
create or replace function public.publish_daily_challenge_batch(
  p_published_by uuid,
  p_challenges jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  release_day date;
  challenge_key text;
  verifier jsonb;
  published_count integer := 0;
  uk_today date := (now() at time zone 'Europe/London')::date;
begin
  if not exists (select 1 from public.app_admin_users where user_id = p_published_by) then
    raise exception 'Not authorised to publish daily challenges.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_challenges) <> 'array'
     or jsonb_array_length(p_challenges) < 1
     or jsonb_array_length(p_challenges) > 14 then
    raise exception 'Publish batch must contain between 1 and 14 challenges.' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_challenges)
  loop
    release_day := (item->>'releaseDate')::date;
    challenge_key := nullif(item->>'challengeId', '');
    verifier := item->'verifier';

    if release_day <= uk_today then
      raise exception 'Only future UK challenge dates can be published (%).', release_day using errcode = '22023';
    end if;
    if challenge_key is null or verifier is null then
      raise exception 'Challenge id and verifier are required.' using errcode = '22023';
    end if;

    insert into public.daily_challenge_schedule (
      release_date,
      challenge_id,
      challenge_number,
      title,
      difficulty,
      formation,
      theme,
      perfect_score,
      source_js,
      manifest_entry,
      active,
      published_by,
      published_at,
      updated_at
    ) values (
      release_day,
      challenge_key,
      coalesce((item->>'challengeNumber')::integer, 0),
      coalesce(item->>'title', ''),
      coalesce(item->>'difficulty', 'Mixed'),
      coalesce(item->>'formation', '4-4-2'),
      coalesce(item->>'theme', 'Generated Mix'),
      coalesce((item->>'perfectScore')::integer, 0),
      item->>'sourceJs',
      coalesce(item->'manifestEntry', '{}'::jsonb),
      true,
      p_published_by,
      now(),
      now()
    )
    on conflict (release_date) do update set
      challenge_id = excluded.challenge_id,
      challenge_number = excluded.challenge_number,
      title = excluded.title,
      difficulty = excluded.difficulty,
      formation = excluded.formation,
      theme = excluded.theme,
      perfect_score = excluded.perfect_score,
      source_js = excluded.source_js,
      manifest_entry = excluded.manifest_entry,
      active = true,
      published_by = excluded.published_by,
      published_at = now(),
      updated_at = now();

    insert into public.leaderboard_verifiers (
      challenge_id,
      release_date,
      challenge_number,
      title,
      perfect_score,
      payload,
      active,
      updated_at
    ) values (
      challenge_key,
      release_day,
      coalesce((item->>'challengeNumber')::integer, 0),
      coalesce(item->>'title', ''),
      coalesce((item->>'perfectScore')::integer, 0),
      verifier,
      true,
      now()
    )
    on conflict (challenge_id) do update set
      release_date = excluded.release_date,
      challenge_number = excluded.challenge_number,
      title = excluded.title,
      perfect_score = excluded.perfect_score,
      payload = excluded.payload,
      active = true,
      updated_at = now();

    published_count := published_count + 1;
  end loop;

  return published_count;
end;
$$;

revoke all on function public.publish_daily_challenge_batch(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.publish_daily_challenge_batch(uuid, jsonb) to service_role;

comment on table public.daily_challenge_schedule is
  'Server-managed dated challenge source used by the automatic UK-midnight live loader.';
comment on table public.app_admin_users is
  'Private allow-list for authenticated users permitted to publish validated challenge batches.';
