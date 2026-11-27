const CACHE_NAME = "caramel-store-v20261127-9";
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
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .catch(err => console.warn("SW cache install warning:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event && event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Let external requests (e.g., OneSignal, CDNs, APIs) pass through cleanly
  if (url.origin !== self.location.origin) return;

  // Never intercept OneSignal SDK worker/service routes if hosted locally
  if (url.pathname.includes("OneSignalSDK")) return;

  if (url.pathname.endsWith(".json")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Handle incoming Web Push payloads (standard Push API + OneSignal fallback)
self.addEventListener("push", event => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { body: event.data.text() };
    }
  }

  const dataObj = payload.data && typeof payload.data === "object" ? payload.data : {};
  const title =
    payload.title ||
    (payload.notification && payload.notification.title) ||
    dataObj.title ||
    "كارامل ستور | Caramel Store";

  const options = {
    body:
      payload.body ||
      (payload.notification && payload.notification.body) ||
      dataObj.body ||
      "لديك إشعار جديد من كارامل ستور.",
    icon:
      payload.icon ||
      (payload.notification && payload.notification.icon) ||
      dataObj.icon ||
      "./compressed_1795766509611.jpeg",
    badge:
      payload.badge ||
      dataObj.badge ||
      "./compressed_1795766509611.jpeg",
    dir: "rtl",
    lang: "ar",
    vibrate: [150, 75, 150],
    tag: payload.tag || dataObj.tag || "caramel-store-notification",
    renotify: true,
    data: {
      url:
        payload.url ||
        dataObj.url ||
        dataObj.launchURL ||
        "./"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const rawUrl =
    (event.notification && event.notification.data && event.notification.data.url) || "./";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client && client.url !== targetUrl) {
            return client.navigate(targetUrl).catch(() => {});
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
