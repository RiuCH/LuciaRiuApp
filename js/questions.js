// questions.js — Lucia ♥ Riu
// Question of the Day: the hardcoded BANK (offline fallback), category
// chips, the deterministic daily pick, and the game page rendering.

// ---------------- QUESTION BANK ----------------
const BANK = {
  funny: [
    "If I were a kitchen appliance, which one would I be — and why?",
    "What's the weirdest thing you've caught me doing when I thought no one was watching?",
    "If we got arrested together, what would it 100% be for?",
    "Which animal do I turn into when I'm hangry?",
    "What would the title of a reality show about us be?",
    "If my snoring was a music genre, which one would it be?",
    "What's one word or phrase I say WAY too much?",
    "If we swapped bodies for a day, what's the first thing you'd do?",
    "What is my most useless talent?",
    "If our love story was a movie, which actor would play me? Be honest.",
    "What smell instantly reminds you of me? Be nice… or don't.",
    "If I was an ice cream flavor, what would I be called?",
    "What's the dumbest argument we've ever had?",
    "Which emoji best describes my dance moves?",
    "If aliens abducted us both, who would they return first — and why?",
    "What is my villain origin story?",
    "If our couple had a mascot, what would it be?",
    "What ridiculous thing would I buy first if we won the lottery?",
    "Which cartoon character is basically me?",
    "What's the funniest face I make, and when do I make it?",
    "If my brain had a loading screen, what would it say?",
    "What conspiracy theory could you convince me of by Friday?",
    "What would I go viral on the internet for — for all the wrong reasons?",
    "If we opened a terrible restaurant together, what would it be called?",
    "What's one chore I do so badly you suspect it's on purpose?",
    "Who would survive longer in a zombie apocalypse — and defend your answer?",
    "What's the weirdest compliment you could give me right now?",
    "If I came with a warning label, what would it say?",
    "What theme song should play every time I walk into a room?",
    "What's probably the most embarrassing thing in my search history?",
    "If we were a crime duo, who's the brains and who's the one who gets us caught?",
    "What's a hill I would absolutely die on for no good reason?",
    "If I had to be haunted by a ghost, what kind of ghost would annoy me the most?",
    "What do you think I was like at age seven?",
    "Which household object understands me on a spiritual level?"
  ],
  romantic: [
    "What was the exact moment you knew you were falling for me?",
    "What's your favorite memory of us that you secretly replay in your head?",
    "What little thing do I do that makes you feel the most loved?",
    "Where in the world would you want to wake up next to me tomorrow?",
    "What's one thing about my smile you've never told me?",
    "If you could relive one of our dates exactly as it happened, which one?",
    "What song feels like 'us' to you?",
    "What do you look forward to most about growing old together?",
    "When do you find me most attractive — when I'm not even trying?",
    "What tiny detail about me did you notice the very first time we met?",
    "How did you describe me to your friends when we first started dating?",
    "What's your favorite way I say 'I love you' without actually saying it?",
    "If we renewed our vows tomorrow, what's one line you'd include?",
    "What future memory with me are you most excited to make?",
    "What's one thing I've taught you about love?",
    "Which of my quirks did you fall for first?",
    "What does 'home' feel like when you think of me?",
    "What's the most romantic thing I've done without realizing it was romantic?",
    "If our love had a color, what would it be and why?",
    "What do you want us to be doing exactly 10 years from today?",
    "When did you last catch yourself just staring at me?",
    "Which dream of mine do you secretly root for the hardest?",
    "What part of our story would you never, ever change?",
    "What's a promise you want to make me today?",
    "What's your favorite photo of us, and why that one?",
    "What's something small I did this week that made your heart squeeze?",
    "If you wrote me a love letter right now, what would the first line be?",
    "What's a place we've never been that you want to fall in love with together?",
    "What did you think our first kiss would be like — and how was the real one better?",
    "What's one thing you hope we still do together when we're 80?"
  ],
  spicy: [
    "What am I wearing when you find me completely irresistible?",
    "What's one kiss from me you still think about?",
    "Describe our best kiss ever in exactly three words.",
    "Where's the most adventurous place you'd want to make out with me?",
    "What's your favorite way I touch you?",
    "What's one thing I do in public that secretly drives you a little crazy?",
    "If tonight had no rules, how would you want it to start?",
    "Which outfit of mine would you like to see more often… on the floor?",
    "What's a fantasy date night you've never told me about?",
    "Slow dance in the dark or a shower together — pick one for tonight.",
    "What compliment about your body do you never get tired of hearing from me?",
    "What's the most attractive thing I do without even noticing?",
    "A whisper in your ear or a text under the table — how should I flirt with you when we're out?",
    "What's one thing you want more of from me this week? Kisses count.",
    "Which is more dangerous: morning cuddles that go too far, or midnight ones?",
    "Where is my most kissable spot? Point to it later.",
    "If I planned a surprise 'date' that starts at 10pm, what should I include?",
    "What's one small thing I could do tonight that would completely ruin your concentration?",
    "Which memory of us do you think about when you miss me the most… physically?",
    "Rate my flirting game from 1–10, then show me how it's done.",
    "What's the first thing you noticed about my body?",
    "If we had a whole rainy Sunday in bed, what's on the agenda?",
    "What's something I wear that you consider a personal attack (in the best way)?",
    "Kissing my neck or holding my waist — which one do you enjoy more?",
    "What look do I give you that you can read instantly?"
  ],
  nasty: [
    "What's one thing you've always wanted to try with me but never said out loud?",
    "What's your favorite spot in our home… and be honest about why.",
    "If we had a 'yes night' — neither of us can say no to a request — what's your first request?",
    "What's something I do in bed that you'd like on repeat?",
    "Truth: have you ever thought about me at a VERY inappropriate time? When?",
    "We have the place to ourselves for exactly one hour, starting now. Go.",
    "Lights on or lights off — and defend your answer.",
    "What's the naughtiest thought you've had about me this week?",
    "What should our code word be for 'we're leaving this party immediately'?",
    "Which of my texts has ever made you blush in public?",
    "What's one rule we should break tonight?",
    "Set the scene perfectly: music, lighting, outfit. What are you picking?",
    "What's something new you want to try this month? I'm taking notes.",
    "A massage that starts innocent, or a kiss that doesn't — choose your opening move.",
    "What's the hottest thing I've ever said to you? Quote it if you dare.",
    "Where should my hands be right now, hypothetically speaking?",
    "What's your favorite 'view' of me?",
    "If we'd just met tonight, how would you seduce me?",
    "What's one text I could send tomorrow that would completely derail your day?",
    "Describe tonight's plans in exactly five words. Make them count.",
    "What time of day am I at my most dangerous?",
    "What's one thing I underestimate about my own effect on you?",
    "Pick a movie scene you'd want to reenact with me — any genre.",
    "What am I better at than I realize? Be specific.",
    "Finish this sentence: 'Tonight, I want you to…'"
  ],
  ldr: [
    "What's the FIRST thing we're doing when we're in the same room again?",
    "If you could teleport to me for just 10 minutes right now, what would we do?",
    "What do you miss most about me today? Pick exactly one thing.",
    "Virtual date night: synced movie, cooking the same dinner, or online games — pick tonight's.",
    "What song do you play when you miss me?",
    "What's the hardest part of your day without me — and the easiest?",
    "If I mailed you a care package tomorrow, what MUST be in it?",
    "What's one thing you want to show me in your city next time I visit?",
    "Describe your day today like a dramatic movie trailer.",
    "What photo of us did you look at most recently?",
    "When we reunite, are we more likely to cry, laugh, or make everyone at the airport uncomfortable?",
    "What's something you're saving to tell me in person instead of over text?",
    "Voice message or video call — what does your heart need tonight?",
    "What do you hold or sleep with that reminds you of me? Be honest.",
    "Plan our next visit in exactly 3 emojis. The other has to guess the itinerary.",
    "What's one habit of mine you weirdly miss?",
    "What's your favorite message I've ever sent you? Scroll back and quote it.",
    "If the distance were a video game boss, what's today's difficulty rating and why?",
    "What are we eating first when we're together again?",
    "What's one thing this distance has taught you about us?"
  ]
};


const CHIPS = {
  funny:    { label: "😂 Funny",    color: "#ffd166" },
  romantic: { label: "💕 Romantic", color: "#ff7aa2" },
  spicy:    { label: "🌶️ Spicy",   color: "#ff6b4a" },
  nasty:    { label: "😈 After Dark", color: "#ff2e63" },
  ldr:      { label: "💌 Long Distance", color: "#7ac7ff" }
};


let usedShuffle = [];
let current = null;

function pools() {
  return afterDark ? ["spicy", "nasty"] : ["funny", "romantic", "spicy", "nasty", "ldr"];
}

// The hardcoded BANK is the offline fallback; once Supabase answers,
// loadQuestions() swaps this to the DB copy (same content ⇒ same daily pick).
let QUESTION_SOURCE = BANK;

function flatPool() {
  const cats = pools();
  const out = [];
  cats.forEach(c => QUESTION_SOURCE[c].forEach(q => out.push({ cat: c, text: q })));
  return out;
}

function dailyQuestion() {
  const pool = flatPool();
  const seed = dayNumber() * 7919 + (afterDark ? 104729 : 0);
  const rng = mulberry32(seed);
  return pool[Math.floor(rng() * pool.length)];
}

function randomQuestion() {
  const pool = flatPool();
  if (usedShuffle.length >= pool.length) usedShuffle = [];
  let pick;
  let guard = 0;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
    guard++;
  } while (guard < 60 && (usedShuffle.includes(pick.text) || (current && pick.text === current.text)));
  usedShuffle.push(pick.text);
  return pick;
}


// ---------------- GAME RENDER ----------------
const elQ = document.getElementById("question");
const elChip = document.getElementById("chip");
const elHint = document.getElementById("hint");

function styleChip(el, cat) {
  const chip = CHIPS[cat];
  el.textContent = chip.label;
  el.style.borderColor = chip.color;
  el.style.background = chip.color + "33";
}

function show(q, isDaily) {
  current = q;
  elQ.classList.add("swapping");
  setTimeout(() => {
    elQ.textContent = q.text;
    styleChip(elChip, q.cat);
    elQ.classList.remove("swapping");
  }, 250);
  elHint.textContent = isDaily
    ? "Today's question is the same for both of you — no cheating, answer honestly 😌"
    : "Bonus round! Hit the button again if you're feeling brave.";
}

function renderHeader() {
  document.getElementById("daypill").innerHTML = "Day <b>" + dayNumber() + "</b>";
  document.getElementById("datepill").textContent =
    new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  // home teaser
  const savedDark = afterDark;
  afterDark = false;
  const dq = dailyQuestion();
  afterDark = savedDark;
  styleChip(document.getElementById("teaserChip"), dq.cat);
  document.getElementById("teaserGo").textContent = "Day " + dayNumber() + " — tap to play →";
}

document.getElementById("shuffleBtn").addEventListener("click", (e) => {
  show(randomQuestion(), false);
  burst(e.clientX, e.clientY);
});

document.getElementById("darkBtn").addEventListener("click", (e) => {
  afterDark = !afterDark;
  document.body.classList.toggle("afterdark", afterDark);
  // <html> too: it owns the canvas colour behind iOS's overscroll bounce
  document.documentElement.classList.toggle("afterdark", afterDark);
  const themeMeta = document.getElementById("themeColor");
  if (themeMeta) themeMeta.content = afterDark ? "#0d0208" : "#1a0b2e";
  e.target.classList.toggle("toggled", afterDark);
  e.target.textContent = afterDark ? "🔥 After Dark: ON" : "🌶️ After Dark";
  if (activeTab === "game") {
    document.getElementById("subtitle").textContent = afterDark ? "After Dark Edition" : SUBTITLES.game;
  }
  usedShuffle = [];
  show(dailyQuestion(), true);
  if (afterDark) burst(e.clientX, e.clientY, ["🔥","😈","💋"]);
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  const text = (current ? current.text : "") + "  — Lucia ♥ Riu, Day " + dayNumber();
  try {
    await navigator.clipboard.writeText(text);
    popToast("Copied! Send it 💌");
  } catch {
    popToast("Couldn't copy — long-press the question instead");
  }
});
