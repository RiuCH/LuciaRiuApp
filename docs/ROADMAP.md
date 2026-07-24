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
3. **Photo album** 📸 — Supabase Storage + a gallery tab. Needs login
   first. (Partial today: journeys embed Apple Shared Albums.)
4. **Answer & compare** ✍️ — both type answers to the daily question, reveal
   together. Needs Supabase DB. This is the feature that makes the daily
   question 10x better, but do login first.
5. **Claude features** 🤖 — a Vercel serverless function proxying the Claude
   API (key stays server-side). Ideas: generate fresh questions weekly,
   "settle our debate" button, date-night idea generator.

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
