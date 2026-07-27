// ai.js — Lucia ♥ Riu
// 🤖 The client side of the one Claude door (task B2, roadmap #2).
//
// There is exactly one endpoint (`api/claude.js`) and it takes a NAMED TASK,
// never a prompt — the prompt lives server-side. So this file is deliberately
// thin: it attaches the Supabase JWT, posts, and turns failures into something
// a person can read. Anything cleverer belongs in the function, where the API
// key is.
//
// GOLDEN RULE 6 LIVES HERE. Every AI feature in the app is an enhancement, and
// `aiReady()` is how each one knows to hide its button instead of offering
// something that will fail:
//
//   • `file://`     — a double-clicked index.html has no serverless functions
//   • signed out    — no JWT to send, and the endpoint would refuse it anyway
//   • not deployed  — the endpoint 404s; the caller catches and hides
//
// The app must be fully usable with none of this present. If you add a caller,
// gate it on aiReady() and make sure the feature's tab is complete without it.

const AI_ENDPOINT = "/api/claude";

// Cheap and synchronous, so it's safe to call from a render path. It answers
// "is it worth showing the button", not "will the call succeed" — the endpoint
// may still be undeployed, which is why callers also catch.
function aiReady() {
  if (location.protocol === "file:") return false;
  return typeof authToken === "function" && !!authToken();
}

// Resolves with the task's JSON, or throws an Error whose message is already
// fit to put in a toast.
async function aiCall(task, payload) {
  if (!aiReady()) throw new Error("Sign in to use this ✨");

  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + authToken()
    },
    body: JSON.stringify(Object.assign({ task: task }, payload || {}))
  });

  // Nothing is answering POSTs at this path: Vercel 404s a function that isn't
  // deployed, and a plain static server (a local preview, say) answers 405 or
  // 501 instead. All three mean the same thing to a person — the feature isn't
  // switched on — so don't make them read a status code to find that out.
  if (res.status === 404 || res.status === 405 || res.status === 501) {
    throw new Error("Not switched on yet — deploy api/claude.js");
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* fall through to status */ }

  if (!res.ok) {
    throw new Error((data && data.error) ||
      (res.status === 503 ? "Not configured — set ANTHROPIC_API_KEY on Vercel"
                          : "That didn't work (" + res.status + ")"));
  }
  return data;
}
