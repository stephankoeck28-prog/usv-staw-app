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

// 🔥 IndexedDB für dauerhafte Speicherung
let db;

// Datenbank öffnen
const request = indexedDB.open('PushDB', 1);

request.onerror = (event) => {
  console.log('❌ IndexedDB Fehler:', event);
};

request.onsuccess = (event) => {
  db = event.target.result;
  console.log('✅ IndexedDB geöffnet');
  
  // Alte Einträge aufräumen (älter als 1 Minute)
  const transaction = db.transaction(['pushes'], 'readwrite');
  const store = transaction.objectStore('pushes');
  const oneMinuteAgo = Date.now() - 60000;
  const range = IDBKeyRange.upperBound(oneMinuteAgo);
  store.delete(range);
};

request.onupgradeneeded = (event) => {
  db = event.target.result;
  const store = db.createObjectStore('pushes', { keyPath: 'id' });
  store.createIndex('timestamp', 'timestamp', { unique: false });
  console.log('✅ IndexedDB Store erstellt');
};

// Prüfen ob eine Push-ID bereits verarbeitet wurde
async function isPushProcessed(messageId) {
  return new Promise((resolve) => {
    if (!db) {
      resolve(false);
      return;
    }
    
    const transaction = db.transaction(['pushes'], 'readonly');
    const store = transaction.objectStore('pushes');
    const request = store.get(messageId);
    
    request.onsuccess = () => {
      resolve(!!request.result);
    };
    
    request.onerror = () => {
      resolve(false);
    };
  });
}

// Push-ID als verarbeitet markieren
async function markPushAsProcessed(messageId) {
  return new Promise((resolve) => {
    if (!db) {
      resolve();
      return;
    }
    
    const transaction = db.transaction(['pushes'], 'readwrite');
    const store = transaction.objectStore('pushes');
    store.put({
      id: messageId,
      timestamp: Date.now()
    });
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

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
    
    console.log("📱 App ist GESCHLOSSEN - prüfe auf Duplikate");
    
    // Eindeutige ID für den Push erstellen
    const messageId = payload.data?.message_id || 
                      payload.messageId || 
                      `${payload.notification?.title}-${payload.notification?.body}-${Date.now()}`;
    
    // 🔥 Prüfen ob diese Push-ID bereits in IndexedDB ist
    const isProcessed = await isPushProcessed(messageId);
    
    if (isProcessed) {
      console.log("⛔ Doppelter Push blockiert (IndexedDB):", messageId);
      return;
    }
    
    // Als verarbeitet markieren
    await markPushAsProcessed(messageId);
    
    const title = payload.notification?.title || payload.data?.title || "USV StAW";
    const body = payload.notification?.body || payload.data?.body || "Neue Nachricht";

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
  
  const messageId = event.notification.data?.messageId;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Wenn bereits ein Fenster offen ist, focus
        for (const client of clientList) {
          if (client.url.includes('/index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        // Sonst neues Fenster öffnen
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
