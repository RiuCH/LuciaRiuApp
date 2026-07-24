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

1. Everything stays in `index.html`. Inline CSS in the single `<style>`,
   inline JS in the single `<script>`. No external requests except (rarely)
   cdnjs.cloudflare.com if truly unavoidable.
2. NO localStorage, sessionStorage, IndexedDB, or cookies — they fail in the
   preview environments the couple uses. Persistence options, in order:
   in-memory variable → URL hash param (like `#reunion=2026-12-20`) →
   hardcoded constant (like `ANNIVERSARY`). For hash params always use the
   `getHashParam(name)` / `setHashParam(name, val)` helpers (top of the
   script) — they let multiple params coexist as `#a=1&b=2`. Never assign
   `location.hash` directly (it clobbers the other params).
   Current hash params: `reunion` (countdown date), `unlocked` (login gate).
3. Anything "shared" between the two partners without a server must be
   **derived deterministically from the date** (see pattern below), because
   the app runs as two independent copies with no communication.
4. Mobile first: test layouts at ~420px wide. The bottom nav must never
   overlap content (body has padding-bottom for it).

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

## Style conventions

- Theme via CSS variables in `:root`; After Dark overrides in `body.afterdark`.
- Panels: `.panel` (glassmorphism card). Games get full `.card` treatment.
- Buttons: `.primary` for the main action, `.toggled` for on-state.
- Feedback: `popToast("...")` for confirmations, `burst(x, y, [emojis])`
  for celebrations. Floating hearts are global — don't spawn extra loops.
- Voice: playful, flirty, a little dramatic. Emojis welcome. British-serious
  tone is a bug.

## The lock screen (login gate)

`#lock` overlay + the LOCK SCREEN script block. Password = the anniversary,
June 2 2026, accepted in any digit form (`LOCK_KEYS`) or as text
("june 2"). Success sets `#unlocked=1` in the hash so refreshes skip the
gate; wrong answers get escalating sass from `LOCK_SASS`. It's a cute gate,
not security — the answer is in the source. Keep new features BELOW it:
everything else initializes normally whether locked or not, the overlay
just covers it.

## Testing checklist before every commit

- Open `index.html` in a browser (that IS the dev environment). No console
  errors.
- Lock screen: wrong date shakes + sasses; `06/02/2026` (or "june 2")
  unlocks with hearts; reload with `#unlocked=1` skips straight in.
- All three tabs switch; bottom nav highlights correctly.
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
