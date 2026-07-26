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
let gfEditing = null;      // the gift being edited, or null when adding
let gfPendingFiles = [];   // newly chosen File objects, not yet uploaded
let gfKeptPhotos = [];     // existing [{url, path}] kept while editing
let gfMultiOK = null;      // does the DB have gifts.photos yet? (gifts_photos.sql)
const GF_MAX_PHOTOS = 3;

const gfEl = id => document.getElementById(id);
const gfOccasion = key => GF_OCCASIONS.find(o => o.key === key);
const gfGiverName = g => (g === "riu" ? "Riu" : "Lucia");

// One shape for both schemas: `photos` when the migration has been run,
// otherwise the original single url/path pair. Callers never branch.
function gfPhotoList(gift) {
  if (!gift) return [];
  if (Array.isArray(gift.photos) && gift.photos.length) {
    return gift.photos.filter(p => p && (p.url || p.path));
  }
  if (gift.url || gift.path) {
    // Build this ONCE and keep it on the gift. Returning a fresh object each
    // call threw away the viewUrl that fdResolveViews had just attached: the
    // resolve pass in gfLoad() signed a throwaway, then gfRender() asked
    // again, got a clean object, and fell back to gift.url — a plain
    // /object/public/ link, which stopped resolving the moment B1 made the
    // bucket private. Net effect: single-photo gifts showed nothing at all.
    // The `photos` path never had this bug because it hands back the real
    // array elements, which is why only pre-gifts_photos.sql rows broke.
    if (!gift._solo || gift._solo[0].url !== gift.url || gift._solo[0].path !== gift.path) {
      gift._solo = [{ url: gift.url, path: gift.path }];
    }
    return gift._solo;
  }
  return [];
}

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
    if (gfMultiOK === null) {
      // one cheap probe: has supabase/gifts_photos.sql been run?
      try { await supa("gifts?select=photos&limit=1"); gfMultiOK = true; }
      catch (e) { gfMultiOK = false; }
    }
    gfRender();
    // signed views come from Food's resolver — same bucket, same expiry cache.
    // Every photo of every gift, so the 2nd and 3rd resolve too.
    if (typeof fdResolveViews === "function") {
      const all = [];
      gfGifts.forEach(g => gfPhotoList(g).forEach(p => all.push(p)));
      try { if (await fdResolveViews(all)) gfRender(); } catch (e) { /* fallback renders */ }
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
  try {
    // upload only what's new; kept photos already live in the bucket
    const photos = gfKeptPhotos.slice();
    for (let i = 0; i < gfPendingFiles.length; i++) {
      if (photos.length >= GF_MAX_PHOTOS) break;
      gfProgress(`Uploading photo ${i + 1} of ${gfPendingFiles.length}…`);
      const blob = await fdResize(gfPendingFiles[i]);
      const path = "gifts/" + (typeof fdStamp === "function" ? fdStamp() : Date.now().toString(36) + i) + ".jpg";
      const url = await fdUploadBlob(blob, path, "image/jpeg");
      photos.push({ url, path });
    }

    const row = {
      title, giver, occasion: occasion || null, note: note || null,
      // url/path keep pointing at the first photo: rows stay readable by a
      // client that predates gifts_photos.sql, and by the DB if it does too
      url: photos.length ? photos[0].url : null,
      path: photos.length ? photos[0].path : null,
      given_on: on ? on + "T12:00:00Z"
        : (typeof fdWallClock === "function" ? fdWallClock() : new Date().toISOString())
    };
    if (gfMultiOK !== false) row.photos = photos.length ? photos : null;

    if (gfEditing) {
      await supa("gifts?id=eq." + gfEditing.id, { method: "PATCH", body: row });
      // whatever the edit dropped is now orphaned in the bucket
      const keep = new Set(photos.map(p => p.path).filter(Boolean));
      for (const old of gfPhotoList(gfEditing)) {
        if (old.path && !keep.has(old.path)) await gfDeleteObject(old.path);
      }
      popToast("Updated 🎁");
    } else {
      await supa("gifts", { method: "POST", body: row });
      popToast("Logged 🎁");
    }
    gfResetForm();
    await gfLoad();
  } catch (e) {
    // the one predictable failure: photos written before the migration ran
    if (/photos/i.test(e.message) && gfMultiOK !== false) {
      gfMultiOK = false;
      popToast("Saved with one photo — run supabase/gifts_photos.sql for three");
    } else {
      popToast("Couldn't save that: " + e.message);
    }
  } finally {
    gfBusy(false);
    gfProgress("");
  }
}

function gfStartEdit(gift) {
  gfEditing = gift;
  gfKeptPhotos = gfPhotoList(gift).slice();
  gfPendingFiles = [];
  gfEl("gfTitle").value = gift.title || "";
  gfEl("gfForm").dataset.giver = gift.giver || "";
  gfEl("gfDate").value = gift.given_on ? String(gift.given_on).slice(0, 10) : "";
  gfEl("gfOccasion").value = gift.occasion || "";
  gfEl("gfNote").value = gift.note || "";
  gfEl("gfFormTitle").textContent = "Edit gift";
  gfEl("gfSave").textContent = "💾 Save changes";
  gfEl("gfForm").style.display = "block";
  gfRenderGiverPick();
  gfRenderPhotoTray();
  gfEl("gfForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

async function gfDeleteObject(path) {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/food/${path}`, {
      method: "DELETE",
      headers: typeof fdStorageHeaders === "function" ? fdStorageHeaders() : {}
    });
  } catch (e) { /* an orphaned file is not worth failing the save over */ }
}

async function gfDelete(gift) {
  if (!confirm('Delete "' + gift.title + '" for both of us?')) return;
  try {
    for (const p of gfPhotoList(gift)) { if (p.path) await gfDeleteObject(p.path); }
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
  gfEditing = null;
  gfPendingFiles = [];
  gfKeptPhotos = [];
  gfEl("gfTitle").value = "";
  gfEl("gfDate").value = "";
  gfEl("gfNote").value = "";
  gfEl("gfOccasion").value = "";
  gfEl("gfForm").dataset.giver = "";
  gfEl("gfFormTitle").textContent = "New gift";
  gfEl("gfSave").textContent = "💾 Log it";
  gfRenderGiverPick();
  gfRenderPhotoTray();
  gfEl("gfForm").style.display = "none";
}

// The photos currently attached to the form: kept ones first, then the newly
// picked files. Each is removable before you save.
function gfRenderPhotoTray() {
  const tray = gfEl("gfPhotoTray");
  tray.innerHTML = "";
  const total = gfKeptPhotos.length + gfPendingFiles.length;
  gfKeptPhotos.forEach((p, i) => tray.appendChild(gfTrayItem(
    (typeof fdViewUrl === "function" ? fdViewUrl(p) : p.url), "kept", () => {
      gfKeptPhotos.splice(i, 1); gfRenderPhotoTray();
    })));
  gfPendingFiles.forEach((f, i) => tray.appendChild(gfTrayItem(
    URL.createObjectURL(f), "new", () => {
      gfPendingFiles.splice(i, 1); gfRenderPhotoTray();
    })));
  gfEl("gfPhotoBtn").disabled = total >= GF_MAX_PHOTOS;
  gfEl("gfPhotoBtn").textContent = total
    ? `📸 Add another (${total}/${GF_MAX_PHOTOS})`
    : "📸 Add a photo";
  gfEl("gfPhotoHint").textContent =
    gfMultiOK === false && total > 0
      ? "Only the first is saved until supabase/gifts_photos.sql is run"
      : total >= GF_MAX_PHOTOS ? "Three is the limit — remove one to swap it" : "";
}

function gfTrayItem(src, kind, onRemove) {
  const wrap = document.createElement("div");
  wrap.className = "gf-trayitem";
  const img = document.createElement("img");
  img.src = src;
  img.alt = kind === "new" ? "photo to upload" : "attached photo";
  const x = document.createElement("button");
  x.className = "gf-trayx";
  x.textContent = "✕";
  x.title = "Remove this photo";
  x.addEventListener("click", onRemove);
  wrap.append(img, x);
  return wrap;
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

  const edit = document.createElement("button");
  edit.className = "gf-edit";
  edit.textContent = "✎";
  edit.title = "Edit this gift";
  edit.addEventListener("click", () => gfStartEdit(gift));
  card.appendChild(edit);

  const shots = gfPhotoList(gift);
  const srcOf = p => (typeof fdViewUrl === "function" ? fdViewUrl(p) : (p.viewUrl || p.url));
  if (shots.length) {
    const main = document.createElement("img");
    main.className = "gf-photo";
    main.loading = "lazy";
    main.decoding = "async";
    main.src = srcOf(shots[0]);
    main.alt = gift.title;
    main.addEventListener("click", () => gfOpenPhoto(shots.map(srcOf), 0, gift.title));
    card.appendChild(main);

    if (shots.length > 1) {
      const strip = document.createElement("div");
      strip.className = "gf-strip";
      shots.slice(1).forEach((p, i) => {
        const t = document.createElement("img");
        t.loading = "lazy";
        t.decoding = "async";
        t.src = srcOf(p);
        t.alt = gift.title + " (" + (i + 2) + ")";
        t.addEventListener("click", () => gfOpenPhoto(shots.map(srcOf), i + 1, gift.title));
        strip.appendChild(t);
      });
      card.appendChild(strip);
    }
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
let gfLbShots = [], gfLbAt = 0;

function gfOpenPhoto(srcs, index, alt) {
  gfLbShots = Array.isArray(srcs) ? srcs : [srcs];
  gfLbAt = index || 0;
  gfEl("gfLbImg").alt = alt || "gift";
  gfPaintLightbox();
  gfEl("gfLightbox").classList.add("show");
}

function gfPaintLightbox() {
  gfEl("gfLbImg").src = gfLbShots[gfLbAt] || "";
  const many = gfLbShots.length > 1;
  gfEl("gfLbNav").style.display = many ? "flex" : "none";
  if (many) gfEl("gfLbCount").textContent = (gfLbAt + 1) + " / " + gfLbShots.length;
}

function gfStep(by) {
  if (!gfLbShots.length) return;
  gfLbAt = (gfLbAt + by + gfLbShots.length) % gfLbShots.length;
  gfPaintLightbox();
}
if (gfEl("gfLightbox")) {
  // only the backdrop closes it — the arrows and the photo itself must not
  gfEl("gfLightbox").addEventListener("click", (e) => {
    if (e.target === gfEl("gfLightbox")) gfEl("gfLightbox").classList.remove("show");
  });
  gfEl("gfLbPrev").addEventListener("click", (e) => { e.stopPropagation(); gfStep(-1); });
  gfEl("gfLbNext").addEventListener("click", (e) => { e.stopPropagation(); gfStep(1); });
}

// ---------------- wiring ----------------
if (gfEl("gfAddBtn")) {
  gfEl("gfAddBtn").addEventListener("click", () => {
    const wasHidden = gfEl("gfForm").style.display === "none";
    gfResetForm();                       // never leave edit mode half-open
    if (wasHidden) gfEl("gfForm").style.display = "block";
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
    const room = GF_MAX_PHOTOS - (gfKeptPhotos.length + gfPendingFiles.length);
    const picked = Array.from(e.target.files || []).filter(f => /^image\//.test(f.type));
    if (picked.length > room) popToast(`Three photos per gift — keeping the first ${room} 🎁`);
    const taken = picked.slice(0, Math.max(0, room));
    gfPendingFiles = gfPendingFiles.concat(taken);
    e.target.value = "";
    gfRenderPhotoTray();
    // a photo usually knows when it was taken — offer that as the date
    if (taken[0] && !gfEl("gfDate").value && typeof fdExif === "function") {
      taken[0].arrayBuffer().then(buf => {
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
