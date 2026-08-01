// me.js — Lucia ♥ Riu
// 👤 Which of us is holding this phone. Nobody is ever asked: it comes from the
// Google account you signed in with.
//
// It used to be asked in four separate places — Word Duel, 20 Questions,
// ✍️ Answer & compare and 📅 the calendar each carried their own "I'm playing
// as" row, all setting the same `#me`, while 📍 Location simply refused to work
// until you'd found one of them. Then it became one picker in ⚙️ Settings. Now
// there is no picker at all, which is better: the app already knows who signed
// in, so asking was always a question it could answer itself.
//
// ───────────────────────────────────────────────────── where the mapping lives
// Two `settings` rows, `account_lucia` and `account_riu`, each holding one
// Google address. They ride the ONE boot fetch (loadSettings → meAdopt), so
// this costs no extra request, and `settings` is key/value so there is nothing
// to migrate.
//
// You set them in ⚙️ Settings → 👥 Who can sign in: every allowed address gets
// a dropdown saying which of you it is. That's deliberately the same screen
// that decides who may sign in at all — one list of people, one place to say
// who they are — and it means either of you can assign BOTH addresses from
// your own phone, which the old self-service picker could never do.
//
// `AUTH_ALLOWED` in js/auth.js remains a fallback for a phone that hasn't seen
// those rows yet. It reads **by position — Riu [0], Lucia [1]** — and disables
// itself while the list still holds its `@example.com` placeholder. The
// learned mapping always wins.
//
// ────────────────────────────────────────────────────────── the offline case
// Signed out there is no account to read, so `#me=lucia|riu` in the URL is the
// only answer available and there is no UI to set it. That's a deliberate
// trade: everything this identity feeds (the calendar, the shared games,
// 📍 Location) needs the database anyway, and the database needs a sign-in.
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
// Person-keyed on purpose: `account_riu` holds ONE address, so "one person has
// one account" is enforced by the shape rather than by code. The other
// direction — one address is only ever one person — is the bit meAssign() has
// to enforce itself.
let meAccounts = {};                       // { lucia: "email", riu: "email" }

function meEmail() {
  return ((typeof authEmail === "function" && authEmail()) || "").trim().toLowerCase();
}

// The learned mapping wins; AUTH_ALLOWED in js/auth.js is the fallback for a
// phone that hasn't seen the settings rows yet (first boot, or offline).
//
// That fallback reads AUTH_ALLOWED **by position** — Riu is [0], Lucia is [1] —
// and it disables itself while the list still holds its `@example.com`
// placeholder. Once an address has been assigned in 👥 Who can sign in, none of
// that matters any more: the mapping in the database is what answers, and
// changing it is a dropdown instead of a code edit and a deploy.
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

// Who is this address, if anyone.
function meWhoFor(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return null;
  return ME_PEOPLE.filter(w => meAccounts[w] === e)[0] || null;
}

// THE one writer of the mapping, used by the dropdowns in 👥 Who can sign in.
// `who` is "lucia" | "riu" | "" (unassign).
//
// Storage is person-keyed, so "one person has one account" needs no code —
// writing account_riu simply replaces whatever it held. The other direction is
// what this has to enforce: if the address being assigned is currently the
// OTHER person, that row has to go, or meFromAccount() would answer with
// whichever of the two it happened to scan first.
async function meAssign(email, who) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  if (who && ME_PEOPLE.indexOf(who) === -1) return false;

  const was = meWhoFor(e);
  if (was === (who || null)) return false;

  // Changing who *this phone* is mid-game is the thing the duel's side lock
  // exists to stop. Reassigning somebody else's address is none of its business.
  const touchesMe = (e === meEmail()) || was === meWho || who === meWho;
  if (touchesMe) {
    const blocked = meLockReason();
    if (blocked) { popToast(blocked); meRender(); return false; }
  }

  const clears = [];
  if (was) { delete meAccounts[was]; clears.push(was); }
  // this person may have pointed at a different address — that's fine, the
  // write below replaces it
  if (who) meAccounts[who] = e;

  if (supaOn()) {
    try {
      if (who) {
        await supa("settings?on_conflict=key", {
          method: "POST", prefer: "resolution=merge-duplicates",
          body: { key: "account_" + who, value: e }
        });
      }
      for (const gone of clears) {
        if (gone !== who) await supa("settings?key=eq.account_" + gone, { method: "DELETE" });
      }
    } catch (err) {
      popToast("Couldn't save that — try again when you're online");
    }
  }

  // If that was about the phone in your hand, follow it immediately rather
  // than waiting for the next launch.
  if (e === meEmail()) {
    const now = meFromAccount();
    if (now !== meWho) { meWho = now; if (now) setHashParam("me", now); }
    meBroadcast();
  } else {
    meRender();
  }
  popToast(who ? e + " is " + meName(who) + " 💞" : "Unassigned " + e);
  return true;
}

// A <select> for one address, for js/auth.js to drop into its allowlist rows.
// It lives here because identity is this file's to own — auth.js renders the
// list, me.js says what the choice means.
function meAssignSelect(email) {
  const sel = document.createElement("select");
  sel.className = "fd-select me-assign";
  sel.dataset.email = String(email || "").trim().toLowerCase();
  sel.title = "Which of us is " + email + "?";
  [["", "— who?"], ["lucia", "Lucia"], ["riu", "Riu"]].forEach(([val, label]) => {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = label;
    sel.appendChild(o);
  });
  sel.value = meWhoFor(email) || "";
  sel.addEventListener("change", () => meAssign(email, sel.value));
  return sel;
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

// ---------------- keeping the dropdowns honest ----------------
// There is no picker to paint any more — the only identity UI is the row of
// dropdowns inside 👥 Who can sign in, and that panel is usually closed.
//
// The name stays because it is called from meBroadcast(), from meAdopt(), and
// from renderWhoAmIRows() in js/duel.js. Deleting a function that js/init.js
// reaches transitively is precisely the trap the skill warns about, and the
// job it does now is real: a duel starting mid-session is what greys these
// out, so they have to be repainted when it does.
function meRender() {
  const list = meEl("authAllowList");
  if (!list) return;
  const locked = meLockReason();
  list.querySelectorAll("select.me-assign").forEach(sel => {
    sel.value = meWhoFor(sel.dataset.email) || "";
    // Reassigning somebody ELSE's address mid-duel is harmless; only the row
    // that would move the phone in your hand is frozen.
    const mine = sel.dataset.email === meEmail();
    sel.disabled = !!locked && mine;
    sel.title = sel.disabled ? locked : "Which of us is " + sel.dataset.email + "?";
  });
}
