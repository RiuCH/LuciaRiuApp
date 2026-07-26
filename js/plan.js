// plan.js — Lucia ♥ Riu
// 📋 Plan: everything ahead of us. The tab shell only, for now.
//
//   ⭐ Someday  →  🗓️ Trip Plan  →  ✈️ Trips
//   "Japan someday"  "Tokyo, Dec 20–28"   the album, afterwards
//
// A wish becomes a plan becomes a memory. The first two live here; the payoff
// has its own tab. ⭐ Someday and 🗓️ Trip Plan are task E1, 💸 Money is E2 —
// this file owns the chooser and the money strip they'll fill in.

// ---------------- the chooser ----------------
// Same shape as gamesShow() (js/twenty.js) and treatsShow() (js/food.js),
// including the two rules those two learned the hard way:
//   • `display = ""`, never `"block"` — css/desktop.css targets these inner
//     containers and an inline style would beat it.
//   • TAB_HOOKS re-runs the whole thing rather than just a loader, because
//     switchTab() writes SUBTITLES[tab] and knows nothing about sub-views.
const PLAN_VIEWS = { someday: "planSomeday", trip: "planTrip" };
const PLAN_SUBTITLES = { someday: "Someday", trip: "The Next One" };

function planShow(which) {
  planPick = which;
  Object.keys(PLAN_VIEWS).forEach(k => {
    const el = document.getElementById(PLAN_VIEWS[k]);
    if (el) el.style.display = k === which ? "" : "none";
  });
  document.querySelectorAll("#planPicker .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.plan === which));
  if (activeTab === "plan") {
    document.getElementById("subtitle").textContent =
      PLAN_SUBTITLES[which] || SUBTITLES.plan;
  }
}

document.querySelectorAll("#planPicker .chip").forEach(chip =>
  chip.addEventListener("click", () => planShow(chip.dataset.plan)));

// Nothing to fetch until E1/E2 land, but the hook is wired now so those tasks
// only have to add their load inside planShow() — not rediscover this shape.
TAB_HOOKS.plan = () => planShow(planPick);


// ---------------- the money strip ----------------
// Deliberately a strip and not a chip: 💸 Money is the constraint the other
// two are read against, so `pot − committed = left` should stay on screen
// while you browse what you want. Task E2 fills these in; until then it says
// so rather than showing a fake zero, which would read as "we have nothing".
function planRenderMoney(pot, committed) {
  const potEl = document.getElementById("planPot");
  const sumEl = document.getElementById("planSums");
  if (!potEl || !sumEl) return;
  if (typeof pot !== "number") { potEl.textContent = "—"; return; }
  const left = pot - (committed || 0);
  potEl.textContent = "$" + pot.toLocaleString();
  sumEl.textContent = "Committed $" + (committed || 0).toLocaleString() +
                      " · Left $" + left.toLocaleString();
}
