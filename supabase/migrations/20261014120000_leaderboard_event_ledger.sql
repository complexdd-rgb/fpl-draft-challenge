-- Append-only server event accounting. Existing entries and penalties are preserved.
alter table public.leaderboard_attempts add column if not exists completion_result jsonb;
create table public.leaderboard_attempt_events (
  attempt_id uuid not null references public.leaderboard_attempts(id) on delete cascade,
  event_id text not null check (char_length(event_id) between 8 and 100),
  sequence bigint generated always as identity,
  prompt_id text not null,
  player_id text not null,
  season text not null,
  skipped boolean not null default false,
  valid boolean not null,
  created_at timestamptz not null default now(),
  primary key (attempt_id, event_id)
);
create index leaderboard_attempt_events_latest_idx on public.leaderboard_attempt_events(attempt_id, prompt_id, sequence desc) where valid;
alter table public.leaderboard_attempt_events enable row level security;
revoke all on public.leaderboard_attempt_events from public, anon, authenticated;
grant select, insert on public.leaderboard_attempt_events to service_role;
grant usage, select on sequence public.leaderboard_attempt_events_sequence_seq to service_role;

create or replace function public.record_leaderboard_pick(p_attempt_id uuid, p_challenge_id text, p_client_ids text[], p_event_id text, p_prompt_id text, p_player_id text, p_season text, p_skipped boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.leaderboard_attempts%rowtype;
  e public.leaderboard_attempt_events%rowtype;
  prompt jsonb;
  accepted boolean;
begin
  select * into a from public.leaderboard_attempts where id=p_attempt_id and challenge_id=p_challenge_id and client_id=any(p_client_ids) for update;
  if not found then raise exception 'Attempt not found' using errcode='P0002'; end if;
  select * into e from public.leaderboard_attempt_events where attempt_id=a.id and event_id=p_event_id;
  if found then
    if (e.prompt_id,e.player_id,e.season,e.skipped) is distinct from (p_prompt_id,p_player_id,p_season,p_skipped) then raise exception 'Event ID already used for another pick' using errcode='22023'; end if;
    return jsonb_build_object('valid',e.valid,'penaltyPoints',a.penalty_points,'replayed',true);
  end if;
  if a.completed or a.completion_result is not null then raise exception 'Attempt already completed' using errcode='55000'; end if;
  select value into prompt from public.leaderboard_verifiers v cross join lateral jsonb_array_elements(v.payload->'prompts') where v.challenge_id=p_challenge_id and v.active and v.release_date <= (now() at time zone 'Europe/London')::date and value->>'promptId'=p_prompt_id;
  if prompt is null then raise exception 'Released prompt not found' using errcode='P0002'; end if;
  if p_skipped then
    if p_player_id<>'' or p_season<>'' then raise exception 'Give Up must not contain a player' using errcode='22023'; end if;
    accepted := true;
  else
    if p_player_id='' or p_season='' then raise exception 'Incomplete pick' using errcode='22023'; end if;
    select exists(select 1 from jsonb_array_elements(prompt->'allowed') r where r->>'playerId'=p_player_id and r->>'season'=p_season) into accepted;
  end if;
  insert into public.leaderboard_attempt_events(attempt_id,event_id,prompt_id,player_id,season,skipped,valid) values(a.id,p_event_id,p_prompt_id,p_player_id,p_season,p_skipped,accepted);
  update public.leaderboard_attempts set penalty_points=penalty_points+case when accepted then 0 else 10 end,last_activity_at=now() where id=a.id returning * into a;
  return jsonb_build_object('valid',accepted,'penaltyPoints',a.penalty_points,'replayed',false);
end $$;

create or replace function public.complete_leaderboard_attempt(p_attempt_id uuid, p_challenge_id text, p_client_ids text[], p_selections jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.leaderboard_attempts%rowtype;
  verifier jsonb;
  prompt jsonb;
  pick jsonb;
  answer jsonb;
  event public.leaderboard_attempt_events%rowtype;
  used text[] := '{}';
  selections jsonb := '[]';
  total integer := 0;
  perfect_picks integer := 0;
  maximum integer;
  points integer;
  skipped boolean;
  elapsed integer;
  result jsonb;
begin
  select * into a from public.leaderboard_attempts where id=p_attempt_id and challenge_id=p_challenge_id and client_id=any(p_client_ids) for update;
  if not found then raise exception 'Attempt not found' using errcode='P0002'; end if;
  if a.completion_result is not null then return a.completion_result; end if;
  if a.completed then raise exception 'Legacy completed attempt: refresh leaderboard to recover submitted result' using errcode='55000'; end if;
  select payload into verifier from public.leaderboard_verifiers where challenge_id=p_challenge_id and active and release_date <= (now() at time zone 'Europe/London')::date;
  if verifier is null then raise exception 'Released challenge not found' using errcode='P0002'; end if;
  if jsonb_typeof(p_selections) is distinct from 'array' or jsonb_array_length(p_selections)<>jsonb_array_length(verifier->'prompts') then raise exception 'Exactly eleven selections required' using errcode='22023'; end if;
  if (select count(distinct value->>'promptId') from jsonb_array_elements(p_selections))<>jsonb_array_length(p_selections) then raise exception 'Duplicate or missing prompt IDs' using errcode='22023'; end if;
  for prompt in select value from jsonb_array_elements(verifier->'prompts') loop
    select value into pick from jsonb_array_elements(p_selections) where value->>'promptId'=prompt->>'promptId';
    if pick is null then raise exception 'Missing selection' using errcode='22023'; end if;
    skipped := coalesce(pick->>'playerId','')='' and coalesce(pick->>'season','')='';
    select * into event from public.leaderboard_attempt_events where attempt_id=a.id and prompt_id=prompt->>'promptId' and valid order by sequence desc limit 1;
    if not found or (event.player_id,event.season,event.skipped) is distinct from (coalesce(pick->>'playerId',''),coalesce(pick->>'season',''),skipped) then raise exception 'Selection has no matching recorded pick: refresh and sync picks before completing' using errcode='55000'; end if;
    points := 0;
    if not skipped then
      if pick->>'playerId'=any(used) then raise exception 'Duplicate footballer' using errcode='22023'; end if;
      used := array_append(used,pick->>'playerId');
      select value into answer from jsonb_array_elements(prompt->'allowed') where value->>'playerId'=pick->>'playerId' and value->>'season'=pick->>'season';
      if answer is null then raise exception 'Pick no longer qualifies' using errcode='55000'; end if;
      points := (answer->>'points')::integer;
      if points=(prompt->>'bestPoints')::integer then perfect_picks := perfect_picks+1; end if;
    end if;
    total := total+points;
    selections := selections || jsonb_build_array(jsonb_build_object('promptId',prompt->>'promptId','playerId',coalesce(pick->>'playerId',''),'season',coalesce(pick->>'season',''),'points',points,'position',prompt->>'position','skipped',skipped));
  end loop;
  maximum := (verifier->>'perfectScore')::integer;
  elapsed := greatest(0,floor(extract(epoch from (clock_timestamp()-a.started_at)))::integer);
  result := jsonb_build_object('playerPoints',total,'penaltyPoints',a.penalty_points,'finalScore',total-a.penalty_points,'perfectScore',maximum,'efficiency',case when maximum>0 then (total-a.penalty_points)::numeric/maximum*100 else 0 end,'perfectPromptPicks',perfect_picks,'elapsedSeconds',elapsed,'selections',selections);
  update public.leaderboard_attempts set completed=true,completed_at=clock_timestamp(),last_activity_at=clock_timestamp(),completion_result=result where id=a.id;
  return result;
end $$;
revoke all on function public.record_leaderboard_pick(uuid,text,text[],text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.complete_leaderboard_attempt(uuid,text,text[],jsonb) from public,anon,authenticated;
grant execute on function public.record_leaderboard_pick(uuid,text,text[],text,text,text,text,boolean) to service_role;
grant execute on function public.complete_leaderboard_attempt(uuid,text,text[],jsonb) to service_role;
