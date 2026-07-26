-- Lucia ♥ Riu — 💸 Money (task E2, roadmap #3)
-- Run once in the Supabase SQL editor. The 📋 Plan tab says so until you do.
--
-- This is a POT, not Splitwise. Decided 2026-07-26: we want one shared balance
-- and the ability to ask "can we afford Japan?", so there are deliberately NO
-- per-expense splits, no signed who-owes-whom number and no settle-up flow.
-- Every row is money in or money out; the pot is the difference.

create table if not exists expenses (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,                       -- topup | spend
  amount numeric not null check (amount > 0),
  what text,
  who text,                                 -- lucia | riu — who put it in / paid
  at date not null default current_date,    -- when it actually happened
  -- Lets ✈️ Trips show what a trip cost, and afterwards cost-vs-estimate.
  -- The UI lives in 📋 Plan; only the data links.
  journey_id bigint references journeys(id) on delete set null,
  -- We're both in USD day to day. Not building FX — but an abroad trip will
  -- want this eventually, so leave the column rather than a later migration.
  currency text not null default 'USD',
  constraint expenses_kind check (kind in ('topup','spend'))
);

create index if not exists expenses_at_idx on expenses (at desc);
create index if not exists expenses_journey_idx on expenses (journey_id);

-- ------------------------------------------------------------- the simulation
-- `pot − committed = what's left`. A 🗓️ Trip Plan is committed by definition:
-- it has dates. A ⭐ Someday wish is a daydream until you say otherwise, so it
-- gets a flag you can toggle — that toggle IS the simulation.
alter table wishes add column if not exists committed boolean not null default false;

-- ------------------------------------------------------------------------ RLS
-- Same shape as every table since v10: `to authenticated` only, gated by
-- public.is_us(). No policy for anon means no access for anon.
alter table expenses enable row level security;
drop policy if exists "anon full access" on expenses;
drop policy if exists "us only" on expenses;
create policy "us only" on expenses
  for all to authenticated using (public.is_us()) with check (public.is_us());

-- ------------------------------------------------------------------ check it
-- Expect: expenses with ONE 'us only' policy for {authenticated} and nothing
-- for {anon}; and wishes carrying `committed`.
select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'public' and tablename = 'expenses';

select column_name, data_type
from information_schema.columns
where table_name = 'wishes' and column_name = 'committed';
