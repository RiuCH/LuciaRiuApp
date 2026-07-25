-- 🍜 Food tab — photos, tags, and the storage bucket they live in.
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → paste →
-- Run). Until it's run, the Food tab says so instead of half-working.
--
-- Why tables and not a `settings` row like the games: a growing photo library
-- with tags needs to be queried and updated a row at a time. One JSON blob
-- would be rewritten in full on every single edit.

-- ---------- the photos ----------
create table if not exists food_photos (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  url text not null,               -- public URL in the `food` storage bucket
  path text not null,              -- object path, so we can delete the file too
  taken_at timestamptz,            -- from the photo's EXIF; falls back to upload time
  lat double precision,            -- EXIF GPS, kept even when we can't name the place
  lon double precision,
  caption text,
  source text default 'upload'     -- 'upload' | 'album'
);

create index if not exists food_photos_taken_at_idx on food_photos (taken_at desc);

-- ---------- the tags ----------
-- kind drives the "show me everything by …" groupings in the tab.
create table if not exists food_tags (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  kind text not null default 'other'   -- restaurant | dish | place | other
);

create unique index if not exists food_tags_name_kind_idx
  on food_tags (lower(name), kind);

-- ---------- which tags are on which photo ----------
create table if not exists food_photo_tags (
  photo_id bigint not null references food_photos (id) on delete cascade,
  tag_id bigint not null references food_tags (id) on delete cascade,
  primary key (photo_id, tag_id)
);

alter table food_photos enable row level security;
alter table food_tags enable row level security;
alter table food_photo_tags enable row level security;

-- Same "cute gate, not Fort Knox" model as the rest of the app: the anon key
-- ships in the page source, and Google login (docs/ROADMAP.md) is what
-- tightens all of these later.
drop policy if exists "anon full access" on food_photos;
drop policy if exists "anon full access" on food_tags;
drop policy if exists "anon full access" on food_photo_tags;
create policy "anon full access" on food_photos     for all to anon using (true) with check (true);
create policy "anon full access" on food_tags       for all to anon using (true) with check (true);
create policy "anon full access" on food_photo_tags for all to anon using (true) with check (true);

-- ---------- the bucket the images actually live in ----------
insert into storage.buckets (id, name, public)
values ('food', 'food', true)
on conflict (id) do update set public = true;

drop policy if exists "food read"   on storage.objects;
drop policy if exists "food write"  on storage.objects;
drop policy if exists "food delete" on storage.objects;
create policy "food read"   on storage.objects for select to anon, authenticated using (bucket_id = 'food');
create policy "food write"  on storage.objects for insert to anon, authenticated with check (bucket_id = 'food');
create policy "food delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'food');
