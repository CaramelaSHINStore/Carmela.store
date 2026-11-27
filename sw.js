const CACHE_VERSION = "caramel-store-v20261127-4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const CORE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json?v=2",
    "./compressed_1795766509611.jpeg?v=2"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(key => !key.startsWith(CACHE_VERSION)).map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);

    if (url.pathname.endsWith(".json")) {
        event.respondWith(
            fetch(event.request)
                .then(resp => {
                    const copy = resp.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put(event.request, copy)).catch(() => {});
                    return resp;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    const isBrandAsset = url.pathname.endsWith(".jpeg") || url.pathname.endsWith(".jpg") || url.pathname.endsWith(".png") || url.pathname.endsWith(".webp") || url.pathname.endsWith("manifest.json");

    if (isBrandAsset && url.origin === self.location.origin) {
        event.respondWith(
            fetch(event.request)
                .then(resp => {
                    const copy = resp.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put(event.request, copy)).catch(() => {});
                    return resp;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
                const copy = resp.clone();
                caches.open(RUNTIME_CACHE).then(c => c.put(event.request, copy)).catch(() => {});
                return resp;
            }))
        );
    }
});
