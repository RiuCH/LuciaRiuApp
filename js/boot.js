// boot.js — Lucia ♥ Riu
// The veil that covers the first second of the app.
//
// WHY IT EXISTS
// Two things are only known after a network round trip: the theme
// (`settings.theme`) and the couple photo (`settings.home_photo`). Until they
// land the app renders the DEFAULT palette with an empty photo frame, so
// opening it looked like a mistake being corrected — Daydream flashing to
// Midnight, an empty frame filling in. Both now happen behind this.
//
// WHY IT CAN'T HANG
// Golden rule 6: the app works with Supabase unreachable. So the veil lifts on
// a timer regardless, and every other path is an optimisation on top of that.
// Nothing here may ever be the only reason the app appears.
//
// Loaded FIRST, before js/core.js, because the timer has to start at parse
// time rather than after the rest of the app has finished loading.

// Hard ceiling from parse. Long enough for a normal round trip on a phone,
// short enough that a dead network costs you two seconds, once.
const BOOT_MAX_MS = 2200;
// After settings land, how long to keep waiting for the photo to decode. The
// photo is the point of the frame, but it is not worth a stall.
const BOOT_PHOTO_MS = 900;

let bootLifted = false;
let bootSettled = false;

function bootLift() {
  if (bootLifted) return;
  bootLifted = true;
  const veil = document.getElementById("boot");
  if (!veil) return;
  veil.classList.add("bootgone");
  // display:none after the fade so it can't eat taps mid-transition.
  setTimeout(() => { veil.style.display = "none"; }, 500);
}

// Called by js/init.js once loadSettings() has resolved — which is the moment
// the theme is correct. The photo may still be decoding, so give it a short
// grace period and lift either way.
function bootSettingsLanded() {
  if (bootSettled) return;
  bootSettled = true;
  const img = document.getElementById("cpImg");
  const waiting = img && img.getAttribute("src") && !img.complete;
  if (!waiting) { requestAnimationFrame(bootLift); return; }
  const go = () => requestAnimationFrame(bootLift);
  img.addEventListener("load", go, { once: true });
  img.addEventListener("error", go, { once: true });
  setTimeout(go, BOOT_PHOTO_MS);
}

setTimeout(bootLift, BOOT_MAX_MS);
