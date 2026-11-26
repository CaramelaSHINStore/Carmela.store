const CACHE_NAME = "caramel-store-v6";
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
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
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
    const reqUrl = new URL(event.request.url);

    if (reqUrl.pathname.endsWith(".json") || reqUrl.hostname.includes("api.github.com")) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request)
                .then(networkResp => {
                    if (networkResp && networkResp.status === 200 && reqUrl.origin === self.location.origin) {
                        const cloned = networkResp.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put("./index.html", cloned)).catch(() => {});
                    }
                    return networkResp;
                })
                .catch(async () => {
                    const cachedIndex = await caches.match("./index.html");
                    return cachedIndex || caches.match("./");
                })
        );
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(networkResp => {
                if (networkResp && networkResp.status === 200 && reqUrl.origin === self.location.origin) {
                    const cloned = networkResp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned)).catch(() => {});
                }
                return networkResp;
            })
            .catch(() => caches.match(event.request))
    );
});
