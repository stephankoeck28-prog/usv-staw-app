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

// 🔥 VERBESSERT: Speichert nicht nur die reine Push-ID, sondern die Kombination aus User + Aktion + Match
const processedActions = new Map(); // Key: userId-action-matchId, Value: timestamp

// Alle 5 Minuten aufräumen (ältere Einträge löschen)
setInterval(() => {
  const fiveMinutesAgo = Date.now() - 300000;
  for (const [key, timestamp] of processedActions.entries()) {
    if (timestamp < fiveMinutesAgo) {
      processedActions.delete(key);
    }
  }
  console.log(`🧹 Service Worker: ${processedActions.size} aktive Aktionen im Cache`);
}, 300000);

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
    
    // 🔥 NEU: Daten aus dem Push extrahieren
    const data = payload.data || {};
    const userId = data.userId;
    const action = data.action; // "request", "approve", "reject", "newmatch", "reminder"
    const matchId = data.matchId;
    const timestamp = parseInt(data.timestamp) || Date.now();
    
    // Eindeutigen Schlüssel erstellen: wer + was + welches Spiel
    const actionKey = `${userId}-${action}-${matchId}`;
    
    // Prüfen ob die gleiche Aktion für das gleiche Match in den letzten 5 Minuten schon kam
    if (processedActions.has(actionKey)) {
      const lastTime = processedActions.get(actionKey);
      const timeDiff = timestamp - lastTime;
      
      // Wenn weniger als 5 Minuten vergangen sind, ignorieren
      if (timeDiff < 300000) {
        console.log(`⛔ Doppelte Aktion verhindert: ${actionKey} (vor ${Math.round(timeDiff/1000)}s)`);
        return;
      }
    }
    
    // Als verarbeitet markieren
    processedActions.set(actionKey, timestamp);
    console.log(`✅ Neue Aktion gespeichert: ${actionKey}`);
    
    // Benachrichtigungstitel je nach Aktion anpassen
    let title = payload.notification?.title || "USV StAW";
    let body = payload.notification?.body || "Neue Nachricht";
    
    // Falls keine notification im Payload, aus data zusammensetzen
    if (!payload.notification) {
      switch(action) {
        case 'request':
          title = "Neuer Änderungsantrag";
          break;
        case 'approve':
          title = "Antrag genehmigt ✓";
          break;
        case 'reject':
          title = "Antrag abgelehnt ✗";
          break;
        case 'newmatch':
          title = "⚽ Neues Spiel";
          break;
        case 'reminder':
          title = "⏰ Erinnerung";
          break;
      }
    }
    
    // Benachrichtigung zeigen
    self.registration.showNotification(title, {
      body: body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: actionKey, // Verwende den Action-Key als Tag für systemweite De-Duplizierung
      renotify: false,
      silent: false,
      data: {
        userId: userId,
        action: action,
        matchId: matchId,
        timestamp: timestamp,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    });
    
    console.log("✅ Benachrichtigung gesendet für:", actionKey);
  });
});

// Auf Klick auf Benachrichtigung reagieren
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Benachrichtigung geklickt:', event.notification);
  event.notification.close();
  
  // Hier könntest du je nach Aktion verschiedene Seiten öffnen
  // z.B. bei einem Antrag direkt zur Antragsseite
  const action = event.notification.data?.action;
  const matchId = event.notification.data?.matchId;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Wenn bereits ein Fenster offen ist, focus
        for (const client of clientList) {
          if (client.url.includes('/index.html') && 'focus' in client) {
            // Hier könnte man noch Parameter übergeben
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
