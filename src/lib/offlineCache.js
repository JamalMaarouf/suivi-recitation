// ═══════════════════════════════════════════════════════════════
// OFFLINE CACHE - Cache persistant IndexedDB avec stale-while-revalidate
// ═══════════════════════════════════════════════════════════════
//
// Contrairement à cache.js (en RAM, perdu au reload), ce cache survit
// aux fermetures de l'app et permet un vrai mode offline.
//
// Usage :
//   import { cacheGet, cacheSet, swr } from '../lib/offlineCache';
//
//   // Dans un composant :
//   const data = await swr(
//     'eleves_ecole_X',
//     () => supabase.from('eleves').select('*').eq('ecole_id', ecoleId),
//     (data) => setEleves(data)  // callback appelé 2 fois : cache puis réseau
//   );
//
// Stratégie stale-while-revalidate :
//   1. Retourne immédiatement depuis le cache (si existe)
//   2. Lance une requête réseau en arrière-plan
//   3. Met à jour le cache + appelle onUpdate(data) quand le réseau répond
//   4. Si pas de réseau : reste sur les données du cache
//   5. Si pas de cache ET pas de réseau : throw (composant doit gérer)
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'suivi-recitation-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache_entries';

// Durée de validité : 7 jours
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
  return dbPromise;
}

// ─── API de base ─────────────────────────────────────────────────

/**
 * Récupère une entrée du cache. Retourne { data, timestamp, age_ms } ou null.
 */
export async function cacheGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return resolve(null);
        const age_ms = Date.now() - entry.timestamp;
        resolve({ data: entry.data, timestamp: entry.timestamp, age_ms });
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn('[offlineCache] cacheGet error', e);
    return null;
  }
}

/**
 * Stocke des données dans le cache. La clé devrait être descriptive
 * (ex: "eleves_ecole_<uuid>", "validations_eleve_<id>").
 */
export async function cacheSet(key, data) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ key, data, timestamp: Date.now() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('[offlineCache] cacheSet error', e);
    return false;
  }
}

/**
 * Supprime une entrée du cache.
 */
export async function cacheDelete(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

/**
 * Supprime toutes les entrées. Utile à la déconnexion.
 */
export async function cacheClearAll() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

/**
 * Purge les entrées expirées (âge > CACHE_TTL_MS).
 * Appelé automatiquement au démarrage de l'app.
 */
export async function cachePurgeExpired() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      let deleted = 0;
      const now = Date.now();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if ((now - cursor.value.timestamp) > CACHE_TTL_MS) {
            cursor.delete();
            deleted++;
          }
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };
      req.onerror = () => resolve(0);
    });
  } catch (e) {
    return 0;
  }
}

// ─── Helper stale-while-revalidate ──────────────────────────────

/**
 * Stratégie stale-while-revalidate :
 *  1. Lit le cache, retourne immédiatement via onUpdate(cachedData, {fromCache:true})
 *  2. En parallèle, lance le loader (réseau)
 *  3. Quand le loader répond, met à jour le cache + onUpdate(freshData, {fromCache:false})
 *  4. Si erreur réseau : onUpdate(cachedData, {fromCache:true, networkFailed:true}) si pas déjà fait
 *  5. Retourne la promesse résolue avec les données finales (réseau si dispo, sinon cache)
 *
 * @param {string} key - clé unique pour cette donnée
 * @param {Function} loader - () => Promise<data>  (ex: () => supabase.from('...').select())
 * @param {Function} onUpdate - (data, meta) => void  (callback pour mettre à jour l'UI)
 * @returns Promise<{data, source: 'cache'|'network'|'none'}>
 */
export async function swr(key, loader, onUpdate) {
  let cachedUsed = false;
  let cachedData = null;

  // 1. Lire le cache
  try {
    const cached = await cacheGet(key);
    if (cached && cached.data) {
      cachedData = cached.data;
      cachedUsed = true;
      if (onUpdate) onUpdate(cachedData, { fromCache: true, age_ms: cached.age_ms });
    }
  } catch (e) { /* ignore */ }

  // 2. Lancer le réseau
  try {
    const result = await loader();
    // Normaliser : supporter {data, error} ou array direct
    const freshData = result?.data !== undefined ? result.data : result;
    // Si erreur Supabase
    if (result?.error) {
      throw new Error(result.error.message || 'Erreur réseau');
    }
    // 3. Mettre à jour cache + UI
    await cacheSet(key, freshData);
    if (onUpdate) onUpdate(freshData, { fromCache: false });
    return { data: freshData, source: 'network' };
  } catch (networkErr) {
    // Réseau KO
    if (cachedUsed) {
      // On a déjà donné les données du cache via onUpdate initial
      return { data: cachedData, source: 'cache', networkFailed: true };
    }
    // Pas de cache ET pas de réseau : échec complet
    if (onUpdate) onUpdate(null, { fromCache: false, networkFailed: true, noCacheNorNetwork: true });
    throw new Error('Aucune donnée disponible (ni cache ni réseau)');
  }
}

/**
 * Version simplifiée : lit depuis cache si dispo, sinon depuis réseau.
 * Retourne { data, source, age_ms }.
 * Ne met PAS à jour le cache si les données viennent du cache.
 */
export async function cacheOrFetch(key, loader, { maxAge = CACHE_TTL_MS } = {}) {
  const cached = await cacheGet(key);
  if (cached && cached.data && cached.age_ms < maxAge) {
    return { data: cached.data, source: 'cache', age_ms: cached.age_ms };
  }
  try {
    const result = await loader();
    const data = result?.data !== undefined ? result.data : result;
    if (result?.error) throw new Error(result.error.message);
    await cacheSet(key, data);
    return { data, source: 'network', age_ms: 0 };
  } catch (e) {
    if (cached && cached.data) {
      return { data: cached.data, source: 'cache', age_ms: cached.age_ms, networkFailed: true };
    }
    throw e;
  }
}

// ─── Purge automatique au chargement ───────────────────────────
if (typeof window !== 'undefined') {
  // Purge les entrées expirées après 5s (pas bloquant au démarrage)
  setTimeout(() => { cachePurgeExpired().catch(() => {}); }, 5000);
}
