// core.js — Lucia ♥ Riu
// Shared foundation: hash-param storage, the day counter + seeded PRNG,
// tab switching, toasts and celebration effects. Loads first — everything
// else may call into it.

// ---------------- URL-HASH PARAMS (our only "storage") ----------------
function getHashParam(name) {
  try {
    const m = location.hash.match(new RegExp(name + "=([^&]+)"));
    return m ? m[1] : null;
  } catch (e) { return null; }
}
// `replace` rewrites the current history entry instead of adding one. Used for
// things that change constantly — which tab you're on — so the back button
// still leaves the app instead of walking you through twenty tab switches.
function setHashParam(name, val, replace) {
  try {
    const parts = location.hash.replace(/^#/, "").split("&")
      .filter(p => p && !p.startsWith(name + "="));
    parts.push(name + "=" + val);
    if (replace && history.replaceState) {
      history.replaceState(null, "", location.pathname + location.search + "#" + parts.join("&"));
    } else {
      location.hash = parts.join("&");
    }
  } catch (e) {}
}


// ---------------- STATE ----------------
const EPOCH = new Date(2026, 6, 24); // Day 1 = July 24, 2026 (local time)
// Together mode (js/tfd.js) runs the app hot: red palette, filthier hearts.
// Apart is the default.
let hotMode = false;

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayNumber() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.round((today - EPOCH) / 86400000) + 1);
}


// ---------------- TABS ----------------
const SUBTITLES = { home: "Our Little Universe", tfd: "Talk · Flirt · Dare", journeys: "Everywhere, Together", treats: "The Things That Made Us", plan: "Everything Ahead", duel: "The Games Room", cycle: "Moonlight" };
// `cycle` is deliberately missing from NAVIDS: it's the one tab with no nav
// button, so nothing in the nav ever lights up for it. See "the quiet door".
// `tfd` is deliberately absent from NAVIDS and TABS: Talk · Flirt · Dare is no
// longer a tab, it's a sub-view of 🎮 Games (a `gamesPick` value). Its
// SUBTITLES entry stays — gamesShow() still uses it as the label.
const NAVIDS = { home: "navHome", journeys: "navJourneys", treats: "navTreats", plan: "navPlan", duel: "navDuel" };
const TABS = ["home", "journeys", "treats", "plan", "duel", "cycle"];
let activeTab = "home";
// Tabs that host more than one thing keep a "which one is showing" pick here,
// so each sub-view can guard its own loading and polling — a merged tab whose
// TAB_HOOKS entry ignores the pick would run EVERY sub-view's loader on open.
// The chooser function itself lives in the tab's own file.
let gamesPick = "duel";       // 🎮 Games:  "duel" | "q20"       — js/twenty.js
let treatsPick = "food";      // 💝 Memories: "food" | "gifts" | "moodboard" — js/food.js
let planPick = "someday";     // 📋 Plan:   "someday" | "trip"   — js/plan.js

// A tab can register work that must only run once it's actually on screen —
// e.g. building <img> elements, which never load inside a display:none
// container. Set TAB_HOOKS.<tab> from that tab's own file. It fires on every
// switch to that tab, so keep it cheap and idempotent.
const TAB_HOOKS = {};

// Which tab to reopen on refresh, and how each tab restores its sub-view.
// A tab registers itself here so init.js can put you back exactly where you
// were — see the restore step at the bottom of js/init.js.
const TAB_SUBS = {};

function switchTab(name) {
  activeTab = name;
  // Remember it — EXCEPT 🌙 Moon. That tab is deliberately not sticky: a
  // refresh is meant to land on Home so it re-hides itself, and writing
  // `#tab=cycle` would also leave it sitting in the address bar. Its doors are
  // the long-press and `#moon=1`, and that stays true.
  if (name !== "cycle") setHashParam("tab", name, true);
  TABS.forEach(t => {
    document.getElementById("page-" + t).classList.toggle("active", t === name);
    const nav = NAVIDS[t] ? document.getElementById(NAVIDS[t]) : null;
    if (nav) nav.classList.toggle("active", t === name);
  });
  // Plain label here. Tabs with a chooser correct it themselves from their
  // TAB_HOOKS entry (which runs below), because only they know which sub-view
  // is showing — and Talk's "Together Edition" depends on hotMode too.
  document.getElementById("subtitle").textContent = SUBTITLES[name];
  window.scrollTo({ top: 0 });
  if (TAB_HOOKS[name]) TAB_HOOKS[name]();
}
document.getElementById("navHome").addEventListener("click", () => switchTab("home"));
document.getElementById("navJourneys").addEventListener("click", () => switchTab("journeys"));
document.getElementById("navTreats").addEventListener("click", () => switchTab("treats"));
document.getElementById("navPlan").addEventListener("click", () => switchTab("plan"));
document.getElementById("navDuel").addEventListener("click", () => switchTab("duel"));
document.getElementById("wdTeaser").addEventListener("click", () => switchTab("duel"));
document.getElementById("jrHomeCard").addEventListener("click", () => switchTab("journeys"));


// ---------------- THE QUIET DOOR ----------------
// Hold the ♥ in the header for a moment and the Moon tab (js/cycle.js) opens.
// It has no nav button, so this gesture and `#moon=1` are the only ways in.
// Chosen because the header is on every tab, nobody long-presses a decorative
// heart by accident, and it changes nothing about how the app looks.
//
// To be clear about what this is: the tab is HIDDEN, not protected — same as
// the lock screen. The deployed page ships the Supabase anon key and the RLS
// policies are wide open, so the app URL is all anyone needs to read what's
// behind here. It stops a shoulder-glance, not a curious reader.
const CY_HOLD_MS = 1200;
(function quietDoor() {
  const heart = document.getElementById("secretHeart");
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  const start = () => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      if (activeTab === "cycle") return;
      switchTab("cycle");
      burst(innerWidth / 2, 90, ["🌙", "✨", "🌸", "💞"]);
    }, CY_HOLD_MS);
  };
  heart.addEventListener("pointerdown", start);
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev =>
    heart.addEventListener(ev, cancel));
  // Long-press on a phone otherwise raises the copy/look-up callout, and on a
  // laptop the right-click menu — both would fight the gesture.
  heart.addEventListener("contextmenu", (e) => e.preventDefault());
})();


// ---------------- FOLDABLE ISLANDS ----------------
// Any panel can collapse to just its title bar. Markup does the wiring:
//
//   <div class="panel">
//     <button class="ptitle foldbtn" data-fold="theBody">
//       <span>Title</span><span class="foldchev">▸</span>
//     </button>
//     <div id="theBody"> …everything that folds… </div>
//   </div>
//
// FOLDED BY DEFAULT, deliberately: these islands are controls sitting on top
// of the content you actually came for (the photo grid, the timeline), so
// hiding them puts the content first and one tap brings them back.
//
// State is in memory only — golden rule 2 — so everything returns to folded on
// refresh. That's the right default for a set of controls, and it's why this
// doesn't need storage.
//
// Generic on purpose: 🍜 Food had its own fd-fold implementation and three
// more islands wanted the same thing. One mechanism, wired by attribute, so a
// new island is two lines of markup and no JS at all.
function foldSet(btn, open) {
  const body = document.getElementById(btn.dataset.fold);
  if (!body) return;
  body.style.display = open ? "" : "none";   // "" not "block" — let CSS decide
  btn.setAttribute("aria-expanded", String(open));
  const chev = btn.querySelector(".foldchev");
  if (chev) chev.textContent = open ? "▾" : "▸";
  const panel = btn.closest(".panel");
  if (panel) panel.classList.toggle("folded", !open);
}

document.querySelectorAll(".foldbtn[data-fold]").forEach(btn => {
  // data-fold-open="1" opts an island into starting open
  foldSet(btn, btn.dataset.foldOpen === "1");
  btn.addEventListener("click", () => {
    foldSet(btn, btn.getAttribute("aria-expanded") !== "true");
  });
});


const toast = document.getElementById("toast");

function popToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}


// ---------------- EFFECTS ----------------
function burst(x, y, set) {
  const icons = set || ["💖","💘","✨","💕","💫"];
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("span");
    s.className = "burst";
    s.textContent = icons[i % icons.length];
    s.style.left = (x || innerWidth / 2) + "px";
    s.style.top = (y || innerHeight / 2) + "px";
    s.style.setProperty("--dx", (Math.random() * 220 - 110) + "px");
    s.style.setProperty("--dy", (-60 - Math.random() * 160) + "px");
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 950);
  }
}

function spawnHeart() {
  const h = document.createElement("span");
  h.className = "heart";
  const set = hotMode ? ["🔥","😈","💋","❤️‍🔥"] : ["💖","💕","💘","🤍","💫"];
  h.textContent = set[Math.floor(Math.random() * set.length)];
  h.style.left = Math.random() * 100 + "vw";
  h.style.fontSize = (14 + Math.random() * 18) + "px";
  h.style.animationDuration = (7 + Math.random() * 8) + "s";
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 16000);
}
