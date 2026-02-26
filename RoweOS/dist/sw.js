// RoweOS Service Worker — Push Notifications (v20.13)
// Minimal SW: handles push events only, no caching/fetch interception

self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data.json(); } catch(e) {
    data = { title: 'RoweOS', body: event.data ? event.data.text() : 'New notification' };
  }

  var options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-48.png',
    data: { url: data.url || '/', type: data.type || 'general' },
    tag: data.tag || 'roweos-' + Date.now(),
    renotify: !!data.tag
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'RoweOS', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Focus existing RoweOS window if open
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.indexOf(self.location.origin) !== -1) {
          client.focus();
          return;
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});
