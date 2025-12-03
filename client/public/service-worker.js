/* eslint-disable no-restricted-globals */

// Import the sync function and the database.
// Note: Vite/Webpack might not bundle these imports directly into a service worker.
// We will use dynamic imports inside the event listeners as a more robust solution.

const CACHE_NAME = 'recordiq-cache-v2'; // Increment version to force update
const API_URL_PREFIX = '/api/';

// URLs to cache when the service worker is installed.
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json', // Assuming you will have a PWA manifest
  // Add paths to your main assets like logos, fonts, etc.
];

/**
 * Installation event: Caches the app shell.
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

/**
 * Activation event: Cleans up old caches.
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

/**
 * Fetch event: Intercepts network requests to handle offline scenarios.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For API requests, use a network-first strategy.
  if (request.url.includes(API_URL_PREFIX)) {
    // Network-first for API calls, but gracefully fallback to cache for GETs
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(async (error) => {
          console.log(`[Service Worker] Network request for ${request.url} failed.`, error);
          // For mutations (POST, PUT, DELETE), queue them for background sync
          if (request.method !== 'GET') {
            return handleApiMutation(request);
          }
          // For GET requests, try to serve a cached response if available
          const cached = await caches.match(request);
          if (cached) return cached;
          // Return a sensible offline response for API GETs
          return new Response(JSON.stringify({ message: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
  } else {
    // For non-API requests (e.g., app shell, assets), use a cache-first strategy
    // and fall back to the cached index.html for navigations
    event.respondWith(
      (async () => {
        try {
          // First try cache
          const cached = await caches.match(request);
          if (cached) return cached;
          
          // Then try network
          return await fetch(request);
        } catch (err) {
          // On any error, serve cached index.html
          console.warn('[Service Worker] Request failed, serving index.html from cache:', err);
          try {
            const fallback = await caches.match('/index.html');
            if (fallback) return fallback;
          } catch (cacheErr) {
            console.warn('[Service Worker] Could not access cache:', cacheErr);
          }
          return new Response('Offline', { status: 503 });
        }
      })()
    );
  }
});

/**
 * Background Sync event: Triggered when the network connection is restored.
 * Note: This is a fallback. The main sync loop now runs in App.jsx every 5 seconds.
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-queue') {
    console.log('[Service Worker] Background sync triggered for sync-queue.');
    // The sync will be handled by the periodic sync in App.jsx
    // This event just signals that the network is back online
  }
});

/**
 * Handles failed API mutations by adding them to the sync queue.
 */
const handleApiMutation = async (request) => {
  const { default: db } = await import('./src/db.js');
  const payload = await request.clone().json();
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const entity = parts[2]; // e.g., 'records', 'invoices'
  const entityId = parts[3]; // The ID for update/delete

  const change = {
    entity: entity,
    action: request.method === 'POST' ? 'create' : request.method === 'PUT' ? 'update' : 'delete',
    payload: payload,
    entityId: entityId,
    timestamp: new Date().toISOString(),
  };

  await db.syncQueue.add(change);
  console.log('[Service Worker] Queued offline change:', change);

  // Register for a background sync to process the queue later
  if ('sync' in self.registration) {
    await self.registration.sync.register('sync-queue');
  }

  // Return a synthetic response to the app to indicate success (offline)
  return new Response(JSON.stringify({ message: 'Request queued for offline sync.' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};