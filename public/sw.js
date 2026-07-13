const CACHE = "roberta-functional-shell-v2";
const APP_SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAppShellAsset = APP_SHELL.includes(url.pathname);
  const isNextAsset = url.pathname.startsWith("/_next/");
  const isDocument = event.request.mode === "navigate" || event.request.destination === "document";

  // Never cache HTML or Next.js bundles: avoids broken pages after deploy.
  if (!isSameOrigin || isDocument || isNextAsset) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isAppShellAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })),
    );
  }
});
