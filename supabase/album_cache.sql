-- Lucia ♥ Riu app — durable album-metadata cache (v6.3)
-- Run once in the Supabase SQL editor. See docs/SUPABASE.md.
--
-- Why this exists: iCloud's `webstream` call returns metadata for EVERY photo
-- in a shared album and is brutally slow — measured at 50 seconds for our
-- 365-photo "SF trip" album. api/album.js keeps an in-memory copy, but Vercel
-- instances go cold between visits (there are two of us), so somebody kept
-- paying that 50s. Parking the metadata here makes it survive cold starts.
--
-- Only the fields we actually use are stored (guid, media type, derivative
-- checksums/sizes) — never the signed asset URLs, which are short-lived and
-- are always re-fetched per request.

create table if not exists album_cache (
  token text primary key,          -- the shared-album token from the iCloud link
  name text,                       -- album title, for the picker header
  photos jsonb not null,           -- slimmed photo metadata
  fetched_at timestamptz not null default now()
);

alter table album_cache enable row level security;

-- Same posture as the other tables: public anon key, two-person app behind a
-- cute lock screen. Nothing private lives here — it's derived from an album
-- that is already publicly shared by its link.
create policy "anon full access" on album_cache for all to anon using (true) with check (true);
