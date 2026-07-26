// auth.js — Lucia ♥ Riu
// Google sign-in through Supabase Auth, with no SDK and no build step.
//
// WHY THE IMPLICIT FLOW (and not PKCE, which is otherwise the better choice):
// PKCE has to stash a `code_verifier` between redirecting out to Google and
// coming back, and the only places to stash it are localStorage or
// sessionStorage. Golden rule 2 forbids that, so PKCE can't even start. The
// implicit flow hands the tokens straight back in the URL fragment instead.
//
// That fragment is the one place golden rule 2 says private data must never
// live — it shows in the address bar and travels in any copied link, and an
// access token is a bearer credential. So authCapture() reads it into memory
// and immediately rewrites the URL with history.replaceState(). The token is
// in the address bar for the length of one synchronous function call.
//
// SESSION PERSISTENCE — the one agreed carve-out to golden rule 2:
// the session (and ONLY the session) may sit in sessionStorage, so a refresh
// doesn't bounce you through Google again. Everything else the app stores
// still obeys the rule. sessionStorage is feature-detected and every access is
// wrapped: rule 2 exists because storage breaks in some of the preview
// environments we use, so if it throws we fall back to a plain in-memory
// session and the app keeps working — you just re-auth on refresh.
//
// FALLBACK-FIRST, as ever (golden rule 6): with no session, supa() falls back
// to the anon key. That's what lets this ship BEFORE supabase/auth_policies.sql
// is run — the app works under the old wide-open policies and the new locked
// ones, so the deploy and the lockdown don't have to be simultaneous.

// The two of us — for the "wrong account" message only.
//
// ⚠️ THIS LIST EXISTS TWICE, and the copies do different jobs. The one that
// actually protects anything is public.is_us() in supabase/auth_policies.sql:
// it runs inside Postgres, where nobody can reach it, and it is what makes a
// stranger's session return zero rows.
//
// THIS copy runs on the phone and is COSMETIC. Without it, someone signing in
// with the wrong Google account sees an app that looks broken rather than one
// that refuses them. Anyone can delete it in devtools and gain exactly
// nothing, because the database still won't hand them a single row. Never
// treat it as a control.
//
// If either of us changes Google account, edit BOTH: forgetting the SQL one
// locks you out of your own data; forgetting this one only mislabels a toast.
const AUTH_ALLOWED = [
  "rew.cherdchu@gmail.com",
  "lucia@example.com"          // ← replace with Lucia's Google address
];

// Until AUTH_ALLOWED is actually filled in, the check disables itself.
// A placeholder left in place would reject Lucia's real address with the very
// message this exists to avoid — a cosmetic nicety must never be the thing
// that locks somebody out. public.is_us() in the SQL is unaffected either way;
// that one is the real gate and it fails CLOSED on purpose.
function authAllowlistReady() {
  return !AUTH_ALLOWED.some(e => e.endsWith("@example.com"));
}

const AUTH_STORE_KEY = "lr_session";
// Treat the access token as expired a minute early rather than letting a
// request fail mid-flight, and start renewing it five minutes out.
const AUTH_SKEW_MS = 60 * 1000;
const AUTH_RENEW_AHEAD_MS = 5 * 60 * 1000;

let authSession = null;     // { access_token, refresh_token, expires_at, email }
let authStore = undefined;  // undefined = untested, then a Storage or null
let authRenewTimer = null;

// ---------------- storage (best-effort, never fatal) ----------------
// localStorage FIRST, and that's the whole point of the refresh-token work:
// sessionStorage dies with the tab, so an Add-to-Home-Screen app that iOS
// kills in the background would ask for Google again on every open — which is
// the exact complaint this is meant to fix. localStorage survives that.
//
// This widens the golden-rule-2 carve-out from sessionStorage to localStorage.
// The technical risk is identical (both throw in the same locked-down
// browsers, and both are probed below); what changes is that a refresh token
// now sits on the device. That's the standard posture — supabase-js itself
// defaults to localStorage — and the honest threat model is that anyone who
// can unlock the phone already has the app. Downgrade the order below to
// sessionStorage if you'd rather trade the convenience back.
function authStorage() {
  if (authStore !== undefined) return authStore;
  authStore = null;
  for (const kind of ["localStorage", "sessionStorage"]) {
    try {
      const s = window[kind];
      s.setItem("lr_probe", "1");         // Safari private mode throws on WRITE, not access
      s.removeItem("lr_probe");
      authStore = s;
      break;
    } catch (e) { /* try the next one, then give up and stay in memory */ }
  }
  return authStore;
}

function authSave(session) {
  authSession = session;
  const s = authStorage();
  if (!s) return;
  try {
    if (session) s.setItem(AUTH_STORE_KEY, JSON.stringify(session));
    else s.removeItem(AUTH_STORE_KEY);
  } catch (e) { /* quota or a locked-down browser — memory copy still stands */ }
}

function authRestore() {
  const s = authStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(AUTH_STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// ---------------- the session ----------------
function authValid(session) {
  return !!(session && session.access_token &&
            session.expires_at && Date.now() < session.expires_at - AUTH_SKEW_MS);
}


// ---------------- renewal ----------------
// Supabase hands back a refresh_token alongside the access token and we now
// keep it, so a session lasts weeks of quiet renewals instead of one hour.
//
// authPending is the promise of an in-flight renewal. supa() awaits it (see
// js/supabase.js) so a request that fires mid-renewal waits for the new token
// instead of going out with a dead one — which matters on boot, where init.js
// starts half a dozen fetches immediately.
let authPending = null;

async function authRenew() {
  const rt = authSession && authSession.refresh_token;
  if (!rt || !supaOn()) { authSave(null); return false; }
  try {
    const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt })
    });
    if (!res.ok) throw new Error("refresh " + res.status);
    const data = await res.json();
    if (!data || !data.access_token) throw new Error("no token back");
    authSave({
      access_token: data.access_token,
      // Supabase ROTATES the refresh token — storing the new one is what keeps
      // the chain alive. Keep the old one only if it declines to send a new.
      refresh_token: data.refresh_token || rt,
      expires_at: Date.now() + (data.expires_in > 0 ? data.expires_in : 3600) * 1000,
      email: (data.user && data.user.email) || authEmailFromJWT(data.access_token)
    });
    authScheduleRenew();
    return true;
  } catch (e) {
    // Expired, revoked, or rotated out from under us by another tab. There is
    // no recovering without the user, so drop it and let them sign in again.
    authSave(null);
    authRender();
    return false;
  }
}

// One renewal at a time; everyone else awaits the same promise.
function authEnsureFresh() {
  if (authPending) return authPending;
  if (!authSession || !authSession.refresh_token) return Promise.resolve(false);
  if (authValid(authSession) &&
      Date.now() < authSession.expires_at - AUTH_RENEW_AHEAD_MS) {
    return Promise.resolve(true);         // still comfortably fresh
  }
  authPending = authRenew().finally(() => { authPending = null; });
  return authPending;
}

function authScheduleRenew() {
  clearTimeout(authRenewTimer);
  if (!authSession || !authSession.refresh_token) return;
  const due = authSession.expires_at - Date.now() - AUTH_RENEW_AHEAD_MS;
  authRenewTimer = setTimeout(authEnsureFresh, Math.max(15000, due));
}

// Phones freeze timers in backgrounded tabs, so the scheduled renewal above
// may simply not have fired while the app sat in the background for a day.
// Catch up the moment we're looked at again — same reason the pollers do it.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) authEnsureFresh();
});
window.addEventListener("focus", authEnsureFresh);

// "Do I have a token I can use RIGHT NOW?" — strict. Null is the signal for
// supa() to fall back to the anon key.
//
// It used to bin any expired session on sight, which quietly defeated the
// whole point of refresh tokens: reopening the app an hour later called
// authRender() → authSignedIn() → here, and the session was destroyed a tick
// before the renewal that would have saved it. Now a session with a refresh
// token is left alone while authEnsureFresh() does its work; only one with
// nothing left to renew with gets dropped.
function authToken() {
  if (!authValid(authSession)) {
    if (authSession && !authSession.refresh_token) authSave(null);
    return null;
  }
  return authSession.access_token;
}

// "Is there a session at all?" — deliberately looser than authToken(),
// because a token that's merely stale is still a signed-in user as long as it
// can be renewed. Without this, reopening the app after an hour would flash
// (or stick on) the login screen, since js/lock.js decides the gate from here.
// If a renewal then fails, authRenew() clears the session and re-renders.
function authSignedIn() {
  return !!(authToken() || (authSession && authSession.refresh_token));
}

function authEmail() { return authSession ? authSession.email : null; }

// ---------------- the redirect dance ----------------
function authRedirectTarget() {
  // Where Supabase sends the browser back to. Must exactly match one of the
  // entries in Supabase → Authentication → URL Configuration → Redirect URLs.
  return location.origin + location.pathname;
}

function authSignIn() {
  if (!supaOn()) { popToast("No backend configured — nothing to sign into 😌"); return; }
  if (location.protocol === "file:") {
    // OAuth can't redirect back to a file:// page, so a double-clicked
    // index.html can never complete sign-in. It still runs offline on the
    // hardcoded fallbacks — say so instead of bouncing to a broken redirect.
    popToast("Sign-in needs the real site — open lucia-riu-app.vercel.app 💞");
    return;
  }
  // The round trip destroys our fragment: Supabase overwrites it wholesale
  // with its tokens, so #unlocked, #me, #reunion and #photo would all be lost
  // and you'd land back on the lock screen having forgotten which side you
  // play. The QUERY string does survive, so park them there and put them back
  // in authCapture(). (Only our own params — never a token.)
  const carry = (location.hash || "").replace(/^#/, "");
  const target = authRedirectTarget() + (carry ? "?rehash=" + encodeURIComponent(carry) : "");
  location.href = SUPABASE_URL + "/auth/v1/authorize?provider=google&redirect_to=" +
    encodeURIComponent(target);
}

// Drop the local session and best-effort tell Supabase to kill it too. Shared
// by the sign-out button and the wrong-account path, which both need the token
// gone here AND the refresh token invalidated there — otherwise a rejected
// account keeps a live server-side session it can never use, and Google
// silently re-authorises it on the next attempt.
function authRevoke(token) {
  authSave(null);
  if (token && supaOn()) {
    fetch(SUPABASE_URL + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
    }).catch(() => {});   // the local session is already gone either way
  }
  authRender();
}

function authSignOut() {
  authRevoke(authToken());
  popToast("Signed out 👋");
}

// Read the tokens Supabase appended to the fragment, then scrub the URL.
// Returns true if this page load was an OAuth return trip.
function authCapture() {
  const hash = location.hash || "";
  if (hash.indexOf("access_token=") === -1 && hash.indexOf("error=") === -1) return false;

  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const token = p.get("access_token");
  const expiresIn = parseInt(p.get("expires_in"), 10);
  const err = p.get("error_description") || p.get("error");

  // Scrub FIRST, unconditionally — a bearer token must not survive in the
  // address bar, in history, or in a link someone copies, even if what came
  // back was an error we're about to bail on. The same rewrite restores the
  // app's own hash params that authSignIn() parked in ?rehash= and drops that
  // query string, so the URL ends up exactly as it looked before sign-in.
  const parked = new URLSearchParams(location.search).get("rehash");
  history.replaceState(null, "", location.pathname + (parked ? "#" + parked : ""));

  if (err) { popToast("Google sign-in failed: " + err); return true; }
  if (!token) return true;

  // the JWT's payload is base64url and readable client-side; we only want the
  // email, so a parse failure is harmless — see the null case below
  const email = authEmailFromJWT(token);

  // Wrong Google account? Say so, instead of handing them an app that loads
  // perfectly and is empty in every panel. Cosmetic only — see AUTH_ALLOWED.
  // A null email means we couldn't parse the JWT, which is our problem and not
  // theirs, so let it through: public.is_us() is what decides either way.
  if (authAllowlistReady() && email && !AUTH_ALLOWED.includes(email)) {
    authRevoke(token);
    popToast("That's not one of our accounts 😌");
    return true;
  }

  authSave({
    access_token: token,
    refresh_token: p.get("refresh_token") || null,   // the thing that keeps you signed in
    expires_at: Date.now() + (expiresIn > 0 ? expiresIn : 3600) * 1000,
    email: email
  });
  authScheduleRenew();
  return true;
}

function authEmailFromJWT(token) {
  try {
    const body = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(body)).email || null;
  } catch (e) { return null; }
}

// ---------------- UI ----------------
function authRender() {
  const bar = document.getElementById("authBar");
  if (!bar) return;
  const who = document.getElementById("authWho");
  const inBtn = document.getElementById("authSignIn");
  const outBtn = document.getElementById("authSignOut");
  const signedIn = authSignedIn();

  bar.classList.toggle("auth-on", signedIn);
  inBtn.style.display = signedIn ? "none" : "inline-block";
  outBtn.style.display = signedIn ? "inline-block" : "none";
  document.getElementById("authWhoCan").style.display = signedIn ? "inline-block" : "none";
  if (!signedIn) document.getElementById("authAllowPanel").style.display = "none";
  who.textContent = !supaOn()
    ? "Local mode — no backend configured"
    : signedIn
      ? "Signed in as " + (authEmail() || "you") + " 💞"
      : "Not signed in — the app is running on its offline copy";
}

function authInit() {
  authCapture() || (authSession = authRestore());

  // An expired access token is no longer the end of the session — if we still
  // hold a refresh token, this is the ordinary case after the app has been
  // closed for a while, and renewing is the whole point. Only give up when
  // there's nothing left to renew WITH.
  if (authSession && !authValid(authSession) && !authSession.refresh_token) {
    authSave(null);
  }
  if (authSession && authSession.refresh_token) {
    // Kick it off now and let supa() await it, so the boot fetches in
    // init.js don't race out carrying a stale token.
    authEnsureFresh().then(authRender);
    authScheduleRenew();
  }
  authRender();
}

document.getElementById("authSignIn").addEventListener("click", authSignIn);
document.getElementById("authSignOut").addEventListener("click", authSignOut);

// ---------------- WHO CAN SIGN IN ----------------
// The `allowed_emails` table backs the Before User Created hook in
// supabase/allowlist.sql — a row here is what lets a Google account create an
// auth user at all. Editing it needs no special credential: it's an ordinary
// table behind the same "us only" RLS as everything else, so the JWT we
// already carry is enough. (Deliberately NOT the Supabase Management API,
// whose token can delete the whole project — see the comment in allowlist.sql.)
//
// Until allowlist.sql has been run, the table doesn't exist and every call
// 404s. That's the expected pre-migration state, so it says so rather than
// looking broken.
const authAllowPanel = document.getElementById("authAllowPanel");

async function authAllowLoad() {
  const list = document.getElementById("authAllowList");
  const hint = document.getElementById("authAllowHint");
  list.innerHTML = "";
  hint.textContent = "Loading…";
  try {
    const rows = await supa("allowed_emails?select=email,note&order=added_at.asc");
    list.innerHTML = "";
    (rows || []).forEach(r => {
      const row = document.createElement("div");
      row.className = "auth-allow-row";
      const who = document.createElement("span");
      who.textContent = r.note ? r.note + " · " + r.email : r.email;
      const del = document.createElement("button");
      del.textContent = "✕";
      del.title = "Remove";
      del.addEventListener("click", () => authAllowRemove(r.email));
      row.appendChild(who);
      row.appendChild(del);
      list.appendChild(row);
    });
    hint.textContent = rows && rows.length
      ? "Anyone not on this list is refused at sign-up. Removing someone does NOT sign them out — they keep access until their session expires."
      : "Empty list = everyone allowed, on purpose: an empty table is far more likely to be a botched migration than a decision to lock us both out.";
  } catch (e) {
    hint.textContent = "Can't read the list — has supabase/allowlist.sql been run yet?";
  }
}

async function authAllowAdd() {
  const input = document.getElementById("authAllowInput");
  const email = input.value.trim().toLowerCase();
  if (!email || email.indexOf("@") === -1) { popToast("That's not an email 🤨"); return; }
  try {
    await supa("allowed_emails?on_conflict=email", {
      method: "POST", prefer: "resolution=merge-duplicates", body: { email: email }
    });
    input.value = "";
    popToast("Added — they can sign in now 💞");
    authAllowLoad();
  } catch (e) { popToast("Couldn't add that one 😕"); }
}

async function authAllowRemove(email) {
  if (email === authEmail()) { popToast("That's you. Removing yourself is a bad plan 😅"); return; }
  try {
    await supa("allowed_emails?email=eq." + encodeURIComponent(email), { method: "DELETE" });
    popToast("Removed 👋");
    authAllowLoad();
  } catch (e) { popToast("Couldn't remove that one 😕"); }
}

document.getElementById("authWhoCan").addEventListener("click", () => {
  const open = authAllowPanel.style.display !== "none";
  authAllowPanel.style.display = open ? "none" : "block";
  if (!open) authAllowLoad();
});
document.getElementById("authAllowAdd").addEventListener("click", authAllowAdd);
document.getElementById("authAllowInput").addEventListener("keydown", e => {
  if (e.key === "Enter") authAllowAdd();
});


// DELIBERATE EXCEPTION to "boot work goes in js/init.js": this one has to run
// at parse time, because two things that load before init.js depend on it.
// js/lock.js decides whether to raise the gate the moment it parses, and it
// should let a signed-in account straight through. And every getHashParam()
// anywhere would otherwise be reading a fragment still full of Supabase's
// tokens, because init.js runs last. Settling the session here — and scrubbing
// the URL — is the only ordering that works.
authInit();
