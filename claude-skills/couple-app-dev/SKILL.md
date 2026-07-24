---
name: couple-app-dev
description: Use before making ANY change to the Lucia & Riu couple app (index.html). Covers the architecture, hard constraints (single-file, no localStorage, deterministic shared daily logic), styling conventions, testing checklist, and the deploy pipeline. Trigger on any request to add features, fix bugs, restyle, or refactor this app.
---

# Developing the Lucia ♥ Riu app

## Hard constraints — check every change against these

1. Everything stays in `index.html`. Inline CSS in the single `<style>`,
   inline JS in the single `<script>`. No external requests except (rarely)
   cdnjs.cloudflare.com if truly unavoidable.
2. NO localStorage, sessionStorage, IndexedDB, or cookies — they fail in the
   preview environments the couple uses. Persistence options, in order:
   in-memory variable → URL hash param (like `#reunion=2026-12-20`) →
   hardcoded constant (like `ANNIVERSARY`).
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

## Testing checklist before every commit

- Open `index.html` in a browser (that IS the dev environment). No console
  errors.
- All three tabs switch; bottom nav highlights correctly.
- Reload twice: daily question identical both times (determinism).
- Toggle After Dark: only spicy/nasty appear; theme turns red; toggle back.
- If you changed clocks/countdowns: check a simulated date (override `Date`
  in DevTools or temporarily change the constant — remember to change it back).

## Deploy

Commit → push to `main` → Vercel auto-deploys https://lucia-riu-app.vercel.app
within ~a minute. Both partners refresh. Never push a broken main; if a
change is risky, test locally first — there is no staging environment.
