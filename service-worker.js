const CACHE_NAME = 'smart-location-tracker-v1';
const BASE_PATH = '/smart-location-tracker/';

const urlsToCache = [
  BASE_PATH,
  BASE_PATH + 'index.html',  // Explicitly cache index.html
  BASE_PATH + 'styles.css',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'app.js',
  BASE_PATH + 'auth.js',
  BASE_PATH + 'location-engine.js',
  BASE_PATH + 'anti-spoof.js',
  BASE_PATH + 'geofence-engine.js',
  BASE_PATH + 'offline-queue.js',
  BASE_PATH + 'firebase-init.js',
  // Icons
  BASE_PATH + 'icon-72x72.png',
  BASE_PATH + 'icon-96x96.png',
  BASE_PATH + 'icon-128x128.png',
  BASE_PATH + 'icon-144x144.png',
  BASE_PATH + 'icon-152x152.png',
  BASE_PATH + 'icon-192x192.png',
  BASE_PATH + 'icon-384x384.png',
  BASE_PATH + 'icon-512x512.png',
  // External resources
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force activation
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim() // Take control of all clients immediately
    ])
  );
});

// Fetch event - serve from cache with network fallback (stale-while-revalidate strategy)
self.addEventListener('fetch', event => {
  // Skip cross-origin requests like Firebase and Leaflet
  if (event.request.url.startsWith('http') && !event.request.url.startsWith(self.location.origin)) {
    // For external resources, use network-first strategy
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful responses for offline use
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For same-origin requests, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Return cached response and update cache in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseClone);
                });
              }
            })
            .catch(() => {});
          return response;
        }

        return fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(error => {
            console.log('Fetch failed:', error);
            // Return custom offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match(BASE_PATH + 'index.html');
            }
          });
      })
  );
});

// Background sync for offline location updates
self.addEventListener('sync', event => {
  if (event.tag === 'sync-locations') {
    event.waitUntil(syncLocations());
  }
});

async function syncLocations() {
  try {
    const db = await openDB();
    const tx = db.transaction('offlineLocations', 'readonly');
    const store = tx.objectStore('offlineLocations');
    const locations = await store.getAll();

    console.log(`Syncing ${locations.length} offline locations`);

    for (const location of locations) {
      try {
        // Use a more generic endpoint or Firebase directly
        const response = await fetch('https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/locations', {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              userId: { stringValue: location.userId },
              latitude: { doubleValue: location.latitude },
              longitude: { doubleValue: location.longitude },
              accuracy: { doubleValue: location.accuracy },
              timestamp: { timestampValue: location.timestamp },
              isMocked: { booleanValue: location.isMocked || false }
            }
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          // Remove synced location
          const deleteTx = db.transaction('offlineLocations', 'readwrite');
          const deleteStore = deleteTx.objectStore('offlineLocations');
          await deleteStore.delete(location.id);
          console.log('Synced location:', location.id);
        }
      } catch (error) {
        console.error('Failed to sync location:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LocationTrackerDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineLocations')) {
        db.createObjectStore('offlineLocations', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Handle push notifications (optional)
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: BASE_PATH + 'icon-192x192.png',
    badge: BASE_PATH + 'icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Location'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Smart Location Tracker', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow(BASE_PATH)
    );
  }
});
