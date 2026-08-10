-- FPL Draft Challenge — verified daily leaderboard backend.
-- Safe for the public repository: no private challenge verifier/answer data lives here.

create extension if not exists pgcrypto;

create table if not exists public.leaderboard_verifiers (
  challenge_id text primary key,
  release_date date not null,
  challenge_number integer not null default 0,
  title text not null default '',
  perfect_score integer not null check (perfect_score >= 0),
  payload jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.leaderboard_verifiers(challenge_id) on delete cascade,
  client_id text not null check (char_length(client_id) between 8 and 120),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  penalty_points integer not null default 0 check (penalty_points >= 0),
  completed boolean not null default false,
  unique (challenge_id, client_id)
);

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null references public.leaderboard_verifiers(challenge_id) on delete cascade,
  client_id text not null check (char_length(client_id) between 8 and 120),
  display_name text not null check (char_length(display_name) between 2 and 20),
  final_score integer not null,
  efficiency numeric(8,4) not null,
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  penalty_points integer not null check (penalty_points >= 0),
  player_points integer not null,
  perfect_score integer not null check (perfect_score >= 0),
  perfect_prompt_picks integer not null default 0 check (perfect_prompt_picks >= 0),
  created_at timestamptz not null default now(),
  unique (challenge_id, client_id)
);

create index if not exists leaderboard_entries_rank_idx
  on public.leaderboard_entries (challenge_id, final_score desc, elapsed_seconds asc, created_at asc);
create index if not exists leaderboard_attempts_challenge_idx
  on public.leaderboard_attempts (challenge_id, started_at asc);

-- The browser never accesses these tables directly. Edge Functions use a server-side
-- secret key, so keep anon/authenticated roles locked out even if someone knows the
-- browser-safe publishable key.
alter table public.leaderboard_verifiers enable row level security;
alter table public.leaderboard_attempts enable row level security;
alter table public.leaderboard_entries enable row level security;

revoke all on table public.leaderboard_verifiers from anon, authenticated;
revoke all on table public.leaderboard_attempts from anon, authenticated;
revoke all on table public.leaderboard_entries from anon, authenticated;
