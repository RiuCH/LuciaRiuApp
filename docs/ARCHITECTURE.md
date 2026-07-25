# Architecture

One HTML file, two phones, zero servers. This doc explains how that works.

## The whole system

```
GitHub (main) ──auto──▶ Vercel ──▶ https://lucia-riu-app.vercel.app
                                      │                │
                                 Riu's phone      Lucia's phone
                                 (independent copies, never talk to each other)
```

Both phones run identical copies of `index.html`. There is no backend, no
database, no accounts. Anything that must be "the same for both" is computed
deterministically from the calendar date on each device independently.

## How the files fit together

`index.html` holds only markup — the lock overlay, the four
`<section class="page">` tabs, the nav — plus `<link>` tags for
`css/*.css` and `<script src>` tags for `js/*.js`. There is no bundler
and no build step: the browser loads the files directly, which is why
double-clicking `index.html` still works.

They are **classic scripts, deliberately not ES modules.** Modules are
blocked on the `file://` protocol, so `import`/`export` anywhere would
mean the app only runs behind a web server — breaking the "just open it"
workflow. Instead the files share ordinary globals, and the script order
in `index.html` is load-bearing:

```
core → supabase → questions → home → journeys → duel → lock → init
```

`js/core.js` defines what everyone needs (`switchTab`, `popToast`,
`burst`, `mulberry32`, `dayNumber`, the hash-param helpers).
`js/init.js` runs last and does all the boot work, so any file may call
into any other by then — only *top-level* code is order-sensitive.

## Internals

### Data
| Thing | What it is |
|---|---|
| `BANK` | ~135 questions in 5 category arrays (funny/romantic/spicy/nasty/ldr) |
| `MISSYOU` | 15 miss-you strings for the generator |
| `CHIPS` | category → label + color |
| `EPOCH` | Jul 24 2026 — "Day 1" of the app's day counter |
| `ANNIVERSARY` | Jun 2 2026 — together-clock start + yearly countdown target |
| `TZ_RIU` / `TZ_LUCIA` | IANA timezones for the dual clocks |

### Determinism (the core trick)
`dailyQuestion()` seeds `mulberry32` (a tiny 32-bit PRNG) with
`dayNumber() * 7919` and takes one draw from the flattened pool. Deterministic
seed ⇒ identical question on both phones. After Dark daily uses seed offset
`104729` over the spicy+nasty pool only. New daily features should use fresh
prime offsets.

`randomQuestion()` (the 🎲 button) is intentionally NOT shared — real
`Math.random()`, with in-session repeat avoidance (`usedShuffle`).

### UI
Three `<section class="page">` blocks (home / game / soon), toggled by
`switchTab()`; fixed glass bottom nav. Theme = CSS variables in `:root`,
overridden by `body.afterdark`. Live tickers (`tickAnniversary`,
`tickClocks`, `tickCountdown`) run on a single 1-second interval. A
60-second interval rolls the daily question over at midnight if the tab
stays open.

### Time & timezone notes
- Clocks use `Intl.DateTimeFormat` with explicit `timeZone` — correct
  regardless of which device renders them.
- Phoenix (Lucia) has no DST: same clock as SF in summer, 1h ahead in winter.
  The tz-diff line computes this live rather than hardcoding.
- The "day" flips at each device's local midnight.

### Persistence
None, by design (no localStorage — breaks in preview environments).
The reunion date persists via URL hash (`#reunion=YYYY-MM-DD`), so it
survives refresh only if the URL keeps the hash (bookmark/home-screen apps do).

## Constraints recap
Single file · no build · no deps · no storage APIs · works offline
(Supabase and iCloud calls degrade gracefully) · works by double-clicking
the file · both partners on same version.

## The backend (v5): Supabase, fallback-first

The app now talks to Supabase via its plain REST API (PostgREST) with
`fetch` — no SDK, so the single-file rule holds. Config = two constants in
the JOURNEYS block (`SUPABASE_URL`, `SUPABASE_ANON_KEY`); when they're
empty or the network fails, every feature falls back to the old
no-server behavior. Setup: [SUPABASE.md](SUPABASE.md).

| Table | Feeds | Fallback |
|---|---|---|
| `journeys` | ✈️ Trips timeline | seed entry + in-memory adds |
| `settings` | lock password (`lock_keys`), shared reunion date (`reunion_date`) | `LOCK_KEYS` const, `#reunion=` hash |
| `questions` | `QUESTION_SOURCE` for the daily game | hardcoded `BANK` |

Determinism note: the daily pick is still seeded locally; the DB only
supplies the pool. The seed SQL is generated from `BANK`
(`supabase/generate_seed.py`) so both copies stay identical — an online
and an offline phone then still agree on the day's question.

The ✈️ Trips tab also embeds Apple Shared Albums: paste an album's public
link into a journey and the app pulls thumbnails from iCloud's unofficial
`sharedstreams` web API (the album needs "Public Website" ON). If that API
ever breaks, the card falls back to an "Open album ↗" link. iCloud sends
no CORS headers, so the browser calls our own Vercel serverless proxy
(`api/album.js`, same origin) which fetches the album server-side — the
repo's first serverless function. Per-journey photo picks live in
`journeys.photo_guids` (chosen in the in-app picker).

Still to come (see ROADMAP): Google login (tightens the wide-open anon
policies), Supabase Storage photo album, answer-and-compare, and Claude
API features via a Vercel serverless function.
