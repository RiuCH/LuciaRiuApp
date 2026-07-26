// answers.js — Lucia ♥ Riu  (task C1: Answer & compare ✍️)
//
// You both answer the day's question in your own words, and NEITHER answer
// appears until both are in. That's the whole feature: no peeking, so the
// second answer isn't shaped by the first.
//
// Locked once submitted, deliberately. The lock isn't a UI convention — the
// `answers` table has a unique index on (day, who), so a second attempt is
// refused by Postgres. If you want to change your mind, you get to live with
// having typed it, same as saying it out loud.
//
// Needs supabase/answers.sql run once. Until then the card says so and the
// question itself carries on exactly as before (golden rule 6).

const AC_MAX = 600;

let acToday = [];        // rows for today: [{ day, who, text }]
let acReady = null;      // null unknown · true table exists · false needs the SQL
let acSending = false;
let acLoadedDay = null;  // which day acToday describes

const acEl = id => document.getElementById(id);

// Which of us is on this phone. Shares the games' `#me` so you only ever pick
// a side once; if the signed-in address is recognisable we skip the asking.
function acMe() {
  if (typeof wdMe === "string" && wdMe) return wdMe;
  if (typeof authEmail === "function" && authEmail() && typeof AUTH_ALLOWED !== "undefined") {
    const i = AUTH_ALLOWED.indexOf(authEmail());
    if (i === 0) return "riu";
    if (i === 1) return "lucia";
  }
  return null;
}

const acThem = () => (acMe() === "riu" ? "lucia" : "riu");
const acName = who => (who === "riu" ? "Riu" : "Lucia");
const acRowFor = who => acToday.find(r => r.who === who) || null;

// ---------------- data ----------------
async function acLoad() {
  const day = dayNumber();
  if (!supaOn() || (typeof authSignedIn === "function" && !authSignedIn())) {
    acReady = null;               // not signed in: nothing to say yet, and nothing to load
    acRender();
    return;
  }
  try {
    acToday = await supa("answers?select=day,who,text&day=eq." + day) || [];
    acLoadedDay = day;
    acReady = true;
  } catch (e) {
    acReady = false;              // most likely: the migration hasn't been run
  }
  acRender();
}

async function acSubmit() {
  const me = acMe();
  const text = acEl("acInput").value.trim();
  if (!me) { popToast("Tell me who you are first 😌"); return; }
  if (!text) { popToast("Say something first ✍️"); return; }
  if (acRowFor(me)) { popToast("You've already answered today 🔒"); return; }
  acSending = true;
  acRender();
  try {
    await supa("answers", { method: "POST", body: { day: dayNumber(), who: me, text } });
    acEl("acInput").value = "";
    popToast(acRowFor(acThem()) ? "Both in — go read 💞" : "Locked in 🔒 Now nudge them");
  } catch (e) {
    // the unique index is the lock; a duplicate here means the other tab won
    popToast(/duplicate|conflict|409/i.test(e.message)
      ? "You'd already answered today 🔒"
      : "Couldn't save that: " + e.message);
  } finally {
    acSending = false;
    await acLoad();
  }
}

// Poll ONLY while it can change something: on Home, mine in, theirs not yet.
// Everything else in the app backs off when hidden, so this does too — a
// gentle 20s, and never at all once both answers are in.
let acTicks = 0;
setInterval(() => {
  if (activeTab !== "home" || acReady !== true) return;
  const me = acMe();
  if (!me || !acRowFor(me) || acRowFor(acThem())) return;   // nothing to wait for
  acTicks++;
  const every = document.hidden ? 3 : 1;                    // ~60s hidden, 20s visible
  if (acTicks % every === 0) acLoad();
}, 20000);

// ---------------- rendering ----------------
function acRender() {
  const box = acEl("acBox");
  if (!box) return;
  const me = acMe();
  const mine = me ? acRowFor(me) : null;
  const theirs = me ? acRowFor(acThem()) : null;
  const both = !!(mine && theirs);

  // who-am-I row, only until it's known
  acEl("acWho").style.display = me ? "none" : "flex";
  document.querySelectorAll("#acWho .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.me === me));

  // the composer
  const canWrite = !!me && acReady === true && !mine;
  acEl("acCompose").style.display = canWrite ? "block" : "none";
  acEl("acInput").disabled = acSending;
  acEl("acSend").disabled = acSending;
  acEl("acSend").textContent = acSending ? "Saving…" : "🔒 Lock it in";

  // the answers, or the reason you can't see them yet
  const list = acEl("acList");
  list.innerHTML = "";
  if (both) {
    [me, acThem()].forEach(who => {
      const row = document.createElement("div");
      row.className = "ac-answer" + (who === me ? " ac-mine" : "");
      const name = document.createElement("div");
      name.className = "ac-name";
      name.textContent = who === me ? "You" : acName(who);
      const text = document.createElement("div");
      text.className = "ac-text";
      text.textContent = acRowFor(who).text;
      row.append(name, text);
      list.appendChild(row);
    });
  }

  acEl("acStatus").textContent =
    acReady === false ? "Run supabase/answers.sql to turn this on"
    : (typeof authSignedIn === "function" && !authSignedIn()) ? "Sign in to answer together"
    : !me ? ""
    : both ? "Both in 💞"
    : mine ? "Locked in 🔒 waiting for " + acName(acThem()) + "…"
    : theirs ? acName(acThem()) + " has answered — your turn, no peeking 🙈"
    : acReady === true ? "Answer first, compare after." : "";

  box.classList.toggle("ac-both", both);
}

// ---------------- wiring ----------------
if (acEl("acSend")) {
  acEl("acSend").addEventListener("click", acSubmit);
  acEl("acInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) acSubmit();
  });
  acEl("acInput").setAttribute("maxlength", String(AC_MAX));
  document.querySelectorAll("#acWho .chip").forEach(chip =>
    chip.addEventListener("click", () => {
      if (typeof wdMe !== "undefined") wdMe = chip.dataset.me;
      setHashParam("me", chip.dataset.me);
      if (typeof renderWhoAmIRows === "function") renderWhoAmIRows();
      acRender();
      acLoad();
    }));
}

// Repaint when Home comes back, and roll over at midnight with the question.
function acDayRolled() {
  if (acLoadedDay !== null && acLoadedDay !== dayNumber()) { acToday = []; acLoad(); }
}
