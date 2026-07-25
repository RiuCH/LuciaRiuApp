// twenty.js — Lucia ♥ Riu
// 20 Questions, plus the little hub that lets the Games tab hold more than
// one game.
//
// One of you thinks of something; the other gets 20 questions and exactly
// three possible answers: YES, NO, SOMETIMES. (SOMETIMES exists to be
// infuriating. That's the point.)
//
// Sharing works exactly like the Word Duel: one JSON blob in a `settings`
// row that already exists, polled while the tab is open. No migration, and
// if Supabase is unreachable the game still runs on one phone — it just
// says so instead of pretending.

// ---------------- the games hub ----------------
// The tab is still keyed "duel" everywhere (TABS, NAVIDS, TAB_HOOKS); this
// only swaps which game's panels are visible inside it.
function gamesShow(which) {
  gamesPick = which;
  const duel = document.getElementById("gameDuel");
  const q20 = document.getElementById("game20q");
  // "" not "block": the desktop grid lives on #gameDuel in css/desktop.css,
  // and an inline display would override it.
  if (duel) duel.style.display = which === "duel" ? "" : "none";
  if (q20) q20.style.display = which === "q20" ? "" : "none";
  document.querySelectorAll("#gamesPicker .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.game === which));
  if (activeTab === "duel") {
    document.getElementById("subtitle").textContent =
      which === "q20" ? "20 Questions" : "The Word Duel";
  }
  if (which === "q20") q20Pull();
  else if (typeof wdPull === "function") wdPull();
}

document.querySelectorAll("#gamesPicker .chip").forEach(chip =>
  chip.addEventListener("click", () => gamesShow(chip.dataset.game)));

// ---------------- state ----------------
const Q20_KEY = "q20_state";   // the whole game, as JSON, in `settings`
const Q20_MAX = 20;

let q20 = {
  phase: "setup",      // setup | asking | over
  thinker: null,       // "lucia" | "riu" — who holds the secret
  word: "",            // the secret itself
  asked: [],           // [{ q, a }] — a is YES | NO | SOMETIMES | guess verdict
  pending: null,       // { q, guess: bool } waiting on an answer
  result: null,        // "won" (guesser got it) | "lost" (ran out)
  reveal: false        // set once the word is on show
};
let q20Synced = null;  // null = unknown, true = sharing, false = alone
let q20Pushing = false;
// Bumped on every local change. A poll that was already in flight when you
// acted would otherwise land afterwards and wipe your question off the screen
// for a couple of seconds — so a pull whose counter has moved is discarded.
let q20Writes = 0;

// Words worth thinking of. Half real nouns, half things only the two of us
// would ever guess — the deck is the joke.
const Q20_IDEAS = [
  "the airport arrivals gate", "your terrible morning voice", "a cactus in Phoenix",
  "the last slice of pizza", "Riu's laugh", "Lucia's cold feet",
  "the blanket you always steal", "our first video call", "a suspiciously long hug",
  "the 3am text you regret", "San Francisco fog", "your phone at 1% battery",
  "the boarding pass in your pocket", "an unread notification", "matching pyjamas",
  "the sound of a suitcase zipping", "a burrito the size of a forearm",
  "your worst haircut", "the group chat you muted", "a very smug cat",
  "the seatbelt sign", "an overpriced airport sandwich", "our future dog",
  "the thermostat argument", "a photo neither of us will delete",
  "the last thing you googled", "your favourite hoodie (mine now)",
  "a plant we forgot to water", "the taxi we nearly missed", "jet lag",
  "the sock that vanished", "an inside joke that stopped being funny",
  "the good pen", "a screenshot you shouldn't have taken",
  "the hotel breakfast buffet", "someone else's baby on a plane",
  "the middle seat", "a playlist made at 2am", "our anniversary dinner",
  "the wifi password"
];

// Running commentary — the number of questions left, with opinions.
function q20Mood(left) {
  if (left >= 18) return "Twenty whole questions. Squander them wisely.";
  if (left >= 14) return "Warming up. Still no idea, though, is it?";
  if (left >= 10) return "Halfway-ish. This is where confidence goes to die.";
  if (left >= 6)  return "Single digits soon. Maybe stop asking about colours.";
  if (left >= 3)  return "Getting desperate. It's a good look on you.";
  if (left === 2) return "Two left. Panic is a valid strategy.";
  if (left === 1) return "One. Single. Question. No pressure. 😬";
  return "Out of questions. Bold of you to have asked about vegetables.";
}

const Q20_WON = [
  "Guessed it 🎉 Insufferable about it for the next hour, presumably.",
  "Correct! Somebody's been paying attention 😌",
  "Got it 💞 Frankly a bit suspicious. Are you reading minds now?"
];
const Q20_LOST = [
  "Twenty questions, no idea 😈 Devastating.",
  "Out of questions! The secret survives, undefeated 🏆",
  "Nope. Not even close. Sit with that 😌"
];

// ---------------- sync ----------------
function q20Save() {
  return supa("settings?on_conflict=key", {
    method: "POST", prefer: "resolution=merge-duplicates",
    body: { key: Q20_KEY, value: JSON.stringify(q20) }
  });
}

async function q20Push() {
  q20Writes++;
  q20Render();
  if (!supaOn()) { q20Synced = false; q20RenderSync(); return; }
  q20Pushing = true;
  try { await q20Save(); q20Synced = true; }
  catch (e) { q20Synced = false; }
  finally { q20Pushing = false; q20RenderSync(); }
}

async function q20Pull() {
  if (!supaOn() || q20Pushing) { if (!supaOn()) { q20Synced = false; q20RenderSync(); } return; }
  const seen = q20Writes;
  try {
    const rows = await supa("settings?key=eq." + Q20_KEY + "&select=value");
    if (q20Writes !== seen) return;   // we acted mid-flight — this snapshot is stale
    if (rows && rows.length && rows[0].value) {
      const next = JSON.parse(rows[0].value);
      // don't yank the keyboard away from someone mid-question
      const typing = document.activeElement === document.getElementById("q20Ask") ||
                     document.activeElement === document.getElementById("q20Word");
      q20 = next;
      if (!typing) q20Render(); else q20RenderCount();
    }
    q20Synced = true;
  } catch (e) { q20Synced = false; }
  q20RenderSync();
}

// Poll only while this game is the one on screen.
setInterval(() => { if (activeTab === "duel" && gamesPick === "q20") q20Pull(); }, 2000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && activeTab === "duel" && gamesPick === "q20") q20Pull();
});
window.addEventListener("focus", () => {
  if (activeTab === "duel" && gamesPick === "q20") q20Pull();
});

// ---------------- who's who ----------------
// Shares the Word Duel's `#me` hash param so you only ever pick a side once.

// Is a round actually in progress? "over" still shows the board, but the game
// is done, so re-picking a side then is harmless.
function q20Started() {
  return q20.phase === "asking" ||
         (q20.phase === "setup" && !!q20.thinker) ||
         q20.asked.length > 0;
}

function q20SetMe(who) {
  if (who === wdMe) return;
  // one identity across the whole Games tab — see wdSideLocked() in js/duel.js
  if (typeof wdSideLocked === "function" && wdSideLocked()) {
    popToast("No swapping mid-game 😌 Hit 🔄 Restart if you picked wrong");
    return;
  }
  wdMe = who;
  setHashParam("me", who);
  if (typeof wdRenderWhoAmI === "function") wdRenderWhoAmI();
  q20Render();
}

document.querySelectorAll("#q20WhoAmI .chip").forEach(chip =>
  chip.addEventListener("click", () => q20SetMe(chip.dataset.me)));

const q20IamThinker = () => wdMe && q20.thinker === wdMe;
const q20IamGuesser = () => wdMe && q20.thinker && q20.thinker !== wdMe;

// ---------------- actions ----------------
document.getElementById("q20Start").addEventListener("click", () => {
  if (!wdMe) { popToast("Pick who you are first 😌"); return; }
  q20 = { phase: "setup", thinker: wdMe, word: "", asked: [], pending: null, result: null, reveal: false };
  q20Render();
  document.getElementById("q20Word").focus();
});

document.getElementById("q20Idea").addEventListener("click", () => {
  const input = document.getElementById("q20Word");
  let idea, guard = 0;
  do { idea = Q20_IDEAS[Math.floor(Math.random() * Q20_IDEAS.length)]; guard++; }
  while (guard < 20 && idea === input.value);
  input.value = idea;
});

document.getElementById("q20Lock").addEventListener("click", (e) => {
  const word = document.getElementById("q20Word").value.trim();
  if (!word) { popToast("Think of something first 🧠"); return; }
  q20.word = word;
  q20.thinker = wdMe;
  q20.phase = "asking";
  q20.asked = [];
  q20.pending = null;
  q20.result = null;
  q20.reveal = false;
  q20Push();
  burst(e.clientX, e.clientY, ["🧠", "🤫", "✨"]);
  popToast("Locked in. Let them suffer 😈");
});

function q20SubmitQuestion(isGuess) {
  const input = document.getElementById(isGuess ? "q20Guess" : "q20Ask");
  const text = input.value.trim();
  if (!text) { popToast(isGuess ? "Guess something 🎯" : "Ask something 🤔"); return; }
  if (q20.pending) { popToast("They haven't answered the last one yet 😅"); return; }
  q20.pending = { q: text, guess: !!isGuess };
  input.value = "";
  q20Push();
}

document.getElementById("q20AskBtn").addEventListener("click", () => q20SubmitQuestion(false));
document.getElementById("q20Ask").addEventListener("keydown", (e) => {
  if (e.key === "Enter") q20SubmitQuestion(false);
});
document.getElementById("q20GuessBtn").addEventListener("click", () => q20SubmitQuestion(true));
document.getElementById("q20Guess").addEventListener("keydown", (e) => {
  if (e.key === "Enter") q20SubmitQuestion(true);
});

// The thinker answers. A wrong final guess still burns one of the twenty —
// guessing wildly should cost you something.
function q20Answer(answer, e) {
  if (!q20.pending) return;
  const wasGuess = q20.pending.guess;
  q20.asked.push({ q: q20.pending.q, a: answer, guess: wasGuess });
  q20.pending = null;

  if (wasGuess && answer === "CORRECT") {
    q20.phase = "over";
    q20.result = "won";
    q20.reveal = true;
    if (e) burst(e.clientX, e.clientY, ["🎉", "💞", "🏆"]);
  } else if (q20.asked.length >= Q20_MAX) {
    q20.phase = "over";
    q20.result = "lost";
    q20.reveal = true;
  }
  q20Push();
}

[["q20Yes", "YES"], ["q20No", "NO"], ["q20Sometimes", "SOMETIMES"],
 ["q20Correct", "CORRECT"], ["q20Wrong", "NOPE"]].forEach(([id, answer]) => {
  document.getElementById(id).addEventListener("click", (e) => q20Answer(answer, e));
});

function q20Fresh() {
  q20 = { phase: "setup", thinker: null, word: "", asked: [], pending: null, result: null, reveal: false };
  q20Push();
}

document.getElementById("q20Again").addEventListener("click", q20Fresh);

// Restart, but available at ANY point — "Play again" only appears once a round
// is over, which leaves no way out of a game you've lost interest in. It clears
// the SHARED row, so like the duel's it arms on the first tap and commits on
// the second; a stray thumb shouldn't bin the other phone's game.
let q20RestartArmed = null;
const q20RestartBtn = document.getElementById("q20Restart");

function q20DisarmRestart() {
  clearTimeout(q20RestartArmed);
  q20RestartArmed = null;
  q20RestartBtn.textContent = "🔄 Restart";
  q20RestartBtn.classList.remove("toggled");
}

q20RestartBtn.addEventListener("click", () => {
  if (q20RestartArmed) {
    q20DisarmRestart();
    q20Fresh();
    popToast("Fresh game 🔄 somebody think of something");
    return;
  }
  q20RestartBtn.textContent = "Sure? Wipes both 💔";
  q20RestartBtn.classList.add("toggled");
  q20RestartArmed = setTimeout(q20DisarmRestart, 3500);
});

// ---------------- rendering ----------------
function q20RenderSync() {
  document.getElementById("q20SyncHint").textContent =
    !supaOn()            ? "Local mode — this phone is playing on its own"
    : q20Synced === false ? "⚠️ Can't reach the database — this phone is playing alone"
    : q20Synced === true  ? "Shared 💞 questions and answers land on both phones"
    : "Connecting…";
}

function q20RenderCount() {
  const left = Math.max(0, Q20_MAX - q20.asked.length);
  document.getElementById("q20Left").textContent = left;
  document.getElementById("q20Mood").textContent =
    q20.phase === "asking" ? q20Mood(left) : "";
}

function q20RenderLog() {
  const box = document.getElementById("q20Log");
  box.innerHTML = "";
  q20.asked.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "q20-row";
    const n = document.createElement("span");
    n.className = "q20-n";
    n.textContent = (i + 1);
    const q = document.createElement("span");
    q.className = "q20-q";
    q.textContent = (item.guess ? "🎯 " : "") + item.q;
    const a = document.createElement("span");
    a.className = "q20-a q20-" + item.a.toLowerCase();
    a.textContent = item.a;
    row.append(n, q, a);
    box.appendChild(row);
  });
  if (!q20.asked.length) {
    const empty = document.createElement("div");
    empty.className = "q20-empty";
    empty.textContent = "No questions yet. The silence is deafening.";
    box.appendChild(empty);
  }
  box.scrollTop = box.scrollHeight;
}

function q20Render() {
  const el = id => document.getElementById(id);
  const iAmThinker = q20IamThinker();
  const iAmGuesser = q20IamGuesser();

  // paints BOTH games' rows — they share `#me`, so they must agree (js/duel.js)
  if (typeof renderWhoAmIRows === "function") renderWhoAmIRows();

  // whose turn it is, in words
  const roleLine =
    !wdMe ? "Pick who you are, then somebody think of something."
    : q20.phase === "setup" && q20.thinker === wdMe ? "You're thinking. Type your secret below 🤫"
    : q20.phase === "setup" && q20.thinker ? capitalise(q20.thinker) + " is thinking of something…"
    : q20.phase === "setup" ? "Nobody's thinking of anything yet."
    : q20.phase === "over" ? (q20.result === "won" ? pickStable(Q20_WON) : pickStable(Q20_LOST))
    : iAmThinker ? (q20.pending ? "They asked. Answer honestly-ish 😈" : "Waiting for their question…")
    : iAmGuesser ? (q20.pending ? "Asked! Waiting on " + capitalise(q20.thinker) + "…" : "Your turn — ask anything.")
    : "Watching " + capitalise(q20.thinker) + "'s game.";
  el("q20Role").textContent = roleLine;

  // setup controls
  el("q20Start").style.display = q20.phase === "setup" && !(q20.thinker === wdMe) ? "inline-block" : "none";
  el("q20SetupBox").style.display = q20.phase === "setup" && q20.thinker === wdMe ? "block" : "none";

  // the asking board
  el("q20Board").style.display = q20.phase === "setup" ? "none" : "block";

  // the secret, for the thinker's eyes only
  const secret = el("q20Secret");
  if (q20.phase !== "setup" && (iAmThinker || q20.reveal)) {
    secret.style.display = "block";
    secret.textContent = (q20.reveal && !iAmThinker ? "It was: " : "Your secret: ") + q20.word;
  } else {
    secret.style.display = "none";
  }

  // pending question + the three (or two) answer buttons
  const pendingBox = el("q20Pending");
  const showAnswers = iAmThinker && q20.pending && q20.phase === "asking";
  pendingBox.style.display = q20.pending && q20.phase === "asking" ? "block" : "none";
  if (q20.pending) {
    el("q20PendingQ").textContent = (q20.pending.guess ? "🎯 " : "") + q20.pending.q;
  }
  el("q20Answers").style.display = showAnswers && !q20.pending.guess ? "flex" : "none";
  el("q20GuessAnswers").style.display = showAnswers && q20.pending.guess ? "flex" : "none";

  // the guesser's inputs
  const canAsk = iAmGuesser && q20.phase === "asking" && !q20.pending;
  el("q20AskBox").style.display = iAmGuesser && q20.phase === "asking" ? "block" : "none";
  el("q20Ask").disabled = !canAsk;
  el("q20Guess").disabled = !canAsk;
  el("q20Ask").placeholder = q20.pending ? "waiting for an answer…" : "is it alive? bigger than a cat?…";

  el("q20Again").style.display = q20.phase === "over" ? "inline-block" : "none";

  q20RenderCount();
  q20RenderLog();
  q20RenderSync();
}

function capitalise(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

// Stable per game so the verdict doesn't reshuffle on every poll.
function pickStable(list) {
  const seed = q20.asked.length + (q20.word ? q20.word.length : 0);
  return list[seed % list.length];
}
