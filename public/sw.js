// Service Worker - Suivi Récitation
// Stratégie:
// - index.html et manifest : TOUJOURS réseau d'abord (detection de nouvelle version)
// - assets JS/CSS hashés : cache-first (immuable car hash dans le nom)
// - API Supabase/Resend : jamais cachée (direct fetch)

const CACHE_VERSION = 'v5-2026-04-17';
const CACHE_NAME = `suivi-recitation-${CACHE_VERSION}`;

// Resources de base pour mode offline
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: cache les assets de base, SKIP waiting pour activation immediate
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: supprimer TOUS les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // NE PAS intercepter les APIs
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('resend.com')) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation / HTML : NETWORK FIRST (voir les mises a jour tout de suite)
  const isNavigation = event.request.mode === 'navigate';
  const isHtml = url.pathname === '/' || url.pathname.endsWith('.html');

  if (isNavigation || isHtml) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then((cached) => cached || caches.match('/index.html') || caches.match('/'));
        })
    );
    return;
  }

  // Assets hashés (immutables) : CACHE FIRST
  const isHashedAsset = /\.[0-9a-f]{8,}\.(js|css|woff2?|ttf|otf|png|jpg|svg)$/i.test(url.pathname);
  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Par defaut : NETWORK FIRST
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Messages pour forcer update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
