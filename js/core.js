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
function setHashParam(name, val) {
  try {
    const parts = location.hash.replace(/^#/, "").split("&")
      .filter(p => p && !p.startsWith(name + "="));
    parts.push(name + "=" + val);
    location.hash = parts.join("&");
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
const SUBTITLES = { home: "Our Little Universe", tfd: "Talk · Flirt · Dare", journeys: "Everywhere, Together", food: "Everything We've Eaten", duel: "The Games Room", cycle: "Moonlight" };
// `cycle` is deliberately missing from NAVIDS: it's the one tab with no nav
// button, so nothing in the nav ever lights up for it. See "the quiet door".
const NAVIDS = { home: "navHome", tfd: "navTfd", journeys: "navJourneys", food: "navFood", duel: "navDuel" };
const TABS = ["home", "tfd", "journeys", "food", "duel", "cycle"];
let activeTab = "home";
// The Games tab (key "duel") hosts more than one game; js/twenty.js owns
// the chooser and sets this. Lives here so each game can guard its own poll.
let gamesPick = "duel";   // "duel" | "q20"

// A tab can register work that must only run once it's actually on screen —
// e.g. building <img> elements, which never load inside a display:none
// container. Set TAB_HOOKS.<tab> from that tab's own file. It fires on every
// switch to that tab, so keep it cheap and idempotent.
const TAB_HOOKS = {};

function switchTab(name) {
  activeTab = name;
  TABS.forEach(t => {
    document.getElementById("page-" + t).classList.toggle("active", t === name);
    const nav = NAVIDS[t] ? document.getElementById(NAVIDS[t]) : null;
    if (nav) nav.classList.toggle("active", t === name);
  });
  document.getElementById("subtitle").textContent =
    (name === "tfd" && hotMode) ? "Together Edition" : SUBTITLES[name];
  window.scrollTo({ top: 0 });
  if (TAB_HOOKS[name]) TAB_HOOKS[name]();
}
document.getElementById("navHome").addEventListener("click", () => switchTab("home"));
document.getElementById("navTfd").addEventListener("click", () => switchTab("tfd"));
document.getElementById("navJourneys").addEventListener("click", () => switchTab("journeys"));
document.getElementById("navFood").addEventListener("click", () => switchTab("food"));
document.getElementById("navDuel").addEventListener("click", () => switchTab("duel"));
document.getElementById("wdTeaser").addEventListener("click", () => switchTab("duel"));


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
