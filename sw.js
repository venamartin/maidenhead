const CACHE_NAME = 'maidenhead-shell-v2';

// Step 1: Install the service worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installed');
    self.skipWaiting();
});

// Step 2: Activate and clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activated');
    event.waitUntil(clients.claim());
});

// Step 3: Intercept network requests (Empty for now)
self.addEventListener('fetch', (event) => {
    // SQLite/Tile routing logic will go here
});