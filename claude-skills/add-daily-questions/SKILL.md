---
name: add-daily-questions
description: Use when adding, editing, or removing questions in the daily question game, or adding miss-you texts. Explains the BANK structure, the tone of each category, and the one side effect to warn about (the daily pick shifts when the pool changes).
---

# Adding questions & miss-you texts

## Where

- `BANK` — in `js/questions.js`: 345 prompts across the 11 category arrays
  listed under "Category tone guide" below (`funny`, `romantic`, `spicy`,
  `nasty`, `ldr`, `deep`, `filthy`, `dareapart`, `dareapartx`,
  `daretogether`, `daretogetherx`)
- `MISSYOU` — in `js/home.js`: flat array of miss-you message strings

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
- **deep** 🧠 — introspective and vulnerable: values, fears, growth, family,
  the future. Sincere, never a joke, worth a long answer.
  _"What are you most afraid of losing — and have you ever said it out loud?"_
- **filthy** 🔥 — explicit. Blunt, adult, unmistakably sexual, still warm
  rather than crude. Play-tab only.
- **dareapart / dareapartx** ✈️ — *instructions*, not questions, doable from
  1,800 miles: send, record, text, wear, show. The `x` pool is the explicit
  half. Every one must be possible with only a phone.
- **daretogether / daretogetherx** 💞 — instructions that need a shared
  room. The `x` pool is the explicit half.

Questions address the partner as "you" and the asker as "I/me" so the same
text works whichever of them reads it aloud. Keep them answerable in
conversation (no homework).

## Which category lands where

| Surface | Draws from |
|---|---|
| Home — Question of the Day | `QOTD_CATS`: funny + romantic + ldr |
| 🎭 Talk tab — 💬 Talk deck | apart: deep + romantic + ldr · together: deep + romantic + funny |
| 🎭 Talk tab — 😏 Flirt deck | spicy + nasty + filthy (both modes) |
| 🎭 Talk tab — 🔥 Dare deck | apart: dareapart(+x) · together: daretogether(+x) |

**Home is the always-visible page — keep it sweet.** Anything explicit goes
in a Play-tab category, never in `QOTD_CATS`. Don't rename categories;
`CHIPS`, `QOTD_CATS` and `TFD_DECKS` all key off these exact strings, and
the DB stores them as the `category` column.

## The one side effect to mention

The pool is shuffled into a deck and dealt one per day, so changing it
(adding, removing, reordering) reshuffles **every future day**. Harmless —
but BOTH partners must be on the new version (just refresh the Vercel URL)
or they'll see different questions that day. Mention this in your summary.

**Two copies must stay identical:** the hardcoded `BANK` and the DB
`questions` table. An online phone reads the DB, an offline one reads
`BANK`, and if the per-category order differs they deal different decks.
So: add new questions at the **END** of their category array, then push
them to the DB with

```bash
python3 supabase/append_questions.py            # dry run — shows the diff
python3 supabase/append_questions.py --apply    # insert (non-destructive)
```

It refuses to run if the stored rows aren't a prefix of `BANK`, verifies
the two match afterwards, and never deletes. Only use
`generate_seed.py` + a full reseed for a brand-new project.

## Checklist

- Strings properly escaped (apostrophes are fine in double quotes)
- No trailing-comma syntax errors — open the file in a browser after editing
- New questions match their category's tone (read three neighbors first)
