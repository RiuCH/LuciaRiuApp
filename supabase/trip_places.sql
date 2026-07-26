-- 🗓️ Trip Plan → the day-by-day itinerary (task F1).
--
-- Run this ONCE in the Supabase SQL editor, after auth_policies.sql (it
-- reuses public.is_us()). Until it's run, the Itinerary button says so and
-- the rest of Trip Plan carries on exactly as before.
--
-- There is deliberately NO `trip_days` table. A trip already knows its dates,
-- so the days are derived from them — and a place with `day_date = null` is
-- simply one we've saved but not scheduled yet, which is the bucket every
-- itinerary app needs anyway. One table instead of two, and no way for the
-- days to drift out of sync with the trip.
--
-- Also deliberately NO `rating`: this planner is built on OpenStreetMap and
-- Wikipedia, neither of which has ratings. A column nobody can fill is worse
-- than an absent one — see Track F on the sessions board.

create table if not exists trip_places (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  journey_id bigint not null references journeys (id) on delete cascade,

  day_date date,                                  -- null = saved, not scheduled yet
  position int not null default 0,                -- order within its day

  name text not null,
  kind text not null default 'see',               -- see | eat | hotel | flight | other
  address text,
  lat double precision,
  lon double precision,
  website text,
  note text,
  recommended_by text,                            -- "Sarah said the rooftop"

  -- filled by F2 (OSM/Wikipedia autofill); harmless until then
  provider text,
  provider_id text,
  photo_url text,
  hours text,
  summary text
);

create index if not exists trip_places_journey_idx
  on trip_places (journey_id, day_date, position);

alter table trip_places enable row level security;

drop policy if exists "us only" on trip_places;
create policy "us only" on trip_places
  for all to authenticated using (public.is_us()) with check (public.is_us());
