// Ring the other phone.
//
//   POST /api/notify   →  { sent, pruned }
//
// ─────────────────────────────────────────────────────────── deliberately empty
// The push carries NO PAYLOAD. Web Push payloads have to be encrypted per
// RFC 8291 (ECDH → HKDF → AES-128-GCM), which is a genuinely bad place to be
// clever — a subtle mistake there fails silently — and doing it properly means
// taking a dependency, which this repo doesn't have any of.
//
// So the notification says "Something new 💞" and you open the app to see
// what. The side effect is the nicer half of the trade: with no payload,
// **nothing about the two of them travels through Apple's push servers**. Not
// a wish title, not a filename, not who did it. The only thing that leaves
// here is "a thing happened", addressed to an opaque endpoint.
//
// Only VAPID remains, which is a plain ES256 JWT and about twenty lines with
// node's built-in crypto. If you ever do want text on the lock screen, the
// subscriptions already store `p256dh`/`auth`, so it's a sender change and
// nobody has to re-subscribe.
//
// ───────────────────────────────────────────────────────── who gets rung
// The actor is taken from the VERIFIED JWT, never from the body — otherwise
// anyone who got through the gate could make the other phone buzz on demand,
// or silence their own additions by lying about who they are. We push to every
// subscription whose email isn't the caller's.
//
// ──────────────────────────────────────────────────────────── Vercel env vars
//   LR_VAPID_PUBLIC    B…   the same value that's in js/push.js (it's public)
//   LR_VAPID_PRIVATE   …    the `d` of the keypair — secret, server only
//   LR_VAPID_SUBJECT   mailto:you@example.com   contact, per the VAPID spec
//
// plus the three api/_gate.js needs. Generate the keypair with the snippet in
// docs/SUPABASE.md — it never has to touch a terminal or leave your browser.
//
// Golden rule 6: js/push.js hides the toggle when this is unreachable, and
// every caller fires it without awaiting, so a dead endpoint can never stop a
// photo or a wish from saving.

import crypto from "node:crypto";
import { requireUs } from "./_gate.js";

const b64url = buf => Buffer.from(buf).toString("base64url");

// A VAPID JWT is signed with the private scalar `d`, but node needs a whole
// JWK to build a key — and x/y are simply the two halves of the public key,
// which is `0x04 || x(32) || y(32)` uncompressed. So the public key we already
// have in env supplies them, and there's no third secret to store.
function vapidKey(publicB64, privateB64) {
  const raw = Buffer.from(publicB64, "base64url");
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error("VAPID public key is not a raw P-256 point");
  return crypto.createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: b64url(raw.subarray(1, 33)),
      y: b64url(raw.subarray(33, 65)),
      d: privateB64
    }
  });
}

function vapidToken(endpoint, key, subject) {
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,   // spec caps this at 24h
    sub: subject
  }));
  const signed = header + "." + body;
  // ES256 wants the raw r||s pair, not the DER wrapper node returns by
  // default. `ieee-p1363` is that raw form — without it every push is
  // rejected as a bad signature, which is a miserable thing to debug.
  const sig = crypto.sign("sha256", Buffer.from(signed), {
    key: key,
    dsaEncoding: "ieee-p1363"
  });
  return signed + "." + b64url(sig);
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const pub = process.env.LR_VAPID_PUBLIC;
  const priv = process.env.LR_VAPID_PRIVATE;
  const subject = process.env.LR_VAPID_SUBJECT;
  if (!pub || !priv || !subject) { res.status(503).json({ error: "not configured" }); return; }

  const who = await requireUs(req);
  if (!who.ok) { res.status(who.status).json({ error: who.error }); return; }

  // Read the subscriptions with the CALLER's token, not a service key. RLS
  // already says "authenticated and is_us()", so one of us can see all the
  // rows — which means this function needs no elevated credential at all, and
  // a leaked env var can't be used to read them.
  const rest = (path, opts) => fetch(who.supaUrl.replace(/\/$/, "") + "/rest/v1/" + path, {
    method: (opts && opts.method) || "GET",
    headers: {
      apikey: who.anonKey,
      Authorization: "Bearer " + who.token,
      "Content-Type": "application/json"
    }
  });

  let subs = [];
  try {
    const r = await rest("push_subs?select=id,endpoint,email");
    if (!r.ok) throw new Error("supabase said " + r.status);
    subs = await r.json();
  } catch (e) {
    // The table not existing is the normal pre-migration state, not a fault.
    res.status(200).json({ sent: 0, pruned: 0, note: "run supabase/push.sql" });
    return;
  }

  // Don't ring your own phone. This is why the actor comes from the JWT.
  const targets = subs.filter(s => String(s.email || "").toLowerCase() !== who.email);
  if (!targets.length) { res.status(200).json({ sent: 0, pruned: 0 }); return; }

  let key;
  try { key = vapidKey(pub, priv); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); return; }

  let sent = 0;
  const dead = [];
  await Promise.all(targets.map(async sub => {
    try {
      const r = await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          Authorization: "vapid t=" + vapidToken(sub.endpoint, key, subject) + ", k=" + pub,
          // Drop it rather than queue it for a day: "something new" that
          // arrives tomorrow morning is worse than nothing.
          TTL: "900"
        }
      });
      // 404/410 mean this endpoint is permanently gone — reinstalled app,
      // revoked permission, iOS housekeeping. Left alone these accumulate and
      // fail forever, so they get removed rather than retried.
      if (r.status === 404 || r.status === 410) dead.push(sub.id);
      else if (r.ok) sent++;
    } catch (e) { /* one unreachable endpoint mustn't stop the other */ }
  }));

  if (dead.length) {
    try { await rest("push_subs?id=in.(" + dead.join(",") + ")", { method: "DELETE" }); }
    catch (e) { /* it'll be pruned on the next send */ }
  }

  res.status(200).json({ sent, pruned: dead.length });
}
