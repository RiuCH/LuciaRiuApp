// Copy a photo out of an Apple Shared Album and into our own storage.
//
//   POST /api/food-import  { token, guid }  →  { url, path, takenAt }
//
// Why copy rather than link: iCloud hands out *signed* asset URLs that expire
// within hours. Linking to one would give us a gallery full of dead images by
// next month — so the bytes are fetched here and re-uploaded to the Supabase
// `food` bucket, exactly like an upload from the phone.
//
// It has to happen server-side: the browser can't fetch iCloud bytes (no CORS
// headers), and this is the same reason api/album.js exists.

const B62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function partition(token) {
  const n = token[0] === "A"
    ? B62.indexOf(token[1])
    : B62.indexOf(token[1]) * 62 + B62.indexOf(token[2]);
  return String(n).padStart(2, "0");
}

async function icloudPost(host, token, endpoint, body, depth = 0) {
  const res = await fetch(`https://${host}/${token}/sharedstreams/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (data && data["X-Apple-MMe-Host"] && depth < 3) {
    return icloudPost(data["X-Apple-MMe-Host"], token, endpoint, body, depth + 1);
  }
  if (!res.ok || !data) {
    const err = new Error("iCloud said " + res.status);
    err.status = res.status;
    throw err;
  }
  return data;
}

// The biggest still-image derivative — for a photo that's the full-size one.
function bestDerivative(p) {
  let best = null;
  for (const [key, d] of Object.entries(p.derivatives || {})) {
    if (!d || !d.checksum) continue;
    if (p.mediaAssetType === "video" && key !== "PosterFrame") continue;
    if (!best || Number(d.width || 0) > Number(best.width || 0)) best = d;
  }
  return best;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const token = String(body.token || "");
  const guid = String(body.guid || "");
  const supaUrl = String(body.supabaseUrl || "").replace(/\/$/, "");
  const supaKey = String(body.supabaseKey || "");
  // The bearer authorises (a user JWT since the bucket went us-only); the
  // apikey only identifies the project. They used to be the same anon key.
  // Falling back keeps an older client working rather than 401ing it.
  const supaAnon = String(body.supabaseAnonKey || body.supabaseKey || "");
  if (!/^[A-Za-z0-9]{8,40}$/.test(token) || !guid) { res.status(400).json({ error: "bad token or guid" }); return; }
  if (!supaUrl || !supaKey) { res.status(400).json({ error: "missing storage config" }); return; }

  try {
    const host = `p${partition(token)}-sharedstreams.icloud.com`;
    const stream = await icloudPost(host, token, "webstream", { streamCtag: null });
    const photo = (stream.photos || []).find(p => p.photoGuid === guid);
    if (!photo) { res.status(404).json({ error: "not in this album" }); return; }

    const deriv = bestDerivative(photo);
    if (!deriv) { res.status(404).json({ error: "no usable image" }); return; }

    const assets = await icloudPost(host, token, "webasseturls", { photoGuids: [guid] });
    const item = assets.items && assets.items[deriv.checksum];
    if (!item) { res.status(404).json({ error: "no asset url" }); return; }

    const imgRes = await fetch(`https://${item.url_location}${item.url_path}`);
    if (!imgRes.ok) throw new Error("iCloud image fetch " + imgRes.status);
    const bytes = Buffer.from(await imgRes.arrayBuffer());
    const type = imgRes.headers.get("content-type") || "image/jpeg";

    const path = `album/${guid}.jpg`;
    const put = await fetch(`${supaUrl}/storage/v1/object/food/${path}`, {
      method: "POST",
      headers: {
        apikey: supaAnon,
        Authorization: "Bearer " + supaKey,
        "Content-Type": type,
        "x-upsert": "true"
      },
      body: bytes
    });
    if (!put.ok) {
      const detail = await put.text();
      const err = new Error("storage said " + put.status + " " + detail.slice(0, 120));
      err.status = put.status === 400 || put.status === 404 ? 409 : 502;
      throw err;
    }

    res.status(200).json({
      url: `${supaUrl}/storage/v1/object/public/food/${path}`,
      path,
      // the album gives us the capture date; EXIF isn't available out here
      takenAt: photo.dateCreated || photo.batchDateCreated || null,
      bytes: bytes.length
    });
  } catch (e) {
    res.status(e.status || 502).json({ error: String(e.message || e) });
  }
}
