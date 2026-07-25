// supabase.js — Lucia ♥ Riu
// Supabase REST access (no SDK — single-file-era rule kept). Every helper
// here is an ENHANCEMENT: if the network or config is missing, callers fall
// back to hardcoded data. See docs/SUPABASE.md.

// Setup guide: docs/SUPABASE.md. Leave both constants empty for "local mode":
// the timeline still works, but adds live in memory only (gone on refresh,
// never reach the other phone). Fill them in and journeys sync for real.
const SUPABASE_URL = "https://kpoxnurehcggqgbkptrf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwb3hudXJlaGNnZ3FnYmtwdHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NjQ2NzYsImV4cCI6MjEwMDQ0MDY3Nn0.pK8zXiJnB0iwxAmy2gGXMIE7rGAM6mkui3UbzM5KQAc"; // anon public key — ships in the page by design (RLS is the gate)


function supaOn() { return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0; }

async function supa(path, opts) {
  opts = opts || {};
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Prefer": (opts.prefer ? opts.prefer + "," : "") + "return=representation"
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) throw new Error("Supabase said " + res.status);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// --- shared settings (lock password + reunion date live in the DB) ---
const DB = { lockKeys: null };

// Fetches EVERY settings row, so it is also the boot handoff for the features
// that keep their state in this table (the duel, 20 Questions, Moon). They used
// to each fire their own near-identical GET a millisecond later; now js/init.js
// hands them these rows. Returns null when there was nothing to fetch (local
// mode) or the fetch failed — callers fall back to their own pull.
async function loadSettings() {
  if (!supaOn()) return null;
  try {
    const rows = await supa("settings?select=key,value");
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    if (map.lock_keys) {
      DB.lockKeys = map.lock_keys.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (map.reunion_date) {
      reunionDate = new Date(map.reunion_date + "T00:00:00");
      document.getElementById("setDateBtn").textContent = "📅 Change the date";
      tickCountdown();
    }
    if (map.home_photo) cpApply(map.home_photo); // couple-photo feature
    return rows;
  } catch (e) { /* offline or not set up — fallbacks carry on */ }
  return null;
}

async function saveReunion(val) {
  if (!supaOn()) return;
  try {
    await supa("settings?on_conflict=key", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: { key: "reunion_date", value: val }
    });
    popToast("Countdown synced — it's on both phones now 💞");
  } catch (e) { /* hash param already saved it locally */ }
}

// --- question bank from the DB (BANK stays as the offline fallback) ---
async function loadQuestions() {
  if (!supaOn()) return;
  try {
    const rows = await supa("questions?select=id,category,text&order=id.asc");
    if (!rows || !rows.length) return;
    const bank = {};
    rows.forEach(r => { (bank[r.category] = bank[r.category] || []).push(r.text); });
    // only swap in a complete bank — a partial one would break determinism
    if (Object.keys(CHIPS).every(c => bank[c] && bank[c].length)) {
      QUESTION_SOURCE = bank;
      qotdRender(); // redeal today's card from the DB copy (same content)
    }
  } catch (e) { /* fallback BANK keeps working */ }
}
