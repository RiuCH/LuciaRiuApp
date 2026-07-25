// init.js — Lucia ♥ Riu
// Boot order. Loaded LAST: every function it calls is already defined.

// ---------------- INIT ----------------
// NOTE: the session is NOT set up here. js/auth.js settles it at parse time
// (see the comment at the bottom of that file) because js/lock.js needs to
// know whether you're signed in before init.js ever runs. So everything below
// already carries your JWT if you have one.

qotdRender();
wdRollLetters(false);   // local letters so the duel works offline…
wdRenderAll();
wdPull();               // …then adopt the shared row if Supabase is up
q20Render();            // 20 Questions paints from memory…
q20Pull();              // …then adopts whatever game is already in progress
cyRender();             // the Moon calendar draws from empty state…
cyPull();               // …then adopts the shared rows if Supabase is up
// The backup door into the hidden Moon tab, for when a long-press is awkward.
// The long-press in js/core.js is the everyday way in.
if (getHashParam("moon") === "1") switchTab("cycle");
// couple photo: hash-param fallback first; loadSettings() overrides with the DB copy
(function cpInit() {
  const ph = getHashParam("photo");
  if (ph) { try { cpApply(decodeURIComponent(ph)); } catch (e) {} }
})();
if (reunionDate) document.getElementById("setDateBtn").textContent = "📅 Change the date";
tickAnniversary();
tickClocks();
tickCountdown();
// Journey photo BYTES are only fetched once the Trips tab is opened, but we
// warm the (small) album JSON once the page is idle so that tap feels instant.
loadJourneys().then(() => {
  const warm = () => jrPrewarmAlbums();
  if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 3000 });
  else setTimeout(warm, 1200);
});
loadSettings();
loadQuestions();
setInterval(() => { tickAnniversary(); tickClocks(); tickCountdown(); }, 1000);
setInterval(spawnHeart, 1400);
for (let i = 0; i < 6; i++) setTimeout(spawnHeart, i * 350);

// roll the home question over at midnight if the tab is left open
setInterval(() => {
  if (qotdCurrent && dailyQuestion().text !== qotdCurrent.text) qotdRender();
}, 60000);
