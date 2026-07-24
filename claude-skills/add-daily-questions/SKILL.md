---
name: add-daily-questions
description: Use when adding, editing, or removing questions in the daily question game, or adding miss-you texts. Explains the BANK structure, the tone of each category, and the one side effect to warn about (the daily pick shifts when the pool changes).
---

# Adding questions & miss-you texts

## Where

In `index.html`:
- `BANK` — object with five arrays: `funny`, `romantic`, `spicy`, `nasty`, `ldr`
- `MISSYOU` — flat array of miss-you message strings

Add strings to the right array. Since v5 the live pool usually comes from
the Supabase `questions` table (`QUESTION_SOURCE`), with `BANK` as the
offline fallback — so after editing `BANK`, also sync the DB:
run `python3 supabase/generate_seed.py`, then in the Supabase SQL editor
`delete from questions;` and run the fresh `supabase/seed_questions.sql`
(details in docs/SUPABASE.md). The two copies must stay identical, same
order, or online and offline phones disagree on the daily question.
`MISSYOU` needs no DB step.

## Category tone guide (match it!)

- **funny** 😂 — absurd, teasing, zero romance required.
  _"If we got arrested together, what would it 100% be for?"_
- **romantic** 💕 — sincere, warm, heart-squeezing.
  _"What future memory with me are you most excited to make?"_
- **spicy** 🌶️ — flirty, suggestive, PG-13.
  _"Where is my most kissable spot? Point to it later."_
- **nasty** 😈 — adult, direct, still playful — never crude for its own sake.
  _"What's one rule we should break tonight?"_
- **ldr** 💌 — long-distance specific: missing each other, reunions, calls.
  _"What are we eating first when we're together again?"_

Questions address the partner as "you" and the asker as "I/me" so the same
text works whichever of them reads it aloud. Keep them answerable in
conversation (no homework).

## The one side effect to mention

The daily pick is `index = seededRandom(date) % pool.length`. Changing the
pool (adding, removing, reordering) changes which question shows on a given
date. Harmless — but BOTH partners must be on the new version (just refresh
the Vercel URL) or they'll see different questions that day. Mention this
in your summary when you change the pool.

`nasty` and `spicy` also feed After Dark mode; `ldr` is excluded from
After Dark. No action needed — just don't rename the categories.

## Checklist

- Strings properly escaped (apostrophes are fine in double quotes)
- No trailing-comma syntax errors — open the file in a browser after editing
- New questions match their category's tone (read three neighbors first)
