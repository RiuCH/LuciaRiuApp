-- Lucia ♥ Riu — 📅 Our calendar (the Home card + its popout)
-- Run once in the Supabase SQL editor. The card says so until you do.
--
-- Its own table rather than another `settings` JSON row: unlike the duel or
-- 20 Questions, two people add to this INDEPENDENTLY and often. A single JSON
-- blob is read-modify-write, so whoever saves second silently overwrites the
-- other's entry. Rows don't do that.

create table if not exists calendar_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- A calendar day, not an instant. Storing a timestamptz would render as a
  -- different DAY in San Francisco than in Phoenix, which is exactly the bug
  -- 🍜 Food already learned the hard way (see fdExifDate).
  day date not null,
  -- Likewise a wall clock ("19:30"), free text, optional. We are two people in
  -- two timezones; converting would mean guessing whose zone "7pm" meant, and
  -- guessing wrong is worse than not converting. Whatever you type is what you
  -- both see.
  at text,
  title text not null,
  note text,
  -- Which of us added it. This is the whole point of the colours.
  who text not null,
  constraint calendar_who check (who in ('riu', 'lucia'))
);

create index if not exists calendar_day_idx on calendar_events (day);

-- ------------------------------------------------------------------------ RLS
-- Same shape as every other table since v10: `to authenticated` only, gated by
-- public.is_us(). No policy for anon means no access for anon.
alter table calendar_events enable row level security;
drop policy if exists "anon full access" on calendar_events;
drop policy if exists "us only" on calendar_events;
create policy "us only" on calendar_events
  for all to authenticated using (public.is_us()) with check (public.is_us());

-- ------------------------------------------------------------------ check it
-- Expect ONE 'us only' policy for {authenticated} and nothing for {anon}.
select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'public' and tablename = 'calendar_events';
