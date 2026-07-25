// tfd.js — Lucia ♥ Riu
// Talk · Flirt · Dare. Three decks; tap one, get a prompt.
//
// ONE switch: 💞 Together vs ✈️ Apart. It decides what's physically possible —
// a dare you can do from 1,800 miles away is a different animal from one that
// needs a room — and it swaps the app into its hot theme when you're together.
// There is no separate After Dark tier: the filthy prompts are simply IN the
// decks. This tab is the adult corner of the app; Home stays sweet.
//
// Unlike the Question of the Day (identical on both phones, fixed for the
// day), these are live draws: one phone runs it while you're on a call, so
// real Math.random() is correct here and no seed offset is needed. Prompts
// come from QUESTION_SOURCE (js/questions.js) — DB-backed, with the
// hardcoded BANK as the offline fallback.

const TFD_DECKS = {
  talk: {
    burst: ["💙", "✨", "🌙"],
    blurb: "The good stuff. Answer properly — no one-word escapes.",
    apart:    ["deep", "romantic", "ldr"],
    together: ["deep", "romantic", "funny"]
  },
  flirt: {
    burst: ["😏", "💋", "🔥"],
    blurb: "Say it out loud. Blushing is part of the game.",
    apart:    ["spicy", "nasty", "filthy"],
    together: ["spicy", "nasty", "filthy"]
  },
  dare: {
    burst: ["🔥", "📸", "😈"],
    blurb: "No negotiating. Do it now.",
    apart:    ["dareapart", "dareapartx"],
    together: ["daretogether", "daretogetherx"]
  }
};

let tfdTogether = false;   // ✈️ Apart is the default — that's the usual state
let tfdDeck = null;        // which deck is showing
let tfdCurrent = null;     // the prompt on screen
const tfdRecent = { talk: [], flirt: [], dare: [] }; // per-deck repeat guard

function tfdPool(key) {
  return flatOf(TFD_DECKS[key][tfdTogether ? "together" : "apart"]);
}

// Draw without repeating until the deck's been worked through — the same
// promise the daily deck makes, just per session instead of per day.
function tfdDraw(key) {
  const pool = tfdPool(key);
  if (!pool.length) return null;
  const seen = tfdRecent[key];
  if (seen.length >= pool.length) seen.length = 0;
  let pick, guard = 0;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
    guard++;
  } while (guard < 80 && (seen.includes(pick.text) ||
           (pool.length > 1 && tfdCurrent && pick.text === tfdCurrent.text)));
  seen.push(pick.text);
  return pick;
}

function tfdShow(key, e) {
  const prompt = tfdDraw(key);
  if (!prompt) { popToast("That deck came up empty — that's a bug 😅"); return; }
  tfdDeck = key;
  tfdCurrent = prompt;

  document.querySelectorAll("#tfdPicker button").forEach(b =>
    b.classList.toggle("sel", b.dataset.deck === key));

  const card = document.getElementById("tfdCard");
  card.classList.add("swapping");
  setTimeout(() => {
    document.getElementById("tfdText").textContent = prompt.text;
    styleChip(document.getElementById("tfdChip"), prompt.cat);
    document.getElementById("tfdBlurb").textContent = TFD_DECKS[key].blurb;
    card.classList.remove("swapping");
  }, 220);

  const again = document.getElementById("tfdAgain");
  again.style.display = "inline-block";
  again.textContent = "🎲 Another " + key;
  if (e) burst(e.clientX, e.clientY, TFD_DECKS[key].burst);
}

Object.keys(TFD_DECKS).forEach(key => {
  document.getElementById("tfd" + key[0].toUpperCase() + key.slice(1))
    .addEventListener("click", (e) => tfdShow(key, e));
});

document.getElementById("tfdAgain").addEventListener("click", (e) => {
  if (tfdDeck) tfdShow(tfdDeck, e);
});

// Together runs the app hot: the red palette, the filthier hearts, and the
// in-person decks. <html> carries the class too — it owns the canvas colour
// behind iOS's overscroll bounce (see css/base.css).
function tfdSetMode(together, e) {
  tfdTogether = together;
  hotMode = together;
  [document.body, document.documentElement].forEach(el =>
    el.classList.toggle("hot", hotMode));
  const meta = document.getElementById("themeColor");
  if (meta) meta.content = hotMode ? "#0d0208" : "#1a0b2e";
  if (activeTab === "tfd") {
    document.getElementById("subtitle").textContent =
      hotMode ? "Together Edition" : SUBTITLES.tfd;
  }
  document.querySelectorAll("#tfdDistance button").forEach(b =>
    b.classList.toggle("sel", (b.dataset.distance === "together") === tfdTogether));
  document.getElementById("tfdHint").textContent = tfdTogether
    ? "Together mode: these need a room, not a phone 💞"
    : "Apart mode: every one of these works from 1,800 miles away ✈️";

  // the decks just changed under us — redeal so the card matches the switch
  Object.keys(tfdRecent).forEach(k => { tfdRecent[k].length = 0; });
  tfdCurrent = null;
  if (tfdDeck) tfdShow(tfdDeck, null);
  if (e && together) burst(e.clientX, e.clientY, ["💞", "🔥", "😈"]);
}

document.querySelectorAll("#tfdDistance button").forEach(btn => {
  btn.addEventListener("click", (e) => tfdSetMode(btn.dataset.distance === "together", e));
});

document.getElementById("tfdCopy").addEventListener("click", async () => {
  if (!tfdCurrent) { popToast("Pick a deck first 😌"); return; }
  try {
    await navigator.clipboard.writeText(tfdCurrent.text + "  — Lucia ♥ Riu");
    popToast("Copied! Send it 💌");
  } catch {
    popToast("Couldn't copy — long-press the prompt instead");
  }
});
