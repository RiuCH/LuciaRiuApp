-- Lucia ♥ Riu — 📅 recurring calendar entries (birthdays, anniversaries, the
-- weekly call). Run once in the Supabase SQL editor, after supabase/calendar.sql.
--
-- ONE column, not a table of occurrences. A birthday is one fact — "September
-- 14th, every year" — and writing 60 rows for it would mean 60 rows to edit
-- when you fix a typo, and a horizon past which the calendar quietly goes
-- blank. The row stores the rule; js/calendar.js works out which days it lands
-- on for the month you happen to be looking at.
--
-- The anchor is the existing `day`. An entry never appears BEFORE it: adding
-- Lucia's birthday on 2026-09-14 does not retroactively fill in 2019.

alter table calendar_events add column if not exists repeat text;

-- null is "just the once", so every row that already exists stays correct
-- without a backfill.
alter table calendar_events drop constraint if exists calendar_repeat;
alter table calendar_events add constraint calendar_repeat
  check (repeat is null or repeat in ('weekly', 'monthly', 'yearly'));

comment on column calendar_events.repeat is
  'null | weekly | monthly | yearly. The rule; `day` is the anchor it counts from.';

-- ------------------------------------------------------------------ check it
-- Expect one row: repeat, text, nullable.
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'calendar_events' and column_name = 'repeat';
