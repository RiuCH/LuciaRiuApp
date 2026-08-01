// The service worker. It exists for exactly one reason: a web app cannot be
// woken by a push without one.
//
// ══════════════════════════════════════════════════════════════════════════
//  READ THIS BEFORE ADDING ANYTHING
//
//  There is NO `fetch` handler here, and there must never be one.
//
//  The sessions board used to say "deliberately NO service worker", and the
//  reason was right: a service worker that caches the shell is exactly how
//  two phones end up running different versions of the app, which is golden
//  rule 4. That reason is about CACHING, not about service workers — a worker
//  with no fetch handler intercepts no requests, caches nothing, and cannot
//  serve a stale page. Every load still comes from the network, so a deploy
//  still reaches both phones the moment they reload.
//
//  Adding `self.addEventListener("fetch", …)` — even "just for the icons" —
//  breaks golden rule 4. Don't. If offline support is ever genuinely wanted,
//  that's a conversation about rule 4, not a quiet commit.
// ══════════════════════════════════════════════════════════════════════════
//
// The push carries no payload on purpose (see api/notify.js), so there is
// nothing to read off the event — the text is fixed and the app itself shows
// what actually changed. iOS also requires that a push ALWAYS results in a
// visible notification; failing to show one can cost the permission entirely,
// which is why there's no conditional around showNotification.

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Lucia ♥ Riu", {
      body: "Something new 💞",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      // One tag, so three photos in a row collapse into one line on the lock
      // screen instead of three identical ones.
      tag: "lr-new",
      renotify: true
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    // Prefer an app window that's already open — opening a second one is
    // disorienting, and on iOS the home-screen app is a single window anyway.
    const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of open) {
      if ("focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow("./");
  })());
});
