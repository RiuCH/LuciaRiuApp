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
- **v6 (Jul 24 2026): Journeys polish + the modular split.** Trips gained
  edit, a paged photo picker (`journeys.photo_guids`), sort chips and videos;
  the couple photo landed on Home (`settings.home_photo`, incl. Apple-album
  photo-of-the-day). First serverless function, `api/album.js` (iCloud sends
  no CORS headers), later 3-tier cached — the picker went **50s → ~1s**. Photo
  bytes now load only when Trips is opened (`TAB_HOOKS`). Desktop layout as a
  single `@media (min-width:900px)` block. And the big one: `index.html`
  2483 → 263 lines, split into `css/*` + `js/*`, one tab per file. Golden
  rule #1 became "no build step" — **classic scripts only, never ES modules**.
- **v7 (Jul 25 2026): Talk · Flirt · Dare, and the bank got serious.** The
  Daily Q tab became 🎭 Talk (`tfd`): three decks, one 💞 Together / ✈️ Apart
  switch that also runs the app hot (replacing After Dark). Question of the
  Day moved to a Home card. Bank **135 → 345 prompts** across 11 categories,
  and `dailyQuestion()` now deals from a seeded, shuffled *deck* — no repeat
  until the pool is exhausted, still identical on both phones with no server.
- **v8 (Jul 25 2026): the 🎮 Games hub.** Word Duel got shared hearts, a
  typing race settled by Postgres (`first_by=is.null`, not two phone clocks)
  and 100 situation-based penalties; then 🎯 20 Questions joined it behind a
  chooser (`gamesPick`). Both sync through `settings` key/value rows, so
  **neither needed a migration**. Plus 🌙 Moon: the first **nav-less tab** —
  cycle calendar and our tally, reached by long-pressing the header ♥.
- **v9 (Jul 25–26 2026): 🍜 Food.** Every meal we've eaten together. First use
  of **Supabase Storage**; uploads resized to 1600px in-browser, EXIF capture
  date and GPS read by hand (no deps), `api/geocode.js` turning GPS into
  city/country tags, `api/food-import.js` copying shared-album photos into our
  bucket (Apple's album API is read-only). Tag catalogue with search, and a
  foldable organise panel.
- **v10 (Jul 26 2026): login, the app icon, and the idle bill.**
  - 🔐 **Google sign-in** via Supabase Auth, no SDK — PKCE is impossible under
    our storage rule, so it uses the implicit flow and scrubs the tokens out
    of the URL in the same tick. `supabase/auth_policies.sql` closes the
    database to everyone but the two of us; signed out, the app now falls
    back to its offline copy instead of reading real data.
  - 📱 **It installs to the home screen** (PR #25): manifest, 💞 icons,
    standalone launch, safe-area insets. Share → Add to Home Screen and it's
    an app — **no App Store, no fee, nothing that expires**.
  - ⚡ **Idle cost** (PR #22): Home's 1s tick was building four
    `Intl.DateTimeFormat`s a second — now **110× faster** and paused when Home
    is off-screen; the game polls back off while hidden; boot went from four
    `settings` requests to one.

## Next up (pick one, keep PRs small)

1. **Answer & compare** ✍️ — both type answers to the daily question, reveal
   together. **The blocker is gone** — login shipped in v10 — and this is
   still the feature that makes the daily question 10× better. Fits on the
   existing Home card, so it costs no nav space. Do this one.
2. **Claude features** 🤖 — a Vercel serverless function proxying the Claude
   API (key stays server-side). Ideas: generate fresh questions weekly,
   "settle our debate" button, date-night idea generator.
3. **Money** 💸 — **Splitwise, but for two.** Log a shared expense (who paid,
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
   - ~~Do Google login first~~ **— done in v10.** This was the feature that
     made login non-optional: the anon key ships in the page source, and the
     old policies let it read *and write* every table. `auth_policies.sql`
     closed that, so a ledger of what we owe each other is now a reasonable
     thing to store. **Unblocked.**
   - **Where it lives:** the nav is full at **five** buttons, so it goes
     inside ✈️ Trips or behind its own entry point (see the 🎮 Games hub and
     the 🌙 Moon quiet-door patterns in the `add-new-game` skill).
   - Currency: we're both in USD day to day, so don't build FX up front —
     but if it's hooked to Trips, an abroad trip will want a per-expense
     currency eventually. Leave room for the column; don't write the
     converter yet.

4. **Gifts** 🎁 — **one tap that shows everything we've ever given each other.**
   A running log: what it was, who gave it, when, and the occasion (birthday,
   anniversary, Christmas, "it was a Tuesday").

   - **A photo per gift is the whole point.** In a year the list of names means
     much less than the pictures do. Reuse the 🍜 Food upload path — it already
     resizes to 1600px in-browser, reads the EXIF capture date, and puts the
     file in Supabase Storage. Same trick, new bucket (or a `kind` column).
   - **Sort/filter by giver and by occasion**, so "everything Lucia has given
     me" and "every anniversary" are each one tap.
   - **The wanted/given half of this is now #5 (Someday).** A gift you *want*
     is the same kind of thing as a restaurant you want to try, so it lives
     there rather than being a `status` column only Gifts gets. This entry is
     the record of what was actually **given**; #5 owns the wishing. Build #5
     first and Gifts becomes "the given half", not a separate table.
   - **Deliberately no prices.** The 💸 Money feature is for what we owe each
     other; putting a number on a gift makes it an expense. If we ever want
     "what did that cost", it belongs there, not here.
   - **Needs a real table** (`gifts`) — like Money, it's outgrown `settings`
     key/value rows. Ships with a migration in `supabase/`, and per golden
     rule 6 it must still render from memory when the DB is unreachable.
   - ~~Do Google login first~~ **— done in v10**, same reasoning as Money.
     **Unblocked.** The photos still inherit whatever we decide in #6 about
     private buckets.
   - **Where it lives:** the nav is full (five buttons at 375px), so this is a
     card on Home that opens a full page, or a section inside a tab — not a
     sixth nav button. See the 🎮 Games hub and 🌙 Moon quiet-door patterns.

5. **Someday** ⭐ — **one list of everything we want: places to go, restaurants
   to try, and things we want.** The app is currently all past tense — trips
   we took, meals we ate, gifts we gave. This is the other half: the stuff we
   haven't done yet.

   **The insight that makes it worth building: every kind here already has a
   "done" home in the app.** A place graduates into ✈️ Trips, a restaurant into
   🍜 Food, a thing into 🎁 Gifts. So this isn't a fourth silo — it's the
   inbox that feeds the three logs we already have.

   - **One list, three kinds:** 📍 place · 🍜 restaurant · 🎁 thing. Same row
     shape (`kind`, `title`, `note`, `link`, `added_by`, `status`), filtered by
     chips — the 🍜 Food tag rail is the pattern to copy, not a new UI.
   - **Tick it off → it graduates.** Marking a restaurant *done* should offer
     to open the Food uploader; a place, to start a Journey; a thing, to file
     a Gift with a date. Even if v1 just marks it done and links across, the
     shape should assume that flow — it's what stops this becoming a list
     nobody revisits.
   - **`added_by` is the whole point of the gift kind.** "What does Lucia
     actually want" is the question this answers, and it only works if the
     other person can browse it. So: no hiding who added what.
   - **A 🎲 "pick one" button.** Two people staring at a list of 40 restaurants
     choose nothing; the app already has `mulberry32`, `burst()` and `popToast`
     to make one choice feel like an event. If it should be the *same* pick on
     both phones that day, seed it — claim an offset in SESSIONS.md first.
   - **Where it lives:** the nav is full at five buttons (375px), so this is a
     Home card that opens a full page, or a section inside 🍜 Food / ✈️ Trips.
     See the 🎮 Games hub and 🌙 Moon quiet-door patterns.
   - **Needs a real table** (`wishes`) — one table, not three, with `kind`
     doing the separating. Ships with a migration in `supabase/`; per golden
     rule 6 it must still render from memory when the DB is unreachable.
   - Login shipped in v10, so this is **unblocked**. Do it before 🎁 Gifts —
     Gifts then becomes the "given" half of the same idea instead of a second
     table that also has a wanted flag.

6. **Private food bucket** 🔒 — the `food` Storage bucket is `public = true`,
   so every photo is served over an unauthenticated URL and storage policies
   don't apply to that path. `supabase/auth_policies.sql` closes the
   enumeration route (the rows holding those URLs become us-only) and revokes
   anon insert/delete, but the objects themselves stay publicly fetchable by
   URL. Real fix: flip the bucket to private and have `js/food.js` mint signed
   URLs instead of using the plain public ones. ~~Do it after Google login~~
   — login shipped in v10, so this is **unblocked** and now the only known
   hole left in the lockdown.

## Agreed platform plan
- **Hosting:** Vercel — static, plus serverless functions in `api/`
  (`album`, `geocode`, `food-import`)
- **Backend:** Supabase — Postgres, Storage and Google auth, free tier. All of
  it is live; auth and the locked-down RLS policies shipped in v10
- **Distribution:** the web app IS the app — Share → Add to Home Screen on
  both phones. Deliberately not the App Store (a wrapped web view is a 4.2
  rejection, the adult decks are a content-rating problem, and a review queue
  would break "both partners run the same version")
- **Repo:** private, both partners collaborators, deploy = push to `main`

## Parking lot
- Real streak tracking (needs DB)
- Custom question packs the couple writes for each other
- Push notification "your person answered today" (needs backend; the PWA half
  is done, and iOS has supported Web Push for home-screen apps since 16.4)
- ~~PWA manifest + icon so Add-to-Home-Screen looks native~~ **shipped
  2026-07-26** (PR #25): manifest, 💞 icons, standalone launch, safe-area
  insets. Share → Add to Home Screen and it's an app — no App Store
