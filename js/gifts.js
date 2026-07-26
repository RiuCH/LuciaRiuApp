// gifts.js — Lucia ♥ Riu  (task D1: 🎁 Gifts)
//
// The record of what we've actually GIVEN each other: what it was, who gave
// it, when, the occasion — and a photo, which is the point. In a year the
// list of names means much less than the pictures do.
//
// Deliberately no prices (that would make a gift an expense — see 💸 Money),
// and no "wanted" state: a gift you *want* is a Someday wish, task E1.
//
// Photos reuse 🍜 Food's upload path wholesale — resize, EXIF date, storage,
// and B1's signed URLs — under a `gifts/` prefix of the same bucket. That's
// the roadmap's instruction ("same trick") and it means gifts inherit the
// private-bucket work for free. The helpers are read, never modified:
// js/food.js belongs to another session. Every call is feature-detected, so
// if Food is ever refactored Gifts degrades instead of exploding.
//
// Needs supabase/gifts.sql run once.

const GF_OCCASIONS = [
  { key: "birthday",    label: "🎂 Birthday" },
  { key: "anniversary", label: "💞 Anniversary" },
  { key: "christmas",   label: "🎄 Christmas" },
  { key: "justbecause", label: "✨ Just because" },
  { key: "souvenir",    label: "🧳 Souvenir" },
  { key: "apology",     label: "🙇 Sorry" },
  { key: "other",       label: "🎁 Other" }
];

let gfGifts = [];        // [{id, title, giver, given_on, occasion, note, url, path, viewUrl}]
let gfReady = null;      // null unknown · true table exists · false needs the SQL
let gfFilter = "all";    // all | riu | lucia | occasion:<key>
let gfPendingFile = null;

const gfEl = id => document.getElementById(id);
const gfOccasion = key => GF_OCCASIONS.find(o => o.key === key);
const gfGiverName = g => (g === "riu" ? "Riu" : "Lucia");

// ---------------- data ----------------
async function gfLoad() {
  if (!supaOn() || (typeof authSignedIn === "function" && !authSignedIn())) {
    gfReady = null;
    gfRender();
    return;
  }
  try {
    gfGifts = await supa("gifts?select=*&order=given_on.desc") || [];
    gfReady = true;
    gfRender();
    // signed views come from Food's resolver — same bucket, same expiry cache
    if (typeof fdResolveViews === "function") {
      try { if (await fdResolveViews(gfGifts)) gfRender(); } catch (e) { /* fallback URL renders */ }
    }
    return;
  } catch (e) {
    gfReady = false;
  }
  gfRender();
}

function gfLoadIfNeeded() { if (gfReady === null || gfReady === false) gfLoad(); }

async function gfSave() {
  const title = gfEl("gfTitle").value.trim();
  const giver = gfEl("gfForm").dataset.giver || "";
  const on = gfEl("gfDate").value;
  const occasion = gfEl("gfOccasion").value;
  const note = gfEl("gfNote").value.trim();
  if (!title) { popToast("What was it? 🎁"); return; }
  if (!giver) { popToast("Who gave it? 💝"); return; }

  gfBusy(true);
  let url = null, path = null;
  try {
    if (gfPendingFile && typeof fdResize === "function" && typeof fdUploadBlob === "function") {
      gfProgress("Shrinking the photo…");
      const blob = await fdResize(gfPendingFile);
      path = "gifts/" + (typeof fdStamp === "function" ? fdStamp() : Date.now().toString(36)) + ".jpg";
      gfProgress("Uploading…");
      url = await fdUploadBlob(blob, path, "image/jpeg");
    }
    const row = {
      title, giver, occasion: occasion || null, note: note || null, url, path,
      // a date you type is a calendar date, so pin it as a wall clock the way
      // food.taken_at does — otherwise it can render a day earlier elsewhere
      given_on: on ? on + "T12:00:00Z"
        : (typeof fdWallClock === "function" ? fdWallClock() : new Date().toISOString())
    };
    await supa("gifts", { method: "POST", body: row });
    popToast("Logged 🎁");
    gfResetForm();
    await gfLoad();
  } catch (e) {
    popToast("Couldn't save that: " + e.message);
  } finally {
    gfBusy(false);
    gfProgress("");
  }
}

async function gfDelete(gift) {
  if (!confirm('Delete "' + gift.title + '" for both of us?')) return;
  try {
    if (gift.path) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/food/${gift.path}`, {
        method: "DELETE",
        headers: typeof fdStorageHeaders === "function" ? fdStorageHeaders() : {}
      });
    }
    await supa("gifts?id=eq." + gift.id, { method: "DELETE" });
  } catch (e) { popToast("Couldn't delete: " + e.message); return; }
  popToast("Gone 🗑️");
  await gfLoad();
}

// ---------------- form ----------------
function gfBusy(on) {
  gfEl("gfSave").disabled = on;
  gfEl("gfSave").textContent = on ? "Saving…" : "💾 Log it";
}
function gfProgress(msg) {
  const el = gfEl("gfProgress");
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
}
function gfResetForm() {
  gfEl("gfTitle").value = "";
  gfEl("gfDate").value = "";
  gfEl("gfNote").value = "";
  gfEl("gfOccasion").value = "";
  gfEl("gfForm").dataset.giver = "";
  gfPendingFile = null;
  gfEl("gfPhotoName").textContent = "";
  gfRenderGiverPick();
  gfEl("gfForm").style.display = "none";
}
function gfRenderGiverPick() {
  const picked = gfEl("gfForm").dataset.giver || "";
  document.querySelectorAll("#gfGiver .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.giver === picked));
}

// ---------------- rendering ----------------
function gfVisible() {
  if (gfFilter === "all") return gfGifts;
  if (gfFilter === "riu" || gfFilter === "lucia") return gfGifts.filter(g => g.giver === gfFilter);
  const key = gfFilter.replace("occasion:", "");
  return gfGifts.filter(g => (g.occasion || "other") === key);
}

function gfRenderFilters() {
  const box = gfEl("gfFilters");
  box.innerHTML = "";
  const add = (key, label, count) => {
    const chip = document.createElement("button");
    chip.className = "chip gf-filter" + (gfFilter === key ? " sel" : "");
    chip.textContent = count == null ? label : label + " " + count;
    chip.addEventListener("click", () => { gfFilter = key; gfRender(); });
    box.appendChild(chip);
  };
  add("all", "🎁 All", gfGifts.length);
  ["lucia", "riu"].forEach(who => {
    const n = gfGifts.filter(g => g.giver === who).length;
    if (n) add(who, "from " + gfGiverName(who), n);
  });
  // only offer occasions actually used, so the row doesn't fill with noise
  GF_OCCASIONS.forEach(o => {
    const n = gfGifts.filter(g => (g.occasion || "other") === o.key).length;
    if (n) add("occasion:" + o.key, o.label, n);
  });
}

function gfCard(gift) {
  const card = document.createElement("div");
  card.className = "panel gf-card";

  const del = document.createElement("button");
  del.className = "gf-del";
  del.textContent = "✕";
  del.title = "Delete this gift";
  del.addEventListener("click", () => gfDelete(gift));
  card.appendChild(del);

  const view = typeof fdViewUrl === "function" ? fdViewUrl(gift) : (gift.viewUrl || gift.url);
  if (view) {
    const img = document.createElement("img");
    img.className = "gf-photo";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = view;
    img.alt = gift.title;
    img.addEventListener("click", () => gfOpenPhoto(view, gift.title));
    card.appendChild(img);
  }

  const title = document.createElement("div");
  title.className = "gf-title";
  title.textContent = gift.title;
  card.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "gf-meta";
  const bits = ["from " + gfGiverName(gift.giver)];
  const occ = gfOccasion(gift.occasion);
  if (occ) bits.push(occ.label);
  if (gift.given_on) bits.push(gfDate(gift.given_on));
  meta.textContent = bits.join(" · ");
  card.appendChild(meta);

  if (gift.note) {
    const note = document.createElement("div");
    note.className = "gf-note";
    note.textContent = gift.note;
    card.appendChild(note);
  }
  return card;
}

// given_on holds a wall clock (see gfSave), so render it in UTC — the same
// rule 🍜 Food's dates follow, and for the same reason: you two are an hour
// apart for half the year and a gift shouldn't change date between phones.
function gfDate(value) {
  const d = new Date(value);
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function gfRender() {
  const status = gfEl("gfStatus");
  status.textContent =
    !supaOn() ? "Local mode — Gifts needs Supabase"
    : (typeof authSignedIn === "function" && !authSignedIn()) ? "Sign in to see what we've given each other"
    : gfReady === false ? "⚠️ Run supabase/gifts.sql to switch this on"
    : gfReady === true ? gfGifts.length + (gfGifts.length === 1 ? " gift" : " gifts") + " · shared 💞"
    : "Loading…";
  gfEl("gfAddBtn").disabled = gfReady !== true;

  gfRenderFilters();
  const list = gfEl("gfList");
  list.innerHTML = "";
  if (gfReady !== true) return;

  const shown = gfVisible();
  if (!shown.length) {
    const empty = document.createElement("div");
    empty.className = "gf-empty";
    empty.textContent = gfGifts.length
      ? "Nothing under that filter 🎁"
      : "Nothing logged yet — add the first one 🎁";
    list.appendChild(empty);
    return;
  }
  shown.forEach(g => list.appendChild(gfCard(g)));
}

// ---------------- photo lightbox ----------------
function gfOpenPhoto(src, alt) {
  const box = gfEl("gfLightbox");
  gfEl("gfLbImg").src = src;
  gfEl("gfLbImg").alt = alt || "gift";
  box.classList.add("show");
}
gfEl("gfLightbox") && gfEl("gfLightbox").addEventListener("click", () =>
  gfEl("gfLightbox").classList.remove("show"));

// ---------------- wiring ----------------
if (gfEl("gfAddBtn")) {
  gfEl("gfAddBtn").addEventListener("click", () => {
    const form = gfEl("gfForm");
    form.style.display = form.style.display === "none" ? "block" : "none";
  });
  gfEl("gfCancel").addEventListener("click", gfResetForm);
  gfEl("gfSave").addEventListener("click", gfSave);

  document.querySelectorAll("#gfGiver .chip").forEach(chip =>
    chip.addEventListener("click", () => {
      gfEl("gfForm").dataset.giver = chip.dataset.giver;
      gfRenderGiverPick();
    }));

  gfEl("gfPhotoBtn").addEventListener("click", () => gfEl("gfPhoto").click());
  gfEl("gfPhoto").addEventListener("change", (e) => {
    gfPendingFile = (e.target.files && e.target.files[0]) || null;
    gfEl("gfPhotoName").textContent = gfPendingFile ? "📸 " + gfPendingFile.name : "";
    // a photo usually knows when it was taken — offer that as the date
    if (gfPendingFile && !gfEl("gfDate").value && typeof fdExif === "function") {
      gfPendingFile.arrayBuffer().then(buf => {
        const exif = fdExif(buf);
        if (exif && exif.takenAt) gfEl("gfDate").value = exif.takenAt.slice(0, 10);
      }).catch(() => {});
    }
  });

  const occ = gfEl("gfOccasion");
  GF_OCCASIONS.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.key;
    opt.textContent = o.label;
    occ.appendChild(opt);
  });
}

// Load when the Gifts pane actually opens — never before, same rule Food
// follows. Both hooks EXTEND what js/food.js set rather than replacing it:
// that file belongs to another session, so this one stays additive.
document.querySelectorAll('#treatsPicker .chip[data-treat="gifts"]').forEach(chip =>
  chip.addEventListener("click", gfLoadIfNeeded));

const gfPrevTreatsHook = TAB_HOOKS.treats;
TAB_HOOKS.treats = () => {
  if (typeof gfPrevTreatsHook === "function") gfPrevTreatsHook();
  if (treatsPick === "gifts") gfLoadIfNeeded();
};
