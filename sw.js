const STATIC_CACHE = "caramel-static-v20261127-7";
const RUNTIME_CACHE = "caramel-runtime-v20261127-7";

const CORE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./compressed_1795766509611.jpeg"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
                .map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener("message", event => {
    if (event && event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", event => {
    const req = event.request;
    if (!req || req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.includes("OneSignalSDK")) return;

    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req).then(res => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
                }
                return res;
            }).catch(() => caches.match("./index.html"))
        );
        return;
    }

    if (url.pathname.endsWith(".json")) {
        event.respondWith(
            fetch(req, { cache: "no-store" }).then(res => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
                }
                return res;
            }).catch(() => caches.match(req))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(res => {
                if (res && res.ok && (res.type === "basic" || res.type === "default")) {
                    const copy = res.clone();
                    caches.open(RUNTIME_CACHE).then(c => c.put(req, copy)).catch(() => {});
                }
                return res;
            });
        })
    );
});
