// Vercel serverless proxy for Apple Shared Albums.
// iCloud's sharedstreams API sends no CORS headers, so browsers can't call
// it directly — this endpoint does the fetch server-side (same origin).
//
//   GET /api/album?token=X&page=2&per=24   → one page of media + counts
//   GET /api/album?token=X&guids=a,b,c     → just those items (photo picks)
//
// Response: { photos: [{guid, thumb, full, video?}], total, page, per,
// pages, name }. Videos are included with their PosterFrame as the thumb
// and the largest video rendition as `full`. The app still degrades to an
// "Open album" link if this endpoint is unreachable.

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
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  // "wrong shard, go here instead" — follow it
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

const isVideo = p => p.mediaAssetType === "video";

function pickImageDerivative(p, wantThumb) {
  if (isVideo(p)) return (p.derivatives || {}).PosterFrame || null;
  let best = null;
  for (const d of Object.values(p.derivatives || {})) {
    if (!d || !d.checksum || !Number(d.width)) continue;
    if (!best) { best = d; continue; }
    if (wantThumb) {
      if (Math.abs(Number(d.width) - 400) < Math.abs(Number(best.width) - 400)) best = d;
    } else if (Number(d.width) > Number(best.width)) {
      best = d;
    }
  }
  return best;
}

function pickVideoDerivative(p) {
  let best = null;
  for (const [key, d] of Object.entries(p.derivatives || {})) {
    if (key === "PosterFrame" || !d || !d.checksum) continue;
    if (!best || Number(d.width) > Number(best.width)) best = d;
  }
  return best;
}

// --- album metadata cache -------------------------------------------------
// Measured on our 365-photo "SF trip" album: iCloud's `webstream` call takes
// ~50 SECONDS and returns 217KB describing every photo, while `webasseturls`
// (the signed links we actually need) takes ~1s. We were paying that 50s on
// every single request — including each of the picker's 61 pages.
//
// That metadata barely changes, so keep it per-token on the warm instance and
// serve it stale while refreshing in the background: only the first request
// on a cold instance waits. Asset URLs are still fetched fresh every time, so
// nothing served to the browser is ever an expired link. The one trade-off is
// that photos added to the album in the last META_TTL may not appear yet.
const META_TTL_MS = 60 * 60 * 1000;   // refresh in the background after an hour
const metaCache = new Map();          // token -> { at, photos, name, refreshing }

// Supabase gives the cache a home that survives cold starts. Env vars win so
// the keys can be rotated in the Vercel dashboard; the literals are the same
// public anon credentials the client already ships (see docs/SUPABASE.md).
const SB_URL = process.env.SUPABASE_URL || "https://kpoxnurehcggqgbkptrf.supabase.co";
const SB_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb3hudXJlaGNnZ3FnYmtwdHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NjQ2NzYsImV4cCI6MjEwMDQ0MDY3Nn0.pK8zXiJnB0iwxAmy2gGXMIE7rGAM6mkui3UbzM5KQAc";

// Store only what the response builder reads — guid, media type and the
// derivative checksums/sizes. Never the signed asset URLs: those expire, and
// webasseturls re-issues them on every request anyway.
function slimPhoto(p) {
  const derivatives = {};
  Object.entries(p.derivatives || {}).forEach(([k, d]) => {
    if (d && d.checksum) {
      derivatives[k] = { checksum: d.checksum, width: d.width, height: d.height, fileSize: d.fileSize };
    }
  });
  return { photoGuid: p.photoGuid, mediaAssetType: p.mediaAssetType, derivatives };
}

async function sbFetch(path, opts) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    method: (opts && opts.method) || "GET",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...(opts && opts.prefer ? { Prefer: opts.prefer } : {})
    },
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined
  });
}

async function sbReadMeta(token) {
  const res = await sbFetch(`album_cache?token=eq.${encodeURIComponent(token)}&select=name,photos,fetched_at`);
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  const rows = await res.json();
  if (!rows || !rows.length) return null;
  const r = rows[0];
  return { at: new Date(r.fetched_at).getTime(), photos: r.photos || [], name: r.name || "" };
}

async function sbWriteMeta(token, entry) {
  await sbFetch("album_cache?on_conflict=token", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      token,
      name: entry.name,
      photos: entry.photos,
      fetched_at: new Date(entry.at).toISOString()
    }
  });
}

async function fetchMeta(token) {
  const host = `p${partition(token)}-sharedstreams.icloud.com`;
  const stream = await icloudPost(host, token, "webstream", { streamCtag: null });
  const entry = {
    at: Date.now(),
    photos: (stream.photos || []).filter(Boolean).map(slimPhoto),
    name: stream.streamName || ""
  };
  metaCache.set(token, entry);
  sbWriteMeta(token, entry).catch(() => {}); // cache miss next time, nothing worse
  return entry;
}

function refreshInBackground(token, hit) {
  if (hit.refreshing) return;
  hit.refreshing = true;
  fetchMeta(token).catch(() => { hit.refreshing = false; }); // keep serving what we have
}

// Three tiers, each only reached when the one above misses: warm instance
// memory (instant) → Supabase (~100ms, survives cold starts) → iCloud (~50s).
// Anything already cached is served immediately and refreshed in the
// background, so only a genuinely first-ever fetch makes someone wait.
async function albumMeta(token) {
  const hit = metaCache.get(token);
  if (hit) {
    if (Date.now() - hit.at > META_TTL_MS) refreshInBackground(token, hit);
    return hit;
  }
  try {
    const row = await sbReadMeta(token);
    if (row && row.photos.length) {
      metaCache.set(token, row);
      if (Date.now() - row.at > META_TTL_MS) refreshInBackground(token, row);
      return row;
    }
  } catch (e) { /* DB is an enhancement — fall through to iCloud */ }
  return fetchMeta(token);
}

export default async function handler(req, res) {
  const q = req.query || {};
  const token = String(q.token || "");
  if (!/^[A-Za-z0-9]{8,40}$/.test(token)) {
    res.status(400).json({ error: "bad token" });
    return;
  }
  const per = Math.min(60, Math.max(1, parseInt(q.per, 10) || 24));
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const wantGuids = String(q.guids || "").split(",").filter(Boolean).slice(0, 100);
  try {
    const host = `p${partition(token)}-sharedstreams.icloud.com`;
    const meta = await albumMeta(token);
    const all = meta.photos;
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / per));
    const subset = wantGuids.length
      ? all.filter(p => wantGuids.includes(p.photoGuid))
      : all.slice((page - 1) * per, page * per);
    const guids = subset.map(p => p.photoGuid);
    const assets = guids.length
      ? await icloudPost(host, token, "webasseturls", { photoGuids: guids })
      : { items: {} };
    const urlFor = c => {
      const it = assets.items && assets.items[c];
      return it ? `https://${it.url_location}${it.url_path}` : null;
    };
    const out = subset.map(p => {
      const t = pickImageDerivative(p, true);
      const thumb = t && urlFor(t.checksum);
      if (isVideo(p)) {
        const v = pickVideoDerivative(p);
        return { guid: p.photoGuid, thumb, full: (v && urlFor(v.checksum)) || thumb, video: true };
      }
      const f = pickImageDerivative(p, false);
      return { guid: p.photoGuid, thumb, full: (f && urlFor(f.checksum)) || thumb };
    }).filter(p => p.thumb);
    // asset URLs are short-lived signed links — cache briefly only
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ photos: out, total, page, per, pages, name: meta.name });
  } catch (e) {
    res.status(e.status === 404 ? 404 : 502).json({ error: String(e.message || e) });
  }
}
