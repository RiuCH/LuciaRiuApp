// moodboard.js — Lucia ♥ Riu
//
// Two matching photo moodboards inside 💝 Memories. The requirements are
// shared and ordered; each square holds one Lucia photo and one Riu photo.
// The top chips reset the whole board to one person, while 🔄 flips only the
// square it belongs to. View state is deliberately memory-only.
//
// Persistence uses three ordinary settings rows, so this needs no migration:
// moodboard_prompts, moodboard_lucia, moodboard_riu. Photos reuse Food's
// private storage path under moodboards/<person>/ and its resize/sign helpers.

const MB_DEFAULT_PROMPTS = [
  "When I was little",
  "My favorite food",
  "When I was a teenager",
  "My favorite color",
  "My favorite photo of us",
  "Best place I've visited",
  "My spirit animal",
  "A song that feels like me",
  "A dream for our future"
];
const MB_KEYS = {
  prompts: "moodboard_prompts",
  lucia: "moodboard_lucia",
  riu: "moodboard_riu"
};
const MB_REFRESH_MS = 15000;
const MB_MAX_PROMPTS = 60;

let mbPrompts = MB_DEFAULT_PROMPTS.slice();
let mbBoards = { lucia: [], riu: [] };
let mbFaces = [];
let mbSelected = "lucia";
let mbReady = null;
let mbLoadedAt = 0;
let mbBusy = false;
let mbUploadSlot = null;

const mbEl = id => document.getElementById(id);
const mbName = person => person === "riu" ? "Riu" : "Lucia";
const mbOther = person => person === "riu" ? "lucia" : "riu";
const mbCanSync = () => supaOn() &&
  (typeof authSignedIn !== "function" || authSignedIn());

function mbParse(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed;
  } catch (e) { return fallback; }
}

function mbNormalPhoto(value) {
  if (!value || typeof value !== "object") return null;
  if (!value.url && !value.path && !value.viewUrl) return null;
  return {
    url: typeof value.url === "string" ? value.url : "",
    path: typeof value.path === "string" ? value.path : "",
    viewUrl: typeof value.viewUrl === "string" ? value.viewUrl : "",
    local: !!value.local
  };
}

function mbNormalBoard(value) {
  const source = Array.isArray(value) ? value : [];
  return mbPrompts.map((unused, i) => mbNormalPhoto(source[i]));
}

function mbRowsMap(rows) {
  const map = {};
  (rows || []).forEach(row => { if (row && row.key) map[row.key] = row.value; });
  return map;
}

// loadSettings() already fetched the full settings table at boot. Adopt that
// snapshot instead of issuing a duplicate request a millisecond later.
function mbAdopt(rows) {
  const map = mbRowsMap(rows);
  const previousFaces = mbFaces.slice();
  if (Object.prototype.hasOwnProperty.call(map, MB_KEYS.prompts)) {
    const saved = mbParse(map[MB_KEYS.prompts], []);
    if (Array.isArray(saved)) {
      mbPrompts = saved
        .filter(prompt => typeof prompt === "string" && prompt.trim())
        .map(prompt => prompt.trim().slice(0, 80));
    }
  }
  mbBoards.lucia = mbNormalBoard(mbParse(map[MB_KEYS.lucia], []));
  mbBoards.riu = mbNormalBoard(mbParse(map[MB_KEYS.riu], []));
  // A background refresh updates photo data, not what the person is currently
  // looking at. Only the Lucia/Riu chips deliberately reset every face.
  mbFaces = mbPrompts.map((unused, i) =>
    previousFaces[i] === "riu" || previousFaces[i] === "lucia"
      ? previousFaces[i]
      : mbSelected);
  mbReady = true;
  mbLoadedAt = Date.now();
  mbRender();
  mbResolveViews();
}

async function mbLoad() {
  if (!mbCanSync()) {
    mbReady = null;
    mbRender();
    return;
  }
  try {
    const keys = [MB_KEYS.prompts, MB_KEYS.lucia, MB_KEYS.riu].join(",");
    const rows = await supa("settings?select=key,value&key=in.(" + keys + ")");
    mbAdopt(rows || []);
  } catch (e) {
    mbReady = false;
    mbRender();
  }
}

function mbLoadIfNeeded() {
  // A hidden chooser view must not fetch. The tab hook will call us again the
  // instant Moodboard is actually visible.
  if (activeTab !== "treats" || treatsPick !== "moodboard") {
    mbRender();
    return;
  }
  if (mbReady !== true || Date.now() - mbLoadedAt > MB_REFRESH_MS) mbLoad();
  else mbRender();
}

async function mbResolveViews() {
  if (typeof fdResolveViews !== "function") return;
  const photos = [];
  ["lucia", "riu"].forEach(person =>
    mbBoards[person].forEach(photo => { if (photo && !photo.local) photos.push(photo); }));
  try {
    if (await fdResolveViews(photos)) mbRender();
  } catch (e) { /* stored public URL fallback still renders */ }
}

async function mbSaveSetting(key, value) {
  if (!mbCanSync()) return false;
  await supa("settings?on_conflict=key", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: { key: key, value: JSON.stringify(value) }
  });
  mbReady = true;
  mbLoadedAt = Date.now();
  return true;
}

async function mbSaveBoard(person) {
  return mbSaveSetting(MB_KEYS[person], mbBoards[person].map(photo => {
    if (!photo || photo.local) return null;
    return { url: photo.url || "", path: photo.path || "" };
  }));
}

function mbPhotoUrl(photo) {
  if (!photo) return "";
  if (photo.local) return photo.viewUrl || "";
  if (typeof fdViewUrl === "function") return fdViewUrl(photo);
  return photo.viewUrl || photo.url || "";
}

function mbStatus(message) {
  const status = mbEl("mbStatus");
  if (!status) return;
  if (message) {
    status.textContent = message;
    return;
  }
  const sync = mbCanSync()
    ? (mbReady === false ? " · sync unavailable" : " · shared on both phones")
    : " · local preview only";
  const mixed = mbFaces.some(person => person !== mbSelected);
  status.textContent = mixed
    ? "Mixed board — flip any square or tap a name to reset" + sync
    : mbName(mbSelected) + "'s moodboard · " + mbPrompts.length + " squares" + sync;
}

function mbSetBusy(busy, message) {
  mbBusy = busy;
  const add = mbEl("mbAddSquare");
  if (add) add.disabled = busy;
  if (message) mbStatus(message);
}

function mbOwnerButton(person) {
  const chip = document.createElement("span");
  chip.className = "mb-owner";
  chip.textContent = mbName(person);
  return chip;
}

function mbAction(label, className, text, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mb-action " + className;
  button.setAttribute("aria-label", label);
  button.textContent = text;
  button.addEventListener("click", event => {
    event.stopPropagation();
    handler();
  });
  return button;
}

function mbRenderTile(slot) {
  const person = mbFaces[slot] || mbSelected;
  const photo = mbBoards[person][slot] || null;
  const tile = document.createElement("div");
  tile.className = "mb-tile mb-" + person;
  tile.dataset.slot = String(slot);
  tile.dataset.person = person;

  const number = document.createElement("span");
  number.className = "mb-number";
  number.textContent = String(slot + 1);

  const owner = mbOwnerButton(person);

  const photoButton = document.createElement("button");
  photoButton.type = "button";
  photoButton.className = "mb-photo";
  photoButton.setAttribute("aria-label",
    (photo ? "Replace" : "Add") + " " + mbName(person) + "'s photo for " + mbPrompts[slot]);

  const url = mbPhotoUrl(photo);
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = mbName(person) + " — " + mbPrompts[slot];
    photoButton.appendChild(img);
  } else {
    const empty = document.createElement("span");
    empty.className = "mb-empty";
    empty.textContent = "💕";
    photoButton.appendChild(empty);
  }

  const prompt = document.createElement("span");
  prompt.className = "mb-prompt";
  prompt.textContent = mbPrompts[slot];
  photoButton.appendChild(prompt);
  photoButton.addEventListener("click", () => mbChoosePhoto(slot));

  const flip = mbAction(
    "Flip square " + (slot + 1) + " to " + mbName(mbOther(person)),
    "mb-flip",
    "🔄",
    () => mbFlip(slot)
  );
  const remove = mbAction(
    "Delete square " + (slot + 1),
    "mb-delete",
    "🗑️",
    () => mbDeleteSquare(slot)
  );

  tile.append(number, owner, photoButton, flip, remove);
  return tile;
}

function mbRender() {
  const grid = mbEl("mbGrid");
  if (!grid) return;
  grid.textContent = "";
  mbPrompts.forEach((unused, slot) => grid.appendChild(mbRenderTile(slot)));
  if (!mbPrompts.length) {
    const empty = document.createElement("div");
    empty.className = "mb-boardempty";
    empty.textContent = "No squares yet — add the first requirement below 💕";
    grid.appendChild(empty);
  }
  document.querySelectorAll("#mbPeople .chip").forEach(chip =>
    chip.classList.toggle("sel", chip.dataset.person === mbSelected));
  mbStatus();
}

function mbReset(person) {
  mbSelected = person === "riu" ? "riu" : "lucia";
  mbFaces = mbPrompts.map(() => mbSelected);
  mbRender();
}

function mbFlip(slot) {
  mbFaces[slot] = mbOther(mbFaces[slot] || mbSelected);
  mbRender();
}

function mbChoosePhoto(slot) {
  if (mbBusy) return;
  mbUploadSlot = slot;
  const input = mbEl("mbFile");
  if (input) input.click();
}

function mbRevokeLocal(photo) {
  if (photo && photo.local && photo.viewUrl) {
    try { URL.revokeObjectURL(photo.viewUrl); } catch (e) {}
  }
}

async function mbDeleteObject(path) {
  if (!path || !supaOn() || typeof fdStorageHeaders !== "function") return;
  try {
    await fetch(SUPABASE_URL + "/storage/v1/object/" + FD_BUCKET + "/" + path, {
      method: "DELETE",
      headers: fdStorageHeaders()
    });
  } catch (e) { /* an orphan is safer than restoring a deleted square */ }
}

async function mbHandlePhoto(file) {
  const slot = mbUploadSlot;
  mbUploadSlot = null;
  if (slot === null || slot >= mbPrompts.length || !file || !/^image\//.test(file.type)) {
    if (file) popToast("That wasn't a photo 🤔");
    return;
  }
  const person = mbFaces[slot] || mbSelected;
  const oldPhoto = mbBoards[person][slot] || null;

  // Double-click/file:// and signed-out mode remain useful as a local preview.
  if (!mbCanSync()) {
    mbRevokeLocal(oldPhoto);
    mbBoards[person][slot] = {
      url: "",
      path: "",
      viewUrl: URL.createObjectURL(file),
      local: true
    };
    mbRender();
    popToast("Previewed here — sign in to sync it 💞");
    return;
  }

  if (typeof fdResize !== "function" || typeof fdUploadBlob !== "function") {
    popToast("Photo tools aren't ready — try reopening Memories");
    return;
  }

  mbSetBusy(true, "Uploading " + mbName(person) + "'s square…");
  let nextPhoto = null;
  try {
    const blob = await fdResize(file);
    const stamp = typeof fdStamp === "function"
      ? fdStamp()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const path = "moodboards/" + person + "/" + stamp + ".jpg";
    const url = await fdUploadBlob(blob, path, "image/jpeg");
    nextPhoto = { url: url, path: path, viewUrl: "", local: false };
    mbBoards[person][slot] = nextPhoto;
    await mbSaveBoard(person);
    if (oldPhoto && oldPhoto.path && oldPhoto.path !== path) mbDeleteObject(oldPhoto.path);
    if (typeof fdResolveViews === "function") await fdResolveViews([nextPhoto]);
    mbRender();
    popToast(mbName(person) + "'s square saved 💕");
  } catch (e) {
    mbBoards[person][slot] = oldPhoto;
    if (nextPhoto && nextPhoto.path) mbDeleteObject(nextPhoto.path);
    mbRender();
    popToast("Couldn't save that photo — try again");
  } finally {
    mbSetBusy(false);
    mbRender();
  }
}

async function mbAddSquare() {
  if (mbBusy) return;
  const input = mbEl("mbNewPrompt");
  const prompt = input ? input.value.trim() : "";
  if (!prompt) { popToast("Give the new square a requirement 💕"); return; }
  if (mbPrompts.length >= MB_MAX_PROMPTS) {
    popToast("Sixty squares is already a whole gallery 😅");
    return;
  }

  mbPrompts.push(prompt.slice(0, 80));
  mbBoards.lucia.push(null);
  mbBoards.riu.push(null);
  mbFaces.push(mbSelected);
  if (input) input.value = "";
  mbRender();

  if (!mbCanSync()) {
    popToast("Square added here — sign in to share it");
    return;
  }

  mbSetBusy(true, "Adding the new square…");
  try {
    await mbSaveSetting(MB_KEYS.prompts, mbPrompts);
    popToast("New square added 💕");
  } catch (e) {
    mbPrompts.pop();
    mbBoards.lucia.pop();
    mbBoards.riu.pop();
    mbFaces.pop();
    popToast("Couldn't add that square");
  } finally {
    mbSetBusy(false);
    mbRender();
  }
}

async function mbDeleteSquare(slot) {
  if (mbBusy || slot < 0 || slot >= mbPrompts.length) return;
  const prompt = mbPrompts[slot];
  const message = "Delete square " + (slot + 1) + ": “" + prompt + "”?\n\n" +
    "This removes the square and both Lucia's and Riu's photos.";
  if (!window.confirm(message)) return;

  const removed = {
    prompt: mbPrompts[slot],
    lucia: mbBoards.lucia[slot] || null,
    riu: mbBoards.riu[slot] || null,
    face: mbFaces[slot] || mbSelected
  };
  mbPrompts.splice(slot, 1);
  mbBoards.lucia.splice(slot, 1);
  mbBoards.riu.splice(slot, 1);
  mbFaces.splice(slot, 1);
  mbRender();

  if (!mbCanSync()) {
    mbRevokeLocal(removed.lucia);
    mbRevokeLocal(removed.riu);
    popToast("Square deleted from this preview");
    return;
  }

  mbSetBusy(true, "Deleting the square…");
  try {
    // Prompts define the visible length. Save that first so an interrupted
    // three-row update can never resurrect the removed square.
    await mbSaveSetting(MB_KEYS.prompts, mbPrompts);
    await mbSaveBoard("lucia");
    await mbSaveBoard("riu");
    [removed.lucia, removed.riu].forEach(photo => {
      if (photo && photo.path) mbDeleteObject(photo.path);
      else mbRevokeLocal(photo);
    });
    popToast("Square deleted");
  } catch (e) {
    // Keep the intended local result. The prompt row may already have saved,
    // and a future edit re-writes both board rows in their current order.
    popToast("Deleted here, but sync needs another try");
  } finally {
    mbSetBusy(false);
    mbRender();
  }
}

document.querySelectorAll("#mbPeople .chip").forEach(chip =>
  chip.addEventListener("click", () => mbReset(chip.dataset.person)));

if (mbEl("mbAddSquare")) {
  mbEl("mbAddSquare").addEventListener("click", mbAddSquare);
  mbEl("mbNewPrompt").addEventListener("keydown", event => {
    if (event.key === "Enter") mbAddSquare();
  });
  mbEl("mbFile").addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    mbHandlePhoto(file);
  });
}

// Pull the other phone's new photos while this board is actually on screen.
// Kept completely idle in Food/Gifts and on every other tab.
setInterval(() => {
  if (!mbBusy && mbCanSync() && activeTab === "treats" &&
      treatsPick === "moodboard" && Date.now() - mbLoadedAt >= MB_REFRESH_MS) {
    mbLoad();
  }
}, MB_REFRESH_MS);

mbRender();
