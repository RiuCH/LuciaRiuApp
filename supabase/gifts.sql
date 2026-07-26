-- 🎁 Gifts (task D1) — the record of what we've actually GIVEN each other.
--
-- Run this ONCE in the Supabase SQL editor, after auth_policies.sql (it
-- reuses public.is_us()). Until it's run the Gifts pane says so and the rest
-- of 💝 Treats is unaffected.
--
-- Photos go in the EXISTING `food` bucket under a `gifts/` prefix rather than
-- a bucket of their own: B1 already taught the app to mint signed URLs for
-- that bucket, so gifts inherit the private-bucket work (roadmap #7) with no
-- second set of storage policies to configure and nothing extra to run.
--
-- A project created before 2026-07-26 predates `photos` — run
-- supabase/gifts_photos.sql to add it. The app works either way.
--
-- Deliberately NO price column. Roadmap #4: putting a number on a gift turns
-- it into an expense, and expenses belong to 💸 Money. Also no `wanted`
-- status — a gift you *want* is a Someday wish (#5 / task E1), not a row here.

create table if not exists gifts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  title text not null,                                   -- what it was
  giver text not null check (giver in ('riu', 'lucia')), -- who gave it
  given_on timestamptz,                                  -- wall clock, like food.taken_at
  occasion text,                                         -- 'birthday', 'anniversary', 'just because'…
  note text,
  url text,                                              -- first photo: stored fallback URL
  path text,                                             -- first photo: object path (signed + deleted)
  photos jsonb                                           -- up to 3 as [{url, path}]; url/path mirror the first
);

create index if not exists gifts_given_on_idx on gifts (given_on desc);

alter table gifts enable row level security;

drop policy if exists "us only" on gifts;
create policy "us only" on gifts
  for all to authenticated using (public.is_us()) with check (public.is_us());
