const CACHE_VERSION = "v20261128-02";
const STATIC_CACHE = `caramel-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `caramel-images-${CACHE_VERSION}`;
const MAX_CACHED_IMAGES = 140;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=v20261128-02",
  "./app.js?v=v20261128-02",
  "./manifest.json?v=v20261128-02",
  "./compressed_1795766509611.jpeg"
];

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const toDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(toDelete.map(req => cache.delete(req)));
    }
  } catch (e) {}
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  const allowedCaches = new Set([STATIC_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !allowedCaches.has(k)).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", event => {
  if (event && event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always fetch fresh JSON catalog data with no-store, fallback to cache only offline
  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(new Request(event.request, { cache: "no-store" }))
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache First with bounded LRU-like trim for images and icons
  if (/\.(jpe?g|png|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(IMAGE_CACHE).then(async cache => {
              await cache.put(event.request, copy);
              await trimCache(IMAGE_CACHE, MAX_CACHED_IMAGES);
            }).catch(() => {});
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Network-first with cache fallback for HTML/CSS/JS
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
