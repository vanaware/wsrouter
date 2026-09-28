// example/public/sw.js
const CACHE_NAME = 'wsrouter-v0.3.5';
const ASSETS = [
  './',
  './index.html',
  './components/App.js',
  './components/Header.js',
  './components/EntryGate.js',
  './components/WebRTCExample.js',
  './components/PresenceExample.js',
  './components/JwtExample.js',
  './components/ApiInspectorExample.js',
  './components/ServerSettingsModal.js',
  './components/config.js',
  './components/version.js',
  './components/StreamView.js',
  './components/ChatPanel.js',
  './components/OnlineUsers.js',
  './components/StreamStats.js',
  './components/ReactionOverlay.js',
  'https://cdn.jsdelivr.net/npm/beercss@3.9.4/dist/cdn/beer.min.css',
  'https://cdn.jsdelivr.net/npm/beercss@3.9.4/dist/cdn/beer.min.js',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;

  // Skip Service Worker for cross-origin API calls or external resources (except CDNs)
  if (!isLocal) {
    const isCdn = url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('gstatic.com');
    if (!isCdn) return;
  }

  // Skip caching for local API requests too
  if (isLocal && url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Only cache local assets or specific trusted CDNs
        const isCdn = url.hostname.includes('cdn.jsdelivr.net') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('gstatic.com');

        if (response.status === 200 && (isLocal || isCdn)) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      });
    })
  );
});
