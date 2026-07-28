// theme.js — Lucia ♥ Riu
// 🎨 The palette, picked in Settings.
//
// **Shared on purpose.** The theme lives in `settings.theme`, so changing it
// changes it on both phones — same as the reunion date and the couple photo.
// It's one app we both look at, not two installs with two preferences.
//
// A theme is one class on <html> AND <body> (the root needs it too: its
// background-color paints the strip iOS rubber-bands into). Each class only
// redefines the five colour vars; everything else in the app already reads
// them, which is why this file is short and no component knows a colour.
//
// 💞 Together mode still beats every theme — base.css gives `.hot` a more
// specific selector for exactly that reason. Pick any palette; going Together
// still turns the app red.

// `null` means the original root palette, kept as "Classic". Daydream owns
// the long-standing `us` key so existing shared settings that saved the old
// default automatically adopt Lucia's new default without a database migration.
// `dot`/`bar` are the swatch preview — they MUST stay in step with the --bg3
// and --bg1 of the matching class in css/themes.css, or the picker advertises
// a palette the app doesn't have.
const THEMES = {
  us:       { name: "Daydream", cls: "theme-daydream", dot: "#a3b1db", bar: "#f7f3e8" },
  classic:  { name: "Classic",  cls: null,             dot: "#662549", bar: "#1a0b2e" },
  berry:    { name: "Berry",    cls: "theme-berry",    dot: "#761e32", bar: "#1b0a24" },
  midnight: { name: "Midnight", cls: "theme-midnight", dot: "#1f6775", bar: "#090821" },
  sunset:   { name: "Sunset",   cls: "theme-sunset",   dot: "#8c4d1d", bar: "#2b0d20" },
  forest:   { name: "Forest",   cls: "theme-forest",   dot: "#256a2e", bar: "#07181d" },
  ink:      { name: "Ink",      cls: "theme-ink",      dot: "#372e38", bar: "#0b0b0f" }
};
const TH_DEFAULT = "us";
let thCurrent = TH_DEFAULT;

function thKeys() { return Object.keys(THEMES); }
function thValid(k) { return Object.prototype.hasOwnProperty.call(THEMES, k) ? k : TH_DEFAULT; }

// The phone's status/toolbar tint. Read from the live computed value rather
// than a hardcoded hex, so it's right for whichever theme is on AND for
// Together mode — js/tfd.js calls this instead of writing its own colour.
function thSyncBar() {
  const meta = document.getElementById("themeColor");
  if (!meta) return;
  const bg1 = getComputedStyle(document.documentElement)
    .getPropertyValue("--bg1").trim();
  if (bg1) meta.content = bg1;
}

function thApply(key, opts) {
  thCurrent = thValid(key);
  const targets = [document.documentElement, document.body];
  targets.forEach(el => {
    // strip every theme class first: switching Sunset → Forest must not leave
    // both on, and whichever lost the source-order coin toss would win.
    thKeys().forEach(k => { if (THEMES[k].cls) el.classList.remove(THEMES[k].cls); });
    const cls = THEMES[thCurrent].cls;
    if (cls) el.classList.add(cls);
  });
  thSyncBar();
  thRender();
  if (opts && opts.save) thSave(thCurrent);
}

// Shared, so it goes in `settings` like every other preference. No migration:
// `settings` is key/value and has been since v5.
async function thSave(key) {
  setHashParam("theme", key);          // survives a refresh even with no network
  if (!supaOn()) return;
  try {
    await supa("settings?on_conflict=key", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: { key: "theme", value: key }
    });
    popToast(THEMES[key].name + " it is 🎨 — on both phones");
  } catch (e) {
    popToast(typeof authSignedIn === "function" && !authSignedIn()
      ? "Changed on this phone only — sign in to share it 💞"
      : "Changed on this phone only 🎨");
  }
}

// Called from the one boot fetch in js/init.js, so this costs no extra request.
function thAdopt(rows) {
  const row = (rows || []).find(r => r.key === "theme");
  if (row && row.value) thApply(row.value);
}


// ---------------- the picker ----------------
function thRender() {
  const grid = document.getElementById("thGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const frag = document.createDocumentFragment();
  thKeys().forEach(k => {
    const t = THEMES[k];
    const b = document.createElement("button");
    b.className = "th-swatch" + (k === thCurrent ? " sel" : "");
    b.title = t.name;
    b.setAttribute("aria-pressed", String(k === thCurrent));

    const dot = document.createElement("span");
    dot.className = "th-dot";
    // A little gradient rather than a flat chip, so the swatch looks like the
    // app rather than like a colour input.
    dot.style.background = "linear-gradient(135deg, " + t.bar + ", " + t.dot + ")";
    b.appendChild(dot);

    const name = document.createElement("span");
    name.className = "th-name";
    name.textContent = t.name;
    b.appendChild(name);

    b.addEventListener("click", () => {
      if (k === thCurrent) return;
      thApply(k, { save: true });
      burst(innerWidth / 2, 120, ["🎨", "✨", "💞"]);
    });
    frag.appendChild(b);
  });
  grid.appendChild(frag);
}

// Boot: hash param first so a refresh keeps what you picked even offline;
// loadSettings() overrides it with the shared copy a moment later.
(function thInit() {
  const fromHash = getHashParam("theme");
  if (fromHash) thApply(fromHash);
  else thRender();
})();
