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
let afterDark = false;

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
const SUBTITLES = { home: "Our Little Universe", game: "Question of the Day", journeys: "Everywhere, Together", duel: "The Word Duel" };
const NAVIDS = { home: "navHome", game: "navGame", journeys: "navJourneys", duel: "navDuel" };
let activeTab = "home";

function switchTab(name) {
  activeTab = name;
  ["home", "game", "journeys", "duel"].forEach(t => {
    document.getElementById("page-" + t).classList.toggle("active", t === name);
    document.getElementById(NAVIDS[t]).classList.toggle("active", t === name);
  });
  document.getElementById("subtitle").textContent =
    (name === "game" && afterDark) ? "After Dark Edition" : SUBTITLES[name];
  window.scrollTo({ top: 0 });
}
document.getElementById("navHome").addEventListener("click", () => switchTab("home"));
document.getElementById("navGame").addEventListener("click", () => switchTab("game"));
document.getElementById("navJourneys").addEventListener("click", () => switchTab("journeys"));
document.getElementById("navDuel").addEventListener("click", () => switchTab("duel"));
document.getElementById("teaserCard").addEventListener("click", () => switchTab("game"));
document.getElementById("wdTeaser").addEventListener("click", () => switchTab("duel"));


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
  const set = afterDark ? ["🔥","😈","💋","❤️‍🔥"] : ["💖","💕","💘","🤍","💫"];
  h.textContent = set[Math.floor(Math.random() * set.length)];
  h.style.left = Math.random() * 100 + "vw";
  h.style.fontSize = (14 + Math.random() * 18) + "px";
  h.style.animationDuration = (7 + Math.random() * 8) + "s";
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 16000);
}
