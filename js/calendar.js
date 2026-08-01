// calendar.js — Lucia ♥ Riu
// 📅 Our calendar: a card on Home that opens into a month you can both write to.
//
// Two people, two colours. Every entry carries `who`, and that is the only
// thing the colours mean — not a category, not a priority. You can see at a
// glance whose week is full.
//
// Dates are handled as plain "YYYY-MM-DD" strings end to end and never as
// Date instants. We live in two timezones; a timestamp would render as a
// different DAY on the two phones, which is the bug 🍜 Food already paid for
// once (see fdExifDate). Times are free text for the same reason — see
// supabase/calendar.sql.
//
// Needs supabase/calendar.sql. Until it's run the card says so and stays
// read-only, per golden rule 6.

const CAL_TABLE = "calendar_events";
const CAL_DOW = ["S", "M", "T", "W", "T", "F", "S"];

let calEvents = [];
let calReady = null;        // null unknown · true table exists · false needs the SQL
let calMonth = null;        // {y, m} the sheet is showing, m is 0-11
let calPickedDay = null;    // "YYYY-MM-DD" the sheet has open, or null
let calOpen = false;
// The last load failure, verbatim. Without it every failure looked identical
// to "the table isn't there", which sent Riu to re-run SQL he had already run.
let calError = null;

const calEl = id => document.getElementById(id);
function calMe() { return getHashParam("me") || null; }

// ---------------- dates as strings ----------------
function calPad(n) { return String(n).padStart(2, "0"); }
function calKey(y, m, d) { return y + "-" + calPad(m + 1) + "-" + calPad(d); }

// "Today" is the phone's own idea of today, deliberately. Each of us should see
// our own Monday highlighted, not the other's.
function calToday() {
  const n = new Date();
  return calKey(n.getFullYear(), n.getMonth(), n.getDate());
}

function calMonthOf(key) { return { y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) - 1 }; }

// Rendered from the parts, never through a Date, so the label can't drift a day.
const CAL_MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
function calMonthLabel(mo) { return CAL_MONTHS[mo.m] + " " + mo.y; }

function calPrettyDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  // UTC on purpose: the parts ARE the day, so anything zone-aware could shift it.
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined,
    { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function calDaysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
function calFirstDow(y, m) { return new Date(y, m, 1).getDay(); }

function calShift(mo, delta) {
  const d = new Date(mo.y, mo.m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
}

// ---------------- data ----------------
// Times are free text ("6am", "19:30", "after lunch"), so they can't be sorted
// as strings: "6am" lands after "10:00" alphabetically, which put the flight
// after the dentist. Pull a minute-of-day out of whatever was typed, and let
// anything unparseable — and anything untimed — fall to the end of the day.
const CAL_LATE = 24 * 60 + 1;

function calMinutes(at) {
  if (!at) return CAL_LATE;
  const m = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m|p\.?m)?/i.exec(at);
  if (!m) return CAL_LATE - 1;          // words only: before untimed, after clock times
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const half = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (half === "pm") h = (h % 12) + 12;
  else if (half === "am") h = h % 12;   // 12am is midnight
  // No am/pm: take it as typed, so a 24-hour clock stays a 24-hour clock.
  return h * 60 + min;
}

const calByTime = (a, b) => calMinutes(a.at) - calMinutes(b.at);

function calOn(key) {
  return calEvents.filter(e => e.day === key).sort(calByTime);
}

// The next few things coming up, today included. Sorted by day then time.
function calUpcoming(limit) {
  const today = calToday();
  return calEvents.filter(e => e.day >= today)
    .sort((a, b) => a.day === b.day ? calByTime(a, b) : a.day.localeCompare(b.day))
    .slice(0, limit);
}

async function calLoad() {
  if (!supaOn()) { calReady = false; calError = null; calRenderHome(); return; }
  try {
    calEvents = await supa(CAL_TABLE + "?select=*&order=day.asc") || [];
    calReady = true;
    calError = null;
  } catch (e) {
    calReady = false;
    calError = (e && e.message) || String(e);
  }
  calRenderHome();
  if (calOpen) calRenderSheet();
}

// What actually went wrong, in the words of whatever went wrong. Every branch
// here used to collapse into "run supabase/calendar.sql", which is only true
// for one of them — and is actively misleading once you HAVE run it.
function calWhyNot() {
  if (!supaOn()) return "Local mode — the calendar needs Supabase";
  if (typeof authSignedIn === "function" && !authSignedIn()) {
    return "Sign in to see our calendar 🔑";
  }
  const err = calError || "";
  // 404 = PostgREST hasn't noticed the table yet. It reloads its schema cache
  // on its own, but not always instantly, so "I ran it and nothing happened"
  // is usually this and usually fixed by waiting a moment and reloading.
  if (/40[34]/.test(err)) return "Table not visible yet — if you just ran supabase/calendar.sql, reload in a minute 📅";
  if (/401/.test(err)) return "Supabase refused that (401) — is the session still good?";
  if (err) return "Couldn't load the calendar — " + err + " · tap to retry";
  return "Run supabase/calendar.sql to switch this on 📅";
}

async function calAdd(fields) {
  // Optimistic, with a temp id, so the entry appears the instant you save it —
  // same trick as ⭐ Someday. The reload swaps in the real row.
  const temp = Object.assign({ id: "tmp" + Date.now() }, fields);
  calEvents.push(temp);
  calRenderHome(); calRenderSheet();
  if (!supaOn()) { popToast("Saved on this phone only — see docs/SUPABASE.md"); return; }
  try {
    const [row] = await supa(CAL_TABLE, { method: "POST", body: fields }) || [];
    if (row) Object.assign(temp, row);
    calReady = true;
  } catch (e) {
    calReady = false;
    popToast("Couldn't sync that — run supabase/calendar.sql 📅");
  }
  calRenderHome(); calRenderSheet();
}

async function calDelete(ev) {
  if (!confirm('Remove "' + ev.title + '" from ' + calPrettyDay(ev.day) + "?")) return;
  calEvents = calEvents.filter(x => x !== ev);
  calRenderHome(); calRenderSheet();
  if (!supaOn() || String(ev.id).startsWith("tmp")) return;
  try { await supa(CAL_TABLE + "?id=eq." + ev.id, { method: "DELETE" }); }
  catch (e) { popToast("Couldn't delete that 😢 (" + e.message + ")"); }
}

// One dot per person present, not per event — five dots in a 40px cell is a
// smudge, and "who" is the only thing at this size that can be read honestly.
//
// The row is ALWAYS appended, empty or not. Adding it only on busy days made
// those days taller by 6px, which nudged their numbers up and left the row of
// dates visibly wavy. A constant height keeps every number on one baseline.
function calDots(on) {
  const dots = document.createElement("i");
  dots.className = "cal-dots";
  ["riu", "lucia"].forEach(who => {
    if (!on.some(e => e.who === who)) return;
    const dot = document.createElement("b");
    dot.className = "cal-dot cal-" + who;
    dots.appendChild(dot);
  });
  return dots;
}

// ---------------- the Home card ----------------
// A real month, not a teaser: the point of a shared calendar is seeing whose
// week is busy without opening anything.
function calRenderHome() {
  const grid = calEl("calMini");
  const label = calEl("calMiniMonth");
  if (!grid || !label) return;

  const today = calToday();
  const mo = calMonthOf(today);
  // The month IS the card's title. It used to be a third line under "Our
  // calendar", which stacked a name, a month and a tap hint above a grid that
  // already says all three.
  label.textContent = calMonthLabel(mo);
  grid.innerHTML = "";

  CAL_DOW.forEach(d => {
    const h = document.createElement("span");
    h.className = "cal-dow";
    h.textContent = d;
    grid.appendChild(h);
  });
  for (let i = 0; i < calFirstDow(mo.y, mo.m); i++) {
    grid.appendChild(document.createElement("span"));
  }
  const days = calDaysIn(mo.y, mo.m);
  for (let d = 1; d <= days; d++) {
    const key = calKey(mo.y, mo.m, d);
    const cell = document.createElement("span");
    cell.className = "cal-mday" + (key === today ? " cal-today" : "");
    const n = document.createElement("i");
    n.textContent = d;
    cell.appendChild(n);
    cell.appendChild(calDots(calOn(key)));
    grid.appendChild(cell);
  }

  const next = calEl("calNext");
  if (next) {
    next.innerHTML = "";
    const soon = calUpcoming(2);
    if (calReady === false) {
      next.className = "cal-next cal-dim";
      next.textContent = calWhyNot();
    } else if (!soon.length) {
      next.className = "cal-next cal-dim";
      next.textContent = calReady === null ? "Loading…" : "Nothing planned yet — tap to add something 💞";
    } else {
      next.className = "cal-next";
      soon.forEach(e => next.appendChild(calLine(e, false)));
    }
  }
}

// One event, as a line. Used on the card and in the sheet's day panel.
function calLine(ev, withDelete) {
  const row = document.createElement("div");
  row.className = "cal-ev cal-" + ev.who;
  const when = document.createElement("span");
  when.className = "cal-evwhen";
  when.textContent = withDelete ? (ev.at || "—") : calPrettyDay(ev.day) + (ev.at ? " · " + ev.at : "");
  const what = document.createElement("span");
  what.className = "cal-evwhat";
  what.textContent = ev.title;
  row.append(when, what);
  if (ev.note) {
    const note = document.createElement("span");
    note.className = "cal-evnote";
    note.textContent = ev.note;
    row.appendChild(note);
  }
  if (withDelete) {
    const x = document.createElement("button");
    x.className = "cal-evx";
    x.textContent = "🗑️";
    x.title = "Remove this";
    x.addEventListener("click", () => calDelete(ev));
    row.appendChild(x);
  }
  return row;
}

// ---------------- the popout ----------------
function calOpenSheet(dayKey) {
  calOpen = true;
  calPickedDay = dayKey || calToday();
  calMonth = calMonthOf(calPickedDay);
  calEl("calSheet").classList.add("show");
  calRenderSheet();
  // Retry on every open while it's broken, not only the first time. A failure
  // at boot used to be permanent until a full reload — including the very
  // common one where you run the SQL with the app already open.
  if (calReady !== true) calLoad();
}

function calCloseSheet() {
  calOpen = false;
  calEl("calSheet").classList.remove("show");
}

function calRenderSheet() {
  if (!calOpen) return;
  const grid = calEl("calGrid");
  if (!grid) return;
  const today = calToday();
  calEl("calMonthLabel").textContent = calMonthLabel(calMonth);

  grid.innerHTML = "";
  CAL_DOW.forEach(d => {
    const h = document.createElement("span");
    h.className = "cal-dow";
    h.textContent = d;
    grid.appendChild(h);
  });
  for (let i = 0; i < calFirstDow(calMonth.y, calMonth.m); i++) {
    grid.appendChild(document.createElement("span"));
  }
  const days = calDaysIn(calMonth.y, calMonth.m);
  for (let d = 1; d <= days; d++) {
    const key = calKey(calMonth.y, calMonth.m, d);
    const cell = document.createElement("button");
    cell.className = "cal-day" +
      (key === today ? " cal-today" : "") +
      (key === calPickedDay ? " cal-picked" : "");
    const n = document.createElement("i");
    n.textContent = d;
    cell.appendChild(n);
    cell.appendChild(calDots(calOn(key)));
    cell.addEventListener("click", () => { calPickedDay = key; calRenderSheet(); });
    grid.appendChild(cell);
  }

  calEl("calDayTitle").textContent = calPrettyDay(calPickedDay);
  const list = calEl("calDayList");
  list.innerHTML = "";
  const on = calOn(calPickedDay);
  if (!on.length) {
    const empty = document.createElement("div");
    empty.className = "cal-dim";
    empty.textContent = "Nothing on this day yet.";
    list.appendChild(empty);
  } else {
    on.forEach(e => list.appendChild(calLine(e, true)));
  }
  calRenderWho();
  calEl("calStatus").textContent =
    calReady === false ? "⚠️ " + calWhyNot()
      : calReady === null ? "Loading…"
        : calEvents.length + (calEvents.length === 1 ? " entry · shared 💞" : " entries · shared 💞");
}

// Whose entry this will be. Shared with the duel and 20 Questions through
// `#me`, so picking a side once picks it everywhere.
function calRenderWho() {
  const me = calMe();
  document.querySelectorAll("#calWho .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.me === me));
  const save = calEl("calSave");
  if (save) save.disabled = !me;
  const hint = calEl("calWhoHint");
  if (hint) hint.textContent = me ? "" : "Say who you are first — that's what picks the colour";
}

function calSubmit() {
  const me = calMe();
  if (!me) { popToast("Pick who you are first 💁"); return; }
  const title = calEl("calTitle").value.trim();
  if (!title) { popToast("Give it a name 📅"); return; }
  const at = calEl("calAt").value.trim();
  const note = calEl("calNote").value.trim();
  calAdd({ day: calPickedDay, title, at: at || null, note: note || null, who: me });
  calEl("calTitle").value = "";
  calEl("calAt").value = "";
  calEl("calNote").value = "";
  burst(innerWidth / 2, innerHeight / 2, ["📅", "💞", "✨"]);
}

// ---------------- wiring ----------------
calEl("calCard").addEventListener("click", () => calOpenSheet());
calEl("calClose").addEventListener("click", calCloseSheet);
calEl("calSheet").addEventListener("click", (e) => {
  if (e.target === calEl("calSheet")) calCloseSheet();
});
calEl("calPrev").addEventListener("click", () => { calMonth = calShift(calMonth, -1); calRenderSheet(); });
calEl("calNextMonth").addEventListener("click", () => { calMonth = calShift(calMonth, 1); calRenderSheet(); });
calEl("calToday").addEventListener("click", () => {
  calPickedDay = calToday();
  calMonth = calMonthOf(calPickedDay);
  calRenderSheet();
});
calEl("calSave").addEventListener("click", calSubmit);
calEl("calTitle").addEventListener("keydown", (e) => { if (e.key === "Enter") calSubmit(); });
document.querySelectorAll("#calWho .chip").forEach(chip =>
  chip.addEventListener("click", () => { setHashParam("me", chip.dataset.me); calRenderWho(); }));
