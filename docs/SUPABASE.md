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
| `journeys` | timeline entries (place, dates, description, album link, `photos` = our own uploads) | seed entry + in-memory adds |
| `settings` | `lock_keys` (password), `reunion_date` (shared countdown), `home_photo` (home photo: URL / data-URL / `album:<link>`), shared game/theme state, and `moodboard_prompts` + `moodboard_lucia` + `moodboard_riu` | hardcoded `LOCK_KEYS`, hash fallbacks where safe, and in-memory moodboard preview |
| `questions` | the full question bank (`category`, `text`) | hardcoded `BANK` |
| `questions` | the full prompt bank (`category`, `text`) — 345 rows in 11 categories: the Question-of-the-Day pool, the Talk/Flirt decks, and both Dare decks | hardcoded `BANK` |
| `food_photos` / `food_tags` / `food_photo_tags` | the 🍜 Food library: one row per photo (url, path, `taken_at`, GPS), the tag catalogue with a `kind`, and the links between them | none — the tab says to run `supabase/food.sql` |
| `gifts` | 🎁 the given-half log: what, who gave it, when, occasion, note, and the photo's storage `path` (in the `food` bucket under `gifts/`) | none — the pane says to run `supabase/gifts.sql` |
| `answers` | Answer & compare: one row per `(day, who)` with the text. The unique index IS the "locked once submitted" rule | none — the Home card says to run `supabase/answers.sql` |
| `calendar_events` | 📅 the shared calendar: one row per entry (`day`, `at`, `title`, `note`, `who`) | none — the Home card says to run `supabase/calendar.sql` |
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

- `supabase/auth_policies.sql` — the lockdown (v10): every table becomes
  us-only via `public.is_us()`. **It ships with a placeholder second address
  (`lucia@example.com`) and a 👉 comment telling you to edit it.** Run it
  unedited and the second person can still sign in — the allowlist is a
  separate gate — but sees an empty app everywhere, because `is_us()` gates
  reads on every table *and* on `storage.objects`, and a private bucket needs
  `select` on the object even to mint a signed URL. Blank photos are the
  symptom; the cause is one string. Fix by re-running just the
  `create or replace function public.is_us()` block with both real addresses,
  and keep `allowed_emails` agreeing with it. No re-deploy needed.
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
- `supabase/gifts_photos.sql` — adds `gifts.photos` (up to 3 photos per
  gift). Safe to run before or after deploying: the app detects the column
  and falls back to the single `url`/`path` pair without it.
- `supabase/gifts.sql` — the 🎁 Gifts table (task D1). Needs
  `auth_policies.sql` first. No new bucket: gift photos live in the
  existing `food` bucket under a `gifts/` prefix, so they inherit its
  policies and B1's signed URLs.
- `supabase/trip_places.sql` — the 🗓️ day-by-day itinerary (task F1). No
  `trip_days` table: days are derived from the trip's own dates, and
  `day_date = null` is the saved-but-unscheduled bucket.
- `supabase/answers.sql` — the ✍️ Answer & compare table (task C1). Run
  `auth_policies.sql` first: it reuses `public.is_us()`.
- `supabase/food.sql` — the 🍜 Food tab: three tables, the `food` storage
  bucket and its policies. Until it's run, the Food tab is switched off and
  says so. This is the only feature that needs a **storage bucket**, which
  is why it can't create itself: the anon key may not create buckets.
- `supabase/album_cache.sql` — adds the `album_cache` table (v6.3). Until
  you run it, the app still works — album metadata is simply fetched from
  iCloud every time, which is the ~50s wait it exists to remove.
- `supabase/calendar.sql` — the 📅 calendar on Home: one table plus its RLS.
  Until it's run the card renders (it's a real month either way) and says to
  run it; nothing can be added. `day` is a `date` and `at` is free text on
  purpose — see the comments in the file.
- `supabase/calendar_repeat.sql` — adds `calendar_events.repeat`
  (`weekly | monthly | yearly`, null = once), for birthdays and anniversaries.
  ONE column, not a table of occurrences: the row stores the rule and
  `js/calendar.js` works out which days it lands on. Until it's run the repeat
  picker hides and the calendar keeps saving one-off entries.
- `supabase/journey_photos.sql` — adds `journeys.photos` (jsonb), the trip's
  own uploaded photos as `[{url, path}]`. Until it's run, ✈️ Trips still shows
  and syncs everything else; the "📸 Add photos" button simply doesn't appear.
  The files go in the **existing `food` bucket** under a `trips/` prefix, so
  there is no second bucket to create or make private.
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

## 🔔 Notification setup (VAPID keys)

Run `supabase/push.sql` once, then generate a keypair. **Paste this into a
browser console — not a terminal.** It never leaves the page, so the private
half doesn't pass through a shell history or an editor buffer:

```js
const kp = await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"}, true, ["sign","verify"]);
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
const b64 = u => btoa(String.fromCharCode(...u)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
console.log("VAPID_PUBLIC :", b64(raw));
console.log("VAPID_PRIVATE:", jwk.d);
```

Then:

| Where | What |
|---|---|
| `js/push.js` → `VAPID_PUBLIC` | the public half. It ships in the page exactly like the anon key — it's an identifier, not a secret. **Until it's filled in the toggle stays hidden**, which is why this is safe to deploy first. |
| Vercel → `LR_VAPID_PUBLIC` | the same public value (the sender derives the JWK `x`/`y` from it, so there's no third secret to store) |
| Vercel → `LR_VAPID_PRIVATE` | the private half. Server only. |
| Vercel → `LR_VAPID_SUBJECT` | `mailto:you@example.com` — a contact address, required by the VAPID spec |

Env vars only take effect on a new build, so redeploy after setting them.

Then, **on each phone**: open the app *from the Home Screen icon* (iOS gives a
Safari tab no Push API at all), ⚙️ → Notifications → 🔔 Turn on. Say yes to the
iOS prompt — there's only one, and a "no" can only be undone in iOS Settings.
Two rows should appear in `push_subs`, one per address.

To test: add a wish on one phone and watch the other. If nothing arrives, check
the Vercel function log for `/api/notify` — it returns `{sent, pruned}`, so
`sent: 0` means it found no subscription for the other address, while a 503
means an env var is missing.

## Security, honestly

The anon key ships in the page source, and the RLS policies let that key
read *and write* everything — including the lock password. That's the same
"cute gate, not security" model the lock screen always had: the protection
is that nobody has the URL + key. The **Google login** feature
(docs/ROADMAP.md, next up) replaces these open policies with real
two-person auth. Until then, don't put anything truly sensitive in the DB.
