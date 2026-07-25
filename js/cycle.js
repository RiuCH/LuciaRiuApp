// cycle.js — Lucia ♥ Riu
// The 🌙 Moon tab: Lucia's cycle calendar and our own tally, on one grid.
//
// This tab has NO nav button on purpose — you reach it by long-pressing the ♥
// in the header (see "the quiet door" in js/core.js) or with #moon=1. That's
// obscurity, not security: this repo is public and the page source is
// readable, exactly like the lock screen. It hides the tab from someone
// glancing over your shoulder, nothing more.
//
// State lives in two rows of the existing `settings` table, so there is NO
// database migration to run — the first write creates them. If Supabase is
// off or unreachable everything still works for this session and the panel
// SAYS SO rather than pretending it synced.
//
// Deliberately NOT mirrored into the URL hash (unlike `reunion`/`photo`):
// that would print this log into the address bar, which rather defeats the
// point of a hidden tab.

const CY_PERIODS = "cycle_periods"; // "2026-07-03:5,2026-07-31:4" (start:days long)
const CY_LOVE    = "love_log";      // "2026-07-04:1,2026-07-11:2" (date:times)

const CY_DEF_CYCLE = 28;  // until she's logged two starts we have nothing to learn from
const CY_DEF_LEN   = 5;
const CY_MONTHS = ["January","February","March","April","May","June",
                   "July","August","September","October","November","December"];

let cyPeriods = [];       // [{start:"YYYY-MM-DD", len:5}], sorted oldest first
let cyLove = {};          // {"YYYY-MM-DD": 2}
let cyView = null;        // {y, m} month on screen — set on first render
let cyPicked = null;      // selected day key, or null
let cySynced = null;      // null = unknown, true = sharing, false = this phone only
let cyBusy = false;       // don't let a poll clobber my own write


// ---------------- DATES ----------------
// Everything is a local "YYYY-MM-DD" string. Never `new Date("2026-07-03")` —
// that parses as UTC and lands on the wrong day west of Greenwich (i.e. both
// of us). cyDate() builds local midnight instead.
function cyKey(d) {
  const p = n => (n < 10 ? "0" : "") + n;
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
function cyDate(k) {
  const parts = k.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function cyToday() { return cyKey(new Date()); }
function cyAdd(k, n) { const d = cyDate(k); d.setDate(d.getDate() + n); return cyKey(d); }
// Rounding matters: two local midnights are 23 or 25 hours apart across a DST
// switch, and a bare division would quietly lose a day twice a year.
function cyDiff(a, b) { return Math.round((cyDate(a) - cyDate(b)) / 86400000); }
function cyIsDate(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }
function cyPretty(k) {
  const d = cyDate(k);
  return CY_MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate() + ", " + d.getFullYear();
}


// ---------------- PARSE / SERIALISE ----------------
// Both values stay human-readable so they can be fixed by hand in the
// Supabase table editor if we ever fat-finger a tap.
function cyParsePeriods(s) {
  return (s || "").split(",").map(x => x.trim()).filter(Boolean)
    .map(x => {
      const bits = x.split(":");
      return { start: bits[0], len: Math.min(14, Math.max(1, parseInt(bits[1], 10) || CY_DEF_LEN)) };
    })
    .filter(p => cyIsDate(p.start))
    .sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
}
function cySerPeriods(list) { return list.map(p => p.start + ":" + p.len).join(","); }

function cyParseLove(s) {
  const map = {};
  (s || "").split(",").map(x => x.trim()).filter(Boolean).forEach(x => {
    const bits = x.split(":");
    const n = Math.max(0, parseInt(bits[1], 10) || 0);
    if (cyIsDate(bits[0]) && n > 0) map[bits[0]] = n;
  });
  return map;
}
function cySerLove(map) {
  return Object.keys(map).filter(k => map[k] > 0).sort().map(k => k + ":" + map[k]).join(",");
}


// ---------------- CYCLE MATHS ----------------
// Gaps outside 15–60 days are almost certainly a typo or a months-long gap in
// logging, and one of them would drag the average somewhere useless.
function cyGaps() {
  const out = [];
  for (let i = 1; i < cyPeriods.length; i++) {
    const g = cyDiff(cyPeriods[i].start, cyPeriods[i - 1].start);
    if (g >= 15 && g <= 60) out.push(g);
  }
  return out;
}
function cyAvgCycle() {
  const gaps = cyGaps().slice(-6);   // recent history only — bodies change
  if (!gaps.length) return CY_DEF_CYCLE;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}
function cyAvgLen() {
  if (!cyPeriods.length) return CY_DEF_LEN;
  const recent = cyPeriods.slice(-6);
  return Math.round(recent.reduce((a, p) => a + p.len, 0) / recent.length);
}
function cyLastStart() {
  const today = cyToday();
  for (let i = cyPeriods.length - 1; i >= 0; i--) {
    if (cyPeriods[i].start <= today) return cyPeriods[i];
  }
  return cyPeriods.length ? cyPeriods[0] : null;
}

// Every day she has actually logged as bleeding.
function cyPeriodDays() {
  const set = new Set();
  cyPeriods.forEach(p => { for (let i = 0; i < p.len; i++) set.add(cyAdd(p.start, i)); });
  return set;
}

// Project the next nine cycles forward from her most recent logged start.
// Nine is roughly nine months of scrolling — plenty, and still only ~110
// string builds, so it's fine to recompute on every render.
function cyPredict() {
  const last = cyLastStart();
  if (!last) return { pred: new Set(), fert: new Set(), expected: null };
  const cyc = cyAvgCycle(), len = cyAvgLen();
  const pred = new Set(), fert = new Set();
  let expected = null;
  for (let k = 1; k <= 9; k++) {
    const s = cyAdd(last.start, cyc * k);
    if (k === 1) expected = s;
    for (let i = 0; i < len; i++) pred.add(cyAdd(s, i));
    // Ovulation lands ~14 days BEFORE the next period, so the window hangs
    // off each projected start rather than off the previous one.
    const ov = cyAdd(s, -14);
    for (let i = -5; i <= 1; i++) fert.add(cyAdd(ov, i));
  }
  return { pred, fert, expected };
}


// ---------------- US, BY THE NUMBERS ----------------
function cyLoveStats() {
  const keys = Object.keys(cyLove).filter(k => cyLove[k] > 0).sort();
  const today = cyToday();
  const sum = ks => ks.reduce((s, k) => s + cyLove[k], 0);

  let bestDay = null, bestRun = 0, run = 0, prev = null;
  keys.forEach(k => {
    if (bestDay === null || cyLove[k] > cyLove[bestDay]) bestDay = k;
    run = (prev && cyDiff(k, prev) === 1) ? run + 1 : 1;
    if (run > bestRun) bestRun = run;
    prev = k;
  });

  const last = keys.length ? keys[keys.length - 1] : null;
  return {
    total: sum(keys),
    days: keys.length,
    month: sum(keys.filter(k => k.slice(0, 7) === today.slice(0, 7))),
    year: sum(keys.filter(k => k.slice(0, 4) === today.slice(0, 4))),
    bestDay: bestDay,
    bestDayCount: bestDay ? cyLove[bestDay] : 0,
    bestRun: bestRun,
    last: last,
    since: last ? cyDiff(today, last) : null
  };
}


// ---------------- SYNC ----------------
// Same shape as the duel's: last write wins, and the 5s poll re-converges
// both phones. Taps here are minutes apart, not milliseconds, so the
// PATCH-arbitration dance the duel needs for its answer race would be
// ceremony. cyMutate() still re-reads first, which closes most of the window.
function cySave(key, value) {
  return supa("settings?on_conflict=key", {
    method: "POST", prefer: "resolution=merge-duplicates", body: { key: key, value: value }
  });
}

function cyApplyRows(rows) {
  const map = {};
  (rows || []).forEach(r => { map[r.key] = r.value; });
  if (typeof map[CY_PERIODS] === "string") cyPeriods = cyParsePeriods(map[CY_PERIODS]);
  if (typeof map[CY_LOVE] === "string") cyLove = cyParseLove(map[CY_LOVE]);
}

async function cyPull() {
  if (!supaOn()) { cySynced = false; cyRender(); return; }
  if (cyBusy) return;
  try {
    const rows = await supa("settings?key=in.(" + CY_PERIODS + "," + CY_LOVE + ")&select=key,value");
    cyApplyRows(rows);
    cySynced = true;
  } catch (e) {
    cySynced = false;   // offline — keep logging locally, but say so
  }
  cyRender();
}

// Re-read, apply the change to the FRESH state, write it back. Without the
// re-read, opening the tab on a stale phone and tapping once would push a
// snapshot that silently undoes whatever the other phone logged since.
async function cyMutate(change) {
  if (!supaOn()) { change(); cySynced = false; cyRender(); return; }
  cyBusy = true;
  try {
    const rows = await supa("settings?key=in.(" + CY_PERIODS + "," + CY_LOVE + ")&select=key,value");
    cyApplyRows(rows);
    change();
    cyRender();
    await Promise.all([
      cySave(CY_PERIODS, cySerPeriods(cyPeriods)),
      cySave(CY_LOVE, cySerLove(cyLove))
    ]);
    cySynced = true;
  } catch (e) {
    change();           // the DB is unreachable; it still counts on this phone
    cySynced = false;
  } finally {
    cyBusy = false;
    cyRender();
  }
}

setInterval(() => { if (activeTab === "cycle") cyPull(); }, 5000);
TAB_HOOKS.cycle = cyPull;
// Phones freeze timers in a backgrounded tab, so catch up when looked at again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && activeTab === "cycle") cyPull();
});


// ---------------- ACTIONS ----------------
function cyPeriodAt(key) {
  return cyPeriods.find(p => key >= p.start && cyDiff(key, p.start) < p.len) || null;
}

function cyStartPeriod(key) {
  cyMutate(() => {
    if (cyPeriodAt(key)) return;
    cyPeriods.push({ start: key, len: cyAvgLen() });
    cyPeriods.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  });
  popToast("🌙 Logged — " + cyPretty(key));
}

function cyRemovePeriod(key) {
  const p = cyPeriodAt(key);
  if (!p) return;
  cyMutate(() => { cyPeriods = cyPeriods.filter(x => x.start !== p.start); });
  popToast("Removed that one 🌙");
}

function cyNudgeLength(key, delta) {
  const p = cyPeriodAt(key);
  if (!p) return;
  cyMutate(() => {
    const live = cyPeriods.find(x => x.start === p.start);
    if (live) live.len = Math.min(14, Math.max(1, live.len + delta));
  });
}

function cyNudgeLove(key, delta, e) {
  // Read the tally BEFORE cyMutate touches it — it re-reads the DB first, so
  // this is only what we asked for, but the toast fires long before that lands.
  const asked = Math.max(0, (cyLove[key] || 0) + delta);
  cyMutate(() => {
    const n = Math.max(0, (cyLove[key] || 0) + delta);
    if (n) cyLove[key] = n; else delete cyLove[key];
  });
  if (delta > 0) {
    if (e) burst(e.clientX, e.clientY, ["💞", "🔥", "✨", "💘"]);
    popToast(asked > 1 ? "Round " + asked + " 😏 " + cyPretty(key) : "Logged 💞 " + cyPretty(key));
  }
}


// ---------------- RENDER ----------------
const cyGridEl = document.getElementById("cyGrid");

function cyStat(value, label) {
  const box = document.createElement("div");
  box.className = "cy-stat";
  const b = document.createElement("b");
  b.textContent = value;
  const s = document.createElement("span");
  s.textContent = label;
  box.appendChild(b);
  box.appendChild(s);
  return box;
}

function cyRenderGrid() {
  if (!cyView) { const n = new Date(); cyView = { y: n.getFullYear(), m: n.getMonth() }; }
  document.getElementById("cyMonthLbl").textContent = CY_MONTHS[cyView.m] + " " + cyView.y;

  const actual = cyPeriodDays();
  const guess = cyPredict();
  const today = cyToday();
  const first = new Date(cyView.y, cyView.m, 1);
  const start = new Date(cyView.y, cyView.m, 1 - first.getDay()); // back up to Sunday

  cyGridEl.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = cyKey(d);
    const cell = document.createElement("button");
    cell.className = "cy-day";
    cell.dataset.key = key;
    if (d.getMonth() !== cyView.m) cell.classList.add("cy-out");
    if (key === today) cell.classList.add("cy-today");
    if (key === cyPicked) cell.classList.add("cy-picked");
    if (actual.has(key)) cell.classList.add("cy-period");
    else if (guess.pred.has(key)) cell.classList.add("cy-pred");
    else if (guess.fert.has(key)) cell.classList.add("cy-fert");

    const num = document.createElement("span");
    num.className = "cy-num";
    num.textContent = d.getDate();
    cell.appendChild(num);

    if (cyLove[key]) {
      const mark = document.createElement("span");
      mark.className = "cy-love";
      mark.textContent = cyLove[key] > 1 ? "💞" + cyLove[key] : "💞";
      cell.appendChild(mark);
    }
    cyGridEl.appendChild(cell);
  }
}

function cyRenderDayPanel() {
  const title = document.getElementById("cyDayTitle");
  const marks = document.getElementById("cyDayMarks");
  const btns = document.getElementById("cyDayBtns");
  marks.innerHTML = "";
  btns.innerHTML = "";

  if (!cyPicked) {
    title.textContent = "Tap a day";
    marks.textContent = "…and mark what happened on it 😌";
    return;
  }

  const key = cyPicked;
  const p = cyPeriodAt(key);
  const love = cyLove[key] || 0;
  title.textContent = cyPretty(key) + (key === cyToday() ? " · today" : "");
  marks.textContent = [
    p ? "🌙 Period day " + (cyDiff(key, p.start) + 1) + " of " + p.len : null,
    love ? "💞 " + love + (love > 1 ? " times" : " time") : null
  ].filter(Boolean).join("  ·  ") || "Nothing logged yet";

  const add = (label, cls, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener("click", fn);
    btns.appendChild(b);
    return b;
  };

  add("💞 We did", "primary", (e) => cyNudgeLove(key, 1, e));
  if (love) add("−1 💞", "", () => cyNudgeLove(key, -1));

  if (p) {
    add("🌙 shorter", "", () => cyNudgeLength(key, -1));
    add("🌙 longer", "", () => cyNudgeLength(key, 1));
    add("✕ remove 🌙", "", () => cyRemovePeriod(key));
  } else {
    add("🌙 Period started", "", () => cyStartPeriod(key));
  }
}

function cyRenderStats() {
  const last = cyLastStart();
  const guess = cyPredict();
  const today = cyToday();
  const moon = document.getElementById("cyMoonStats");
  moon.innerHTML = "";

  if (!last) {
    document.getElementById("cyCycleDay").textContent = "Cycle day —";
    document.getElementById("cyNextPill").textContent = "Next 🌙 —";
    moon.appendChild(cyStat("—", "no data yet"));
    document.getElementById("cyMoonHint").textContent =
      "Tap a day and log the first 🌙 — after two of them this starts predicting.";
  } else {
    const day = cyDiff(today, last.start) + 1;
    const late = cyDiff(today, guess.expected);
    moon.appendChild(cyStat(day > 0 ? "Day " + day : "—", "of her cycle"));
    moon.appendChild(cyStat(cyAvgCycle() + "d", "average cycle"));
    moon.appendChild(cyStat(cyAvgLen() + "d", "average period"));

    document.getElementById("cyCycleDay").textContent = day > 0 ? "Cycle day " + day : "Cycle day —";
    document.getElementById("cyNextPill").textContent =
      late === 0 ? "🌙 Expected today"
      : late > 0 ? "🌙 " + late + "d late"
      : "🌙 in " + (-late) + "d";

    const gaps = cyGaps().length;
    document.getElementById("cyMoonHint").textContent =
      (gaps < 2
        ? "Still learning her rhythm — using a " + cyAvgCycle() + "-day default until there are a few more 🌙. "
        : "Predicting from her last " + Math.min(gaps, 6) + " cycles. ") +
      "Predictions are averages, not medicine — and definitely not birth control.";
  }

  const s = cyLoveStats();
  const us = document.getElementById("cyUsStats");
  us.innerHTML = "";
  us.appendChild(cyStat(s.total, "all time"));
  us.appendChild(cyStat(s.month, "this month"));
  us.appendChild(cyStat(s.year, "this year"));
  us.appendChild(cyStat(s.days, "days on the board"));
  us.appendChild(cyStat(s.bestDayCount ? "×" + s.bestDayCount : "—", "🏆 best day"));
  us.appendChild(cyStat(s.bestRun ? s.bestRun + "d" : "—", "🔥 longest streak"));
  us.appendChild(cyStat(s.since === null ? "—" : s.since === 0 ? "today 😏" : s.since + "d", "since the last"));

  const record = document.getElementById("cyRecordLine");
  record.textContent = s.bestDay
    ? "🏆 The record is " + s.bestDayCount + " in one day — " + cyPretty(s.bestDay) +
      ". Longest streak: " + s.bestRun + (s.bestRun === 1 ? " day." : " days in a row.")
    : "No record to beat yet. Someone should fix that 😌";

  document.getElementById("cySyncHint").textContent =
    !supaOn()          ? "Local mode — this phone is keeping the tally on its own"
    : cySynced === false ? "⚠️ Can't reach the database — logged here only, for now"
    : cySynced === true  ? "Synced 💞 both phones see the same calendar"
    : "Connecting…";
}

function cyRender() {
  cyRenderGrid();
  cyRenderDayPanel();
  cyRenderStats();
}


// ---------------- WIRING ----------------
function cyShiftMonth(delta) {
  const d = new Date(cyView.y, cyView.m + delta, 1);
  cyView = { y: d.getFullYear(), m: d.getMonth() };
  cyRenderGrid();
}
document.getElementById("cyPrev").addEventListener("click", () => cyShiftMonth(-1));
document.getElementById("cyNext").addEventListener("click", () => cyShiftMonth(1));
// id is cyNow, not cyToday: an element id becomes a window property, and
// there is already a cyToday() function up there to collide with.
document.getElementById("cyNow").addEventListener("click", () => {
  const n = new Date();
  cyView = { y: n.getFullYear(), m: n.getMonth() };
  cyPicked = cyToday();
  cyRender();
});
document.getElementById("cyClose").addEventListener("click", () => switchTab("home"));

cyGridEl.addEventListener("click", (e) => {
  const cell = e.target.closest(".cy-day");
  if (!cell) return;
  cyPicked = cyPicked === cell.dataset.key ? null : cell.dataset.key;
  cyRenderGrid();
  cyRenderDayPanel();
});
