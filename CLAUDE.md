# Lucia ♥ Riu App — Claude Context

> **Codex compatibility:** `AGENTS.md` is the Codex entry point, and
> `.agents/skills/` contains Codex adapters for the living workflows below.
> This file remains the canonical detailed project map for both agents despite
> its historical filename.

Hi Claude! You're working on a private couple app built by Riu and Lucia
(long-distance: Riu in San Francisco, Lucia in Phoenix, together since
June 2, 2026). Fun is a feature — keep the tone playful.

**Live app:** https://lucia-riu-app.vercel.app (auto-deploys from `main`)
**Repo:** https://github.com/RiuCH/LuciaRiuApp

## Golden rules (never break these)

1. **No build step, and it must work by double-clicking `index.html`.**
   (This replaced the old "one file" rule when the app was modularised —
   the *spirit* is unchanged: zero tooling between editing and seeing it.)
   The app is now `index.html` + `css/*.css` + `js/*.js`, wired with plain
   `<link>` and `<script src>` tags. No dependencies, no frameworks, no
   bundler. **Classic scripts only — never `type="module"`/`import`:** ES
   modules are blocked on `file://`, so modules would break double-click.
   Files share state through ordinary globals; `js/init.js` loads last.
   (Narrow exception per ROADMAP: Vercel serverless functions in `api/` —
   enhancements only, the app must work without them.)
2. **No localStorage / sessionStorage / cookies.** They break in the preview
   environments we use. State lives in memory or in URL-hash params —
   **ONE carve-out, agreed 2026-07-25: the Google-login session** (and only
   that) may be stored under the key `lr_session` — `localStorage` preferred,
   `sessionStorage` next, memory last, each feature-detected in `js/auth.js`.
   Without it every refresh, and every reopen of the home-screen app, bounces
   you through Google again. It holds a **refresh token**, which is why
   `localStorage` and not just `sessionStorage`: sessionStorage dies with the
   tab, and iOS kills backgrounded web apps constantly. The original reason for
   this rule still holds — if the browser throws, it degrades to memory and the
   app keeps working, you just re-auth more often. **Don't widen this to
   anything else**, and note the app's own data still never goes near storage.
   Everything else lives in memory or URL-hash params —
   always via the `getHashParam`/`setHashParam` helpers so params coexist
   (current: `#reunion=YYYY-MM-DD`, `#unlocked=1`, `#photo=<url>`,
   `#me=lucia|riu`, `#moon=1`). Private data is the exception — the 🌙 Moon
   log stays out of the hash on purpose, since the hash is visible in the
   address bar and in shared links.
   **`#me` is written by `js/me.js` alone.** Nothing else may set it: it's one
   identity for the calendar, both games, ✍️ Answer & compare and 📍 Location,
   and it is re-derived from the signed-in address on every cold launch —
   `start_url: "./"` means an installed launch arrives with no hash at all, so
   the hash by itself could never be the answer.
3. **The daily question must stay deterministic and shared.** The pool is
   shuffled by a seeded PRNG (`mulberry32`) into a *deck* and dealt one per
   day since July 24, 2026, so every question comes up once before any
   repeat. Same date ⇒ same question on both phones with zero server. Any
   change to the pool reshuffles the deck (a given day's question changes) —
   that's fine, but never replace the mechanism with `Math.random()`.
4. **Both partners must run the same version.** Deploy = merge to `main`
   (Vercel redeploys automatically). Don't leave the app half-broken on main.
5. Works offline, works on phones (test at ~420px wide), stays cute.
6. **Supabase is an enhancement, never a dependency.** The app must fully
   work with `SUPABASE_URL`/`SUPABASE_ANON_KEY` empty or the network down —
   every DB-backed feature keeps a hardcoded/in-memory fallback (`BANK`,
   `LOCK_KEYS`, hash params). Setup + conventions: docs/SUPABASE.md.

## Map of the files

`index.html` is now just markup: the lock overlay, the six `<section
class="page">` tabs (five in the nav + the hidden 🌙 Moon one), the nav,
and the `<link>`/`<script src>` tags.

**A tab is no longer one feature.** Three of them host several behind a
chooser, so `#page-*` and "the thing you see" stopped being the same:

| Tab | Sub-views | Pick lives in |
|---|---|---|
| 💝 Memories (`#page-treats`) | `#treatFood` · `#treatGifts` · `#treatMoodboard` | `treatsPick` |
| 📋 Plan (`#page-plan`) | `#planSomeday` · `#planTrip` · `#planMoney` | `planPick` |
| 🎮 Games (`#page-duel`) | `#gameDuel` · `#game20q` · `#gameTfd` | `gamesPick` |

The `*Pick` globals live in `js/core.js`; each chooser function lives in its
own tab's file. See "Tabs that host more than one thing" in the
`couple-app-dev` skill before touching one — the rules there each exist
because skipping them broke something.

| File | What lives there |
|---|---|
| `css/base.css` | theme vars (including shared light/dark surface tokens), layout shell, `.panel`/`.card`/`.chip`/buttons, Daily Q page, nav, toast, burst, lock screen |
| `css/calendar.css` | 📅 calendar card, month sheet, the two person colours |
| `css/home.css` | anniversary, clocks, countdown, teasers, couple photo |
| `css/tfd.css` | Talk · Flirt · Dare: mode switches, deck buttons, prompt card |
| `css/journeys.css` | timeline, journey cards, photo grid, lightbox, picker |
| `css/gifts.css` | 🎁 Gifts: log form, filter chips, gift cards |
| `css/moodboard.css` | 🖼️ Moodboards: 3-column squares, Lucia/Riu ownership glow, Flip/delete controls |
| `css/plan.css` | 📋 Plan: the money line above the chooser |
| `css/someday.css` | ⭐ Someday + 🗓️ Trip Plan: wish cards, kind filters, the add forms |
| `css/money.css` | 💸 Money: the ledger rows, the log form, the Home headline |
| `css/answers.css` | ✍️ Answer & compare: the compose box and the reveal |
| `css/food.css` | 🍜 Food: section headers, photo grid, tag lightbox, album picker |
| `css/duel.css` | letter pair, hearts, penalty modes |
| `css/twenty.css` | Games-tab chooser, 20 Questions board + interrogation log |
| `css/cycle.css` | 🌙 Moon: month grid, day marks, stat tiles |
| `css/desktop.css` | the whole `@media (min-width: 900px)` layout — every tab is `.app` wide, no per-tab caps |
| `js/core.js` | hash params, `EPOCH`/`afterDark`, `mulberry32`, `dayNumber`, `switchTab`, `popToast`, `burst`, hearts |
| `js/supabase.js` | `SUPABASE_*` config, `supa()`, `loadSettings()`, `saveReunion()`, `loadQuestions()` |
| `js/questions.js` | `BANK` (11 prompt categories), `CHIPS`, `QUESTION_SOURCE`, the seeded daily deck (`dailyQuestion()`) |
| `js/tfd.js` | Talk · Flirt · Dare tab: the three decks, Together/Apart mode (`tfd*`) |
| `js/calendar.js` | 📅 Our calendar: the Home card + the month popout (`cal*`) |
| `js/home.js` | `MISSYOU`, anniversary/clock/countdown ticks, couple photo (`cp*`) |
| `js/journeys.js` | timeline CRUD + sort, our photo uploads, iCloud album, lightbox (`jr*`) |
| `js/gifts.js` | 🎁 Gifts: the given-half log, giver/occasion filters (`gf*`) |
| `js/moodboard.js` | 🖼️ Lucia/Riu photo moodboards: shared requirements, uploads, per-square Flip (`mb*`) |
| `js/trip.js` | 🗓️ Itinerary: days, saved bucket, tap-to-assign (`tr*`) |
| `js/plan.js` | 📋 Plan: the ⭐/🗓️/💸 chooser + the money line (`planShow`) |
| `js/money.js` | 💸 Money: the pot, the ledger, the committed sums (`mn*`) |
| `js/someday.js` | ⭐ Someday **and** 🗓️ Trip Plan — one file, because a wish graduates into a plan (`sd*`, `tp*`) |
| `js/food.js` | 🍜 Food: uploads, EXIF, timeline, tags, search (`fd*`) |
| `js/duel.js` | Word Duel (`wd*`) |
| `js/twenty.js` | 20 Questions (`q20*`) **and** the Games-tab chooser (`gamesShow`) |
| `js/cycle.js` | 🌙 Moon: cycle calendar + our tally (`cy*`) — the hidden tab |
| `js/auth.js` | Google sign-in via Supabase Auth (`auth*`) — session, JWT, URL scrub |
| `js/me.js` | 👤 which of us is on this phone (`me*`) — `meWho`, the ⚙️ Settings picker, `ME_LOCKS` |
| `js/ai.js` | the one door to the Claude API (`ai*`) — `aiReady()` is how every ✨ feature hides itself |
| `js/push.js` | 🔔 notifications (`push*`) — the Settings toggle + `pushNotify()` for callers |
| `sw.js` | the service worker — **push only, and never a `fetch` handler** (see below) |
| `js/lock.js` | login gate (offline door; real auth skips it) |
| `js/init.js` | boot order — **loads last** |

Script order in `index.html` is load-bearing: `core` → `supabase` →
`auth` → `questions` → `home` → `journeys` → `food` → `gifts` → `moodboard` → `duel` → `twenty` → `cycle` →
`lock` → `init`.
Anything
running at *top level* may only reference things defined in an
earlier-loaded file; calls made later (inside handlers or from `init.js`)
can reference anything.

### Details worth knowing

- CSS: `:root` variables = theme; `body.afterdark` = red After Dark theme
- `BANK` — 345 prompts in 11 categories: funny, romantic, spicy, nasty, ldr,
  deep, filthy, dareapart, dareapartx, daretogether, daretogetherx. Home's
  Question of the Day only ever draws from the sweet three (`QOTD_CATS` =
  funny + romantic + ldr); everything adult lives behind Talk · Flirt · Dare,
  which since A2 has **no nav button at all** — it's the 🎭 Talk chip inside
  🎮 Games (`#gameTfd`, `gamesPick === "tfd"`, tab key still `tfd`). The old
  innocuous-label trick is now moot: the decks aren't advertised at the top
  level in any form
- `MISSYOU` — miss-you text generator strings
- `CHIPS` — category labels/colors
- Constants: `EPOCH` (day counter start), `ANNIVERSARY` (June 2, 2026),
  `TZ_RIU`/`TZ_LUCIA` (clock timezones)
- Tabs: sections `#page-home`, `#page-journeys`, `#page-treats`,
  `#page-plan`, `#page-duel`, `#page-cycle` + `switchTab()`, which iterates
  the `TABS` array in `js/core.js`. A tab with no `NAVIDS` entry simply has
  no nav button — that's how 🌙 Moon stays hidden. **`tfd` is in `SUBTITLES`
  but NOT in `TABS`/`NAVIDS`**: Talk is a sub-view of 🎮 Games now, and the
  key survives only as a `gamesPick` value
- Answer & compare (`ac*` in `js/answers.js`, C1): both of you type an answer
  to the day's question on the Home card and **neither shows until both are
  in** — the second answer must not be shaped by the first. Locked once
  submitted, and the lock is real: `answers` has a unique index on
  `(day, who)`, so a second insert is refused by Postgres, not just hidden.
  Needs `supabase/answers.sql`; the card says so until it's run. Side comes
  from the games' `#me`. Polls only while yours is in and theirs isn't
- 📅 Our calendar (`#calCard` on Home, `cal*` in `js/calendar.js`): a month
  grid you both write to. Tapping the card opens `#calSheet` — month nav, a
  day panel, and a form. **Every entry carries `who`, and the colour means
  only that**: `--who-riu` / `--who-lucia` are fixed in `css/calendar.css`,
  NOT derived from `--accent`, because a theme that repaints the accent would
  otherwise repaint people's identities. `#me` picks whose entry you're
  adding, shared with the duel and 20 Questions. Days are `"YYYY-MM-DD"`
  strings end to end and times are free text — two timezones mean a timestamp
  would render as a different DAY on the two phones (the bug 🍜 Food already
  paid for). `calMinutes()` parses "6am"/"19:30" so a day sorts by clock
  rather than alphabetically. Needs `supabase/calendar.sql`; until it's run
  the card says so. Its own TABLE, not a `settings` JSON row: two people add
  independently, and a read-modify-write blob loses whoever saves second
- Question of the Day: `qotd*` in `js/home.js` + Answer & compare
  (`js/answers.js`). It was Home's fourth card until the calendar took that
  slot on 2026-07-31; it now lives at the top of **🎭 Talk** (`#gameTfd`).
  Same ids, same daily pick — only the parent element changed
- Talk · Flirt · Dare (`#gameTfd`, a chip in 🎮 Games): three decks, live `Math.random()` draws
  (one phone during a call — no seed needed). One switch: 💞 Together vs
  ✈️ Apart, which picks the deck contents AND runs the app hot (`hotMode`
  + `.hot` class on `<html>`+`<body>`). Filthy prompts are in the decks, not
  behind a separate After Dark tier
- Daily logic: `dailyQuestion()` (seeded deck, no repeats until the pool is
  exhausted — `shuffledOrder`/`deckForCycle`);
  pool comes from `QUESTION_SOURCE` (= `BANK`, swapped to the DB copy once
  `loadQuestions()` succeeds — content identical, so the pick doesn't change)
- 🍜 Food (`#treatFood`, a chip in 💝 Memories; `fd*` in `js/food.js`): every meal we've eaten
  together. Photos live in **Supabase Storage** (bucket `food`) with rows in
  `food_photos` / `food_tags` / `food_photo_tags` — the app's first real
  file storage, and it needs `supabase/food.sql` run once (the tab says so
  until then). Uploads are resized to 1600px in-browser before they leave
  the phone. **You cannot upload INTO an Apple Shared Album** — Apple's API
  is read-only — so album photos are *copied* into our bucket by
  `api/food-import.js`; iCloud asset URLs are signed and expire.
  **Every sort mode shares one section header** (`fdSection`) — date used to
  be a narrow rail floating left of its grid, which made a quiet month look
  like a rendering bug. The grid is `auto-fill minmax(128px)`, so tiles stay
  one size and a leftover is a notch, not a crater. **Tiles are uniform on
  purpose** — a 2x2 "hero" tile was tried and removed: it spans two rows, and
  CSS picks the column count, so JS can never tell whether enough tiles follow
  to fill the second row. Near the end of a section it hung below everything.
  EXIF gives us the capture date and GPS; `api/geocode.js` turns GPS into
  city/country tags via OpenStreetMap. `taken_at` holds a **wall clock**
  (rendered in UTC), never an instant — see the comment in `fdExifDate`.
  Deleting a photo removes the row AND the stored file; deleting a tag
  (✕ in the tag catalogue) unlinks it everywhere but keeps the photos.
  Tag kinds: restaurant · dish · **city · country** · other (city+country
  replaced a single `place` kind — `js/food.js` still shows any leftover
  `place` tag under City, and `supabase/food_split_place.sql` migrates it).
  The Find & organise panel folds (`fdOrganiseOpen`, memory only)
- 🎁 Gifts (`gf*` in `js/gifts.js`, D1): the second chip in 💝 Memories — the
  record of what we've **given** each other (wishing is Someday/E1, and
  there are deliberately **no prices**: a number makes it an expense, which
  is 💸 Money's job). Filter by giver or occasion. Photos reuse Food's
  upload path under a `gifts/` prefix of the SAME `food` bucket, so they
  inherit B1's signed URLs — `js/gifts.js` calls `fdResize`/`fdUploadBlob`/
  `fdResolveViews` but never edits `js/food.js`, and feature-detects them
  all. `given_on` is a wall clock rendered in UTC, like `taken_at`. **Up to
  3 photos** per gift in `gifts.photos` (jsonb `[{url, path}]`), with
  `url`/`path` still mirroring the first so pre-migration rows and older
  clients keep working; `gfMultiOK` probes whether the column exists and
  the form degrades to one photo when it doesn't. ✎ edits in place and
  deletes any photo the edit dropped. Card photos are sized intrinsically
  (never `object-fit: cover` at card width — that cropped 76% off a
  portrait on a laptop), and stand on a `.gf-shots` mat sized to the photo so
  an uncropped portrait is framed rather than adrift. **Two columns from
  900px** — a grid with `align-items: start`, not CSS multi-column: masonry
  would come free but it fills top-to-bottom-then-across, putting the middle
  of a newest-first log at the top of the right column. Needs
  `supabase/gifts.sql` + `gifts_photos.sql`
- 🖼️ Moodboard (`mb*` in `js/moodboard.js`): the third chip in 💝 Memories.
  Starts with nine shared requirements; either person can add more. Every
  square has one Lucia photo and one Riu photo, stored in the existing private
  `food` bucket under `moodboards/<person>/`. The top Lucia/Riu chips reset the
  whole board; 🔄 flips only one square. Lucia ownership is always signalled
  by a pink glow and Riu by blue, plus a visible name. Empty squares all use
  💕. Deleting asks first, then removes the shared requirement and both photos.
  State uses `settings.moodboard_prompts`, `moodboard_lucia`, and
  `moodboard_riu`, so there is no migration; signed-out/file mode is an honest
  in-memory preview.
- 📋 Plan (`#page-plan`): three chips — ⭐ Someday · 🗓️ Trip Plan · 💸 Money
  (`planShow` in `js/plan.js`, `planPick` in core). **💸 Money is a line
  AND a chip**: the reading (`pot − committed = left`) is a slim line
  pinned ABOVE the chooser so it follows you across the other two, while
  the log form and history live in its own chip. It shipped as a strip
  alone and became both on 2026-07-26 — don't collapse it back to one
  without reading the reasoning in docs/ROADMAP.md #3. Trip Plan's `#tpWish`
  dropdown is the simple pipeline from an unfinished 📍 Someday wish: choosing
  one copies its title, note and estimated cost, and the wish becomes `done`
  only after the journey is saved locally. Opening or cancelling the form must
  never make a wish disappear. **Every subtab's top island is foldable and
  starts folded** (`.foldbtn`/`data-fold` from `js/core.js` — `#sdIsland`,
  `#tpIsland`, `#mnIsland`), same convention as Trips/Food/Gifts. A plan can
  be **deleted** (`tpDelete`) as well as graduated — a cancelled trip used to
  have to be lied about to get off the list; `trip_places` cascades, so the
  confirm says so. The itinerary (`trOpen`) is reachable from BOTH sides:
  `js/trip.js` remembers the tab that opened it (`trBackTab`) so ✈️ Trips can
  hop into 📋 Plan and the planner's ‹ hands you back. `planShow()` calls
  `trClose()` — an open planner hides `#tpList`, and it used to survive a
  subtab switch and leave Trip Plan looking empty
- 🎮 Games tab (key `duel`, nav "🎮 Games") holds TWO games behind a chooser:
  Word Duel and 20 Questions. `gamesShow(which)` in `js/twenty.js` swaps
  `#gameDuel`/`#game20q` and sets `gamesPick` (declared in `js/core.js`),
  which each game's poll guards on so only the visible one talks to the DB
- 20 Questions (`q20*`): one thinks of something, the other gets 20 questions
  answered only YES / NO / SOMETIMES; a wrong final guess burns a question.
  Whole game in `settings.q20_state` (JSON, no migration), polled every 2s;
  `#me` picks your side, shared with the duel. The secret is hidden from the
  guesser's UI but *is* in the shared row — honour system, same as the app's
  other 'hidden ≠ private' spots
- Word Duel: `WD_STARTS`/`WD_ENDS` (weighted letters), `WD_PENALTIES`
  (two situation pools: `inperson`/`ldr`, each mixing funny/spicy/nasty
  flavours), `wd*` functions. v7: hearts/round/letters/
  answers live in the one-row `duel` table, polled while the tab is open;
  `#me` picks your side; falls back to a one-phone session game offline
- 🌙 Moon (`#page-cycle`, `cy*` in `js/cycle.js`): Lucia's cycle calendar and
  our own tally on one month grid — logged/predicted period days, the
  fertile-window estimate, 💞 counts per day, plus cycle-day/average-cycle
  stats and total · month · year · 🏆 best day · 🔥 longest streak. **No nav
  button**: you long-press the header `♥` (`#secretHeart`, 1.2s, the "quiet
  door" in `js/core.js`) or use `#moon=1`. State = `settings.cycle_periods`
  (`start:len`) + `settings.love_log` (`date:count`), no migration needed;
  deliberately never written to the URL hash. **Hidden, not private** — the
  deployed page ships the anon key and RLS is wide open, so the app URL is
  all anyone needs to read it; same honesty as the lock screen. (The repo
  itself IS private — don't cite repo visibility as the reason.)
- **Two gates, and only one has a UI — the trap that cost us an evening.**
  `allowed_emails` (+ the Before-User-Created hook) decides who can **sign
  up**; `public.is_us()` in `supabase/auth_policies.sql` decides what a
  signed-in account can **see**, because every RLS policy and the `food`
  storage read policy call it. The app's "👥 Who can sign in" panel writes
  ONLY the first. So adding someone there lets them through the door and
  grants them **no sight**: they sign in successfully and get the offline
  copy everywhere — blank photo grids being the loudest symptom, since a
  private bucket needs `select` on the object just to sign a URL. `is_us()`
  is hardcoded SQL with no UI; if the two lists disagree, this is the shape
  of the bug. Ship both addresses in the same change.
- Auth (`js/auth.js`): **Google sign-in via Supabase Auth, no SDK.** PKCE is
  impossible here (its `code_verifier` needs storage rule 2 bans), so it uses
  the implicit flow — tokens come back in the URL fragment and `authCapture()`
  reads them into memory and `history.replaceState()`s them away in the same
  tick. `authSignIn()` parks the app's own hash params in a `?rehash=` query so
  the round trip doesn't eat `#unlocked`/`#me`. `supa()` sends the user JWT
  when signed in and **falls back to the anon key when not**, which is what
  lets the build ship before `supabase/auth_policies.sql` is run. Signed in ⇒
  the lock screen is skipped. **`js/auth.js` self-initialises at parse time**
  (documented exception to "boot work goes in init.js") because `js/lock.js`
  needs the answer before `init.js` runs. Sign-in cannot work from `file://`
  — a double-clicked `index.html` runs offline-only
- **👤 Who am I (`js/me.js`)**: `meWho`, one identity for the whole app,
  picked in ⚙️ Settings and nowhere else. It was `wdMe` in `js/duel.js` with
  four separate pickers reading it (Word Duel, 20 Questions, ✍️ Answer &
  compare, 📅 the calendar) — identity was never the duel's to own.
  - **Signed in, we don't ask.** The mapping lives in two `settings` rows,
    `account_lucia` and `account_riu`, each holding a Google address — and it's
    written by *picking your name while signed in*, not by a separate form.
    They ride the one boot fetch (`loadSettings` → `meAdopt`), so it costs no
    extra request, and `settings` is key/value so there's **no migration**.
  - **`AUTH_ALLOWED` in `js/auth.js` is only the fallback now**, for a phone
    that hasn't seen those rows yet. It reads **by position — Riu `[0]`, Lucia
    `[1]`** — and disables itself while the list holds its `@example.com`
    placeholder. Once either of you has picked yourself once, the database
    answers and that array stops mattering: changing who's who is a tap in
    ⚙️ Settings, not a code edit and a deploy.
  - **One address is never both of you.** Re-picking on a linked account
    deletes the other slot, or `meFromAccount()` would answer with whichever it
    scanned first.
  - **Tapping the name you're already on is not a no-op** — it re-links an
    account you've unlinked, which is what the hint tells you to do.
  - **`ME_LOCKS`** lets a tab veto a change with a reason — Word Duel pushes
    one so you can't swap sides mid-match. The rule stays in `js/duel.js`;
    `me.js` doesn't know what a duel is.
  - `meBroadcast()` repaints every tab that draws identity, each call
    feature-detected *and* individually caught — one missing function must not
    take the rest down.
- **Claude / AI (`js/ai.js` + `api/claude.js`)**: there is exactly ONE endpoint
  and it is **gated and task-based**. Three rules, all load-bearing:
  1. **It verifies the caller.** Every request must carry a Supabase user JWT
     whose email is in `LR_ALLOWED_EMAILS`. The other `api/` functions check
     nothing about their caller — copying that here would let anyone with the
     Vercel URL spend the Anthropic balance. The issuer (`LR_SUPABASE_URL`) is
     read from env and **never from the request body**; taking it from the body
     the way `api/food-import.js` does would be a total bypass (point it at
     your own project, sign in as an allowlisted address, walk through).
  2. **Named tasks, not prompts.** The browser sends *data*; the system prompt
     lives server-side in `TASKS`. Adding a feature means adding a task there,
     not letting a caller pass prose. This is what bounds the damage of a
     stolen JWT to "reads our trip plan" instead of "runs anything, on our
     card".
  3. **`aiReady()` gates every caller.** `file://`, signed out, or the function
     not deployed ⇒ the button is not rendered and the tab is complete without
     it. Golden rule 6 applies to Claude exactly as it does to Supabase.
  Vercel env: `ANTHROPIC_API_KEY`, `LR_ALLOWED_EMAILS`, `LR_SUPABASE_URL`,
  `LR_SUPABASE_ANON_KEY`. The allowlist must agree with `public.is_us()` and
  `allowed_emails` — three lists, one set of two people. **🌙 Moon data never
  goes to the API**; payloads are explicit field whitelists, never "send the
  table". First caller: ✨ Draft a plan in `js/trip.js`. The gate itself lives
  in `api/_gate.js`, shared with `api/notify.js` — one copy on purpose
- **🔔 Notifications (`js/push.js` + `sw.js` + `api/notify.js`)**: Web Push,
  and the one place the app owns a service worker.
  - **`sw.js` has NO `fetch` handler and must never get one.** The old rule
    was "no service worker" because a cached shell breaks golden rule 4 — but
    that's about *caching*, and push can't work without a worker. With no
    `fetch` handler nothing is intercepted or cached, so every load is still
    from the network. Adding one, for any reason, breaks rule 4.
  - **iOS: Home Screen only**, from iOS 16.4. A Safari tab has no Push API at
    all. Permission must come from a tap and there's no second prompt if it's
    denied — hence a deliberate toggle in ⚙️ Settings, never an ask on boot.
  - **The push carries no payload.** Payloads need RFC 8291 encryption, which
    would mean a dependency; instead every notification reads "Something new
    💞" and the app shows what changed. The upside: *nothing about them travels
    through Apple's servers*. `push_subs` stores `p256dh`/`auth` anyway so
    adding text later is a sender change, not a re-subscribe.
  - **The actor comes from the verified JWT**, never the request body —
    otherwise either of you could ring the other's phone on demand.
    `api/notify.js` reads `push_subs` with the *caller's* token, so it needs no
    service-role key, and prunes endpoints that answer 404/410.
  - `pushNotify()` is fire-and-forget and feature-detected at all three call
    sites (`js/food.js`, `sdAdd` and `tpSave` in `js/someday.js`) — a
    notification must never be able to fail the thing it's announcing.
  - Vercel env: `LR_VAPID_PUBLIC`, `LR_VAPID_PRIVATE`, `LR_VAPID_SUBJECT`.
    `VAPID_PUBLIC` in `js/push.js` ships in the page (it's an identifier, like
    the anon key); **empty ⇒ the toggle is hidden**, so this is safe to deploy
    before the keys exist. Needs `supabase/push.sql` run once
- Couple photo: `cp*` block — home hero image from `settings.home_photo`
  (URL / upload data-URL / `album:<link>` = Apple-album photo-of-the-day,
  seed offset 15485863); `#photo=` hash + session fallbacks
- Home widgets: `tickAnniversary()`, `tickClocks()`, `tickCountdown()`
- JOURNEYS block: `SUPABASE_URL`/`SUPABASE_ANON_KEY` config, `supa()` REST
  helper, `loadJourneys()`/`loadSettings()`/`loadQuestions()`, timeline
  render + add/delete, Apple Shared Album embed (`fetchICloudAlbum()`),
  lightbox, sort chips (`jrSort`: oldest/latest/shortest/longest),
  edit form (`jrEditing`), photo picker (`jrPicker*`,
  `journeys.photo_guids`). **Two kinds of photo, on purpose:**
  `journeys.photos` (`[{url, path}]`) are ones we uploaded — ours, permanent,
  in the `food` bucket under `trips/` so they inherit Food's signed URLs;
  `album_url` is an Apple album we *borrow*, read-only and signed with URLs
  that expire. A trip can have both. Upload path is Food's, reused whole
  (`fdResize`/`fdUploadBlob`/`fdResolveViews`) and feature-detected, and it
  needs `supabase/journey_photos.sql` — `jrUploadOK` hides the button rather
  than failing when the column isn't there. **Removing a photo is a lightbox
  action**, not a thumbnail one: `openLightbox({..., onRemove})` shows a
  🗑️ button, and only our uploads pass it (an Apple album is read-only, so
  there's nothing to offer). Element prefix: `jr*`. Tables: `journeys`,
  `settings`, `questions` (schema in `supabase/`, guide in
  docs/SUPABASE.md). Serverless: `api/album.js` (iCloud CORS proxy)
- Lock screen: `#lock` overlay, password = anniversary date (DB
  `settings.lock_keys` when Supabase is up, `LOCK_KEYS` fallback),
  unlock persists via `#unlocked=1` hash param
- Hash-param helpers: `getHashParam()` / `setHashParam()` — the app's only
  "storage"; never assign `location.hash` directly

## Skills

Project skills ship in `claude-skills/` (run `./setup-claude.sh` once to copy
them into `.claude/skills/` for auto-discovery — or just read them directly
from `claude-skills/`, same content):

- **couple-app-dev** — read this before any change; conventions, testing, deploy
- **add-daily-questions** — adding questions / miss-you texts safely
- **add-new-game** — scaffolding a new game tab (Stupid Game #2 goes here)

If you're Claude and you can see this file: read all three skills now,
before writing code.

**Skills are living docs.** When a feature introduces a new tool, plugin,
convention, seed offset, or reusable piece, update the relevant skill in
`claude-skills/` in the same commit (see "Keep the skills in sync" in
couple-app-dev), then run `./setup-claude.sh` to refresh `.claude/skills/`.

## Docs

- `docs/ARCHITECTURE.md` — how everything works in detail
- `docs/SUPABASE.md` — backend setup (schema, keys, what lives in the DB,
  question-seed regeneration, security honesty)
- `docs/ROADMAP.md` — agreed future plan (Google login, photos,
  Claude API) and ideas backlog
- `START-HERE-LUCIA.md` — Lucia's from-zero setup guide (Terminal, brew,
  gh, SSH, Claude Code) + plain-English commit/PR/deploy explainer. If
  Lucia (or any beginner) hits tooling trouble, walk them through it
  patiently — assume zero dev knowledge.

## Workflow

edit `index.html` → open in browser to test → commit → push to `main`
→ Vercel deploys → both refresh their phones. That's the whole pipeline.

**Roadmap additions skip the ceremony.** When Riu or Lucia says "add this to
the roadmap", write the entry in `docs/ROADMAP.md` and commit it straight to
`main` — no branch, no PR, don't ask. It's a docs-only change to a file the
app never loads, so it can't break a deploy, and an idea sitting in a review
queue is an idea nobody can see. Same for the ideas backlog / parking lot.

This is the exception, not the pattern: **code** still gets a branch and a
PR. If a roadmap edit happens to be sitting in a feature branch alongside
code, lift just that file over to `main` rather than merging the branch.

## Parallel sessions

Multiple Claude sessions may be building different features at once.
**Before starting any feature: read `SESSIONS.md` and follow its protocol** —
`git pull` first, register your session, claim your regions of `index.html`
and any global identifiers (seed offsets, hash params, tab keys), and
pull-before-push when you ship.
