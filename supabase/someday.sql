-- Lucia ♥ Riu — ⭐ Someday + 🗓️ Trip Plan (task E1, roadmap #5 and #6)
-- Run once in the Supabase SQL editor. The 📋 Plan tab says so until you do.
--
-- One table, not three: `kind` does the separating. A wish is the inbox entry
-- for something that already has a "done" home in the app —
--
--   📍 place      → graduates into 🗓️ Trip Plan, then ✈️ Trips
--   🍜 restaurant → graduates into 🍜 Food
--   🎁 thing      → graduates into 🎁 Gifts
--
-- which is why `status` lives here rather than a `wanted` flag being bolted
-- onto each of those three separately.

create table if not exists wishes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null default 'thing',       -- place | restaurant | thing
  title text not null,
  note text,
  link text,
  -- Deliberately visible, not hidden: "what does Lucia actually want" is the
  -- question the gift kind exists to answer, and it only works if the other
  -- person can browse it.
  added_by text,                            -- lucia | riu
  status text not null default 'wanted',    -- wanted | done
  est_cost numeric,                         -- feeds 💸 Money's simulation (E2)
  done_at timestamptz,
  constraint wishes_kind  check (kind in ('place','restaurant','thing')),
  constraint wishes_state check (status in ('wanted','done'))
);

create index if not exists wishes_status_idx on wishes (status, kind);

-- ---------------------------------------------------------------- 🗓️ Trip Plan
-- A planned trip is NOT a new table: it's a `journeys` row whose dates are
-- still ahead of us. That way a plan graduates into a memory in place — same
-- row, same photos, no copy step to drift out of sync.
alter table journeys add column if not exists est_cost numeric;
alter table journeys add column if not exists status text;
-- Existing rows are all trips we already took. NULL would work as "past" too,
-- but being explicit means the app never has to guess.
update journeys set status = 'past' where status is null;

-- ------------------------------------------------------------------------ RLS
-- Same shape as every other table since v10: `to authenticated` only, gated by
-- public.is_us(). No policy for anon means no access for anon.
alter table wishes enable row level security;
drop policy if exists "anon full access" on wishes;
drop policy if exists "us only" on wishes;
create policy "us only" on wishes
  for all to authenticated using (public.is_us()) with check (public.is_us());

-- ------------------------------------------------------------------ check it
-- Expect: wishes with ONE 'us only' policy for {authenticated} and nothing for
-- {anon}; and journeys carrying est_cost + status.
select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'public' and tablename = 'wishes';

select column_name, data_type
from information_schema.columns
where table_name = 'journeys' and column_name in ('est_cost','status');
