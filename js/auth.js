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
// Refresh tokens can't be used without persisting them, so a session lasts as
// long as its access token. Treat it as expired a minute early rather than
// letting a request fail mid-flight.
const AUTH_SKEW_MS = 60 * 1000;

let authSession = null;     // { access_token, expires_at, email }
let authStorageOK = null;   // null = untested, then true/false

// ---------------- storage (best-effort, never fatal) ----------------
function authStorage() {
  if (authStorageOK === false) return null;
  try {
    const s = window.sessionStorage;
    if (authStorageOK === null) {         // probe once — Safari private mode throws on write
      s.setItem("lr_probe", "1");
      s.removeItem("lr_probe");
      authStorageOK = true;
    }
    return s;
  } catch (e) {
    authStorageOK = false;                // memory-only from here; sign-in still works
    return null;
  }
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

// The single accessor everything else uses. Returns null when signed out or
// expired, which is the signal for supa() to fall back to the anon key.
function authToken() {
  if (!authValid(authSession)) {
    if (authSession) authSave(null);   // expired — drop it
    return null;
  }
  return authSession.access_token;
}

function authEmail() { return authValid(authSession) ? authSession.email : null; }
function authSignedIn() { return !!authToken(); }

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
    expires_at: Date.now() + (expiresIn > 0 ? expiresIn : 3600) * 1000,
    email: email
  });
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
  who.textContent = !supaOn()
    ? "Local mode — no backend configured"
    : signedIn
      ? "Signed in as " + (authEmail() || "you") + " 💞"
      : "Not signed in — the app is running on its offline copy";
}

function authInit() {
  authCapture() || (authSession = authRestore());
  if (authSession && !authValid(authSession)) authSave(null);
  authRender();
}

document.getElementById("authSignIn").addEventListener("click", authSignIn);
document.getElementById("authSignOut").addEventListener("click", authSignOut);

// DELIBERATE EXCEPTION to "boot work goes in js/init.js": this one has to run
// at parse time, because two things that load before init.js depend on it.
// js/lock.js decides whether to raise the gate the moment it parses, and it
// should let a signed-in account straight through. And every getHashParam()
// anywhere would otherwise be reading a fragment still full of Supabase's
// tokens, because init.js runs last. Settling the session here — and scrubbing
// the URL — is the only ordering that works.
authInit();
