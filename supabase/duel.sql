-- Lucia ♥ Riu app — Word Duel shared state (v7)
-- Run once in the Supabase SQL editor. See docs/SUPABASE.md.
--
-- The duel used to live in one phone's memory. Now both phones read and write
-- this single row, so hearts, letters and the round agree on both sides.

create table if not exists duel (
  id int primary key default 1,
  hearts_lucia int not null default 5,
  hearts_riu int not null default 5,
  round int not null default 1,
  l1 text,                       -- current start letter
  l2 text,                       -- current end letter
  play_mode text not null default 'say',   -- say | type
  word_lucia text,               -- this round's typed answers
  word_riu text,
  -- Who got their answer in first. Set with a `first_by=is.null` filter so
  -- Postgres decides the race, not two phone clocks that may disagree.
  first_by text,
  penalty_mode text not null default 'ldr',   -- inperson | ldr (the two situations)
  penalty text,                  -- the spun penalty, shared so both read the same one
  updated_at timestamptz not null default now(),
  constraint duel_single_row check (id = 1)
);

insert into duel (id) values (1) on conflict (id) do nothing;

alter table duel enable row level security;
create policy "anon full access" on duel for all to anon using (true) with check (true);
