// init.js — Lucia ♥ Riu
// Boot order. Loaded LAST: every function it calls is already defined.

// ---------------- INIT ----------------
// NOTE: the session is NOT set up here. js/auth.js settles it at parse time
// (see the comment at the bottom of that file) because js/lock.js needs to
// know whether you're signed in before init.js ever runs. So everything below
// already carries your JWT if you have one.

// Every boot step goes through here, because this file is a single statement
// list: an exception in ANY line kills every line after it. That is not a
// theoretical worry — on 2026-07-26 a refactor deleted `fdRenderFold` from
// js/food.js and left the call here, so the Home clock and the together-counter
// froze at their static markup ("0d 0h 0m 0s", "--:--") and the DB question
// bank never loaded. One tab's dead function should never stop another tab's
// clock, so a failed step now warns and the rest of the app still boots.
function boot(label, fn) {
  try { fn(); } catch (e) { console.warn("boot step failed: " + label, e); }
}

// The Home widgets go FIRST and on their own, so that whatever else breaks,
// the clock on the front page is still right.
boot("home widgets", () => { homeTickFast(); homeTickSlow(); });

boot("question of the day", qotdRender);
boot("answers", () => { acRender(); acLoad(); });   // C1: paint empty, then adopt today's
boot("word duel", () => { wdRollLetters(false); wdRenderAll(); });  // works offline first
boot("20 questions", q20Render);
boot("moon", cyRender);
// …and then all three adopt the shared state. They used to fire three separate
// GETs at the `settings` table on boot, each a millisecond after loadSettings()
// had already fetched that whole table — four requests for one table's worth of
// rows. Now loadSettings() hands its snapshot over: 4 boot round trips → 1.
loadSettings().then(rows => {
  if (rows) { thAdopt(rows); wdAdopt(rows); q20AdoptRows(rows); cyAdopt(rows); return; }
  // No snapshot: either local mode (these return without touching the network)
  // or the fetch failed (they retry and mark themselves unsynced). Same as before.
  wdPull(); q20Pull(); cyPull();
});
// The backup door into the hidden Moon tab, for when a long-press is awkward.
// The long-press in js/core.js is the everyday way in.
boot("moon door", () => { if (getHashParam("moon") === "1") switchTab("cycle"); });
// couple photo: hash-param fallback first; loadSettings() overrides with the DB copy
(function cpInit() {
  const ph = getHashParam("photo");
  if (ph) { try { cpApply(decodeURIComponent(ph)); } catch (e) {} }
})();
boot("reunion label", () => { if (reunionDate) document.getElementById("setDateBtn").textContent = "📅 Change the date"; });
// Journey photo BYTES are only fetched once the Trips tab is opened, but we
// warm the (small) album JSON once the page is idle so that tap feels instant.
loadJourneys().then(() => {
  const warm = () => jrPrewarmAlbums();
  if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1200);
});
boot("question bank", loadQuestions);


// ---------------- HOME WIDGET TIMERS ----------------
// Two speeds. The fast one moves the seconds; the slow one handles everything
// that changes once a day (or twice a year), which used to ride the 1s tick for
// no reason at all.
function homeTickFast() { tickAnniversary(); tickClocks(); tickCountdown(); }
function homeTickSlow() { tickAnnivDate(); tickTzDiff(); }

// (The first paint happens at the very top of this file — see boot().)

// The Home widgets live inside a `display:none` section on every other tab, so
// don't format dates into an invisible subtree 86,400 times a day. TAB_HOOKS.home
// repaints the instant Home comes back, so the numbers are always correct by the
// time an eye lands on them.
//
// Deliberately NOT also gated on `document.hidden`, unlike the pollers in
// js/duel.js / js/twenty.js / js/cycle.js. A missed poll is self-healing — the
// next one fixes it — but a clock that stops is just broken, and some webviews
// (including the preview browsers this project already distrusts) report
// hidden === true while perfectly visible, which would freeze it forever.
// Backgrounded phones freeze or throttle timers on their own anyway, so the
// extra gate would buy almost nothing here for a real risk.
function homeAwake() { return activeTab === "home"; }

setInterval(() => { if (homeAwake()) homeTickFast(); }, 1000);
setInterval(() => { if (homeAwake()) homeTickSlow(); }, 60000);

TAB_HOOKS.home = () => { homeTickFast(); homeTickSlow(); acLoad(); };
// Catch up after a lock screen or app switch, when timers were frozen.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && homeAwake()) { homeTickFast(); homeTickSlow(); }
});

setInterval(spawnHeart, 1400);
for (let i = 0; i < 6; i++) setTimeout(spawnHeart, i * 350);

// roll the home question over at midnight if the tab is left open
setInterval(() => {
  if (qotdCurrent && dailyQuestion().text !== qotdCurrent.text) qotdRender();
  acDayRolled();        // a new day means a new (empty) pair of answers
}, 60000);
