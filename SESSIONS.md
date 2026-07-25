# Sessions Board 🧑‍💻💞🧑‍💻

Coordination board so multiple Claude sessions (Riu's, Lucia's, or several
at once) can build different features in parallel without stepping on each
other. The whole app is one `index.html`, so this file is how sessions stay
out of each other's way.

## Protocol (Claude: follow this every session)

**On session start:**
1. `git pull` first — always start from the latest `main`.
2. Read this file. If another ACTIVE session already claims the feature or
   the same region of `index.html`, ask the user before proceeding.
3. Register your session in the Active Sessions table below (commit it or
   just keep it updated locally — commit if the work spans days).

**While working:**
- **The code is split by feature now (`js/*.js`, `css/*.css`), so claim
  FILES, not line ranges.** Two sessions on different tabs no longer touch
  the same file at all — that's the whole point. Shared files everyone
  competes for: `index.html` (markup + tags), `js/core.js`,
  `js/init.js`, `css/base.css`, `css/desktop.css`. Keep edits to those
  minimal and additive — append, don't restructure.
- A new file only exists once its `<link>`/`<script src>` tag is in
  `index.html`, before `js/init.js`. Classic scripts only — an `import`
  anywhere breaks double-click for everyone.
- Claim any new global identifier in the Registry section BEFORE using it:
  seed offsets, hash params, tab names, element id prefixes.

**On session end (feature done):**
1. Full testing checklist from the `couple-app-dev` skill.
2. `git pull` again, re-test after merging if anything came in.
3. Push to `main` (deploy!), move your row to Recently Shipped,
   release region claims, keep identifier claims (they're permanent).
4. Update skills if the feature added tools/conventions
   (see "Keep the skills in sync" in `couple-app-dev`).

**Merge rules for the one-file app:**
- Pull-before-push, every time. Two sessions editing different regions of
  `index.html` merge cleanly; same region = conflict = talk to the user.
- Never leave `main` broken between sessions — every push is a deploy.
- Long-running feature? Use a branch (`feature/<name>`), but merge to
  `main` quickly — both partners must run the same version.

---

## Active Sessions

| Session | Who | Feature | Regions of index.html claimed | Status |
|---|---|---|---|---|
| _(none)_ | | | | |

<!-- Row template:
| 2026-07-24-login | Riu | Login page | lock CSS block, lock HTML block, LOCK SCREEN script block | ✅ shipped |
-->

## Recently Shipped

| Date | Who | Feature | Notes |
|---|---|---|---|
| 2026-07-25 | Riu | 🎯 20 Questions + the Games hub | The 🔤 Duel tab became 🎮 Games: `gamesShow()` in `js/twenty.js` swaps `#gameDuel`/`#game20q`, `gamesPick` in `js/core.js` guards each game's poll. 20 Questions shares `settings.q20_state` (JSON, no migration) and the duel's `#me`; YES/NO/SOMETIMES only, a wrong final guess costs a question. Desktop duel grid moved from `#page-duel.active` to `#gameDuel` — an inline `display:block` from the chooser would otherwise kill it. Stale-poll races dropped via a local write counter |
| 2026-07-25 | Riu | Duel sync actually works (no migration needed) | Moved off the unrun `duel` table onto `settings.duel_state` + `duel_first`, so sharing needs zero setup; poll 2.5s → 2s plus a pull on `visibilitychange`/`focus` (phones freeze timers in background tabs); sync status line now tells the truth instead of always claiming "shared" |
| 2026-07-25 | Riu | Word Duel v7: shared hearts, typing race, 100 situation-based penalties | New `duel` table (one row, polled every 2.5s on-tab); `me` hash param picks your side; race settled by a `first_by=is.null` PATCH so Postgres decides, not two clocks; "I lost" no longer rerolls letters; penalties reorganised into two situation pools — 🏠 in person (35) and 💌 long distance (65, the complete one), each mixing funny/spicy/nasty with the flavour shown as a tag. Superseded next day: that `duel` table was never created, so nothing synced — sync was rebuilt on `settings.duel_state`/`duel_first`, no migration needed. |
| 2026-07-25 | Riu | Question of the Day moved to Home; Daily Q tab replaced by Talk · Flirt · Dare | New `js/tfd.js` + `css/tfd.css`; tab key `game` → `tfd`; one 💞 Together / ✈️ Apart switch picks the decks and drives the hot theme (`hotMode` + `.hot`, replacing the After Dark toggle). Bank 215 → 345 prompts: `filthy` + four Dare decks (apart/together × normal/explicit). Home's card draws from `QOTD_CATS` only |
| 2026-07-25 | Riu | Deep Talk mode + 80 new questions + no-repeat seeding | New `deep` category (30 Qs, Deep Talk mode only, offset 32452843) and +10 per existing category — bank 135 → 215, appended to the DB non-destructively via `supabase/append_questions.py`. `dailyQuestion()` now deals a seeded deck (`shuffledOrder`/`deckForCycle`) instead of one blind draw, so no question repeats until the pool is exhausted and consecutive days can never match |
| 2026-07-24 | Riu | Album metadata cache (picker 50s → ~1s) | iCloud `webstream` measured at 50.4s for a 365-photo album vs 0.95s for `webasseturls`; it was called on every request. Now 3-tier cached: memory → `album_cache` table → iCloud (PR #11 + #12) |
| 2026-07-24 | Riu | Journey photos fetched only when Trips is opened | `TAB_HOOKS` registry in `js/core.js` for on-screen-only work; `jrPrewarmAlbums` warms album JSON at idle; iCloud CDN preconnect. Boot photo cost 384KB → 0 (and ~5.8MB → 0 at 30 trips) (PR #10) |
| 2026-07-24 | Riu | **Modular split — one tab, one js + one css** | `index.html` 2483 → 263 lines; `css/*` + `js/*`. Classic scripts, NEVER ES modules (they break `file://`). Script order load-bearing: core → supabase → questions → home → journeys → duel → lock → init. Golden rule #1 is now "no build step" (PR #8) |
| 2026-07-24 | Riu | Desktop/laptop layout | One trailing `@media (min-width:900px)` block (now `css/desktop.css`); hooks `#homeClocks`, `#homeCd`, `.wd-scorepanel` (PR #6) |
| 2026-07-25 | Riu | Fix white overscroll strip on iOS | `html` now owns a themed `background-color` (canvas colour); `.afterdark` class toggles on `<html>` + `<body>`; `theme-color` meta follows the theme |
| 2026-07-24 | Riu | Journeys v6.1: paged picker (24/page), videos in albums | `api/album` gained `page`/`per`/`guids` params; `jrPickerNav`, `jr-vwrap`/`jr-vbadge`; lightbox plays video; `fetchICloudAlbum()` kept as one-shot wrapper (couple-photo hero uses it) |
| 2026-07-24 | Riu | Couple photo on home (💞 hero) | `cp*` prefix; `settings.home_photo` (URL / upload data-URL / `album:<link>` photo-of-the-day, offset 15485863); `#photo=` fallback (PR #4) |
| 2026-07-24 | Riu | Journeys v6: edit, photo picker, sort chips, album CORS fix | `jr-edit`/`jrPicker*`; `journeys.photo_guids` column (migrate_journey_photos.sql); first serverless function `api/album.js` |
| 2026-07-24 | Riu | Journeys timeline (✈️ Trips tab) + Supabase backend | New tab, `jr*` prefix; Supabase REST (`journeys`/`settings`/`questions` tables), password + reunion date + question bank DB-backed with fallbacks; Apple Shared Album embeds. Setup: docs/SUPABASE.md |
| 2026-07-24 | Riu | Word Duel (🔤 Duel tab) | Took over the Soon™ slot; `wd*` prefix; one-phone session game (PR #2) |
| 2026-07-24 | Riu | Login page (lock screen) | Password = anniversary; added hash helpers |

---

## Registry of claimed identifiers (permanent — never reuse)

**Seed offsets** (for `mulberry32(dayNumber() * 7919 + OFFSET)`):
| Offset | Feature |
|---|---|
| 0 | Question of the Day (normal) |
| 104729 | Question of the Day (After Dark) |
| 15485863 | Couple photo — Apple-album photo-of-the-day |
| 32452843 | Question of the Day (Deep Talk) |
| _next free: 49979687, then any unlisted prime_ | |

**URL hash params** (via `getHashParam`/`setHashParam` only):
| Param | Feature |
|---|---|
| `reunion` | Reunion countdown date |
| `unlocked` | Login gate |
| `photo` | Couple photo (link/album fallback when DB is off) |
| `me` | Which of us is on this phone (`lucia`/`riu`) — Word Duel |

**Tabs** (`page-*` section ids + `NAVIDS`/`SUBTITLES` keys):
| Tab key | Feature |
|---|---|
| `home` | Home |
| `tfd` | Talk · Flirt · Dare |
| `journeys` | Journeys timeline |
| `duel` | Word Duel (took over the retired `soon` placeholder slot) |

**Element id / CSS class prefixes:** `lock*` (login), `cd*` (countdown),
`nav*` (nav buttons), `q20*` (20 Questions), `tick*` (home widget functions), `tfd*` (Talk · Flirt ·
Dare), `qotd*` (home Question of the Day), `jr*` (journeys
timeline), `wd*` (Word Duel), `cp*` (couple photo). New features should
pick their own short prefix and list it here.

**Layout hooks** (ids/classes that exist purely so the desktop grid can
place a panel): `#homeClocks`, `#homeCd`, `.wd-scorepanel`. If you add a
panel to Home or Duel, give it an id and place it in the `@media
(min-width: 900px)` grid at the end of the CSS — otherwise it lands in the
implicit rows and breaks the composition.

**Global constants / backends:** `SUPABASE_URL` + `SUPABASE_ANON_KEY`
(journeys feature owns the Supabase config constants; future Supabase
features reuse them — see docs/SUPABASE.md). Supabase table names are
global identifiers too: `journeys`, `settings`, `questions`, `album_cache`
are claimed.
Settings keys claimed: `lock_keys`, `reunion_date`, `home_photo` (couple
photo: image URL, upload data-URL, or `album:<link>` for photo-of-the-day),
`duel_state` + `duel_first` (Word Duel shared game).

**Serverless endpoints (`api/`):** `album` (iCloud shared-album proxy,
journeys feature). Claim new endpoint paths here before using them.

**Note:** Word Duel letters are still live `Math.random()` — but as of v7
the *result* is shared through the `duel` table rather than recomputed, so
no seed offset is needed: one phone rolls, both read the same row.
