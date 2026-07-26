---
name: couple-app-dev
description: Develop, fix, restyle, or refactor the Lucia and Riu couple app while preserving its no-build, file-protocol, deterministic-daily, offline-first, mobile-first, and deployment constraints. Use before making any application code or UI change in this repository.
---

# Develop the Lucia ♥ Riu app with Codex

Use the established project workflow rather than duplicating it here.

## Required reading

1. Read the repository-root `AGENTS.md`.
2. Read `SESSIONS.md` and follow its current coordination protocol.
3. Read `CLAUDE.md` for the complete current feature and file map. Treat its
   technical instructions as product-neutral despite the historical filename.
4. Read `claude-skills/couple-app-dev/SKILL.md` completely. It is the canonical
   detailed workflow and every architecture, implementation, testing, and
   deployment principle in it applies to Codex.

Resolve all paths from the repository root.

## Codex translation

- Do not run `setup-claude.sh` to enable this skill. Codex automatically
  discovers repo skills under `.agents/skills/`.
- Use Codex's available browser-control skill for interactive browser testing
  when appropriate. Respect the same preview limitations documented in the
  canonical skill.
- Use `apply_patch` for manual file edits and preserve unrelated user changes.
- Use a `codex/` branch by default for code. A branch does not replace the
  worktree, collision checks, pull-before-push, or testing rules in
  `SESSIONS.md`.
- Do not invoke subagents unless the user or applicable instructions explicitly
  request delegation.
- Do not commit, push, deploy, open a PR, or mutate external systems unless the
  user requested that action.

Everything else in the canonical skill applies unchanged. If these adapter
notes and the canonical workflow conflict, preserve the app's technical and
product constraints while following the current Codex tool and permission
rules.

## Completion

Before reporting completion, run the canonical testing checklist in proportion
to the change and state what was and was not verified.
