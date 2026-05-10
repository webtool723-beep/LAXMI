importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD07A69fbw_fySq42i5HOBRxZTzfuFhzSg",
  authDomain: "laxmi-42c73.firebaseapp.com",
  projectId: "laxmi-42c73",
  storageBucket: "laxmi-42c73.firebasestorage.app",
  messagingSenderId: "408574438944",
  appId: "1:408574438944:web:da6ece33ab663870f41645"
});

const messaging = firebase.messaging();

function showNotif(title, opts) {
  return self.registration.showNotification(title, opts);
}

messaging.onBackgroundMessage(function(payload) {
  const data = payload.data || {};
  return showNotif(data.title || 'LAXMI', {
    body: data.body || '',
    icon: data.icon || '/logo-192.png',
    badge: '/logo-192.png',
    image: data.image,
    vibrate: [200, 100, 200],
    tag: data.tag || 'rms-notification',
    data: {
      url: data.url || '/',
      click_action: data.click_action || 'open',
      orderId: data.orderId || null
    },
    requireInteraction: true,
    silent: false
  });
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'show-notification') {
    const d = event.data;
    showNotif(d.title || 'LAXMI', {
      body: d.body || '',
      icon: d.icon || '/logo-192.png',
      badge: '/logo-192.png',
      vibrate: [200, 100, 200],
      tag: d.tag || 'rms-notification-' + Date.now(),
      data: {
        url: d.url || '/',
        click_action: 'open',
        orderId: d.orderId || null
      },
      requireInteraction: true,
      silent: false
    });
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.host) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
