-- 🍜 Food (2026-07-26): the single `place` tag kind splits into `city` and
-- `country`, so the tab can group by each separately.
--
-- You do NOT have to run this by hand — the app can do it over the REST API,
-- and the Food tab keeps showing any leftover `place` tags under 🏙️ City in
-- the meantime, so nothing disappears if it's never run. This file exists so
-- the change is reproducible on a fresh project.
--
-- Countries are matched by name against what the geocoder actually returns
-- (api/geocode.js passes through OpenStreetMap's `address.country`), so this
-- list only needs the countries you've actually eaten in. Anything left over
-- is a city.

update food_tags
   set kind = 'country'
 where kind = 'place'
   and name in (
     'United States', 'Canada', 'Mexico', 'Japan', 'Thailand', 'Italy',
     'France', 'Spain', 'Portugal', 'Germany', 'United Kingdom', 'Ireland',
     'South Korea', 'China', 'Taiwan', 'Vietnam', 'Singapore', 'Malaysia',
     'Indonesia', 'Philippines', 'India', 'Australia', 'New Zealand',
     'Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Greece',
     'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Czechia',
     'Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland', 'Poland',
     'Türkiye', 'Turkey', 'Morocco', 'Egypt', 'South Africa'
   );

-- everything still marked `place` is a city
update food_tags set kind = 'city' where kind = 'place';
