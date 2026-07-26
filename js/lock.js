// lock.js — Lucia ♥ Riu
// The login gate. Password = our anniversary. A cute door, not security —
// the answer is in the source.

// ---------------- LOCK SCREEN ----------------
// Password = our anniversary (June 2, 2026), typed almost any way:
// 06/02/2026, 6/2/26, 060226, 0602, "june 2"... all accepted.
const LOCK_KEYS = ["0602", "602", "060226", "06022026", "622026", "6226"];
const LOCK_SASS = [
  "Nope 😗 Try again, stranger.",
  "Wrong!! Do you even love us? 😤",
  "Hint: it's our anniversary 😉",
  "Bigger hint: summer 2026, the day we became official 🌸",
  "Last hint: it's in June. One of us should know this 😌"
];
const lockEl = document.getElementById("lock");
const lockInput = document.getElementById("lockInput");
const lockHint = document.getElementById("lockHint");
let lockFails = 0;

function unlock(celebrate) {
  document.body.classList.remove("locked");
  if (!celebrate) { lockEl.remove(); return; }
  lockEl.classList.add("open");
  setTimeout(() => lockEl.remove(), 650);
  burst(innerWidth / 2, innerHeight / 2);
  popToast("Welcome home 💞");
}

// Stage 2: the date was right, now ask for the account. Shown only when there
// IS something to sign into — with Supabase off or unreachable, Google can't
// help and insisting on it would lock us out of an app that is supposed to
// work offline (golden rule 6). Same reason the skip button exists.
function lockShowStep2() {
  document.getElementById("lockStep1").style.display = "none";
  document.getElementById("lockStep2").style.display = "block";
  document.getElementById("lockStep2Hint").textContent =
    "Google decides; we just check the name on the list 😌";
}

function lockPassed() {
  // Remember stage 1 BEFORE any redirect: authSignIn() parks the hash in
  // ?rehash= and puts it back afterwards, so coming home from Google skips
  // straight past the date rather than asking for it twice.
  setHashParam("unlocked", "1");
  if (supaOn() && !(typeof authSignedIn === "function" && authSignedIn())) {
    lockShowStep2();
    return;
  }
  unlock(true);
}

function tryUnlock() {
  const digits = lockInput.value.replace(/\D/g, "");
  const text = lockInput.value.trim().toLowerCase();
  const keys = DB.lockKeys || LOCK_KEYS; // DB-managed password, hardcoded fallback
  const ok = keys.includes(digits) ||
    (text.includes("jun") && /(^|\D)0?2(\D|$)/.test(text));
  if (ok) { lockPassed(); return; }
  lockFails++;
  lockInput.value = "";
  lockInput.classList.remove("wrong");
  void lockInput.offsetWidth; // restart the shake animation
  lockInput.classList.add("wrong");
  lockHint.textContent = LOCK_SASS[Math.min(lockFails - 1, LOCK_SASS.length - 1)];
  lockInput.focus();
}

// A signed-in Google account on the allowlist is strictly stronger evidence
// than "knows the anniversary" — which is printed on the Home page and spelled
// out by this screen's own hints. So real auth skips the gate entirely; the
// anniversary stays as the offline/local-mode door.
document.getElementById("lockBtn").addEventListener("click", tryUnlock);
lockInput.addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });
document.getElementById("lockGoogle").addEventListener("click", () => authSignIn());
// The escape hatch stage 2 must always have: Supabase down, Google having a
// bad day, or a phone with no signal shouldn't cost us the whole app. It only
// hides the gate — signed out, the app is on its hardcoded copy anyway, and
// once auth_policies.sql is live there's nothing behind it to read.
document.getElementById("lockSkip").addEventListener("click", () => {
  // `guest` is what makes skipping stick. Without it a refresh would land on
  // `unlocked=1` with no session and ask for the account again, forever —
  // which is no kind of escape hatch.
  setHashParam("guest", "1");
  unlock(true);
  popToast("Browsing offline — sign in any time from up top 💞");
});

const lockSignedIn = typeof authSignedIn === "function" && authSignedIn();

if (lockSignedIn) {
  // Strictly stronger evidence than knowing the anniversary — which Home
  // displays and this screen's own hints spell out. Straight in.
  unlock(false);
} else if (getHashParam("guest") === "1") {
  unlock(false);                      // chose offline earlier; don't nag
} else if (getHashParam("unlocked") === "1") {
  // Stage 1 done, no account yet — the return leg of a sign-in that didn't
  // land. Don't ask for the date twice; go straight back to the account step.
  document.body.classList.add("locked");
  lockShowStep2();
} else {
  document.body.classList.add("locked");
  setTimeout(() => lockInput.focus(), 300);
}
