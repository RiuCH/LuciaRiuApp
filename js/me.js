// me.js — Lucia ♥ Riu
// 👤 Which of us is holding this phone. Asked ONCE, in ⚙️ Settings — and
// usually not asked at all.
//
// It used to be asked in four separate places: Word Duel, 20 Questions,
// ✍️ Answer & compare and 📅 the calendar each carried their own "I'm playing
// as" row, all setting the same `#me`, and 📍 Location just refused to work
// until you'd found one of them. One question, four spellings of it.
//
// ─────────────────────────────────────────── why a picker alone wasn't enough
// `#me` is a hash param (golden rule 2 — no storage), and `manifest.webmanifest`
// sets `start_url: "./"`. So every COLD LAUNCH of the home-screen app starts
// with no hash, and the answer was gone again. Moving the picker to Settings
// would have moved the nagging, not ended it.
//
// So when you're signed in we don't ask: the Google address already says who
// you are. `AUTH_ALLOWED` in js/auth.js lists the two of us **in order — Riu
// first, Lucia second** — and that ordering is what `meFromAccount()` reads.
// (`acMe()` in js/answers.js relied on the same trick; that copy is gone now.)
// Nothing is stored and nothing is written: it's re-derived every launch, so
// there's no state to migrate and none to go stale.
//
// The picker is still there for the cases the account can't cover — signed
// out, offline, or `AUTH_ALLOWED` still carrying its placeholder — and the
// hash still holds the answer for the session. Golden rule 6 in miniature:
// the account makes it nicer, its absence doesn't break it.
//
// `meWho` is the one variable. It was called `wdMe` and lived in js/duel.js,
// which is why js/where.js used to reach into the duel to ask who you were;
// identity was never the duel's to own.

const ME_PEOPLE = ["lucia", "riu"];

// Hash first: it's the only answer available before auth has restored, and on
// a signed-out phone it's the only one there is.
let meWho = getHashParam("me") || null;

const meEl = id => document.getElementById(id);
function meName(w) { return w === "lucia" ? "Lucia" : w === "riu" ? "Riu" : null; }
function meOther(w) { return w === "lucia" ? "riu" : "lucia"; }
function meGet() { return meWho; }

// Riu is AUTH_ALLOWED[0], Lucia is AUTH_ALLOWED[1]. That ordering is load
// bearing — if you reorder that array, you swap the two of you everywhere.
// Returns null rather than guessing when the list still has its placeholder:
// mislabelling which of you added something is worse than asking once.
function meFromAccount() {
  if (typeof AUTH_ALLOWED === "undefined") return null;
  if (typeof authAllowlistReady === "function" && !authAllowlistReady()) return null;
  const email = ((typeof authEmail === "function" && authEmail()) || "").trim().toLowerCase();
  if (!email) return null;
  const i = AUTH_ALLOWED.map(e => String(e).trim().toLowerCase()).indexOf(email);
  return i === 0 ? "riu" : i === 1 ? "lucia" : null;
}

// ---------------- vetoes ----------------
// A tab can refuse an identity change by pushing a function that returns a
// reason. Word Duel uses it: you can't swap sides mid-match. The rule stays in
// js/duel.js, where it's true — me.js doesn't need to know duels exist.
const ME_LOCKS = [];
function meLockReason() {
  for (const check of ME_LOCKS) {
    const reason = typeof check === "function" && check();
    if (reason) return reason;
  }
  return null;
}

// ---------------- setting it ----------------
// `quiet` skips the veto and the toast — for adopting what the account already
// told us, which isn't a choice anyone is making.
function meSet(who, opts) {
  if (ME_PEOPLE.indexOf(who) === -1) return false;
  const quiet = !!(opts && opts.quiet);
  if (who === meWho) { if (!quiet) meRender(); return false; }

  if (!quiet) {
    const blocked = meLockReason();
    if (blocked) { popToast(blocked); return false; }
  }

  meWho = who;
  setHashParam("me", who);
  if (!quiet) popToast("You're " + meName(who) + " 💞");
  meBroadcast();
  return true;
}

// Called from js/init.js once auth has had its chance to restore a session.
// The hash wins if it's already set — you may have deliberately opened the app
// as the other person to check what they see.
function meInit() {
  if (!meWho) {
    const fromAccount = meFromAccount();
    if (fromAccount) meSet(fromAccount, { quiet: true });
  }
  meRender();
}

// One identity, several tabs drawing it. Every call is feature-detected and
// individually caught: the app has to survive any one of these being absent or
// throwing — js/init.js has been felled by exactly that once already (see
// "grep js/init.js when you delete a function" in the skill).
function meBroadcast() {
  ["meRender", "wdRenderAll", "q20Render", "acRender", "calRenderWho",
   "calRenderSheet", "whRender", "mnRender", "sdRender"].forEach(fn => {
    try { if (typeof window[fn] === "function") window[fn](); }
    catch (e) { console.warn("me: " + fn + " failed", e); }
  });
}

// ---------------- the picker in ⚙️ Settings ----------------
function meRender() {
  if (!meEl("meWhoPick")) return;
  const locked = meLockReason();
  document.querySelectorAll("#meWhoPick .chip").forEach(c => {
    c.classList.toggle("sel", c.dataset.me === meWho);
    // dimmed but still tappable — the handler explains why it won't budge
    c.classList.toggle("wd-fixed", !!locked && c.dataset.me !== meWho);
  });

  const hint = meEl("meWhoHint");
  if (!hint) return;
  hint.textContent =
    locked ? locked
    : !meWho ? "Pick one — the calendar, the games and 📍 Location all use this"
    : meFromAccount() === meWho ? "From your Google account — no need to pick again 💞"
    : "Lasts until the app is reopened. Sign in and it's remembered for good";
}

if (meEl("meWhoPick")) {
  document.querySelectorAll("#meWhoPick .chip").forEach(chip =>
    chip.addEventListener("click", () => meSet(chip.dataset.me)));
}
