const CACHE_NAME = 'smart-location-tracker-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/manifest.json',
  '/app.js',
  '/auth.js',
  '/location-engine.js',
  '/anti-spoof.js',
  '/geofence-engine.js',
  '/offline-queue.js',
  '/firebase-init.js',
  // Icons
  '/icon-72x72.png',
  '/icon-96x96.png',
  '/icon-128x128.png',
  '/icon-144x144.png',
  '/icon-152x152.png',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png',
  // External resources
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'
];

self.addEventListener('install', event => {
  console.log('🔄 Service Worker installing...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching app resources');
        // Cache one by one to avoid failing all if one fails
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
      .catch(error => {
        console.error('❌ Caching failed:', error);
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
    }).then(() => {
      // Claim clients to take control immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('unpkg.com') && 
      !event.request.url.includes('gstatic.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => console.warn('Failed to cache response:', err));

          return response;
        });
      })
      .catch(error => {
        console.warn('Fetch failed:', error);
        // You could return a fallback offline page here
        return new Response('Offline - Content not available');
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
