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
- Stay inside the regions you claimed. Need to touch a shared spot
  (`switchTab`, nav, `:root` CSS, INIT block)? Keep the edit minimal and
  additive — append, don't restructure.
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
| 2026-07-24 | Riu | Login page (lock screen) | Password = anniversary; added hash helpers |

---

## Registry of claimed identifiers (permanent — never reuse)

**Seed offsets** (for `mulberry32(dayNumber() * 7919 + OFFSET)`):
| Offset | Feature |
|---|---|
| 0 | Question of the Day (normal) |
| 104729 | Question of the Day (After Dark) |
| _next free: 15485863, then any unlisted prime_ | |

**URL hash params** (via `getHashParam`/`setHashParam` only):
| Param | Feature |
|---|---|
| `reunion` | Reunion countdown date |
| `unlocked` | Login gate |

**Tabs** (`page-*` section ids + `NAVIDS`/`SUBTITLES` keys):
| Tab key | Feature |
|---|---|
| `home` | Home |
| `game` | Question of the Day |
| `soon` | Placeholder / next game slot |

**Element id / CSS class prefixes:** `lock*` (login), `cd*` (countdown),
`nav*` (nav buttons), `tick*` (home widget functions). New features should
pick their own short prefix and list it here.
