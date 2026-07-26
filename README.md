# Lucia ♥ Riu 💞

Our own little couple app: a shared question every day on the home page,
Talk · Flirt · Dare (three decks, Together/Apart modes), a together-clock,
anniversary countdown, long-distance clocks, a timeline of every trip we
take (with photos from our Apple shared albums), and Word Duel.

**▶ Live app: https://lucia-riu-app.vercel.app** — open it on your phone →
Share → *Add to Home Screen*.

**No build step, no dependencies, no server.** Open `index.html` in a
browser — that's the dev environment. The code is split by feature:
`index.html` (markup) + `css/*.css` + `js/*.js`, one file per tab, wired
with plain `<link>`/`<script src>` tags.

---

## Hi Lucia 👋 — start here

You're a collaborator on this repo, which means you can build whatever you
want into our app. You don't need to know the codebase — Codex or Claude can
guide you through it.

**➡️ Never installed a developer tool before? Perfect. Follow
[`START-HERE-LUCIA.md`](START-HERE-LUCIA.md)** — it goes from absolute
zero (opening the Terminal for the first time) through installing
everything, connecting to GitHub, and your first build with Claude,
plus a plain-English explanation of how commits, PRs, and deploys work.

### Using Codex

1. Open the repo folder in the Codex desktop app.
2. Say **"Let's build"** and describe what you want.

That's it. Codex automatically reads:

- **`AGENTS.md`** — the durable Codex project rules and development workflow
- **`.agents/skills/`** — adapters for the same three living project skills
- **`CLAUDE.md`** — the canonical detailed app map (the filename is historical;
  its technical knowledge applies to Codex too)

No setup command is required for Codex. Repository skills under
`.agents/skills/` are discovered automatically.

### Using Claude

**Already set up? The short version:**

1. Accept the GitHub invite, then clone this repo.
2. In the repo folder, run **`bash setup-claude.sh`** once. It copies our
   Claude skills into `.claude/skills/` where Claude auto-discovers them.
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
  like an app on two phones with (almost) no server
- [`docs/SUPABASE.md`](docs/SUPABASE.md) — the backend: 5-minute setup,
  what syncs (journeys, reunion date, password, questions), and how to
  change the app password
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what we've shipped, what's next,
  and the plan for logins/photos/AI features

## House rules (Codex and Claude enforce these, but for humans too)

1. No build step — `index.html` still opens by double-click. One tab =
   one `js/` file + one `css/` file. Classic scripts only, never ES
   modules (they break `file://`)
2. Never use `localStorage`/`sessionStorage` (breaks our previews) —
   in-memory state or URL-hash params only
3. Don't break the daily-question determinism (both phones must agree)
4. Don't push a broken `main` — the live app updates from it automatically
5. Keep it cute 💖
6. Building in parallel (both of us, or several coding-agent sessions at once)?
   Check [`SESSIONS.md`](SESSIONS.md) — it's the who's-working-on-what
   board. Both coding agents read it before starting a feature.

---
Made with 💖 (and Claude) by Riu — co-developed by Lucia.
