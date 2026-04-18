// Service Worker - Suivi Récitation
// STRATÉGIE: network-first pour TOUT sauf les assets hashés.
// Priorité absolue : toujours servir le dernier code déployé.
// Le cache est un simple filet de sécurité pour le mode offline.

const CACHE_VERSION = 'v8-2026-04-19-offline';
const CACHE_NAME = `suivi-recitation-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  // Activation immediate, pas d'attente
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Supprimer TOUS les anciens caches (pas juste d'autres versions suivi-recitation)
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // Prendre le controle immediat de tous les clients ouverts
      await self.clients.claim();
      // Forcer le reload des onglets ouverts pour qu'ils prennent le nouveau code
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({ type: 'RELOAD_AFTER_UPDATE' });
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // NE PAS intercepter les APIs (Supabase, Resend, /api/*)
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('resend.com')) return;
  if (url.pathname.startsWith('/api/')) return;

  // Pour l'index.html et la navigation: toujours reseau d'abord avec no-store.
  // Fallback cache UNIQUEMENT si offline.
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
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return new Response('Hors ligne', { status: 503 });
        })
    );
    return;
  }

  // Assets hashes (...xxxxxxxx.js, .css, etc.) : cache-first car immutables
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

  // Tout le reste : network-first (images non hashees, fonts, etc.)
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

// Messages depuis l'app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
