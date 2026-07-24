// Vercel serverless proxy for Apple Shared Albums.
// iCloud's sharedstreams API sends no CORS headers, so browsers can't call
// it directly — this endpoint does the fetch server-side and returns
// { photos: [{guid, thumb, full}], name } for the app (same origin, no CORS).
// First serverless function in the repo — sanctioned by docs/ROADMAP.md
// ("serverless functions when needed"); the app still degrades to an
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

function pickDerivative(derivs, wantThumb) {
  let best = null;
  for (const d of Object.values(derivs || {})) {
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

export default async function handler(req, res) {
  const token = String((req.query && req.query.token) || "");
  if (!/^[A-Za-z0-9]{8,40}$/.test(token)) {
    res.status(400).json({ error: "bad token" });
    return;
  }
  try {
    const host = `p${partition(token)}-sharedstreams.icloud.com`;
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
      return it ? `https://${it.url_location}${it.url_path}` : null;
    };
    const out = photos.map(p => {
      const t = pickDerivative(p.derivatives, true);
      const f = pickDerivative(p.derivatives, false);
      return {
        guid: p.photoGuid,
        thumb: t && urlFor(t.checksum),
        full: (f && urlFor(f.checksum)) || (t && urlFor(t.checksum)),
      };
    }).filter(p => p.thumb);
    // asset URLs are short-lived signed links — cache briefly only
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ photos: out, name: stream.streamName || "" });
  } catch (e) {
    res.status(e.status === 404 ? 404 : 502).json({ error: String(e.message || e) });
  }
}
