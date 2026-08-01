// "Is the caller one of us?" — shared by every function that spends money or
// reaches another person's phone.
//
// Vercel does not route files whose name starts with `_`, so this is a module,
// not an endpoint. It exists as one file on purpose: this check is the only
// thing between a stranger and our Anthropic balance / each other's lock
// screens, and security code that exists twice drifts.
//
// ─────────────────────────────────────────────────────────── the spoofing trap
// SUPABASE_URL is read from the ENVIRONMENT and never from the request body.
// api/food-import.js does take it from the body, which is fine there — it's
// authorising against the caller's own project either way. Here it would be a
// complete bypass: point it at your own Supabase project, sign yourself in
// with an allowlisted address, and the gate waves you through. If a future
// change tries to "simplify" this by accepting the URL from the client, don't.
//
// ────────────────────────────────────────────────────────────── Vercel env vars
//   LR_ALLOWED_EMAILS      riu@…,lucia@…         comma separated
//   LR_SUPABASE_URL        https://….supabase.co the issuer we trust
//   LR_SUPABASE_ANON_KEY   eyJ…                  public; identifies the project
//
// LR_ALLOWED_EMAILS must agree with public.is_us() in supabase/auth_policies.sql
// and with allowed_emails in supabase/allowlist.sql. Three places, one list —
// is_us() decides what you can see, allowed_emails decides who can sign up,
// this decides who can spend money and ring the other phone.

export function gateEnv() {
  const supaUrl = process.env.LR_SUPABASE_URL;
  const anonKey = process.env.LR_SUPABASE_ANON_KEY;
  const allowed = String(process.env.LR_ALLOWED_EMAILS || "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return { supaUrl, anonKey, allowed, ok: !!(supaUrl && anonKey && allowed.length) };
}

// Ask Supabase who this token belongs to. Verifying the signature locally
// would save ~100ms and need the JWT secret in yet another env var; against
// calls that take seconds, the round trip is free — and this way a revoked
// session is rejected too, which local verification wouldn't catch until the
// token expired on its own.
async function callerEmail(token, supaUrl, anonKey) {
  try {
    const r = await fetch(supaUrl.replace(/\/$/, "") + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: "Bearer " + token }
    });
    if (!r.ok) return null;
    const user = await r.json();
    const email = user && user.email;
    return email ? String(email).trim().toLowerCase() : null;
  } catch (e) {
    return null;
  }
}

// Resolves to { ok: true, email, token, supaUrl, anonKey }
//          or { ok: false, status, error } — hand that straight to res.
//
// FAILS CLOSED on missing configuration. That is deliberately the opposite of
// supabase/allowlist.sql, which fails OPEN when its table is empty: there, a
// wrong guess locks you out of your own app; here, a wrong guess puts a
// stranger on your card.
export async function requireUs(req) {
  const env = gateEnv();
  if (!env.ok) return { ok: false, status: 503, error: "not configured" };

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, status: 401, error: "sign in first" };

  const email = await callerEmail(token, env.supaUrl, env.anonKey);
  if (!email || env.allowed.indexOf(email) === -1) {
    return { ok: false, status: 403, error: "this app is for two people 😌" };
  }
  return { ok: true, email, token, supaUrl: env.supaUrl, anonKey: env.anonKey };
}
