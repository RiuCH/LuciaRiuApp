---
name: add-daily-questions
description: Add, edit, remove, or reorganize daily questions, Talk/Flirt/Dare prompts, dare decks, or MISSYOU messages in the Lucia and Riu app. Use for any BANK, QUESTION_SOURCE, category, prompt-seed, or miss-you text change.
---

# Add daily questions with Codex

## Required reading

1. Read the repository-root `AGENTS.md`, `SESSIONS.md`, and `CLAUDE.md`.
2. Read `claude-skills/add-daily-questions/SKILL.md` completely. It is the
   canonical category guide, placement map, database-sync workflow, and
   checklist. Treat the instructions as product-neutral.
3. Also load `$couple-app-dev` because question changes are application
   changes and require its testing and collaboration rules.

## Codex translation

- Do not run `setup-claude.sh` to enable skills; `.agents/skills/` is already
  the Codex discovery path.
- Use the bundled Python runtime if `python3` is unavailable.
- Begin with the append workflow for an existing project:
  `supabase/append_questions.py` dry-run, then `--apply` only when the user has
  authorized the live database mutation.
- A local source edit does not authorize a Supabase write. Preserve the
  canonical requirement to keep the database and hardcoded order identical,
  and clearly report any unapplied synchronization step.
- Warn that changing a category pool reshuffles the deterministic daily deck
  and both phones must refresh to the same version.

Follow every content, ordering, determinism, testing, and tone rule in the
canonical skill unchanged.
