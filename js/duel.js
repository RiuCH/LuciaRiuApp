// duel.js — Lucia ♥ Riu
// Word Duel: letter-pair rounds, shared hearts, and the penalty roulette.
// State lives in two rows of the existing `settings` table so both phones
// agree with zero database setup; if Supabase is off or unreachable it
// degrades to a one-phone session game and SAYS SO in the panel.

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
    { f: "nasty", t: "One instruction from the winner every hour tonight. You follow all of them." },
    { f: "funny", t: "Every sentence you say for the next 5 minutes has to rhyme. Starting now. Somehow." },
    { f: "funny", t: "The winner picks a celebrity. You do the impression until they can guess who it is." },
    { f: "funny", t: "Best runway walk across the room. Twice. The winner scores it out of 10." },
    { f: "funny", t: "Dish duty tonight — and you have to look delighted about it the entire time." },
    { f: "funny", t: "You make the bed tomorrow morning. Hospital corners. No excuses." },
    { f: "spicy", t: "Kiss the winner somewhere new. Somewhere you've never kissed them before." },
    { f: "spicy", t: "Hold eye contact for a full minute. No talking, no laughing, no looking away." },
    { f: "spicy", t: "You can't let go of the winner's hand for the next 20 minutes. Anywhere." },
    { f: "spicy", t: "Sit in the winner's lap for the rest of this game. That's it. That's the penalty." },
    { f: "spicy", t: "The winner picks a spot. You give it 60 seconds of undivided attention." },
    { f: "nasty", t: "You're not allowed to say no to anything for the next 10 minutes. Set a timer." },
    { f: "nasty", t: "The winner leads, you follow — for the next hour, no questions asked." },
    { f: "nasty", t: "Tell the winner the filthiest thought you've had about them today. Word for word." },
    { f: "nasty", t: "The winner picks the lights: on, off or dimmed. Then picks what happens next." },
    { f: "nasty", t: "The winner names a place. You spend a minute there. No negotiating." }
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
    { f: "nasty", t: "Describe what you'd do if the winner walked in right now — in exactly three messages." },
    // Anything doable over a call or a text belongs here too, even when the
    // in-person pool has its own version of it — apart is our default, so this
    // pool has to be the complete one.
    { f: "funny", t: "Talk in a terrible British accent for the next 5 minutes of the call. Cheerio." },
    { f: "funny", t: "Send a 3-sentence apology speech for losing — voice message, maximum drama, minimum dignity." },
    { f: "funny", t: "Do 10 pushups on camera. Form will be judged. Harshly." },
    { f: "funny", t: "Speak only in questions for the next 3 minutes of the call? Can you do it? Are you sure?" },
    { f: "spicy", t: "Whisper the next thing you say on the call. Whatever it is." },
    { f: "spicy", t: "Tell the winner exactly what you'd do if you were together right now. Start talking." },
    { f: "spicy", t: "Rate the winner's kissing skills out of 10, out loud, and defend the score." },
    { f: "ldr", t: "The winner schedules one surprise call this week — you MUST pick up." },
    { f: "nasty", t: "The winner writes the first line of tonight's goodnight text. You have to finish it." },
    { f: "nasty", t: "The winner gets one IOU, redeemable the moment we're in the same room. They name it now." },
    { f: "funny", t: "Send a voice memo reading your own defeat aloud as a dramatic movie trailer." },
    { f: "funny", t: "Text the winner in only emojis for the next hour. Good luck explaining anything." },
    { f: "funny", t: "Send a photo of your worst angle. On purpose. The winner keeps it forever." },
    { f: "funny", t: "Record your best impression of the winner and send it. Then brace yourself." },
    { f: "funny", t: "The winner picks your ringtone for a week. You have to actually set it." },
    { f: "funny", t: "Send a 30-second video reviewing your day like a product you'd rate 2 stars." },
    { f: "spicy", t: "Voice message the winner's name the way you say it when you miss them." },
    { f: "spicy", t: "Text the winner what you'd be doing right now if there were no miles between us." },
    { f: "spicy", t: "Send a photo of just your hands. The winner will know exactly why that's unfair." },
    { f: "spicy", t: "Voice message: describe the last time you couldn't stop thinking about them." },
    { f: "spicy", t: "The winner picks one word. You send a message that makes it sound indecent." },
    { f: "spicy", t: "Send a selfie from bed. Fully clothed. Still devastating." },
    { f: "ldr", t: "Set an alarm for the winner's bedtime and call to say goodnight, wherever you are." },
    { f: "ldr", t: "Send a photo of something in your city you want to show them in person one day." },
    { f: "ldr", t: "Write one thing you're grateful for about them and mail it. Actual paper." },
    { f: "ldr", t: "Watch the sunset and send it — same day, different sky, still ours." },
    { f: "ldr", t: "The winner picks a movie. Watch it tonight, apart, texting through the whole thing." },
    { f: "ldr", t: "Send the winner a countdown screenshot every morning until the reunion." },
    { f: "ldr", t: "Learn one phrase in a language for our next trip and voice-message it. Badly." },
    { f: "nasty", t: "Voice message one sentence you'd only ever whisper. Then hang up immediately." },
    { f: "nasty", t: "The winner picks a time tonight. Whatever they text you then, you answer honestly." },
    { f: "nasty", t: "Describe, in detail, what you want them to do the second they see you." },
    { f: "nasty", t: "Send a photo you'd be embarrassed for anyone else to see. They choose the theme." },
    { f: "nasty", t: "Tell them the thing you think about but have never admitted. Voice, not text." },
    { f: "nasty", t: "The winner gets to ask 'and then what?' three times. You have to keep going." }
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

// ---- sync (all of it optional — see golden rule 6) ----
// The whole game lives in two rows of the `settings` table that already
// exists, so this needs NO database setup: the first write creates them.
// (v7 used a dedicated `duel` table, which meant nothing synced until
// someone remembered to run a migration — while the UI cheerfully claimed
// hearts were shared. Never again: `wdSynced` now drives an honest status.)
const WD_KEY = "duel_state";    // the shared game, as JSON
const WD_FIRST = "duel_first";  // who answered first this round ("" = nobody yet)
let wdSynced = null;            // null = unknown yet, true = sharing, false = alone

function wdSnapshot() {
  return {
    hearts: wdHearts, round: wdRoundNum, l1: wdL.l1, l2: wdL.l2,
    play: wdPlay, words: wdWords, pmode: wdPenaltyMode, penalty: wdPenaltyText
  };
}

function wdSaveKey(key, value) {
  return supa("settings?on_conflict=key", {
    method: "POST", prefer: "resolution=merge-duplicates", body: { key, value }
  });
}

// Push the whole snapshot. Two phones writing within the same round trip can
// clobber each other, but actions here are seconds apart and the 2s poll
// re-converges both sides, so it isn't worth a locking dance.
async function wdPush() {
  if (!supaOn()) { wdSynced = false; wdRenderWhoAmI(); return; }
  wdPushing = true;
  try {
    await wdSaveKey(WD_KEY, JSON.stringify(wdSnapshot()));
    wdSynced = true;
  } catch (e) {
    wdSynced = false;
  } finally {
    wdPushing = false;
    wdRenderWhoAmI();
  }
}

// A fresh round clears the claim back to "" so the next submit can win it.
async function wdResetFirst() {
  wdFirstBy = null;
  if (!supaOn()) return;
  try { await wdSaveKey(WD_FIRST, ""); } catch (e) { wdSynced = false; }
}

// The race, settled by Postgres rather than by two phone clocks: this PATCH
// only matches while the value is still empty, so exactly one submit can win.
// If the row doesn't exist yet (very first round ever) we create it as ours.
async function wdClaimFirst() {
  const rows = await supa("settings?key=eq." + WD_FIRST + "&value=eq.", {
    method: "PATCH", body: { value: wdMe }
  });
  if (rows && rows.length) return true;
  const existing = await supa("settings?key=eq." + WD_FIRST + "&select=value");
  if (!existing || !existing.length) { await wdSaveKey(WD_FIRST, wdMe); return true; }
  return existing[0].value === wdMe;
}

function wdApply(state, firstBy) {
  if (state) {
    if (state.hearts) wdHearts = state.hearts;
    if (state.round) wdRoundNum = state.round;
    if (state.l1 && state.l2) wdL = { l1: state.l1, l2: state.l2 };
    wdPlay = state.play || "say";
    wdWords = state.words || { lucia: null, riu: null };
    wdPenaltyMode = WD_PENALTIES[state.pmode] ? state.pmode : "ldr";
    wdPenaltyText = state.penalty || "";
  }
  wdFirstBy = firstBy || null;
  // don't yank the keyboard out from under someone mid-word
  const typing = document.activeElement === wdWordInput;
  if (!typing) wdWordInput.value = wdWords[wdMe] || "";
  wdRenderAll();
}

async function wdPull() {
  if (!supaOn() || wdPushing) return;
  try {
    const rows = await supa("settings?key=in.(" + WD_KEY + "," + WD_FIRST + ")&select=key,value");
    const map = {};
    (rows || []).forEach(r => { map[r.key] = r.value; });
    let state = null;
    if (map[WD_KEY]) { try { state = JSON.parse(map[WD_KEY]); } catch (e) {} }
    wdSynced = true;
    wdApply(state, map[WD_FIRST] || null);
  } catch (e) {
    wdSynced = false;      // offline — keep playing locally, but say so
    wdRenderWhoAmI();
  }
}

// Poll while the duel is on screen. 2s is brisk enough that a fresh letter
// pair lands on the other phone almost immediately, without a realtime SDK
// (which the no-SDK rule bars anyway).
setInterval(() => { if (activeTab === "duel" && gamesPick === "duel") wdPull(); }, 2000);
// the tab hook runs for whichever game is showing
TAB_HOOKS.duel = () => { if (gamesPick === "duel") wdPull(); else if (typeof q20Pull === "function") q20Pull(); };

// Phones throttle (or freeze) timers in a backgrounded tab, so after a lock
// screen or an app switch the poll can be minutes stale. Catch up the moment
// we're looked at again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && activeTab === "duel" && gamesPick === "duel") wdPull();
});
window.addEventListener("focus", () => { if (activeTab === "duel" && gamesPick === "duel") wdPull(); });

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
  // Say what's actually true. The old version promised sharing unconditionally,
  // which hid the fact that nothing was syncing at all.
  document.getElementById("wdSyncHint").textContent =
    !supaOn()        ? "Local mode — this phone keeps score on its own"
    : wdSynced === false ? "⚠️ Can't reach the database — this phone is playing alone"
    : wdSynced === true  ? "Shared 💞 hearts, letters and answers land on both phones"
    : "Connecting…";
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
    wdPush();
    wdResetFirst();   // fresh round: nobody has answered yet
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
  wdPush();
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
  wdPushing = true;
  try {
    const won = await wdClaimFirst();
    wdFirstBy = wdFirstBy || (won ? wdMe : wdOther(wdMe));
    await wdSaveKey(WD_KEY, JSON.stringify(wdSnapshot()));
    wdSynced = true;
    popToast(won ? "First! ⚡" : "Submitted — " + wdCap(wdOther(wdMe)) + " beat you to it ⚡");
  } catch (e) {
    // DB unreachable: fall back to this phone deciding the race, same as local mode
    wdFirstBy = wdFirstBy || wdMe;
    wdSynced = false;
    popToast("Couldn't sync that one — it still counts here 💞");
  } finally {
    wdPushing = false;
  }
  wdRenderAll();
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
  wdPush();
  wdResetFirst();
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
  wdPush();
});
document.getElementById("wdRematch").addEventListener("click", wdRematch);

document.querySelectorAll(".wd-modes:not(.wd-playmodes) .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    wdPenaltyMode = chip.dataset.mode;
    wdPenaltyText = "";
    wdRenderPenalty();
    wdPush();
  });
});
document.querySelectorAll("#wdPlayModes .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    wdPlay = chip.dataset.play;
    wdRenderLetters(false);
    wdRenderRace();
    wdPush();
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
