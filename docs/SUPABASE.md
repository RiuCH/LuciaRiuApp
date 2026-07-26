# Supabase setup (the backend, finally)

The app now syncs through Supabase: the journeys timeline, the reunion
countdown date, the lock-screen password, and the whole question bank live
in a shared Postgres DB. **Without it the app still fully works** — it just
falls back to the hardcoded copies and in-memory state ("local mode").

## One-time setup (a human does this, ~5 minutes)

1. Go to https://supabase.com → sign up (free tier) → **New project**.
   Name it `lucia-riu-app`, pick a nearby region (US West), set any strong
   database password (you'll never need it in the app).
2. In the project: **SQL Editor** → paste & run [`supabase/schema.sql`](../supabase/schema.sql)
   → then paste & run [`supabase/seed_questions.sql`](../supabase/seed_questions.sql).
3. **Project Settings → API**: copy the **Project URL** and the
   **anon public** key.
4. In `index.html`, find the JOURNEYS block and fill in:
   ```js
   const SUPABASE_URL = "https://YOURPROJECT.supabase.co";
   const SUPABASE_ANON_KEY = "eyJ...";
   ```
5. Commit → push to `main` → Vercel deploys → both phones refresh.
   The Journeys tab status line should now say "Synced 💞".

## What lives where

| Table | Contents | App fallback when unreachable |
|---|---|---|
| `journeys` | timeline entries (place, dates, description, album link) | seed entry + in-memory adds |
| `settings` | `lock_keys` (password), `reunion_date` (shared countdown), `home_photo` (home photo: URL, upload data-URL, or `album:<link>`), `duel_state` + `duel_first` (Word Duel — see below), `q20_state` (20 Questions, JSON) | hardcoded `LOCK_KEYS`, `#reunion=` / `#photo=` hash params |
| `questions` | the full question bank (`category`, `text`) | hardcoded `BANK` |
| `questions` | the full prompt bank (`category`, `text`) — 345 rows in 11 categories: the Question-of-the-Day pool, the Talk/Flirt decks, and both Dare decks | hardcoded `BANK` |
| `food_photos` / `food_tags` / `food_photo_tags` | the 🍜 Food library: one row per photo (url, path, `taken_at`, GPS), the tag catalogue with a `kind`, and the links between them | none — the tab says to run `supabase/food.sql` |
| `gifts` | 🎁 the given-half log: what, who gave it, when, occasion, note, and the photo's storage `path` (in the `food` bucket under `gifts/`) | none — the pane says to run `supabase/gifts.sql` |
| `answers` | Answer & compare: one row per `(day, who)` with the text. The unique index IS the "locked once submitted" rule | none — the Home card says to run `supabase/answers.sql` |
| `album_cache` | slimmed iCloud shared-album metadata, keyed by album token — written and read by `api/album.js`, never by the browser | fetch straight from iCloud (correct, just slow) |

- **Change the password:** Table editor → `settings` → edit the `lock_keys`
  value (comma-separated list of accepted typings).
- **Set the reunion date:** just use the app — "📅 Set the date" now writes
  to the DB, so it appears on both phones.
- **Add questions:** add them to `BANK` in `index.html` **and** re-run the
  seed (see below) so online and offline phones agree.

## Migrations

Projects set up before v6 need one-off migrations, run in the SQL editor.

> **Status (2026-07-26): every migration below has been run on this project.**
> A fresh clone still needs them in order; this list is also the record of what
> exists, so add a bullet here in the same PR as any new `.sql` file — two were
> missed and only caught later.

- `supabase/money.sql` — 💸 Money (task E2): the `expenses` table (`topup` /
  `spend` rows — a pot, not Splitwise) plus `wishes.committed`, the flag that
  drives the `pot − committed = left` simulation. Needs `someday.sql` first,
  since it alters `wishes`. Until it's run the 📋 Plan strip says so and keeps
  the pot in memory.
- `supabase/someday.sql` — ⭐ Someday + 🗓️ Trip Plan (task E1): the `wishes`
  table, plus `journeys.status` and `journeys.est_cost`. Those two columns are
  what make a 🗓️ Trip Plan a `journeys` row with `status = 'planned'` rather
  than a second table — a plan graduates into a memory in place. Existing rows
  are stamped `'past'` by the script.
- `supabase/food_private.sql` — flips the `food` bucket to `public = false`
  (task B1) so photos are served by signed URL instead of a permanent
  unauthenticated one. Re-running `food.sql` afterwards would undo it.
- `supabase/food_split_place.sql` — splits the Food tab's old `place` tag
  kind into `city` and `country` (2026-07-26). Optional: the app shows any
  leftover `place` tag under 🏙️ City regardless, and this repo's project was
  already migrated over the REST API.
- `supabase/gifts.sql` — the 🎁 Gifts table (task D1). Needs
  `auth_policies.sql` first. No new bucket: gift photos live in the
  existing `food` bucket under a `gifts/` prefix, so they inherit its
  policies and B1's signed URLs.
- `supabase/answers.sql` — the ✍️ Answer & compare table (task C1). Run
  `auth_policies.sql` first: it reuses `public.is_us()`.
- `supabase/food.sql` — the 🍜 Food tab: three tables, the `food` storage
  bucket and its policies. Until it's run, the Food tab is switched off and
  says so. This is the only feature that needs a **storage bucket**, which
  is why it can't create itself: the anon key may not create buckets.
- `supabase/album_cache.sql` — adds the `album_cache` table (v6.3). Until
  you run it, the app still works — album metadata is simply fetched from
  iCloud every time, which is the ~50s wait it exists to remove.
- `supabase/migrate_journey_photos.sql` — adds `journeys.photo_guids`
  (the "pick which album photos show" feature). Fresh installs from
  `schema.sql` already have it.

## Keeping questions in sync

`supabase/seed_questions.sql` is generated from `BANK` in `index.html` —
per-category order must match exactly, or the shared daily pick diverges
between an online phone (DB copy) and an offline one (hardcoded copy).
After editing `BANK`, regenerate and re-apply:

**For a project that already has rows, append — don't reseed.** Add new
questions at the END of their category array in `js/questions.js`, then:

```bash
python3 supabase/append_questions.py            # dry run — shows the diff
python3 supabase/append_questions.py --apply    # inserts, then verifies
```

It aborts if the stored rows aren't a prefix of `BANK` (order drift would
desync the two copies), and never deletes anything.

For a brand-new project, generate and paste the whole seed instead:

```bash
python3 supabase/generate_seed.py     # rewrites seed_questions.sql from js/questions.js
# then paste supabase/seed_questions.sql into the Supabase SQL editor
```

## Why `album_cache` exists

iCloud's `webstream` endpoint returns metadata for *every* photo in a shared
album and is punishingly slow — **50 seconds** for our 365-photo "SF trip"
album, versus ~1s for `webasseturls`, the call that mints the actual image
links. `api/album.js` needs `webstream` only for the guid list and the
derivative checksums, and that barely changes, so it's cached in three tiers:

1. **warm instance memory** — instant
2. **`album_cache` in Supabase** — ~100ms, and unlike memory it survives the
   cold starts that a two-person app hits constantly
3. **iCloud** — ~50s, only on a genuinely first-ever fetch

Anything already cached is served immediately and refreshed in the background
after an hour. Only the slim fields are stored (guid, media type, derivative
checksums/sizes) — **never the signed asset URLs**, which expire and are
re-minted per request, so a stale cache can never produce a broken image.
The trade-off: a photo added to the album may take up to an hour to appear.

## The Word Duel needs no migration

Word Duel shares its state through two ordinary `settings` rows, created on
first write — there is nothing to run. `duel_state` is the game as JSON
(hearts, round, letters, answers, penalty); `duel_first` records who got
their answer in first, claimed with a PATCH filtered on `value=eq.`
(empty), so Postgres settles the race rather than two phone clocks.

It briefly used a dedicated `duel` table, which meant nothing synced at all
until someone remembered to run a migration — while the panel cheerfully
claimed hearts were shared. The status line now reports what's actually
happening instead.

## Security, honestly

The anon key ships in the page source, and the RLS policies let that key
read *and write* everything — including the lock password. That's the same
"cute gate, not security" model the lock screen always had: the protection
is that nobody has the URL + key. The **Google login** feature
(docs/ROADMAP.md, next up) replaces these open policies with real
two-person auth. Until then, don't put anything truly sensitive in the DB.
