-- ✍️ Answer & compare (task C1) — both of you answer the day's question, and
-- neither answer shows until both are in.
--
-- Run this ONCE in the Supabase SQL editor. Until it's run, the Home card
-- says so and the question itself keeps working exactly as before.
--
-- Run supabase/auth_policies.sql FIRST if you haven't: this table follows the
-- same `to authenticated` + public.is_us() shape, so it needs that function
-- to exist.

create table if not exists answers (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  day int not null,                          -- dayNumber(): the app's day counter
  who text not null check (who in ('riu', 'lucia')),
  text text not null
);

-- One answer each per day. This is also what makes "locked once submitted"
-- true rather than merely a UI convention: a second insert for the same day
-- is rejected by the database, not just hidden by the interface.
create unique index if not exists answers_day_who_idx on answers (day, who);
create index if not exists answers_day_idx on answers (day desc);

alter table answers enable row level security;

-- Same shape as every other table since login shipped: `to authenticated`
-- excludes anon entirely, and is_us() narrows it to the two of us.
drop policy if exists "us only" on answers;
create policy "us only" on answers
  for all to authenticated using (public.is_us()) with check (public.is_us());
