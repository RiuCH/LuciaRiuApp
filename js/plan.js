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
  // Only the visible sub-view does work. sdLoad() is the one that touches the
  // network, and only until it has the list; tpRender() reads `journeys`,
  // which loadJourneys() has already fetched for ✈️ Trips.
  if (which === "someday" && typeof sdLoad === "function") {
    if (sdReady === null) sdLoad(); else sdRender();
  }
  if (which === "trip" && typeof tpRender === "function") tpRender();
}

document.querySelectorAll("#planPicker .chip").forEach(chip =>
  chip.addEventListener("click", () => planShow(chip.dataset.plan)));

TAB_HOOKS.plan = () => {
  planShow(planPick);
  // The pot is on screen for both sub-views, so it loads with the tab rather
  // than with either chip. Once only — mnReady stops it re-fetching.
  if (typeof mnLoad === "function" && typeof mnReady !== "undefined" && mnReady === null) mnLoad();
  else planRenderMoney();
};


// ---------------- the money strip ----------------
// Deliberately a strip and not a chip: 💸 Money is the constraint the other
// two are read against, so `pot − committed = left` stays on screen while you
// browse what you want. js/money.js (task E2) owns what goes in it — this file
// just makes sure it's up to date whenever the tab opens.
function planRenderMoney() {
  if (typeof mnRender === "function") mnRender();
}
