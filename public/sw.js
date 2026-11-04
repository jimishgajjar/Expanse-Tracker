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

// A fetch handler (network passthrough) qualifies this as an installable PWA.
self.addEventListener("fetch", () => {});
