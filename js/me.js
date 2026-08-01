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

// ---------------- which account is which of us ----------------
// Two `settings` rows, `account_lucia` and `account_riu`, each holding a Google
// address. They ride the ONE boot fetch (loadSettings → meAdopt), so this costs
// no extra request, and `settings` is key/value so there's nothing to migrate.
//
// It's written by picking who you are in ⚙️ Settings while signed in — no
// second tap, no separate form. That's the whole feature: choose once, ever.
let meAccounts = {};                       // { lucia: "email", riu: "email" }

function meEmail() {
  return ((typeof authEmail === "function" && authEmail()) || "").trim().toLowerCase();
}

// The learned mapping wins; AUTH_ALLOWED in js/auth.js is the fallback for a
// phone that hasn't seen the settings rows yet (first boot, or offline).
//
// That fallback reads AUTH_ALLOWED **by position** — Riu is [0], Lucia is [1] —
// and it disables itself while the list still holds its `@example.com`
// placeholder. Once you've picked yourself once while signed in, none of that
// matters any more: the mapping in the database is what answers, and it's
// editable from Settings instead of from a code edit and a deploy.
function meFromAccount() {
  const email = meEmail();
  if (!email) return null;

  const learned = ME_PEOPLE.filter(w => meAccounts[w] === email)[0];
  if (learned) return learned;

  if (typeof AUTH_ALLOWED === "undefined") return null;
  if (typeof authAllowlistReady === "function" && !authAllowlistReady()) return null;
  const i = AUTH_ALLOWED.map(e => String(e).trim().toLowerCase()).indexOf(email);
  return i === 0 ? "riu" : i === 1 ? "lucia" : null;
}

// Remember this account as this person. Best-effort: a phone that can't reach
// the database still works off the hash for the session, and will simply learn
// the mapping the next time it can.
async function meRemember(who) {
  const email = meEmail();
  if (!email || !supaOn()) return;
  if (meAccounts[who] === email) return;              // already known

  meAccounts[who] = email;
  // One address can't be both of you. Swapping identity on a phone would
  // otherwise leave the app believing one email is Lucia AND Riu, and
  // meFromAccount() would answer with whichever it happened to scan first.
  const other = meOther(who);
  const dropOther = meAccounts[other] === email;
  if (dropOther) delete meAccounts[other];

  try {
    await supa("settings?on_conflict=key", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: { key: "account_" + who, value: email }
    });
    if (dropOther) await supa("settings?key=eq.account_" + other, { method: "DELETE" });
  } catch (e) { /* the hash still holds it for this session */ }
  meRender();
}

// Unlink this account, for a phone that was signed in as the wrong person.
async function meForget() {
  const who = meWho;
  if (!who || !meAccounts[who]) return;
  delete meAccounts[who];
  if (supaOn()) {
    try { await supa("settings?key=eq.account_" + who, { method: "DELETE" }); }
    catch (e) { popToast("Couldn't forget that — try again when you're online"); }
  }
  popToast("Unlinked 🔓 you'll be asked again next launch");
  meRender();
}

// Called from the ONE boot settings fetch in js/init.js. If nobody has been
// chosen yet, the mapping answers it — which is what makes a cold launch of
// the home-screen app (no hash at all, `start_url: "./"`) stop asking.
function meAdopt(rows) {
  (rows || []).forEach(r => {
    if (r.key === "account_lucia" || r.key === "account_riu") {
      const who = r.key.replace("account_", "");
      const val = String(r.value || "").trim().toLowerCase();
      if (val) meAccounts[who] = val; else delete meAccounts[who];
    }
  });
  if (!meWho) {
    const fromAccount = meFromAccount();
    if (fromAccount) { meSet(fromAccount, { quiet: true }); return; }
  }
  meRender();
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
  // Tapping the name you're already on is not a no-op: it's how you RE-link an
  // account you've unlinked, which is exactly what that hint tells you to do.
  if (who === meWho) {
    if (!quiet) { meRemember(who); meRender(); }
    return false;
  }

  if (!quiet) {
    const blocked = meLockReason();
    if (blocked) { popToast(blocked); return false; }
  }

  meWho = who;
  setHashParam("me", who);
  if (!quiet) {
    // The point of the whole feature: choosing is also remembering, so this is
    // the last time you're asked on this account.
    meRemember(who);
    popToast(meEmail()
      ? "You're " + meName(who) + " — remembered for this account 💞"
      : "You're " + meName(who) + " 💞");
  }
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
  const linked = meWho && meAccounts[meWho] && meAccounts[meWho] === meEmail();
  if (hint) {
    hint.textContent =
      locked ? locked
      : !meWho ? "Pick one — the calendar, the games and 📍 Location all use this"
      // Say the address out loud. "Remembered" on its own is a promise; naming
      // the account is something you can actually check.
      : linked ? meAccounts[meWho] + " is " + meName(meWho) + " — you won't be asked again 💞"
      : meFromAccount() === meWho ? "From the sign-in list in js/auth.js 💞"
      // Signed in but not linked — either mid-write, or just unlinked. Don't
      // claim to be saving: after a deliberate unlink that's simply untrue.
      : meEmail() ? "Not linked — tap your name again to remember it on this account"
      : "Lasts until the app is reopened. Sign in and it's remembered for good";
  }

  // Only offered when there's something to undo.
  const row = meEl("meForgetRow");
  if (row) row.style.display = linked ? "" : "none";
}

if (meEl("meWhoPick")) {
  document.querySelectorAll("#meWhoPick .chip").forEach(chip =>
    chip.addEventListener("click", () => meSet(chip.dataset.me)));
}
if (meEl("meForget")) meEl("meForget").addEventListener("click", meForget);
