/* Episotia service worker — offline app shell (v2.21.0)
   Strategy: network-first for everything same-origin (updates keep arriving the moment
   you're online), falling back to the cached copy when offline. API calls (TVmaze, TMDB,
   OMDb, GitHub) and images are NOT intercepted — the app handles those failing gracefully.
   The cache refreshes itself on every successful fetch, so this file rarely needs changes. */
const CACHE = "episotia-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192-v5.png", "./icon-512-v5.png", "./apple-touch-icon-v5.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheKey(req){
  const u = new URL(req.url);
  u.search = "";                      // "?v=2.20.3" cache-busting reloads must hit the same entry
  return u.href;
}

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;   // never intercept APIs / CDN images
  e.respondWith(
    fetch(e.request).then(r => {
      if(r.ok){
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(cacheKey(e.request), copy));
      }
      return r;
    }).catch(() =>
      caches.open(CACHE).then(c => c.match(cacheKey(e.request), { ignoreSearch: true }))
        .then(m => m || (e.request.mode === "navigate" ? caches.match("./index.html") : Promise.reject(new Error("offline"))))
    )
  );
});
