# Lucia ♥ Riu App — Codex Instructions

This is Lucia and Riu's private couple app. Keep the product playful, warm,
mobile-first, and dependable on both phones.

## Start every task

1. Read `SESSIONS.md` before feature work. Before changing code, follow its
   pull-latest protocol, check the active-session and identifier registries,
   and use a dedicated worktree. Preserve unrelated work in a dirty checkout.
2. Read `CLAUDE.md`. The filename is historical; it is the canonical detailed
   project map for every coding agent, including Codex.
3. Load the matching repo skill from `.agents/skills/`:
   - `couple-app-dev` for every code, UI, bug-fix, or refactor task.
   - `add-daily-questions` when changing `BANK` or `MISSYOU`.
   - `add-new-game` when adding or restructuring a game.
4. Read only the task-relevant detail docs after that:
   `docs/ARCHITECTURE.md`, `docs/SUPABASE.md`, or `docs/ROADMAP.md`.

Codex discovers this file and `.agents/skills/` automatically. Do not run
`setup-claude.sh`; it exists only to copy the same source workflows into
Claude's discovery directory.

## Non-negotiable architecture

- No build step, dependency install, framework, or bundler. The app must work
  by double-clicking `index.html`.
- Use classic scripts only. Never add `type="module"`, `import`, or `export`;
  modules break `file://`.
- `index.html` owns markup and tags. Put feature behavior in its owning
  `js/*.js` file and styling in its owning `css/*.css` file. Add every new
  file's `<link>` or `<script>` tag explicitly.
- Script order is load-bearing: shared globals first, `js/init.js` last.
  Top-level code may reference only earlier scripts. Put boot work behind
  `boot("label", fn)` so one feature cannot stop the rest of the app.
- Do not use browser persistence for app data. Use memory, the existing hash
  helpers, or Supabase. The sole storage exception is the Google-login session
  under `lr_session`, feature-detected in `js/auth.js`; never widen it.
- Never assign `location.hash` directly. Use `getHashParam()` and
  `setHashParam()` so parameters coexist. Keep private Moon data out of hashes.
- Shared daily content must remain deterministic. Use the existing seeded-deck
  pattern and claim any new seed offset in `SESSIONS.md`; never substitute
  `Math.random()` for a two-phone daily result.
- Supabase and `api/` functions are enhancements, never boot dependencies.
  Every feature must degrade honestly and safely when configuration or network
  access is unavailable.
- Render user-entered data with `textContent` or DOM APIs, not `innerHTML`.
- Keep timers and polling idle when their tab/sub-view is not visible. Preserve
  chooser globals and use `display = ""`, not `"block"`, when showing a
  chooser sub-view.
- Maintain the single mobile-first layout and the one desktop override in
  `css/desktop.css`. Test around 420px and account for safe-area insets on
  screen-edge UI.

## Product and data rules

- Home's daily question stays sweet (`funny`, `romantic`, `ldr`). Adult
  prompts belong only inside Talk · Flirt · Dare.
- Both partners must run the same deployed version. Never knowingly leave
  `main` broken.
- Google authentication and database authorization are separate gates:
  `allowed_emails` controls sign-up, while `public.is_us()` controls data
  visibility. Keep them aligned.
- Hidden UI is not security. Describe the lock and Moon door honestly.
- Follow the current file map, table list, chooser behavior, and migration
  record in `CLAUDE.md` and `docs/SUPABASE.md`; older architecture prose may
  describe an earlier version.

## Verification

For code changes, verify in proportion to risk and complete the
`couple-app-dev` checklist:

- Open through a local server and by double-clicking `index.html`.
- Check the console with Supabase unavailable.
- Exercise the lock, all five navigation tabs, relevant chooser sub-views,
  and the hidden Moon entrance.
- Check the changed flow at phone width and desktop width.
- Reload to confirm deterministic content remains stable.
- If a function was deleted or renamed, search `js/init.js` for stale calls.
- If `BANK` changed, use the append workflow and warn that the daily deck
  reshuffles; keep hardcoded and database copies in identical order.

Do not commit or push unless the user asks. For code, use a `codex/` branch and
a reviewable PR unless the user explicitly requests another workflow.
Roadmap-only additions are the repository's documented exception: update and
ship them directly to `main` when explicitly requested.

## Keep agent guidance synchronized

The detailed source workflows remain in `claude-skills/`. The repo-local Codex
skills are thin adapters that load those files and translate only
tool/product-specific behavior. When a feature changes a shared convention:

1. Update the relevant canonical file in `claude-skills/`.
2. Update `CLAUDE.md` when the project map changes.
3. Update this `AGENTS.md` or a Codex adapter only when Codex-specific routing
   changes.
4. Run `setup-claude.sh` only when Claude's copied skill files also need
   refreshing; Codex reads `.agents/skills/` directly.
