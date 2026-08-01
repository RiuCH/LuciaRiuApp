// The one door to the Claude API (task B2, roadmap #2).
//
//   POST /api/claude  { task: "trip_draft", … }  →  { summary, places[], estimated_total }
//
// ────────────────────────────────────────────────────────────── why it's gated
// The other three functions in this folder check nothing about who is calling
// them. For a geocode lookup that is merely untidy; here it would mean anyone
// who views source can spend Riu's Anthropic balance in a loop. So every
// request must carry a Supabase user JWT belonging to one of us, and the token
// is verified against Supabase before a single token is bought.
//
// ─────────────────────────────────────────────────────── why "tasks", not prompts
// The browser sends DATA. The prompt lives here, server-side, keyed by a task
// name from a fixed list. If this accepted a prompt string, one leaked session
// token would turn it into a free general-purpose Claude proxy — the allowlist
// would still hold, but the blast radius of a stolen JWT goes from "reads our
// trip plan" to "runs anything, on our card".
//
// The gate itself — and the env vars it needs, and the reason the issuer is
// never taken from the request body — lives in api/_gate.js, shared with
// api/notify.js. Read that file before changing anything about auth here.
//
//   ANTHROPIC_API_KEY   sk-ant-…   never reaches the page (this file only)
//
// Spend is bounded by three things, in descending order of how much they
// actually matter: the allowlist (two people), the fixed task list (no
// arbitrary prompts), and a monthly cap set in the Anthropic Console. There is
// deliberately no in-memory rate limiter here — serverless instances come and
// go, so a counter in module scope would reset on every cold start and give
// the comforting appearance of a limit without being one.
//
// Golden rule 6 still holds: js/ai.js hides every caller's button when this is
// unreachable, so the app works exactly as before with none of it deployed.

// Drafting with adaptive thinking runs well past the 10s default. If your
// Vercel plan won't allow 60, this is the first thing to lower — and the
// symptom is a function timeout, not a Claude error.
export const config = { maxDuration: 60 };

import { requireUs } from "./_gate.js";

const MODEL = "claude-opus-4-8";

// Bound what we'll pay to think about. These are generous for a real trip and
// stop a malformed (or malicious) payload turning into a five-figure prompt.
const MAX_WISHES = 60;
const MAX_PLANNED = 120;
const MAX_DAYS = 30;

const str = (v, n) => String(v == null ? "" : v).slice(0, n);
const num = v => (isFinite(Number(v)) ? Number(v) : 0);

// ──────────────────────────────────────────────────────────── the trip_draft task
const TRIP_SYSTEM = `You are helping Riu and Lucia plan a trip together. They are a couple, long distance — Riu in San Francisco, Lucia in Phoenix — so a trip is the thing they count down to, not a routine holiday. Warm, specific, never gushing.

You are drafting entries for their itinerary. Rules:

- Suggest REAL, specific, named places you are confident exist in the destination. A wrong address is worse than one fewer suggestion. If you are unsure a place is real, leave it out.
- Their own ⭐ Someday wishes come first. When a suggestion is one of theirs, say so in "why" and name who added it ("Lucia's been wanting this one"). This matters more than covering every day.
- Do not repeat anything already in the itinerary. Complement it — if a day already has dinner booked, don't add another.
- Pace it like humans: two or three things a day, not six. Leave gaps.
- Respect the money. You are told what's in the pot and what's already committed. Stay inside what's left, and if their wishes can't fit, say which you'd cut in "summary" rather than silently dropping them.
- "note" is for them, at the moment they're standing there — one short practical line ("go early, it's packed by 10"). Not a description of the place.
- "why" is one short line on why it's in the plan.
- est_cost is a rough per-couple US dollar figure, 0 if it's free or you genuinely can't say.
- day_date must be one of the trip's dates exactly as given, or "" to leave it in the saved-but-unscheduled bucket. Use "" freely — a good option they can slot in beats a bad one pinned to Tuesday.`;

// Strict schema: the response needs no parsing defence and no repair path.
// Deliberately no nullable types — day_date "" means unscheduled and est_cost 0
// means unknown, which keeps every field a plain string or number.
const TRIP_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Two or three sentences to them about the plan and any budget trade-off." },
    estimated_total: { type: "number", description: "Rough total US dollars for everything suggested." },
    places: {
      type: "array",
      description: "The suggested itinerary entries, at most 20.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "The real, specific name of the place." },
          kind: { type: "string", enum: ["see", "eat", "hotel", "flight", "other"] },
          day_date: { type: "string", description: "YYYY-MM-DD from the trip's dates, or \"\" for unscheduled." },
          note: { type: "string", description: "One short practical line for when they're there." },
          why: { type: "string", description: "One short line on why it's in the plan." },
          est_cost: { type: "number", description: "Rough US dollars for the two of them, 0 if free or unknown." }
        },
        required: ["name", "kind", "day_date", "note", "why", "est_cost"],
        additionalProperties: false
      }
    }
  },
  required: ["summary", "estimated_total", "places"],
  additionalProperties: false
};

function tripPrompt(body) {
  const trip = body.trip || {};
  const days = (trip.days || []).slice(0, MAX_DAYS);
  const planned = (body.planned || []).slice(0, MAX_PLANNED);
  const wishes = (body.wishes || []).slice(0, MAX_WISHES);
  const money = body.money || {};

  const lines = [];
  lines.push("TRIP: " + str(trip.place, 120));
  lines.push("DATES: " + (days.length ? days[0] + " to " + days[days.length - 1] +
    " (" + days.length + " days)" : "no dates set"));
  if (days.length) lines.push("THE DAYS, use these exact values for day_date:\n" + days.join("\n"));

  lines.push("\nALREADY IN THE ITINERARY — do not repeat these:");
  lines.push(planned.length
    ? planned.map(p => "- [" + str(p.kind, 12) + "] " + str(p.name, 100) +
        (p.day_date ? " on " + str(p.day_date, 10) : " (unscheduled)")).join("\n")
    : "- (nothing yet)");

  lines.push("\nTHEIR ⭐ SOMEDAY LIST — prefer these, and say when one is theirs:");
  lines.push(wishes.length
    ? wishes.map(w => "- [" + str(w.kind, 12) + "] " + str(w.title, 100) +
        (w.added_by ? " — added by " + str(w.added_by, 12) : "") +
        (w.note ? " (" + str(w.note, 140) + ")" : "") +
        (w.est_cost ? " ~$" + num(w.est_cost) : "")).join("\n")
    : "- (nothing on it yet)");

  lines.push("\nMONEY: $" + num(money.pot) + " in the pot, $" + num(money.committed) +
    " already committed, $" + num(money.left) + " left to spend.");

  return lines.join("\n");
}

const TASKS = {
  trip_draft: { system: TRIP_SYSTEM, schema: TRIP_SCHEMA, prompt: tripPrompt }
};

// ───────────────────────────────────────────────────────────────────── handler
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(503).json({ error: "not configured" }); return; }

  const who = await requireUs(req);
  if (!who.ok) { res.status(who.status).json({ error: who.error }); return; }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const task = TASKS[String(body.task || "")];
  if (!task) { res.status(400).json({ error: "unknown task" }); return; }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        system: task.system,
        // Adaptive thinking: fitting real places to real days inside a real
        // budget is the kind of thing worth letting it reason about, and it
        // decides the depth per request rather than us guessing a budget.
        thinking: { type: "adaptive" },
        output_config: { format: { type: "json_schema", schema: task.schema } },
        messages: [{ role: "user", content: task.prompt(body) }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || ("Claude said " + r.status);
      res.status(502).json({ error: msg });
      return;
    }
    // A safety decline arrives as a normal 200 with no usable content, so it
    // has to be checked before reading content — see the Claude API docs on
    // stop_reason. Nothing this app sends should trip it, which is exactly why
    // it would be baffling to debug without this branch.
    if (data.stop_reason === "refusal") {
      res.status(422).json({ error: "Claude declined that one 😅" });
      return;
    }

    // output_config guarantees the first text block is valid JSON for the
    // schema, so this parse cannot legitimately fail.
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
