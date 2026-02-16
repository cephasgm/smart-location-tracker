const CACHE_NAME = 'smart-location-tracker-v1';
const BASE_PATH = '/smart-location-tracker';

const urlsToCache = [
  BASE_PATH + '/',
  BASE_PATH + '/styles.css',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/app.js',
  BASE_PATH + '/auth.js',
  BASE_PATH + '/location-engine.js',
  BASE_PATH + '/anti-spoof.js',
  BASE_PATH + '/geofence-engine.js',
  BASE_PATH + '/offline-queue.js',
  BASE_PATH + '/firebase-init.js',
  // Icons
  BASE_PATH + '/icon-72x72.png',
  BASE_PATH + '/icon-96x96.png',
  BASE_PATH + '/icon-128x128.png',
  BASE_PATH + '/icon-144x144.png',
  BASE_PATH + '/icon-152x152.png',
  BASE_PATH + '/icon-192x192.png',
  BASE_PATH + '/icon-384x384.png',
  BASE_PATH + '/icon-512x512.png',
  // External resources
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
  console.log('🔄 Service Worker installing...');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching app resources');
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(error => {
              console.warn(`⚠️ Failed to cache ${url}:`, error.message);
              return null;
            })
          )
        );
      })
      .then(results => {
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`✅ Caching complete: ${succeeded} succeeded, ${failed} failed`);
      })
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
  // Handle requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200) {
              return response;
            }

            // Cache successful responses
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Return offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match(BASE_PATH + '/');
            }
            return new Response('Offline');
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
