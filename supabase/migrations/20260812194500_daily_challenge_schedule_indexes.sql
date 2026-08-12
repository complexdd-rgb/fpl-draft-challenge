-- Cover the schedule publisher foreign key for maintenance/delete performance.
create index if not exists daily_challenge_schedule_published_by_idx
  on public.daily_challenge_schedule (published_by)
  where published_by is not null;
