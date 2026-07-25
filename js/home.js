// home.js — Lucia ♥ Riu
// Home tab: miss-you texts, anniversary counter, the two clocks, the
// reunion countdown, and the couple photo hero.

const MISSYOU = [
  "Currently accepting applications for someone to steal the blanket. You're the only candidate. 🥺",
  "Warning: thinking about you at dangerous levels today. Send backup (a selfie). 📸",
  "My arms miss their job.",
  "I saw something today and my first thought was you. This keeps happening. No complaints.",
  "Weather report: 100% chance of missing you, scattered daydreams all afternoon. ⛅",
  "Come here. That's it. That's the text.",
  "You owe me approximately 1,000 hugs. Interest is accruing daily. 🧾",
  "Just checked — still yours, still counting days. 🗓️",
  "If missing you burned calories, I'd have abs by now.",
  "Reminder: you're my favorite notification. Now send me one.",
  "I'd walk 500 miles. But please just video call me first. 🎶",
  "Tonight's plan: your voice + my blanket burrito. Non-negotiable.",
  "Missing you is my cardio. 🏃",
  "The bed committee has reviewed the situation and voted unanimously: it's too big without you.",
  "Somewhere between 'I'm fine' and 'book the flight' — that's where I am today. ✈️"
];

// ---------------- ANNIVERSARY ----------------
const ANNIVERSARY = new Date(2026, 5, 2); // June 2, 2026 💞

// Write only when the value actually moved. Of the four counters below, three
// are unchanged on any given second — this keeps them out of the DOM entirely.
function setNum(el, val) {
  const s = String(val);
  if (el.textContent !== s) el.textContent = s;
}

const elTgD = document.getElementById("tgD");
const elTgH = document.getElementById("tgH");
const elTgM = document.getElementById("tgM");
const elTgS = document.getElementById("tgS");

// FAST path — runs every second while Home is on screen. Nothing here parses
// HTML or builds a formatter; it's four integer writes at most.
function tickAnniversary() {
  const ms = Math.max(0, new Date() - ANNIVERSARY);
  setNum(elTgD, Math.floor(ms / 86400000));
  setNum(elTgH, Math.floor(ms / 3600000) % 24);
  setNum(elTgM, Math.floor(ms / 60000) % 60);
  setNum(elTgS, Math.floor(ms / 1000) % 60);
}

// SLOW path — the date line changes once a day, so it rode the 1s tick for no
// reason (including a toLocaleDateString on every pass). Driven by the 60s
// timer in js/init.js instead.
function tickAnnivDate() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYears = new Date(now.getFullYear(), 5, 2);
  const bar = document.getElementById("annivBar");
  const line = document.getElementById("annivLine");

  if (today.getTime() === thisYears.getTime() && now.getFullYear() > 2026) {
    line.innerHTML = "🎉 <b>HAPPY ANNIVERSARY #" + (now.getFullYear() - 2026) + "!!</b> 🎉";
    bar.classList.add("party");
    return;
  }
  bar.classList.remove("party");
  const next = today >= thisYears ? new Date(now.getFullYear() + 1, 5, 2) : thisYears;
  const annivNum = next.getFullYear() - ANNIVERSARY.getFullYear();
  const days = Math.round((next - today) / 86400000);
  line.innerHTML = "🎂 Anniversary #" + annivNum + " in <b>" + days + "</b> days — " +
    next.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------------- LDR / MILES APART ----------------
const TZ_RIU   = { tz: "America/Los_Angeles", label: "San Francisco" };
const TZ_LUCIA = { tz: "America/Phoenix",     label: "Phoenix" };
let reunionDate = null;

(function initReunion() {
  try {
    const m = location.hash.match(/reunion=(\d{4}-\d{2}-\d{2})/);
    if (m) reunionDate = new Date(m[1] + "T00:00:00");
  } catch (e) {}
})();

// Building an Intl.DateTimeFormat costs one to two orders of magnitude more
// than calling .format() on one, and these two never change — so build them
// once here rather than four times a second inside the tick.
const FMT_RIU = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_RIU.tz
});
const FMT_LUCIA = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ_LUCIA.tz
});

function tzOffsetHours(tz, now) {
  const loc = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  return Math.round((loc - now) / 3600000 * 2) / 2;
}

const elTimeRiu = document.getElementById("timeRiu");
const elTimeLucia = document.getElementById("timeLucia");
let lastRiu = "", lastLucia = "";

// FAST path — two formats and (at most) two text writes.
function tickClocks() {
  const now = new Date();
  const r = FMT_RIU.format(now);
  if (r !== lastRiu) { lastRiu = r; elTimeRiu.textContent = r; }
  const l = FMT_LUCIA.format(now);
  if (l !== lastLucia) { lastLucia = l; elTimeLucia.textContent = l; }
}

// SLOW path — Phoenix doesn't do DST and San Francisco does, so this gap moves
// exactly twice a year. It used to be recomputed (with two string-parsed Dates)
// every single second. Driven by the 60s timer in js/init.js.
function tickTzDiff() {
  const now = new Date();
  const diff = tzOffsetHours(TZ_LUCIA.tz, now) - tzOffsetHours(TZ_RIU.tz, now);
  const el = document.getElementById("tzdiff");
  const txt = diff === 0
    ? "Same clock right now — zero excuses not to call 📞"
    : "Lucia is " + Math.abs(diff) + "h " + (diff > 0 ? "ahead" : "behind") + " — plan those calls 📞";
  if (el.textContent !== txt) el.textContent = txt;
}

const elCdLabel = document.getElementById("cdLabel");
const elCdBox = document.getElementById("countdown");
const elCdD = document.getElementById("cdD");
const elCdH = document.getElementById("cdH");
const elCdM = document.getElementById("cdM");
let lastCdLabel = "";

function setLabel(txt) {
  if (lastCdLabel !== txt) { lastCdLabel = txt; elCdLabel.textContent = txt; }
}

function tickCountdown() {
  // With no date set this used to rewrite the same string 86,400 times a day.
  if (!reunionDate) {
    elCdBox.style.display = "none";
    setLabel("Until we're together again — set the date!");
    return;
  }
  const ms = reunionDate - new Date();
  if (ms <= 0) {
    elCdBox.style.display = "none";
    setLabel("IT'S REUNION DAY!! 🎉💞");
    return;
  }
  elCdBox.style.display = "flex";
  setLabel("Until we're together again");
  setNum(elCdD, Math.floor(ms / 86400000));   // changes once a day
  setNum(elCdH, Math.floor(ms / 3600000) % 24); // once an hour
  setNum(elCdM, Math.floor(ms / 60000) % 60);   // once a minute
}

const reunionInput = document.getElementById("reunionInput");
document.getElementById("setDateBtn").addEventListener("click", () => {
  reunionInput.style.display = "inline-block";
  try { reunionInput.showPicker(); } catch (e) { reunionInput.focus(); }
});
reunionInput.addEventListener("change", () => {
  if (!reunionInput.value) return;
  reunionDate = new Date(reunionInput.value + "T00:00:00");
  setHashParam("reunion", reunionInput.value);
  saveReunion(reunionInput.value);
  reunionInput.style.display = "none";
  document.getElementById("setDateBtn").textContent = "📅 Change the date";
  tickCountdown();
  popToast("Countdown set! 💞");
});

let lastMiss = -1;
document.getElementById("missYouBtn").addEventListener("click", async () => {
  let i;
  do { i = Math.floor(Math.random() * MISSYOU.length); } while (i === lastMiss && MISSYOU.length > 1);
  lastMiss = i;
  const box = document.getElementById("missyou");
  box.textContent = MISSYOU[i];
  box.classList.add("show");
  try {
    await navigator.clipboard.writeText(MISSYOU[i]);
    popToast("Copied — now go send it 💌");
  } catch (e) {
    popToast("Long-press to copy 💌");
  }
});


// ---------------- COUPLE PHOTO (home hero) ----------------
// One settings key: home_photo. The value is a direct image URL, a data:
// URL from an upload, or "album:<link>" — an Apple shared-album whose
// photo-of-the-day rotates deterministically (same photo on both phones).
// Fallbacks per golden rule 6: #photo= hash param for links, session-only
// for uploads when the DB is unreachable.
const CP_OFFSET = 15485863; // claimed in SESSIONS.md

function cpShow(src, caption) {
  const img = document.getElementById("cpImg");
  img.onerror = () => {
    img.style.display = "none";
    document.getElementById("cpEmpty").style.display = "flex";
    document.getElementById("cpCaption").textContent = "that photo wouldn't load 🥲";
  };
  img.src = src;
  img.style.display = "block";
  document.getElementById("cpEmpty").style.display = "none";
  document.getElementById("cpCaption").textContent = caption || "us. 💞";
}

async function cpApply(value) {
  if (!value) return;
  if (value.startsWith("album:")) {
    try {
      const photos = await fetchICloudAlbum(value.slice(6));
      if (!photos.length) return;
      const rng = mulberry32(dayNumber() * 7919 + CP_OFFSET);
      const pick = photos[Math.floor(rng() * photos.length)];
      cpShow(pick.full || pick.thumb, "photo of the day — from our album 🍎");
    } catch (e) { /* album unreachable — keep whatever is showing */ }
  } else {
    cpShow(value);
  }
}

async function cpSave(value) {
  if (!value.startsWith("data:")) setHashParam("photo", encodeURIComponent(value));
  if (!supaOn()) {
    popToast(value.startsWith("data:")
      ? "Set for this session — local mode can't keep uploads 🥲"
      : "Photo saved on this device 💞");
    return;
  }
  try {
    await supa("settings?on_conflict=key", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: { key: "home_photo", value: value }
    });
    popToast("Synced — it's on both phones now 💞");
  } catch (e) {
    popToast("Couldn't reach the DB — showing it here for now 🥲");
  }
}

function cpHandleFile(file) {
  if (!file || !file.type || !file.type.startsWith("image/")) return;
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      // downscale + compress so the settings row stays small
      const MAX = 1000;
      const scale = Math.min(1, MAX / Math.max(im.width, im.height));
      const cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(im.width * scale));
      cv.height = Math.max(1, Math.round(im.height * scale));
      cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
      const data = cv.toDataURL("image/jpeg", 0.82);
      cpShow(data);
      cpSave(data);
      burst(innerWidth / 2, 220, ["📸", "💞", "✨"]);
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}

document.getElementById("cpGear").addEventListener("click", () => {
  const box = document.getElementById("cpOptions");
  box.style.display = box.style.display === "none" ? "block" : "none";
});
document.getElementById("cpUploadBtn").addEventListener("click", () => {
  document.getElementById("cpFile").click();
});
document.getElementById("cpFile").addEventListener("change", (e) => {
  cpHandleFile(e.target.files && e.target.files[0]);
  e.target.value = "";
});
document.getElementById("cpLinkBtn").addEventListener("click", () => {
  const row = document.getElementById("cpLinkRow");
  row.style.display = row.style.display === "none" ? "flex" : "none";
  if (row.style.display === "flex") document.getElementById("cpLinkInput").focus();
});
document.getElementById("cpLinkSave").addEventListener("click", () => {
  const raw = document.getElementById("cpLinkInput").value.trim();
  if (!/^https?:\/\//.test(raw)) { popToast("That doesn't look like a link 🤨"); return; }
  const value = icloudToken(raw) ? "album:" + raw : raw;
  cpApply(value);
  cpSave(value);
  document.getElementById("cpLinkInput").value = "";
  document.getElementById("cpLinkRow").style.display = "none";
  document.getElementById("cpOptions").style.display = "none";
});


// ---------------- QUESTION OF THE DAY (home card) ----------------
// One question a day, identical on both phones, and it does NOT change when
// you refresh — dailyQuestion() deals from a date-seeded deck (js/questions.js).
let qotdCurrent = null;

function qotdRender() {
  const q = dailyQuestion();
  qotdCurrent = q;
  document.getElementById("qotdText").textContent = q.text;
  styleChip(document.getElementById("qotdChip"), q.cat);
  document.getElementById("qotdDay").textContent = "Day " + dayNumber();
  return q;
}

document.getElementById("qotdCopy").addEventListener("click", async (e) => {
  e.stopPropagation();
  const text = (qotdCurrent ? qotdCurrent.text : "") + "  — Lucia ♥ Riu, Day " + dayNumber();
  try {
    await navigator.clipboard.writeText(text);
    popToast("Copied! Send it 💌");
  } catch {
    popToast("Couldn't copy — long-press the question instead");
  }
});
