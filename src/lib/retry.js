// Helper de retry automatique pour les opérations réseau critiques
// À utiliser autour des écritures importantes (validations, paiements, etc.)
//
// Usage :
//   import { withRetry } from '../lib/retry';
//   const { data, error } = await withRetry(() =>
//     supabase.from('validations').insert(payload)
//   );
//
// Le helper réessaye automatiquement 2 fois en cas d'erreur réseau
// (coupure WiFi, timeout), avec délai croissant (500ms puis 1500ms).

const DEFAULT_MAX_RETRIES = 2; // 1 tentative initiale + 2 retries = 3 essais max
const DEFAULT_BASE_DELAY_MS = 500;

// Détermine si une erreur mérite un retry
// On retry uniquement les erreurs réseau, PAS les erreurs métier (RLS, validation)
function isRetriableError(err) {
  if (!err) return false;
  // Erreurs réseau JS natives
  if (err.name === 'TypeError' && err.message?.includes('fetch')) return true;
  if (err.message?.toLowerCase().includes('network')) return true;
  if (err.message?.toLowerCase().includes('failed to fetch')) return true;
  // Erreurs Supabase avec code réseau/timeout
  if (err.code === 'PGRST301' || err.code === 'PGRST302') return true; // timeouts
  if (err.code === '08000' || err.code === '08006') return true; // connection
  // Codes HTTP typiques d'instabilité réseau
  if (err.status === 503 || err.status === 504 || err.status === 408) return true;
  return false;
}

// Détermine si une réponse Supabase contient une erreur retriable
function isRetriableSupabaseResponse(res) {
  if (!res) return false;
  if (res.error) return isRetriableError(res.error);
  return false;
}

/**
 * Exécute une opération async avec retry automatique.
 * @param {Function} operation - Fonction qui retourne une Promise (typiquement une requête Supabase)
 * @param {Object} options
 * @param {number} options.maxRetries - Nombre de retries (défaut: 2)
 * @param {number} options.baseDelayMs - Délai initial en ms (défaut: 500)
 * @param {Function} options.onRetry - Callback appelé à chaque retry, reçoit (attemptNumber, error)
 * @returns {Promise} Le résultat de l'opération, ou lève l'erreur finale
 */
export async function withRetry(operation, options = {}) {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const onRetry = options.onRetry;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check offline avant de tenter
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        // Si hors ligne, on attend un peu et on retry (le navigateur peut se reconnecter)
        if (attempt < maxRetries) {
          if (onRetry) onRetry(attempt + 1, new Error('offline'));
          await sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }
        throw new Error('offline');
      }

      const result = await operation();

      // Cas Supabase : la réponse peut contenir un .error sans throw
      if (isRetriableSupabaseResponse(result)) {
        lastError = result.error;
        if (attempt < maxRetries) {
          if (onRetry) onRetry(attempt + 1, result.error);
          await sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }
        return result; // Dernier essai, on retourne quand même la réponse
      }

      return result;
    } catch (err) {
      lastError = err;

      // Erreur non retriable → on relève tout de suite (échec métier, 400, 401, etc.)
      if (!isRetriableError(err)) {
        throw err;
      }

      // Plus de retries disponibles
      if (attempt >= maxRetries) {
        throw err;
      }

      // Retry avec backoff exponentiel
      if (onRetry) onRetry(attempt + 1, err);
      await sleep(baseDelay * Math.pow(2, attempt));
    }
  }

  throw lastError || new Error('withRetry: failed without error');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Version "friendly" qui affiche un toast automatiquement à chaque tentative.
 * Usage :
 *   await withRetryToast(() => supabase.from('validations').insert(p), toast, lang)
 */
export async function withRetryToast(operation, toast, lang = 'fr', options = {}) {
  const messages = {
    fr: {
      retry: (n) => `Réseau instable, nouvelle tentative ${n}/3...`,
      offline: 'Hors ligne — action mise en attente',
    },
    ar: {
      retry: (n) => `الشبكة غير مستقرة، محاولة ${n}/3...`,
      offline: 'غير متصل — العملية معلقة',
    },
    en: {
      retry: (n) => `Network issue, retrying ${n}/3...`,
      offline: 'Offline — action queued',
    },
  };
  const m = messages[lang] || messages.fr;

  return withRetry(operation, {
    ...options,
    onRetry: (attempt, err) => {
      if (toast) {
        if (err?.message === 'offline') {
          toast.warning?.(m.offline);
        } else {
          toast.info?.(m.retry(attempt + 1));
        }
      }
      if (options.onRetry) options.onRetry(attempt, err);
    },
  });
}
