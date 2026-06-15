const CACHE_NAME = 'alphadino-cache-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './game/index.html',
  './game/game.css',
  './game/game.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Event - cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching files');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - network fallback to cache (offline-first)
self.addEventListener('fetch', event => {
  // Only handle GET requests and local/font resources
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then(networkResponse => {
        // Cache new fetched resources on the fly (e.g. external fonts)
        if (event.request.url.startsWith(self.location.origin) || event.request.url.includes('fonts.googleapis.com')) {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback if not in cache and network fails
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
