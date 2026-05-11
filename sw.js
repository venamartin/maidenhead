const CACHE_NAME = 'maidenhead-shell-v4';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './js/App.js',
    './js/DbEngine.js',
    './js/MapController.js',
    './js/Maidenhead.js',
    './js/Phonetics.js',
    './js/lib/leaflet.js',
    './js/lib/leaflet.css',
    './js/lib/sqlite3.js',
    './js/lib/sqlite3.wasm',
    './icon-192.png',
    './icon-512.png'
];

// Step 1: Install and cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching App Shell');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Step 2: Activate and clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    return self.clients.claim();
});

// Step 3: Fetch assets from cache if available, otherwise network
self.addEventListener('fetch', (event) => {
    // We only want to handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                // If both fail, and it's a navigation request, we could return a fallback
                console.error('[Service Worker] Fetch failed for:', event.request.url);
            });
        })
    );
});