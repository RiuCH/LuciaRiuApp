# Lucia ♥ Riu 💞

Our own little couple app. One shared question every day, a together-clock,
anniversary countdown, long-distance clocks, and (soon™) more stupid games.

**Live app:** enable GitHub Pages (or Netlify) — see [Deploying](#deploying) below.

## What's in here

The whole app is **one file: `index.html`**. No build step, no dependencies,
no server. Open it in a browser and it works.

- 🏠 **Home** — together-clock (since June 2, 2026), anniversary countdown,
  SF/Phoenix clocks, reunion countdown, miss-you text generator
- 💬 **Daily Q** — question of the day (same question for both of us, every day)
- 🕹️ **Soon™** — reserved for Stupid Game #2

## How the daily question works

All questions live in the `BANK` object in `index.html`, grouped by category
(`funny`, `romantic`, `spicy`, `nasty`, `ldr`). The daily pick is **deterministic**:
a seeded random generator (`mulberry32`) keyed to the number of days since
July 24, 2026. Same date → same seed → same question on both our phones,
with zero communication. That's why we must both use the same version —
merge to `main`, then we both refresh.

## Developing (hi Lucia 👋)

1. Clone the repo, open `index.html` in a browser. That's the dev environment.
2. Edit, refresh the browser, repeat.
3. Easy first contributions:
   - Add questions to `BANK` (keep the category vibe)
   - Add miss-you texts to `MISSYOU`
   - Change colors: the `:root` CSS variables at the top
4. Bigger stuff (Stupid Game #2 lives here eventually):
   - Add a `<section class="page" id="page-yourgame">` next to the others
   - Add a nav button and wire it up in the `TABS` section of the script

House rules: keep it one file, keep it working offline, and **never use
`localStorage`** (it breaks where we preview the app) — in-memory state or
URL-hash params only.

## Deploying

Push (or merge) to `main` → the host redeploys automatically. Nothing else to do.

If setting up fresh:
- **GitHub Pages:** repo Settings → Pages → Source: `main` branch, `/ (root)`.
  App appears at `https://<username>.github.io/<repo>/`.
- **Netlify / Vercel / Cloudflare Pages:** import this repo, no build command,
  publish directory = root. Works with a private repo on the free tier.

---
Made with 💖 (and Claude) by Riu, for us.
