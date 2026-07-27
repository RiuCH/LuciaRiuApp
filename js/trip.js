// trip.js — Lucia ♥ Riu  (task F1: the day-by-day itinerary)
//
// Opens from a planned trip in 📋 Plan → 🗓️ Trip Plan. The trip already knows
// its dates, so the days are DERIVED from them — there's no `trip_days` table
// to drift out of sync. A place with `day_date = null` is one we've saved but
// haven't scheduled, which is the bucket every itinerary needs.
//
// Keyless by design (agreed 2026-07-26): this is built on OpenStreetMap and
// Wikipedia, not Google Places, so there is **no ratings field anywhere** —
// OSM has none, and a column nobody can fill is worse than an absent one.
// Search/autofill (F2), the map and travel times (F3) and hotel/flight
// documents (F4) land on top of this; F1 needs no external APIs at all.
//
// Needs supabase/trip_places.sql run once.

const TR_KINDS = [
  { key: "see",    label: "📍 See" },
  { key: "eat",    label: "🍜 Eat" },
  { key: "hotel",  label: "🏨 Stay" },
  { key: "flight", label: "✈️ Travel" },
  { key: "other",  label: "✨ Other" }
];

let trTrip = null;      // the journeys row we're planning, or null for the list
let trPlaces = [];      // rows for that trip
let trReady = null;     // null unknown · true table exists · false needs the SQL
let trMoving = null;    // the place being assigned to a day

const trEl = id => document.getElementById(id);
const trKind = k => TR_KINDS.find(x => x.key === k) || TR_KINDS[0];

// ---------------- days come from the trip, not a table ----------------
function trDays(trip) {
  const out = [];
  if (!trip || !trip.start_date) return out;
  const start = new Date(trip.start_date + "T12:00:00Z");
  const end = new Date((trip.end_date || trip.start_date) + "T12:00:00Z");
  if (isNaN(start) || isNaN(end) || end < start) return out;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
    if (out.length > 60) break;          // a sane ceiling, not a real trip length
  }
  return out;
}

// Rendered in UTC because these are calendar dates, not instants — the same
// rule food.taken_at and gifts.given_on follow, and for the same reason.
function trDayLabel(iso, index) {
  const d = new Date(iso + "T12:00:00Z");
  return "Day " + (index + 1) + " · " +
    d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

// ---------------- data ----------------
async function trLoad() {
  if (!trTrip) return;
  if (!supaOn() || (typeof authSignedIn === "function" && !authSignedIn())) {
    trReady = null;
    trRender();
    return;
  }
  try {
    trPlaces = await supa("trip_places?select=*&journey_id=eq." + trTrip.id +
                          "&order=day_date.asc,position.asc") || [];
    trReady = true;
  } catch (e) {
    trReady = false;
  }
  trRender();
}

async function trAdd(fields) {
  const row = Object.assign({ journey_id: trTrip.id, position: trNextPosition(fields.day_date) }, fields);
  try {
    await supa("trip_places", { method: "POST", body: row });
    popToast("Added 📍");
    await trLoad();
  } catch (e) { popToast("Couldn't add that: " + e.message); }
}

async function trPatch(place, fields) {
  try {
    await supa("trip_places?id=eq." + place.id, { method: "PATCH", body: fields });
    Object.assign(place, fields);
    trRender();
  } catch (e) { popToast("Couldn't save that: " + e.message); }
}

async function trDelete(place) {
  if (!confirm('Remove "' + place.name + '" from the plan?')) return;
  try {
    await supa("trip_places?id=eq." + place.id, { method: "DELETE" });
    trPlaces = trPlaces.filter(p => p.id !== place.id);
    popToast("Removed 🗑️");
    trRender();
  } catch (e) { popToast("Couldn't remove that: " + e.message); }
}

const trOn = day => trPlaces
  .filter(p => (p.day_date || null) === (day || null))
  .sort((a, b) => (a.position - b.position));

function trNextPosition(day) {
  const list = trOn(day || null);
  return list.length ? Math.max.apply(null, list.map(p => p.position || 0)) + 1 : 0;
}

// Reordering writes only the two rows that actually swap, not the whole day.
async function trMove(place, by) {
  const list = trOn(place.day_date);
  const i = list.findIndex(p => p.id === place.id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return;
  const other = list[j];
  const a = place.position, b = other.position;
  await Promise.all([
    trPatch(place, { position: b }),
    trPatch(other, { position: a })
  ]);
  trRender();
}

// ---------------- open / close ----------------
// The planner lives inside 📋 Plan, but a finished trip's itinerary is worth
// re-reading from ✈️ Trips — so trOpen() remembers which tab sent us and the
// ‹ button hands you back there instead of stranding you in Plan.
let trBackTab = null;

function trOpen(trip, fromTab) {
  trBackTab = fromTab || null;
  trTrip = trip;
  trPlaces = [];
  trReady = null;
  trEl("tpList").style.display = "none";
  trEl("trPlanner").style.display = "";
  trEl("trTripName").textContent = "✈️ " + trip.place;
  const days = trDays(trip);
  trEl("trTripDates").textContent = days.length
    ? days.length + (days.length === 1 ? " day" : " days") + " · " +
      [trip.start_date, trip.end_date].filter(Boolean).join(" → ")
    : "No dates set — add them to the trip to get a day-by-day plan";
  trRender();
  trLoad();
  trEl("trPlanner").scrollIntoView({ behavior: "smooth", block: "start" });
}

// `goBack` is only true for the ‹ button. planShow() also calls this, to stop
// a planner left open in one sub-view from hiding #tpList in the next — and
// that call must not bounce the user to another tab.
function trClose(goBack) {
  const back = trBackTab;
  trBackTab = null;
  trTrip = null;
  trEl("trPlanner").style.display = "none";
  trEl("tpList").style.display = "";
  if (goBack === true && back && typeof switchTab === "function") switchTab(back);
}

// ---------------- rendering ----------------
function trRender() {
  if (!trTrip) return;
  const status = trEl("trStatus");
  status.textContent =
    !supaOn() ? "Local mode — the itinerary needs Supabase"
    : (typeof authSignedIn === "function" && !authSignedIn()) ? "Sign in to plan together"
    : trReady === false ? "⚠️ Run supabase/trip_places.sql to switch this on"
    : trReady === true ? trPlaces.length + (trPlaces.length === 1 ? " place" : " places") + " · shared 💞"
    : "Loading…";
  trEl("trAddBtn").disabled = trReady !== true;

  const box = trEl("trDays");
  box.innerHTML = "";
  if (trReady !== true) return;

  // the unscheduled bucket first — it's the inbox you add into
  box.appendChild(trDayBlock(null, "🗂️ Saved for this trip", "Nothing saved yet"));
  trDays(trTrip).forEach((iso, i) => {
    box.appendChild(trDayBlock(iso, trDayLabel(iso, i), "Nothing planned — tap a saved place to move it here"));
  });
}

function trDayBlock(iso, title, emptyText) {
  const wrap = document.createElement("div");
  wrap.className = "panel tr-day" + (iso ? "" : " tr-saved");

  const head = document.createElement("div");
  head.className = "tr-dayhead";
  const h = document.createElement("span");
  h.className = "tr-daytitle";
  h.textContent = title;
  head.appendChild(h);
  const list = trOn(iso);
  if (list.length) {
    const n = document.createElement("span");
    n.className = "tr-daycount";
    n.textContent = list.length;
    head.appendChild(n);
  }
  wrap.appendChild(head);

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "tr-empty";
    empty.textContent = emptyText;
    wrap.appendChild(empty);
    return wrap;
  }
  list.forEach((p, i) => wrap.appendChild(trPlaceRow(p, i, list.length)));
  return wrap;
}

function trPlaceRow(place, index, total) {
  const row = document.createElement("div");
  row.className = "tr-place";

  const main = document.createElement("button");
  main.className = "tr-placemain";
  const name = document.createElement("span");
  name.className = "tr-name";
  name.textContent = trKind(place.kind).label.split(" ")[0] + " " + place.name;
  main.appendChild(name);
  const bits = [place.address, place.note, place.recommended_by && "· " + place.recommended_by]
    .filter(Boolean).join(" ");
  if (bits) {
    const sub = document.createElement("span");
    sub.className = "tr-sub";
    sub.textContent = bits;
    main.appendChild(sub);
  }
  main.addEventListener("click", () => trOpenMove(place));
  row.appendChild(main);

  const tools = document.createElement("span");
  tools.className = "tr-tools";
  if (total > 1) {
    [["↑", -1], ["↓", 1]].forEach(([glyph, by], k) => {
      const b = document.createElement("button");
      b.textContent = glyph;
      b.title = by < 0 ? "Move up" : "Move down";
      b.disabled = (by < 0 && index === 0) || (by > 0 && index === total - 1);
      b.addEventListener("click", (e) => { e.stopPropagation(); trMove(place, by); });
      tools.appendChild(b);
    });
  }
  const del = document.createElement("button");
  del.textContent = "✕";
  del.title = "Remove";
  del.addEventListener("click", (e) => { e.stopPropagation(); trDelete(place); });
  tools.appendChild(del);
  row.appendChild(tools);
  return row;
}

// ---------------- tap to assign ----------------
// Drag-and-drop is task F5. Tapping works on a phone the first time, every
// time, which dragging emphatically does not.
function trOpenMove(place) {
  trMoving = place;
  const box = trEl("trMoveList");
  box.innerHTML = "";
  const add = (iso, label) => {
    const b = document.createElement("button");
    b.className = "chip tr-movechip" + ((place.day_date || null) === (iso || null) ? " sel" : "");
    b.textContent = label;
    b.addEventListener("click", async () => {
      trCloseMove();
      if ((place.day_date || null) === (iso || null)) return;
      await trPatch(place, { day_date: iso, position: trNextPosition(iso) });
      await trLoad();
      popToast(iso ? "Moved 📍" : "Back to saved 🗂️");
    });
    box.appendChild(b);
  };
  add(null, "🗂️ Saved");
  trDays(trTrip).forEach((iso, i) => add(iso, trDayLabel(iso, i)));
  trEl("trMoveName").textContent = place.name;
  trEl("trMove").classList.add("show");
}

function trCloseMove() {
  trMoving = null;
  trEl("trMove").classList.remove("show");
}

// ---------------- wiring ----------------
if (trEl("trPlanner")) {
  trEl("trBack").addEventListener("click", () => trClose(true));
  trEl("trMove").addEventListener("click", (e) => { if (e.target === trEl("trMove")) trCloseMove(); });
  trEl("trMoveCancel").addEventListener("click", trCloseMove);

  trEl("trAddBtn").addEventListener("click", () => {
    const form = trEl("trForm");
    form.style.display = form.style.display === "none" ? "block" : "none";
  });
  trEl("trCancel").addEventListener("click", () => { trEl("trForm").style.display = "none"; });

  TR_KINDS.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k.key;
    opt.textContent = k.label;
    trEl("trKind").appendChild(opt);
  });

  trEl("trSave").addEventListener("click", async () => {
    const name = trEl("trName").value.trim();
    if (!name) { popToast("What are we going to? 📍"); return; }
    const day = trEl("trDay").value || null;
    await trAdd({
      name: name,
      kind: trEl("trKind").value,
      day_date: day,
      address: trEl("trAddress").value.trim() || null,
      note: trEl("trNote").value.trim() || null,
      recommended_by: trEl("trBy").value.trim() || null
    });
    ["trName", "trAddress", "trNote", "trBy"].forEach(id => { trEl(id).value = ""; });
    // Reset the KIND but keep the day: adding three things to Day 2 in a row is
    // normal, whereas inheriting "🏨 Stay" onto the next sight silently files it
    // wrong — and a mislabelled place is data, not just a cosmetic slip.
    trEl("trKind").value = "see";
    trEl("trForm").style.display = "none";
  });

  // the day dropdown is rebuilt each time the form opens, from the trip's dates
  trEl("trAddBtn").addEventListener("click", () => {
    const sel = trEl("trDay");
    sel.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "🗂️ Save for later";
    sel.appendChild(none);
    trDays(trTrip).forEach((iso, i) => {
      const o = document.createElement("option");
      o.value = iso;
      o.textContent = trDayLabel(iso, i);
      sel.appendChild(o);
    });
  });
}
