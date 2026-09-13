/* Arabiyat Mart push worker. It intentionally has no fetch/cache handler. */

const SAFE_TARGET =
  /^\/(?:ar|en)\/(?:notifications|favorites|saved-searches|profile|search|me\/listings|me\/offers(?:\/[A-Za-z0-9_-]{2,160})?|me\/leads\/[A-Za-z0-9_-]{2,160}|listing\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;

function safeTarget(value) {
  if (typeof value !== "string" || !SAFE_TARGET.test(value)) {
    return "/en/notifications";
  }
  return value;
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.slice(0, 160)
      : "Arabiyat Mart";
  const body =
    typeof payload.body === "string" ? payload.body.slice(0, 500) : undefined;
  const target = safeTarget(payload.target);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { target },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeTarget(event.notification.data?.target);
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
