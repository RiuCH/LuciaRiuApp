# Lucia ♥ Riu App — Claude Context

Hi Claude! You're working on a private couple app built by Riu and Lucia
(long-distance: Riu in San Francisco, Lucia in Phoenix, together since
June 2, 2026). Fun is a feature — keep the tone playful.

**Live app:** https://lucia-riu-app.vercel.app (auto-deploys from `main`)
**Repo:** https://github.com/RiuCH/LuciaRiuApp

## Golden rules (never break these)

1. **One file.** The entire app is `index.html` — inline CSS + JS, no build
   step, no dependencies, no frameworks. It must work by double-clicking it.
2. **No localStorage / sessionStorage / cookies.** They break in the preview
   environments we use. State lives in memory or in URL-hash params
   (see `#reunion=YYYY-MM-DD`).
3. **The daily question must stay deterministic and shared.** It's picked by
   a seeded PRNG (`mulberry32`) keyed to days since July 24, 2026. Same date
   ⇒ same question on both phones with zero server. Any change to the
   question pool changes which question a given day shows — that's fine,
   but never replace the mechanism with `Math.random()`.
4. **Both partners must run the same version.** Deploy = merge to `main`
   (Vercel redeploys automatically). Don't leave the app half-broken on main.
5. Works offline, works on phones (test at ~420px wide), stays cute.

## Map of index.html

- CSS: `:root` variables = theme; `body.afterdark` = red After Dark theme
- `BANK` — question object, 5 categories: funny, romantic, spicy, nasty, ldr
- `MISSYOU` — miss-you text generator strings
- `CHIPS` — category labels/colors
- Constants: `EPOCH` (day counter start), `ANNIVERSARY` (June 2, 2026),
  `TZ_RIU`/`TZ_LUCIA` (clock timezones)
- Tabs: sections `#page-home`, `#page-game`, `#page-soon` + `switchTab()`
- Game logic: `dailyQuestion()` (deterministic), `randomQuestion()` (shuffle)
- Home widgets: `tickAnniversary()`, `tickClocks()`, `tickCountdown()`

## Skills

Project skills ship in `claude-skills/` (run `./setup-claude.sh` once to copy
them into `.claude/skills/` for auto-discovery — or just read them directly
from `claude-skills/`, same content):

- **couple-app-dev** — read this before any change; conventions, testing, deploy
- **add-daily-questions** — adding questions / miss-you texts safely
- **add-new-game** — scaffolding a new game tab (Stupid Game #2 goes here)

If you're Claude and you can see this file: read all three skills now,
before writing code.

## Docs

- `docs/ARCHITECTURE.md` — how everything works in detail
- `docs/ROADMAP.md` — agreed future plan (Supabase, Google login, photos,
  Claude API) and ideas backlog

## Workflow

edit `index.html` → open in browser to test → commit → push to `main`
→ Vercel deploys → both refresh their phones. That's the whole pipeline.
