// journeys.js — Lucia ♥ Riu
// Trips tab: the shared timeline (add/edit/delete/sort) plus Apple Shared
// Album embedding and the photo lightbox.

const JOURNEYS_SEED = [
  {
    id: "seed-1",
    place: "Where it all began 💞",
    start_date: "2026-06-02",
    end_date: null,
    description: "Not a trip — the departure gate for all of them. The day we became us.",
    album_url: ""
  }
];

let journeys = [];
const albumCache = {};


function jrStatusLine(msg) { document.getElementById("jrStatus").textContent = msg; }

async function loadJourneys() {
  if (!supaOn()) {
    journeys = JOURNEYS_SEED.slice();
    jrStatusLine("Local mode — set up Supabase (docs/SUPABASE.md) so journeys sync to both phones");
    renderJourneys();
    return;
  }
  try {
    journeys = await supa("journeys?select=*&order=start_date.asc");
    jrStatusLine("Synced 💞 — you both see the same timeline");
  } catch (e) {
    if (!journeys.length) journeys = JOURNEYS_SEED.slice();
    jrStatusLine("Couldn't reach Supabase — showing what we have (are we offline?)");
  }
  renderJourneys();
}

function fmtJourneyDates(start, end) {
  const opts = { month: "short", day: "numeric", year: "numeric" };
  const s = new Date(start + "T00:00:00");
  if (!end || end === start) return s.toLocaleDateString(undefined, opts);
  const e = new Date(end + "T00:00:00");
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return s.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      "–" + e.getDate() + ", " + e.getFullYear();
  }
  return s.toLocaleDateString(undefined, opts) + " → " + e.toLocaleDateString(undefined, opts);
}

// --- timeline sorting ---
let jrSort = "oldest"; // view preference, session-only

function jrDays(j) {
  const s = new Date(j.start_date + "T00:00:00");
  const e = new Date((j.end_date || j.start_date) + "T00:00:00");
  return Math.round((e - s) / 86400000) + 1;
}

const JR_SORTS = {
  oldest:   (a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0),
  latest:   (a, b) => JR_SORTS.oldest(b, a),
  shortest: (a, b) => (jrDays(a) - jrDays(b)) || JR_SORTS.oldest(a, b),
  longest:  (a, b) => (jrDays(b) - jrDays(a)) || JR_SORTS.oldest(a, b)
};

document.querySelectorAll("#jrSort .chip").forEach(ch => {
  ch.addEventListener("click", () => {
    jrSort = ch.dataset.sort;
    document.querySelectorAll("#jrSort .chip").forEach(c => c.classList.toggle("sel", c === ch));
    renderJourneys();
  });
});

// ✈️ Trips shows the trips we took. A row with status = 'planned' is a 🗓️ Trip
// Plan and belongs to 📋 Plan (js/someday.js) — same table, two views, so a
// plan graduates into a memory in place rather than being copied across.
function jrPast() { return journeys.filter(j => j.status !== "planned"); }

// ---------------- the Home card ----------------
// Lives in the Home section but is journeys data, so it renders from here
// where `journeys`, jrDays() and fmtJourneyDates() already are.
function jrRenderHomeCard() {
  const card = document.getElementById("jrHomeCard");
  if (!card) return;
  const list = (journeys || []).filter(j => j.start_date);
  document.getElementById("jrhTrips").textContent = list.length;
  document.getElementById("jrhDays").textContent =
    list.reduce((n, j) => n + jrDays(j), 0);

  // Compare dates rather than taking the last element: the query orders ASC,
  // but a local edit or the offline seed can leave `journeys` in another
  // order, and "latest" quietly becoming "whatever sorted last" is the kind
  // of bug nobody notices for months.
  const latest = list.reduce((best, j) =>
    !best || j.start_date > best.start_date ? j : best, null);

  const box = document.getElementById("jrhLatest");
  box.innerHTML = "";
  if (!latest) {
    box.textContent = "No trips logged yet — add the first one ✈️";
    document.getElementById("jrhGo").textContent = "Start the timeline →";
    return;
  }
  const place = document.createElement("div");
  place.className = "jrh-place";
  place.textContent = latest.place;        // user text — textContent, never innerHTML
  const when = document.createElement("div");
  when.className = "jrh-when";
  when.textContent = fmtJourneyDates(latest.start_date, latest.end_date);
  box.appendChild(place);
  box.appendChild(when);
  document.getElementById("jrhGo").textContent = "Plan the next one →";
}

function renderJourneys() {
  // FIRST, not last: this function early-returns when the list is empty, and
  // that's precisely when the Home card needs to say "no trips yet". Anything
  // at the bottom silently skips the empty case.
  jrRenderHomeCard();
  const box = document.getElementById("jrTimeline");
  box.innerHTML = "";
  // this render replaces every container the queued hydrations pointed at,
  // so drop them — otherwise re-renders while away from Trips pile up
  jrPendingHydration = [];
  const past = jrPast();
  if (!past.length) {
    const empty = document.createElement("div");
    empty.className = "jr-empty";
    empty.textContent = journeys.length
      ? "Nothing yet — the ones ahead of us are in 📋 Plan ✈️"
      : "No journeys yet — add our first one ✈️";
    box.appendChild(empty);
    return;
  }
  past.sort(JR_SORTS[jrSort] || JR_SORTS.oldest).forEach(j => {
    const item = document.createElement("div");
    item.className = "jr-item";
    const card = document.createElement("div");
    card.className = "panel jr-card";

    const del = document.createElement("button");
    del.className = "jr-del";
    del.textContent = "✕";
    del.title = "Delete this journey";
    del.addEventListener("click", () => deleteJourney(j));
    card.appendChild(del);

    const edit = document.createElement("button");
    edit.className = "jr-edit";
    edit.textContent = "✎";
    edit.title = "Edit this journey";
    edit.addEventListener("click", () => startEditJourney(j));
    card.appendChild(edit);

    const date = document.createElement("div");
    date.className = "jr-date";
    const days = jrDays(j);
    date.textContent = fmtJourneyDates(j.start_date, j.end_date) +
      (days > 1 ? " · " + days + " days" : "");
    card.appendChild(date);

    const place = document.createElement("div");
    place.className = "jr-place";
    place.textContent = j.place;
    card.appendChild(place);

    if (j.description) {
      const desc = document.createElement("div");
      desc.className = "jr-desc";
      desc.textContent = j.description;
      card.appendChild(desc);
    }

    if (j.album_url) {
      const photos = document.createElement("div");
      photos.className = "jr-photos";
      card.appendChild(photos);
      const link = document.createElement("a");
      link.className = "jr-albumlink";
      link.href = j.album_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Open album ↗";
      card.appendChild(link);
      const pickBtn = document.createElement("button");
      pickBtn.className = "jr-pickbtn";
      pickBtn.textContent = "🖼️ Pick photos";
      pickBtn.title = "Choose which album photos the timeline shows";
      pickBtn.addEventListener("click", () => openPicker(j));
      card.appendChild(pickBtn);
      jrHydrateWhenVisible(() => hydrateAlbum(j.album_url, photos, j.photo_guids));
    }

    item.appendChild(card);
    box.appendChild(item);
  });
}

const jrForm = document.getElementById("jrForm");
let jrEditing = null; // the journey being edited, or null when adding

function resetJrForm() {
  jrEditing = null;
  document.getElementById("jrFormTitle").textContent = "New journey";
  document.getElementById("jrSaveBtn").textContent = "💾 Save journey";
  ["jrPlace", "jrStart", "jrEnd", "jrDesc", "jrAlbum"].forEach(id => { document.getElementById(id).value = ""; });
  jrForm.style.display = "none";
}

function startEditJourney(j) {
  jrEditing = j;
  document.getElementById("jrFormTitle").textContent = "Edit journey";
  document.getElementById("jrSaveBtn").textContent = "💾 Save changes";
  document.getElementById("jrPlace").value = j.place || "";
  document.getElementById("jrStart").value = j.start_date || "";
  document.getElementById("jrEnd").value = j.end_date || "";
  document.getElementById("jrDesc").value = j.description || "";
  document.getElementById("jrAlbum").value = j.album_url || "";
  jrForm.style.display = "block";
  jrForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.getElementById("jrAddBtn").addEventListener("click", () => {
  const wasHidden = jrForm.style.display === "none";
  resetJrForm(); // always leave edit mode when toggling via the add button
  if (wasHidden) jrForm.style.display = "block";
});
document.getElementById("jrCancelBtn").addEventListener("click", resetJrForm);

document.getElementById("jrSaveBtn").addEventListener("click", async (e) => {
  const place = document.getElementById("jrPlace").value.trim();
  const start = document.getElementById("jrStart").value;
  const end = document.getElementById("jrEnd").value || null;
  const desc = document.getElementById("jrDesc").value.trim();
  const album = document.getElementById("jrAlbum").value.trim();
  if (!place) { popToast("Where did we go? Place is required 📍"); return; }
  if (!start) { popToast("When was it? Start date is required 📅"); return; }
  if (end && end < start) { popToast("We can't come home before we leave 🤨"); return; }
  const row = { place: place, start_date: start, end_date: end, description: desc, album_url: album };
  if (supaOn()) {
    try {
      if (jrEditing && typeof jrEditing.id === "number") {
        await supa("journeys?id=eq." + jrEditing.id, { method: "PATCH", body: row });
        popToast("Journey updated 💞");
      } else {
        await supa("journeys", { method: "POST", body: row });
        popToast("Journey saved — for both of us 💞");
      }
      await loadJourneys();
    } catch (err) {
      popToast("Couldn't save to Supabase 😢 (" + err.message + ")");
      return;
    }
  } else {
    if (jrEditing) {
      Object.assign(jrEditing, row);
      popToast("Updated on this phone only — Supabase makes it stick!");
    } else {
      row.id = "local-" + Date.now();
      journeys.push(row);
      popToast("Added on this phone only — Supabase makes it permanent!");
    }
    journeys.sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
    renderJourneys();
  }
  resetJrForm();
  burst(e.clientX, e.clientY, ["✈️", "🧳", "📸", "💞"]);
});

async function deleteJourney(j) {
  if (!confirm('Delete "' + j.place + '" from our timeline?')) return;
  if (supaOn() && typeof j.id === "number") {
    try { await supa("journeys?id=eq." + j.id, { method: "DELETE" }); }
    catch (err) { popToast("Couldn't delete 😢 (" + err.message + ")"); return; }
    await loadJourneys();
  } else {
    journeys = journeys.filter(x => x !== j);
    renderJourneys();
  }
  popToast("Journey removed 🗑️");
}

// --- Apple Shared Album embed ---
// Uses iCloud's (unofficial) public shared-album web API. Needs the album's
// "Public Website" toggle ON in Photos. If Apple ever breaks it, or we're
// offline, the card quietly falls back to the "Open album ↗" link.
function icloudToken(url) {
  const m = url.match(/#([A-Za-z0-9]{8,})/) || url.match(/sharedalbum\/([A-Za-z0-9]{8,})/);
  return m ? m[1] : null;
}

function icloudPartition(token) {
  const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const n = token[0] === "A"
    ? B62.indexOf(token[1])
    : B62.indexOf(token[1]) * 62 + B62.indexOf(token[2]);
  return String(n).padStart(2, "0");
}

async function icloudPost(host, token, endpoint, body, depth) {
  const res = await fetch("https://" + host + "/" + token + "/sharedstreams/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // avoids a CORS preflight iCloud won't answer
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  // iCloud may answer "wrong shard, go here instead" — follow it (max 3 hops)
  if (data && data["X-Apple-MMe-Host"] && (depth || 0) < 3) {
    return icloudPost(data["X-Apple-MMe-Host"], token, endpoint, body, (depth || 0) + 1);
  }
  if (!res.ok || !data) throw new Error("iCloud said " + res.status);
  return data;
}

function pickDerivative(derivs, wantThumb) {
  let best = null;
  Object.values(derivs || {}).forEach(d => {
    if (!d || !d.checksum || !Number(d.width)) return;
    if (!best) { best = d; return; }
    if (wantThumb) {
      if (Math.abs(Number(d.width) - 400) < Math.abs(Number(best.width) - 400)) best = d;
    } else if (Number(d.width) > Number(best.width)) {
      best = d;
    }
  });
  return best;
}

// Album media comes through api/album.js (iCloud sends no CORS headers,
// so browsers can't call sharedstreams directly) in pages of ALBUM_PER,
// with a direct-iCloud fallback if the function is unreachable. Videos are
// included: poster-frame thumb, `video: true`, `full` = playable mp4.
const ALBUM_PER = 24;

async function albumApi(token, params) {
  const res = await fetch("/api/album?token=" + token + params);
  if (!res.ok) throw new Error("proxy said " + res.status);
  return res.json();
}

async function directAlbumMeta(token) {
  const key = token + "|meta";
  if (albumCache[key]) return albumCache[key];
  const host = "p" + icloudPartition(token) + "-sharedstreams.icloud.com";
  const stream = await icloudPost(host, token, "webstream", { streamCtag: null });
  const out = { host, metas: (stream.photos || []).filter(Boolean) };
  albumCache[key] = out;
  return out;
}

function isVideoItem(p) { return p.mediaAssetType === "video"; }

function pickVideoDerivative(p) {
  let best = null;
  Object.entries(p.derivatives || {}).forEach(([k, d]) => {
    if (k === "PosterFrame" || !d || !d.checksum) return;
    if (!best || Number(d.width) > Number(best.width)) best = d;
  });
  return best;
}

async function directResolve(token, metas) {
  const { host } = await directAlbumMeta(token);
  const guids = metas.map(p => p.photoGuid);
  const assets = guids.length
    ? await icloudPost(host, token, "webasseturls", { photoGuids: guids })
    : { items: {} };
  const urlFor = c => {
    const it = assets.items && assets.items[c];
    return it ? "https://" + it.url_location + it.url_path : null;
  };
  return metas.map(p => {
    if (isVideoItem(p)) {
      const poster = (p.derivatives || {}).PosterFrame;
      const vid = pickVideoDerivative(p);
      const thumb = poster && urlFor(poster.checksum);
      return { guid: p.photoGuid, thumb: thumb, full: (vid && urlFor(vid.checksum)) || thumb, video: true };
    }
    const thumb = pickDerivative(p.derivatives, true);
    const full = pickDerivative(p.derivatives, false);
    return {
      guid: p.photoGuid,
      thumb: thumb && urlFor(thumb.checksum),
      full: (full && urlFor(full.checksum)) || (thumb && urlFor(thumb.checksum))
    };
  }).filter(p => p.thumb);
}

async function fetchAlbumPage(url, page) {
  const token = icloudToken(url);
  if (!token) throw new Error("not an iCloud shared-album link");
  const key = token + "|p" + page;
  if (albumCache[key]) return albumCache[key];
  let data;
  try {
    data = await albumApi(token, "&page=" + page + "&per=" + ALBUM_PER);
  } catch (e) {
    const meta = await directAlbumMeta(token);
    data = {
      photos: await directResolve(token, meta.metas.slice((page - 1) * ALBUM_PER, page * ALBUM_PER)),
      total: meta.metas.length,
      pages: Math.max(1, Math.ceil(meta.metas.length / ALBUM_PER)),
      page: page
    };
  }
  albumCache[key] = data;
  return data;
}

async function fetchAlbumGuids(url, guids) {
  const token = icloudToken(url);
  if (!token) throw new Error("not an iCloud shared-album link");
  const key = token + "|g" + guids.join(",");
  if (albumCache[key]) return albumCache[key];
  let photos;
  try {
    photos = (await albumApi(token, "&guids=" + guids.join(","))).photos || [];
  } catch (e) {
    const meta = await directAlbumMeta(token);
    photos = await directResolve(token, meta.metas.filter(p => guids.includes(p.photoGuid)));
  }
  albumCache[key] = photos;
  return photos;
}

// one-shot fetch of the first 60 photos — kept for callers that want the
// whole album at once (the couple-photo hero seeds its photo-of-the-day
// from this; videos are excluded so the pick is always an image and the
// pool matches the pre-pagination behavior)
async function fetchICloudAlbum(url) {
  const token = icloudToken(url);
  if (!token) throw new Error("not an iCloud shared-album link");
  const key = token + "|all";
  if (albumCache[key]) return albumCache[key];
  let photos;
  try {
    photos = (await albumApi(token, "&page=1&per=60")).photos || [];
  } catch (e) {
    const meta = await directAlbumMeta(token);
    photos = await directResolve(token, meta.metas.slice(0, 60));
  }
  photos = photos.filter(p => !p.video);
  albumCache[key] = photos;
  return photos;
}

// Thumbs are lazy, which only works because we never build them inside a
// hidden tab — see jrHydrateVisible(). A lazy image created while its
// container is display:none is never picked up by the browser's lazy-load
// observer, not even once the tab is shown; it stays blank until a scroll
// forces re-evaluation. That was the old "journey photos load slowly" bug.
function mediaThumb(p, onClick) {
  const img = document.createElement("img");
  img.loading = "lazy";
  img.decoding = "async";
  img.src = p.thumb;
  img.alt = p.video ? "journey video" : "journey photo";
  if (onClick) img.addEventListener("click", onClick);
  if (!p.video) return { el: img, img: img };
  const wrap = document.createElement("span");
  wrap.className = "jr-vwrap";
  wrap.appendChild(img);
  const badge = document.createElement("span");
  badge.className = "jr-vbadge";
  badge.textContent = "▶";
  wrap.appendChild(badge);
  return { el: wrap, img: img };
}

// --- album hydration is deferred until the Trips tab is on screen ---
// Two reasons: (1) lazy thumbs built inside a display:none tab never load
// (see mediaThumb), and (2) a growing timeline shouldn't pull every album's
// photos on every page load — a tab you never open should cost nothing.
// The JSON is still pre-warmed at idle (jrPrewarmAlbums), so opening Trips
// only has image bytes left to fetch.
let jrPendingHydration = [];

function jrHydrateWhenVisible(fn) {
  if (activeTab === "journeys") fn();
  else jrPendingHydration.push(fn);
}

function jrHydrateVisible() {
  const queued = jrPendingHydration;
  jrPendingHydration = [];
  queued.forEach(fn => fn());
}
TAB_HOOKS.journeys = jrHydrateVisible;

// Warm the album JSON (not the images) once the page is idle, so the first
// tap on Trips goes straight to loading pictures. Failures are ignored —
// hydrateAlbum will simply fetch normally.
function jrPrewarmAlbums() {
  journeys.forEach(j => {
    if (!j.album_url) return;
    const picks = (j.photo_guids || "").split(",").filter(Boolean);
    const p = picks.length ? fetchAlbumGuids(j.album_url, picks) : fetchAlbumPage(j.album_url, 1);
    p.catch(() => {});
  });
}

async function hydrateAlbum(url, box, picksCsv) {
  const note = document.createElement("div");
  note.className = "jr-note";
  note.textContent = "Loading photos… 📸";
  box.appendChild(note);
  try {
    const picks = (picksCsv || "").split(",").filter(Boolean);
    let shown = [];
    let moreCount = 0;
    if (picks.length) shown = await fetchAlbumGuids(url, picks); // exactly the picks
    if (!shown.length) { // no picks (or stale ones) — newest 6
      const pg = await fetchAlbumPage(url, 1);
      if (!pg.photos.length) { box.remove(); return; }
      shown = pg.photos.slice(0, 6);
      moreCount = Math.max(0, pg.total - shown.length);
    }
    box.innerHTML = "";
    shown.forEach(p => box.appendChild(mediaThumb(p, () => openLightbox(p)).el));
    if (moreCount > 0) {
      const more = document.createElement("a");
      more.className = "jr-more";
      more.href = url;
      more.target = "_blank";
      more.rel = "noopener";
      more.textContent = "+" + moreCount + " ↗";
      box.appendChild(more);
    }
  } catch (e) {
    note.textContent = "Couldn't load photos here — tap “Open album ↗” below (is the album's Public Website on?)";
  }
}

// --- photo picker (choose which album photos the timeline shows) ---
const jrPicker = document.getElementById("jrPicker");
const jrPickerGrid = document.getElementById("jrPickerGrid");
const jrPickerNote = document.getElementById("jrPickerNote");
const jrPickerNav = document.getElementById("jrPickerNav");
let jrPicking = null;
let jrPickSel = [];
let jrPickPage = 1;
let jrPickPages = 1;
let jrPickRender = 0; // guards against overlapping page renders

function jrPickerCount(total) {
  jrPickerNote.textContent = (total ? total + " in the album · " : "") +
    (jrPickSel.length ? jrPickSel.length + " chosen" : "tap to choose");
}

async function renderPickerPage() {
  const seq = ++jrPickRender;
  jrPickerGrid.innerHTML = "";
  jrPickerNav.style.display = "none";
  jrPickerNote.textContent = "Loading album… 📸";
  const pg = await fetchAlbumPage(jrPicking.album_url, jrPickPage);
  if (seq !== jrPickRender) return; // a newer render superseded this one
  if (!pg.total) { jrPickerNote.textContent = "The album looks empty 🤔"; return; }
  jrPickPages = pg.pages;
  if (pg.pages > 1) {
    jrPickerNav.style.display = "flex";
    document.getElementById("jrPickerPageLbl").textContent = "page " + pg.page + " / " + pg.pages;
    document.getElementById("jrPickerPrev").disabled = pg.page <= 1;
    document.getElementById("jrPickerNext").disabled = pg.page >= pg.pages;
  }
  jrPickerCount(pg.total);
  pg.photos.forEach(p => {
    const m = mediaThumb(p, null);
    if (jrPickSel.includes(p.guid)) m.img.classList.add("sel");
    m.img.addEventListener("click", () => {
      if (jrPickSel.includes(p.guid)) {
        jrPickSel = jrPickSel.filter(g => g !== p.guid);
        m.img.classList.remove("sel");
      } else {
        jrPickSel.push(p.guid);
        m.img.classList.add("sel");
      }
      jrPickerCount(pg.total);
    });
    jrPickerGrid.appendChild(m.el);
  });
}

async function openPicker(j) {
  jrPicking = j;
  jrPickSel = (j.photo_guids || "").split(",").filter(Boolean);
  jrPickPage = 1;
  jrPicker.classList.add("show");
  try {
    await renderPickerPage();
  } catch (e) {
    jrPickerGrid.innerHTML = "";
    jrPickerNote.textContent = "Couldn't load the album — is its Public Website on?";
  }
}

document.getElementById("jrPickerPrev").addEventListener("click", () => {
  if (jrPickPage > 1) { jrPickPage--; renderPickerPage().catch(() => {}); }
});
document.getElementById("jrPickerNext").addEventListener("click", () => {
  if (jrPickPage >= jrPickPages) return;
  jrPickPage++;
  renderPickerPage().catch(() => {});
});

function closePicker() {
  jrPicker.classList.remove("show");
  jrPicking = null;
}

async function savePicks(csvOrNull) {
  const j = jrPicking;
  if (!j) return;
  if (supaOn() && typeof j.id === "number") {
    try {
      await supa("journeys?id=eq." + j.id, { method: "PATCH", body: { photo_guids: csvOrNull } });
    } catch (err) {
      popToast("Couldn't save picks — run supabase/migrate_journey_photos.sql in the SQL editor first 🛠️");
      return;
    }
    await loadJourneys();
  } else {
    j.photo_guids = csvOrNull;
    renderJourneys();
  }
  closePicker();
  popToast(csvOrNull ? "Photo picks saved 🖼️" : "Back to the newest 6 📸");
}

document.getElementById("jrPickerSave").addEventListener("click", () => {
  if (!jrPickSel.length) { popToast("Pick at least one — or tap “Newest 6 instead”"); return; }
  savePicks(jrPickSel.join(","));
});
document.getElementById("jrPickerClear").addEventListener("click", () => savePicks(null));
document.getElementById("jrPickerCancel").addEventListener("click", closePicker);

const jrLightbox = document.getElementById("jrLightbox");
const jrLightboxImg = document.getElementById("jrLightboxImg");
const jrLightboxVid = document.getElementById("jrLightboxVid");

function openLightbox(p) {
  if (typeof p === "string") p = { full: p }; // tolerate plain-URL callers
  if (!p || !p.full) return;
  const isVid = !!p.video;
  jrLightboxImg.style.display = isVid ? "none" : "block";
  jrLightboxVid.style.display = isVid ? "block" : "none";
  if (isVid) {
    jrLightboxVid.src = p.full;
    jrLightboxVid.poster = p.thumb || "";
    jrLightboxVid.play().catch(() => {});
  } else {
    jrLightboxImg.src = p.full;
  }
  jrLightbox.classList.add("show");
}
jrLightbox.addEventListener("click", (e) => {
  if (e.target === jrLightboxVid) return; // let the video controls work
  jrLightbox.classList.remove("show");
  jrLightboxVid.pause();
  jrLightboxVid.removeAttribute("src");
});
