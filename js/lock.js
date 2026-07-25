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
  setHashParam("unlocked", "1");
  lockEl.classList.add("open");
  setTimeout(() => lockEl.remove(), 650);
  burst(innerWidth / 2, innerHeight / 2);
  popToast("Welcome home 💞");
}

function tryUnlock() {
  const digits = lockInput.value.replace(/\D/g, "");
  const text = lockInput.value.trim().toLowerCase();
  const keys = DB.lockKeys || LOCK_KEYS; // DB-managed password, hardcoded fallback
  const ok = keys.includes(digits) ||
    (text.includes("jun") && /(^|\D)0?2(\D|$)/.test(text));
  if (ok) { unlock(true); return; }
  lockFails++;
  lockInput.value = "";
  lockInput.classList.remove("wrong");
  void lockInput.offsetWidth; // restart the shake animation
  lockInput.classList.add("wrong");
  lockHint.textContent = LOCK_SASS[Math.min(lockFails - 1, LOCK_SASS.length - 1)];
  lockInput.focus();
}

if (getHashParam("unlocked") === "1") {
  unlock(false); // already let in this session — no ceremony
} else {
  document.body.classList.add("locked");
  document.getElementById("lockBtn").addEventListener("click", tryUnlock);
  lockInput.addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });
  setTimeout(() => lockInput.focus(), 300);
}
