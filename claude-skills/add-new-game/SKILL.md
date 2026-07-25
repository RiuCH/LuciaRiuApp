---
name: add-new-game
description: Use when adding a new game or tab to the Lucia & Riu app (e.g. "Stupid Game #2", a quiz, a daily dare, a drawing game). Step-by-step scaffold for a new page section, nav button, and shared-daily logic, plus the rules that keep the app working for both partners.
---

# Adding a new game tab

The 🕹️ Soon™ placeholder slot was consumed by **Word Duel** (`#page-duel`,
2026-07-24) — new games now add their own tab. **The nav is FULL at five
buttons** (Home / Talk / Trips / Food / Games) as of the 🍜 Food tab, with
labels already trimmed to fit 375px. A sixth will not fit: use the 🎮 Games
hub pattern (two games in one tab) or the 🌙 Moon no-nav-button pattern,
both described below.

Word Duel is also the reference implementation of a "one phone runs it
during a call" game: live `Math.random()` is fine for those (no seed
offset needed) because only one device generates state. Deterministic
seeding is only required when BOTH phones must independently agree.

## Or: a second game inside an existing tab (the 🎮 Games pattern)

The nav is full at four buttons, so game #4 went *inside* the Duel tab
rather than beside it — that tab is now 🎮 Games. `#page-duel` holds a
`.games-picker` plus two wrappers, `#gameDuel` and `#game20q`;
`gamesShow(which)` in `js/twenty.js` toggles them and sets `gamesPick`
(declared in `js/core.js` so each game can guard its own poll).

Three things that bit, in order:

- **Hide with `display:none`, show with `""`** — never `"block"`. An inline
  display silently overrides the desktop grid, and the duel quietly lost its
  two-column layout.
- **Move the desktop grid onto the wrapper.** `css/desktop.css` targeted
  `#page-duel.active`; with a wrapper in between, the grid items are no
  longer the page's children. Those rules live on `#gameDuel` now, scoped
  so the other game keeps its own margins.
- **Guard every poll on `gamesPick`**, or the hidden game keeps hitting the
  DB every 2s and re-rendering behind the one you're actually looking at.
## Or: a tab with no nav button (the 🌙 Moon pattern)

`#page-cycle` (2026-07-25) is the reference for a tab that shouldn't be
advertised, and it's also how you dodge the four-tabs-at-420px ceiling —
a hidden tab costs no nav width at all. What makes it work:

- `switchTab()` iterates the `TABS` array in `js/core.js`, and only touches
  the nav when `NAVIDS[tab]` exists. So: add your key to `TABS` and
  `SUBTITLES`, and **leave `NAVIDS` alone**. No button, no highlight.
- Give it its own way out — Moon has a `✕` that `switchTab("home")`s,
  since there's no nav button to tap.
- Don't make it sticky. Moon isn't stored in the hash, so a refresh always
  lands on Home and the tab re-hides itself.
- The door is a long-press on `#secretHeart` (the header `♥`, 1.2s,
  `CY_HOLD_MS` in `js/core.js`) plus `#moon=1` as a typed backup. If you
  add a second hidden tab, reuse the long-press handler with a different
  target rather than inventing a second gesture — and `preventDefault()`
  the `contextmenu`, or iOS pops its copy/look-up callout mid-gesture.
- **Say what it is.** Hidden ≠ protected: the repo is public and the page
  source is readable. Same honesty as the lock screen — never let the UI
  imply more privacy than there is.

## Scaffold (6 steps)

1. **Make your two files first** — `js/mygame.js` and `css/mygame.css`,
   then add their tags to `index.html`: `<link>` in `<head>`, and
   `<script src="js/mygame.js"></script>` **before `js/init.js`**. Nothing
   is picked up automatically. Classic script — no `import`/`export`
   (ES modules break double-click). Keep your game's state and handlers
   in your own file; call shared helpers (`switchTab`, `popToast`,
   `burst`, `mulberry32`) from `js/core.js`. Boot work goes in
   `js/init.js`, not at the top level of your file.
2. **Page section** — in `index.html`, next to the other
   `<section class="page">` blocks:
   ```html
   <section class="page" id="page-mygame">
     <div class="panel">…game UI…</div>
   </section>
   ```
3. **Nav button** — inside `<nav class="nav">`:
   ```html
   <button id="navMygame">🎯 My Game</button>
   ```
4. **Register the tab** — in `js/core.js`, extend the `TABS` array (that's
   what `switchTab` iterates) and both maps:
   ```js
   TABS.push("mygame");            // or add it to the literal
   SUBTITLES.mygame = "Some Cute Subtitle";
   NAVIDS.mygame = "navMygame";    // omit this one for a hidden tab
   ```
   …then add the click listener like the others.
5. **Teaser (optional but nice)** — add a tappable `.panel.teaser` card on
   Home that `switchTab`s to your game, like the Question of the Day teaser.
   On desktop it needs a grid area in `css/desktop.css` (see the Home grid).
6. **Test** — open `index.html` (double-click it too, not just via a
   server — that catches a missing `<script src>` tag), click every tab,
   check the browser console.

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
