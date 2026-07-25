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
   this phone, for the Word Duel).
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
- Keep adult content on the Play tab. Home is the always-visible page and
  its Question of the Day draws from `QOTD_CATS` only — don't widen that
  pool to the spicy/filthy/dare categories.
- Panels: `.panel` (glassmorphism card). Games get full `.card` treatment.
- Buttons: `.primary` for the main action, `.toggled` for on-state.
- Feedback: `popToast("...")` for confirmations, `burst(x, y, [emojis])`
  for celebrations. Floating hearts are global — don't spawn extra loops.
- Voice: playful, flirty, a little dramatic. Emojis welcome. British-serious
  tone is a bug.

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

**Serverless functions** live in `api/` (Vercel auto-deploys them with the
static site — sanctioned by ROADMAP). Current: `api/album.js` (iCloud
shared-album proxy; iCloud sends no CORS headers so the browser can't call
it directly). The app must still degrade if a function is unreachable —
they're an enhancement, like Supabase. The Claude API proxy will join it.

External requests are still forbidden **except**: Supabase, and iCloud's
`sharedstreams` endpoints (Apple Shared Album embeds in the Journeys tab).
Both must degrade gracefully when unreachable.

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
- All four tabs switch; bottom nav highlights correctly and fits at 420px.
- Reload twice: daily question identical both times (determinism).
- Toggle After Dark: only spicy/nasty appear; theme turns red; toggle back.
- If you changed clocks/countdowns: check a simulated date (override `Date`
  in DevTools or temporarily change the constant — remember to change it back).

## Deploy

Commit → push to `main` → Vercel auto-deploys https://lucia-riu-app.vercel.app
within ~a minute. Both partners refresh. Never push a broken main; if a
change is risky, test locally first — there is no staging environment.

## Keep the skills in sync (do this as part of every feature)

The skills in `claude-skills/` are living docs — when a change makes them
stale or incomplete, updating them is part of shipping the feature, not an
optional extra. In the same commit as the feature:

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
