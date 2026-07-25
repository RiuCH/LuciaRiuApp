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
    const stream = await icloudPost(host, token, "webstream", { streamCtag: null });
    const all = (stream.photos || []).filter(Boolean);
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
    res.status(200).json({ photos: out, total, page, per, pages, name: stream.streamName || "" });
  } catch (e) {
    res.status(e.status === 404 ? 404 : 502).json({ error: String(e.message || e) });
  }
}
