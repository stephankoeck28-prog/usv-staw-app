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

// 🔥 VERBESSERTE IndexedDB mit Transaktionssperre
let db;

// Datenbank öffnen
const request = indexedDB.open('PushDB', 2); // Version 2 für neues Schema

request.onerror = (event) => {
  console.log('❌ IndexedDB Fehler:', event);
};

request.onsuccess = (event) => {
  db = event.target.result;
  console.log('✅ IndexedDB geöffnet');
  
  // Alte Einträge aufräumen (älter als 1 Stunde)
  const transaction = db.transaction(['processed_pushes'], 'readwrite');
  const store = transaction.objectStore('processed_pushes');
  const oneHourAgo = Date.now() - 3600000;
  const range = IDBKeyRange.upperBound(oneHourAgo);
  store.delete(range);
};

request.onupgradeneeded = (event) => {
  db = event.target.result;
  
  // Alten Store löschen falls vorhanden
  if (db.objectStoreNames.contains('pushes')) {
    db.deleteObjectStore('pushes');
  }
  if (db.objectStoreNames.contains('processed_pushes')) {
    db.deleteObjectStore('processed_pushes');
  }
  
  // Neuer Store mit besserem Schema
  const store = db.createObjectStore('processed_pushes', { keyPath: 'id' });
  store.createIndex('timestamp', 'timestamp', { unique: false });
  console.log('✅ IndexedDB Store erstellt (Version 2)');
};

// Prüfen ob eine Push-ID bereits verarbeitet wurde
async function isPushProcessed(messageId) {
  return new Promise((resolve) => {
    if (!db) {
      resolve(false);
      return;
    }
    
    try {
      const transaction = db.transaction(['processed_pushes'], 'readonly');
      const store = transaction.objectStore('processed_pushes');
      const request = store.get(messageId);
      
      request.onsuccess = () => {
        resolve(!!request.result);
      };
      
      request.onerror = () => {
        console.log('❌ Fehler beim Lesen:', request.error);
        resolve(false);
      };
    } catch (e) {
      console.log('❌ Transaktionsfehler:', e);
      resolve(false);
    }
  });
}

// Push-ID als verarbeitet markieren (mit Zeitstempel)
async function markPushAsProcessed(messageId) {
  return new Promise((resolve) => {
    if (!db) {
      resolve();
      return;
    }
    
    try {
      const transaction = db.transaction(['processed_pushes'], 'readwrite');
      const store = transaction.objectStore('processed_pushes');
      store.put({
        id: messageId,
        timestamp: Date.now()
      });
      
      transaction.oncomplete = () => {
        console.log(`✅ Push-ID ${messageId} gespeichert`);
        resolve();
      };
      
      transaction.onerror = () => {
        console.log('❌ Fehler beim Speichern:', transaction.error);
        resolve();
      };
    } catch (e) {
      console.log('❌ Transaktionsfehler:', e);
      resolve();
    }
  });
}

// 🔥 GLOBALES SET für laufende Verarbeitung (verhindert parallele Ausführung)
const processingIds = new Set();

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
    const baseId = payload.data?.message_id || 
                   payload.messageId || 
                   `${payload.notification?.title}-${payload.notification?.body}`;
    const messageId = `push_${baseId}`;
    
    // 🔥 Prüfen ob gerade in Verarbeitung
    if (processingIds.has(messageId)) {
      console.log("⛔ Push wird bereits verarbeitet:", messageId);
      return;
    }
    
    processingIds.add(messageId);
    
    try {
      // 🔥 Prüfen ob diese Push-ID bereits in IndexedDB ist
      const isProcessed = await isPushProcessed(messageId);
      
      if (isProcessed) {
        console.log("⛔ Doppelter Push blockiert (IndexedDB):", messageId);
        processingIds.delete(messageId);
        return;
      }
      
      // Als verarbeitet markieren
      await markPushAsProcessed(messageId);
      
      const title = payload.notification?.title || payload.data?.title || "USV StAW";
      const body = payload.notification?.body || payload.data?.body || "Neue Nachricht";

      await self.registration.showNotification(title, {
        body: body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: messageId,
        renotify: false,
        silent: false,
        data: {
          messageId: messageId,
          timestamp: Date.now(),
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      });
      
      console.log("✅ Benachrichtigung angezeigt:", messageId);
    } catch (error) {
      console.log('❌ Fehler bei Push-Verarbeitung:', error);
    } finally {
      processingIds.delete(messageId);
    }
  });
});

// Auf Klick auf Benachrichtigung reagieren
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Benachrichtigung geklickt:', event.notification);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
