// duel.js — Lucia ♥ Riu
// Word Duel: letter-pair rounds, hearts, and the penalty roulette.
// One phone runs the game (live Math.random, session state).

// ---------------- WORD DUEL ----------------
// One phone runs the game during a call (DB sync comes later).
// Letters are weighted toward playable combos: common starts × common ends.
const WD_STARTS = "AAABBBCCCDDDEEEFFGGHHIIJKLLMMNNOOPPPRRRSSSSTTTUVWY";
const WD_ENDS   = "AADDDEEEEGGGHHKKLLLMMNNNOOPPRRRSSSTTTTWYY";
const WD_PENALTIES = {
  funny: [
    "Send a selfie making the ugliest face you can. It may legally be used as blackmail.",
    "Talk in a terrible British accent for the next 5 minutes of the call. Cheerio.",
    "Send a 3-sentence apology speech for losing — maximum drama, minimum dignity.",
    "Change your phone wallpaper to a photo the winner picks. 24 hours minimum.",
    "Sing the chorus of a song the winner chooses. Voice message. No excuses.",
    "Do 10 pushups on camera. Form will be judged. Harshly.",
    "The winner picks your profile picture for tomorrow. Choose your enemy wisely.",
    "Speak only in questions for the next 3 minutes? Can you do it? Are you sure?",
    "Send a voice message narrating your defeat like a nature documentary.",
    "Draw a portrait of the winner in 60 seconds and send it. It will be framed. Emotionally."
  ],
  spicy: [
    "Send the winner your most smoldering selfie. Effort is mandatory.",
    "Give the winner one IOU kiss — redeemable anywhere, anytime, no refusing.",
    "Describe your favorite thing about the winner's looks. In detail. Out loud. Now.",
    "Whisper the next thing you say on the call. Whatever it is.",
    "Send a flirty text so good it would've worked on you.",
    "The winner picks your outfit for the next video call. Within reason. Barely.",
    "Tell the winner exactly what you'd do if you were together right now. Start talking.",
    "One genuine compliment about the winner every hour, next 3 hours. Set alarms.",
    "Blow a kiss on camera. Make it embarrassingly cinematic.",
    "Rate the winner's kissing skills out of 10, out loud, and defend the score."
  ],
  ldr: [
    "You plan the entire next video date: theme, food, activity. Winner just shows up.",
    "Write the winner a goodnight text so sweet it needs a warning label. Tonight.",
    "Order or mail the winner one small surprise this week. Budget: love.",
    "Make a 3-song playlist titled 'Sorry I Lost' and send it.",
    "Good-morning selfie to the winner for the next 3 days. Set the alarm.",
    "Match the winner's timezone for tomorrow's call — even the ugly hours.",
    "Write 5 things we're doing at the next reunion. Send the list. It's binding.",
    "The winner schedules one surprise call this week — you MUST pick up.",
    "Photo-tour of your whole day tomorrow: minimum 5 pictures.",
    "Count the days until the reunion in a voice message. Dramatically. With feeling."
  ]
};
let wdHearts = { lucia: 5, riu: 5 };
let wdRoundNum = 1;
let wdOver = false;
let wdMode = "funny";
let wdLastPenalty = "";

const wdLettersEl = document.getElementById("wdLetters");

function wdRollLetters() {
  wdLettersEl.classList.add("swapping");
  setTimeout(() => {
    const l1 = WD_STARTS[Math.floor(Math.random() * WD_STARTS.length)];
    const l2 = WD_ENDS[Math.floor(Math.random() * WD_ENDS.length)];
    document.getElementById("wdL1").textContent = l1;
    document.getElementById("wdL2").textContent = l2;
    document.getElementById("wdSub").innerHTML =
      "First to say a word that <b>starts with " + l1 + "</b> and <b>ends with " + l2 +
      "</b> wins the round. Proper words only — the other player is the judge 😌";
    wdLettersEl.classList.remove("swapping");
  }, 250);
}

function wdRenderHearts() {
  ["lucia", "riu"].forEach(p => {
    const cap = p === "lucia" ? "Lucia" : "Riu";
    document.getElementById("wdHearts" + cap).textContent =
      "❤️".repeat(wdHearts[p]) + "🖤".repeat(5 - wdHearts[p]);
    document.getElementById("wdRow" + cap).classList.toggle("wd-dead", wdHearts[p] === 0);
  });
}

function wdLoseHeart(loser, e) {
  if (wdOver) return;
  wdHearts[loser]--;
  wdRenderHearts();
  const name = loser === "lucia" ? "Lucia" : "Riu";
  if (e) burst(e.clientX, e.clientY, ["💔", "🥀", "😵"]);
  if (wdHearts[loser] === 0) { wdGameOver(loser); return; }
  wdRoundNum++;
  document.getElementById("wdRound").textContent = wdRoundNum;
  popToast(name + " loses a heart 💔 " + wdHearts[loser] + " left!");
  wdRollLetters();
}

function wdGameOver(loser) {
  wdOver = true;
  const name = loser === "lucia" ? "Lucia" : "Riu";
  const panel = document.getElementById("wdPenaltyPanel");
  panel.style.display = "block";
  document.getElementById("wdLoserLine").textContent = "💀 " + name + " is out of hearts!";
  document.getElementById("wdSpin").textContent = "🎰 Spin " + name + "'s penalty";
  popToast(name + " is DEFEATED 😈 Time for judgment");
  burst(innerWidth / 2, innerHeight / 2, ["💀", "😈", "⚡"]);
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function wdRematch() {
  wdHearts = { lucia: 5, riu: 5 };
  wdRoundNum = 1;
  wdOver = false;
  document.getElementById("wdRound").textContent = 1;
  document.getElementById("wdPenaltyPanel").style.display = "none";
  document.getElementById("wdPenalty").classList.remove("show");
  wdRenderHearts();
  wdRollLetters();
  popToast("Hearts refilled — round 1 💞");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("wdReroll").addEventListener("click", (e) => {
  wdRollLetters();
  burst(e.clientX, e.clientY);
});
document.getElementById("wdLostLucia").addEventListener("click", (e) => wdLoseHeart("lucia", e));
document.getElementById("wdLostRiu").addEventListener("click", (e) => wdLoseHeart("riu", e));
document.getElementById("wdSpin").addEventListener("click", (e) => {
  const pool = WD_PENALTIES[wdMode];
  let pick;
  do { pick = pool[Math.floor(Math.random() * pool.length)]; }
  while (pick === wdLastPenalty && pool.length > 1);
  wdLastPenalty = pick;
  const box = document.getElementById("wdPenalty");
  box.textContent = pick;
  box.classList.add("show");
  burst(e.clientX, e.clientY, ["🎰", "😈", "✨"]);
});
document.getElementById("wdRematch").addEventListener("click", wdRematch);
document.querySelectorAll(".wd-modes .chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".wd-modes .chip").forEach(c => c.classList.remove("sel"));
    chip.classList.add("sel");
    wdMode = chip.dataset.mode;
    document.getElementById("wdPenalty").classList.remove("show");
  });
});
