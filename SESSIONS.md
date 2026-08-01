# Sessions Board 🧑‍💻💞🧑‍💻

Coordination board so multiple Claude sessions (Riu's, Lucia's, or several
at once) can build different features in parallel without stepping on each
other. The whole app is one `index.html`, so this file is how sessions stay
out of each other's way.

## Protocol (Claude: follow this every session)

**On session start:**
1. **Work in your own git worktree — do NOT share the checkout.** Parallel
   sessions otherwise run in the *same* folder and clobber each other: on
   2026-07-26 one session checked out another's branch, committed over it,
   then `reset` + `commit --amend` twice, silently deleting the other's work
   from `js/init.js`, `js/supabase.js` and `css/base.css`. Files were also
   being rewritten mid-edit, so re-applying by hand was a losing race.
   ```
   git worktree add ../lr-<task-id> -b feature/<name> main
   ```
   Work, test, commit and push entirely inside it, then
   `git worktree remove`. Signs you skipped this: `git status` showing files
   you never touched, staged changes you didn't stage, or your own edits
   vanishing. If it happens: `git diff > /tmp/save.patch` FIRST, then move to
   a worktree and `git apply --3way`.
2. `git pull` first — always start from the latest `main`.
3. Read this file. **Claim a task from the Task board below** by putting your
   name in its row. If another ACTIVE session already claims the feature or
   the same region of `index.html`, ask the user before proceeding.
4. Register your session in the Active Sessions table below (commit it or
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
- **Before pushing a follow-up commit to a branch you already opened a PR
  from, check the PR is still open** (`gh pr view <n> --json state -q .state`).
  Riu merges when he likes, mid-session, without saying so — pushing to a
  merged branch silently strands the work. Full procedure and the 2026-07-27
  incident: `couple-app-dev` → Deploy.
- Pull-before-push, every time. Two sessions editing different regions of
  `index.html` merge cleanly; same region = conflict = talk to the user.
- Never leave `main` broken between sessions — every push is a deploy.
- Long-running feature? Use a branch (`feature/<name>`), but merge to
  `main` quickly — both partners must run the same version.

---

## Active Sessions

| Session | Who | Feature | Regions of index.html claimed | Status |
|---|---|---|---|---|
| 2026-07-27-memories-moodboard | Codex | Rename 💝 Treats → 💝 Memories + shared flippable moodboards | Treats chooser/nav, new Moodboard sub-view + tags | 🟡 active |


<!-- Row template:
| 2026-07-24-login | Riu | Login page | lock CSS block, lock HTML block, LOCK SCREEN script block | ✅ shipped |
-->

## Task board (docs/ROADMAP.md, cut into claimable work)

**How this is sliced:** the app is split one-tab-one-file, so feature work
rarely collides — but **every tab merge touches the same five files**
(`index.html` nav + sections, `js/core.js` TABS/NAVIDS/SUBTITLES, `js/init.js`,
`css/base.css` nav sizing, `css/desktop.css` grids keyed on `#page-*`). So the
nav reshuffle is **one session doing three PRs in sequence**, not three
sessions racing the same lines. Everything else can genuinely run alongside it.

Claim a row by writing your session id in **Who**. Identifiers are
pre-assigned so two sessions can't pick the same prefix or table — they're
already reserved in the Registry below.

### Track A — the nav reshuffle ✅ **COMPLETE** (A1 · A2 · A3 shipped)
Tracks D and E are now unblocked. Read "Agreed tab structure" in docs/ROADMAP.md first,
including the four traps — three of them have already bitten this repo once.

| Task | What | Owns | Claims | Who |
|---|---|---|---|---|
| **A1** | 💝 Treats tab: 🍜 Food behind a chooser + 🎁 Gifts placeholder | index.html, core.js, base.css, desktop.css, food.js | tab key `treats`, `#navTreats`, global `treatsPick` | 2026-07-26-treats ✅ **done** |
| **A2** | 🎮 Games: fold 🎭 Talk in as a third chip — nav **5 → 4** | same + tfd.js | (reuses `gamesPick`) | 2026-07-26-treats ✅ **done** |
| **A3** | 📋 Plan tab: new tab, empty ⭐ Someday + 🗓️ Trip Plan chips, 💸 Money strip placeholder — nav **4 → 5** | same five | tab key `plan`, `#navPlan`, global `planPick` | 2026-07-26-treats ✅ **done** |

**Order swapped after A1 (was Treats → Plan → Games).** Measured at 375px the
five-button nav is **316px wide — 59px of headroom**, and `💝 Treats` alone is
63px. Adding 📋 Plan *before* removing 🎭 Talk would ship a six-button nav that
overflows a small phone — even for one deploy, and every push goes straight to
both phones. Fold Talk in first, then add Plan.

**Fixed in A2:** the subtitle bug (`TAB_HOOKS.duel = () => gamesShow(gamesPick)`).
**Headroom for A3:** the four-button nav measures **263px at 375px — 112px
spare**, so adding 📋 Plan is comfortable.

### Track B — zero shared files, start any time
Neither touches `index.html`'s nav or `js/core.js`. Safe to run beside anything.

| Task | Roadmap | Owns | Claims | Who |
|---|---|---|---|---|
| **B1** | #7 Private food bucket 🔒 | js/food.js, supabase/*.sql | — | ✅ shipped (PR #27) — **run `supabase/food_private.sql` to finish it** |
| **B2** | #2 Claude features 🤖 | api/claude.js (new) + one caller | endpoint `claude`, prefix `ai*` | 2026-07-26-trip-ai ✅ **done** — caller is ✨ Draft a plan (Track F). **Set the four Vercel env vars** (see api/claude.js header) or the button stays hidden |

### Track C — Home only
Touches `index.html` inside the Home section and `js/home.js`. Conflicts with
Track A only trivially (A never edits the Home section).

| Task | Roadmap | Owns | Claims | Who |
|---|---|---|---|---|
| **C1** | #1 Answer & compare ✍️ — *the highest-value item on the roadmap* | js/home.js, Home markup | table `answers`, prefix `ac*` | ✅ shipped |

### Track D — needs A1 merged
| Task | Roadmap | Owns | Claims | Who |
|---|---|---|---|---|
| **D1** | #4 Gifts 🎁 (the *given* half only — wishing belongs to E1) | js/gifts.js, css/gifts.css | table `gifts`, prefix `gf*` | ✅ shipped |

### Track E — needs **A3** merged (the 📋 Plan tab); E2 needs E1
<!-- Was "needs A2" when A2 WAS the Plan tab. A2 and A3 swapped meaning
     (A2 became the Games fold), so the gate moved with the tab, not the
     label. E1 and E2 both live inside 📋 Plan and cannot start until A3
     lands, even though A2 is ticked. -->
| Task | Roadmap | Owns | Claims | Who |
|---|---|---|---|---|
| **E1** | #5 Someday ⭐ **and** #6 Trip Plan 🗓️ — one session: they share the graduation flow, the Plan markup and `est_cost` | js/someday.js, js/journeys.js | table `wishes`, prefixes `sd*` + `tp*`, columns `journeys.status`, `journeys.est_cost`, `wishes.est_cost`, seed offset **49979687** (only if 🎲 pick-one is seeded) | 2026-07-26-someday ✅ **done** |
| **E2** | #3 Money 💸 — pot + simulation. **Not Splitwise**; read the entry before starting | js/money.js, Plan strip | table `expenses`, prefix `mn*` | 2026-07-26-money ✅ **done** |

### Track F — the 🗓️ Trip Plan upgrade (Wanderlog-style), inside 📋 Plan
Agreed 2026-07-26 after Riu reviewed a written plan. **Deliberately keyless:**
OpenStreetMap + Wikipedia, not Google Places — so there is **no ratings field
at all** (OSM has none) and nothing for Riu to pay for or configure.
"Mentions" was dropped outright: it's a licensed corpus, not an API.

| Task | What | Owns | Claims | Who |
|---|---|---|---|---|
| **F1** | Day-by-day skeleton: days from the trip's dates, a saved-not-scheduled bucket, add a place by hand, tap-to-assign, reorder, delete. **No external APIs** | js/trip.js, css/trip.css | table `trip_places`, prefix `tr*` | ✅ shipped |
| **F2** | Search + autofill via OSM/Wikipedia (`api/places.js` + `place_cache`) | api/places.js, js/trip.js | endpoint `places`, table `place_cache` | _(free, needs F1)_ |
| **F3** | Leaflet map + OSRM drive/walk times, cached per leg | js/trip.js, api/route.js | endpoint `route`, table `trip_legs` | _(free, needs F1)_ |
| **F4** | 🏨 Hotels + ✈️ Flights: docs and photos, reusing Food's upload path (PDFs stored as-is — a canvas can't resize one) | js/trip.js | table `trip_docs` | _(free, needs F1)_ |
| **F5** | Drag-and-drop, replacing tap-to-assign — only if F1–F4 feel good | js/trip.js | — | _(free, needs F1)_ |
| **F6** | ✨ Draft a plan — B2's first caller, drafts `trip_places` rows from the trip + ⭐ Someday + the pot | js/trip.js, css/trip.css | (reuses `tr*`, `ai*`) | 2026-07-26-trip-ai ✅ **done** |

### Track G — 💝 Memories moodboards

| Task | What | Owns | Claims | Who |
|---|---|---|---|---|
| **G1** | Rename Treats to Memories; add Lucia/Riu expandable photo moodboards with per-square Flip, pink/blue ownership glow, and confirmed deletion | index.html, js/core.js, js/food.js, js/init.js, js/moodboard.js, css/moodboard.css, css/desktop.css | prefix `mb*`, settings keys `moodboard_prompts`, `moodboard_lucia`, `moodboard_riu` | 2026-07-27-memories-moodboard 🟡 active |

### Suggested first wave (four sessions, no overlap)
**A1** · **B1** · **B2** · **C1** — then D1 and E1 open up as A lands.

**Every task, regardless of track:** full testing checklist from the
`couple-app-dev` skill, degrade gracefully with Supabase unreachable (golden
rule 6), keep it working on a double-click, and update the skills in the same
PR if you introduce a convention.


## Recently Shipped

| Date | Who | Feature | Notes |
|---|---|---|---|
| 2026-07-26 | Riu | **B2 + F6** 🤖 the Claude door, and ✨ Draft a plan | First AI in the app. `api/claude.js` is **gated and task-based, not a proxy**: it verifies the caller's Supabase JWT against `LR_ALLOWED_EMAILS` before buying a single token, and the browser sends *data* against a named task whose prompt lives server-side — so a stolen JWT reads our trip plan rather than running anything on our card. **The issuer is read from env, never from the body** — `api/food-import.js` takes it from the body, which is fine there and would be a total bypass here. `js/ai.js` is the only client door and `aiReady()` is how callers hide (`file://`, signed out, or undeployed ⇒ no button; golden rule 6 covers Claude too). The caller: ✨ Draft a plan in 🗓️ Trip Plan sends the trip's days, what's already in `trip_places`, our ⭐ Someday wishes and the pot, and gets back rows shaped like `trip_places` — each with a *why*, which names whose wish it came from. **It previews, it never writes**: suggestions land in a ticklist and only then POST, because the itinerary is shared and a draft that filed itself would put a dozen decisions in front of the other person. Structured outputs (`output_config.format`) mean no parsing defence; a hallucinated date falls back to the 🗂️ saved bucket rather than saving onto a day nothing renders. `trip_places` has no cost column on purpose — the draft's total is offered to `journeys.est_cost`, which is the one number 💸 Money already counts. **No migration.** Needs four Vercel env vars, and `LR_ALLOWED_EMAILS` must agree with `public.is_us()` and `allowed_emails` |
| 2026-07-26 | Riu | 🎨 Themes + a picker in Settings | Six palettes (`css/themes.css`) chosen from a swatch grid in the ⚙️ panel. **No migration** — `settings` is key/value, so the new `theme` key just works, and it's **shared**: changing it changes both phones. A theme is one class on `<html>`+`<body>` redefining only the five colour vars; nothing else in the app knows a colour. Two precedence details: `base.css` now uses `html.hot, body.hot` so 💞 Together still outranks every theme (equal-specificity classes loading later would otherwise win), and `js/tfd.js` stopped writing a hardcoded `theme-color` hex — `thSyncBar()` reads the live `--bg1` so the status bar is right for any palette *and* for hot. All six are dark on purpose: a light one needs the leftover hardcoded `rgba()`s turned into vars first |
| 2026-07-26 | Riu | **✈️ Trip photos** (our own, not the album) | `journeys.photos` (`[{url, path}]`, `supabase/journey_photos.sql`) next to the existing `album_url`. **Two kinds of photo on purpose:** an Apple album is someone else's library that we borrow and whose URLs expire; these are ours. A trip can have both. Reuses 🍜 Food's upload path whole — `fdResize`/`fdUploadBlob`/`fdResolveViews`, same `food` bucket under a `trips/` prefix — so there's no second bucket to create or make private, and every `fd*` call is feature-detected. `jrUploadOK` hides the button instead of failing when the migration hasn't been run |
| 2026-07-26 | Riu | **F1** 🗓️ day-by-day itinerary | Opens from a planned trip's `🗓️ Itinerary` button. **Days are derived from the trip's own dates — there is no `trip_days` table** to drift out of sync, and `day_date = null` is the saved-but-unscheduled bucket every itinerary needs. Tap a place → a sheet of days to move it to (drag is F5: tapping works on a phone first time, every time). Reordering PATCHes only the two rows that swap. New `js/trip.js` + `css/trip.css`, prefix `tr*`, table `trip_places` (`supabase/trip_places.sql`). The trip card in `js/someday.js` gained ONE guarded button. **No ratings column and no 'Mentions'** — see Track F |
| 2026-07-26 | Riu | ⭐ Someday: 🎢 Activity, a fourth kind | Things we want to *do* — "learn to surf", "pottery class". **Needed `supabase/someday_activity.sql` run once**: `someday.sql` pinned the kinds in a CHECK constraint, so without widening it Postgres rejects the row and the optimistic UI shows a wish that never saves. Unlike the other three it graduates nowhere — a place becomes a Trip Plan, a restaurant a Food photo, a thing a Gift, but an activity was the doing, so it just gets ticked. Fixed a stale toast while there: 🎁 things said "when that lands" and Gifts landed in D1, so it now hands over properly. Filter chips retrimmed — five wanted 329px of a 297px row and left 🎁 Things stranded on its own line |
| 2026-07-26 | Riu | **Fix: the Home clock was frozen on live** | `6e0301a` generalised folding into `.foldbtn[data-fold]` and deleted `fdRenderFold` from `js/food.js` — but left `fdRenderFold();` in `js/init.js`. That line threw `ReferenceError`, and since init.js is one statement list, **everything after it never ran**: `homeTickFast/Slow` (so the together-counter sat at its static `0d 0h 0m 0s` and both clocks at `--:--`), the timezone line, and `loadQuestions()` (so the DB question bank silently never loaded). Removed the stale call, and added `boot(label, fn)` — every boot step is now caught and warned, with the Home widgets painted FIRST so one tab's dead function can't stop another tab's clock. Skill updated: **grep `js/init.js` when you delete a function** |
| 2026-07-26 | Riu | 💸 Money becomes a chip (and stays a line) | Riu asked for Money beside ⭐ Someday and 🗓️ Trip Plan, which the roadmap explicitly argued against ("a strip, not a chip") — flagged, and the call was to do **both**. The *reading* stays as a one-line `pot · committed/left` pinned above the chooser, so the constraint still follows you while browsing; the *ledger* (log form + history) moved into a third 💸 Money chip, because a form you touch occasionally was eating the top of every view. `PLAN_VIEWS`/`PLAN_SUBTITLES` gained `money`; `mnRender` now guards the old `mnPanel`/`mnToggle` so a cached page mid-deploy still works. **docs/ROADMAP.md #3 and the tab-structure section were corrected** — they said the opposite and would have misled the next session |
| 2026-07-26 | Riu | Gifts: uncropped photos, edit, up to 3 photos | **Bug:** card photos used `width:100%` + fixed `max-height` + `object-fit:cover`, which is fine on a phone but the Treats page is 940px on a laptop — photos were forced to ~900×320 and cover ate the rest, showing **24% of a portrait shot**. Now sized intrinsically (auto width, capped height), so nothing crops at any width. Added ✎ edit-in-place (deletes any photo the edit drops) and **up to 3 photos** per gift via `gifts.photos` jsonb — `url`/`path` still mirror the first, so pre-migration rows and older clients keep rendering, and `gfMultiOK` probes the column so the form degrades to one photo until `supabase/gifts_photos.sql` is run |
| 2026-07-26 | Riu | **E2** 💸 Money — the pot + simulation | A pot, **not Splitwise**: every `expenses` row is a `topup` or a `spend` and the pot is the difference — no splits, no who-owes-whom, no settle-up (all deliberately dropped, roadmap #3). The simulation is `pot − committed = left`: a 🗓️ Trip Plan counts by definition (it has dates), a ⭐ Someday wish only once you tick **💸 Count it in** (`wishes.committed`) — that toggle IS the simulation, and over-committing turns the line red, which is the "can we afford Japan?" answer. Renders into the strip A3 pinned above the chooser, so it stays on screen while you browse. Home carries the headline (`#mnHome`) beside the countdown. `expenses.journey_id` and `currency` exist unused so cost-per-trip and FX don't need a later migration. ~~Needs `supabase/money.sql` run once~~ — **applied 2026-07-26** |
| 2026-07-26 | Riu | **D1** 🎁 Gifts — the given half | Second chip in 💝 Treats, filling the pane A1 left. What it was · who gave it · when · occasion · photo · note, filtered by giver or occasion in one tap. **No prices** and no wanted-state, both deliberate (roadmap #4: a price makes it an expense; wishing is E1). Photos reuse Food's upload path under a `gifts/` prefix of the SAME bucket, inheriting B1's signed URLs — `js/gifts.js` calls `fdResize`/`fdUploadBlob`/`fdResolveViews`/`fdExif` and feature-detects every one, but never edits `js/food.js` (another session owns it); the Treats hooks are EXTENDED, not replaced. `given_on` is a wall clock rendered in UTC so a gift doesn't change date between phones. Table `gifts` — run `supabase/gifts.sql` |
| 2026-07-26 | Riu | **E1** ⭐ Someday + 🗓️ Trip Plan | One list of what we want (📍 place · 🍜 restaurant · 🎁 thing) in the `wishes` table, and planned trips as `journeys` rows with `status='planned'` — **not a second table**, so a plan graduates into a memory in place, keeping its photos. Ticking a wish off doesn't just grey it: a place jumps to 🗓️ Trip Plan with the name and cost prefilled, a restaurant sends you to 🍜 Food. `⏳ Count down to this` points Home's countdown at a planned trip (it was already a trip plan reduced to one date). ✈️ Trips now renders `jrPast()` so planned rows stay out of it. 🎲 pick-one is live `Math.random()`, not seeded — offset 49979687 released. ~~Needs `supabase/someday.sql` run once~~ — **applied 2026-07-26** |
| 2026-07-26 | Riu | **Track A** — the nav reshuffle (PRs #26, #29, #30) | `🏠 Home · ✈️ Trips · 💝 Treats · 📋 Plan · 🎮 Games`. Food moved inside 💝 Treats (`treatsPick`), Talk · Flirt · Dare inside 🎮 Games (`gamesPick`), and 📋 Plan is new with a pinned 💸 Money strip above a ⭐ Someday / 🗓️ Trip Plan chooser (`planPick`, `js/plan.js` + `css/plan.css`). Three choosers now share one shape — see "Tabs that host more than one thing" in the `couple-app-dev` skill. Two fixes fell out: `switchTab()` no longer special-cases Talk's hotMode subtitle (it moved to `gamesSubtitle()`), and every chooser's `TAB_HOOKS` re-runs the chooser rather than a loader, which was leaving stale subtitles. Nav measured 318px at 375px — the order A1 → A2 → A3 was chosen so it never exceeded five buttons on a deploy |
| 2026-07-26 | Riu | **B1** — signed URLs for the food bucket | The bucket shipped `public = true`, and a public bucket is served over an unauthenticated URL where storage policies don't apply — every photo was readable by anyone holding its URL. Views are now minted from `food_photos.path` (stored since the tab shipped, so no migration), batched into one signing request, cached with expiry. Renders fall back to the stored public URL when a signature isn't ready, so the code is safe with the bucket public OR private — **`supabase/food_private.sql` still has to be run to actually close it**. Also fixed three live breakages from the RLS lockdown: uploads, deletes and album import were all still sending the anon key, which `food write` now rejects |
| 2026-07-26 | Riu | **C1** ✍️ Answer & compare | Both answer the day's question on the Home card; **neither shows until both are in**, so the second answer isn't shaped by the first. Locked once submitted — and the lock is the database's, not the UI's: `answers` has a unique index on `(day, who)`, so a second insert is refused by Postgres. New `js/answers.js` + `css/answers.css`, prefix `ac*`, table `answers` (`supabase/answers.sql`, reuses `public.is_us()`). Side comes from the games' `#me`. The poller only wakes in the one state that can change — on Home, mine in, theirs pending — and backs off when hidden, per the idle-cost rules |
| 2026-07-26 | Riu | It's an app now — Add to Home Screen, no App Store | `manifest.webmanifest` + checked-in `icons/icon-180\|192\|512.png` + the iOS meta block: own icon, own app-switcher card, no Safari chrome, and **no App Store, signing, fee or expiry**. Icons generated with macOS's own tools (`qlmanage -t` on an SVG → `sips -z`) so the no-build-step rule holds. `black-translucent` status bar puts the gradient behind the clock, so `body`/`.nav`/`.lock` now add `env(safe-area-inset-*)`, wrapped in `@supports` (a bare `calc(… + env())` is dropped whole by browsers without it). Insets are 0 in a normal tab ⇒ desktop unchanged. **Anything new pinned to a screen edge must add the insets too.** Deliberately NO service worker: a cached shell is exactly how two phones end up on different versions (golden rule 4). Known: `start_url` is `./` so an installed launch has no hash and re-runs the lock |
| 2026-07-26 | Riu | Food: foldable organise panel, City/Country split | The Find & organise island collapses to a 49px title bar (576px → 49px, `fdOrganiseOpen`, in-memory so a refresh reopens it — it holds the search box). The single `place` tag kind became `city` + `country` with their own group-by views; `fdKindMatches` keeps legacy `place` tags visible under City so nothing vanishes pre-migration, and `supabase/food_split_place.sql` (already applied here over REST) moves them |
| 2026-07-25 | Riu | Idle cost: the app stops working while nobody's looking | Home's 1s tick was building **4 `Intl.DateTimeFormat`s a second** (~86k/day) and parsing two `innerHTML` strings. Split into `homeTickFast()` (seconds) and `homeTickSlow()` (60s: the anniversary date + the SF/Phoenix gap, which moves twice a year) — measured **110× faster** per tick. Ticks now skip unless `activeTab === "home"`, with `TAB_HOOKS.home` repainting on return. The three pollers back off to ~30s while `document.hidden` (`wdTicks`/`q20Ticks`/`cyTicks`) — **back off, never stop**: some webviews report `hidden === true` while visible, and a duel that silently stopped syncing looks broken. Same reason the clock is deliberately NOT hidden-gated. Boot went **4 `settings` GETs → 1**: `loadSettings()` returns its rows and `js/init.js` hands them to `wdAdopt`/`q20AdoptRows`/`cyAdopt`. Deleted dead `.soonbox`/`.progress`/`.question` CSS (incl. a `@keyframes wiggle` animating `width`) |
| 2026-07-25 | Riu | 🍜 Food tab — photo library with tags | Fifth nav button (labels trimmed to fit 375px). First use of **Supabase Storage** (bucket `food`) — needs `supabase/food.sql` run once. Uploads resized to 1600px client-side; EXIF date + GPS parsed by hand (no deps); `api/geocode.js` turns GPS into city/country tags via OpenStreetMap; `api/food-import.js` COPIES shared-album photos into our bucket because iCloud URLs expire. Tags have kinds (restaurant/dish/place/other) driving the group-by views. `taken_at` is a wall clock rendered in UTC so a late dinner shows the same date on both phones |
| 2026-07-25 | Riu | Game polish: restarts, locked sides, flatter status bar | Every game can now be restarted at any time, not just from an end state — Word Duel's `🔄 Restart` arms then commits (it wipes the shared score on both phones), Talk · Flirt · Dare's `🔄 Start over` is local and instant. "I'm playing as" freezes once a duel is under way (`wdSideLocked()`) so nobody swaps sides mid-match; restart unlocks it. `.daybar .pill` is flat text instead of a bordered pill — it was reading as a row of tappable tabs. Nav label `🎭 Play` → `🎭 Talk` (innocuous cover for the adult decks; tab key still `tfd`). Dropped the `logged` tile from Moon's Her Rhythm. Extended to 20 Questions after it landed: it gets the same always-on `🔄 Restart`, and the side lock is shared across the whole Games tab (`#me` is one identity — `renderWhoAmIRows()` paints both games' rows so restarting one unlocks the other's). |
| 2026-07-25 | Riu | 🎯 20 Questions + the Games hub | The 🔤 Duel tab became 🎮 Games: `gamesShow()` in `js/twenty.js` swaps `#gameDuel`/`#game20q`, `gamesPick` in `js/core.js` guards each game's poll. 20 Questions shares `settings.q20_state` (JSON, no migration) and the duel's `#me`; YES/NO/SOMETIMES only, a wrong final guess costs a question. Desktop duel grid moved from `#page-duel.active` to `#gameDuel` — an inline `display:block` from the chooser would otherwise kill it. Stale-poll races dropped via a local write counter |
| 2026-07-25 | Riu | 🌙 Moon tab — cycle calendar + our tally (hidden) | First **nav-less tab**: `switchTab` now walks a `TABS` array and skips the nav highlight when `NAVIDS[tab]` is absent, so a page can exist with no button. Reached by long-pressing the `♥` in the header (`#secretHeart`, 1.2s, js/core.js "quiet door") or `#moon=1`; `✕` returns Home, and a refresh always lands on Home. Month grid marks logged periods, predicted periods, the fertile window and 💞 days; stats give cycle day / average cycle / next period, and total · month · year · 🏆 best day · 🔥 longest streak. Two `settings` rows (`cycle_periods`, `love_log`) — **no migration to run**. Deliberately NOT mirrored to the URL hash. Hidden ≠ private: the repo IS private, but that's not the control — the deployed page ships the anon key with wide-open RLS, so the app URL is all anyone needs. This only stops a shoulder-glance |
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
| _49979687 — RELEASED_ | Was reserved for ⭐ Someday's 🎲 pick-one. Not used: the pick is live `Math.random()`, because choosing a restaurant is a moment you immediately want to re-roll — same call Talk · Flirt · Dare makes. Free for the next feature |
| _next free: 67867967, then any unlisted prime_ | |

**URL hash params** (via `getHashParam`/`setHashParam` only):
| Param | Feature |
|---|---|
| `reunion` | Reunion countdown date |
| `unlocked` | Login gate |
| `photo` | Couple photo (link/album fallback when DB is off) |
| `me` | Which of us is on this phone (`lucia`/`riu`) — Word Duel |
| `moon` | Backup door into the hidden 🌙 Moon tab (`#moon=1`) |
| `tab` | Which tab to reopen on refresh. Written by `switchTab()` with replaceState, so it never piles up history. **Never `cycle`** — 🌙 Moon is deliberately not sticky |
| `sub` | The sub-view inside a tab with a chooser (Games / Memories / Plan). Restored via the `TAB_SUBS` registry in `js/core.js`, each entry validating its own values |

**Tabs** (`page-*` section ids + `NAVIDS`/`SUBTITLES` keys — plus the `TABS`
array in `js/core.js`, which is what `switchTab` actually iterates):
| Tab key | Feature |
|---|---|
| `home` | Home |
| `tfd` | Talk · Flirt · Dare |
| `food` | 🍜 Food photos |
| `journeys` | Journeys timeline |
| `duel` | Word Duel (took over the retired `soon` placeholder slot) |
| `cycle` | 🌙 Moon — cycle calendar + our tally. **Hidden: no nav button**, so it has a `TABS`/`SUBTITLES` entry but deliberately NO `NAVIDS` one |

**Element id / CSS class prefixes:** `lock*` (login), `cd*` (countdown),
`nav*` (nav buttons), `fd*` (🍜 Food), `mb*` (Lucia/Riu moodboards), `q20*` (20 Questions), `tick*` (home widget functions), `tfd*` (Talk · Flirt ·
Dare), `qotd*` (home Question of the Day), `jr*` (journeys
timeline), `wd*` (Word Duel), `cp*` (couple photo), `cy*` (🌙 Moon calendar), `wh*` (📍 Where we are), `auth*` (Google sign-in).
**Pre-reserved for the Task board** (don't take these for anything else):
`ac*` (C1 Answer & compare), `gf*` (D1 Gifts), `sd*` (E1 Someday), `tp*` (E1
Trip Plan), `mn*` (E2 Money), `ai*` (B2 Claude features).
`plan*` is TAKEN (the 📋 Plan tab shell — `planShow`, `planRenderMoney`,
`#planPicker`/`#planSomeday`/`#planTrip`/`#planMoney`/`#planPot`/`#planSums`).
New features should pick their own short prefix and list it here.
One-off id outside any prefix: `#secretHeart` (the header `♥`, which is also
the long-press door into the Moon tab).

**Layout hooks** (ids/classes that exist purely so the desktop grid can
place a panel): `#homeClocks`, `#homeCd`, `.wd-scorepanel`, `.cy-calpanel`,
`#cyDayPanel`, `#cyMoonPanel`, `#cyUsPanel`. If you add a panel to Home,
Duel or Moon, give it an id and place it in the `@media (min-width: 900px)`
grid at the end of the CSS — otherwise it lands in the implicit rows and
breaks the composition.

**Global constants / backends:** `SUPABASE_URL` + `SUPABASE_ANON_KEY`
(journeys feature owns the Supabase config constants; future Supabase
features reuse them — see docs/SUPABASE.md). Supabase table names are
global identifiers too: `journeys`, `settings`, `questions`, `album_cache`,
`food_photos`, `food_tags`, `food_photo_tags` are claimed.
**Pre-reserved for the Task board:** _(none left)_. LIVE: `expenses` (E2, plus
`wishes.committed` — the simulation toggle),
`answers` (C1), `wishes` (E1, plus `journeys.status` + `journeys.est_cost` —
a 🗓️ Trip Plan is a `journeys` row with `status='planned'`). New columns claimed for E1: `journeys.status` and
`journeys.est_cost` (a Trip Plan is a `journeys` row whose dates are ahead of
us — same table as ✈️ Trips, so a plan graduates into a memory in place).
Non-hash browser storage claimed (the ONE carve-out to golden rule 2): `sessionStorage['lr_session']` — the Google-login session, js/auth.js.
Postgres objects claimed: function `public.is_us()` (the email allowlist every RLS policy calls).
Settings keys claimed: `lock_keys`, `reunion_date`, `home_photo` (couple
photo: image URL, upload data-URL, or `album:<link>` for photo-of-the-day),
`duel_state` + `duel_first` (Word Duel shared game), `cycle_periods` +
`love_log` (🌙 Moon calendar — `start:len` and `date:count` lists, both
plain text so they can be repaired by hand in the table editor), `theme`
(the palette, a `THEMES` key from `js/theme.js` — **shared, so changing it
changes both phones**, which is the point), `moodboard_prompts`,
`moodboard_lucia`, and `moodboard_riu` (shared square requirements and each
person's ordered photo records for 💝 Memories). `where_lucia` + `where_riu` (📍 Where we are — JSON `{lat, lon, city, country, at}`, coords rounded to ~1km; the row's EXISTENCE is the opt-in, so stopping deletes it).

**Chooser globals in `js/core.js`** (each guards its tab's on-screen work so
only the visible sub-view fetches or polls): `gamesPick` (🎮 Games) is live;
`treatsPick` (💝 Memories, js/food.js) and `planPick` (📋 Plan, js/plan.js) are live. Any new merged tab
needs one — a merged tab whose `TAB_HOOKS` entry ignores the pick will run
*every* sub-view's loader on open, which is how the lazy-photo work gets undone.

**Serverless endpoints (`api/`):** `album` (iCloud shared-album proxy,
journeys feature), `geocode`, `food-import`. **Pre-reserved:** `claude` (B2).
Claim new endpoint paths here before using them.

**Note:** Word Duel letters are still live `Math.random()` — but as of v7
the *result* is shared through the `duel` table rather than recomputed, so
no seed offset is needed: one phone rolls, both read the same row.
