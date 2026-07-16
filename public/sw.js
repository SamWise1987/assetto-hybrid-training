const CACHE_VERSION = "v6";
const SHELL_CACHE = `roberta-functional-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `roberta-functional-runtime-${CACHE_VERSION}`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

async function cacheSuccessfulResponse(cacheName, request, response) {
  if (!response.ok) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function latestOfflineDocument(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  const shell = await caches.open(SHELL_CACHE);
  return (await runtime.match(request))
    || (await runtime.match("/"))
    || (await shell.match("/"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAppShellAsset = APP_SHELL.includes(url.pathname);
  const isNextAsset = url.pathname.startsWith("/_next/");
  const isDocument = event.request.mode === "navigate" || event.request.destination === "document";

  if (!isSameOrigin) {
    return;
  }

  if (isDocument) {
    event.respondWith(fetch(event.request).then(async (response) => {
      await cacheSuccessfulResponse(RUNTIME_CACHE, event.request, response);
      return response;
    }).catch(() => latestOfflineDocument(event.request)));
    return;
  }

  if (isNextAsset) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then(async (response) => {
      await cacheSuccessfulResponse(RUNTIME_CACHE, event.request, response);
      return response;
    })));
    return;
  }

  if (isAppShellAsset) {
    event.respondWith(fetch(event.request).then(async (response) => {
        await cacheSuccessfulResponse(SHELL_CACHE, event.request, response);
        return response;
      }).catch(async () => (await caches.open(SHELL_CACHE)).match(event.request)));
  }
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? {};
  event.waitUntil(self.registration.showNotification(payload.title ?? "RobertaFunctional", {
    body: payload.body ?? "Hai un nuovo aggiornamento.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { href: payload.href ?? "/?tab=inbox" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requested = new URL(event.notification.data?.href ?? "/?tab=inbox", self.location.origin);
  const targetUrl = requested.origin === self.location.origin
    ? requested.href
    : new URL("/?tab=inbox", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      if ("navigate" in existing) await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});
