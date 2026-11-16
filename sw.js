// Service worker sederhana: ambil dari internet dulu, cadangan dari cache.
const CACHE = "mdiia-security-v12";
const FILES = ["./", "./index.html", "./css/style.css", "./js/common.js", "./js/firebase-config.js", "./manifest.json", "./icon-192.png", "./logo.png", "./suara/izin-disetujui.mp3", "./suara/izin-belum-aktif.mp3", "./suara/kartu-tidak-terdaftar.mp3", "./suara/efek-benar.mp3", "./suara/efek-salah.mp3"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r.status === 200) { const salin = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, salin)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(e.request)));
});
