// init.js — Lucia ♥ Riu
// Boot order. Loaded LAST: every function it calls is already defined.

// ---------------- INIT ----------------
renderHeader();
show(dailyQuestion(), true);
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
loadJourneys();
loadSettings();
loadQuestions();
setInterval(() => { tickAnniversary(); tickClocks(); tickCountdown(); }, 1000);
setInterval(spawnHeart, 1400);
for (let i = 0; i < 6; i++) setTimeout(spawnHeart, i * 350);

// refresh at midnight so the daily question rolls over if the tab stays open
setInterval(() => {
  const q = dailyQuestion();
  if (current && elHint.textContent.includes("same for both") && q.text !== current.text) {
    renderHeader();
    show(q, true);
  }
}, 60000);
