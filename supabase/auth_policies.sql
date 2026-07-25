-- Lucia ♥ Riu — lock the database down to the two of us.
--
-- ⚠️ RUN THIS *AFTER* the Google-login build is deployed to main, not before.
-- The app is written to work under BOTH the old and the new policies (it sends
-- a user JWT when it has one and falls back to the anon key when it doesn't),
-- so the safe order is: deploy → sign in once on both phones → run this.
-- Running it first would leave the live app unable to read anything until the
-- deploy lands.
--
-- WHAT THIS FIXES
-- Every table shipped with `for all to anon using (true) with check (true)`.
-- The anon key is in the page source of a public deployment, so that policy
-- meant: anyone with the app URL could read, edit and DELETE everything —
-- the journeys, the 🌙 Moon log (cycle + intimacy data), the 20 Questions
-- secret, and `settings.lock_keys`, which is the app password itself.
--
-- AFTER THIS
-- `anon` has no policy on any table, so an unauthenticated key gets nothing.
-- Only a signed-in Google account on the allowlist below can touch the data.

-- ---------------------------------------------------------------- allowlist
-- Signing in with Google is open to anyone with a Google account — Supabase
-- has no built-in signup allowlist. THIS FUNCTION is the actual gate: a
-- stranger can authenticate, but every policy below then returns false for
-- them, so they see an empty database.
--
-- 👉 EDIT THESE TWO ADDRESSES before running. They must be the exact Gmail
--    addresses you each sign in with.
create or replace function public.is_us()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'rew.cherdchu@gmail.com',
    'lucia@example.com'          -- ← replace with Lucia's Google address
  );
$$;

-- --------------------------------------------------------- drop the old ones
drop policy if exists "anon full access" on journeys;
drop policy if exists "anon full access" on settings;
drop policy if exists "anon full access" on questions;
drop policy if exists "anon full access" on album_cache;
drop policy if exists "anon full access" on food_photos;
drop policy if exists "anon full access" on food_tags;
drop policy if exists "anon full access" on food_photo_tags;

-- ------------------------------------------------------------- the new ones
-- `to authenticated` excludes the anon role entirely: no policy for anon
-- means no access for anon, which is exactly what we want.
create policy "us only" on journeys
  for all to authenticated using (public.is_us()) with check (public.is_us());

create policy "us only" on settings
  for all to authenticated using (public.is_us()) with check (public.is_us());

create policy "us only" on questions
  for all to authenticated using (public.is_us()) with check (public.is_us());

create policy "us only" on food_photos
  for all to authenticated using (public.is_us()) with check (public.is_us());

create policy "us only" on food_tags
  for all to authenticated using (public.is_us()) with check (public.is_us());

create policy "us only" on food_photo_tags
  for all to authenticated using (public.is_us()) with check (public.is_us());

-- album_cache gets NO policy at all. It's only ever touched by api/album.js,
-- which now uses the service-role key — and service_role bypasses RLS. That
-- also closes the old hole where anyone could call the public /api/album
-- endpoint and grow this table without bound.

-- ------------------------------------------------- the food bucket (storage)
-- supabase/food.sql granted anon INSERT and DELETE on every object in the
-- `food` bucket, so anyone with the app URL could delete the whole photo
-- library. Writes and deletes now require a signed-in one of us.
drop policy if exists "food read"   on storage.objects;
drop policy if exists "food write"  on storage.objects;
drop policy if exists "food delete" on storage.objects;

create policy "food read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'food');
create policy "food write" on storage.objects
  for insert to authenticated with check (bucket_id = 'food' and public.is_us());
create policy "food delete" on storage.objects
  for delete to authenticated using (bucket_id = 'food' and public.is_us());

-- ⚠️ READS ARE STILL OPEN, deliberately, and you should know exactly why.
-- The bucket is `public = true` (food.sql), which means Supabase serves every
-- object over an unauthenticated public URL — storage policies don't even
-- apply to that path. Flipping it to private would break the Food tab
-- outright: js/food.js uses those plain public URLs as <img> sources and would
-- have to start minting signed URLs instead.
--
-- The mitigation for now is that the URLs themselves become unguessable
-- secrets: after this script runs, the `food_photos` rows holding them are
-- readable only by us, so nobody can enumerate the library. Anyone who already
-- has a specific photo URL keeps access to that photo.
--
-- Proper fix, worth its own PR: set the bucket private and switch js/food.js
-- to createSignedUrl. Tracked in docs/ROADMAP.md.

-- ------------------------------------------------------------------ check it
-- Expect: journeys, settings, questions, food_photos, food_tags and
-- food_photo_tags each with ONE 'us only' policy for {authenticated} and
-- nothing for {anon}; album_cache with no policy at all; storage.objects with
-- 'food read' for {anon,authenticated} and food write/delete for
-- {authenticated} only. Any row still showing {anon} on a data table means
-- this script didn't fully apply.
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select relname, relrowsecurity
from pg_class
where relname in ('journeys', 'settings', 'questions', 'album_cache',
                  'food_photos', 'food_tags', 'food_photo_tags');

-- storage policies live in their own schema, so check them separately
select policyname, roles, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;


-- ================================================================= ROLLBACK
-- If the app can't read anything and you need the old behaviour back while
-- you debug, run this. It restores the wide-open policies — meaning anyone
-- with the app URL can read and delete everything again, so treat it as a
-- brief emergency measure, not a resting state.
--
-- drop policy if exists "us only" on journeys;
-- drop policy if exists "us only" on settings;
-- drop policy if exists "us only" on questions;
-- drop policy if exists "us only" on food_photos;
-- drop policy if exists "us only" on food_tags;
-- drop policy if exists "us only" on food_photo_tags;
-- create policy "anon full access" on journeys   for all to anon using (true) with check (true);
-- create policy "anon full access" on settings   for all to anon using (true) with check (true);
-- create policy "anon full access" on questions  for all to anon using (true) with check (true);
-- create policy "anon full access" on album_cache for all to anon using (true) with check (true);
-- create policy "anon full access" on food_photos     for all to anon using (true) with check (true);
-- create policy "anon full access" on food_tags       for all to anon using (true) with check (true);
-- create policy "anon full access" on food_photo_tags for all to anon using (true) with check (true);
-- create policy "food write"  on storage.objects for insert to anon, authenticated with check (bucket_id = 'food');
-- create policy "food delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'food');
