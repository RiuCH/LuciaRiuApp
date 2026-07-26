---
name: add-new-game
description: Design, add, or restructure a game in the Lucia and Riu app, including games inside the Games chooser, hidden tabs, shared daily games, and Supabase-synchronized rounds. Use whenever a request adds a game, game surface, game tab, or deterministic daily game mechanic.
---

# Add a new game with Codex

## Required reading

1. Read the repository-root `AGENTS.md`, `SESSIONS.md`, and `CLAUDE.md`.
2. Read `docs/ROADMAP.md` when the game affects navigation or an agreed future
   feature.
3. Read `claude-skills/add-new-game/SKILL.md` completely. It is the canonical
   scaffold, chooser/hidden-tab guide, seed registry procedure, and game
   design checklist. Treat the instructions as product-neutral.
4. Also load `$couple-app-dev`; every new game is an application change.

## Codex translation

- Do not run `setup-claude.sh`; Codex discovers `.agents/skills/` directly.
- Follow the current app structure in `CLAUDE.md` over stale counts or labels
  in older prose. The bottom navigation is full; prefer the existing Games
  chooser unless the requested experience requires the documented hidden-tab
  pattern.
- Claim every new prefix, tab key, settings key, table, endpoint, hash
  parameter, and deterministic seed offset in `SESSIONS.md` before use.
- Use live `Math.random()` only when one device generates shared/session state.
  When two independent phones must agree, use the seeded deterministic pattern.
- Use a `codex/` branch and a dedicated worktree for code unless the user
  explicitly chooses another workflow.

Follow every scaffold, chooser, desktop, polling, fallback, security-honesty,
and testing rule in the canonical skill unchanged.
