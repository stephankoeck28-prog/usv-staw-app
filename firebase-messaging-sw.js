// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyAemNwKkerXt-hvtikIIACR4oBTb72VjL_U",
  authDomain: "usv-staw-app.firebaseapp.com",
  projectId: "usv-staw-app",
  storageBucket: "usv-staw-app.appspot.com",
  messagingSenderId: "983106867178",
  appId: "1:983106867178:web:90234121a5833e7e396c93"
});

const messaging = firebase.messaging();

// Einfacher Background-Handler
messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);
  
  const title = payload.notification?.title || 'USV StAW';
  const options = {
    body: payload.notification?.body || 'Neue Nachricht',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200]
  };

  return self.registration.showNotification(title, options);
});

// Sehr einfacher Notification-Click (ohne Promise-Komplexität)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

// Minimaler Fetch-Handler
self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
