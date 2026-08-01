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
2. **Claude features** 🤖 — **the endpoint shipped 2026-07-26** as
   `api/claude.js` + `js/ai.js`, with ✨ Draft a plan (🗓️ Trip Plan) as its
   first caller. Two decisions worth keeping when you add the next one:

   - **It is gated and task-based, not a proxy.** Every request carries a
     Supabase JWT checked against an allowlist, and the browser sends *data*
     against a named task whose prompt lives server-side. An open `/api/claude`
     would let anyone with the app's URL spend the API balance — the other
     three functions in `api/` verify nothing about their caller, and that
     pattern must not be copied here.
   - **Every AI feature hides itself when it can't work** (`aiReady()`), the
     same way Supabase-backed ones do. Golden rule 6 covers Claude too.

   Still on the list: fresh questions weekly (⚠️ must write to the shared
   `questions` table — generating per-device breaks golden rule 3's "same
   question on both phones"), "settle our debate", and a read on a month of
   ✍️ Answer & compare. **Never** the 🌙 Moon log.
3. **Money** 💸 — **what we have together, and what each plan would cost.**

   **Decided 2026-07-26: this is a pot, NOT Splitwise.** The earlier version of
   this entry was who-owes-whom with a settle-up flow. We don't want that. We
   want one shared balance and the ability to ask *"can we afford Japan?"* —
   so per-expense splits, the signed who-owes-whom number and settle-up are
   **deliberately dropped**. That's roughly half the original feature, gone.

   - **The pot is one number.** Every row is a `topup` (money in) or a `spend`
     (money out); the balance is the difference. No shares, no debts, no
     settling. If we ever genuinely need "you got dinner, I'll get the
     flights", revisit — but don't build it on spec.
   - **Simulation is the point, and it's just arithmetic.** Every ⭐ Someday
     wish and 🗓️ Trip Plan carries an optional `est_cost`. Plan then shows
     `pot − committed = what's left`, and toggling an item moves the number.
     No forecasting engine — a sum over rows we already need.
   - **It's a line AND a chip** (revised 2026-07-26; it shipped as a strip
     alone). The reading — `pot − committed = left` — is one line pinned above
     the chooser, still visible while the chips swap beneath it, because Money
     is the constraint the other two are read against. The *logging and the
     history* moved into a 💸 Money chip beside ⭐ Someday and 🗓️ Trip Plan,
     because a form you touch occasionally shouldn't eat the top of every
     view. Number = context, ledger = view. Don't collapse it to one or the
     other without re-reading both halves.
   - **Home gets the glanceable number** ("Together: $4,820") next to the
     reunion countdown — the same relationship the countdown has to Trip Plan:
     Home shows the headline, Plan owns the detail.
   - **Spends can carry a `journey_id`**, so ✈️ Trips can show what a trip
     actually cost — and afterwards, what it cost vs. what we estimated. The
     data links even though the UI lives in Plan.
   - **Needs a real table** (`expenses`), plus an `est_cost` column on
     `wishes` and on `journeys`. Ships with a migration in `supabase/`, and
     per golden rule 6 it must still work from memory when the DB is
     unreachable — and *say so* rather than pretending it saved. Money
     silently not saving is worse than money visibly not saving.
   - ~~Do Google login first~~ **— done in v10.** This was the feature that
     made login non-optional: the anon key ships in the page source and the
     old policies let it read *and write* every table. `auth_policies.sql`
     closed that. **Unblocked.**
   - Currency: we're both in USD day to day, so don't build FX up front — but
     an abroad trip will want a per-expense currency eventually. Leave room
     for the column; don't write the converter yet.
   - **Build order:** ⭐ Someday and 🗓️ Trip Plan first — they're what the
     simulation sums over. A pot with nothing to spend it on is a calculator.

4. **Gifts** 🎁 ✅ **shipped 2026-07-26 (task D1)** — the given half is live as
   the second chip in 💝 Memories. Photos, giver/occasion filters, no prices.
   Wishing still belongs to #5.
   *Original entry:* **one tap that shows everything we've ever given each other.**
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
     **Unblocked.** The photos still inherit whatever we decide in #7 about
     private buckets.
   - **Where it lives:** a chip in the 💝 Memories tab, beside 🍜 Food — see
     "Agreed tab structure" below. Not a nav button.

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
   - **Where it lives:** a chip in the 📋 Plan tab, beside 🗓️ Trip Plan — see
     "Agreed tab structure" below. A place wish graduates into a Trip Plan; a
     restaurant into 🍜 Food; a thing into 🎁 Gifts.
   - **Needs a real table** (`wishes`) — one table, not three, with `kind`
     doing the separating. Ships with a migration in `supabase/`; per golden
     rule 6 it must still render from memory when the DB is unreachable.
   - Login shipped in v10, so this is **unblocked**. Do it before 🎁 Gifts —
     Gifts then becomes the "given" half of the same idea instead of a second
     table that also has a wanted flag.

6. **Trip Plan** 🗓️ — **the trip we're actually taking next.** Where a ⭐ Someday
   place goes once it has dates.

   **We already have one, badly.** `settings.reunion_date` is a trip plan
   collapsed to a single date and parked on Home as the countdown. This gives
   it a real home; the Home countdown stays, as a *view* of it.

   - **Same table as ✈️ Trips, not a new one.** `journeys` already has
     `start_date`/`end_date` — a plan is simply a row whose dates are ahead of
     us. Add a status (or split on the date) and a plan **graduates into a
     memory in place**: same rows, same photos, no copy step to drift.
     ✈️ Trips shows the past ones, 📋 Plan shows the future ones.
   - Carries an `est_cost` for 💸 Money's simulation, and afterwards the
     `journey_id` on real spends gives us estimated-vs-actual for free.
   - Whatever we plan should feed the countdown — one upcoming trip is the
     "next time we're together", which is the number Home already shows.
   - **Where it lives:** a chip in 📋 Plan, beside ⭐ Someday.

7. **Private food bucket** 🔒 — the `food` Storage bucket is `public = true`,
   so every photo is served over an unauthenticated URL and storage policies
   don't apply to that path. `supabase/auth_policies.sql` closes the
   enumeration route (the rows holding those URLs become us-only) and revokes
   anon insert/delete, but the objects themselves stay publicly fetchable by
   URL. Real fix: flip the bucket to private and have `js/food.js` mint signed
   URLs instead of using the plain public ones. ~~Do it after Google login~~
   — login shipped in v10, so this is **unblocked** and now the only known
   hole left in the lockdown.

## Agreed tab structure (decided 2026-07-26 — build it when you build #4/#5/#6)

**The constraint:** five nav buttons already need their own media query to fit
a 375px phone (`@media (max-width: 560px)` in `css/base.css` drops the type to
11.5px, and 400px drops it again — "five tabs have to fit"). A sixth won't fit.
So the nav is **reorganised, not extended**, and this spends the last slot:
everything after these features goes inside a tab as a chip.

```
Now
🏠 Home · 🎭 Talk · ✈️ Trips · 🍜 Food · 🎮 Games            + 🌙 Moon (hidden)

Agreed
🏠 Home · ✈️ Trips · 💝 Memories · 📋 Plan · 🎮 Games        + 🌙 Moon (hidden)
              │          │          │         │
              │          │          │         └─ 🎭 Talk · 🔤 Duel · 🎯 20Q
              │          │          └─ 💸 Money (strip) + ⭐ Someday · 🗓️ Trip Plan
              │          └─ 🍜 Food · 🎁 Gifts · 🖼️ Moodboard
              └─ the past ones (same `journeys` table as Trip Plan)
```

**It splits by tense, which is the durable line.** ✈️ Trips is the big things
that happened; 💝 Memories the small things eaten, given, and collected about
each other; 📋 Plan everything ahead; 🎮 Games is now. Answer & compare (#1)
stays a Home card and costs no nav.

**The point of the layout — the lifecycle is visible:**

```
⭐ Someday        →   🗓️ Trip Plan      →   ✈️ Trips
"Japan someday"       "Tokyo, Dec 20–28"     the album, afterwards
```

A wish becomes a plan becomes a memory. The first two sit together in 📋 Plan;
the payoff gets its own tab. Same shape for the other kinds: a restaurant wish
graduates into 🍜 Food, a thing into 🎁 Gifts — both in 💝 Memories.

**💸 Money is a line AND a chip** (revised 2026-07-26). The *reading* is one
line pinned above the chooser — `pot − committed = what's left` on screen while
you browse what you want, which is why it isn't only a chip. The *ledger* (log
form + history) is the third chip beside ⭐ Someday and 🗓️ Trip Plan, which is
why it isn't only a strip: the form was eating the top of every view for
something you act on occasionally. Home still shows the headline number beside
the reunion countdown. See #3.

**Why the names.** "Us" was rejected: the app already uses it as a heading
everywhere (`Us, in one picture`, `Us, so far`, `Us, by the numbers`, and
Trips' own `Us, but with luggage`), so a tab called Us says nothing. 💝 Memories
covers food, gifts, and the two moodboards honestly. And the games tab **keeps its 🎮 Games label
rather than becoming "Play"** — `Plan` and `Play` are four letters starting
`Pla`, adjacent, at 11px on a phone. That is a misfire waiting to happen.

**Order: 💝 Memories first, then 📋 Plan, then 🎮 Games. One PR each, never one
big one** — every push is a deploy to both phones. Memories is first because it
unblocks 🎁 Gifts; Plan is second because 💸 Money's simulation needs ⭐ Someday
and 🗓️ Trip Plan to exist to sum over; folding 🎭 Talk into Games is the small
tidy-up at the end and blocks nothing.

**Four traps, three of them already bitten once:**
1. The desktop grid is keyed on `#page-*.active` (`css/desktop.css`) — e.g.
   `#page-tfd.active { max-width: 780px }`. Merged, those move to the inner
   container, and the chooser must set `display = ""` **not** `"block"`, or the
   inline style kills the grid. `gamesShow()` carries that comment already.
2. `TAB_HOOKS.food` calls `fdLoad()` and `TAB_HOOKS.journeys` hydrates photos,
   both on tab open. Merged naively, opening 💝 Memories fires **both** — undoing
   "journey photos only when Trips is opened". Each merged tab needs a `*Pick`
   guard mirroring `gamesPick`.
3. `gamesPick` lives in `js/core.js` and guards each game's poll. Every new
   chooser needs its own global — **claim it in SESSIONS.md first**.
4. Each chooser must remember its last pick in memory (like `gamesPick`), or
   🎭 Talk costs two taps every time — and that's the one used live on a call.

Moving Talk off the nav also quietly improves its cover: the adult decks stop
being advertised at the top level at all (the tab key stays `tfd`).

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
