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

## index.html internals

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
Single file · no build · no deps · no storage APIs · works offline ·
works by double-clicking the file · both partners on same version.

## When a backend arrives (see ROADMAP)
Supabase (Postgres + storage + auth) + Vercel serverless functions.
That unlocks: real shared state (answer-and-compare, streaks, scores),
photo album, Google login restricted to the two of them, and Claude API
features (the key lives in a Vercel function, never in this file).
