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

function renderJourneys() {
  const box = document.getElementById("jrTimeline");
  box.innerHTML = "";
  if (!journeys.length) {
    const empty = document.createElement("div");
    empty.className = "jr-empty";
    empty.textContent = "No journeys yet — add our first one ✈️";
    box.appendChild(empty);
    return;
  }
  journeys.slice().sort(JR_SORTS[jrSort] || JR_SORTS.oldest).forEach(j => {
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
      hydrateAlbum(j.album_url, photos, j.photo_guids);
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

async function fetchAlbumDirect(token) {
  const host = "p" + icloudPartition(token) + "-sharedstreams.icloud.com";
  const stream = await icloudPost(host, token, "webstream", { streamCtag: null });
  const photos = (stream.photos || [])
    .filter(p => p && p.mediaAssetType !== "video")
    .slice(0, 60);
  const guids = photos.map(p => p.photoGuid);
  const assets = guids.length
    ? await icloudPost(host, token, "webasseturls", { photoGuids: guids })
    : { items: {} };
  const urlFor = c => {
    const it = assets.items && assets.items[c];
    return it ? "https://" + it.url_location + it.url_path : null;
  };
  return photos.map(p => {
    const thumb = pickDerivative(p.derivatives, true);
    const full = pickDerivative(p.derivatives, false);
    return {
      guid: p.photoGuid,
      thumb: thumb && urlFor(thumb.checksum),
      full: (full && urlFor(full.checksum)) || (thumb && urlFor(thumb.checksum))
    };
  }).filter(p => p.thumb);
}

async function fetchAlbumViaProxy(token) {
  const res = await fetch("/api/album?token=" + token);
  if (!res.ok) throw new Error("proxy said " + res.status);
  return (await res.json()).photos || [];
}

async function fetchICloudAlbum(url) {
  const token = icloudToken(url);
  if (!token) throw new Error("not an iCloud shared-album link");
  if (albumCache[token]) return albumCache[token];
  let photos;
  try {
    // our same-origin Vercel function (api/album.js) — iCloud sends no CORS
    // headers, so browsers can't call it directly on the deployed site
    photos = await fetchAlbumViaProxy(token);
  } catch (e) {
    photos = await fetchAlbumDirect(token); // fallback if the function is down
  }
  albumCache[token] = photos;
  return photos;
}

async function hydrateAlbum(url, box, picksCsv) {
  const note = document.createElement("div");
  note.className = "jr-note";
  note.textContent = "Loading photos… 📸";
  box.appendChild(note);
  try {
    const photos = await fetchICloudAlbum(url);
    box.innerHTML = "";
    if (!photos.length) { box.remove(); return; }
    const picks = (picksCsv || "").split(",").filter(Boolean);
    const chosen = picks.length ? photos.filter(p => picks.includes(p.guid)) : [];
    const shown = chosen.length ? chosen : photos.slice(0, 6); // stale picks fall back to newest
    shown.forEach(p => {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = p.thumb;
      img.alt = "journey photo";
      img.addEventListener("click", () => openLightbox(p.full));
      box.appendChild(img);
    });
    if (!chosen.length && photos.length > 6) {
      const more = document.createElement("a");
      more.className = "jr-more";
      more.href = url;
      more.target = "_blank";
      more.rel = "noopener";
      more.textContent = "+" + (photos.length - 6) + " ↗";
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
let jrPicking = null;
let jrPickSel = [];

async function openPicker(j) {
  jrPicking = j;
  jrPickSel = (j.photo_guids || "").split(",").filter(Boolean);
  jrPickerGrid.innerHTML = "";
  jrPickerNote.textContent = "Loading album… 📸";
  jrPicker.classList.add("show");
  try {
    const photos = await fetchICloudAlbum(j.album_url);
    if (!photos.length) { jrPickerNote.textContent = "The album looks empty 🤔"; return; }
    jrPickerNote.textContent = jrPickSel.length
      ? jrPickSel.length + " chosen — tap to change"
      : "Tap the photos to show on our timeline";
    photos.forEach(p => {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = p.thumb;
      img.alt = "album photo";
      if (jrPickSel.includes(p.guid)) img.classList.add("sel");
      img.addEventListener("click", () => {
        if (jrPickSel.includes(p.guid)) {
          jrPickSel = jrPickSel.filter(g => g !== p.guid);
          img.classList.remove("sel");
        } else {
          jrPickSel.push(p.guid);
          img.classList.add("sel");
        }
        jrPickerNote.textContent = jrPickSel.length + " chosen";
      });
      jrPickerGrid.appendChild(img);
    });
  } catch (e) {
    jrPickerNote.textContent = "Couldn't load the album — is its Public Website on?";
  }
}

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
function openLightbox(src) {
  if (!src) return;
  document.getElementById("jrLightboxImg").src = src;
  jrLightbox.classList.add("show");
}
jrLightbox.addEventListener("click", () => jrLightbox.classList.remove("show"));
