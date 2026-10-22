// CalAI Service Worker for Web Push notifications

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || 'CalAI';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag,
      data: payload.data || { url: '/' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('[sw] Failed to parse push payload:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
