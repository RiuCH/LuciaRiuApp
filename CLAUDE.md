# Lucia ♥ Riu App — Claude Context

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
   always via the `getHashParam`/`setHashParam` helpers so params coexist
   (current: `#reunion=YYYY-MM-DD`, `#unlocked=1`, `#photo=<url>`,
   `#me=lucia|riu`, `#moon=1`). Private data is the exception — the 🌙 Moon
   log stays out of the hash on purpose, since the hash is visible in the
   address bar and in shared links.
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

`index.html` is now just markup: the lock overlay, the five `<section
class="page">` tabs (four in the nav + the hidden 🌙 Moon one), the nav,
and the `<link>`/`<script src>` tags.

| File | What lives there |
|---|---|
| `css/base.css` | theme vars, layout shell, `.panel`/`.card`/`.chip`/buttons, Daily Q page, nav, toast, burst, lock screen |
| `css/home.css` | anniversary, clocks, countdown, teasers, couple photo |
| `css/tfd.css` | Talk · Flirt · Dare: mode switches, deck buttons, prompt card |
| `css/journeys.css` | timeline, journey cards, photo grid, lightbox, picker |
| `css/food.css` | 🍜 Food: month rail, photo grid, tag lightbox, album picker |
| `css/duel.css` | letter pair, hearts, penalty modes |
| `css/twenty.css` | Games-tab chooser, 20 Questions board + interrogation log |
| `css/cycle.css` | 🌙 Moon: month grid, day marks, stat tiles |
| `css/desktop.css` | the whole `@media (min-width: 900px)` layout |
| `js/core.js` | hash params, `EPOCH`/`afterDark`, `mulberry32`, `dayNumber`, `switchTab`, `popToast`, `burst`, hearts |
| `js/supabase.js` | `SUPABASE_*` config, `supa()`, `loadSettings()`, `saveReunion()`, `loadQuestions()` |
| `js/questions.js` | `BANK` (11 prompt categories), `CHIPS`, `QUESTION_SOURCE`, the seeded daily deck (`dailyQuestion()`) |
| `js/tfd.js` | Talk · Flirt · Dare tab: the three decks, Together/Apart mode (`tfd*`) |
| `js/home.js` | `MISSYOU`, anniversary/clock/countdown ticks, couple photo (`cp*`) |
| `js/journeys.js` | timeline CRUD + sort, iCloud album, lightbox (`jr*`) |
| `js/food.js` | 🍜 Food: uploads, EXIF, timeline, tags, search (`fd*`) |
| `js/duel.js` | Word Duel (`wd*`) |
| `js/twenty.js` | 20 Questions (`q20*`) **and** the Games-tab chooser (`gamesShow`) |
| `js/cycle.js` | 🌙 Moon: cycle calendar + our tally (`cy*`) — the hidden tab |
| `js/lock.js` | login gate |
| `js/init.js` | boot order — **loads last** |

Script order in `index.html` is load-bearing: `core` → `supabase` →
`questions` → `home` → `journeys` → `food` → `duel` → `twenty` → `cycle` →
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
  funny + romantic + ldr); everything adult lives behind the Talk · Flirt ·
  Dare tab, whose nav button reads a deliberately innocuous **"🎭 Talk"**
  (the tab key is still `tfd`)
- `MISSYOU` — miss-you text generator strings
- `CHIPS` — category labels/colors
- Constants: `EPOCH` (day counter start), `ANNIVERSARY` (June 2, 2026),
  `TZ_RIU`/`TZ_LUCIA` (clock timezones)
- Tabs: sections `#page-home`, `#page-tfd`, `#page-journeys`, `#page-duel`,
  `#page-cycle` + `switchTab()`, which iterates the `TABS` array in
  `js/core.js`. A tab with no `NAVIDS` entry simply has no nav button —
  that's how 🌙 Moon stays hidden
- Question of the Day: a card on **Home** (`qotd*` in `js/home.js`), not a
  tab. One per day, same on both phones, unchanged by refresh
- Talk · Flirt · Dare (`#page-tfd`): three decks, live `Math.random()` draws
  (one phone during a call — no seed needed). One switch: 💞 Together vs
  ✈️ Apart, which picks the deck contents AND runs the app hot (`hotMode`
  + `.hot` class on `<html>`+`<body>`). Filthy prompts are in the decks, not
  behind a separate After Dark tier
- Daily logic: `dailyQuestion()` (seeded deck, no repeats until the pool is
  exhausted — `shuffledOrder`/`deckForCycle`);
  pool comes from `QUESTION_SOURCE` (= `BANK`, swapped to the DB copy once
  `loadQuestions()` succeeds — content identical, so the pick doesn't change)
- 🍜 Food (`#page-food`, `fd*` in `js/food.js`): every meal we've eaten
  together. Photos live in **Supabase Storage** (bucket `food`) with rows in
  `food_photos` / `food_tags` / `food_photo_tags` — the app's first real
  file storage, and it needs `supabase/food.sql` run once (the tab says so
  until then). Uploads are resized to 1600px in-browser before they leave
  the phone. **You cannot upload INTO an Apple Shared Album** — Apple's API
  is read-only — so album photos are *copied* into our bucket by
  `api/food-import.js`; iCloud asset URLs are signed and expire.
  EXIF gives us the capture date and GPS; `api/geocode.js` turns GPS into
  city/country tags via OpenStreetMap. `taken_at` holds a **wall clock**
  (rendered in UTC), never an instant — see the comment in `fdExifDate`
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
  repo is public, same honesty as the lock screen
- Couple photo: `cp*` block — home hero image from `settings.home_photo`
  (URL / upload data-URL / `album:<link>` = Apple-album photo-of-the-day,
  seed offset 15485863); `#photo=` hash + session fallbacks
- Home widgets: `tickAnniversary()`, `tickClocks()`, `tickCountdown()`
- JOURNEYS block: `SUPABASE_URL`/`SUPABASE_ANON_KEY` config, `supa()` REST
  helper, `loadJourneys()`/`loadSettings()`/`loadQuestions()`, timeline
  render + add/delete, Apple Shared Album embed (`fetchICloudAlbum()`),
  lightbox, sort chips (`jrSort`: oldest/latest/shortest/longest),
  edit form (`jrEditing`), photo picker (`jrPicker*`,
  `journeys.photo_guids`). Element prefix: `jr*`. Tables: `journeys`,
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

## Parallel sessions

Multiple Claude sessions may be building different features at once.
**Before starting any feature: read `SESSIONS.md` and follow its protocol** —
`git pull` first, register your session, claim your regions of `index.html`
and any global identifiers (seed offsets, hash params, tab keys), and
pull-before-push when you ship.
