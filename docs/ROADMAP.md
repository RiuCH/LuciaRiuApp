# Roadmap

## Shipped
- **v1–v4 (Jul 24 2026):** Question of the Day (5 categories, shared daily
  pick, After Dark mode) → LDR mode (SF/Phoenix clocks, reunion countdown,
  miss-you generator) → anniversary bar (together-clock since Jun 2 2026 +
  countdown, party mode on the day) → tabbed app (Home / Daily Q / Soon™) →
  GitHub + Vercel deploy: https://lucia-riu-app.vercel.app
- **v5 (Jul 24 2026): Journeys timeline + Supabase backend.** New ✈️ Trips
  tab: timeline of trips (place/dates/description), add/delete in-app,
  Apple Shared Album photo grids embedded per journey (unofficial iCloud
  web API, falls back to a link). First Supabase integration (plain REST,
  no SDK): `journeys` table, `settings` (lock password + shared reunion
  date), `questions` (the whole bank). Everything degrades gracefully to
  the old hardcoded/in-memory behavior when Supabase is unreachable or not
  configured. Setup: docs/SUPABASE.md.

## Next up (v5 candidates — pick one, keep PRs small)

1. **Stupid Game #2** 🕹️ — the reserved tab. Ideas: guess-my-answer duel,
   couple trivia, daily dare generator, emoji-story decoder. No backend
   needed if it follows the shared-daily pattern (see add-new-game skill).
2. **Google login** 🔐 — Supabase Auth, allowlist exactly two emails
   (Riu + Lucia). The backend now exists (v5) with wide-open anon RLS
   policies — this feature tightens them to just the two of us.
3. **Photo album** 📸 — ~~Supabase Storage + a gallery tab~~ **shipped as the
   🍜 Food tab (2026-07-25)**: uploads, EXIF dates, GPS→city tags, a tag
   system and shared-album import. Still worth doing after login: the
   bucket is world-readable today, same as every other table.
4. **Answer & compare** ✍️ — both type answers to the daily question, reveal
   together. Needs Supabase DB. This is the feature that makes the daily
   question 10x better, but do login first.
5. **Claude features** 🤖 — a Vercel serverless function proxying the Claude
   API (key stays server-side). Ideas: generate fresh questions weekly,
   "settle our debate" button, date-night idea generator.
6. **Money** 💸 — **Splitwise, but for two.** Log a shared expense (who paid,
   how much, what for) and the app keeps a running "who owes whom".

   The thing that makes this small: **with exactly two people the entire
   ledger collapses to one signed number.** No debt-simplification graph, no
   shares matrix, no group members — just a balance that swings toward Riu or
   toward Lucia. Most of Splitwise is machinery for the N-person case we
   don't have.

   - **Split per expense:** 50/50 (default), "this one's on me", or a custom
     amount. An expense is `{ payer, total, your_share, what, when }`.
   - **Settle up** writes a zeroing entry rather than deleting rows — we want
     the history, and a delete-based settle makes the balance unauditable.
   - **Hook it to ✈️ Trips:** let an expense carry a `journey_id`, so a trip
     can show what it cost us. That's the feature's best excuse to exist.
   - **This one needs a real table** (`expenses`), unlike everything since
     v7 which has fitted into `settings` key/value rows. So it ships with a
     migration in `supabase/` — and per golden rule 6 it must still degrade
     to a session-only ledger when the DB is unreachable, and *say so*
     instead of pretending it saved. Money silently not saving is worse
     than money visibly not saving.
   - **Do Google login (#2) FIRST — this is the feature that makes it
     non-optional.** Today the anon key ships in the deployed page source
     and the RLS policies let that key read *and write* every table, so
     anyone who has the app URL has the data — repo visibility doesn't
     enter into it (see "Security, honestly" in docs/SUPABASE.md). That's a
     fine trade for questions and trip photos; it is the wrong trade for a
     record of what we owe each other.
   - **Where it lives:** the nav is full at four buttons, so it goes either
     inside ✈️ Trips or behind its own entry point (see the 🎮 Games hub and
     the 🌙 Moon quiet-door patterns in the `add-new-game` skill).
   - Currency: we're both in USD day to day, so don't build FX up front —
     but if it's hooked to Trips, an abroad trip will want a per-expense
     currency eventually. Leave room for the column; don't write the
     converter yet.

## Agreed platform plan
- **Hosting:** Vercel (static now; serverless functions when needed)
- **Backend when needed:** Supabase — Postgres + file storage + auth
  (Google sign-in), free tier
- **Repo:** private, both partners collaborators, deploy = push to `main`

## Parking lot
- Real streak tracking (needs DB)
- Custom question packs the couple writes for each other
- Push notification "your person answered today" (needs backend + PWA work)
- PWA manifest + icon so Add-to-Home-Screen looks native
