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
| `journeys` | timeline entries (place, dates, description, album link, chosen photo picks) | seed entry + in-memory adds |
| `settings` | `lock_keys` (password), `reunion_date` (shared countdown) | hardcoded `LOCK_KEYS`, `#reunion=` hash param |
| `questions` | the full question bank (`category`, `text`) | hardcoded `BANK` |

- **Change the password:** Table editor → `settings` → edit the `lock_keys`
  value (comma-separated list of accepted typings).
- **Set the reunion date:** just use the app — "📅 Set the date" now writes
  to the DB, so it appears on both phones.
- **Add questions:** add them to `BANK` in `index.html` **and** re-run the
  seed (see below) so online and offline phones agree.

## Migrations

Projects set up before v6 need one-off migrations, run in the SQL editor:

- `supabase/migrate_journey_photos.sql` — adds `journeys.photo_guids`
  (the "pick which album photos show" feature). Fresh installs from
  `schema.sql` already have it.

## Keeping questions in sync

`supabase/seed_questions.sql` is generated from `BANK` in `index.html` —
per-category order must match exactly, or the shared daily pick diverges
between an online phone (DB copy) and an offline one (hardcoded copy).
After editing `BANK`, regenerate and re-apply:

```bash
python3 supabase/generate_seed.py     # rewrites seed_questions.sql from index.html
# then in the Supabase SQL editor:
#   delete from questions;
#   (paste the new seed_questions.sql)
```

## Security, honestly

The anon key ships in the page source, and the RLS policies let that key
read *and write* everything — including the lock password. That's the same
"cute gate, not security" model the lock screen always had: the protection
is that nobody has the URL + key. The **Google login** feature
(docs/ROADMAP.md, next up) replaces these open policies with real
two-person auth. Until then, don't put anything truly sensitive in the DB.
