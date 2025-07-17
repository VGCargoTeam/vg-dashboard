const CACHE_NAME = 'charter-dashboard-cache-v1';
const urlsToCache = [
  '/Dashboard.html',
  '/script.js',
  '/style.css', // Annahme, dass Sie eine style.css haben
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  // Fügen Sie hier alle weiteren statischen Assets hinzu, die Sie cachen möchten
  // z.B. Bilder, andere CSS/JS-Dateien, etc.
  'https://images.pexels.com/photos/358319/pexels-photo-358319.jpeg' // Das Hintergrundbild
];

// Installiere den Service Worker und cache alle notwendigen Assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Abfangen von Fetch-Anfragen und Bereitstellung aus dem Cache, falls verfügbar
self.addEventListener('fetch', event => {
  // Versuche, die Anfrage aus dem Cache zu bedienen
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache Hit - gib die gecachte Version zurück
        if (response) {
          return response;
        }

        // Cache Miss - gehe zum Netzwerk
        return fetch(event.request).then(
          function(response) {
            // Überprüfe, ob wir eine gültige Antwort erhalten haben
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Wichtig: Klone die Antwort. Eine Antwort ist ein Stream und kann nur einmal gelesen werden.
            // Da wir sie sowohl dem Browser zurückgeben als auch im Cache speichern wollen, müssen wir sie klonen.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

// Aktiviere den Service Worker und lösche alte Caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Lösche alte Caches
          }
        })
      );
    })
  );
});
