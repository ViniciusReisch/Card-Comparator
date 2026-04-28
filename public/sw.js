self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Required for Chrome PWA installability criteria
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title ?? "Rayquaza Monitor";
  const options = {
    body: data.body ?? "",
    tag: data.tag ?? "rayquaza",
    icon: data.icon ?? "/notification-icon-192.png",
    badge: "/notification-badge-96.png",
    image: data.image ?? undefined,
    data: { url: data.url ?? null },
    actions: data.url ? [{ action: "open", title: "\u{1F517} Abrir oferta" }] : [],
    requireInteraction: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      })
    );
  }
});
