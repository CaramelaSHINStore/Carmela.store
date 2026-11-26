const CACHE_NAME = "caramel-store-v2.1";
const CORE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];

self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);

    // Avoid caching dynamic JSON catalogs or external APIs so merchant updates appear smoothly
    if (url.pathname.endsWith(".json") && !url.pathname.endsWith("manifest.json")) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const networkFetch = fetch(event.request).then(resp => {
                    if (resp && resp.ok) {
                        const clone = resp.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
                    }
                    return resp;
                }).catch(() => cached);
                return cached || networkFetch;
            })
        );
    }
});
