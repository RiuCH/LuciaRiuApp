// where.js — Lucia ♥ Riu
// 📍 Where we are: each of us publishes the CITY we were in the last time we
// opened the app, and Home shows both plus the distance between them.
//
// NOT LIVE TRACKING, and it can't be. A browser suspends JavaScript the moment
// the app leaves the foreground — iOS especially — so there is no background
// position to read. What this answers is "where were you when you last opened
// this", which for two people 1,800 miles apart is the question that actually
// matters. Live tracking needs a native app; Find My already does it well.
//
// COARSE ON PURPOSE. Coordinates are rounded to three decimals (~1km) before
// they leave the phone — the same rounding api/geocode.js already applies —
// and what's displayed is a city, never a pin. Precision can be added later;
// it cannot be un-stored.
//
// Opt-in per person, and THE ROW IS THE OPT-IN: sharing writes
// settings.where_<me>, stopping deletes it. One piece of state, so the
// preference and the data can never disagree.

const WH_PEOPLE = ["lucia", "riu"];
const WH_STALE_MS = 5 * 60 * 1000;   // refresh on open if older than this
const WH_ROUND = 1000;               // 3 decimals ≈ 1km

let whWhere = {};        // { lucia: {...}, riu: {...} } — whatever is published
let whBusy = false;

const whKey = who => "where_" + who;
const whName = who => (who === "lucia" ? "Lucia" : "Riu");

// Which of us is on this phone. Reuses the app's existing `#me`, the same
// answer the duel and 20 Questions use — one identity, asked once.
function whMe() { return typeof wdMe !== "undefined" ? wdMe : null; }

function whMine() { const me = whMe(); return me ? whWhere[me] : null; }
function whSharing() { return !!whMine(); }

// ---------------- distance ----------------
// Haversine. Both points are already rounded to ~1km, so a great-circle
// approximation is far more precision than the inputs deserve.
function whMiles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 3958.8;                                   // earth radius, miles
  const rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function whAgo(at) {
  if (!at) return "";
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}

// ---------------- the position ----------------
// enableHighAccuracy stays OFF: a city name doesn't need GPS, and asking for it
// spins up the radio and drains the battery for nothing.
function whPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("no geolocation here")); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({
        lat: Math.round(p.coords.latitude * WH_ROUND) / WH_ROUND,
        lon: Math.round(p.coords.longitude * WH_ROUND) / WH_ROUND
      }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

// City and country from the serverless reverse-geocoder the Food tab already
// uses. A failure here is not fatal — we still know the distance.
async function whPlace(pt) {
  try {
    const res = await fetch(`/api/geocode?lat=${pt.lat}&lon=${pt.lon}`);
    if (!res.ok) throw new Error("geocode " + res.status);
    const out = await res.json();
    return { city: out.city || "", country: out.country || "" };
  } catch (e) { return { city: "", country: "" }; }
}

// ---------------- sync ----------------
async function whLoad() {
  if (!supaOn()) { whRender(); return; }
  try {
    const rows = await supa("settings?key=in.(" + WH_PEOPLE.map(whKey).join(",") + ")&select=key,value");
    const next = {};
    (rows || []).forEach(r => {
      const who = r.key.replace("where_", "");
      try { next[who] = JSON.parse(r.value); } catch (e) { /* ignore a bad row */ }
    });
    whWhere = next;
  } catch (e) { /* signed out or offline — keep whatever we had */ }
  whRender();
}

async function whPublish(announce) {
  const me = whMe();
  if (!me) { popToast("Pick who you are first 😌"); return false; }
  if (!supaOn()) { popToast("Needs the backend — nothing to share with"); return false; }
  whBusy = true; whRender();
  try {
    const pt = await whPosition();
    const place = await whPlace(pt);
    const mine = { lat: pt.lat, lon: pt.lon, city: place.city, country: place.country, at: Date.now() };
    await supa("settings?on_conflict=key", {
      method: "POST", prefer: "resolution=merge-duplicates",
      body: { key: whKey(me), value: JSON.stringify(mine) }
    });
    whWhere[me] = mine;
    if (announce) popToast("Sharing where you are 📍");
    return true;
  } catch (e) {
    // PERMISSION_DENIED is 1. Anything else is the phone failing to get a fix.
    popToast(e && e.code === 1
      ? "Location is blocked for this site — allow it in your browser settings"
      : "Couldn't get a location just now 🤔");
    return false;
  } finally {
    whBusy = false; whRender();
  }
}

async function whStop() {
  const me = whMe();
  if (!me) return;
  delete whWhere[me];
  whRender();
  try { await supa("settings?key=eq." + whKey(me), { method: "DELETE" }); }
  catch (e) { popToast("Couldn't stop sharing — try again"); }
  whRender();
}

// Refresh on open, but only if what's stored has gone stale. Opening the app
// three times in a minute shouldn't cost three position fixes.
function whRefreshIfStale() {
  const mine = whMine();
  if (!mine || whBusy) return;
  if (Date.now() - (mine.at || 0) < WH_STALE_MS) return;
  whPublish(false);
}

// ---------------- render ----------------
function whLabel(who) {
  const w = whWhere[who];
  if (!w) return null;
  const place = w.city || (w.country || "somewhere");
  return { place, ago: whAgo(w.at) };
}

// Distance, said with some warmth. The number alone is a bit clinical for a
// panel that sits under "Miles apart, same heart".
function whDistanceLine(miles) {
  if (miles === null) return "";
  if (miles < 1)  return "Same place, same second 💞";
  if (miles < 30) return miles + " miles — practically neighbours 💞";
  return miles.toLocaleString() + " miles apart · same sky though 💫";
}

// One end of the little map: pin, place, name, when.
function whPin(who) {
  const w = whWhere[who];
  const box = document.createElement("div");
  box.className = "wh-pin" + (w ? "" : " wh-quiet");

  const dot = document.createElement("div");
  dot.className = "wh-dot";
  dot.textContent = w ? "📍" : "·";
  const place = document.createElement("div");
  place.className = "wh-place";
  place.textContent = w ? (w.city || w.country || "somewhere") : "not sharing";
  const nm = document.createElement("div");
  nm.className = "wh-who";
  nm.textContent = whName(who);
  const ago = document.createElement("div");
  ago.className = "wh-ago";
  ago.textContent = w ? whAgo(w.at) : "";

  box.appendChild(dot); box.appendChild(place); box.appendChild(nm); box.appendChild(ago);
  return box;
}

function whRender() {
  const panel = document.getElementById("wherePanel");
  if (!panel) return;
  const map = document.getElementById("whereLine");
  const hint = document.getElementById("whereHint");
  const miles = whMiles(whWhere.lucia, whWhere.riu);
  const together = miles !== null && miles < 1;

  // Lucia on the left, Riu on the right — same order as the clocks above, so
  // your eye doesn't have to re-learn which side is whom.
  map.innerHTML = "";
  map.appendChild(whPin("lucia"));

  const link = document.createElement("div");
  link.className = "wh-link" + (together ? " wh-together" : "");
  const icon = document.createElement("span");
  icon.className = "wh-icon";
  // ✈️ when there's a journey between us; 💞 when there isn't one to make
  icon.textContent = miles === null ? "·  ·  ·" : together ? "💞" : "✈️";
  link.appendChild(icon);
  map.appendChild(link);

  map.appendChild(whPin("riu"));

  hint.textContent = whBusy ? "Finding you…"
    : miles === null ? "Both of you sharing turns this into a map 📍"
    : whDistanceLine(miles);

  // the Settings row
  const btn = document.getElementById("whereToggle");
  if (btn) {
    btn.textContent = whSharing() ? "📍 Stop sharing" : "📍 Share where I am";
    btn.classList.toggle("toggled", whSharing());
    btn.disabled = whBusy;
  }
  const st = document.getElementById("whereStatus");
  if (st) {
    st.textContent = !whMe()
      ? "Pick who you are on this phone first — the chips in 🎮 Games"
      : whSharing()
        ? "Sharing your city with " + whName(whMe() === "lucia" ? "riu" : "lucia") +
          " — refreshed whenever you open the app"
        : "Off. Nothing about your location is stored.";
  }
}

// ---------------- wiring ----------------
if (document.getElementById("whereToggle")) {
  document.getElementById("whereToggle").addEventListener("click", () => {
    if (whSharing()) whStop(); else whPublish(true);
  });
}
