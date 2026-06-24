const CACHE_NAME = "stashtab-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  )
);

self.addEventListener("fetch", (e) => {
  const { method, url } = e.request;
  const u = new URL(url);

  // Only cache GET requests from same origin
  if (method !== "GET" || u.origin !== self.location.origin) return;

  // Never cache navigation / HTML — let CF edge handle it
  if (e.request.mode === "navigate" || u.pathname.endsWith(".html")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
