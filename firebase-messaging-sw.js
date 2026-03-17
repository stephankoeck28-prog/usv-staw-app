importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAemNwKerXt-hvtikIIACR4oBTb72VjL_U",
  authDomain: "usv-staw-app.firebaseapp.com",
  projectId: "usv-staw-app",
  storageBucket: "usv-staw-app.firebasestorage.app",
  messagingSenderId: "983106867178",
  appId: "1:983106867178:web:90234121a5833e7e396c93"
});

const messaging = firebase.messaging();

// Cache für bereits verarbeitete Push-IDs
let processedIds = [];

// IDs aus dem Cache laden
async function loadProcessedIds() {
  try {
    const cache = await caches.open('push-ids-v1');
    const response = await cache.match('/push-ids');
    if (response) {
      processedIds = await response.json();
      console.log(`✅ ${processedIds.length} gespeicherte Push-IDs geladen`);
    }
  } catch (error) {
    console.log('⚠️ Fehler beim Laden der Push-IDs:', error);
    processedIds = [];
  }
}

// IDs im Cache speichern
async function saveProcessedIds() {
  try {
    const cache = await caches.open('push-ids-v1');
    const keys = await cache.keys();
    for (const key of keys) {
      await cache.delete(key);
    }
    const response = new Response(JSON.stringify(processedIds), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put('/push-ids', response);
  } catch (error) {
    console.log('⚠️ Fehler beim Speichern der Push-IDs:', error);
  }
}

// Beim Start laden
loadProcessedIds();

// Alle 5 Minuten aufräumen
setInterval(async () => {
  const oldCount = processedIds.length;
  processedIds = [];
  await saveProcessedIds();
  console.log(`🧹 Service Worker: ${oldCount} Push-IDs gelöscht`);
}, 300000);

messaging.onBackgroundMessage((payload) => {
  console.log("📨 Push erhalten:", payload);
  
  self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(async (clients) => {
    // Wenn App offen ist, keine Benachrichtigung zeigen
    if (clients.length > 0) {
      console.log("✅ App ist offen - KEINE System-Benachrichtigung");
      return;
    }
    
    console.log("📱 App ist GESCHLOSSEN - zeige Benachrichtigung");
    
    const messageId = payload.data?.message_id || 
                      payload.messageId || 
                      `${payload.notification?.title}-${payload.notification?.body}-${Date.now()}`;
    
    if (processedIds.includes(messageId)) {
      console.log("⛔ Doppelter Push blockiert (permanenter Cache)");
      return;
    }
    
    processedIds.push(messageId);
    await saveProcessedIds();
    
    setTimeout(async () => {
      const index = processedIds.indexOf(messageId);
      if (index > -1) {
        processedIds.splice(index, 1);
        await saveProcessedIds();
        console.log(`🧹 Einzelne Push-ID ${messageId} gelöscht`);
      }
    }, 10000);
    
    // 🔥 ÄNDERUNG 1: IMMER "Neue Nachricht" anzeigen
    const title = "📱 USV St Andrä Wördern";
    const body = "Neue Nachricht";

    self.registration.showNotification(title, {
      body: body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: messageId,
      renotify: false,
      silent: false,
      data: {
        messageId: messageId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    });
  });
});

// Auf Klick auf Benachrichtigung reagieren
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Benachrichtigung geklickt:', event.notification);
  event.notification.close();
  
  // 🔥 ÄNDERUNG 2: Korrekter Pfad für GitHub Pages
  const appPath = '/usv-staw-app/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Schauen ob die App schon in einem Tab offen ist
        for (const client of clientList) {
          if (client.url.includes(appPath) && 'focus' in client) {
            return client.focus();
          }
        }
        // Sonst neuen Tab öffnen
        if (clients.openWindow) {
          return clients.openWindow(appPath);
        }
      })
  );
});
