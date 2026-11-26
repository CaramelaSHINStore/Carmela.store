const CACHE_NAME = "caramel-store-cache-v7";
const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "https://raw.githubusercontent.com/CaramelaSHINStore/Carmela.store/refs/heads/main/compressed_1795355576678.jpeg"
];

self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
    );
});

self.addEventListener("message", event => {
    if (event && event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

function isJsonOrMerchantRequest(reqUrl) {
    return /\.json(\?|$)/i.test(reqUrl.pathname) || reqUrl.pathname.includes("/merchants/");
}

function isImageRequest(request, reqUrl) {
    return request.destination === "image" || /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(reqUrl.pathname);
}

self.addEventListener("fetch", event => {
    const request = event.request;
    if (!request || request.method !== "GET") return;
    const reqUrl = new URL(request.url);
    if (!reqUrl.protocol.startsWith("http")) return;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).then(networkResponse => {
                if (networkResponse && networkResponse.ok) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
                }
                return networkResponse;
            }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
        );
        return;
    }

    if (isJsonOrMerchantRequest(reqUrl)) {
        event.respondWith(
            fetch(request, { cache: "no-store" }).then(networkResponse => {
                if (networkResponse && networkResponse.ok) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
                }
                return networkResponse;
            }).catch(() => caches.match(request, { ignoreSearch: true }))
        );
        return;
    }

    if (isImageRequest(request, reqUrl)) {
        event.respondWith(
            caches.match(request, { ignoreSearch: true }).then(cachedResponse => {
                const fetchPromise = fetch(request).then(networkResponse => {
                    if (networkResponse && networkResponse.ok) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    if (reqUrl.origin === self.location.origin) {
        event.respondWith(
            fetch(request).then(networkResponse => {
                if (networkResponse && networkResponse.ok) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
                }
                return networkResponse;
            }).catch(() => caches.match(request, { ignoreSearch: true }))
        );
    }
});
