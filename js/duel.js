// duel.js — Lucia ♥ Riu
// Word Duel: letter-pair rounds, shared hearts, and the penalty roulette.
// State lives in the `duel` table (one row) so both phones agree; with
// Supabase off or unreachable it degrades to the old one-phone session game.

// ---------------- WORD DUEL ----------------
// Letters are weighted toward playable combos: common starts × common ends.
const WD_STARTS = "AAABBBCCCDDDEEEFFGGHHIIJKLLMMNNOOPPPRRRSSSSTTTUVWY";
const WD_ENDS   = "AADDDEEEEGGGHHKKLLLMMNNNOOPPRRRSSSTTTTWYY";
// Penalties are organised by SITUATION, not by flavour: what's even possible
// depends entirely on whether we're in the same room. Each pool mixes funny,
// spicy and nasty, and the draw is from the whole pool — the flavour tag just
// gets shown alongside the result so you know what you're in for.
const WD_FLAVORS = { funny: "😂 Funny", spicy: "🌶️ Spicy", nasty: "😈 Nasty" };
const WD_PENALTIES = {
  inperson: [
    { f: "funny", t: "Talk in a terrible British accent for the next 5 minutes. Cheerio." },
    { f: "funny", t: "Stand up and deliver a 3-sentence apology speech. Maximum drama, minimum dignity." },
    { f: "funny", t: "10 pushups. Right now. Form will be judged, harshly." },
    { f: "funny", t: "Sing the chorus of a song the winner picks. Out loud. In this room." },
    { f: "funny", t: "Speak only in questions for 3 minutes? Can you manage it? Are you sure?" },
    { f: "funny", t: "Draw a portrait of the winner in 60 seconds. It will be displayed. Forever." },
    { f: "funny", t: "The winner does your hair however they want. It stays that way for an hour." },
    { f: "funny", t: "Narrate the next 2 minutes of your life like a nature documentary." },
    { f: "funny", t: "You're the designated snack-fetcher for the rest of the evening. Off you go." },
    { f: "funny", t: "The winner picks your outfit for the rest of the day. No vetoes." },
    { f: "spicy", t: "Five-minute massage for the winner. Timed. No negotiating." },
    { f: "spicy", t: "Kiss the winner. They choose where." },
    { f: "spicy", t: "Slow dance with the winner to a song they pick. Full commitment." },
    { f: "spicy", t: "Compliment the winner's body out loud, in detail, holding eye contact the whole time." },
    { f: "spicy", t: "Big spoon duty all night. No complaints, no rolling away." },
    { f: "spicy", t: "Winner's choice: neck kisses or a proper back scratch. You deliver either way." },
    { f: "nasty", t: "Whisper what you want to do to them. In their ear. Right now." },
    { f: "nasty", t: "The winner gets one guaranteed yes tonight. Any request. No refusing." },
    { f: "nasty", t: "The winner picks what you're wearing to bed tonight. Or what you're not." },
    { f: "nasty", t: "One instruction from the winner every hour tonight. You follow all of them." }
  ],
  ldr: [
    { f: "funny", t: "Send a selfie making the ugliest face you can. It may legally be used as blackmail." },
    { f: "funny", t: "Change your phone wallpaper to a photo the winner picks. 24 hours minimum." },
    { f: "funny", t: "Send a voice message narrating your defeat like a nature documentary." },
    { f: "funny", t: "The winner picks your profile picture for tomorrow. Choose your enemy wisely." },
    { f: "funny", t: "Sing the chorus of a song the winner chooses. Voice message. No excuses." },
    { f: "funny", t: "Make a 3-song playlist titled 'Sorry I Lost' and send it." },
    { f: "funny", t: "Draw a portrait of the winner in 60 seconds and send it. It will be framed. Emotionally." },
    { f: "spicy", t: "Send the winner your most smoldering selfie. Effort is mandatory." },
    { f: "spicy", t: "Give the winner one IOU kiss — redeemable the second we're together, no refusing." },
    { f: "spicy", t: "Send a flirty text so good it would've worked on you." },
    { f: "spicy", t: "Voice message your favorite thing about the winner's looks. In detail." },
    { f: "spicy", t: "The winner picks your outfit for the next video call. Within reason. Barely." },
    { f: "spicy", t: "One genuine compliment about the winner every hour, next 3 hours. Set alarms." },
    { f: "spicy", t: "Blow a kiss on camera. Make it embarrassingly cinematic." },
    { f: "ldr", t: "You plan the entire next video date: theme, food, activity. Winner just shows up." },
    { f: "ldr", t: "Write the winner a goodnight text so sweet it needs a warning label. Tonight." },
    { f: "ldr", t: "Order or mail the winner one small surprise this week. Budget: love." },
    { f: "ldr", t: "Good-morning selfie to the winner for the next 3 days. Set the alarm." },
    { f: "ldr", t: "Match the winner's timezone for tomorrow's call — even the ugly hours." },
    { f: "ldr", t: "Write 5 things we're doing at the next reunion. Send the list. It's binding." },
    { f: "ldr", t: "Photo-tour of your whole day tomorrow: minimum 5 pictures." },
    { f: "ldr", t: "Count the days until the reunion in a voice message. Dramatically. With feeling." },
    { f: "nasty", t: "Voice message the winner describing exactly what happens the first hour we're alone." },
    { f: "nasty", t: "Text the winner one thing you've thought about doing to them but never said out loud. Now." },
    { f: "nasty", t: "The winner picks what you sleep in tonight. Photographic proof required." },
    { f: "nasty", t: "Set a reminder for 11pm and send the winner a message that ruins their concentration." },
    { f: "nasty", t: "Tell the winner your favorite thing they've ever done to you. Full detail. No abbreviating." },
    { f: "nasty", t: "Send a photo taken from the winner's favorite angle of you. They'll know the one." },
    { f: "nasty", t: "Answer any three questions the winner asks tonight. Completely honestly. No passing." },
    { f: "nasty", t: "Describe what you'd do if the winner walked in right now — in exactly three messages." }
  ]
};
// `ldr` doubles as a flavour label in that pool, so give it one too.
WD_FLAVORS.ldr = "💌 Long Distance";

function wdFlavorOf(text) {
  for (const pool of Object.values(WD_PENALTIES)) {
    const hit = pool.find(p => p.t === text);
    if (hit) return WD_FLAVORS[hit.f] || "";
  }
  return "";
}

// ---- state (mirrors the `duel` row when Supabase is up) ----
let wdHearts = { lucia: 5, riu: 5 };
let wdRoundNum = 1;
let wdPenaltyMode = "ldr";   // we're apart more often than not
let wdPlay = "say";                       // say | type
let wdWords = { lucia: null, riu: null };
let wdFirstBy = null;                     // who answered first this round
let wdL = { l1: "?", l2: "?" };
let wdPenaltyText = "";
let wdMe = getHashParam("me") || null;    // which of us is on this phone
let wdPushing = false;                    // don't let a poll clobber my own write

const wdLettersEl = document.getElementById("wdLetters");
const wdWordInput = document.getElementById("wdWordInput");

function wdOver() { return wdHearts.lucia === 0 || wdHearts.riu === 0; }
function wdCap(p) { return p === "lucia" ? "Lucia" : "Riu"; }
function wdOther(p) { return p === "lucia" ? "riu" : "lucia"; }

// ---- Supabase plumbing (all of it optional — see golden rule 6) ----
async function wdPush(patch) {
  if (!supaOn()) return null;
  wdPushing = true;
  try {
    const rows = await supa("duel?id=eq.1", {
      method: "PATCH",
      body: Object.assign({ updated_at: new Date().toISOString() }, patch)
    });
    return rows && rows[0];
  } catch (e) {
    return null;
  } finally {
    wdPushing = false;
  }
}

function wdApply(row) {
  if (!row) return;
  wdHearts = { lucia: row.hearts_lucia, riu: row.hearts_riu };
  wdRoundNum = row.round;
  wdPlay = row.play_mode || "say";
  wdWords = { lucia: row.word_lucia, riu: row.word_riu };
  wdFirstBy = row.first_by;
  // guard against a row still holding a pre-v7.1 flavour name
  wdPenaltyMode = WD_PENALTIES[row.penalty_mode] ? row.penalty_mode : "ldr";
  wdPenaltyText = row.penalty || "";
  if (row.l1 && row.l2) { wdL = { l1: row.l1, l2: row.l2 }; }
  wdRenderAll();
}

async function wdPull() {
  if (!supaOn() || wdPushing) return;
  try {
    const rows = await supa("duel?id=eq.1&select=*");
    if (rows && rows[0]) wdApply(rows[0]);
  } catch (e) { /* offline — keep playing locally */ }
}

// Poll only while the duel is on screen; cheap enough at this cadence and it
// keeps both phones honest without a realtime SDK (which the no-SDK rule bars).
setInterval(() => { if (activeTab === "duel") wdPull(); }, 2500);
TAB_HOOKS.duel = wdPull;

// ---- rendering ----
function wdRenderLetters(animate) {
  const paint = () => {
    document.getElementById("wdL1").textContent = wdL.l1;
    document.getElementById("wdL2").textContent = wdL.l2;
    document.getElementById("wdSub").innerHTML = wdPlay === "type"
      ? "Type a word that <b>starts with " + wdL.l1 + "</b> and <b>ends with " + wdL.l2 +
        "</b>. Fastest submit is shown — but you two still decide who loses 😌"
      : "First to say a word that <b>starts with " + wdL.l1 + "</b> and <b>ends with " + wdL.l2 +
        "</b> wins the round. Proper words only — the other player is the judge 😌";
    wdLettersEl.classList.remove("swapping");
  };
  if (animate) { wdLettersEl.classList.add("swapping"); setTimeout(paint, 250); }
  else paint();
}

function wdRenderHearts() {
  ["lucia", "riu"].forEach(p => {
    document.getElementById("wdHearts" + wdCap(p)).textContent =
      "❤️".repeat(wdHearts[p]) + "🖤".repeat(5 - wdHearts[p]);
    const row = document.getElementById("wdRow" + wdCap(p));
    row.classList.toggle("wd-dead", wdHearts[p] === 0);
    row.classList.toggle("wd-me", wdMe === p);
  });
  document.getElementById("wdRound").textContent = wdRoundNum;
}

function wdRenderRace() {
  const box = document.getElementById("wdRace");
  document.getElementById("wdTypeBox").style.display = wdPlay === "type" ? "block" : "none";
  document.querySelectorAll("#wdPlayModes .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.play === wdPlay));
  if (wdPlay !== "type") return;

  const iAnswered = wdMe && wdWords[wdMe];
  wdWordInput.disabled = !wdMe || !!iAnswered;
  wdWordInput.placeholder = !wdMe ? "pick who you are first ↓"
    : iAnswered ? "answered — hit New letters for the next round" : "your word…";

  box.innerHTML = "";
  ["lucia", "riu"].forEach(p => {
    const line = document.createElement("div");
    const who = document.createElement("b");
    who.textContent = wdCap(p);
    line.appendChild(who);
    const w = document.createElement("span");
    w.className = "wd-word";
    if (!wdWords[p]) {
      w.className += " wd-hidden";
      w.textContent = "thinking…";
    } else if (iAnswered || !wdMe) {
      // only reveal once you've committed your own answer — no peeking
      w.textContent = wdWords[p];
    } else {
      w.className += " wd-hidden";
      w.textContent = "answered ✓";
    }
    line.appendChild(w);
    if (wdFirstBy === p) {
      const fast = document.createElement("span");
      fast.className = "wd-fast";
      fast.textContent = " ⚡ first";
      line.appendChild(fast);
    }
    box.appendChild(line);
  });
}

function wdRenderPenalty() {
  const panel = document.getElementById("wdPenaltyPanel");
  const over = wdOver();
  panel.style.display = over ? "block" : "none";
  document.querySelectorAll(".wd-modes:not(.wd-playmodes) .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.mode === wdPenaltyMode));
  if (over) {
    const loser = wdHearts.lucia === 0 ? "lucia" : "riu";
    document.getElementById("wdLoserLine").textContent = "💀 " + wdCap(loser) + " is out of hearts!";
    document.getElementById("wdSpin").textContent = "🎰 Spin " + wdCap(loser) + "'s penalty";
  }
  const box = document.getElementById("wdPenalty");
  box.textContent = wdPenaltyText;
  box.classList.toggle("show", !!wdPenaltyText);
  const flavor = document.getElementById("wdFlavor");
  const label = wdPenaltyText ? wdFlavorOf(wdPenaltyText) : "";
  flavor.textContent = label;
  flavor.style.display = label ? "inline-flex" : "none";
}

function wdRenderWhoAmI() {
  document.querySelectorAll("#wdWhoAmI .chip").forEach(c =>
    c.classList.toggle("sel", c.dataset.me === wdMe));
  document.getElementById("wdSyncHint").textContent = supaOn()
    ? "Hearts are shared — you'll both see the same score 💞"
    : "Local mode — this phone keeps score on its own (set up Supabase to share it)";
}

function wdRenderAll() {
  wdRenderLetters(false);
  wdRenderHearts();
  wdRenderRace();
  wdRenderPenalty();
  wdRenderWhoAmI();
}

// ---- actions ----
// New letters is now the ONLY thing that starts a fresh round: losing a heart
// deliberately leaves the pair up, so you can argue about it first.
function wdRollLetters(bumpRound) {
  wdL = {
    l1: WD_STARTS[Math.floor(Math.random() * WD_STARTS.length)],
    l2: WD_ENDS[Math.floor(Math.random() * WD_ENDS.length)]
  };
  if (bumpRound) wdRoundNum++;
  wdWords = { lucia: null, riu: null };
  wdFirstBy = null;
  wdWordInput.value = "";
  wdRenderLetters(true);
  wdRenderHearts();
  wdRenderRace();
  if (bumpRound) {
    wdPush({ l1: wdL.l1, l2: wdL.l2, round: wdRoundNum, word_lucia: null, word_riu: null, first_by: null });
  }
}

function wdLoseHeart(loser, e) {
  if (wdOver()) return;
  wdHearts[loser] = Math.max(0, wdHearts[loser] - 1);
  if (e) burst(e.clientX, e.clientY, ["💔", "🥀", "😵"]);
  if (wdHearts[loser] === 0) {
    popToast(wdCap(loser) + " is DEFEATED 😈 Time for judgment");
    burst(innerWidth / 2, innerHeight / 2, ["💀", "😈", "⚡"]);
  } else {
    popToast(wdCap(loser) + " loses a heart 💔 " + wdHearts[loser] + " left!");
  }
  wdRenderAll();
  if (wdOver()) document.getElementById("wdPenaltyPanel").scrollIntoView({ behavior: "smooth", block: "center" });
  wdPush({ hearts_lucia: wdHearts.lucia, hearts_riu: wdHearts.riu });
}

async function wdSubmitWord() {
  const word = wdWordInput.value.trim();
  if (!wdMe) { popToast("Tap who you are first 😌"); return; }
  if (!word) return;
  if (!new RegExp("^" + wdL.l1 + ".*" + wdL.l2 + "$", "i").test(word)) {
    popToast("That has to start with " + wdL.l1 + " and end with " + wdL.l2 + " 🤨");
    return;
  }
  const col = "word_" + wdMe;
  wdWords[wdMe] = word;
  wdRenderRace();

  if (!supaOn()) { wdFirstBy = wdFirstBy || wdMe; wdRenderRace(); return; }
  // Let Postgres settle the race: this only matches while first_by is still
  // null, so whoever's write lands first wins — no clock comparison needed.
  wdPushing = true;
  try {
    const claim = await supa("duel?id=eq.1&first_by=is.null", {
      method: "PATCH",
      body: { first_by: wdMe, [col]: word, updated_at: new Date().toISOString() }
    });
    if (claim && claim.length) {
      wdFirstBy = wdMe;
      popToast("First! ⚡");
    } else {
      await supa("duel?id=eq.1", { method: "PATCH", body: { [col]: word, updated_at: new Date().toISOString() } });
      popToast("Submitted — " + wdCap(wdOther(wdMe)) + " beat you to it ⚡");
    }
  } catch (e) {
    // DB unreachable: fall back to this phone deciding the race, same as local mode
    wdFirstBy = wdFirstBy || wdMe;
    popToast("Couldn't sync that one — it still counts here 💞");
  } finally {
    wdPushing = false;
  }
  wdRenderRace();
}

function wdRematch() {
  wdHearts = { lucia: 5, riu: 5 };
  wdRoundNum = 1;
  wdPenaltyText = "";
  wdWords = { lucia: null, riu: null };
  wdFirstBy = null;
  wdWordInput.value = "";
  wdRollLetters(false);
  wdRenderAll();
  popToast("Hearts refilled — round 1 💞");
  window.scrollTo({ top: 0, behavior: "smooth" });
  wdPush({
    hearts_lucia: 5, hearts_riu: 5, round: 1, penalty: null,
    l1: wdL.l1, l2: wdL.l2, word_lucia: null, word_riu: null, first_by: null
  });
}

// ---- wiring ----
document.getElementById("wdReroll").addEventListener("click", (e) => {
  wdRollLetters(true);
  burst(e.clientX, e.clientY);
});
document.getElementById("wdLostLucia").addEventListener("click", (e) => wdLoseHeart("lucia", e));
document.getElementById("wdLostRiu").addEventListener("click", (e) => wdLoseHeart("riu", e));
document.getElementById("wdSubmitWord").addEventListener("click", wdSubmitWord);
wdWordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") wdSubmitWord(); });

document.getElementById("wdSpin").addEventListener("click", (e) => {
  const pool = WD_PENALTIES[wdPenaltyMode];
  let pick;
  do { pick = pool[Math.floor(Math.random() * pool.length)].t; }
  while (pick === wdPenaltyText && pool.length > 1);
  wdPenaltyText = pick;
  wdRenderPenalty();
  burst(e.clientX, e.clientY, ["🎰", "😈", "✨"]);
  wdPush({ penalty: pick });
});
document.getElementById("wdRematch").addEventListener("click", wdRematch);

document.querySelectorAll(".wd-modes:not(.wd-playmodes) .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    wdPenaltyMode = chip.dataset.mode;
    wdPenaltyText = "";
    wdRenderPenalty();
    wdPush({ penalty_mode: wdPenaltyMode, penalty: null });
  });
});
document.querySelectorAll("#wdPlayModes .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    wdPlay = chip.dataset.play;
    wdRenderLetters(false);
    wdRenderRace();
    wdPush({ play_mode: wdPlay });
  });
});
document.querySelectorAll("#wdWhoAmI .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    wdMe = chip.dataset.me;
    setHashParam("me", wdMe);   // survives refresh, no localStorage needed
    wdRenderAll();
    popToast("You're playing as " + wdCap(wdMe) + " 💞");
  });
});
