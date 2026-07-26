-- Lucia ♥ Riu — ⭐ Someday gains a fourth kind: 🎢 activity
-- Run once in the Supabase SQL editor.
--
-- WHY THIS IS NEEDED AT ALL
-- supabase/someday.sql pinned the allowed kinds in a CHECK constraint:
--
--   constraint wishes_kind check (kind in ('place','restaurant','thing'))
--
-- so Postgres rejects an 'activity' row outright. Shipping the UI without this
-- would look like a broken Add button: the wish appears (the app is optimistic)
-- and then silently fails to save. Run this and it saves for real.

alter table wishes drop constraint if exists wishes_kind;
alter table wishes add  constraint wishes_kind
  check (kind in ('place','restaurant','thing','activity'));

-- ------------------------------------------------------------------ check it
-- Expect one row, with 'activity' among the allowed values.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'wishes'::regclass and conname = 'wishes_kind';
