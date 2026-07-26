// money.js — Lucia ♥ Riu
// 💸 The pot, and what each plan would cost.
//
// A POT, not Splitwise. Every row is a `topup` (money in) or a `spend` (money
// out) and the pot is the difference — one number, no shares, no debts, no
// settling up. That was a deliberate decision (roadmap #3): we want to answer
// "can we afford Japan?", not "who owes whom".
//
// The simulation is arithmetic, not a forecasting engine:
//
//     pot − committed = what's left
//
// A 🗓️ Trip Plan is committed by definition — it has dates. A ⭐ Someday wish
// is a daydream until you tick "count it in", and that toggle IS the
// simulation: the number moves while you browse what you want.
//
// It renders into the strip pinned at the top of 📋 Plan (built in A3), which
// stays put while the chips swap beneath it — so what we can afford is on
// screen while we're looking at what we want.

let mnRows = [];
let mnReady = null;       // null unknown · true table exists · false needs money.sql
let mnOpen = false;       // is the add/history panel expanded

function mnEl(id) { return document.getElementById(id); }
function mnMe() { return getHashParam("me") || null; }
// "−$80", not "$-80": the sign belongs in front of the money, not inside it.
function mnMoney(n) {
  const v = Math.round(n);
  return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString();
}


// ---------------- data ----------------
async function mnLoad() {
  if (!supaOn()) { mnReady = false; mnRender(); return; }
  try {
    mnRows = await supa("expenses?select=*&order=at.desc,id.desc") || [];
    mnReady = true;
  } catch (e) {
    mnReady = false;   // table not created yet, offline, or signed out
  }
  mnRender();
}

// Money silently not saving is worse than money visibly not saving, so the
// row goes in locally either way and the strip says which copy you're on.
async function mnAdd(row) {
  const local = { id: "tmp" + Date.now(), created_at: new Date().toISOString(), ...row };
  mnRows.unshift(local);
  mnRender();
  if (!supaOn()) { popToast("Logged on this phone only 📋"); return; }
  try {
    const saved = await supa("expenses", { method: "POST", body: row });
    if (saved && saved[0]) {
      const i = mnRows.indexOf(local);
      if (i >= 0) mnRows[i] = saved[0];
      mnReady = true;
    }
    popToast(row.kind === "topup" ? "In the pot 💞" : "Logged 💸");
    mnRender();
  } catch (e) {
    mnReady = false;
    popToast(typeof authSignedIn === "function" && !authSignedIn()
      ? "Logged on this phone only — sign in to share it 💞"
      : "Logged on this phone only — run supabase/money.sql 📋");
    mnRender();
  }
}

async function mnDelete(row) {
  mnRows = mnRows.filter(r => r !== row);
  mnRender();
  if (!supaOn() || String(row.id).startsWith("tmp")) return;
  try { await supa("expenses?id=eq." + row.id, { method: "DELETE" }); }
  catch (e) { mnReady = false; mnRender(); }
}


// ---------------- the sums ----------------
function mnPot() {
  return mnRows.reduce((n, r) =>
    n + (r.kind === "topup" ? Number(r.amount || 0) : -Number(r.amount || 0)), 0);
}

// What we've promised ourselves. Planned trips always count — they have dates.
// Wishes count only once ticked in, which is the toggle that drives the
// simulation. Both live in tables E1 created, so this is a sum, not a schema.
function mnCommitted() {
  let n = 0;
  if (typeof journeys !== "undefined") {
    journeys.forEach(j => {
      if (j.status === "planned" && j.est_cost != null) n += Number(j.est_cost);
    });
  }
  if (typeof sdWishes !== "undefined") {
    sdWishes.forEach(w => {
      if (w.committed && w.status !== "done" && w.est_cost != null) n += Number(w.est_cost);
    });
  }
  return n;
}


// ---------------- render ----------------
function mnRender() {
  const pot = mnPot();
  const committed = mnCommitted();
  const potEl = mnEl("planPot");
  const sumEl = mnEl("planSums");
  const noteEl = mnEl("mnNote");
  if (!potEl) return;

  const signedIn = typeof authSignedIn === "function" && authSignedIn();
  const nothingYet = !mnRows.length;

  // The line only appears when it has something to say. With nothing logged it
  // used to sit above every visit to ⭐ Someday reading "— Nothing logged yet",
  // which is a row of furniture announcing its own emptiness — and the 💸 Money
  // chip is right there to fix that. The sums half goes the same way:
  // "Nothing committed yet" is a sentence about the absence of a number.
  const line = mnEl("planMoneyLine");
  if (line) line.style.display = nothingYet ? "none" : "";

  potEl.textContent = nothingYet ? "" : mnMoney(pot);
  potEl.classList.toggle("mn-negative", !nothingYet && pot < 0);

  if (sumEl) {
    const left = pot - committed;
    const showSums = !nothingYet && committed > 0;
    sumEl.style.display = showSums ? "" : "none";
    sumEl.textContent = showSums
      ? "Committed " + mnMoney(committed) + " · Left " + mnMoney(left)
      : "";
    // Over-committed is the whole question this feature answers ("can we
    // afford Japan?"), so say it in red rather than leaving it to be read.
    sumEl.classList.toggle("mn-over", showSums && left < 0);
  }

  if (noteEl) {
    noteEl.textContent = !supaOn()
      ? "Local mode — this pot lives on this phone only"
      : !signedIn
        ? "Sign in to see our real numbers"
        : mnReady === false
          ? "Not synced — run supabase/money.sql once, then reopen 📋"
          : mnRows.length + (mnRows.length === 1 ? " entry" : " entries") + " · shared 💞";
  }

  // The form and history are the 💸 Money chip's pane now, shown by
  // planShow() — there's no expander left to drive. Guarded because the old
  // strip markup may still exist in a cached page mid-deploy.
  const panel = mnEl("mnPanel"), toggle = mnEl("mnToggle");
  if (panel) panel.style.display = mnOpen ? "" : "none";
  if (toggle) toggle.textContent = mnOpen ? "✕ Close" : "💸 Log money";
  if (mnEl("mnHistory")) mnRenderHistory();

  // Home shows the headline; 📋 Plan owns the detail — same relationship the
  // countdown has to 🗓️ Trip Plan.
  const home = mnEl("mnHome");
  if (home) {
    home.textContent = nothingYet ? "" : "💸 Together: " + mnMoney(pot);
    home.style.display = nothingYet ? "none" : "";
  }
}

function mnRenderHistory() {
  const box = mnEl("mnHistory");
  if (!box) return;
  box.innerHTML = "";
  if (!mnRows.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Nothing logged yet — put something in the pot 💞";
    box.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  mnRows.slice(0, 40).forEach(r => {
    const line = document.createElement("div");
    line.className = "mn-row" + (r.kind === "topup" ? " mn-in" : "");

    const left = document.createElement("div");
    const what = document.createElement("div");
    what.className = "mn-what";
    what.textContent = r.what || (r.kind === "topup" ? "Added to the pot" : "Spent");
    left.appendChild(what);
    const meta = document.createElement("div");
    meta.className = "mn-when";
    const bits = [r.at];
    if (r.who) bits.push(r.who === "riu" ? "Riu" : "Lucia");
    meta.textContent = bits.filter(Boolean).join(" · ");
    left.appendChild(meta);
    line.appendChild(left);

    const amt = document.createElement("div");
    amt.className = "mn-amt";
    amt.textContent = (r.kind === "topup" ? "+" : "−") + mnMoney(Number(r.amount || 0));
    line.appendChild(amt);

    const del = document.createElement("button");
    del.className = "mn-del";
    del.textContent = "✕";
    del.title = "Remove";
    del.addEventListener("click", () => mnDelete(r));
    line.appendChild(del);

    frag.appendChild(line);
  });
  box.appendChild(frag);
}


// ---------------- wiring ----------------
// The 💸 Money chip replaced the expander; keep the listener only for a page
// still serving the old markup.
if (mnEl("mnToggle")) {
  mnEl("mnToggle").addEventListener("click", () => {
    mnOpen = !mnOpen;
    if (mnOpen && mnReady === null) mnLoad(); else mnRender();
  });
}

mnEl("mnSave").addEventListener("click", () => {
  const amount = Number(mnEl("mnAmount").value);
  if (!amount || amount <= 0) { popToast("How much? 😌"); return; }
  mnAdd({
    kind: mnEl("mnKind").value,
    amount: amount,
    what: mnEl("mnWhat").value.trim() || null,
    who: mnMe(),
    at: mnEl("mnDate").value || new Date().toISOString().slice(0, 10)
  });
  mnEl("mnAmount").value = "";
  mnEl("mnWhat").value = "";
});
