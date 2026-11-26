const CACHE_NAME = "caramel-store-v2026-11-26";
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
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(CORE_ASSETS.map(url => cache.add(url)));
        })
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    const isSameOrigin = url.origin === self.location.origin;

    if (req.mode === "navigate" || url.pathname.endsWith(".json")) {
        event.respondWith(
            fetch(req).then(res => {
                if (res && res.ok && isSameOrigin) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
                }
                return res;
            }).catch(() => caches.match(req).then(cached => cached || caches.match("./index.html")))
        );
        return;
    }

    if (isSameOrigin) {
        event.respondWith(
            caches.match(req).then(cached => {
                const networkFetch = fetch(req).then(res => {
                    if (res && res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
                    }
                    return res;
                }).catch(() => cached);
                return cached || networkFetch;
            })
        );
    }
});
