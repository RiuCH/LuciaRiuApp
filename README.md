# Lucia ♥ Riu 💞

Our own little couple app: a shared question every day, a together-clock,
anniversary countdown, long-distance clocks, and (soon™) more stupid games.

**▶ Live app: https://lucia-riu-app.vercel.app** — open it on your phone →
Share → *Add to Home Screen*.

The whole app is **one file, `index.html`**. No build step, no dependencies,
no server. Open the file in a browser and that's the dev environment.

---

## Hi Lucia 👋 — start here

You're a collaborator on this repo, which means you can build whatever you
want into our app. You don't need to know the codebase — Claude does.

**Vibe-coding setup (once):**

1. Accept the GitHub invite, then clone this repo
   (or download GitHub Desktop and clone from there — easiest).
2. In the repo folder, run **`./setup-claude.sh`** once (Terminal:
   `bash setup-claude.sh`). It copies our Claude skills into `.claude/skills/`
   where Claude auto-discovers them.
3. Open **Claude** (desktop app → Cowork, or Claude Code in a terminal) and
   point it at this folder — connect the folder in Cowork, or `cd` into it
   and run `claude` in Claude Code.
4. Say: **"Read CLAUDE.md, then let's build."**

That's the entire setup. Claude will pick up:

- **`CLAUDE.md`** — project context (Claude Code reads it automatically;
  in Cowork just ask it to read the file)
- **`couple-app-dev`** skill — the house rules (single file, no
  localStorage, how "same question on both phones" works, how to test)
- **`add-daily-questions`** skill — for adding questions to the game
- **`add-new-game`** skill — for building Stupid Game #2 (this one's
  reserved for you 😌)

(Skipped step 2? No problem — the skills also live in `claude-skills/` as
plain files, and CLAUDE.md tells Claude to read them from there.)

**Then just describe your idea.** Examples that will work as-is:

> "Add 10 more funny questions but make them about food"
>
> "I want a game where we both get the same daily dare"
>
> "Make an 'our songs' tab where each day recommends one song to listen to together"

When Claude finishes: test by opening `index.html` in your browser, then
commit + push to `main`. Vercel redeploys the live URL automatically in
about a minute, and we both just refresh. (Claude knows all this too —
it's in the skills.)

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how one HTML file acts
  like an app on two phones with no server
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what we've shipped, what's next,
  and the plan for logins/photos/AI features

## House rules (Claude enforces these, but for humans too)

1. Everything stays in `index.html` — one file, opens by double-click
2. Never use `localStorage`/`sessionStorage` (breaks our previews) —
   in-memory state or URL-hash params only
3. Don't break the daily-question determinism (both phones must agree)
4. Don't push a broken `main` — the live app updates from it automatically
5. Keep it cute 💖

---
Made with 💖 (and Claude) by Riu — co-developed by Lucia.
