---
name: add-new-game
description: Use when adding a new game or tab to the Lucia & Riu app (e.g. "Stupid Game #2", a quiz, a daily dare, a drawing game). Step-by-step scaffold for a new page section, nav button, and shared-daily logic, plus the rules that keep the app working for both partners.
---

# Adding a new game tab

The 🕹️ Soon™ placeholder slot was consumed by **Word Duel** (`#page-duel`,
2026-07-24) — new games now add their own tab. Watch nav width at ~420px:
four tabs fit, five probably won't; consider replacing/merging instead.

Word Duel is also the reference implementation of a "one phone runs it
during a call" game: live `Math.random()` is fine for those (no seed
offset needed) because only one device generates state. Deterministic
seeding is only required when BOTH phones must independently agree.

## Scaffold (5 steps, all in index.html)

1. **Page section** — next to the other `<section class="page">` blocks:
   ```html
   <section class="page" id="page-mygame">
     <div class="panel">…game UI…</div>
   </section>
   ```
2. **Nav button** — inside `<nav class="nav">`:
   ```html
   <button id="navMygame">🎯 My Game</button>
   ```
3. **Register the tab** — in the TABS part of the script, extend both maps:
   ```js
   SUBTITLES.mygame = "Some Cute Subtitle";
   NAVIDS.mygame = "navMygame";
   ```
   …and make sure `switchTab` iterates your tab (extend the
   `["home","game","journeys","duel"]` array) and add the click listener
   like the others.
4. **Teaser (optional but nice)** — add a tappable `.panel.teaser` card on
   Home that `switchTab`s to your game, like the Question of the Day teaser.
5. **Test** — open `index.html`, click every tab, check the browser console.

## Game design rules for a two-phone, no-server app

- **Shared daily content** must derive from the date:
  `mulberry32(dayNumber() * 7919 + OFFSET)` — pick a unique OFFSET per
  feature. The claimed-offset registry lives in `SESSIONS.md` (source of
  truth) — claim yours there before using it. Same date ⇒ both phones
  independently compute identical content.
- **Cross-device state exists now, but is optional.** The Supabase backend
  (v5, see docs/SUPABASE.md) can store shared game state — reuse the
  `supa()` helper and claim any new table/settings key in SESSIONS.md.
  BUT every game must still work with Supabase unconfigured/offline
  (fallback-first, golden rule 6) — the shared-daily deterministic pattern
  needs no server and is still the default. Never localStorage (forbidden).
- **Session state is fine** (variables reset on refresh): current round,
  shuffle history, a score for tonight's session.
- Reuse the house pieces: `.panel`, `.chip`, `popToast()`, `burst()`,
  After Dark awareness via `document.body.classList.contains('afterdark')`.

## Ideas already floated (see docs/ROADMAP.md)

Guess-my-answer duel, couple trivia, daily dare generator, emoji-story
decoder, "two truths and a lie: relationship edition".
