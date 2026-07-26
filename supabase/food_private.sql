-- Lucia ♥ Riu — close the food bucket. Roadmap #7, task B1.
--
-- ⚠️ RUN THIS *AFTER* the signed-URL build is deployed to main.
-- js/food.js has to be able to mint signed URLs BEFORE the bucket stops
-- serving public ones, or every photo in the tab 404s. The code is written to
-- work either way round (it falls back to the stored public URL whenever a
-- signature isn't ready), so the safe order is: deploy → check the Food tab
-- still shows photos → run this → check again.
--
-- Prerequisite: supabase/auth_policies.sql, which creates public.is_us().
--
-- WHAT THIS FIXES
-- supabase/food.sql created the bucket with `public = true`. A public bucket
-- is served over an unauthenticated URL and storage policies DON'T APPLY to
-- that path at all — so every photo has been readable by anyone holding its
-- URL, regardless of RLS. auth_policies.sql closed the enumeration route (the
-- food_photos rows holding those URLs became us-only) but could not close this
-- one without the app losing its images.

-- ---------------------------------------------------------------- the bucket
update storage.buckets set public = false where id = 'food';

-- ----------------------------------------------------------------- the reads
-- With the bucket private, this policy is what governs both direct reads and
-- the creation of signed URLs — /object/sign requires select on the object.
-- So it has to allow us, and only us.
drop policy if exists "food read" on storage.objects;
create policy "food read" on storage.objects
  for select to authenticated using (bucket_id = 'food' and public.is_us());

-- Writes and deletes were already tightened by auth_policies.sql; restated
-- here so this file describes the whole final state of the bucket rather than
-- half of it.
drop policy if exists "food write"  on storage.objects;
drop policy if exists "food delete" on storage.objects;
create policy "food write" on storage.objects
  for insert to authenticated with check (bucket_id = 'food' and public.is_us());
create policy "food delete" on storage.objects
  for delete to authenticated using (bucket_id = 'food' and public.is_us());


-- ------------------------------------------------------------------ check it
-- public should now be false:
select id, name, public from storage.buckets where id = 'food';

-- expect exactly three policies, all {authenticated}, none mentioning anon:
select policyname, roles, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- Sanity: this should return rows for you while signed in, and nothing at all
-- for the anon key. `food_photos.url` still holds the old public URLs — they
-- are dead links from now on and nothing reads them; js/food.js derives views
-- from `path`. Left in place deliberately: they cost nothing, and dropping the
-- column would break any client still running the previous build.
select id, path, taken_at from food_photos order by taken_at desc limit 5;


-- ================================================================= ROLLBACK
-- Photos vanishing from the tab most likely means the deploy hadn't landed.
-- This puts the bucket back to publicly readable — i.e. every photo readable
-- by anyone with its URL again, so it's a stopgap, not a resting place.
--
-- update storage.buckets set public = true where id = 'food';
-- drop policy if exists "food read" on storage.objects;
-- create policy "food read" on storage.objects
--   for select to anon, authenticated using (bucket_id = 'food');
