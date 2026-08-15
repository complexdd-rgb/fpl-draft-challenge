-- Future schedule cleanup: truly delete unpublished/unplayed future challenges.
-- If leaderboard history somehow exists for a future challenge, preserve that history by
-- falling back to the existing soft-deactivate behaviour.
create or replace function public.remove_daily_challenge_batch(p_published_by uuid, p_dates jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  raw_date jsonb;
  release_day date;
  challenge_key text;
  removed_count integer := 0;
  uk_today date := (now() at time zone 'Europe/London')::date;
  has_history boolean;
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
      release_day := trim(both '\"' from raw_date::text)::date;
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

    select exists (
      select 1 from public.leaderboard_attempts where challenge_id = challenge_key
      union all
      select 1 from public.leaderboard_entries where challenge_id = challenge_key
    ) into has_history;

    if has_history then
      update public.daily_challenge_schedule
        set active = false, updated_at = now()
        where challenge_id = challenge_key;

      update public.leaderboard_verifiers
        set active = false, updated_at = now()
        where challenge_id = challenge_key;
    else
      delete from public.leaderboard_verifiers where challenge_id = challenge_key;
      delete from public.daily_challenge_schedule where challenge_id = challenge_key;
    end if;

    removed_count := removed_count + 1;
  end loop;

  return removed_count;
end;
$function$;
