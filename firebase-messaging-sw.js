importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAemNwKerXt-hvtikIIACR4oBTb72VjL_U",
  authDomain: "usv-staw-app.firebaseapp.com",
  projectId: "usv-staw-app",
  storageBucket: "usv-staw-app.appspot.com",
  messagingSenderId: "983106867178",
  appId: "1:983106867178:web:90234121a5833e7e396c93"
});

const messaging = firebase.messaging();

// Einfaches Set für kürzlich verarbeitete Nachrichten
const recentMessages = new Set();

// Alle 2 Sekunden aufräumen (kurz genug für doppelte Pushes)
setInterval(() => {
  recentMessages.clear();
}, 2000);

messaging.onBackgroundMessage((payload) => {
  console.log("📨 Push erhalten:", payload);
  
  // Prüfen ob die App offen ist
  self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clients) => {
    // Wenn App offen ist, keine Benachrichtigung
    if (clients.length > 0) {
      console.log("✅ App offen - keine Benachrichtigung");
      return;
    }
    
    // EINFACHE ID: Titel + Body
    const messageId = `${payload.notification?.title}-${payload.notification?.body}`;
    
    // Wenn in den letzten 2 Sekunden schon gesehen, ignorieren
    if (recentMessages.has(messageId)) {
      console.log("⛔ Doppelte Nachricht ignoriert");
      return;
    }
    
    // Als gesehen markieren
    recentMessages.add(messageId);
    
    // Benachrichtigung zeigen
    const title = payload.notification?.title || "USV StAW";
    const body = payload.notification?.body || "Neue Nachricht";

    self.registration.showNotification(title, {
      body: body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: messageId,  // Verhindert doppelte Benachrichtigungen im System
      renotify: false,
      silent: false
    });
    
    console.log("✅ Benachrichtigung gesendet");
  });
});

// Auf Klick reagieren
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
