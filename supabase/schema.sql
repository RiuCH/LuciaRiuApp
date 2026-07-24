-- Lucia ♥ Riu app — Supabase schema
-- Run this once in the Supabase SQL editor (see docs/SUPABASE.md),
-- then run seed_questions.sql.

create table if not exists journeys (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  place text not null,
  start_date date not null,
  end_date date,
  description text,
  album_url text
);

-- shared key/value config: lock-screen password, reunion date, ...
create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists questions (
  id bigint generated always as identity primary key,
  category text not null, -- funny | romantic | spicy | nasty | ldr
  text text not null
);

alter table journeys enable row level security;
alter table settings enable row level security;
alter table questions enable row level security;

-- The app talks to these tables with the public anon key — it's a two-person
-- app behind a cute lock screen, not Fort Knox. The Google-login feature on
-- docs/ROADMAP.md will tighten these policies to just the two of us.
create policy "anon full access" on journeys for all to anon using (true) with check (true);
create policy "anon full access" on settings for all to anon using (true) with check (true);
create policy "anon full access" on questions for all to anon using (true) with check (true);

-- Lock-screen password: every accepted typing of June 2, 2026, comma-separated.
-- Change the value here (Table editor → settings) to change the app password.
insert into settings (key, value) values
  ('lock_keys', '0602,602,060226,06022026,622026,6226')
on conflict (key) do update set value = excluded.value;
