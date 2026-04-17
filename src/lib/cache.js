// Cache global simple pour éviter de recharger les mêmes données à chaque navigation
// Usage :
//   const eleves = await getCached('eleves', ecoleId, () =>
//     supabase.from('eleves').select('*').eq('ecole_id', ecoleId)
//   );
//
// Le cache stocke par (key, ecoleId) et expire après TTL_MS.
// invalidate('eleves', ecoleId) force un rechargement après une écriture.

const TTL_MS = 60 * 1000; // 60 secondes — rafraîchissement auto après 1 min
const cache = new Map(); // key -> { data, timestamp }
const inflight = new Map(); // key -> Promise en cours (pour dédupliquer)

function makeKey(key, ecoleId) {
  return `${key}:${ecoleId || 'global'}`;
}

/**
 * Récupère depuis le cache ou appelle le loader si expiré/absent.
 * Le loader doit retourner une Promise avec { data, error } (style Supabase)
 * ou directement un array (résultat de .select().eq()... .then(r=>r.data)).
 */
export async function getCached(key, ecoleId, loader, options = {}) {
  const ttl = options.ttl ?? TTL_MS;
  const fullKey = makeKey(key, ecoleId);
  const entry = cache.get(fullKey);
  const now = Date.now();

  // Cache valide → retour immédiat (synchrone-ish, très rapide)
  if (entry && (now - entry.timestamp) < ttl) {
    return entry.data;
  }

  // Pas de cache ou expiré → appel
  const result = await loader();
  // Normaliser : supporter {data, error} ou array direct
  const data = result?.data !== undefined ? result.data : result;
  cache.set(fullKey, { data, timestamp: now });
  return data;
}

/**
 * Invalide une entrée spécifique (après INSERT/UPDATE/DELETE).
 * Ex: après avoir ajouté un élève, invalidate('eleves', user.ecole_id)
 */
export function invalidate(key, ecoleId) {
  cache.delete(makeKey(key, ecoleId));
}

/**
 * Invalide plusieurs clés d'un coup (après une opération qui touche plusieurs tables).
 */
export function invalidateMany(keys, ecoleId) {
  keys.forEach(k => cache.delete(makeKey(k, ecoleId)));
}

/**
 * Invalide TOUT le cache pour une école (ex: à la déconnexion ou changement d'école).
 */
export function invalidateAll(ecoleId) {
  if (!ecoleId) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.endsWith(`:${ecoleId}`)) cache.delete(k);
  }
}

/**
 * Version "stale-while-revalidate" : retourne immédiatement les données en cache
 * (même expirées) et déclenche un refresh en arrière-plan.
 * Idéal pour les dashboards — affichage instantané, données fraîches dans 1-2s.
 *
 * Usage:
 *   const eleves = await getCachedSWR('eleves', ecoleId, loader, (fresh) => {
 *     setEleves(fresh); // update quand le fetch termine
 *   });
 */
export async function getCachedSWR(key, ecoleId, loader, onFresh) {
  const fullKey = makeKey(key, ecoleId);
  const entry = cache.get(fullKey);

  if (entry) {
    // Retour immédiat depuis le cache
    const age = Date.now() - entry.timestamp;
    if (age < TTL_MS) {
      return entry.data; // cache frais, pas de refresh
    }
    // Cache vieux → refresh en arrière-plan, mais retourne quand même l'ancien
    (async () => {
      try {
        const result = await loader();
        // Ne rien mettre en cache si Supabase a renvoyé une erreur
        if (result?.error) return;
        const data = result?.data !== undefined ? result.data : result;
        if (data === null || data === undefined) return;
        cache.set(fullKey, { data, timestamp: Date.now() });
        if (onFresh) onFresh(data);
      } catch (e) { /* silencieux */ }
    })();
    return entry.data;
  }

  // Pas de cache du tout → attendre le fetch.
  // DÉDUP : si une requête pour la même clé est déjà en cours, on attend
  // celle-là au lieu d'en lancer une nouvelle. Évite les doublons quand
  // le login précharge en parallèle du chargement Dashboard.
  if (inflight.has(fullKey)) {
    return inflight.get(fullKey);
  }

  const p = (async () => {
    try {
      const result = await loader();
      if (result?.error) {
        console.warn(`[cache] fetch error for ${fullKey}:`, result.error.message);
        return [];
      }
      const data = result?.data !== undefined ? result.data : result;
      if (data === null || data === undefined) return [];
      cache.set(fullKey, { data, timestamp: Date.now() });
      return data;
    } catch (e) {
      console.warn(`[cache] fetch exception for ${fullKey}:`, e.message);
      return []; // Ne pas casser la page, renvoyer array vide
    } finally {
      inflight.delete(fullKey);
    }
  })();
  inflight.set(fullKey, p);
  return p;
}
