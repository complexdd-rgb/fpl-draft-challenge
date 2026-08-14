-- FPL Draft Challenge — safe future schedule removal.
-- Admins can unschedule future challenges without deleting historical leaderboard rows.

create or replace function public.remove_daily_challenge_batch(
  p_published_by uuid,
  p_dates jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  raw_date jsonb;
  release_day date;
  challenge_key text;
  removed_count integer := 0;
  uk_today date := (now() at time zone 'Europe/London')::date;
begin
  if not exists (select 1 from public.app_admin_users where user_id = p_published_by) then
    raise exception 'Not authorised to manage daily challenges.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_dates) <> 'array'
     or jsonb_array_length(p_dates) < 1
     or jsonb_array_length(p_dates) > 14 then
    raise exception 'Remove between 1 and 14 scheduled dates at a time.' using errcode = '22023';
  end if;

  for raw_date in select value from jsonb_array_elements(p_dates)
  loop
    begin
      release_day := trim(both '"' from raw_date::text)::date;
    exception when others then
      raise exception 'Every removed challenge needs a valid release date.' using errcode = '22023';
    end;

    if release_day <= uk_today then
      raise exception 'Only future UK challenge dates can be removed (%).', release_day using errcode = '22023';
    end if;

    select challenge_id into challenge_key
    from public.daily_challenge_schedule
    where release_date = release_day and active = true
    for update;

    if challenge_key is null then
      continue;
    end if;

    update public.daily_challenge_schedule
      set active = false, updated_at = now()
      where release_date = release_day and active = true;

    update public.leaderboard_verifiers
      set active = false, updated_at = now()
      where challenge_id = challenge_key;

    removed_count := removed_count + 1;
  end loop;

  return removed_count;
end;
$$;

revoke all on function public.remove_daily_challenge_batch(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.remove_daily_challenge_batch(uuid, jsonb) to service_role;

comment on function public.remove_daily_challenge_batch(uuid, jsonb) is
  'Admin-only safe removal of future scheduled challenges. Deactivates schedule rows and verifiers while preserving any leaderboard history.';
