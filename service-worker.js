const CACHE_NAME = 'smart-location-tracker-v1';
const BASE_PATH = '/';  // Changed from '/smart-location-tracker/'

const urlsToCache = [
  BASE_PATH,
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

self.addEventListener('install', event => {
  console.log('🔄 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching app resources');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('✅ Service Worker activated');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-locations') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(syncLocations());
  }
});

async function syncLocations() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_LOCATIONS'
      });
    });
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}
