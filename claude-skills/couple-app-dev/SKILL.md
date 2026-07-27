---
name: couple-app-dev
description: Use before making ANY change to the Lucia & Riu couple app (index.html). Covers the architecture, hard constraints (single-file, no localStorage, deterministic shared daily logic), styling conventions, testing checklist, and the deploy pipeline. Trigger on any request to add features, fix bugs, restyle, or refactor this app.
---

# Developing the Lucia ♥ Riu app

## Before anything: check SESSIONS.md

Multiple Claude sessions may be working on this repo in parallel. Read
`SESSIONS.md` at the repo root and follow its protocol: `git pull` first,
register the session, claim your `index.html` regions and any global
identifiers (seed offsets, hash params, tab keys, id prefixes), and
pull-before-push when shipping. If your feature collides with an active
session's claims, ask the user before proceeding.

## Hard constraints — check every change against these

1. **No build step; double-clicking `index.html` must work.** The app is
   `index.html` (markup only) + `css/*.css` + `js/*.js`, wired with plain
   `<link>`/`<script src>`. Put a change in the file that owns that
   feature — one tab, one js file, one css file. **Classic scripts only:
   never `type="module"` or `import`/`export`** (ES modules are blocked on
   `file://` — they'd break double-click, and Lucia's whole workflow is
   "open index.html"). Files share state via ordinary globals; script
   order in `index.html` is load-bearing (`core` first, `init` last).
   Top-level code may only touch things from an earlier-loaded file;
   anything called later (handlers, `init.js`) can reference anything.
   No external requests except (rarely) cdnjs.cloudflare.com if truly
   unavoidable. **Adding a new file? Add its tag to `index.html`** — it is
   not picked up automatically.
2. NO localStorage, sessionStorage, IndexedDB, or cookies — they fail in the
   preview environments the couple uses. Persistence options, in order:
   in-memory variable → URL hash param (like `#reunion=2026-12-20`) →
   hardcoded constant (like `ANNIVERSARY`). For hash params always use the
   `getHashParam(name)` / `setHashParam(name, val)` helpers (top of the
   script) — they let multiple params coexist as `#a=1&b=2`. Never assign
   `location.hash` directly (it clobbers the other params).
   Current hash params: `reunion` (countdown date), `unlocked` (login gate),
   `photo` (couple photo link when the DB is off), `me` (which of us is on
   this phone, for the Word Duel), `moon` (backup door into the hidden 🌙
   Moon tab).
   **Private data is the exception to the hash-param ladder.** The hash shows
   in the address bar and travels in any shared link, so the 🌙 Moon log
   (`js/cycle.js`) deliberately has no hash fallback: DB when it's up,
   memory-only when it isn't, and the panel says which.
3. Anything "shared" between the two partners without a server must be
   **derived deterministically from the date** (see pattern below), because
   the app runs as two independent copies with no communication.
4. Mobile first: test layouts at ~420px wide. The bottom nav must never
   overlap content (body has padding-bottom for it).
5. **Desktop is one media query, never a second layout.** Everything up to
   899px is the mobile column — the source of truth. A single
   `@media (min-width: 900px)` block at the END of the CSS widens `.app`
   (1080px cap) and turns Home and Duel into CSS grids via named
   `grid-template-areas`; Daily Q centres vertically; Trips just gets
   wider. Add a Home/Duel panel ⇒ give it an id and assign it a grid area
   there, or it drops into an implicit row. Never fork the markup or add
   JS breakpoints — desktop must stay pure CSS on top of mobile.
6. **Every tab is the same width on a laptop — don't give one its own
   `max-width`.** `.page.active { max-width: none }` makes them all fill
   `.app`, and `.app` is the single place to change how wide the app is.
   Tabs used to cap themselves individually (Plan 780, Journeys 880, Treats
   and Moon 940, Games 980, and 720–780 again for sub-views inside Games), so
   switching tabs jumped the content column by up to 360px and nothing lined
   up with the header or the nav. If a tab feels too wide, change the GRID
   inside it (column count, card size) — that's content density. Page width
   is not yours to set.

## The shared-daily pattern (the app's one clever trick)

```js
const seed = dayNumber() * 7919;      // days since EPOCH × a prime
const rng  = mulberry32(seed);        // deterministic PRNG
const pick = pool[Math.floor(rng() * pool.length)];
```

Same date ⇒ same seed ⇒ same pick on both phones. Reuse this for any new
"daily" feature (daily dare, daily compliment, daily photo prompt...) with a
different prime offset so features don't correlate:
`mulberry32(dayNumber() * 7919 + YOUR_OFFSET)`.

**If the feature shouldn't repeat, deal a deck instead of drawing.** A
single seeded draw per day *will* land on the same item two days running
(~5×/year on a 135-item pool) and leaves items unseen for years — that's the
birthday problem, not a bug in the PRNG. `dailyQuestion()` in
`js/questions.js` is the reference: shuffle the whole pool with
`shuffledOrder(n, offset + cycle * 7919)`, deal `day % n`, and swap the
first two cards when a new cycle would open on the previous cycle's last.
Copy that shape rather than reinventing it.

Two gotchas if you build one: bake any anti-repeat fix-up into the deck for
*every* day of the cycle (applying it only on the boundary day deals that
card twice), and remember growing the pool reshuffles every future day.

## js/init.js is a single statement list — guard every step

An exception in ANY line of `js/init.js` kills every line after it. This has
already broken the live app once: a refactor deleted `fdRenderFold` from
`js/food.js` and left the call in `init.js`, so the Home clock and the
together-counter froze at their static markup ("0d 0h 0m 0s", "--:--") and the
DB question bank never loaded — with **no console error visible** to anyone
who wasn't looking for one.

So: **new boot work goes through `boot("label", fn)`**, which catches and
warns, and the Home widgets are painted first and alone. One tab's dead
function must never stop another tab's clock.

**If you delete or rename a function, grep `js/init.js` for it in the same
commit.** That is the whole bug, and it costs one grep.

## Style conventions

- Theme via CSS variables in `:root`; the hot (Together-mode) palette
  overrides them in `.hot`, and **both `<html>` and `<body>` carry that
  class** (js/tfd.js toggles both). `<html>` needs the vars because its
  `background-color` paints the canvas — the strip iOS rubber-bands into
  past the top/bottom of the page. Leave that rule alone or the overscroll
  flashes white; the `theme-color` meta (tinting the phone's status bar) is
  swapped in the same handler.
- Talk · Flirt · Dare has ONE switch, `tfdSetMode(together)` — it owns the
  deck contents, `hotMode`, the `.hot` theme class, the `theme-color` meta,
  the subtitle and the chip states, so they can never disagree. Never flip
  `hotMode`/`tfdTogether` by hand.
- Keep adult content on the Talk · Flirt · Dare tab (`tfd`). Its nav button
  reads a deliberately innocuous **"🎭 Talk"** over the adult decks — don't
  "fix" it to something more suggestive. Home is the always-visible page and
  its Question of the Day draws from `QOTD_CATS` only — don't widen that
  pool to the spicy/filthy/dare categories.
- Games get a restart, and it's always reachable — not hidden behind an
  end state. Word Duel's `🔄 Restart` arms on the first tap and commits on
  the second (it wipes the score on BOTH phones, so a stray tap mustn't);
  Talk · Flirt · Dare's `🔄 Start over` is local, so it just goes.
- Anything identifying you as one partner locks once a shared game is under
  way — "I'm playing as" freezes after the duel's first heart/word or once a
  20 Questions round is live (`wdSideLocked()` in `js/duel.js`), so nobody can
  swap into the other's side mid-match. Restart is the escape hatch, and the
  chip stays clickable so the tap can explain itself in a toast rather than
  just going dead.
- **`#me` is ONE identity for the whole Games tab.** Both games render an
  "I'm playing as" row for it, so `renderWhoAmIRows()` (js/duel.js) paints
  BOTH and every game's render calls it. Don't give a new game its own
  copy of that markup logic — restarting one game has to unlock the other's
  row, and a per-game renderer leaves the hidden one stale.
- Panels: `.panel` (glassmorphism card). Games get full `.card` treatment.
- Buttons: `.primary` for the main action, `.toggled` for on-state.
- Feedback: `popToast("...")` for confirmations, `burst(x, y, [emojis])`
  for celebrations. Floating hearts are global — don't spawn extra loops.
- Voice: playful, flirty, a little dramatic. Emojis welcome. British-serious
  tone is a bug.

## It installs to the home screen (Add to Home Screen, not the App Store)

`manifest.webmanifest` + `icons/` + the iOS meta block in `<head>` make this a
real installed app: own icon, own app-switcher card, no Safari chrome. **No
App Store, no signing, no $99/yr, no expiry** — Share → Add to Home Screen.

- **Icons are checked in** (`icons/icon-180|192|512.png`). 180 is the one iOS
  actually uses (`apple-touch-icon`); 192/512 serve the manifest. There is no
  build step, so they were generated once from an SVG using macOS's own tools:
  write the SVG, `qlmanage -t -s 1024 -o out icon.svg`, then `sips -z <n> <n>`
  per size. Redo that if the icon changes — don't add a dependency.
- **`viewport-fit=cover` + `env(safe-area-inset-*)` are load-bearing.** With
  `apple-mobile-web-app-status-bar-style: black-translucent` the gradient runs
  behind the status bar, so `body` padding and the `.nav`/`.lock` offsets add
  the insets (`css/base.css`). Insets are 0 in a normal tab, so desktop is
  unchanged. **Anything new pinned to a screen edge must add them too**, or it
  lands under the clock or on top of the home indicator.
- Wrap inset rules in `@supports (padding: env(safe-area-inset-top))`. A bare
  `calc(16px + env(...))` is dropped wholesale by a browser without `env()`,
  taking the sane fallback with it.
- **Don't add a service worker without weighing golden rule 4.** A cached shell
  is exactly how two phones end up on different versions. If one is ever added
  it must be network-first for HTML/CSS/JS.
- On `file://` the manifest just fails to fetch and is ignored — double-click
  still works, which is the whole point.
- Launch state: `start_url` is `./`, so an installed launch starts with **no
  hash** — no `#unlocked=1`, no `#me`. Combined with the session living in
  `sessionStorage`, a cold launch re-runs the lock. Worth remembering before
  blaming a bug.

## Tabs that host more than one thing (the chooser pattern)

Used twice now — 🎮 Games (`gamesShow`, js/twenty.js) and 💝 Treats
(`treatsShow`, js/food.js) — and the roadmap's tab plan needs it again. Copy it
exactly; each rule below exists because skipping it broke something:

- The tab keeps a `*Pick` global **in `js/core.js`** (`gamesPick`,
  `treatsPick`) so hooks and polls elsewhere can guard on it. Claim the name in
  SESSIONS.md first.
- `*Show(which)` sets the pick, toggles each sub-view's `style.display`,
  toggles `.sel` on the chips, and sets the subtitle. **Use `display = ""`,
  never `"block"`** — `css/desktop.css` puts the wide layout on the inner
  container and an inline style would beat it.
- Scope desktop rules to the **sub-view** id (`#treatFood .fd-grid`), not the
  page (`#page-*.active`), for anything inside a chooser. Page-level width can
  stay on the page.
- **`TAB_HOOKS.<tab> = () => somethingShow(somethingPick)`** — re-run the whole
  chooser on open, don't just call the loader. `switchTab()` sets the subtitle
  from `SUBTITLES[tab]` and knows nothing about sub-views, so returning to a
  tab with the *other* sub-view remembered otherwise leaves the wrong subtitle
  on screen. Make `*Show` idempotent and this is free.
- Only the **visible** sub-view may fetch or poll. A hook that loads everything
  on open silently undoes the lazy-loading work (see "Idle cost" below).
- The pick is remembered in memory for the session, so coming back lands where
  you left off rather than resetting.

## Colour: everything comes from the five vars

There are six palettes now (`css/themes.css`, picked in Settings, stored in
`settings.theme` so it changes on **both** phones). They work because no
component knows a colour — each theme only redefines `--bg1/2/3`, `--accent`,
`--accent-soft`, and the rest of the app reads those.

- **Never hardcode a hex in a component.** A literal is a colour that won't
  follow the theme; it's how `button.toggled` sat on the wrong red for weeks.
  `--card-bg`/`--card-border`/`--text`/`--text-dim` are deliberately
  white-with-alpha so they sit on any dark background — leave them alone.
- A theme is one class on **`<html>` AND `<body>`** (the root needs it: its
  `background-color` paints the strip iOS rubber-bands into).
- **💞 Together mode must outrank every theme.** `base.css` uses
  `html.hot, body.hot` (0,1,1) rather than `.hot` for exactly that — theme
  classes are also single classes and load later, so on equal specificity
  source order would let a palette beat Together. Don't "tidy" that selector.
- The `theme-color` meta (the phone's status-bar tint) is set from the live
  computed `--bg1` by `thSyncBar()`. Don't write a hex into it — there isn't
  one "normal" colour any more.
- Adding a theme = one class in `css/themes.css` + one entry in `THEMES`
  (`js/theme.js`). No other file changes.
- All six are dark on purpose. A light theme needs the leftover hardcoded
  `rgba(10,4,18,…)` in `.nav`, the `.mn-negative` red and friends turned into
  variables first — half-legible is worse than not shipping it.

## Idle cost — the app must do nothing when nobody is looking

This runs on two phones all day. Anything on a timer is a battery and data
bill, so four rules:

1. **Split timers by how often the value actually changes.** Home has
   `homeTickFast()` (1s: the seconds counters) and `homeTickSlow()` (60s: the
   anniversary date, the SF/Phoenix gap). A date string that changes once a
   day has no business on a 1s timer. New widget ⇒ put it on the slower one
   unless it visibly moves every second.
2. **Never build an `Intl.DateTimeFormat` inside a tick.** Constructing one
   costs ~100× calling `.format()` on a cached instance — the old
   `tickClocks()` built four a second. Hoist formatters to module scope
   (`FMT_RIU`/`FMT_LUCIA` in `js/home.js`).
3. **Guard on-screen work with `activeTab`,** since every other tab is
   `display:none`. Repaint on the way back in via `TAB_HOOKS.<tab>` so the
   numbers are right before an eye lands on them. Use `setNum(el, val)`-style
   write-only-if-changed helpers rather than assigning unconditionally.
4. **`document.hidden` may throttle a poll, but must never gate the UI.**
   Some webviews (including the preview browsers this project already
   distrusts) report `hidden === true` while perfectly visible. So:
   - **Pollers** back off — `wdTicks`/`q20Ticks`/`cyTicks` drop to ~30s while
     hidden instead of stopping. A missed poll is self-healing; a poll that
     stops forever makes the duel look broken.
   - **Clocks and counters** aren't hidden-gated at all. Backgrounded phones
     freeze timers on their own, so the gate buys almost nothing and risks a
     frozen clock that never recovers.

`loadSettings()` is the **boot handoff** for every settings-backed feature: it
already fetches the whole `settings` table, so `js/init.js` passes its rows to
`wdAdopt`/`q20AdoptRows`/`cyAdopt` instead of each firing its own GET. Adding a
settings-backed feature? Give it an `*Adopt(rows)` that its poll also reuses,
and hook it in there — don't add a fifth boot request.

## The Supabase backend (v5) — fallback-first, always

Shared state now syncs through Supabase via plain `fetch` against its REST
API (PostgREST) — **no SDK** (single-file rule). Everything lives in the
JOURNEYS block of `index.html`:

- Config: `SUPABASE_URL` + `SUPABASE_ANON_KEY` constants. Empty = "local
  mode"; the app must keep working fully (golden rule 6 in CLAUDE.md).
- Helper: `supa(path, {method, body, prefer})` — returns parsed JSON,
  throws on non-2xx. Upserts: `supa("settings?on_conflict=key", {method:
  "POST", prefer: "resolution=merge-duplicates", body: {...}})`.
- Tables: `journeys` (timeline), `settings` (key/value: `lock_keys`,
  `reunion_date`), `questions` (the bank; feeds `QUESTION_SOURCE`).
  Schema + seed in `supabase/`; setup guide in docs/SUPABASE.md.
- **A poll that was already in flight when you acted will clobber you.**
  The 2s pull applies whatever it fetched, so a question you just submitted
  can vanish for a second and then reappear. `js/twenty.js` bumps a
  `q20Writes` counter on every local change and discards any pull whose
  counter moved mid-flight — copy that for any new polled game. A
  `pushing` flag alone is NOT enough: it only blocks pulls that *start*
  during the push.
- **Every DB feature keeps its no-server fallback** (hardcoded const,
  in-memory state, or hash param) and swallows fetch errors quietly —
  offline is normal, not an error state.
- New shared state? Prefer a `settings` key/value row; claim the key (and
  any new table name) in SESSIONS.md. For state both phones *write*
  concurrently, let Postgres arbitrate instead of comparing clocks — the
  duel's "who answered first" PATCHes `settings?key=eq.duel_first&value=eq.`
  so only the first writer matches. **Prefer a `settings` row to a new
  table**: a new table needs a migration run by hand, and the duel shipped
  once needing one that never got run — it silently synced nothing while
  the UI claimed otherwise. If a feature can't work until someone runs SQL,
  it will eventually be found broken. Surface real sync state in the UI
  rather than assuming success. Poll on a timer guarded by
  `activeTab === "<tab>"`; there's no realtime SDK (no-SDK rule). Render user-entered DB text with
  `textContent`/DOM APIs, never `innerHTML` (XSS).
- Editing `BANK`? Regenerate the seed (`python3 supabase/generate_seed.py`)
  and re-apply it in the SQL editor (see docs/SUPABASE.md) — the DB copy
  and hardcoded copy must stay identical or the daily pick diverges.

**Photo storage (🍜 Food, 2026-07-25)** is the one feature with files rather
than rows. Conventions worth copying:

- Bucket `food`, public read, created by `supabase/food.sql`. The anon key
  **cannot** create a bucket, so this migration genuinely must be run by
  hand — the tab detects it and switches itself off with an honest message.
- **Resize in the browser before uploading** (`fdResize`, 1600px long edge,
  JPEG 0.82 ≈ 300KB). The free tier is about a gigabyte; raw phone photos
  are 4-8MB each.
- **Read EXIF from the original bytes first** — drawing to a canvas to
  resize discards every tag. `fdExif` in `js/food.js` is a hand-rolled
  reader (no dependencies allowed) for date + GPS only.
- **A photo date is a wall clock, not an instant.** EXIF has no timezone,
  so `taken_at` stores what the camera wrote and everything renders with
  `timeZone: "UTC"`. Convert it through a real zone instead and a 23:30
  dinner shows as a different DAY on the other phone — Riu and Lucia are an
  hour apart for half the year. This bit us in testing; keep the pattern.

**Serverless functions** live in `api/` (Vercel auto-deploys them with the
static site — sanctioned by ROADMAP). Current: `api/album.js` (iCloud
shared-album proxy; iCloud sends no CORS headers so the browser can't call
it directly), `api/geocode.js` (GPS → city/country via OpenStreetMap, which
needs a server-side User-Agent and ≤1 req/s), `api/food-import.js` (copies
shared-album bytes into our bucket). The app must still degrade if a function is unreachable —
they're an enhancement, like Supabase.

External requests are still forbidden **except**: Supabase, iCloud's
`sharedstreams` endpoints (Apple Shared Album embeds in the Journeys tab), and
the Claude API **via `api/claude.js` only**. All must degrade gracefully when
unreachable.

### Adding a Claude ✨ feature

`api/claude.js` + `js/ai.js` shipped 2026-07-26. Adding a feature means adding
a **task**, not a new endpoint. Four rules, each of which exists because the
alternative is a real hole:

1. **Add an entry to `TASKS` in `api/claude.js`** — a system prompt, a JSON
   schema, and a function that builds the user message from the posted data.
   Never accept a prompt string from the browser: the allowlist stops
   strangers, but a stolen JWT should read our trip plan, not run anything on
   our card.
2. **Gate the caller on `aiReady()`** and render no button when it's false
   (`file://`, signed out, or the function undeployed). Golden rule 6 covers
   Claude: the tab has to be complete without it.
3. **Whitelist the payload field by field.** Never post a whole row or table.
   **The 🌙 Moon log and cycle data never leave the app** — not in a summary,
   not "for context", not ever.
4. **Preview before writing.** Anything the model produces that would land in a
   shared table gets a ticklist first. Both phones read the same rows, so a
   feature that writes straight through is putting decisions in front of the
   other person that neither of you agreed to.

Also worth knowing: use `output_config.format` with a JSON schema so there's no
parsing to defend; validate any model-supplied key that the UI keys off (the
draft checks `day_date` against the trip's own days, because a date outside
them would save a row onto a day nothing renders); and check
`stop_reason === "refusal"` before reading content. Env vars live in Vercel —
`ANTHROPIC_API_KEY`, `LR_ALLOWED_EMAILS`, `LR_SUPABASE_URL`,
`LR_SUPABASE_ANON_KEY` — and the allowlist must agree with `public.is_us()`
and `allowed_emails`. **Read the issuer from env, never from the request
body**: `api/food-import.js` takes it from the body, which is harmless there
and a complete bypass here.

## Testing with the in-app browser (Claude sessions)

The sandboxed preview server can't read `~/Desktop` (macOS folder
protection). Copy `index.html` **plus `css/` and `js/`** into the session
scratchpad and serve it from there (see `.claude/launch.json` — re-copy
after every edit), or just open the file in the user's real browser.

**Known limits of that browser — don't diagnose bugs from them:**
- It does **not** honour `loading="lazy"`: an in-viewport lazy image never
  loads, while an `eager` sibling does. An unloaded thumb there proves
  nothing about real phones. Verify with a lazy-vs-eager control pair in
  the same container before believing any "images don't load" finding.
- `file://` URLs are refused, so double-click behaviour can't be checked
  here — ask the user.
- `/api/*` doesn't exist on the static scratchpad server, so album code
  falls back to the direct-iCloud path and fails on CORS. Stub the fetch
  helpers to test hydration logic, or use a real deployment.

## The lock screen (login gate)

`#lock` overlay + the LOCK SCREEN script block. Password = the anniversary,
June 2 2026, accepted in any digit form or as text ("june 2"). The digit
list comes from the DB (`settings.lock_keys`, editable in the Supabase
table editor) with the hardcoded `LOCK_KEYS` as offline fallback. Success
sets `#unlocked=1` in the hash so refreshes skip the gate; wrong answers
get escalating sass from `LOCK_SASS`. It's a cute gate,
not security — the answer is in the source. Keep new features BELOW it:
everything else initializes normally whether locked or not, the overlay
just covers it.

## Testing checklist before every commit

- Open `index.html` in a browser (that IS the dev environment). No console
  errors — including with Supabase unreachable (local mode must work).
- **Open it by double-click too, not just through a server** — that's the
  one thing the modular layout could silently break (a stray `import`, or
  a new file missing its `<script src>` tag).
- Lock screen: wrong date shakes + sasses; `06/02/2026` (or "june 2")
  unlocks with hearts; reload with `#unlocked=1` skips straight in.
- All four nav tabs switch; bottom nav highlights correctly and fits at
  420px. Then the hidden fifth: long-press the header `♥` for ~1.2s → 🌙
  Moon opens with NO nav button lit; `✕` goes Home; a refresh lands on Home.
- Reload twice: daily question identical both times (determinism).
- Talk · Flirt · Dare: flip 💞 Together / ✈️ Apart — the deck contents, the
  hot red theme, the subtitle and the chips all move together (one switch,
  `tfdSetMode`). Flip back.
- If you changed clocks/countdowns: check a simulated date (override `Date`
  in DevTools or temporarily change the constant — remember to change it back).

## Deploy

Commit → push to `main` → Vercel auto-deploys https://lucia-riu-app.vercel.app
within ~a minute. Both partners refresh. Never push a broken main; if a
change is risky, test locally first — there is no staging environment.

**Roadmap additions go straight to `main`.** Asked to "add this to the
roadmap"? Write the entry in `docs/ROADMAP.md`, commit, push — no branch, no
PR, no asking first. The app never loads that file, so it cannot break a
deploy, and an idea stuck in a review queue is an idea nobody can see. Same
for the parking lot / ideas backlog.

Code is the opposite: branch + PR, as always. If a roadmap edit is sitting in
a feature branch next to code, lift that one file over to `main` (stash it,
switch, pop) instead of merging the branch to get it out.

### Check the PR is still open before pushing to it

**Riu merges PRs himself, whenever he likes — including in the middle of your
session, without telling you.** A branch you opened a PR from is not yours to
assume anything about. Before adding a commit to a branch whose PR you already
opened:

```bash
gh pr view <n> --json state -q .state      # MERGED / CLOSED / OPEN
```

If it is not `OPEN`, that push goes to a dead branch: GitHub will accept it,
the PR page will not show it, and nothing you wrote reaches `main`. It looks
exactly like success. Start a fresh branch off the **current** `origin/main`
instead and cherry-pick:

```bash
git fetch origin
git worktree add ../lr-<task> -b fix/<name> origin/main
git cherry-pick <sha>          # or just redo the edit
```

This happened on 2026-07-27: four commits went onto `feature/plan-polish`,
Riu merged PR #49 after the third, and the fourth (the Someday delete
confirm) sat on a merged branch — reported as shipped, actually nowhere.

Two habits that make it a non-issue:
- **Re-check before every follow-up push**, not once per session. "It was open
  ten minutes ago" is not evidence.
- **After any push, confirm the commit is reachable from main** before you
  tell Riu it shipped:
  `git merge-base --is-ancestor <sha> origin/main && echo ON-MAIN || echo STRANDED`
  (Expect STRANDED while a PR is legitimately awaiting review — the point is
  to know which of the two you are looking at, and say so.)

## Keep the skills in sync (do this as part of every feature)

The skills in `claude-skills/` are living docs — when a change makes them
stale or incomplete, updating them is part of shipping the feature, not an
optional extra. In the same commit as the feature:

`claude-skills/` remains the detailed source of truth for both agents.
Claude receives copied files through `setup-claude.sh`; Codex automatically
discovers the thin adapters in `.agents/skills/`, and those adapters load these
canonical files. Update a Codex adapter only when Codex-specific routing,
permissions, tools, or terminology changes. Put durable repository-wide Codex
rules in `AGENTS.md`.

- **New game/tab shipped?** Update `add-new-game`: record the seed OFFSET it
  used (so the "next free offset" hint stays correct), and note any new
  reusable pieces (helpers, CSS classes, patterns) future games should use.
- **New question category, or BANK/MISSYOU structure changed?** Update
  `add-daily-questions` (categories, tone guide, After Dark wiring).
- **New convention, constant, helper, tool, or plugin introduced?** (e.g. a
  new `tick*()` widget, a new URL-hash param, a linter, an MCP server, a
  backend like Supabase) — document it here in `couple-app-dev`, and in
  CLAUDE.md's map if it changes the file's structure.
- **Feature big enough to need its own skill?** Create a new
  `claude-skills/<name>/SKILL.md` with a trigger-rich `description:`
  frontmatter, and list it in CLAUDE.md and README.md.

After editing skills, run `./setup-claude.sh` so the copies in
`.claude/skills/` match — `claude-skills/` is the source of truth, and both
locations must stay identical.
