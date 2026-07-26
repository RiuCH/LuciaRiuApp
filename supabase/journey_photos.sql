-- ✈️ Trips: photos you upload directly, alongside the Apple-album embed.
--
-- Run this ONCE in the Supabase SQL editor. Safe before or after deploying:
-- the app checks whether the column exists and simply hides the upload button
-- until it does, so nothing breaks in between.
--
-- Same shape as gifts.photos — [{ "url": ..., "path": ... }] — and the files
-- go in the SAME `food` bucket under a `trips/` prefix, so they inherit the
-- signed-URL work from B1 with no second bucket to configure.
--
-- This does NOT replace album_url. An Apple album is someone else's library
-- that we borrow and that expires; these are ours. A trip can have both.

alter table journeys add column if not exists photos jsonb;

comment on column journeys.photos is
  'Directly-uploaded trip photos as [{url, path}]. Separate from album_url.';
