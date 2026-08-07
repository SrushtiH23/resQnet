// ResQNet Mobile Service Worker for PWA Background Sensor Monitoring
const CACHE_NAME = 'resqnet-v2';
const urlsToCache = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Never intercept API requests, WebSockets, or non-GET requests
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('ws://') ||
    event.request.url.includes('wss://')
  ) {
    return;
  }

  // Network-first strategy with cache fallback (prevents dev fetch errors)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Background Sync / Sensor Keep-Alive handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'sensor-sync') {
    console.log('[SW] Background Sensor Sync triggered');
  }
});
