/* The Pantry — service worker
   Bump CACHE_VERSION whenever you change the app shell (html/css/js/icons). */
const CACHE_VERSION = "pantry-v1";
const CORE = [
  ".",
  "index.html",
  "assets/styles.css",
  "assets/app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "recipes/index.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails the whole install if one URL 404s, so add individually.
      Promise.allSettled(CORE.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Don't touch cross-origin requests (Google Fonts, recipe photos) — let the network handle them.
  if (url.origin !== self.location.origin) return;

  const isRecipeData = url.pathname.endsWith(".json");

  if (isRecipeData) {
    // Network-first for recipe data so edits show up; fall back to cache offline.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for the app shell.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => {
      // Last resort for navigations: serve the cached shell so the SPA can boot offline.
      if (req.mode === "navigate") return caches.match("index.html");
    }))
  );
});
