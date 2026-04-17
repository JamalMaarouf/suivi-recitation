// File d'attente offline pour les écritures Supabase
// Quand l'utilisateur est hors ligne, les écritures sont stockées dans IndexedDB
// et automatiquement synchronisées dès que la connexion revient.
//
// Usage:
//   import { enqueueOrRun } from '../lib/offlineQueue';
//   const result = await enqueueOrRun('validations', 'insert', payload, user.ecole_id);
//   // result.status: 'online' | 'queued'
//
// Écoute automatique du retour online → sync auto.

const DB_NAME = 'suivi-recitation-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_ops';

let dbPromise = null;
let syncInProgress = false;
let listeners = new Set(); // callbacks pour UI (ex: badge "3 en attente")

// ── Init IndexedDB ──────────────────────────────────────────────
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('created_at', 'created_at', { unique: false });
        store.createIndex('ecole_id', 'ecole_id', { unique: false });
      }
    };
  });
  return dbPromise;
}

// ── Opérations CRUD sur la queue ────────────────────────────────
async function addToQueue(op) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add({ ...op, created_at: Date.now(), attempts: 0 });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeFromQueue(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateAttempts(id, attempts, lastError) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (!item) return resolve();
      item.attempts = attempts;
      item.last_error = lastError;
      item.last_attempt_at = Date.now();
      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ── API publique ────────────────────────────────────────────────

/**
 * Compte combien d'opérations sont en attente.
 */
export async function pendingCount() {
  try {
    const all = await getAllFromQueue();
    return all.length;
  } catch { return 0; }
}

/**
 * Abonne un callback qui est appelé à chaque changement de la queue.
 * Retourne une fonction de désabonnement.
 */
export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  pendingCount().then(count => {
    listeners.forEach(cb => { try { cb(count); } catch {} });
  });
}

/**
 * Vide toute la file (en cas de reset ou si l'utilisateur change).
 */
export async function clearQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => { notifyListeners(); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Tente d'exécuter une opération Supabase. Si offline, la met en queue.
 *
 * @param {Object} supabase - Client Supabase
 * @param {string} table - Nom de la table
 * @param {string} action - 'insert' | 'update' | 'delete'
 * @param {Object} payload - Données à envoyer
 * @param {string} ecoleId - ecole_id (pour filtrage futur)
 * @param {Object} filter - Pour update/delete: { column: value }
 * @returns {Promise<{status: 'online'|'queued', error?: Error}>}
 */
export async function enqueueOrRun(supabase, table, action, payload, ecoleId, filter = null) {
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (!isOffline) {
    // Tenter l'exécution directe
    try {
      let result;
      if (action === 'insert') {
        result = await supabase.from(table).insert(payload);
      } else if (action === 'update' && filter) {
        let q = supabase.from(table).update(payload);
        for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
        result = await q;
      } else if (action === 'delete' && filter) {
        let q = supabase.from(table).delete();
        for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
        result = await q;
      } else {
        throw new Error(`Action non supportee: ${action}`);
      }

      if (result?.error) {
        // Détecter si c'est une erreur réseau → queue, sinon on retourne l'erreur
        if (isNetworkError(result.error)) {
          await addToQueue({ table, action, payload, filter, ecole_id: ecoleId });
          notifyListeners();
          return { status: 'queued' };
        }
        return { status: 'online', error: result.error };
      }
      return { status: 'online' };
    } catch (err) {
      if (isNetworkError(err)) {
        await addToQueue({ table, action, payload, filter, ecole_id: ecoleId });
        notifyListeners();
        return { status: 'queued' };
      }
      return { status: 'online', error: err };
    }
  } else {
    // Offline : direct en queue
    await addToQueue({ table, action, payload, filter, ecole_id: ecoleId });
    notifyListeners();
    return { status: 'queued' };
  }
}

function isNetworkError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch')) return true;
  if (err.name === 'TypeError') return true;
  return false;
}

/**
 * Synchronise toutes les opérations en attente.
 * Appelée automatiquement au retour online.
 */
export async function syncPending(supabase) {
  if (syncInProgress) return { synced: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { synced: 0, failed: 0 };

  syncInProgress = true;
  let synced = 0, failed = 0;

  try {
    const all = await getAllFromQueue();
    if (all.length === 0) {
      syncInProgress = false;
      return { synced: 0, failed: 0 };
    }

    // Tri par ordre chronologique (FIFO)
    all.sort((a, b) => a.created_at - b.created_at);

    for (const op of all) {
      try {
        let result;
        if (op.action === 'insert') {
          result = await supabase.from(op.table).insert(op.payload);
        } else if (op.action === 'update' && op.filter) {
          let q = supabase.from(op.table).update(op.payload);
          for (const [k, v] of Object.entries(op.filter)) q = q.eq(k, v);
          result = await q;
        } else if (op.action === 'delete' && op.filter) {
          let q = supabase.from(op.table).delete();
          for (const [k, v] of Object.entries(op.filter)) q = q.eq(k, v);
          result = await q;
        }

        if (result?.error) {
          // Si erreur métier (RLS, validation) : on abandonne cette op
          if (!isNetworkError(result.error)) {
            await removeFromQueue(op.id);
            failed++;
            continue;
          }
          // Erreur réseau : on retry plus tard
          await updateAttempts(op.id, (op.attempts || 0) + 1, result.error.message);
          failed++;
          // Si 10+ tentatives, on abandonne
          if ((op.attempts || 0) >= 10) {
            await removeFromQueue(op.id);
          }
        } else {
          await removeFromQueue(op.id);
          synced++;
        }
      } catch (err) {
        if (!isNetworkError(err)) {
          // Erreur fatale → drop pour ne pas bloquer la queue
          await removeFromQueue(op.id);
          failed++;
        } else {
          await updateAttempts(op.id, (op.attempts || 0) + 1, err.message);
          failed++;
          if ((op.attempts || 0) >= 10) {
            await removeFromQueue(op.id);
          }
        }
      }
    }
  } catch (err) {
    console.error('[offlineQueue] sync error:', err);
  } finally {
    syncInProgress = false;
    notifyListeners();
  }

  return { synced, failed };
}

/**
 * Installe les listeners globaux (à appeler une seule fois dans App.js).
 * Robuste pour mobile : plusieurs mécanismes de détection en parallèle car
 * les events online/offline sont peu fiables sur Android PWA et iOS Safari.
 */
export function installAutoSync(supabase, onSynced) {
  const emitSynced = (res) => {
    if (res.synced > 0 && typeof window !== 'undefined') {
      import('./cache').then(({ invalidateAll }) => invalidateAll());
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('offline-synced', { detail: res }));
      }, 500);
    }
    if (onSynced) onSynced(res);
  };

  const trySync = async () => {
    if (!navigator.onLine) return;
    const count = await pendingCount();
    if (count === 0) return;
    const res = await syncPending(supabase);
    emitSynced(res);
  };

  // 1. Event natif 'online' (marche sur PC, parfois sur mobile)
  window.addEventListener('online', trySync);

  // 2. Sync au démarrage si des ops attendent d'une session précédente
  if (navigator.onLine) {
    setTimeout(trySync, 2000);
  }

  // 3. Sync périodique toutes les 15 secondes (crucial sur mobile ou les
  //    events online/offline peuvent etre absents ou tres en retard)
  setInterval(trySync, 15 * 1000);

  // 4. Sync quand l'app revient en premier plan — PWA mobile apprecie
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      trySync();
    }
  });

  // 5. Sync au focus de la fenetre
  window.addEventListener('focus', trySync);

  // 6. Sync lors d'une interaction utilisateur (filet de securite)
  //    Rate limit a 1 fois par minute pour ne pas spammer
  let lastInteractionSync = 0;
  const interactionSync = () => {
    const now = Date.now();
    if (now - lastInteractionSync < 60000) return;
    lastInteractionSync = now;
    trySync();
  };
  window.addEventListener('touchstart', interactionSync, { passive: true });
  window.addEventListener('click', interactionSync, { passive: true });
}
