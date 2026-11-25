/* Expense Tracker service worker — handles Web Push notifications. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Expense Tracker", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Expense Tracker";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let destination = new URL("/", self.location.origin);
  try {
    const target = new URL(event.notification.data?.url || "/", destination);
    if (target.origin === destination.origin) destination = target;
  } catch { /* Open the dashboard for an invalid notification link. */ }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find(client => client.url === destination.href);
      if (existing) return existing.focus();
      return self.clients.openWindow(destination.href);
    }),
  );
});

// Offline fallback. Only the static offline page is cached: financial pages and API
// responses are never stored, so nothing private is kept by the service worker.
const OFFLINE_CACHE = "offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .catch(() => { /* Installing must not fail because the page was unreachable. */ })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("offline-") && key !== OFFLINE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network first for page loads; show the offline page only when the network fails.
// Every other request passes straight through (and qualifies this as an installable PWA).
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((page) => page || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } })),
    ),
  );
});
