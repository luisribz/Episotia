/* Episotia service worker — offline app shell + image cache (v2.21.1)
   Shell: network-first for everything same-origin (updates keep arriving the moment
   you're online), falling back to the cached copy when offline.
   Images (posters/stills/backdrops, cross-origin): cache-first with a size cap — seen
   once, available offline forever (image URLs are stable; new art = new URL).
   API calls (TVmaze, TMDB, OMDb, GitHub) are NOT intercepted — the app handles those
   failing gracefully. */
const CACHE = "episotia-shell-v1";
const IMG_CACHE = "episotia-img-v1";
const IMG_MAX = 800;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192-v6.png", "./icon-512-v6.png", "./apple-touch-icon-v6.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheKey(req){
  const u = new URL(req.url);
  u.search = "";                      // "?v=2.20.3" cache-busting reloads must hit the same entry
  return u.href;
}

let trimming = false;
async function trimImgCache(c){
  if(trimming) return;
  trimming = true;
  try{
    const keys = await c.keys();
    if(keys.length > IMG_MAX)
      for(const k of keys.slice(0, keys.length - IMG_MAX)) await c.delete(k);  // insertion order ≈ oldest first
  }catch(e){}
  trimming = false;
}

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // posters / episode stills / hero backdrops — cache-first, any origin
  if(e.request.destination === "image" && url.origin !== location.origin){
    e.respondWith(
      caches.open(IMG_CACHE).then(c =>
        c.match(e.request).then(m => m || fetch(e.request).then(r => {
          if(r.ok || r.type === "opaque"){ c.put(e.request, r.clone()); trimImgCache(c); }
          return r;
        }))
      )
    );
    return;
  }

  if(url.origin !== location.origin) return;   // never intercept APIs

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
