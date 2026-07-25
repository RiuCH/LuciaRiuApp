// Reverse geocoding for the 🍜 Food tab: GPS out of a photo's EXIF, city and
// country back.
//
// This runs server-side for two reasons: OpenStreetMap's Nominatim sends no
// CORS headers the browser would accept for this, and their usage policy asks
// for an identifying User-Agent and no more than one request a second — both
// of which we can only honour from here.
//
// Coordinates are rounded to ~1km before they leave us (three decimals) and
// nothing else about the photo is sent. Results are cached per rounded
// coordinate, so a whole dinner's worth of photos costs one lookup.
//
//   GET /api/geocode?lat=37.7749&lon=-122.4194  →  { city, country }
//
// The Food tab treats a failure here as "no place tag" and carries on.

const cache = new Map();        // "lat,lon" → { city, country }
const MAX_CACHE = 500;
let lastCall = 0;               // Nominatim asks for ≤ 1 request/second

const sleep = ms => new Promise(r => setTimeout(r, ms));

function pickCity(addr) {
  if (!addr) return "";
  return addr.city || addr.town || addr.village || addr.municipality ||
         addr.suburb || addr.county || addr.state || "";
}

export default async function handler(req, res) {
  const lat = Number((req.query || {}).lat);
  const lon = Number((req.query || {}).lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: "bad coordinates" });
    return;
  }

  // ~1km of precision is plenty to name a city, and it makes the cache useful
  const key = lat.toFixed(3) + "," + lon.toFixed(3);
  if (cache.has(key)) {
    res.setHeader("Cache-Control", "s-maxage=86400");
    res.status(200).json({ ...cache.get(key), cached: true });
    return;
  }

  try {
    const wait = 1100 - (Date.now() - lastCall);
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();

    const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12" +
                "&lat=" + encodeURIComponent(lat.toFixed(3)) +
                "&lon=" + encodeURIComponent(lon.toFixed(3));
    const r = await fetch(url, {
      headers: {
        // Nominatim's policy: identify the app and give them a contact
        "User-Agent": "LuciaRiuApp/1.0 (https://lucia-riu-app.vercel.app)",
        "Accept-Language": "en"
      }
    });
    if (!r.ok) throw new Error("nominatim said " + r.status);
    const data = await r.json();
    const out = {
      city: pickCity(data.address),
      country: (data.address && data.address.country) || ""
    };
    if (cache.size > MAX_CACHE) cache.clear();
    cache.set(key, out);
    res.setHeader("Cache-Control", "s-maxage=86400");
    res.status(200).json(out);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
