// push.js — Lucia ♥ Riu
// 🔔 "Tell me when she adds something."
//
// One toggle in ⚙️ Settings, and one function (`pushNotify`) that the three
// places worth interrupting someone for call after they've saved.
//
// ─────────────────────────────────────────────────────────── what iOS allows
// Web Push works on iPhone from iOS 16.4, and ONLY for a web app that's been
// added to the Home Screen — a Safari tab gets nothing at all, no API, no
// prompt. So the toggle explains that rather than sitting there doing nothing.
//
// Permission can only be asked for from a real tap, and iOS gives you exactly
// one chance: if it's denied there is no second prompt, and the only way back
// is iOS Settings. That's why this is a toggle you deliberately turn on and
// never something the app asks for on boot.
//
// ────────────────────────────────────────────────────── the notification text
// The push carries no payload (see api/notify.js), so every notification reads
// "Something new 💞" and the app shows what actually changed. Nothing about us
// passes through Apple's servers — which is the better half of that trade.
//
// ─────────────────────────────────────────────────────────────── golden rule 6
// `VAPID_PUBLIC` empty, no service worker support, not installed, signed out,
// or `supabase/push.sql` not run ⇒ the toggle says why and the rest of the app
// is untouched. `pushNotify()` is fire-and-forget and never awaited, so a dead
// endpoint can't stop a photo saving.

// Public half of the VAPID keypair. It ships in the page exactly like the
// Supabase anon key — it's an identifier, not a secret. The private half lives
// only in Vercel env. Generate both with the snippet in docs/SUPABASE.md.
const VAPID_PUBLIC = "";

const pushEl = id => document.getElementById(id);

// iOS only exposes the Push API to home-screen apps, so this doubles as the
// "have they installed it" check.
function pushInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone === true;
}

function pushSupported() {
  return !!VAPID_PUBLIC &&
         "serviceWorker" in navigator &&
         "PushManager" in window &&
         "Notification" in window;
}

// applicationServerKey wants raw bytes, not the base64url string.
function pushKeyBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// Kept in sync by pushRender() so the click handler can branch WITHOUT
// awaiting. Awaiting first would break the user-gesture tie that
// Notification.requestPermission() requires, and the failure is silent.
let pushOn = false;

let pushReg = null;
async function pushRegistration() {
  if (pushReg) return pushReg;
  pushReg = await navigator.serviceWorker.register("sw.js");
  return pushReg;
}

// null when we can't or shouldn't offer it; otherwise the current subscription.
async function pushCurrent() {
  if (!pushSupported()) return null;
  try {
    const reg = await pushRegistration();
    return await reg.pushManager.getSubscription();
  } catch (e) { return null; }
}


// ---------------- turning it on ----------------
// Must be called straight from a tap: Safari refuses a permission request that
// isn't tied to a user gesture, and `await` before it can lose that tie.
async function pushEnable() {
  if (!pushSupported() || !authSignedIn()) return;

  let permission = Notification.permission;
  if (permission === "default") permission = await Notification.requestPermission();
  if (permission !== "granted") {
    popToast(permission === "denied"
      ? "Notifications are off for this app — iOS Settings can turn them back on"
      : "Maybe next time 💞");
    pushRender();
    return;
  }

  try {
    const reg = await pushRegistration();
    const sub = await reg.pushManager.subscribe({
      // Required, and true is the only honest value: every push we send does
      // show a notification.
      userVisibleOnly: true,
      applicationServerKey: pushKeyBytes(VAPID_PUBLIC)
    });
    const json = sub.toJSON();
    await supa("push_subs?on_conflict=endpoint", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: {
        endpoint: json.endpoint,
        p256dh: (json.keys && json.keys.p256dh) || null,
        auth: (json.keys && json.keys.auth) || null,
        email: authEmail(),
        who: (typeof meGet === "function" ? meGet() : null)
      }
    });
    popToast("You'll know when she adds something 🔔");
  } catch (e) {
    // A subscription that exists in the browser but not in our table would go
    // permanently silent, so undo it rather than leave the two out of step.
    try { const s = await pushCurrent(); if (s) await s.unsubscribe(); } catch (e2) {}
    popToast(String(e.message || e).match(/relation|does not exist|404/)
      ? "Run supabase/push.sql once, then try again 🔔"
      : "Couldn't turn that on: " + (e.message || e));
  }
  pushRender();
}

async function pushDisable() {
  try {
    const sub = await pushCurrent();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      // Delete AFTER unsubscribing: if the row went first and unsubscribe
      // failed, the phone would keep receiving pushes we no longer know about.
      try { await supa("push_subs?endpoint=eq." + encodeURIComponent(endpoint), { method: "DELETE" }); }
      catch (e) { /* the sender prunes dead endpoints on its next send */ }
    }
    popToast("Quiet now 🤫");
  } catch (e) {
    popToast("Couldn't turn that off: " + (e.message || e));
  }
  pushRender();
}


// ---------------- the toggle ----------------
async function pushRender() {
  const row = pushEl("pushRow");
  if (!row) return;
  const btn = pushEl("pushBtn");
  const hint = pushEl("pushHint");

  // Never offer it where it can't work — say which of the reasons it is,
  // because "the button is missing" is not a diagnosis.
  if (!VAPID_PUBLIC) {
    row.style.display = "none";
    return;
  }
  row.style.display = "";

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    btn.style.display = "none";
    hint.textContent = pushInstalled()
      ? "This browser can't do notifications 🤷"
      : "Add the app to your Home Screen first — iPhone only allows notifications there";
    return;
  }
  if (!authSignedIn()) {
    btn.style.display = "none";
    hint.textContent = "Sign in first — a notification has to know whose phone this is";
    return;
  }
  if (Notification.permission === "denied") {
    btn.style.display = "none";
    // iOS gives no second prompt once denied, so this is the only way back —
    // and it's genuinely where the switch lives (Settings → Lucia ♥ Riu).
    hint.textContent = "Blocked — turn notifications back on in Settings → Lucia ♥ Riu";
    return;
  }

  const on = !!(await pushCurrent());
  pushOn = on;
  btn.style.display = "";
  btn.textContent = on ? "🔕 Turn off" : "🔔 Turn on";
  hint.textContent = on
    ? "This phone buzzes when she adds a photo, a wish or a plan 💞"
    : "Get a nudge when she adds a photo, a wish or a plan";
}


// ---------------- what callers use ----------------
// Fire and forget, always. A notification is a courtesy; it must never delay
// or fail the thing it's announcing, so this is never awaited and never
// throws. Call it AFTER the write has actually succeeded.
function pushNotify() {
  if (location.protocol === "file:") return;
  if (typeof authToken !== "function" || !authToken()) return;
  try {
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + authToken() },
      body: "{}"
    }).catch(() => {});
  } catch (e) { /* never let this surface */ }
}

if (pushEl("pushBtn")) {
  // No `await` before the branch: pushEnable() has to reach
  // Notification.requestPermission() while the tap is still the current task,
  // and any await in between loses that. pushOn is kept fresh by pushRender().
  pushEl("pushBtn").addEventListener("click", () => {
    if (pushOn) pushDisable(); else pushEnable();
  });
}
