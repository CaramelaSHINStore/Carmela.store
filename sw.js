importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = "caramel-store-v2026-11-22";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./IMG-20261116-WA0032.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "SW_UPDATED", version: CACHE_NAME });
          });
        })
      )
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHtmlOrSw =
    request.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/sw.js");

  if (isHtmlOrSw) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(networkResponse => {
          if (networkResponse && networkResponse.ok && request.mode === "navigate") {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match("./index.html").then(cached => cached || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
