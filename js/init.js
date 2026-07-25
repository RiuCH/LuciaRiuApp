// init.js — Lucia ♥ Riu
// Boot order. Loaded LAST: every function it calls is already defined.

// ---------------- INIT ----------------
qotdRender();
wdRollLetters();
wdRenderHearts();
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
