// someday.js — Lucia ♥ Riu
// ⭐ Someday and 🗓️ Trip Plan: the two future-tense halves of 📋 Plan.
//
// They live in one file because they're one idea:
//
//   ⭐ Someday  →  🗓️ Trip Plan  →  ✈️ Trips
//   "Japan someday"  "Tokyo, Dec 20–28"   the album, afterwards
//
// A wish graduates. A 📍 place becomes a planned trip; a 🍜 restaurant becomes
// a Food photo; a 🎁 thing becomes a Gift. That's why `status` lives on the
// wish rather than each of those three growing its own "wanted" flag.
//
// Trip Plan is NOT a second table: a planned trip is a `journeys` row with
// `status = 'planned'`, so it graduates into a memory in place — same row,
// same photos, no copy step to drift. See supabase/someday.sql.

// ---------------- state ----------------
const SD_KINDS = {
  place:      { emoji: "📍", label: "Place",      goes: "a trip" },
  restaurant: { emoji: "🍜", label: "Restaurant", goes: "the Food tab" },
  thing:      { emoji: "🎁", label: "Thing",      goes: "Gifts" }
};
let sdWishes = [];
let sdReady = null;       // null unknown · true table exists · false needs someday.sql
let sdFilter = "all";     // "all" | a key of SD_KINDS
let sdShowDone = false;

// Which of us is on this phone. Shares `#me` with the duel and 20 Questions —
// one identity, picked once. Null until you've chosen a side there.
function sdMe() { return getHashParam("me") || null; }

function sdEl(id) { return document.getElementById(id); }


// ---------------- data ----------------
async function sdLoad() {
  if (!supaOn()) { sdReady = false; sdRender(); return; }
  try {
    sdWishes = await supa("wishes?select=*&order=created_at.desc") || [];
    sdReady = true;
  } catch (e) {
    // Either the table isn't there yet or we're offline. Same visible outcome:
    // the list renders from whatever is in memory and says so (golden rule 6).
    sdReady = false;
  }
  sdRender();
}

async function sdAdd(row) {
  // Optimistic: the wish appears immediately and syncs behind it. A wish is
  // cheap enough that waiting on a round trip to see your own typing is worse
  // than the rare case of it failing to save.
  const local = { id: "tmp" + Date.now(), created_at: new Date().toISOString(), status: "wanted", ...row };
  sdWishes.unshift(local);
  sdRender();
  if (!supaOn()) return;
  try {
    const saved = await supa("wishes", { method: "POST", body: row });
    if (saved && saved[0]) {
      const i = sdWishes.indexOf(local);
      if (i >= 0) sdWishes[i] = saved[0];
      sdReady = true;
      sdRender();
    }
  } catch (e) {
    sdReady = false;
    popToast(typeof authSignedIn === "function" && !authSignedIn()
      ? "Saved on this phone only — sign in to share it 💞"
      : "Saved on this phone only — run supabase/someday.sql 📋");
    sdRender();
  }
}

async function sdPatch(wish, patch) {
  Object.assign(wish, patch);
  sdRender();
  if (!supaOn() || String(wish.id).startsWith("tmp")) return;
  try { await supa("wishes?id=eq." + wish.id, { method: "PATCH", body: patch }); }
  catch (e) { sdReady = false; sdRender(); }
}

async function sdDelete(wish) {
  sdWishes = sdWishes.filter(w => w !== wish);
  sdRender();
  if (!supaOn() || String(wish.id).startsWith("tmp")) return;
  try { await supa("wishes?id=eq." + wish.id, { method: "DELETE" }); }
  catch (e) { sdReady = false; sdRender(); }
}


// ---------------- graduation ----------------
// The bit that stops this being a list nobody reopens. Ticking a wish off
// doesn't just grey it out — it hands you to the place that keeps the record.
function sdGraduate(wish) {
  sdPatch(wish, { status: "done", done_at: new Date().toISOString() });
  burst(innerWidth / 2, innerHeight / 3, ["⭐", "💫", "✨", "💞"]);
  const kind = SD_KINDS[wish.kind] || SD_KINDS.thing;
  if (wish.kind === "place") {
    popToast("Done ⭐ — now give it dates in 🗓️ Trip Plan");
    planShow("trip");
    tpPrefill(wish.title, wish.est_cost);
  } else if (wish.kind === "restaurant") {
    popToast("Done ⭐ — put a photo of it in 🍜 Food");
    switchTab("treats");
    if (typeof treatsShow === "function") treatsShow("food");
  } else {
    popToast("Done ⭐ — file it in 🎁 Gifts when that lands");
  }
  return kind;
}


// ---------------- render ----------------
function sdRender() {
  const box = sdEl("sdList");
  if (!box) return;

  // status line, in the food.js house style: say which copy you're looking at
  const status = sdEl("sdStatus");
  if (status) {
    const signedIn = typeof authSignedIn === "function" && authSignedIn();
    status.textContent = !supaOn()
      ? "Local mode — this list lives on this phone only"
      // Signed out, RLS refuses the read (v10) — that's not a missing table,
      // and saying "run the SQL" would send you off to fix the wrong thing.
      : !signedIn
        ? "Sign in to see our list — this phone is on the offline copy"
        : sdReady === false
          ? "Not synced — run supabase/someday.sql once, then reopen 📋"
          : sdReady === null ? "Loading…"
            : sdWishes.length + (sdWishes.length === 1 ? " wish · shared 💞" : " wishes · shared 💞");
  }

  document.querySelectorAll("#sdFilters .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.kind === sdFilter));
  const toggle = sdEl("sdDoneToggle");
  if (toggle) toggle.textContent = sdShowDone ? "🙈 Hide done" : "👀 Show done";

  const list = sdWishes.filter(w =>
    (sdFilter === "all" || w.kind === sdFilter) &&
    (sdShowDone ? true : w.status !== "done"));

  box.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = sdWishes.length
      ? "Nothing here with that filter 🤷"
      : "Empty so far — add the first thing we want to do 💫";
    box.appendChild(empty);
    sdRenderPick();
    return;
  }

  const frag = document.createDocumentFragment();
  list.forEach(w => frag.appendChild(sdCard(w)));
  box.appendChild(frag);
  sdRenderPick();
}

function sdCard(w) {
  const kind = SD_KINDS[w.kind] || SD_KINDS.thing;
  const card = document.createElement("div");
  card.className = "panel sd-card" + (w.status === "done" ? " sd-done" : "");

  const top = document.createElement("div");
  top.className = "sd-top";
  const title = document.createElement("div");
  title.className = "sd-title";
  title.textContent = kind.emoji + " " + w.title;   // textContent: user text, never innerHTML
  top.appendChild(title);
  if (w.est_cost != null && w.est_cost !== "") {
    const cost = document.createElement("span");
    cost.className = "sd-cost";
    cost.textContent = "~$" + Number(w.est_cost).toLocaleString();
    top.appendChild(cost);
  }
  card.appendChild(top);

  if (w.note) {
    const note = document.createElement("div");
    note.className = "sd-note";
    note.textContent = w.note;
    card.appendChild(note);
  }

  const meta = document.createElement("div");
  meta.className = "sd-meta";
  const bits = [kind.label];
  if (w.added_by) bits.push((w.added_by === "riu" ? "Riu" : "Lucia") + " wants this");
  if (w.status === "done") bits.push("done ✅");
  meta.textContent = bits.join(" · ");
  card.appendChild(meta);

  if (w.link) {
    const a = document.createElement("a");
    a.className = "sd-link";
    a.href = w.link; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = "🔗 open";
    card.appendChild(a);
  }

  const row = document.createElement("div");
  row.className = "rowbtns";
  if (w.status !== "done") {
    const done = document.createElement("button");
    done.className = "primary";
    done.textContent = "✅ We did it";
    done.addEventListener("click", () => sdGraduate(w));
    row.appendChild(done);
  } else {
    const undo = document.createElement("button");
    undo.textContent = "↩️ Not yet";
    undo.addEventListener("click", () => sdPatch(w, { status: "wanted", done_at: null }));
    row.appendChild(undo);
  }
  const del = document.createElement("button");
  del.textContent = "🗑️";
  del.title = "Remove";
  del.addEventListener("click", () => sdDelete(w));
  row.appendChild(del);
  card.appendChild(row);
  return card;
}

// 🎲 pick one. Deliberately live Math.random(), NOT the seeded daily pattern:
// this is a decision you make together in a moment and immediately want to
// re-roll, exactly like the Talk · Flirt · Dare decks. (Seed offset 49979687
// was reserved for this and is released back in SESSIONS.md.)
function sdRenderPick() {
  const btn = sdEl("sdPick");
  if (!btn) return;
  const pool = sdWishes.filter(w => w.status !== "done" &&
    (sdFilter === "all" || w.kind === sdFilter));
  btn.style.display = pool.length > 1 ? "" : "none";
}

function sdPickOne() {
  const pool = sdWishes.filter(w => w.status !== "done" &&
    (sdFilter === "all" || w.kind === sdFilter));
  if (!pool.length) return;
  const w = pool[Math.floor(Math.random() * pool.length)];
  const kind = SD_KINDS[w.kind] || SD_KINDS.thing;
  sdEl("sdPicked").textContent = kind.emoji + " " + w.title;
  sdEl("sdPicked").style.display = "";
  burst(innerWidth / 2, innerHeight / 2, ["🎲", "⭐", "💫"]);
}


// ---------------- add form ----------------
function sdToggleForm(show) {
  const form = sdEl("sdForm");
  form.style.display = show ? "block" : "none";
  if (show) sdEl("sdTitle").focus();
}

document.querySelectorAll("#sdFilters .chip").forEach(chip =>
  chip.addEventListener("click", () => { sdFilter = chip.dataset.kind; sdRender(); }));

sdEl("sdAddBtn").addEventListener("click", () => sdToggleForm(true));
sdEl("sdCancel").addEventListener("click", () => sdToggleForm(false));
sdEl("sdPick").addEventListener("click", sdPickOne);
sdEl("sdDoneToggle").addEventListener("click", () => { sdShowDone = !sdShowDone; sdRender(); });

sdEl("sdSave").addEventListener("click", () => {
  const title = sdEl("sdTitle").value.trim();
  if (!title) { popToast("Give it a name first 😌"); return; }
  const cost = sdEl("sdCost").value.trim();
  sdAdd({
    kind: sdEl("sdKind").value,
    title: title,
    note: sdEl("sdNote").value.trim() || null,
    link: sdEl("sdLink").value.trim() || null,
    added_by: sdMe(),
    est_cost: cost ? Number(cost) : null
  });
  ["sdTitle", "sdNote", "sdLink", "sdCost"].forEach(id => { sdEl(id).value = ""; });
  sdToggleForm(false);
});


// ================= 🗓️ TRIP PLAN =================
// A `journeys` row with status = 'planned'. ✈️ Trips shows the past ones,
// 📋 Plan shows the ones still ahead — one table, two views.

function tpUpcoming() {
  return (typeof journeys === "undefined" ? [] : journeys)
    .filter(j => j.status === "planned")
    .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
}

function tpPrefill(place, cost) {
  sdEl("tpPlace").value = place || "";
  if (cost != null && cost !== "") sdEl("tpCost").value = cost;
  sdEl("tpForm").style.display = "block";
  sdEl("tpForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function tpRender() {
  const box = sdEl("tpList");
  if (!box) return;
  const list = tpUpcoming();
  box.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "Nothing booked yet — add the next time we're in the same place ✈️";
    box.appendChild(empty);
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(j => {
    const card = document.createElement("div");
    card.className = "panel sd-card";
    const t = document.createElement("div");
    t.className = "sd-title";
    t.textContent = "✈️ " + j.place;
    card.appendChild(t);

    const when = document.createElement("div");
    when.className = "sd-meta";
    const days = tpDaysAway(j.start_date);
    when.textContent = [j.start_date, j.end_date].filter(Boolean).join(" → ") +
      (days != null ? " · " + (days === 0 ? "today!" : days + " days away") : "");
    card.appendChild(when);

    if (j.est_cost != null) {
      const c = document.createElement("div");
      c.className = "sd-cost";
      c.textContent = "~$" + Number(j.est_cost).toLocaleString();
      card.appendChild(c);
    }

    const row = document.createElement("div");
    row.className = "rowbtns";
    const done = document.createElement("button");
    done.className = "primary";
    done.textContent = "✅ We went";
    // Graduates in place: the same row becomes a past trip, keeping its photos.
    done.addEventListener("click", () => tpGraduate(j));
    row.appendChild(done);
    const cd = document.createElement("button");
    cd.textContent = "⏳ Count down to this";
    cd.addEventListener("click", () => tpSetCountdown(j));
    row.appendChild(cd);
    card.appendChild(row);
    frag.appendChild(card);
  });
  box.appendChild(frag);
}

function tpDaysAway(date) {
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const then = new Date(date + "T00:00:00");
  if (isNaN(then)) return null;
  return Math.round((then - today) / 86400000);
}

// The Home countdown is already a trip plan reduced to one date, so let a plan
// drive it rather than the two being typed separately.
function tpSetCountdown(j) {
  if (!j.start_date) { popToast("Give it a start date first 📅"); return; }
  reunionDate = new Date(j.start_date + "T00:00:00");
  document.getElementById("setDateBtn").textContent = "📅 Change the date";
  setHashParam("reunion", j.start_date);
  tickCountdown();
  saveReunion(j.start_date);
  popToast("Home is counting down to " + j.place + " 💞");
}

async function tpGraduate(j) {
  j.status = "past";
  tpRender();
  burst(innerWidth / 2, innerHeight / 3, ["✈️", "💞", "📸"]);
  popToast("Welcome home ✈️ — it's in Trips now");
  if (!supaOn()) return;
  try {
    await supa("journeys?id=eq." + j.id, { method: "PATCH", body: { status: "past" } });
    if (typeof renderJourneys === "function") renderJourneys();
  } catch (e) { popToast("Couldn't sync that — run supabase/someday.sql 📋"); }
}

sdEl("tpAddBtn").addEventListener("click", () => {
  sdEl("tpForm").style.display = sdEl("tpForm").style.display === "block" ? "none" : "block";
});
sdEl("tpCancel").addEventListener("click", () => { sdEl("tpForm").style.display = "none"; });

sdEl("tpSave").addEventListener("click", async () => {
  const place = sdEl("tpPlace").value.trim();
  const start = sdEl("tpStart").value;
  if (!place || !start) { popToast("Needs a place and a start date ✈️"); return; }
  const cost = sdEl("tpCost").value.trim();
  const row = {
    place: place,
    start_date: start,
    end_date: sdEl("tpEnd").value || null,
    description: sdEl("tpNote").value.trim() || null,
    status: "planned",
    est_cost: cost ? Number(cost) : null
  };
  // Optimistic, same as sdAdd: the plan appears immediately and syncs behind
  // it. Golden rule 6 — if the write fails we KEEP the local row rather than
  // dropping what you just typed, and say which copy you're looking at.
  const local = { id: "tmp" + Date.now(), ...row };
  if (typeof journeys !== "undefined") journeys.push(local);
  tpRender();
  if (!supaOn()) { popToast("Saved on this phone only 📋"); }
  else {
    try {
      const saved = await supa("journeys", { method: "POST", body: row });
      if (saved && saved[0] && typeof journeys !== "undefined") {
        const i = journeys.indexOf(local);
        if (i >= 0) journeys[i] = saved[0];
        tpRender();
      }
      popToast("Planned ✈️ — it's on both phones");
    } catch (e) {
      popToast(typeof authSignedIn === "function" && !authSignedIn()
        ? "Saved on this phone only — sign in to share it 💞"
        : "Saved on this phone only — run supabase/someday.sql 📋");
    }
  }
  ["tpPlace", "tpStart", "tpEnd", "tpNote", "tpCost"].forEach(id => { sdEl(id).value = ""; });
  sdEl("tpForm").style.display = "none";
});
