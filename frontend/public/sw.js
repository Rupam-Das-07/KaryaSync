const CACHE_NAME = 'karyasync-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Just a pass-through to satisfy PWA requirements
  // In a real app, you'd cache assets here
  event.respondWith(fetch(event.request));
});
