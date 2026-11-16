// Service worker sederhana: ambil dari internet dulu, cadangan dari cache.
const CACHE = "mdiia-security-v3";
const FILES = ["./", "./index.html", "./css/style.css", "./js/common.js", "./js/firebase-config.js", "./manifest.json", "./icon-192.png", "./logo.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    const salin = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, salin)); return r;
  }).catch(() => caches.match(e.request)));
});
