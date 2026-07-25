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
| 2026-07-24-modular | Riu | Split into per-feature files (branch `feature/modular-files`) | ALL of index.html — exclusive, nobody else should edit until merged | 🔃 PR open |

<!-- Row template:
| 2026-07-24-login | Riu | Login page | lock CSS block, lock HTML block, LOCK SCREEN script block | ✅ shipped |
-->

## Recently Shipped

| Date | Who | Feature | Notes |
|---|---|---|---|
| 2026-07-24 | Riu | Desktop/laptop layout | One trailing `@media (min-width:900px)` block (now `css/desktop.css`); hooks `#homeClocks`, `#homeCd`, `.wd-scorepanel` (PR #6) |
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
| _next free: 32452843, then any unlisted prime_ | |

**URL hash params** (via `getHashParam`/`setHashParam` only):
| Param | Feature |
|---|---|
| `reunion` | Reunion countdown date |
| `unlocked` | Login gate |
| `photo` | Couple photo (link/album fallback when DB is off) |

**Tabs** (`page-*` section ids + `NAVIDS`/`SUBTITLES` keys):
| Tab key | Feature |
|---|---|
| `home` | Home |
| `game` | Question of the Day |
| `journeys` | Journeys timeline |
| `duel` | Word Duel (took over the retired `soon` placeholder slot) |

**Element id / CSS class prefixes:** `lock*` (login), `cd*` (countdown),
`nav*` (nav buttons), `tick*` (home widget functions), `jr*` (journeys
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
global identifiers too: `journeys`, `settings`, `questions` are claimed.
Settings keys claimed: `lock_keys`, `reunion_date`, `home_photo` (couple
photo: image URL, upload data-URL, or `album:<link>` for photo-of-the-day).

**Serverless endpoints (`api/`):** `album` (iCloud shared-album proxy,
journeys feature). Claim new endpoint paths here before using them.

**Note:** Word Duel uses live `Math.random()` (session state, one phone
runs the game) — no seed offset claimed. Now that the DB exists (v5),
revisit if the duel becomes two-phone synced.
