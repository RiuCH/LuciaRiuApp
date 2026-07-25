// food.js — Lucia ♥ Riu
// 🍜 Food: every meal we've had together, newest first, down a month-by-month
// timeline, with a tagging system on top.
//
// Where the pictures live: Supabase Storage (bucket `food`), with a row per
// photo in `food_photos` and tags in `food_tags` / `food_photo_tags`.
// One-time setup is supabase/food.sql — until it's run the tab says exactly
// that rather than half-working.
//
// You CANNOT upload into an Apple Shared Album: Apple's shared-album web API
// is read-only and unofficial. Album photos are therefore *copied* into our
// bucket by api/food-import.js — iCloud's asset URLs are signed and expire,
// so linking to them would rot within hours.

const FD_BUCKET = "food";
const FD_MAX_EDGE = 1600;   // long edge after resize — plenty for a photo grid
const FD_QUALITY = 0.82;
const FD_KINDS = [
  { key: "restaurant", label: "🍽️ Restaurant" },
  { key: "dish",       label: "🍝 Food type" },
  { key: "city",       label: "🏙️ City" },
  { key: "country",    label: "🌍 Country" },
  { key: "other",      label: "🏷️ Other" }
];
// `place` was one combined kind before 2026-07-26. Anything still carrying it
// is shown under City so nothing disappears before the migration is run
// (supabase/food_split_place.sql).
const FD_LEGACY_PLACE = "place";

let fdPhotos = [];          // [{id, url, path, taken_at, lat, lon, caption, tags:[tagId]}]
let fdTags = [];            // [{id, name, kind}]
let fdReady = null;         // null unknown · true tables exist · false needs food.sql
let fdSearch = "";
let fdGroupBy = "date";     // date | restaurant | dish | place
let fdOpenId = null;        // photo in the lightbox
let fdPicking = null;       // tag id we're bulk-assigning photos to
let fdPicked = new Set();

const fdEl = id => document.getElementById(id);

// ---------------- EXIF ----------------
// A photo's date and GPS have to be read from the ORIGINAL bytes: drawing to
// a canvas to resize throws every tag away. Hand-rolled because the app takes
// no dependencies — we only need three values out of the TIFF block.
function fdExif(buffer) {
  const out = { takenAt: null, lat: null, lon: null };
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xFFD8) return out;      // not a JPEG
    let offset = 2;
    while (offset < view.byteLength - 4) {
      if (view.getUint8(offset) !== 0xFF) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (marker === 0xE1) {                            // APP1 — where Exif lives
        const start = offset + 4;
        if (view.getUint32(start) !== 0x45786966) return out;   // "Exif"
        return fdTiff(view, start + 6);
      }
      if (marker === 0xDA) break;                       // start of scan: no more metadata
      offset += 2 + size;
    }
  } catch (e) { /* unreadable metadata is not an error — we just don't know */ }
  return out;
}

function fdTiff(view, tiff) {
  const out = { takenAt: null, lat: null, lon: null };
  const le = view.getUint16(tiff) === 0x4949;           // II = little endian
  const u16 = o => view.getUint16(o, le);
  const u32 = o => view.getUint32(o, le);
  if (u16(tiff + 2) !== 42) return out;

  const readIFD = (dirStart, want) => {
    const found = {};
    const count = u16(dirStart);
    for (let i = 0; i < count; i++) {
      const entry = dirStart + 2 + i * 12;
      const tag = u16(entry);
      if (!want.includes(tag)) continue;
      const type = u16(entry + 2);
      const num = u32(entry + 4);
      const bytes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] || 1;
      const total = bytes * num;
      const valueAt = total > 4 ? tiff + u32(entry + 8) : entry + 8;
      if (type === 2) {                                  // ASCII
        let s = "";
        for (let c = 0; c < num - 1; c++) s += String.fromCharCode(view.getUint8(valueAt + c));
        found[tag] = s;
      } else if (type === 5) {                           // RATIONAL[]
        const vals = [];
        for (let c = 0; c < num; c++) {
          const n = u32(valueAt + c * 8), d = u32(valueAt + c * 8 + 4);
          vals.push(d ? n / d : 0);
        }
        found[tag] = vals;
      } else {
        found[tag] = type === 3 ? u16(valueAt) : u32(valueAt);
      }
    }
    return found;
  };

  const ifd0 = readIFD(tiff + u32(tiff + 4), [0x8769, 0x8825, 0x0132]);
  if (ifd0[0x8769]) {
    const exif = readIFD(tiff + ifd0[0x8769], [0x9003]);
    if (exif[0x9003]) out.takenAt = fdExifDate(exif[0x9003]);   // DateTimeOriginal
  }
  if (!out.takenAt && ifd0[0x0132]) out.takenAt = fdExifDate(ifd0[0x0132]);

  if (ifd0[0x8825]) {
    const gps = readIFD(tiff + ifd0[0x8825], [0x0001, 0x0002, 0x0003, 0x0004]);
    const dms = v => Array.isArray(v) && v.length === 3 ? v[0] + v[1] / 60 + v[2] / 3600 : null;
    const la = dms(gps[0x0002]), lo = dms(gps[0x0004]);
    if (la != null) out.lat = gps[0x0001] === "S" ? -la : la;
    if (lo != null) out.lon = gps[0x0003] === "W" ? -lo : lo;
  }
  return out;
}

// EXIF dates are "YYYY:MM:DD HH:MM:SS" — a wall clock where the photo was
// taken, with NO timezone. What we want to show is the day we ate, so the
// wall clock is stored verbatim and always rendered back in UTC (fdFullDate).
// Converting it through a timezone instead would drift the date: a 23:30
// dinner in SF would read as the next day on a phone an hour ahead, and a
// meal in Tokyo would land on the wrong day entirely.
function fdExifDate(raw) {
  const m = String(raw).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

// Same trick for photos with no EXIF: take the LOCAL clock and pin it as UTC,
// so an upload at 8pm reads "8pm" on both phones instead of sliding a day.
function fdWallClock(date) {
  const d = date instanceof Date && !isNaN(date) ? date : new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
         `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}Z`;
}

// ---------------- upload ----------------
// Shrink before uploading: a modern phone photo is 4-8MB, and the free storage
// tier is about a gigabyte. 1600px at 82% is indistinguishable in a grid and
// lands around 300KB.
function fdResize(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, FD_MAX_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("couldn't re-encode")), "image/jpeg", FD_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("couldn't read that image")); };
    img.src = url;
  });
}

async function fdUploadBlob(blob, path, type) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${FD_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": type || "image/jpeg",
      "x-upsert": "true"
    },
    body: blob
  });
  if (!res.ok) throw new Error("storage " + res.status + " — has supabase/food.sql been run?");
  return `${SUPABASE_URL}/storage/v1/object/public/${FD_BUCKET}/${path}`;
}

function fdStamp() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function fdHandleFiles(files) {
  if (!supaOn()) { popToast("Food needs Supabase — see docs/SUPABASE.md"); return; }
  const list = Array.from(files).filter(f => /^image\//.test(f.type));
  if (!list.length) { popToast("Those weren't photos 🤔"); return; }
  let done = 0;
  fdProgress(`Uploading 1 of ${list.length}…`);
  for (const file of list) {
    try {
      fdProgress(`Uploading ${done + 1} of ${list.length}…`);
      const exif = fdExif(await file.arrayBuffer());
      const blob = await fdResize(file);
      const path = `upload/${fdStamp()}.jpg`;
      const url = await fdUploadBlob(blob, path, "image/jpeg");
      const row = {
        url, path, source: "upload",
        taken_at: exif.takenAt || fdWallClock(new Date(file.lastModified || Date.now())),
        lat: exif.lat, lon: exif.lon
      };
      const saved = await supa("food_photos", { method: "POST", body: row });
      const photo = saved && saved[0];
      if (photo && exif.lat != null && exif.lon != null) await fdGeoTag(photo, exif.lat, exif.lon);
      done++;
    } catch (e) {
      popToast("Upload failed: " + e.message);
      break;
    }
  }
  fdProgress("");
  if (done) { popToast(done + " photo" + (done > 1 ? "s" : "") + " added 🍜"); await fdLoad(); }
}

// City/country from the photo's own GPS, via our proxy (api/geocode.js).
// Entirely optional: no coordinates, no network, or a geocoder having a bad
// day all end the same way — the photo just has no place tag.
async function fdGeoTag(photo, lat, lon) {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
    if (!res.ok) return;
    const place = await res.json();
    for (const [name, kind] of [[place.city, "city"], [place.country, "country"]]) {
      if (!name) continue;
      const tag = await fdEnsureTag(name, kind);
      if (tag) await fdLink(photo.id, tag.id);
    }
  } catch (e) { /* no place tag, no drama */ }
}

function fdProgress(msg) {
  const el = fdEl("fdProgress");
  el.textContent = msg;
  el.style.display = msg ? "block" : "none";
}

// ---------------- data ----------------
async function fdLoad() {
  if (!supaOn()) { fdReady = false; fdRender(); return; }
  try {
    const [photos, tags, links] = await Promise.all([
      supa("food_photos?select=*&order=taken_at.desc"),
      supa("food_tags?select=*&order=name.asc"),
      supa("food_photo_tags?select=photo_id,tag_id")
    ]);
    const byPhoto = {};
    (links || []).forEach(l => { (byPhoto[l.photo_id] = byPhoto[l.photo_id] || []).push(l.tag_id); });
    fdPhotos = (photos || []).map(p => ({ ...p, tags: byPhoto[p.id] || [] }));
    fdTags = tags || [];
    fdReady = true;
  } catch (e) {
    fdReady = false;
  }
  fdRender();
}

async function fdEnsureTag(name, kind) {
  const clean = name.trim();
  if (!clean) return null;
  const existing = fdTags.find(t => t.kind === kind && t.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  try {
    const rows = await supa("food_tags", { method: "POST", body: { name: clean, kind } });
    const tag = rows && rows[0];
    if (tag) fdTags.push(tag);
    return tag;
  } catch (e) {
    // a duplicate means the other phone created it a moment ago — go find it
    await fdLoad();
    return fdTags.find(t => t.kind === kind && t.name.toLowerCase() === clean.toLowerCase()) || null;
  }
}

async function fdLink(photoId, tagId) {
  try { await supa("food_photo_tags", { method: "POST", prefer: "resolution=ignore-duplicates", body: { photo_id: photoId, tag_id: tagId } }); }
  catch (e) { /* already linked */ }
  const photo = fdPhotos.find(p => p.id === photoId);
  if (photo && !photo.tags.includes(tagId)) photo.tags.push(tagId);
}

async function fdUnlink(photoId, tagId) {
  await supa(`food_photo_tags?photo_id=eq.${photoId}&tag_id=eq.${tagId}`, { method: "DELETE" });
  const photo = fdPhotos.find(p => p.id === photoId);
  if (photo) photo.tags = photo.tags.filter(t => t !== tagId);
}

async function fdDeletePhoto(photo) {
  if (!confirm("Delete this photo for both of us?")) return;
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${FD_BUCKET}/${photo.path}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY }
    });
    await supa(`food_photos?id=eq.${photo.id}`, { method: "DELETE" });
  } catch (e) { popToast("Couldn't delete: " + e.message); return; }
  fdCloseLightbox();
  popToast("Gone 🗑️");
  await fdLoad();
}

// ---------------- helpers ----------------
const fdTagById = id => fdTags.find(t => t.id === id);
const fdMonthKey = p => (p.taken_at || "").slice(0, 7);       // YYYY-MM

function fdMonthLabel(key) {
  if (!key) return "Undated";
  const [y, m] = key.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1))
    .toLocaleDateString(undefined, { month: "long", timeZone: "UTC" }) + "\n" + y;
}

// Rendered in UTC on purpose — taken_at holds a wall clock, not an instant
// (see fdExifDate), so this shows the same day on both phones.
function fdFullDate(p) {
  if (!p.taken_at) return "Date unknown";
  const d = new Date(p.taken_at);
  if (isNaN(d)) return "Date unknown";
  return d.toLocaleDateString(undefined,
    { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// Search matches a tag name or the caption — type "ramen" or "Tokyo".
function fdVisible() {
  const q = fdSearch.trim().toLowerCase();
  if (!q) return fdPhotos;
  return fdPhotos.filter(p => {
    if ((p.caption || "").toLowerCase().includes(q)) return true;
    return p.tags.some(id => {
      const t = fdTagById(id);
      return t && t.name.toLowerCase().includes(q);
    });
  });
}

// ---------------- rendering ----------------
function fdRender() {
  fdRenderStatus();
  fdRenderTagBar();
  fdRenderTagCatalogue();
  const box = fdEl("fdBody");
  box.innerHTML = "";
  if (fdReady === false) return;

  const photos = fdVisible();
  if (!photos.length) {
    const empty = document.createElement("div");
    empty.className = "fd-empty";
    empty.textContent = fdPhotos.length
      ? "Nothing matches “" + fdSearch + "” 🔍"
      : "No food yet. Upload the first plate 🍜";
    box.appendChild(empty);
    return;
  }
  if (fdGroupBy === "date") fdRenderTimeline(box, photos);
  else fdRenderByTag(box, photos, fdGroupBy);
}

// Default view: newest first, with the month running down the left.
function fdRenderTimeline(box, photos) {
  const groups = [];
  photos.forEach(p => {
    const key = fdMonthKey(p);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(p);
    else groups.push({ key, items: [p] });
  });
  groups.forEach(g => {
    const row = document.createElement("div");
    row.className = "fd-monthrow";
    const rail = document.createElement("div");
    rail.className = "fd-rail";
    rail.textContent = fdMonthLabel(g.key);
    const grid = document.createElement("div");
    grid.className = "fd-grid";
    g.items.forEach(p => grid.appendChild(fdThumb(p)));
    row.append(rail, grid);
    box.appendChild(row);
  });
}

// "Show me everything by restaurant / food type / location."
const fdKindMatches = (tagKind, view) =>
  tagKind === view || (view === "city" && tagKind === FD_LEGACY_PLACE);

function fdRenderByTag(box, photos, kind) {
  const tags = fdTags.filter(t => fdKindMatches(t.kind, kind));
  let shown = 0;
  tags.forEach(tag => {
    const items = photos.filter(p => p.tags.includes(tag.id));
    if (!items.length) return;
    shown++;
    const section = document.createElement("div");
    section.className = "fd-section";
    const head = document.createElement("div");
    head.className = "fd-sectionhead";
    head.innerHTML = "";
    const name = document.createElement("span");
    name.className = "fd-sectionname";
    name.textContent = tag.name;
    const count = document.createElement("span");
    count.className = "fd-count";
    count.textContent = items.length;
    head.append(name, count);
    const grid = document.createElement("div");
    grid.className = "fd-grid";
    items.forEach(p => grid.appendChild(fdThumb(p)));
    section.append(head, grid);
    box.appendChild(section);
  });
  const untagged = photos.filter(p => !p.tags.some(id => {
    const t = fdTagById(id); return t && fdKindMatches(t.kind, kind);
  }));
  if (untagged.length) {
    const section = document.createElement("div");
    section.className = "fd-section";
    const head = document.createElement("div");
    head.className = "fd-sectionhead";
    const name = document.createElement("span");
    name.className = "fd-sectionname fd-dim";
    name.textContent = "Not tagged yet";
    const count = document.createElement("span");
    count.className = "fd-count";
    count.textContent = untagged.length;
    head.append(name, count);
    const grid = document.createElement("div");
    grid.className = "fd-grid";
    untagged.forEach(p => grid.appendChild(fdThumb(p)));
    section.append(head, grid);
    box.appendChild(section);
  }
  if (!shown && !untagged.length) {
    const empty = document.createElement("div");
    empty.className = "fd-empty";
    empty.textContent = "No " + kind + " tags yet — open a photo to add one 🏷️";
    box.appendChild(empty);
  }
}

function fdThumb(p) {
  const cell = document.createElement("button");
  cell.className = "fd-cell";
  if (fdPicking && fdPicked.has(p.id)) cell.classList.add("sel");
  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = p.url;
  img.alt = p.caption || "food photo";
  cell.appendChild(img);
  if (fdPicking) {
    cell.addEventListener("click", () => {
      if (fdPicked.has(p.id)) fdPicked.delete(p.id); else fdPicked.add(p.id);
      fdRender();
    });
  } else {
    cell.addEventListener("click", () => fdOpenLightbox(p));
  }
  return cell;
}

function fdRenderStatus() {
  const el = fdEl("fdStatus");
  el.textContent =
    !supaOn()        ? "Local mode — Food needs Supabase (docs/SUPABASE.md)"
    : fdReady === false ? "⚠️ Run supabase/food.sql in the Supabase SQL editor to switch this tab on"
    : fdReady === true  ? fdPhotos.length + " photo" + (fdPhotos.length === 1 ? "" : "s") + " · shared 💞"
    : "Loading…";
  fdEl("fdUploadBtn").disabled = fdReady !== true;
  fdEl("fdAlbumBtn").disabled = fdReady !== true;
}

// The chips along the top: how the grid is grouped, then the tag being
// bulk-assigned (if any).
function fdRenderTagBar() {
  document.querySelectorAll("#fdViews .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.view === fdGroupBy));
  const bar = fdEl("fdPickBar");
  if (!fdPicking) { bar.style.display = "none"; return; }
  const tag = fdTagById(fdPicking);
  bar.style.display = "flex";
  fdEl("fdPickLabel").textContent = tag
    ? `Tap photos to tag “${tag.name}” · ${fdPicked.size} chosen`
    : "";
}

// Every tag we have, so you can see the vocabulary, tap one to filter by it,
// and delete the inevitable typo. Deleting a tag unlinks it from every photo
// (the FK cascades) but never touches the photos themselves.
function fdRenderTagCatalogue() {
  const box = fdEl("fdTagList");
  box.innerHTML = "";
  if (!fdTags.length) return;
  FD_KINDS.forEach(kind => {
    const mine = fdTags.filter(t => fdKindMatches(t.kind, kind.key));
    if (!mine.length) return;
    const row = document.createElement("div");
    row.className = "fd-taglist-row";
    const label = document.createElement("span");
    label.className = "fd-taglist-lbl";
    label.textContent = kind.label;
    row.appendChild(label);
    mine.forEach(tag => {
      const chip = document.createElement("span");
      chip.className = "chip fd-tagchip";
      const name = document.createElement("button");
      name.className = "fd-tagname";
      name.textContent = tag.name + " " + fdCountFor(tag.id);
      name.title = "Show photos tagged “" + tag.name + "”";
      name.addEventListener("click", () => {
        fdEl("fdSearch").value = tag.name;
        fdSearch = tag.name;
        fdRender();
      });
      const x = document.createElement("button");
      x.className = "fd-tagx";
      x.textContent = "✕";
      x.title = "Delete this tag everywhere";
      x.addEventListener("click", () => fdDeleteTag(tag));
      chip.append(name, x);
      row.appendChild(chip);
    });
    box.appendChild(row);
  });
}

const fdCountFor = id => fdPhotos.filter(p => p.tags.includes(id)).length;

async function fdDeleteTag(tag) {
  const n = fdCountFor(tag.id);
  const warn = n ? ` It's on ${n} photo${n > 1 ? "s" : ""} — they stay, they just lose the tag.` : "";
  if (!confirm(`Delete the tag “${tag.name}”?` + warn)) return;
  try {
    await supa(`food_tags?id=eq.${tag.id}`, { method: "DELETE" });
  } catch (e) { popToast("Couldn't delete that tag: " + e.message); return; }
  if (fdPicking === tag.id) { fdPicking = null; fdPicked = new Set(); }
  popToast(`“${tag.name}” removed 🏷️`);
  await fdLoad();
}

// ---------------- lightbox ----------------
function fdOpenLightbox(p) {
  fdOpenId = p.id;
  fdEl("fdLightbox").classList.add("show");
  fdRenderLightbox();
}

function fdCloseLightbox() {
  fdOpenId = null;
  fdEl("fdLightbox").classList.remove("show");
}

function fdRenderLightbox() {
  const p = fdPhotos.find(x => x.id === fdOpenId);
  if (!p) { fdCloseLightbox(); return; }
  fdEl("fdLbImg").src = p.url;
  fdEl("fdLbDate").textContent = fdFullDate(p);

  const tagBox = fdEl("fdLbTags");
  tagBox.innerHTML = "";
  p.tags.map(fdTagById).filter(Boolean).forEach(tag => {
    const chip = document.createElement("span");
    chip.className = "chip fd-tagchip";
    chip.textContent = tag.name;
    const x = document.createElement("button");
    x.className = "fd-tagx";
    x.textContent = "✕";
    x.title = "Remove this tag";
    x.addEventListener("click", async (e) => {
      e.stopPropagation();
      await fdUnlink(p.id, tag.id);
      fdRenderLightbox();
      fdRender();
    });
    chip.appendChild(x);
    tagBox.appendChild(chip);
  });
  if (!p.tags.length) {
    const none = document.createElement("span");
    none.className = "fd-dim";
    none.textContent = "No tags yet";
    tagBox.appendChild(none);
  }
}

fdEl("fdLightbox").addEventListener("click", (e) => {
  if (e.target === fdEl("fdLightbox")) fdCloseLightbox();
});
fdEl("fdLbClose").addEventListener("click", fdCloseLightbox);
fdEl("fdLbDelete").addEventListener("click", () => {
  const p = fdPhotos.find(x => x.id === fdOpenId);
  if (p) fdDeletePhoto(p);
});

// add a tag from inside the lightbox
fdEl("fdLbAdd").addEventListener("click", async () => {
  const p = fdPhotos.find(x => x.id === fdOpenId);
  const name = fdEl("fdLbTagName").value.trim();
  const kind = fdEl("fdLbTagKind").value;
  if (!p || !name) { popToast("Type a tag first 🏷️"); return; }
  const tag = await fdEnsureTag(name, kind);
  if (!tag) { popToast("Couldn't create that tag"); return; }
  await fdLink(p.id, tag.id);
  fdEl("fdLbTagName").value = "";
  fdRenderLightbox();
  fdRender();
});

// ---------------- tag creation + bulk assign ----------------
fdEl("fdNewTagBtn").addEventListener("click", async () => {
  const name = fdEl("fdNewTagName").value.trim();
  const kind = fdEl("fdNewTagKind").value;
  if (!name) { popToast("Name the tag first 🏷️"); return; }
  const tag = await fdEnsureTag(name, kind);
  if (!tag) { popToast("Couldn't create that tag"); return; }
  fdEl("fdNewTagName").value = "";
  fdPicking = tag.id;
  fdPicked = new Set();
  popToast(`Now tap every photo that's “${tag.name}” 👇`);
  fdRender();
});

fdEl("fdPickDone").addEventListener("click", async () => {
  const ids = Array.from(fdPicked);
  for (const id of ids) await fdLink(id, fdPicking);
  fdPicking = null;
  fdPicked = new Set();
  popToast(ids.length ? ids.length + " photo" + (ids.length > 1 ? "s" : "") + " tagged 🏷️" : "Nothing tagged");
  await fdLoad();
});

fdEl("fdPickCancel").addEventListener("click", () => {
  fdPicking = null;
  fdPicked = new Set();
  fdRender();
});

// ---------------- the foldable organise panel ----------------
// Everything above the photos is one tap away from folding out of sight.
// State is in memory only (no localStorage in this app), so it reopens on
// refresh — which is the right default for a search box.
let fdOrganiseOpen = true;

function fdRenderFold() {
  fdEl("fdOrganise").style.display = fdOrganiseOpen ? "block" : "none";
  fdEl("fdChev").textContent = fdOrganiseOpen ? "▾" : "▸";
  fdEl("fdFoldBtn").setAttribute("aria-expanded", String(fdOrganiseOpen));
  // folded, the island should be a slim bar rather than a tall empty panel
  const panel = fdEl("fdFoldBtn").closest(".panel");
  if (panel) panel.classList.toggle("fd-folded", !fdOrganiseOpen);
}

fdEl("fdFoldBtn").addEventListener("click", () => {
  fdOrganiseOpen = !fdOrganiseOpen;
  fdRenderFold();
});

// ---------------- toolbar ----------------
fdEl("fdUploadBtn").addEventListener("click", () => fdEl("fdFile").click());
fdEl("fdFile").addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length) fdHandleFiles(e.target.files);
  e.target.value = "";
});

fdEl("fdSearch").addEventListener("input", (e) => {
  fdSearch = e.target.value;
  fdRender();
});

document.querySelectorAll("#fdViews .chip").forEach(chip =>
  chip.addEventListener("click", () => { fdGroupBy = chip.dataset.view; fdRender(); }));

// ---------------- import from an Apple shared album ----------------
let fdAlbumPage = 1;
let fdAlbumPicked = new Set();

fdEl("fdAlbumBtn").addEventListener("click", () => {
  fdEl("fdAlbumBox").style.display = fdEl("fdAlbumBox").style.display === "none" ? "block" : "none";
});

fdEl("fdAlbumLoad").addEventListener("click", () => { fdAlbumPage = 1; fdAlbumList(); });
fdEl("fdAlbumPrev").addEventListener("click", () => { fdAlbumPage--; fdAlbumList(); });
fdEl("fdAlbumNext").addEventListener("click", () => { fdAlbumPage++; fdAlbumList(); });

function fdAlbumToken(url) {
  const m = url.match(/#([A-Za-z0-9]{8,})/) || url.match(/sharedalbum\/([A-Za-z0-9]{8,})/);
  return m ? m[1] : null;
}

async function fdAlbumList() {
  const token = fdAlbumToken(fdEl("fdAlbumUrl").value.trim());
  const grid = fdEl("fdAlbumGrid");
  const note = fdEl("fdAlbumNote");
  if (!token) { note.textContent = "That doesn't look like a shared-album link 🤔"; return; }
  note.textContent = "Loading the album…";
  grid.innerHTML = "";
  try {
    const res = await fetch(`/api/album?token=${token}&page=${fdAlbumPage}&per=24`);
    if (!res.ok) throw new Error("album " + res.status);
    const data = await res.json();
    note.textContent = `${data.total} in the album · page ${data.page} of ${data.pages} · tap to choose`;
    fdEl("fdAlbumNav").style.display = data.pages > 1 ? "flex" : "none";
    fdEl("fdAlbumPrev").disabled = data.page <= 1;
    fdEl("fdAlbumNext").disabled = data.page >= data.pages;
    (data.photos || []).forEach(ph => {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = ph.thumb;
      img.alt = "album photo";
      if (fdAlbumPicked.has(ph.guid)) img.classList.add("sel");
      img.addEventListener("click", () => {
        if (fdAlbumPicked.has(ph.guid)) { fdAlbumPicked.delete(ph.guid); img.classList.remove("sel"); }
        else { fdAlbumPicked.add(ph.guid); img.classList.add("sel"); }
        fdEl("fdAlbumImport").textContent = `⬇️ Import ${fdAlbumPicked.size}`;
      });
      grid.appendChild(img);
    });
  } catch (e) {
    note.textContent = "Couldn't load that album — is its Public Website on?";
  }
}

fdEl("fdAlbumImport").addEventListener("click", async () => {
  const token = fdAlbumToken(fdEl("fdAlbumUrl").value.trim());
  const guids = Array.from(fdAlbumPicked);
  if (!token || !guids.length) { popToast("Choose some photos first 📸"); return; }
  let done = 0;
  for (const guid of guids) {
    fdProgress(`Copying ${done + 1} of ${guids.length} from iCloud…`);
    try {
      const res = await fetch("/api/food-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, guid, supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY })
      });
      if (!res.ok) throw new Error("import " + res.status);
      const out = await res.json();
      await supa("food_photos", { method: "POST", body: {
        url: out.url, path: out.path, source: "album",
        taken_at: out.takenAt || fdWallClock()
      }});
      done++;
    } catch (e) {
      popToast("Import failed: " + e.message);
      break;
    }
  }
  fdProgress("");
  fdAlbumPicked = new Set();
  fdEl("fdAlbumImport").textContent = "⬇️ Import";
  if (done) { popToast(done + " copied in 🍜"); await fdLoad(); }
});

// Only touch the network when the tab is actually open.
TAB_HOOKS.food = () => { if (fdReady === null || fdReady === false) fdLoad(); };
